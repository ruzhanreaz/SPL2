package com.vitabridge.backend.model;

import jakarta.persistence.*;

import java.time.Instant;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.vitabridge.backend.util.TimezoneUtil;

@Entity
@Table(name = "consultation_messages", indexes = {
        @Index(name = "idx_consultation_messages_appointment_created", columnList = "appointment_id,created_at"),
        @Index(name = "idx_consultation_messages_sender", columnList = "sender_user_id")
})
public class ConsultationMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "message_id")
    private Integer messageId;

    @ManyToOne
    @JoinColumn(name = "appointment_id", nullable = false)
    private Appointment appointment;

    @ManyToOne
    @JoinColumn(name = "sender_user_id", nullable = false)
    private User sender;

    @Column(name = "sender_role", length = 20, nullable = false)
    private String senderRole;

    @Column(name = "message_text", length = 2000, nullable = false)
    private String messageText;

    @Column(name = "created_at", nullable = false, updatable = false)
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = TimezoneUtil.now();
    }

    public Integer getMessageId() {
        return messageId;
    }

    public void setMessageId(Integer messageId) {
        this.messageId = messageId;
    }

    public Appointment getAppointment() {
        return appointment;
    }

    public void setAppointment(Appointment appointment) {
        this.appointment = appointment;
    }

    public User getSender() {
        return sender;
    }

    public void setSender(User sender) {
        this.sender = sender;
    }

    public String getSenderRole() {
        return senderRole;
    }

    public void setSenderRole(String senderRole) {
        this.senderRole = senderRole;
    }

    public String getMessageText() {
        return messageText;
    }

    public void setMessageText(String messageText) {
        this.messageText = messageText;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
