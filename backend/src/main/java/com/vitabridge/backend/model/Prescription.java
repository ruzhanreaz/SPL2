package com.vitabridge.backend.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDate;
import java.time.Instant;
import com.vitabridge.backend.util.TimezoneUtil;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "prescriptions", indexes = {
        @Index(name = "idx_prescription_appointment", columnList = "appointment_id"),
        @Index(name = "idx_prescription_patient", columnList = "patient_id"),
        @Index(name = "idx_prescription_doctor", columnList = "doctor_id")
})
public class Prescription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "prescription_id")
    private Integer prescriptionId;

    @ManyToOne
    @JoinColumn(name = "appointment_id", nullable = false)
    private Appointment appointment;

    @ManyToOne
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @Column(length = 2000)
    private String diagnosis;

    @Column(name = "chief_complaints", length = 2000)
    private String chiefComplaints;

    @Column(name = "past_history", length = 2000)
    private String pastHistory;

    @Column(name = "drug_history", length = 2000)
    private String drugHistory;

    @Column(name = "on_examination", length = 2000)
    private String onExamination;

    @Column(name = "follow_up_number")
    private Integer followUpNumber;

    @Column(name = "follow_up_instruction", length = 500)
    private String followUpInstruction;

    @Column(name = "emergency_instruction", length = 500)
    private String emergencyInstruction;

    @ElementCollection
    @CollectionTable(name = "prescription_medications", joinColumns = @JoinColumn(name = "prescription_id"))
    private List<PrescriptionMedication> medications = new ArrayList<>();

    @Column(name = "lab_tests", length = 2000)
    private String labTests;

    @Column(length = 2000)
    private String advice;

    @Column(name = "follow_up_date")
    private LocalDate followUpDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = TimezoneUtil.now();
        }
    }

    public Integer getPrescriptionId() {
        return prescriptionId;
    }

    public void setPrescriptionId(Integer prescriptionId) {
        this.prescriptionId = prescriptionId;
    }

    public Appointment getAppointment() {
        return appointment;
    }

    public void setAppointment(Appointment appointment) {
        this.appointment = appointment;
    }

    public Patient getPatient() {
        return patient;
    }

    public void setPatient(Patient patient) {
        this.patient = patient;
    }

    public Doctor getDoctor() {
        return doctor;
    }

    public void setDoctor(Doctor doctor) {
        this.doctor = doctor;
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

    public List<PrescriptionMedication> getMedications() {
        return medications;
    }

    public void setMedications(List<PrescriptionMedication> medications) {
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

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
