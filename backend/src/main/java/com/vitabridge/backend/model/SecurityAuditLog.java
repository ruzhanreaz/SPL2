package com.vitabridge.backend.model;

import jakarta.persistence.*;
import java.time.Instant;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.vitabridge.backend.util.TimezoneUtil;

@Entity
@Table(name = "security_audit_log", indexes = {
        @Index(name = "idx_audit_user_id", columnList = "user_id"),
        @Index(name = "idx_audit_event_type", columnList = "event_type"),
        @Index(name = "idx_audit_timestamp", columnList = "timestamp")
})
public class SecurityAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "log_id")
    private Long logId;

    @Column(name = "user_id")
    private Integer userId;

    @Column(name = "event_type", length = 50, nullable = false)
    private String eventType; // LOGIN_SUCCESS, LOGIN_FAILED, REGISTRATION, ACCOUNT_LOCKED, etc.

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "details", length = 1000)
    private String details;

    @Column(name = "timestamp", nullable = false)
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant timestamp;

    @PrePersist
    protected void onCreate() {
        timestamp = TimezoneUtil.now();
    }

    public SecurityAuditLog() {
    }

    public SecurityAuditLog(Integer userId, String eventType, String ipAddress, String userAgent, String details) {
        this.userId = userId;
        this.eventType = eventType;
        this.ipAddress = ipAddress;
        this.userAgent = userAgent;
        this.details = details;
    }

    // Getters and setters
    public Long getLogId() {
        return logId;
    }

    public void setLogId(Long logId) {
        this.logId = logId;
    }

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }
}
