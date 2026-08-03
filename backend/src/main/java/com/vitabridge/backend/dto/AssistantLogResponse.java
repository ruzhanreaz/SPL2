package com.vitabridge.backend.dto;

import java.time.Instant;

public class AssistantLogResponse {
    private Integer logId;
    private Integer assistantId;
    private String assistantName;
    private String assistantEmail;
    private Integer doctorId;
    private String doctorName;
    private String action;
    private String description;
    private String entityType;
    private Integer entityId;
    private Instant createdAt;

    public AssistantLogResponse() {
    }

    public AssistantLogResponse(Integer logId, Integer assistantId, String assistantName, String assistantEmail,
            Integer doctorId, String doctorName, String action, String description,
            String entityType, Integer entityId, Instant createdAt) {
        this.logId = logId;
        this.assistantId = assistantId;
        this.assistantName = assistantName;
        this.assistantEmail = assistantEmail;
        this.doctorId = doctorId;
        this.doctorName = doctorName;
        this.action = action;
        this.description = description;
        this.entityType = entityType;
        this.entityId = entityId;
        this.createdAt = createdAt;
    }

    // Getters and Setters
    public Integer getLogId() {
        return logId;
    }

    public void setLogId(Integer logId) {
        this.logId = logId;
    }

    public Integer getAssistantId() {
        return assistantId;
    }

    public void setAssistantId(Integer assistantId) {
        this.assistantId = assistantId;
    }

    public String getAssistantName() {
        return assistantName;
    }

    public void setAssistantName(String assistantName) {
        this.assistantName = assistantName;
    }

    public String getAssistantEmail() {
        return assistantEmail;
    }

    public void setAssistantEmail(String assistantEmail) {
        this.assistantEmail = assistantEmail;
    }

    public Integer getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(Integer doctorId) {
        this.doctorId = doctorId;
    }

    public String getDoctorName() {
        return doctorName;
    }

    public void setDoctorName(String doctorName) {
        this.doctorName = doctorName;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getEntityType() {
        return entityType;
    }

    public void setEntityType(String entityType) {
        this.entityType = entityType;
    }

    public Integer getEntityId() {
        return entityId;
    }

    public void setEntityId(Integer entityId) {
        this.entityId = entityId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
