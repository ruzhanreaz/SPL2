package com.vitabridge.backend.dto;

/**
 * DTO for OTP operation responses
 */
public class OtpResponse {
    
    private String message;
    private Boolean success;
    private String email;

    public OtpResponse() {
    }

    public OtpResponse(String message, Boolean success) {
        this.message = message;
        this.success = success;
    }

    public OtpResponse(String message, Boolean success, String email) {
        this.message = message;
        this.success = success;
        this.email = email;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Boolean getSuccess() {
        return success;
    }

    public void setSuccess(Boolean success) {
        this.success = success;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }
}
