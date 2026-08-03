package com.vitabridge.backend.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "schedules")
public class Schedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "schedule_id")
    private Integer scheduleId;

    @OneToOne
    @JoinColumn(name = "doctor_id", nullable = false, unique = true)
    private Doctor doctor;

    @OneToMany(mappedBy = "schedule", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<WeeklySchedule> weeklySchedules = new ArrayList<>();

    @OneToMany(mappedBy = "schedule", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ScheduleOverride> scheduleOverrides = new ArrayList<>();

    public Schedule() {
    }

    public Schedule(Doctor doctor) {
        this.doctor = doctor;
    }

    // Getters and Setters
    public Integer getScheduleId() {
        return scheduleId;
    }

    public void setScheduleId(Integer scheduleId) {
        this.scheduleId = scheduleId;
    }

    public Doctor getDoctor() {
        return doctor;
    }

    public void setDoctor(Doctor doctor) {
        this.doctor = doctor;
    }

    public List<WeeklySchedule> getWeeklySchedules() {
        return weeklySchedules;
    }

    public void setWeeklySchedules(List<WeeklySchedule> weeklySchedules) {
        this.weeklySchedules = weeklySchedules;
    }

    public List<ScheduleOverride> getScheduleOverrides() {
        return scheduleOverrides;
    }

    public void setScheduleOverrides(List<ScheduleOverride> scheduleOverrides) {
        this.scheduleOverrides = scheduleOverrides;
    }
}
