package com.vitabridge.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.vitabridge.backend.dto.AiDoctorConversationMessage;
import com.vitabridge.backend.dto.AiDoctorSuggestionDoctor;
import com.vitabridge.backend.dto.AiDoctorSuggestionRequest;
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
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class AiDoctorConversationService {

    private static final Logger logger = LoggerFactory.getLogger(AiDoctorConversationService.class);

    private static final int MAX_DOCTORS = 4;
    private static final int MIN_USER_TURNS_FOR_FINAL = 3;

    private static final Pattern EMERGENCY_PATTERN = Pattern.compile(
            "\\b(chest pain|can'?t breathe|difficulty breathing|shortness of breath|"
                    + "heart attack|stroke|unconscious|severe bleeding|bleeding heavily|"
                    + "suicid|kill myself|anaphylaxis|face drooping|arm weak|speech difficult|"
                    + "severe allergic)\\b",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern OFF_TOPIC_PATTERN = Pattern.compile(
            "\\b(write code|python|javascript|stock|crypto|relationship|recipe|sports|weather|"
                    + "news|politics|hack|jailbreak|ignore previous)\\b",
            Pattern.CASE_INSENSITIVE);

    private static final String EMERGENCY_MESSAGE =
            "This sounds like a medical emergency. Seek immediate medical attention now and ask someone nearby to help you right away. Do not wait.";

    private static final String OFF_TOPIC_MESSAGE =
            "I can only assist with medical symptom assessment. Please describe your symptoms.";

    private static final List<String> CARDIO_KEYWORDS = List.of("chest", "heart", "palpitation", "pressure", "bp", "hypertension", "tightness");
    private static final List<String> DERM_KEYWORDS = List.of("skin", "rash", "itch", "acne", "eczema", "hives", "red patch", "red patches");
    private static final List<String> GI_KEYWORDS = List.of("stomach", "abdomen", "belly", "nausea", "vomit", "vomiting", "diarrhea", "digestion", "acidity");
    private static final List<String> NEURO_KEYWORDS = List.of("headache", "migraine", "dizzy", "dizziness", "seizure", "numb", "weakness", "tingling");
    private static final List<String> PULMO_KEYWORDS = List.of("cough", "breath", "asthma", "wheezing", "lungs", "shortness of breath", "breathing");
    private static final List<String> ENT_KEYWORDS = List.of("ear", "nose", "throat", "sinus", "hoarseness", "blocked nose", "sore throat");

    private static final Map<String, Set<String>> FIELD_ALIASES = Map.of(
            "Cardiology", Set.of("cardiology", "cardiologist", "heart", "cardiac"),
            "Dermatology", Set.of("dermatology", "dermatologist", "skin"),
            "Gastroenterology", Set.of("gastroenterology", "gastroenterologist", "gi", "stomach"),
            "Neurology", Set.of("neurology", "neurologist", "neuro"),
            "Pulmonology", Set.of("pulmonology", "pulmonologist", "respiratory", "lung"),
            "ENT", Set.of("ent", "ear", "nose", "throat", "otolaryngology"),
            "General Medicine", Set.of("general medicine", "internal medicine", "family medicine", "general practice", "gp"));

    private static final Map<String, List<FollowUpTopic>> QUESTION_PLANS = Map.of(
            "Cardiology", List.of(FollowUpTopic.DURATION, FollowUpTopic.SEVERITY, FollowUpTopic.BREATHING),
            "Dermatology", List.of(FollowUpTopic.DURATION, FollowUpTopic.SKIN_SPREAD, FollowUpTopic.TRIGGER),
            "Gastroenterology", List.of(FollowUpTopic.DURATION, FollowUpTopic.LOCATION, FollowUpTopic.ASSOCIATED_SYMPTOMS),
            "Neurology", List.of(FollowUpTopic.DURATION, FollowUpTopic.SEVERITY, FollowUpTopic.ASSOCIATED_SYMPTOMS),
            "Pulmonology", List.of(FollowUpTopic.DURATION, FollowUpTopic.BREATHING, FollowUpTopic.ASSOCIATED_SYMPTOMS),
            "ENT", List.of(FollowUpTopic.DURATION, FollowUpTopic.ASSOCIATED_SYMPTOMS, FollowUpTopic.TRIGGER),
            "General Medicine", List.of(FollowUpTopic.DURATION, FollowUpTopic.SEVERITY, FollowUpTopic.ASSOCIATED_SYMPTOMS));

    @Autowired
    private DoctorService doctorService;

    @Autowired
    private ObjectMapper objectMapper;

    @Value("${ai.conversation.ollama.url:http://127.0.0.1:11434/api/chat}")
    private String ollamaApiUrl;

    @Value("${ai.conversation.ollama.model:llama3:8b}")
    private String ollamaModel;

    public Map<String, Object> getAiEngineStatus() {
        boolean localModelAvailable = isLocalModelAvailable();

        Map<String, Object> status = new LinkedHashMap<>();
        status.put("provider", "ollama-local");
        status.put("model", ollamaModel);
        status.put("endpoint", ollamaApiUrl);
        status.put("available", localModelAvailable);
        status.put("activeSource", localModelAvailable ? "ollama-local" : "rule-triage");
        status.put("fallbackEnabled", true);
        return status;
    }

    public AiDoctorSuggestionResponse suggestForSymptoms(AiDoctorSuggestionRequest request) {
        String normalizedSymptoms = request == null || request.getSymptoms() == null
                ? ""
                : request.getSymptoms().trim();
        if (normalizedSymptoms.isBlank()) {
            throw new IllegalArgumentException("Symptoms cannot be empty.");
        }

        List<DoctorResponse> activeDoctors = doctorService.getAllDoctors().stream()
                .filter(doctor -> Boolean.TRUE.equals(doctor.getIsActive()))
                .collect(Collectors.toList());

        if (activeDoctors.isEmpty()) {
            throw new IllegalArgumentException("No active doctors are currently available.");
        }

        List<ConversationTurn> conversation = normalizeConversation(request, normalizedSymptoms);
        String latestUserMessage = latestUserMessage(conversation);

        if (EMERGENCY_PATTERN.matcher(latestUserMessage).find()) {
            return buildEmergencyResponse();
        }

        if (OFF_TOPIC_PATTERN.matcher(latestUserMessage).find()) {
            return buildOffTopicResponse();
        }

        TriageDecision decision = triageWithLocalModel(conversation);
        boolean usedLocalModel = decision != null;
        if (decision == null) {
            decision = triageWithRules(conversation);
        }

        AiDoctorSuggestionResponse response = new AiDoctorSuggestionResponse();
        response.setField(decision.field);
        response.setConfidence(decision.confidence);
        response.setExperience(experienceGuidance(decision.field));
        response.setRelated(relatedFieldsFor(decision.field));
        response.setSource(usedLocalModel ? "ollama-local" : "rule-triage");
        response.setNeedsMoreInfo(decision.needsMoreInfo);
        response.setAnswerAccepted(decision.answerAccepted);
        response.setQuestionType(decision.questionType);
        response.setNextQuestion(decision.nextQuestion);
        response.setAssistantMessage(decision.assistantMessage);

        if (decision.needsMoreInfo) {
            response.setDoctors(List.of());
            return response;
        }

        List<AiDoctorSuggestionDoctor> matched = matchDoctors(
                decision.field,
                response.getRelated(),
                activeDoctors);

        if (matched.isEmpty()) {
            matched = activeDoctors.stream()
                    .sorted(Comparator.comparing(DoctorResponse::getYearOfExperience,
                            Comparator.nullsLast(Comparator.reverseOrder())))
                    .limit(MAX_DOCTORS)
                    .map(this::toSuggestionDoctor)
                    .collect(Collectors.toList());
        }

        response.setDoctors(matched);
        return response;
    }

    private AiDoctorSuggestionResponse buildEmergencyResponse() {
        AiDoctorSuggestionResponse response = new AiDoctorSuggestionResponse();
        response.setField("Emergency Care");
        response.setConfidence(100);
        response.setExperience("Immediate in-person emergency care");
        response.setRelated(List.of("Emergency Medicine", "Critical Care"));
        response.setDoctors(List.of());
        response.setSource("safety-fast-path");
        response.setNeedsMoreInfo(false);
        response.setAnswerAccepted(true);
        response.setQuestionType(null);
        response.setNextQuestion(null);
        response.setAssistantMessage(EMERGENCY_MESSAGE);
        return response;
    }

    private AiDoctorSuggestionResponse buildOffTopicResponse() {
        AiDoctorSuggestionResponse response = new AiDoctorSuggestionResponse();
        response.setField("General Medicine");
        response.setConfidence(60);
        response.setExperience("4+ years");
        response.setRelated(List.of("Internal Medicine", "Family Medicine"));
        response.setDoctors(List.of());
        response.setSource("safety-fast-path");
        response.setNeedsMoreInfo(true);
        response.setAnswerAccepted(false);
        response.setQuestionType("SYMPTOM_DESCRIPTION");
        response.setNextQuestion("Please describe your medical symptoms in one or two sentences.");
        response.setAssistantMessage(OFF_TOPIC_MESSAGE);
        return response;
    }

    private TriageDecision triageWithLocalModel(List<ConversationTurn> conversation) {
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(4))
                    .build();

            String transcript = buildConversationTranscript(conversation);
            String systemPrompt = "You are a medical triage assistant for specialty routing only. "
                    + "Never diagnose or prescribe medication. "
                    + "Ask one concise follow-up question per turn until enough info is collected. "
                    + "Emergency red flags must return urgent handling language. "
                    + "Return only strict JSON with keys: "
                    + "field (string), confidence (integer 1-100), needsMoreInfo (boolean), "
                    + "nextQuestion (string), assistantMessage (string), questionType (string). "
                    + "Use field values from: Cardiology, Dermatology, Gastroenterology, Neurology, Pulmonology, ENT, General Medicine.";

            ObjectNode payload = objectMapper.createObjectNode();
            payload.put("model", ollamaModel);
            payload.put("stream", false);

            ObjectNode options = objectMapper.createObjectNode();
            options.put("temperature", 0.2);
            options.put("top_p", 0.9);
            options.put("num_predict", 256);
            payload.set("options", options);

            ArrayNode messages = objectMapper.createArrayNode();
            messages.add(objectMapper.createObjectNode()
                    .put("role", "system")
                    .put("content", systemPrompt));
            messages.add(objectMapper.createObjectNode()
                    .put("role", "user")
                    .put("content", "Conversation:\n" + transcript));
            payload.set("messages", messages);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ollamaApiUrl))
                    .timeout(Duration.ofSeconds(20))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                logger.debug("Local model call failed with status {}.", response.statusCode());
                return null;
            }

            JsonNode root = objectMapper.readTree(response.body());
            String content = root.path("message").path("content").asText("").trim();
            if (content.isBlank()) {
                return null;
            }

            JsonNode aiJson = objectMapper.readTree(extractJson(content));
            String combinedUserText = combinedUserText(conversation);

            TriageDecision decision = new TriageDecision();
            decision.field = normalizeField(textOrDefault(aiJson.get("field"), inferField(combinedUserText)));
            decision.confidence = clampConfidence(aiJson.get("confidence"), 76);
            decision.needsMoreInfo = aiJson.path("needsMoreInfo").asBoolean(false);
            decision.nextQuestion = nullableText(aiJson.get("nextQuestion"));
            decision.assistantMessage = nullableText(aiJson.get("assistantMessage"));
            decision.questionType = nullableText(aiJson.get("questionType"));
            decision.answerAccepted = true;

            if (decision.needsMoreInfo) {
                if (decision.nextQuestion == null) {
                    FollowUpTopic fallbackTopic = chooseNextTopic(decision.field, coveredTopics(combinedUserText));
                    decision.nextQuestion = questionForTopic(fallbackTopic == null ? FollowUpTopic.ASSOCIATED_SYMPTOMS : fallbackTopic);
                    decision.questionType = (fallbackTopic == null ? FollowUpTopic.ASSOCIATED_SYMPTOMS : fallbackTopic).name();
                }
                if (decision.assistantMessage == null) {
                    decision.assistantMessage = decision.nextQuestion;
                }
            } else if (decision.assistantMessage == null) {
                decision.assistantMessage = buildFinalSummary(decision.field);
            }

            return decision;
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            logger.debug("Local model unavailable. Falling back to rule triage: {}", ex.getMessage());
            return null;
        }
    }

    private TriageDecision triageWithRules(List<ConversationTurn> conversation) {
        String combinedUserText = combinedUserText(conversation);
        String field = inferField(combinedUserText);
        Set<FollowUpTopic> covered = coveredTopics(combinedUserText);
        int userTurns = (int) conversation.stream().filter(turn -> "user".equals(turn.role)).count();

        FollowUpTopic nextTopic = chooseNextTopic(field, covered);

        TriageDecision decision = new TriageDecision();
        decision.field = field;
        decision.confidence = confidenceFor(field, combinedUserText, covered.size(), nextTopic == null);

        if (userTurns < MIN_USER_TURNS_FOR_FINAL || nextTopic != null) {
            FollowUpTopic topic = nextTopic == null ? FollowUpTopic.ASSOCIATED_SYMPTOMS : nextTopic;
            decision.needsMoreInfo = true;
            decision.answerAccepted = true;
            decision.questionType = topic.name();
            decision.nextQuestion = questionForTopic(topic);
            decision.assistantMessage = decision.nextQuestion;
            return decision;
        }

        decision.needsMoreInfo = false;
        decision.answerAccepted = true;
        decision.questionType = null;
        decision.nextQuestion = null;
        decision.assistantMessage = buildFinalSummary(field);
        return decision;
    }

    private boolean isLocalModelAvailable() {
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(3))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(buildOllamaTagsUrl()))
                    .timeout(Duration.ofSeconds(4))
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return false;
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode models = root.path("models");
            if (!models.isArray()) {
                return false;
            }

            for (JsonNode modelNode : models) {
                String name = modelNode.path("name").asText("").trim().toLowerCase(Locale.ROOT);
                String target = ollamaModel.trim().toLowerCase(Locale.ROOT);
                if (name.equals(target)
                        || name.startsWith(target + ":")
                        || target.startsWith(name + ":")) {
                    return true;
                }
            }
            return false;
        } catch (Exception ex) {
            logger.debug("Unable to inspect local model status: {}", ex.getMessage());
            return false;
        }
    }

    private String buildOllamaTagsUrl() {
        String normalized = ollamaApiUrl == null ? "" : ollamaApiUrl.trim();
        if (normalized.isBlank()) {
            return "http://127.0.0.1:11434/api/tags";
        }
        if (normalized.endsWith("/api/chat")) {
            return normalized.substring(0, normalized.length() - "/api/chat".length()) + "/api/tags";
        }
        if (normalized.endsWith("/api/generate")) {
            return normalized.substring(0, normalized.length() - "/api/generate".length()) + "/api/tags";
        }
        if (normalized.endsWith("/")) {
            return normalized + "api/tags";
        }
        if (normalized.contains("/api/")) {
            int idx = normalized.indexOf("/api/");
            return normalized.substring(0, idx) + "/api/tags";
        }
        return normalized + "/api/tags";
    }

    private List<ConversationTurn> normalizeConversation(AiDoctorSuggestionRequest request, String symptoms) {
        List<ConversationTurn> turns = new ArrayList<>();

        if (request != null && request.getConversation() != null) {
            for (AiDoctorConversationMessage message : request.getConversation()) {
                if (message == null) {
                    continue;
                }
                String role = normalizeRole(message.getRole());
                String text = normalizeText(message.getText());
                if (role == null || text.isBlank()) {
                    continue;
                }
                turns.add(new ConversationTurn(role, text));
            }
        }

        if (turns.isEmpty()) {
            turns.add(new ConversationTurn("user", symptoms));
            return turns;
        }

        boolean hasUser = turns.stream().anyMatch(turn -> "user".equals(turn.role));
        if (!hasUser) {
            turns.add(0, new ConversationTurn("user", symptoms));
        }

        return turns;
    }

    private String normalizeRole(String role) {
        String normalized = normalizeText(role).toLowerCase(Locale.ROOT);
        if (normalized.equals("assistant") || normalized.equals("bot")) {
            return "assistant";
        }
        if (normalized.equals("user") || normalized.equals("patient")) {
            return "user";
        }
        return null;
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim();
    }

    private String latestUserMessage(List<ConversationTurn> conversation) {
        for (int i = conversation.size() - 1; i >= 0; i--) {
            ConversationTurn turn = conversation.get(i);
            if ("user".equals(turn.role) && !turn.text.isBlank()) {
                return turn.text;
            }
        }
        return "";
    }

    private String combinedUserText(List<ConversationTurn> conversation) {
        return conversation.stream()
                .filter(turn -> "user".equals(turn.role))
                .map(turn -> turn.text)
                .filter(text -> !text.isBlank())
                .collect(Collectors.joining(" "));
    }

    private String buildConversationTranscript(List<ConversationTurn> conversation) {
        return conversation.stream()
                .filter(turn -> !turn.text.isBlank())
                .map(turn -> turn.role + ": " + turn.text)
                .collect(Collectors.joining("\n"));
    }

    private String extractJson(String content) {
        String trimmed = content == null ? "" : content.trim();
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

    private String inferField(String text) {
        String normalized = text == null ? "" : text.toLowerCase(Locale.ROOT);
        if (containsAny(normalized, CARDIO_KEYWORDS)) {
            return "Cardiology";
        }
        if (containsAny(normalized, DERM_KEYWORDS)) {
            return "Dermatology";
        }
        if (containsAny(normalized, GI_KEYWORDS)) {
            return "Gastroenterology";
        }
        if (containsAny(normalized, NEURO_KEYWORDS)) {
            return "Neurology";
        }
        if (containsAny(normalized, PULMO_KEYWORDS)) {
            return "Pulmonology";
        }
        if (containsAny(normalized, ENT_KEYWORDS)) {
            return "ENT";
        }
        return "General Medicine";
    }

    private String normalizeField(String field) {
        String raw = field == null ? "" : field.trim();
        if (raw.isBlank()) {
            return "General Medicine";
        }

        for (Map.Entry<String, Set<String>> entry : FIELD_ALIASES.entrySet()) {
            String canonical = entry.getKey();
            if (canonical.equalsIgnoreCase(raw)) {
                return canonical;
            }
            String lowerRaw = raw.toLowerCase(Locale.ROOT);
            for (String alias : entry.getValue()) {
                if (lowerRaw.contains(alias) || alias.contains(lowerRaw)) {
                    return canonical;
                }
            }
        }

        return "General Medicine";
    }

    private List<String> relatedFieldsFor(String field) {
        return switch (field) {
            case "Cardiology" -> List.of("Internal Medicine", "Pulmonology");
            case "Dermatology" -> List.of("Allergy", "Internal Medicine");
            case "Gastroenterology" -> List.of("Internal Medicine", "General Surgery");
            case "Neurology" -> List.of("Psychiatry", "Internal Medicine");
            case "Pulmonology" -> List.of("Internal Medicine", "ENT");
            case "ENT" -> List.of("Internal Medicine", "Pulmonology");
            default -> List.of("Internal Medicine", "Family Medicine");
        };
    }

    private Set<FollowUpTopic> coveredTopics(String text) {
        String normalized = text == null ? "" : text.toLowerCase(Locale.ROOT);
        Set<FollowUpTopic> covered = new LinkedHashSet<>();

        if (normalized.matches(".*\\b\\d+\\s*(day|days|week|weeks|month|months|year|years|hour|hours)\\b.*")
                || containsAny(normalized, List.of("since", "today", "yesterday", "for "))) {
            covered.add(FollowUpTopic.DURATION);
        }

        if (normalized.matches(".*\\b(10|[1-9])\\b.*") || containsAny(normalized, List.of("mild", "moderate", "severe"))) {
            covered.add(FollowUpTopic.SEVERITY);
        }

        if (containsAny(normalized, List.of("shortness of breath", "difficulty breathing", "wheezing", "breathing"))) {
            covered.add(FollowUpTopic.BREATHING);
        }

        if (containsAny(normalized, List.of("fever", "nausea", "vomiting", "dizziness", "cough", "no other symptoms"))) {
            covered.add(FollowUpTopic.ASSOCIATED_SYMPTOMS);
        }

        if (containsAny(normalized, List.of("left", "right", "upper", "lower", "abdomen", "chest", "head", "throat", "ear", "nose"))) {
            covered.add(FollowUpTopic.LOCATION);
        }

        if (containsAny(normalized, List.of("spread", "spreading", "color", "itchy", "worse"))) {
            covered.add(FollowUpTopic.SKIN_SPREAD);
        }

        if (containsAny(normalized, List.of("after", "trigger", "food", "exercise", "stress", "medication"))) {
            covered.add(FollowUpTopic.TRIGGER);
        }

        return covered;
    }

    private FollowUpTopic chooseNextTopic(String field, Set<FollowUpTopic> coveredTopics) {
        List<FollowUpTopic> plan = QUESTION_PLANS.getOrDefault(field, QUESTION_PLANS.get("General Medicine"));
        for (FollowUpTopic topic : plan) {
            if (!coveredTopics.contains(topic)) {
                return topic;
            }
        }
        return null;
    }

    private String questionForTopic(FollowUpTopic topic) {
        return switch (topic) {
            case DURATION -> "How long have you had these symptoms? Please answer in days, weeks, or months.";
            case SEVERITY -> "How severe is it on a scale from 1 to 10, or mild, moderate, or severe?";
            case BREATHING -> "Are you having shortness of breath, wheezing, or difficulty breathing?";
            case ASSOCIATED_SYMPTOMS -> "Do you have any other symptoms along with this, such as fever, nausea, cough, or dizziness?";
            case LOCATION -> "Where exactly is the problem located, and does it stay in one place or move around?";
            case SKIN_SPREAD -> "Has the skin issue spread, changed color, or become more itchy?";
            case TRIGGER -> "Did anything trigger it, such as food, exertion, stress, or a new medication?";
        };
    }

    private int confidenceFor(String field, String text, int coveredCount, boolean finalized) {
        int base = switch (field) {
            case "Cardiology", "Dermatology", "Gastroenterology", "Neurology", "Pulmonology", "ENT" -> 76;
            default -> 66;
        };

        int keywordBonus = switch (field) {
            case "Cardiology" -> keywordScore(text, CARDIO_KEYWORDS);
            case "Dermatology" -> keywordScore(text, DERM_KEYWORDS);
            case "Gastroenterology" -> keywordScore(text, GI_KEYWORDS);
            case "Neurology" -> keywordScore(text, NEURO_KEYWORDS);
            case "Pulmonology" -> keywordScore(text, PULMO_KEYWORDS);
            case "ENT" -> keywordScore(text, ENT_KEYWORDS);
            default -> 3;
        };

        int topicBonus = Math.min(coveredCount * 4, 14);
        int finalBonus = finalized ? 5 : 0;
        int confidence = base + keywordBonus + topicBonus + finalBonus;
        return Math.max(55, Math.min(96, confidence));
    }

    private int keywordScore(String text, List<String> keywords) {
        String normalized = text == null ? "" : text.toLowerCase(Locale.ROOT);
        int score = 0;
        for (String keyword : keywords) {
            if (normalized.contains(keyword)) {
                score += 2;
            }
        }
        return score;
    }

    private String buildFinalSummary(String field) {
        return "Based on your symptoms and responses, the most relevant specialty is " + field
                + ". This is not a diagnosis, but a guidance step to help you consult the right doctor.";
    }

    private String experienceGuidance(String field) {
        return switch (field) {
            case "Cardiology", "Neurology" -> "8+ years";
            case "Dermatology", "Gastroenterology", "Pulmonology" -> "6+ years";
            case "ENT" -> "5+ years";
            default -> "4+ years";
        };
    }

    private List<AiDoctorSuggestionDoctor> matchDoctors(
            String field,
            List<String> relatedFields,
            List<DoctorResponse> activeDoctors) {

        return activeDoctors.stream()
                .map(doctor -> new RankedDoctor(doctor, scoreDoctor(doctor, field, relatedFields)))
                .filter(rankedDoctor -> rankedDoctor.score > 0)
                .sorted(Comparator.comparingInt((RankedDoctor rankedDoctor) -> rankedDoctor.score).reversed()
                        .thenComparing(rankedDoctor -> doctorExperienceValue(rankedDoctor.doctor), Comparator.reverseOrder())
                        .thenComparing(rankedDoctor -> normalizeText(rankedDoctor.doctor.getSpecialization()).toLowerCase(Locale.ROOT)))
                .limit(MAX_DOCTORS)
                .map(rankedDoctor -> toSuggestionDoctor(rankedDoctor.doctor))
                .collect(Collectors.toList());
    }

    private int scoreDoctor(DoctorResponse doctor, String field, List<String> relatedFields) {
        String specialization = normalizeText(doctor.getSpecialization()).toLowerCase(Locale.ROOT);
        int score = 0;

        if (matchesField(specialization, field)) {
            score += 1000;
        }

        if (relatedFields != null) {
            for (String related : relatedFields) {
                if (matchesField(specialization, related)) {
                    score += 350;
                    break;
                }
            }
        }

        int years = doctorExperienceValue(doctor);
        score += Math.min(years * 12, 240);

        Float fee = doctor.getConsultationFee();
        if (fee != null) {
            score += Math.max(0, 120 - Math.round(fee / 20f));
        }

        return score;
    }

    private boolean matchesField(String specialization, String field) {
        if (specialization == null || specialization.isBlank() || field == null || field.isBlank()) {
            return false;
        }

        String normalizedField = field.toLowerCase(Locale.ROOT);
        if (specialization.contains(normalizedField) || normalizedField.contains(specialization)) {
            return true;
        }

        Set<String> aliases = FIELD_ALIASES.getOrDefault(normalizeField(field), Set.of());
        for (String alias : aliases) {
            if (specialization.contains(alias) || alias.contains(specialization)) {
                return true;
            }
        }

        return false;
    }

    private int doctorExperienceValue(DoctorResponse doctor) {
        return doctor.getYearOfExperience() == null ? 0 : doctor.getYearOfExperience();
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

    private boolean containsAny(String text, List<String> words) {
        for (String word : words) {
            if (text.contains(word)) {
                return true;
            }
        }
        return false;
    }

    private String textOrDefault(JsonNode node, String fallback) {
        if (node == null) {
            return fallback;
        }
        String value = node.asText("").trim();
        return value.isBlank() ? fallback : value;
    }

    private String nullableText(JsonNode node) {
        String value = textOrDefault(node, "");
        return value.isBlank() ? null : value;
    }

    private int clampConfidence(JsonNode node, int fallback) {
        int value = node == null ? fallback : node.asInt(fallback);
        if (value < 1) {
            return 1;
        }
        if (value > 100) {
            return 100;
        }
        return value;
    }

    private static class ConversationTurn {
        private final String role;
        private final String text;

        private ConversationTurn(String role, String text) {
            this.role = role;
            this.text = text;
        }
    }

    private static class RankedDoctor {
        private final DoctorResponse doctor;
        private final int score;

        private RankedDoctor(DoctorResponse doctor, int score) {
            this.doctor = doctor;
            this.score = score;
        }
    }

    private enum FollowUpTopic {
        DURATION,
        SEVERITY,
        BREATHING,
        ASSOCIATED_SYMPTOMS,
        LOCATION,
        SKIN_SPREAD,
        TRIGGER
    }

    private static class TriageDecision {
        private String field;
        private int confidence;
        private boolean needsMoreInfo;
        private boolean answerAccepted;
        private String nextQuestion;
        private String questionType;
        private String assistantMessage;
    }
}
