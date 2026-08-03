package com.vitabridge.backend.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

public class PrescriptionRequest {

    private String diagnosis;
    private String chiefComplaints;
    private String pastHistory;
    private String drugHistory;
    private String onExamination;
    private Integer followUpNumber;
    private String followUpInstruction;
    private String emergencyInstruction;
    private List<MedicationRequest> medications = new ArrayList<>();
    private String labTests;
    private String advice;
    private LocalDate followUpDate;
    private LocalTime followUpTime;

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

    public List<MedicationRequest> getMedications() {
        return medications;
    }

    public void setMedications(List<MedicationRequest> medications) {
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

    public static class MedicationRequest {
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
