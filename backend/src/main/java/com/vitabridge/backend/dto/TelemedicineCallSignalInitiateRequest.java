package com.vitabridge.backend.dto;

import jakarta.validation.constraints.NotNull;

public class TelemedicineCallSignalInitiateRequest {

    @NotNull
    private Integer appointmentId;

    private String callType;

    public Integer getAppointmentId() {
        return appointmentId;
    }

    public void setAppointmentId(Integer appointmentId) {
        this.appointmentId = appointmentId;
    }

    public String getCallType() {
        return callType;
    }

    public void setCallType(String callType) {
        this.callType = callType;
    }
}
