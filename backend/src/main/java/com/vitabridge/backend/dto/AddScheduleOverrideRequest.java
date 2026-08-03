package com.vitabridge.backend.dto;

import java.time.LocalDate;

public class AddScheduleOverrideRequest {
    private LocalDate overrideDate;
    private Boolean isAvailable;

    public AddScheduleOverrideRequest() {
    }

    public AddScheduleOverrideRequest(LocalDate overrideDate, Boolean isAvailable) {
        this.overrideDate = overrideDate;
        this.isAvailable = isAvailable;
    }

    // Getters and Setters
    public LocalDate getOverrideDate() {
        return overrideDate;
    }

    public void setOverrideDate(LocalDate overrideDate) {
        this.overrideDate = overrideDate;
    }

    public Boolean getIsAvailable() {
        return isAvailable;
    }

    public void setIsAvailable(Boolean isAvailable) {
        this.isAvailable = isAvailable;
    }
}
