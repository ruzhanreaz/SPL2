package com.vitabridge.backend.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.Instant;
import com.vitabridge.backend.util.TimezoneUtil;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "medical_access_grants", indexes = {
        @Index(name = "idx_mag_patient", columnList = "patient_id"),
        @Index(name = "idx_mag_doctor", columnList = "doctor_id"),
        @Index(name = "idx_mag_appointment", columnList = "appointment_id")
})
public class MedicalAccessGrant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "grant_id")
    private Integer grantId;

    @ManyToOne
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @ManyToOne
    @JoinColumn(name = "appointment_id", nullable = false)
    private Appointment appointment;

    @Column(name = "granted_at", nullable = false)
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant grantedAt;

    @Column(name = "expires_at")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant expiresAt;

    @Column(name = "revoked_at")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant revokedAt;

    @Column(name = "revoke_reason", length = 64)
    private String revokeReason;

    @ElementCollection
    @CollectionTable(name = "medical_access_grant_documents", joinColumns = @JoinColumn(name = "grant_id"))
    @Column(name = "document_id", nullable = false)
    private List<Integer> sharedDocumentIds = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (grantedAt == null) {
            grantedAt = TimezoneUtil.now();
        }
    }

    public Integer getGrantId() {
        return grantId;
    }

    public void setGrantId(Integer grantId) {
        this.grantId = grantId;
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

    public Appointment getAppointment() {
        return appointment;
    }

    public void setAppointment(Appointment appointment) {
        this.appointment = appointment;
    }

    public Instant getGrantedAt() {
        return grantedAt;
    }

    public void setGrantedAt(Instant grantedAt) {
        this.grantedAt = grantedAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public void setRevokedAt(Instant revokedAt) {
        this.revokedAt = revokedAt;
    }

    public String getRevokeReason() {
        return revokeReason;
    }

    public void setRevokeReason(String revokeReason) {
        this.revokeReason = revokeReason;
    }

    public List<Integer> getSharedDocumentIds() {
        return sharedDocumentIds;
    }

    public void setSharedDocumentIds(List<Integer> sharedDocumentIds) {
        this.sharedDocumentIds = sharedDocumentIds;
    }
}
