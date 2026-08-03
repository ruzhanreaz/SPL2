package com.vitabridge.backend.service;

import java.util.*;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Parses user input into the Symptom Checker Agent slot state.
 * Enforces rules: Single question per turn, no repetition, stops when criteria met.
 */
@Component
public class SlotStateParser {

    private static final Logger logger = LoggerFactory.getLogger(SlotStateParser.class);
    private static final int MAX_TURNS = 4;

    public static class SlotState {
        public String symptom;
        public String duration;
        public String location;
        public Integer severity; // 1-10
        public List<String> associatedSymptoms;
        public List<String> triggers;
        public int turnCount;
        public Set<String> askedQuestions; // Track to avoid repetition

        public SlotState() {
            this.associatedSymptoms = new ArrayList<>();
            this.triggers = new ArrayList<>();
            this.askedQuestions = new HashSet<>();
            this.turnCount = 0;
        }

        /**
         * STOP CRITERIA: Stop if {symptom, duration, location, 1+ associated} are filled.
         */
        public boolean meetStopCriteria() {
            return symptom != null && !symptom.isBlank()
                    && duration != null && !duration.isBlank()
                    && location != null && !location.isBlank()
                    && !associatedSymptoms.isEmpty();
        }

        /**
         * Force decision after MAX_TURNS.
         */
        public boolean reachedMaxTurns() {
            return turnCount >= MAX_TURNS;
        }
    }

    /**
     * Parses user input and updates slot state.
     * Returns the next action: question to ask, or decision if STOP CRITERIA met.
     */
    public ParseResult parseInput(String userInput, SlotState state) {
        if (userInput == null || userInput.isBlank()) {
            return new ParseResult("Please describe your symptom.", null, false);
        }

        state.turnCount++;
        String normalized = userInput.toLowerCase().trim();

        // Extract information from user input
        extractSlotInformation(normalized, state);

        // Check STOP CRITERIA before generating next question
        if (state.meetStopCriteria()) {
            logger.info("STOP CRITERIA met. Slot state complete.");
            return new ParseResult(
                    "Thank you for the information. Based on your symptoms, we can now make a recommendation.",
                    state,
                    true // decision_ready = true
            );
        }

        // Check MAX_TURNS limit
        if (state.reachedMaxTurns()) {
            logger.info("MAX_TURNS ({}) reached. Force decision.", MAX_TURNS);
            return new ParseResult(
                    "We've reached the question limit. Making a recommendation based on available info.",
                    state,
                    true // decision_ready = true
            );
        }

        // Generate next question based on priority order and STOP CRITERIA
        String nextQuestion = generateNextQuestion(state);
        return new ParseResult(nextQuestion, state, false);
    }

    /**
     * Extract slot information from user input using keyword matching and NLP heuristics.
     */
    private void extractSlotInformation(String input, SlotState state) {
        // Extract SYMPTOM (primary complaint)
        if (state.symptom == null) {
            state.symptom = extractSymptom(input);
        }

        // Extract DURATION
        if (state.duration == null) {
            state.duration = extractDuration(input);
        }

        // Extract LOCATION (where on body)
        if (state.location == null) {
            state.location = extractLocation(input);
        }

        // Extract SEVERITY (1-10 scale)
        if (state.severity == null) {
            Integer sev = extractSeverity(input);
            if (sev != null) {
                state.severity = sev;
            }
        }

        // Extract ASSOCIATED SYMPTOMS (comorbidities)
        List<String> associated = extractAssociatedSymptoms(input);
        state.associatedSymptoms.addAll(associated);

        // Extract TRIGGERS (what makes it worse/better)
        List<String> trigs = extractTriggers(input);
        state.triggers.addAll(trigs);
    }

    private String extractSymptom(String input) {
        // Simple keyword matching for common symptoms
        if (input.contains("pain") || input.contains("ache")) {
            return "pain";
        }
        if (input.contains("cough")) {
            return "cough";
        }
        if (input.contains("rash") || input.contains("itch")) {
            return "rash";
        }
        if (input.contains("nausea") || input.contains("vomit")) {
            return "nausea";
        }
        if (input.contains("headache") || input.contains("migraine")) {
            return "headache";
        }
        if (input.contains("diarrhea")) {
            return "diarrhea";
        }
        // Extract first significant noun or use generic placeholder
        return "symptom reported";
    }

    private String extractDuration(String input) {
        if (input.matches(".*\\b(\\d+)\\s*(day|week|month|year|hour)s?\\b.*")) {
            return input.replaceAll(".*\\b(\\d+\\s*(?:day|week|month|year|hour)s?)\\b.*", "$1");
        }
        if (input.contains("since yesterday") || input.contains("since last night")) {
            return "1 day";
        }
        if (input.contains("for a while") || input.contains("for some time")) {
            return "several days";
        }
        return null;
    }

    private String extractLocation(String input) {
        // Common body locations
        String[] locations = {"chest", "head", "stomach", "abdomen", "arm", "leg", "back", "throat", "ear", "nose"};
        for (String loc : locations) {
            if (input.contains(loc)) {
                return loc;
            }
        }
        return null;
    }

    private Integer extractSeverity(String input) {
        // Look for numeric severity indicators (1-10)
        if (input.matches(".*\\b([1-9]|10)\\b.*")) {
            String num = input.replaceAll(".*\\b([1-9]|10)\\b.*", "$1");
            try {
                return Integer.parseInt(num);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        if (input.contains("mild")) return 3;
        if (input.contains("moderate")) return 5;
        if (input.contains("severe")) return 8;
        return null;
    }

    private List<String> extractAssociatedSymptoms(String input) {
        List<String> associated = new ArrayList<>();
        String[] symptoms = {"fever", "fatigue", "sweating", "chills", "weakness", "nausea", "vomiting", "diarrhea"};
        for (String sym : symptoms) {
            if (input.contains(sym)) {
                associated.add(sym);
            }
        }
        return associated;
    }

    private List<String> extractTriggers(String input) {
        List<String> triggers = new ArrayList<>();
        // What makes it worse
        if (input.contains("worse") || input.contains("worsen")) {
            if (input.contains("movement")) triggers.add("worse with movement");
            if (input.contains("eating") || input.contains("food")) triggers.add("worse after eating");
            if (input.contains("stress")) triggers.add("worse with stress");
        }
        // What makes it better
        if (input.contains("better") || input.contains("improve")) {
            if (input.contains("rest")) triggers.add("better with rest");
            if (input.contains("medicine")) triggers.add("better with medicine");
        }
        return triggers;
    }

    /**
     * Generate next question based on PRIORITY ORDER and STOP CRITERIA.
     * Priority: Type > Duration > Location > Severity > Triggers > Associated.
     */
    private String generateNextQuestion(SlotState state) {
        // Priority 1: Symptom (type)
        if (state.symptom == null || state.symptom.equals("symptom reported")) {
            if (!state.askedQuestions.contains("symptom")) {
                state.askedQuestions.add("symptom");
                return "Can you describe the symptom you're experiencing?";
            }
        }

        // Priority 2: Duration
        if (state.duration == null) {
            if (!state.askedQuestions.contains("duration")) {
                state.askedQuestions.add("duration");
                return "How long have you had this symptom?";
            }
        }

        // Priority 3: Location
        if (state.location == null) {
            if (!state.askedQuestions.contains("location")) {
                state.askedQuestions.add("location");
                return "Where exactly do you feel this?";
            }
        }

        // Priority 4: Severity
        if (state.severity == null) {
            if (!state.askedQuestions.contains("severity")) {
                state.askedQuestions.add("severity");
                return "On a scale of 1-10, how severe is the pain?";
            }
        }

        // Priority 5: Triggers
        if (state.triggers.isEmpty()) {
            if (!state.askedQuestions.contains("triggers")) {
                state.askedQuestions.add("triggers");
                return "What makes it better or worse?";
            }
        }

        // Priority 6: Associated symptoms
        if (state.associatedSymptoms.isEmpty()) {
            if (!state.askedQuestions.contains("associated")) {
                state.askedQuestions.add("associated");
                return "Do you have any other symptoms like fever, nausea, or fatigue?";
            }
        }

        // Fallback if all slots filled but STOP CRITERIA not met
        return "Is there anything else you'd like to add?";
    }

    /**
     * Result of parsing: next question/message, updated state, and decision readiness.
     */
    public static class ParseResult {
        public String nextQuestion;
        public SlotState updatedState;
        public boolean decisionReady;

        public ParseResult(String nextQuestion, SlotState updatedState, boolean decisionReady) {
            this.nextQuestion = nextQuestion;
            this.updatedState = updatedState;
            this.decisionReady = decisionReady;
        }
    }
}
