package com.vitabridge.backend.dto;

import java.time.Instant;

public class AdminLogResponse {
    private Integer logId;
    private Integer adminId;
    private String adminName;
    private String adminEmail;
    private String action;
    private String description;
    private String targetType;
    private Integer targetId;
    private Instant timestamp;

    public AdminLogResponse() {
    }

    public AdminLogResponse(Integer logId, Integer adminId, String adminName, String adminEmail, String action,
            String description, String targetType, Integer targetId, Instant timestamp) {
        this.logId = logId;
        this.adminId = adminId;
        this.adminName = adminName;
        this.adminEmail = adminEmail;
        this.action = action;
        this.description = description;
        this.targetType = targetType;
        this.targetId = targetId;
        this.timestamp = timestamp;
    }

    public Integer getLogId() {
        return logId;
    }

    public void setLogId(Integer logId) {
        this.logId = logId;
    }

    public Integer getAdminId() {
        return adminId;
    }

    public void setAdminId(Integer adminId) {
        this.adminId = adminId;
    }

    public String getAdminName() {
        return adminName;
    }

    public void setAdminName(String adminName) {
        this.adminName = adminName;
    }

    public String getAdminEmail() {
        return adminEmail;
    }

    public void setAdminEmail(String adminEmail) {
        this.adminEmail = adminEmail;
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

    public String getTargetType() {
        return targetType;
    }

    public void setTargetType(String targetType) {
        this.targetType = targetType;
    }

    public Integer getTargetId() {
        return targetId;
    }

    public void setTargetId(Integer targetId) {
        this.targetId = targetId;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }
}
