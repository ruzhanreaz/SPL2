package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.AuthResponse;
import com.vitabridge.backend.dto.ErrorResponse;
import com.vitabridge.backend.dto.LoginRequest;
import com.vitabridge.backend.dto.RegisterRequest;
import com.vitabridge.backend.dto.OtpVerificationRequest;
import com.vitabridge.backend.dto.OtpResendRequest;
import com.vitabridge.backend.dto.PasswordResetRequest;
import com.vitabridge.backend.dto.OtpResponse;
import com.vitabridge.backend.exception.AccountInactiveException;
import com.vitabridge.backend.exception.AccountLockedException;
import com.vitabridge.backend.exception.InvalidCredentialsException;
import com.vitabridge.backend.exception.UserAlreadyExistsException;
import com.vitabridge.backend.service.AuthService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.*;

/**
 * REST Controller for authentication endpoints.
 * Handles user login and registration with JWT token generation.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    private AuthService authService;

    /**
     * Authenticates user with email/phone and password.
     * Returns JWT Bearer token on success.
     *
     * @param loginRequest Login credentials
     * @return AuthResponse with JWT token and user details
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest loginRequest) {
        try {
            logger.info("Processing login request");

            AuthResponse response = authService.login(loginRequest);

            logger.info("Login successful for user: {} with role: {}",
                    response.getEmail(), response.getRole());

            return ResponseEntity.ok(response);

        } catch (InvalidCredentialsException e) {
            logger.warn("Invalid credentials in login attempt");
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("INVALID_CREDENTIALS", e.getMessage()));

        } catch (AccountLockedException e) {
            logger.warn("Login attempt on locked account: {}", e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.LOCKED)
                    .body(new ErrorResponse("ACCOUNT_LOCKED", e.getMessage()));

        } catch (AccountInactiveException e) {
            logger.warn("Login attempt on inactive account: {}", e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.FORBIDDEN)
                    .body(new ErrorResponse("ACCOUNT_INACTIVE", e.getMessage()));

        } catch (org.springframework.security.core.userdetails.UsernameNotFoundException e) {
            logger.warn("User not found during login");
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("INVALID_CREDENTIALS",
                            "Invalid email/phone number or password"));

        } catch (AuthenticationException e) {
            logger.warn("Authentication failed: {}", e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("AUTHENTICATION_FAILED",
                            "Invalid credentials"));

        } catch (Exception e) {
            logger.error("Unexpected error during login: {}", e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR",
                            "An error occurred during login. Please try again later."));
        }
    }

    /**
     * Registers a new patient user account.
     * Returns JWT Bearer token on success.
     *
     * @param registerRequest Registration details
     * @return AuthResponse with JWT token and user details
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest registerRequest) {
        try {
            logger.info("Processing registration request for email: {}",
                    registerRequest.getEmail());

            AuthResponse response = authService.register(registerRequest);

            logger.info("Registration successful for user: {} with role: {}",
                    response.getEmail(), response.getRole());

            return ResponseEntity
                    .status(HttpStatus.CREATED)
                    .body(response);

        } catch (UserAlreadyExistsException e) {
            logger.warn("Registration failed: {}", e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.CONFLICT)
                    .body(new ErrorResponse("USER_EXISTS", e.getMessage()));

        } catch (RuntimeException e) {
            logger.error("Registration failed: {}", e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("REGISTRATION_FAILED", e.getMessage()));

        } catch (Exception e) {
            logger.error("Unexpected error during registration: {}", e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR",
                            "An error occurred during registration. Please try again later."));
        }
    }

    /**
     * Initiates registration with OTP verification.
     * Sends OTP to the provided email address.
     *
     * @param registerRequest Registration details
     * @return OtpResponse indicating OTP was sent
     */
    @PostMapping("/register-otp")
    public ResponseEntity<?> registerWithOtp(@Valid @RequestBody RegisterRequest registerRequest) {
        try {
            logger.info("Processing OTP registration request for email: {}",
                    registerRequest.getEmail());

            OtpResponse response = authService.registerWithOtp(registerRequest);

            logger.info("OTP sent successfully for registration: {}", registerRequest.getEmail());

            return ResponseEntity.ok(response);

        } catch (UserAlreadyExistsException e) {
            logger.warn("OTP registration failed: {}", e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.CONFLICT)
                    .body(new ErrorResponse("USER_EXISTS", e.getMessage()));

        } catch (RuntimeException e) {
            logger.error("OTP registration failed: {}", e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("REGISTRATION_FAILED", e.getMessage()));

        } catch (Exception e) {
            logger.error("Unexpected error during OTP registration: {}", e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR",
                            "An error occurred during registration. Please try again later."));
        }
    }

    /**
     * Verifies registration OTP and completes account creation.
     *
     * @param registerRequest   Registration details
     * @param otpVerification   OTP verification request
     * @return AuthResponse with JWT token on success
     */
    @PostMapping("/verify-registration-otp")
    public ResponseEntity<?> verifyRegistrationOtp(
            @Valid @RequestBody RegisterRequest registerRequest,
            @RequestHeader(value = "X-OTP", required = true) String otp) {
        try {
            logger.info("Processing registration OTP verification for email: {}",
                    registerRequest.getEmail());

            OtpVerificationRequest otpVerification = new OtpVerificationRequest(
                    registerRequest.getEmail(), otp);
            AuthResponse response = authService.verifyRegistrationOtp(registerRequest, otpVerification);

            logger.info("Registration OTP verified successfully for user: {} with role: {}",
                    response.getEmail(), response.getRole());

            return ResponseEntity
                    .status(HttpStatus.CREATED)
                    .body(response);

        } catch (InvalidCredentialsException e) {
            logger.warn("Registration OTP verification failed: {}", e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("INVALID_OTP", e.getMessage()));

        } catch (UserAlreadyExistsException e) {
            logger.warn("Registration OTP verification failed: {}", e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.CONFLICT)
                    .body(new ErrorResponse("USER_EXISTS", e.getMessage()));

        } catch (RuntimeException e) {
            logger.error("Registration OTP verification failed: {}", e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("VERIFICATION_FAILED", e.getMessage()));

        } catch (Exception e) {
            logger.error("Unexpected error during registration OTP verification: {}", e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR",
                            "An error occurred during verification. Please try again later."));
        }
    }

    /**
     * Resends OTP for registration.
     *
     * @param resendRequest OTP resend request
     * @return OtpResponse indicating OTP was resent
     */
    @PostMapping("/resend-registration-otp")
    public ResponseEntity<?> resendRegistrationOtp(@Valid @RequestBody OtpResendRequest resendRequest) {
        try {
            logger.info("Processing OTP resend request for email: {}", resendRequest.getEmail());

            OtpResponse response = authService.resendRegistrationOtp(resendRequest);

            logger.info("OTP resent successfully for email: {}", resendRequest.getEmail());

            return ResponseEntity.ok(response);

        } catch (RuntimeException e) {
            logger.error("OTP resend failed: {}", e.getMessage());
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("RESEND_FAILED", e.getMessage()));

        } catch (Exception e) {
            logger.error("Unexpected error during OTP resend: {}", e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR",
                            "An error occurred during resend. Please try again later."));
        }
    }

        /**
         * Initiates password reset with OTP verification.
         */
        @PostMapping("/forgot-password-otp")
        public ResponseEntity<?> initiatePasswordReset(@Valid @RequestBody PasswordResetRequest request) {
                try {
                        logger.info("Processing password reset OTP request for email: {}", request.getEmail());

                        OtpResponse response = authService.initiatePasswordReset(request);

                        logger.info("Password reset OTP sent successfully for email: {}", request.getEmail());

                        return ResponseEntity.ok(response);

                } catch (RuntimeException e) {
                        logger.error("Password reset OTP request failed: {}", e.getMessage());
                        return ResponseEntity
                                        .status(HttpStatus.BAD_REQUEST)
                                        .body(new ErrorResponse("RESET_FAILED", e.getMessage()));

                } catch (Exception e) {
                        logger.error("Unexpected error during password reset OTP request: {}", e.getMessage(), e);
                        return ResponseEntity
                                        .status(HttpStatus.INTERNAL_SERVER_ERROR)
                                        .body(new ErrorResponse("ERROR",
                                                        "An error occurred while sending the reset code. Please try again later."));
                }
        }
}
