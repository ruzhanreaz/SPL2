package com.vitabridge.backend.dto;

import jakarta.validation.constraints.NotNull;

public class TelemedicineCallSignalActionRequest {

    @NotNull
    private Long callId;

    private String reason;

    public Long getCallId() {
        return callId;
    }

    public void setCallId(Long callId) {
        this.callId = callId;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
