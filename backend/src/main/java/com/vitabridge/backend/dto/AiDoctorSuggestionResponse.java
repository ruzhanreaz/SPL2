package com.vitabridge.backend.dto;

import java.util.ArrayList;
import java.util.List;

public class AiDoctorSuggestionResponse {
    private String field;
    private Integer confidence;
    private String experience;
    private List<String> related = new ArrayList<>();
    private List<AiDoctorSuggestionDoctor> doctors = new ArrayList<>();
    private String source;
    private Boolean needsMoreInfo;
    private Boolean answerAccepted;
    private String nextQuestion;
    private String questionType;
    private String assistantMessage;

    public String getField() {
        return field;
    }

    public void setField(String field) {
        this.field = field;
    }

    public Integer getConfidence() {
        return confidence;
    }

    public void setConfidence(Integer confidence) {
        this.confidence = confidence;
    }

    public String getExperience() {
        return experience;
    }

    public void setExperience(String experience) {
        this.experience = experience;
    }

    public List<String> getRelated() {
        return related;
    }

    public void setRelated(List<String> related) {
        this.related = related;
    }

    public List<AiDoctorSuggestionDoctor> getDoctors() {
        return doctors;
    }

    public void setDoctors(List<AiDoctorSuggestionDoctor> doctors) {
        this.doctors = doctors;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public Boolean getNeedsMoreInfo() {
        return needsMoreInfo;
    }

    public void setNeedsMoreInfo(Boolean needsMoreInfo) {
        this.needsMoreInfo = needsMoreInfo;
    }

    public Boolean getAnswerAccepted() {
        return answerAccepted;
    }

    public void setAnswerAccepted(Boolean answerAccepted) {
        this.answerAccepted = answerAccepted;
    }

    public String getNextQuestion() {
        return nextQuestion;
    }

    public void setNextQuestion(String nextQuestion) {
        this.nextQuestion = nextQuestion;
    }

    public String getQuestionType() {
        return questionType;
    }

    public void setQuestionType(String questionType) {
        this.questionType = questionType;
    }

    public String getAssistantMessage() {
        return assistantMessage;
    }

    public void setAssistantMessage(String assistantMessage) {
        this.assistantMessage = assistantMessage;
    }
}
