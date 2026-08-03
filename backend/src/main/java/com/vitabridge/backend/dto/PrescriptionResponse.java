package com.vitabridge.backend.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

public class PrescriptionResponse {

    private Integer prescriptionId;
    private Integer appointmentId;
    private String patientName;
    private String doctorName;
    private String doctorSpecialty;
    private LocalDate appointmentDate;
    private String diagnosis;
    private String chiefComplaints;
    private String pastHistory;
    private String drugHistory;
    private String onExamination;
    private Integer followUpNumber;
    private String followUpInstruction;
    private String emergencyInstruction;
    private List<MedicationResponse> medications = new ArrayList<>();
    private String labTests;
    private String advice;
    private LocalDate followUpDate;
    private LocalTime followUpTime;
    private Integer followUpBookedAppointmentId;
    private Instant createdAt;

    public Integer getPrescriptionId() {
        return prescriptionId;
    }

    public void setPrescriptionId(Integer prescriptionId) {
        this.prescriptionId = prescriptionId;
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

    public String getDoctorName() {
        return doctorName;
    }

    public void setDoctorName(String doctorName) {
        this.doctorName = doctorName;
    }

    public String getDoctorSpecialty() {
        return doctorSpecialty;
    }

    public void setDoctorSpecialty(String doctorSpecialty) {
        this.doctorSpecialty = doctorSpecialty;
    }

    public LocalDate getAppointmentDate() {
        return appointmentDate;
    }

    public void setAppointmentDate(LocalDate appointmentDate) {
        this.appointmentDate = appointmentDate;
    }

    public String getDiagnosis() {
        return diagnosis;
    }

    public void setDiagnosis(String diagnosis) {
        this.diagnosis = diagnosis;
    }

    public String getChiefComplaints() {
        return chiefComplaints;
    }

    public void setChiefComplaints(String chiefComplaints) {
        this.chiefComplaints = chiefComplaints;
    }

    public String getPastHistory() {
        return pastHistory;
    }

    public void setPastHistory(String pastHistory) {
        this.pastHistory = pastHistory;
    }

    public String getDrugHistory() {
        return drugHistory;
    }

    public void setDrugHistory(String drugHistory) {
        this.drugHistory = drugHistory;
    }

    public String getOnExamination() {
        return onExamination;
    }

    public void setOnExamination(String onExamination) {
        this.onExamination = onExamination;
    }

    public Integer getFollowUpNumber() {
        return followUpNumber;
    }

    public void setFollowUpNumber(Integer followUpNumber) {
        this.followUpNumber = followUpNumber;
    }

    public String getFollowUpInstruction() {
        return followUpInstruction;
    }

    public void setFollowUpInstruction(String followUpInstruction) {
        this.followUpInstruction = followUpInstruction;
    }

    public String getEmergencyInstruction() {
        return emergencyInstruction;
    }

    public void setEmergencyInstruction(String emergencyInstruction) {
        this.emergencyInstruction = emergencyInstruction;
    }

    public List<MedicationResponse> getMedications() {
        return medications;
    }

    public void setMedications(List<MedicationResponse> medications) {
        this.medications = medications;
    }

    public String getLabTests() {
        return labTests;
    }

    public void setLabTests(String labTests) {
        this.labTests = labTests;
    }

    public String getAdvice() {
        return advice;
    }

    public void setAdvice(String advice) {
        this.advice = advice;
    }

    public LocalDate getFollowUpDate() {
        return followUpDate;
    }

    public void setFollowUpDate(LocalDate followUpDate) {
        this.followUpDate = followUpDate;
    }

    public LocalTime getFollowUpTime() {
        return followUpTime;
    }

    public void setFollowUpTime(LocalTime followUpTime) {
        this.followUpTime = followUpTime;
    }

    public Integer getFollowUpBookedAppointmentId() {
        return followUpBookedAppointmentId;
    }

    public void setFollowUpBookedAppointmentId(Integer followUpBookedAppointmentId) {
        this.followUpBookedAppointmentId = followUpBookedAppointmentId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public static class MedicationResponse {
        private String name;
        private String dosage;
        private String quantity;
        private String frequency;
        private String duration;
        private String instructions;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getDosage() {
            return dosage;
        }

        public void setDosage(String dosage) {
            this.dosage = dosage;
        }

        public String getQuantity() {
            return quantity;
        }

        public void setQuantity(String quantity) {
            this.quantity = quantity;
        }

        public String getFrequency() {
            return frequency;
        }

        public void setFrequency(String frequency) {
            this.frequency = frequency;
        }

        public String getDuration() {
            return duration;
        }

        public void setDuration(String duration) {
            this.duration = duration;
        }

        public String getInstructions() {
            return instructions;
        }

        public void setInstructions(String instructions) {
            this.instructions = instructions;
        }
    }
}
