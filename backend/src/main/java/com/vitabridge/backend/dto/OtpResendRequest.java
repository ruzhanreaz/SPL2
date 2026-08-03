package com.vitabridge.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO for requesting OTP resend
 */
public class OtpResendRequest {
    
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid", regexp = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")
    @Size(max = 100, message = "Email must not exceed 100 characters")
    private String email;
    
    @NotBlank(message = "Purpose is required")
    private String purpose; // REGISTRATION, PASSWORD_RESET, PASSWORD_CHANGE

    public OtpResendRequest() {
    }

    public OtpResendRequest(String email, String purpose) {
        this.email = email;
        this.purpose = purpose;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPurpose() {
        return purpose;
    }

    public void setPurpose(String purpose) {
        this.purpose = purpose;
    }
}
