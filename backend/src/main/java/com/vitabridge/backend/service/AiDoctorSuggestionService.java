package com.vitabridge.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vitabridge.backend.dto.AiDoctorSuggestionDoctor;
import com.vitabridge.backend.dto.AiDoctorSuggestionResponse;
import com.vitabridge.backend.dto.DoctorResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AiDoctorSuggestionService {

    private static final Logger logger = LoggerFactory.getLogger(AiDoctorSuggestionService.class);
    private static final int MAX_DOCTORS = 4;

    @Value("${ai.checker.api.url:https://openrouter.ai/api/v1/chat/completions}")
    private String aiApiUrl;

    @Value("${ai.checker.api.key:}")
    private String aiApiKey;

    @Value("${ai.checker.model:meta-llama/llama-3.1-8b-instruct:free}")
    private String aiModel;

    @Value("${app.frontendUrl:http://127.0.0.1:5174}")
    private String appReferer;

    @Autowired
    private DoctorService doctorService;

    @Autowired
    private ObjectMapper objectMapper;

    public AiDoctorSuggestionResponse suggestForSymptoms(String symptoms) {
        String normalizedSymptoms = symptoms == null ? "" : symptoms.trim();
        if (normalizedSymptoms.isBlank()) {
            throw new IllegalArgumentException("Symptoms cannot be empty.");
        }

        List<DoctorResponse> activeDoctors = doctorService.getAllDoctors().stream()
                .filter(doctor -> Boolean.TRUE.equals(doctor.getIsActive()))
                .collect(Collectors.toList());

        if (activeDoctors.isEmpty()) {
            throw new IllegalArgumentException("No active doctors are currently available.");
        }

        AiDoctorSuggestionResponse response = callFreeAi(normalizedSymptoms, activeDoctors);
        if (response == null) {
            response = localFallback(normalizedSymptoms);
            response.setSource("fallback-rule");
        } else {
            response.setSource("openrouter-free");
        }

        response.setDoctors(matchDoctors(response, activeDoctors));
        if (response.getDoctors().isEmpty()) {
            response.setDoctors(activeDoctors.stream()
                    .sorted(Comparator.comparing(DoctorResponse::getYearOfExperience,
                            Comparator.nullsLast(Comparator.reverseOrder())))
                    .limit(MAX_DOCTORS)
                    .map(this::toSuggestionDoctor)
                    .collect(Collectors.toList()));
        }

        return response;
    }

    private AiDoctorSuggestionResponse callFreeAi(String symptoms, List<DoctorResponse> doctors) {
        if (aiApiKey == null || aiApiKey.isBlank()) {
            logger.info("ai.checker.api.key is not configured; using fallback rules.");
            return null;
        }

        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();

            Set<String> specializations = doctors.stream()
                    .map(DoctorResponse::getSpecialization)
                    .filter(Objects::nonNull)
                    .filter(spec -> !spec.isBlank())
                    .collect(Collectors.toCollection(LinkedHashSet::new));

            String systemPrompt = "You are a medical triage assistant. " +
                    "Given patient symptoms, return only strict JSON with keys: " +
                    "field (string), confidence (integer 1-100), experience (string), related (array of strings). " +
                    "Do not include markdown or extra text.";

            String userPrompt = "Symptoms: " + symptoms + "\n" +
                    "Prefer one of these specializations if possible: " + String.join(", ", specializations) + "\n" +
                    "If uncertain, return field as General Medicine.";

            JsonNode requestJson = objectMapper.createObjectNode()
                    .put("model", aiModel)
                    .set("messages", objectMapper.createArrayNode()
                            .add(objectMapper.createObjectNode()
                                    .put("role", "system")
                                    .put("content", systemPrompt))
                            .add(objectMapper.createObjectNode()
                                    .put("role", "user")
                                    .put("content", userPrompt)));

            ((com.fasterxml.jackson.databind.node.ObjectNode) requestJson).put("temperature", 0.2);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(aiApiUrl))
                    .timeout(Duration.ofSeconds(25))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + aiApiKey)
                    .header("HTTP-Referer", appReferer)
                    .header("X-Title", "VitaBridge AI Doctor Checker")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestJson)))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                logger.warn("OpenRouter call failed: status={}, body={}", response.statusCode(), response.body());
                return null;
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
            if (contentNode.isMissingNode() || contentNode.asText().isBlank()) {
                return null;
            }

            String cleaned = extractJson(contentNode.asText());
            JsonNode aiJson = objectMapper.readTree(cleaned);

            AiDoctorSuggestionResponse parsed = new AiDoctorSuggestionResponse();
            parsed.setField(textOrDefault(aiJson.get("field"), "General Medicine"));
            parsed.setConfidence(clampConfidence(aiJson.get("confidence")));
            parsed.setExperience(textOrDefault(aiJson.get("experience"), "4+ years"));

            List<String> related = new ArrayList<>();
            JsonNode relatedNode = aiJson.get("related");
            if (relatedNode != null && relatedNode.isArray()) {
                relatedNode.forEach(node -> {
                    String value = node.asText("").trim();
                    if (!value.isBlank()) {
                        related.add(value);
                    }
                });
            }
            if (related.isEmpty()) {
                related.add("Internal Medicine");
            }
            parsed.setRelated(related);

            return parsed;
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            logger.warn("Failed to call free AI API, using fallback rules: {}", ex.getMessage());
            return null;
        }
    }

    private List<AiDoctorSuggestionDoctor> matchDoctors(
            AiDoctorSuggestionResponse response,
            List<DoctorResponse> activeDoctors) {

        String targetField = response.getField() == null ? "" : response.getField().toLowerCase(Locale.ROOT);
        Set<String> related = response.getRelated() == null
                ? Set.of()
                : response.getRelated().stream()
                .filter(Objects::nonNull)
                .map(value -> value.toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());

        return activeDoctors.stream()
                .filter(doctor -> {
                    String specialization = doctor.getSpecialization() == null
                            ? ""
                            : doctor.getSpecialization().toLowerCase(Locale.ROOT);
                    return specialization.contains(targetField)
                            || related.stream().anyMatch(specialization::contains)
                            || targetField.contains(specialization);
                })
                .sorted(Comparator.comparing(DoctorResponse::getYearOfExperience,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(MAX_DOCTORS)
                .map(this::toSuggestionDoctor)
                .collect(Collectors.toList());
    }

    private AiDoctorSuggestionDoctor toSuggestionDoctor(DoctorResponse doctor) {
        String fullName = (doctor.getFirstName() == null ? "" : doctor.getFirstName())
                + " "
                + (doctor.getLastName() == null ? "" : doctor.getLastName());
        return new AiDoctorSuggestionDoctor(
                doctor.getDoctorId(),
                fullName.trim(),
                doctor.getSpecialization(),
                doctor.getYearOfExperience(),
                doctor.getLocation(),
                doctor.getConsultationFee());
    }

    private AiDoctorSuggestionResponse localFallback(String symptoms) {
        String text = symptoms.toLowerCase(Locale.ROOT);
        AiDoctorSuggestionResponse fallback = new AiDoctorSuggestionResponse();
        fallback.setExperience("5+ years");

        if (containsAny(text, "chest", "heart", "palpitation", "pressure", "bp")) {
            fallback.setField("Cardiology");
            fallback.setConfidence(86);
            fallback.setRelated(List.of("Internal Medicine", "Pulmonology"));
        } else if (containsAny(text, "skin", "rash", "itch", "acne", "eczema")) {
            fallback.setField("Dermatology");
            fallback.setConfidence(84);
            fallback.setRelated(List.of("Allergy", "Internal Medicine"));
        } else if (containsAny(text, "stomach", "abdomen", "nausea", "vomit", "digestion")) {
            fallback.setField("Gastroenterology");
            fallback.setConfidence(83);
            fallback.setRelated(List.of("General Surgery", "Internal Medicine"));
        } else if (containsAny(text, "headache", "dizzy", "migraine", "numb", "seizure")) {
            fallback.setField("Neurology");
            fallback.setConfidence(82);
            fallback.setRelated(List.of("Psychiatry", "Internal Medicine"));
        } else if (containsAny(text, "cough", "breath", "asthma", "lungs", "wheezing")) {
            fallback.setField("Pulmonology");
            fallback.setConfidence(83);
            fallback.setRelated(List.of("Internal Medicine", "ENT"));
        } else {
            fallback.setField("General Medicine");
            fallback.setConfidence(72);
            fallback.setRelated(List.of("Internal Medicine", "Family Medicine"));
        }

        return fallback;
    }

    private boolean containsAny(String text, String... words) {
        for (String word : words) {
            if (text.contains(word)) {
                return true;
            }
        }
        return false;
    }

    private String extractJson(String content) {
        String trimmed = content.trim();

        if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
            trimmed = trimmed.replaceFirst("^```[a-zA-Z]*", "").replaceFirst("```$", "").trim();
        }

        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return trimmed.substring(start, end + 1);
        }

        return trimmed;
    }

    private String textOrDefault(JsonNode node, String fallback) {
        if (node == null) {
            return fallback;
        }
        String value = node.asText("").trim();
        return value.isBlank() ? fallback : value;
    }

    private int clampConfidence(JsonNode node) {
        int value = node == null ? 70 : node.asInt(70);
        if (value < 1) {
            return 1;
        }
        if (value > 100) {
            return 100;
        }
        return value;
    }
}
