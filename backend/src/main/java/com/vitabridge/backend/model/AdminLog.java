package com.vitabridge.backend.model;

import jakarta.persistence.*;
import java.time.Instant;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.vitabridge.backend.util.TimezoneUtil;

@Entity
@Table(name = "admin_logs")
public class AdminLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "log_id")
    private Integer logId;

    @ManyToOne
    @JoinColumn(name = "admin_id", nullable = false)
    private Admin admin;

    @Column(name = "action", length = 100, nullable = false)
    private String action;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "target_type", length = 50)
    private String targetType;

    @Column(name = "target_id")
    private Integer targetId;

    @Column(name = "timestamp", nullable = false)
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant timestamp;

    public AdminLog() {
        this.timestamp = TimezoneUtil.now();
    }

    public AdminLog(Admin admin, String action, String description, String targetType, Integer targetId) {
        this.admin = admin;
        this.action = action;
        this.description = description;
        this.targetType = targetType;
        this.targetId = targetId;
        this.timestamp = TimezoneUtil.now();
    }

    public Integer getLogId() {
        return logId;
    }

    public void setLogId(Integer logId) {
        this.logId = logId;
    }

    public Admin getAdmin() {
        return admin;
    }

    public void setAdmin(Admin admin) {
        this.admin = admin;
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
