package com.vitabridge.backend.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public class QueueStateDTO {
    private Integer queueStateId;
    private Integer doctorId;
    private String doctorName;
    private LocalDate queueDate;
    private Integer currentServingSerial;
    private Integer doctorDelayMinutes;
    private Boolean isActive;
    private Instant lastUpdated;

    // Computed fields
    private Integer totalPatients;
    private List<QueueEntry> queue;

    public static class QueueEntry {
        private Integer serialNumber;
        private Integer appointmentId;
        private String patientName;
        private LocalTime scheduledTime;
        private LocalTime estimatedTime;
        private String status;
        private String appointmentType;
        private Boolean isPreferredSlot;

        public QueueEntry() {
        }

        public Integer getSerialNumber() {
            return serialNumber;
        }

        public void setSerialNumber(Integer serialNumber) {
            this.serialNumber = serialNumber;
        }

        public Integer getAppointmentId() {
            return appointmentId;
        }

        public void setAppointmentId(Integer appointmentId) {
            this.appointmentId = appointmentId;
        }

        public String getPatientName() {
            return patientName;
        }

        public void setPatientName(String patientName) {
            this.patientName = patientName;
        }

        public LocalTime getScheduledTime() {
            return scheduledTime;
        }

        public void setScheduledTime(LocalTime scheduledTime) {
            this.scheduledTime = scheduledTime;
        }

        public LocalTime getEstimatedTime() {
            return estimatedTime;
        }

        public void setEstimatedTime(LocalTime estimatedTime) {
            this.estimatedTime = estimatedTime;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public String getAppointmentType() {
            return appointmentType;
        }

        public void setAppointmentType(String appointmentType) {
            this.appointmentType = appointmentType;
        }

        public Boolean getIsPreferredSlot() {
            return isPreferredSlot;
        }

        public void setIsPreferredSlot(Boolean isPreferredSlot) {
            this.isPreferredSlot = isPreferredSlot;
        }
    }

    public QueueStateDTO() {
    }

    public Integer getQueueStateId() {
        return queueStateId;
    }

    public void setQueueStateId(Integer queueStateId) {
        this.queueStateId = queueStateId;
    }

    public Integer getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(Integer doctorId) {
        this.doctorId = doctorId;
    }

    public String getDoctorName() {
        return doctorName;
    }

    public void setDoctorName(String doctorName) {
        this.doctorName = doctorName;
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

    public Integer getTotalPatients() {
        return totalPatients;
    }

    public void setTotalPatients(Integer totalPatients) {
        this.totalPatients = totalPatients;
    }

    public List<QueueEntry> getQueue() {
        return queue;
    }

    public void setQueue(List<QueueEntry> queue) {
        this.queue = queue;
    }
}
