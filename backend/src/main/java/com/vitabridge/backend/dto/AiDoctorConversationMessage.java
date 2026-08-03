package com.vitabridge.backend.dto;

public class AiDoctorConversationMessage {
    private String role;
    private String text;

    public AiDoctorConversationMessage() {
    }

    public AiDoctorConversationMessage(String role, String text) {
        this.role = role;
        this.text = text;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }
}