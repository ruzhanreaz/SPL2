package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.ErrorResponse;
import com.vitabridge.backend.dto.ProfileResponse;
import com.vitabridge.backend.dto.ChangePasswordRequest;
import com.vitabridge.backend.dto.UpdateProfileRequest;
import com.vitabridge.backend.dto.ChangePasswordWithOtpRequest;
import com.vitabridge.backend.dto.OtpResponse;
import com.vitabridge.backend.service.ProfileService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    @Autowired
    private ProfileService profileService;

    @GetMapping
    public ResponseEntity<?> getProfile(Authentication authentication) {
        try {
            ProfileResponse profile = profileService.getUserProfileByEmail(authentication.getName());
            return ResponseEntity.ok(profile);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve profile: " + e.getMessage()));
        }
    }

    @PutMapping
    public ResponseEntity<?> updateProfile(
            Authentication authentication,
            @RequestBody UpdateProfileRequest request) {
        try {
            ProfileResponse updatedProfile = profileService.updateUserProfileByEmail(authentication.getName(), request);
            return ResponseEntity.ok(updatedProfile);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("UPDATE_FAILED", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to update profile: " + e.getMessage()));
        }
    }

    @PutMapping("/change-password")
    public ResponseEntity<?> changePassword(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordRequest request) {
        try {
            profileService.changePasswordByEmail(authentication.getName(), request);
            return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("CHANGE_PASSWORD_FAILED", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to change password: " + e.getMessage()));
        }
    }

    /**
     * Initiates password change by sending OTP to user's email.
     */
    @PostMapping("/initiate-password-change")
    public ResponseEntity<?> initiatePasswordChange(Authentication authentication) {
        try {
            OtpResponse response = profileService.initiatePasswordChange(authentication.getName());
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("INITIATE_FAILED", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to initiate password change: " + e.getMessage()));
        }
    }

    /**
     * Changes password with OTP verification.
     */
    @PutMapping("/change-password-with-otp")
    public ResponseEntity<?> changePasswordWithOtp(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordWithOtpRequest request) {
        try {
            profileService.changePasswordWithOtp(authentication.getName(), request);
            return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("CHANGE_PASSWORD_FAILED", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to change password: " + e.getMessage()));
        }
    }
}
