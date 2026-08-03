package com.vitabridge.backend.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.vitabridge.backend.util.TimezoneUtil;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "telemedicine_call_sessions", indexes = {
        @Index(name = "idx_call_session_appointment", columnList = "appointment_id"),
        @Index(name = "idx_call_session_room", columnList = "room_id"),
        @Index(name = "idx_call_session_status", columnList = "status"),
        @Index(name = "idx_call_session_expires", columnList = "expires_at")
})
public class TelemedicineCallSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "call_session_id")
    private Long callSessionId;

    @ManyToOne(optional = false)
    @JoinColumn(name = "appointment_id", nullable = false)
    private Appointment appointment;

    @Column(name = "room_id", nullable = false, length = 128)
    private String roomId;

    @ManyToOne(optional = false)
    @JoinColumn(name = "caller_user_id", nullable = false)
    private User caller;

    @ManyToOne(optional = false)
    @JoinColumn(name = "receiver_user_id", nullable = false)
    private User receiver;

    @Column(name = "call_type", nullable = false, length = 16)
    private String callType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private TelemedicineCallStatus status;

    @Column(name = "initiated_at", nullable = false)
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant initiatedAt;

    @Column(name = "ringing_at")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant ringingAt;

    @Column(name = "accepted_at")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant acceptedAt;

    @Column(name = "declined_at")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant declinedAt;

    @Column(name = "ended_at")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant endedAt;

    @Column(name = "last_heartbeat_at")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant lastHeartbeatAt;

    @Column(name = "expires_at")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant expiresAt;

    @Column(name = "ended_reason", length = 120)
    private String endedReason;

    @PrePersist
    protected void onCreate() {
        initiatedAt = TimezoneUtil.now();
        if (lastHeartbeatAt == null) {
            lastHeartbeatAt = initiatedAt;
        }
        if (status == null) {
            status = TelemedicineCallStatus.RINGING;
        }
    }

    public Long getCallSessionId() {
        return callSessionId;
    }

    public void setCallSessionId(Long callSessionId) {
        this.callSessionId = callSessionId;
    }

    public Appointment getAppointment() {
        return appointment;
    }

    public void setAppointment(Appointment appointment) {
        this.appointment = appointment;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public User getCaller() {
        return caller;
    }

    public void setCaller(User caller) {
        this.caller = caller;
    }

    public User getReceiver() {
        return receiver;
    }

    public void setReceiver(User receiver) {
        this.receiver = receiver;
    }

    public String getCallType() {
        return callType;
    }

    public void setCallType(String callType) {
        this.callType = callType;
    }

    public TelemedicineCallStatus getStatus() {
        return status;
    }

    public void setStatus(TelemedicineCallStatus status) {
        this.status = status;
    }

    public Instant getInitiatedAt() {
        return initiatedAt;
    }

    public void setInitiatedAt(Instant initiatedAt) {
        this.initiatedAt = initiatedAt;
    }

    public Instant getRingingAt() {
        return ringingAt;
    }

    public void setRingingAt(Instant ringingAt) {
        this.ringingAt = ringingAt;
    }

    public Instant getAcceptedAt() {
        return acceptedAt;
    }

    public void setAcceptedAt(Instant acceptedAt) {
        this.acceptedAt = acceptedAt;
    }

    public Instant getDeclinedAt() {
        return declinedAt;
    }

    public void setDeclinedAt(Instant declinedAt) {
        this.declinedAt = declinedAt;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public void setEndedAt(Instant endedAt) {
        this.endedAt = endedAt;
    }

    public Instant getLastHeartbeatAt() {
        return lastHeartbeatAt;
    }

    public void setLastHeartbeatAt(Instant lastHeartbeatAt) {
        this.lastHeartbeatAt = lastHeartbeatAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public String getEndedReason() {
        return endedReason;
    }

    public void setEndedReason(String endedReason) {
        this.endedReason = endedReason;
    }
}