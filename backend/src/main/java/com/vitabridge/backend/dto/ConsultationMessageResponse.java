package com.vitabridge.backend.dto;

import java.time.Instant;

public class ConsultationMessageResponse {
    private Integer messageId;
    private Integer appointmentId;
    private Integer senderUserId;
    private String senderRole;
    private String senderName;
    private String text;
    private Instant createdAt;

    public ConsultationMessageResponse() {
    }

    public ConsultationMessageResponse(
            Integer messageId,
            Integer appointmentId,
            Integer senderUserId,
            String senderRole,
            String senderName,
            String text,
            Instant createdAt) {
        this.messageId = messageId;
        this.appointmentId = appointmentId;
        this.senderUserId = senderUserId;
        this.senderRole = senderRole;
        this.senderName = senderName;
        this.text = text;
        this.createdAt = createdAt;
    }

    public Integer getMessageId() {
        return messageId;
    }

    public void setMessageId(Integer messageId) {
        this.messageId = messageId;
    }

    public Integer getAppointmentId() {
        return appointmentId;
    }

    public void setAppointmentId(Integer appointmentId) {
        this.appointmentId = appointmentId;
    }

    public Integer getSenderUserId() {
        return senderUserId;
    }

    public void setSenderUserId(Integer senderUserId) {
        this.senderUserId = senderUserId;
    }

    public String getSenderRole() {
        return senderRole;
    }

    public void setSenderRole(String senderRole) {
        this.senderRole = senderRole;
    }

    public String getSenderName() {
        return senderName;
    }

    public void setSenderName(String senderName) {
        this.senderName = senderName;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
