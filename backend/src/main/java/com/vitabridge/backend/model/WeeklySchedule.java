package com.vitabridge.backend.model;

import jakarta.persistence.*;
import java.time.LocalTime;

@Entity
@Table(name = "weekly_schedules")
public class WeeklySchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "weekly_schedule_id")
    private Integer weeklyScheduleId;

    @ManyToOne
    @JoinColumn(name = "schedule_id", nullable = false)
    private Schedule schedule;

    @Column(name = "day_of_week", nullable = false)
    private Integer dayOfWeek; // 1=Monday, 2=Tuesday, ..., 7=Sunday

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "is_available", nullable = false)
    private Boolean isAvailable = true;

    @Column(name = "max_patients")
    private Integer maxPatients;

    @Enumerated(EnumType.STRING)
    @Column(name = "consultation_type", nullable = false, length = 20)
    private ConsultationType consultationType = ConsultationType.BOTH;

    public enum ConsultationType {
        IN_PERSON, ONLINE, BOTH
    }

    public WeeklySchedule() {
    }

    public WeeklySchedule(Schedule schedule, Integer dayOfWeek, LocalTime startTime, LocalTime endTime) {
        this.schedule = schedule;
        this.dayOfWeek = dayOfWeek;
        this.startTime = startTime;
        this.endTime = endTime;
        this.isAvailable = true;
        this.consultationType = ConsultationType.BOTH;
    }

    // Getters and Setters
    public Integer getWeeklyScheduleId() {
        return weeklyScheduleId;
    }

    public void setWeeklyScheduleId(Integer weeklyScheduleId) {
        this.weeklyScheduleId = weeklyScheduleId;
    }

    public Schedule getSchedule() {
        return schedule;
    }

    public void setSchedule(Schedule schedule) {
        this.schedule = schedule;
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

    public ConsultationType getConsultationType() {
        return consultationType;
    }

    public void setConsultationType(ConsultationType consultationType) {
        this.consultationType = consultationType;
    }
}
