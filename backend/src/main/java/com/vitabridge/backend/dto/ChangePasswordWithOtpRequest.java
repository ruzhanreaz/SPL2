package com.vitabridge.backend.dto;

import com.vitabridge.backend.validation.PasswordMatches;
import com.vitabridge.backend.validation.ValidPassword;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * DTO for changing password with OTP verification
 */
@PasswordMatches
public class ChangePasswordWithOtpRequest {
    
    @NotBlank(message = "OTP is required")
    @Size(min = 6, max = 6, message = "OTP must be exactly 6 digits")
    private String otp;
    
    @NotBlank(message = "New password is required")
    @ValidPassword
    private String newPassword;
    
    @NotBlank(message = "Confirm password is required")
    private String confirmPassword;

    public ChangePasswordWithOtpRequest() {
    }

    public ChangePasswordWithOtpRequest(String otp, String newPassword, String confirmPassword) {
        this.otp = otp;
        this.newPassword = newPassword;
        this.confirmPassword = confirmPassword;
    }

    public String getOtp() {
        return otp;
    }

    public void setOtp(String otp) {
        this.otp = otp;
    }

    public String getNewPassword() {
        return newPassword;
    }

    public void setNewPassword(String newPassword) {
        this.newPassword = newPassword;
    }

    public String getConfirmPassword() {
        return confirmPassword;
    }

    public void setConfirmPassword(String confirmPassword) {
        this.confirmPassword = confirmPassword;
    }
}
