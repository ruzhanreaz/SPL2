package com.vitabridge.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import java.util.ArrayList;
import java.util.List;

public class AiDoctorSuggestionRequest {

    @NotBlank(message = "symptoms is required")
    private String symptoms;

    @Valid
    private List<AiDoctorConversationMessage> conversation = new ArrayList<>();

    public String getSymptoms() {
        return symptoms;
    }

    public void setSymptoms(String symptoms) {
        this.symptoms = symptoms;
    }

    public List<AiDoctorConversationMessage> getConversation() {
        return conversation;
    }

    public void setConversation(List<AiDoctorConversationMessage> conversation) {
        this.conversation = conversation;
    }
}
