package com.vitabridge.backend.dto;

public class ToggleAvailabilityRequest {
    private Boolean isAvailable;

    public ToggleAvailabilityRequest() {
    }

    public ToggleAvailabilityRequest(Boolean isAvailable) {
        this.isAvailable = isAvailable;
    }

    public Boolean getIsAvailable() {
        return isAvailable;
    }

    public void setIsAvailable(Boolean isAvailable) {
        this.isAvailable = isAvailable;
    }
}
