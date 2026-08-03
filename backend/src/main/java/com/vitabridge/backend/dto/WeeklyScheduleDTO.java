package com.vitabridge.backend.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.vitabridge.backend.model.WeeklySchedule;
import java.time.LocalTime;

public class WeeklyScheduleDTO {
    private Integer weeklyScheduleId;
    private Integer dayOfWeek; // 1=Monday, 2=Tuesday, ..., 7=Sunday

    @JsonFormat(pattern = "HH:mm")
    private LocalTime startTime;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime endTime;

    private Boolean isAvailable;
    private Integer maxPatients;
    private String consultationType;

    public WeeklyScheduleDTO() {
    }

    public WeeklyScheduleDTO(Integer weeklyScheduleId, Integer dayOfWeek, LocalTime startTime, LocalTime endTime,
            Boolean isAvailable, Integer maxPatients) {
        this.weeklyScheduleId = weeklyScheduleId;
        this.dayOfWeek = dayOfWeek;
        this.startTime = startTime;
        this.endTime = endTime;
        this.isAvailable = isAvailable;
        this.maxPatients = maxPatients;
        this.consultationType = WeeklySchedule.ConsultationType.BOTH.name();
    }

    public WeeklyScheduleDTO(Integer weeklyScheduleId, Integer dayOfWeek, LocalTime startTime, LocalTime endTime,
            Boolean isAvailable, Integer maxPatients, String consultationType) {
        this.weeklyScheduleId = weeklyScheduleId;
        this.dayOfWeek = dayOfWeek;
        this.startTime = startTime;
        this.endTime = endTime;
        this.isAvailable = isAvailable;
        this.maxPatients = maxPatients;
        this.consultationType = consultationType;
    }

    // Getters and Setters
    public Integer getWeeklyScheduleId() {
        return weeklyScheduleId;
    }

    public void setWeeklyScheduleId(Integer weeklyScheduleId) {
        this.weeklyScheduleId = weeklyScheduleId;
    }

    public Integer getDayOfWeek() {
        return dayOfWeek;
    }

    public void setDayOfWeek(Integer dayOfWeek) {
        this.dayOfWeek = dayOfWeek;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalTime endTime) {
        this.endTime = endTime;
    }

    public Boolean getIsAvailable() {
        return isAvailable;
    }

    public void setIsAvailable(Boolean isAvailable) {
        this.isAvailable = isAvailable;
    }

    public Integer getMaxPatients() {
        return maxPatients;
    }

    public void setMaxPatients(Integer maxPatients) {
        this.maxPatients = maxPatients;
    }

    public String getConsultationType() {
        return consultationType;
    }

    public void setConsultationType(String consultationType) {
        this.consultationType = consultationType;
    }
}
