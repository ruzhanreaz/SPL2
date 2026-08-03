package com.vitabridge.backend.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "schedule_overrides")
public class ScheduleOverride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "override_id")
    private Integer overrideId;

    @ManyToOne
    @JoinColumn(name = "schedule_id", nullable = false)
    private Schedule schedule;

    @Column(name = "override_date", nullable = false)
    private LocalDate overrideDate;

    @Column(name = "is_available", nullable = false)
    private Boolean isAvailable;

    public ScheduleOverride() {
    }

    public ScheduleOverride(Schedule schedule, LocalDate overrideDate, Boolean isAvailable) {
        this.schedule = schedule;
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

    public Schedule getSchedule() {
        return schedule;
    }

    public void setSchedule(Schedule schedule) {
        this.schedule = schedule;
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
