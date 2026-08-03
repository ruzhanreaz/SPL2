package com.vitabridge.backend.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.Instant;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.vitabridge.backend.util.TimezoneUtil;

@Entity
@Table(name = "queue_states", uniqueConstraints = {
        @UniqueConstraint(columnNames = { "doctor_id", "queue_date" })
})
public class QueueState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "queue_state_id")
    private Integer queueStateId;

    @ManyToOne
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @Column(name = "queue_date", nullable = false)
    private LocalDate queueDate;

    @Column(name = "current_serving_serial")
    private Integer currentServingSerial = 0;

    @Column(name = "doctor_delay_minutes")
    private Integer doctorDelayMinutes = 0;

    @Column(name = "is_active")
    private Boolean isActive = false;

    @Column(name = "last_updated")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant lastUpdated;

    public QueueState() {
    }

    public QueueState(Doctor doctor, LocalDate queueDate) {
        this.doctor = doctor;
        this.queueDate = queueDate;
        this.currentServingSerial = 0;
        this.doctorDelayMinutes = 0;
        this.isActive = false;
        this.lastUpdated = TimezoneUtil.now();
    }

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        this.lastUpdated = TimezoneUtil.now();
    }

    public Integer getQueueStateId() {
        return queueStateId;
    }

    public void setQueueStateId(Integer queueStateId) {
        this.queueStateId = queueStateId;
    }

    public Doctor getDoctor() {
        return doctor;
    }

    public void setDoctor(Doctor doctor) {
        this.doctor = doctor;
    }

    public LocalDate getQueueDate() {
        return queueDate;
    }

    public void setQueueDate(LocalDate queueDate) {
        this.queueDate = queueDate;
    }

    public Integer getCurrentServingSerial() {
        return currentServingSerial;
    }

    public void setCurrentServingSerial(Integer currentServingSerial) {
        this.currentServingSerial = currentServingSerial;
    }

    public Integer getDoctorDelayMinutes() {
        return doctorDelayMinutes;
    }

    public void setDoctorDelayMinutes(Integer doctorDelayMinutes) {
        this.doctorDelayMinutes = doctorDelayMinutes;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public Instant getLastUpdated() {
        return lastUpdated;
    }

    public void setLastUpdated(Instant lastUpdated) {
        this.lastUpdated = lastUpdated;
    }
}
