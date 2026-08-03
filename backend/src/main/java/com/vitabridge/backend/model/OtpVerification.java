package com.vitabridge.backend.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.*;
import java.time.Instant;
import com.vitabridge.backend.util.TimezoneUtil;

@Entity
@Table(name = "otp_verifications", indexes = {
        @Index(name = "idx_otp_email", columnList = "email"),
        @Index(name = "idx_otp_purpose", columnList = "purpose"),
        @Index(name = "idx_otp_expires_at", columnList = "expires_at")
})
public class OtpVerification {

    public enum OtpPurpose {
        REGISTRATION,
        PASSWORD_RESET,
        PASSWORD_CHANGE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "otp_id")
    private Integer otpId;

    @Column(name = "email", length = 100, nullable = false)
    private String email;

    @Column(name = "otp_code", length = 6, nullable = false)
    private String otpCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", length = 50, nullable = false)
    private OtpPurpose purpose;

    @Column(name = "is_verified")
    private Boolean isVerified = false;

    @Column(name = "verification_attempts")
    private Integer verificationAttempts = 0;

    @Column(name = "created_at")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant createdAt;

    @Column(name = "expires_at")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant expiresAt;

    @Column(name = "verified_at")
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant verifiedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = TimezoneUtil.now();
        // OTP expires in 10 minutes
        expiresAt = TimezoneUtil.now().plusSeconds(600);
    }

    public OtpVerification() {
    }

    public OtpVerification(String email, String otpCode, OtpPurpose purpose) {
        this.email = email;
        this.otpCode = otpCode;
        this.purpose = purpose;
        this.isVerified = false;
        this.verificationAttempts = 0;
    }

    // Getters and Setters
    public Integer getOtpId() {
        return otpId;
    }

    public void setOtpId(Integer otpId) {
        this.otpId = otpId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getOtpCode() {
        return otpCode;
    }

    public void setOtpCode(String otpCode) {
        this.otpCode = otpCode;
    }

    public OtpPurpose getPurpose() {
        return purpose;
    }

    public void setPurpose(OtpPurpose purpose) {
        this.purpose = purpose;
    }

    public Boolean getIsVerified() {
        return isVerified;
    }

    public void setIsVerified(Boolean isVerified) {
        this.isVerified = isVerified;
    }

    public Integer getVerificationAttempts() {
        return verificationAttempts;
    }

    public void setVerificationAttempts(Integer verificationAttempts) {
        this.verificationAttempts = verificationAttempts;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Instant getVerifiedAt() {
        return verifiedAt;
    }

    public void setVerifiedAt(Instant verifiedAt) {
        this.verifiedAt = verifiedAt;
    }
}
