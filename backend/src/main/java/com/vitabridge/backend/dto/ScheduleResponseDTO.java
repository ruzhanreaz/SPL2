package com.vitabridge.backend.dto;

import java.util.ArrayList;
import java.util.List;

public class ScheduleResponseDTO {
    private Integer scheduleId;
    private Integer doctorId;
    private List<WeeklyScheduleDTO> weeklySchedules = new ArrayList<>();
    private List<ScheduleOverrideDTO> scheduleOverrides = new ArrayList<>();

    public ScheduleResponseDTO() {
    }

    public ScheduleResponseDTO(Integer scheduleId, Integer doctorId, List<WeeklyScheduleDTO> weeklySchedules,
            List<ScheduleOverrideDTO> scheduleOverrides) {
        this.scheduleId = scheduleId;
        this.doctorId = doctorId;
        this.weeklySchedules = weeklySchedules;
        this.scheduleOverrides = scheduleOverrides;
    }

    // Getters and Setters
    public Integer getScheduleId() {
        return scheduleId;
    }

    public void setScheduleId(Integer scheduleId) {
        this.scheduleId = scheduleId;
    }

    public Integer getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(Integer doctorId) {
        this.doctorId = doctorId;
    }

    public List<WeeklyScheduleDTO> getWeeklySchedules() {
        return weeklySchedules;
    }

    public void setWeeklySchedules(List<WeeklyScheduleDTO> weeklySchedules) {
        this.weeklySchedules = weeklySchedules;
    }

    public List<ScheduleOverrideDTO> getScheduleOverrides() {
        return scheduleOverrides;
    }

    public void setScheduleOverrides(List<ScheduleOverrideDTO> scheduleOverrides) {
        this.scheduleOverrides = scheduleOverrides;
    }
}
