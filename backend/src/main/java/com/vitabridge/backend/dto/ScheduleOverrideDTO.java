package com.vitabridge.backend.dto;

import java.time.LocalDate;

public class ScheduleOverrideDTO {
    private Integer overrideId;
    private LocalDate overrideDate;
    private Boolean isAvailable;

    public ScheduleOverrideDTO() {
    }

    public ScheduleOverrideDTO(Integer overrideId, LocalDate overrideDate, Boolean isAvailable) {
        this.overrideId = overrideId;
        this.overrideDate = overrideDate;
        this.isAvailable = isAvailable;
    }

    // Getters and Setters
    public Integer getOverrideId() {
        return overrideId;
    }

    public void setOverrideId(Integer overrideId) {
        this.overrideId = overrideId;
    }

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
