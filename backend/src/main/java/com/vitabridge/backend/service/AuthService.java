package com.vitabridge.backend.service;

import com.vitabridge.backend.config.JwtUtil;
import com.vitabridge.backend.dto.AuthResponse;
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
import com.vitabridge.backend.model.OtpVerification;
import com.vitabridge.backend.model.Patient;
import com.vitabridge.backend.model.Role;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.PatientRepository;
import com.vitabridge.backend.repository.DoctorRepository;
import com.vitabridge.backend.repository.AssistantRepository;
import com.vitabridge.backend.repository.UserRepository;
import com.vitabridge.backend.util.TimezoneUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Authentication Service implementing secure login and registration with JWT.
 * Supports login via email or phone number with account security features.
 */
@Service
public class AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final long LOCK_TIME_DURATION_MINUTES = 30;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private DoctorRepository doctorRepository;

    @Autowired
    private AssistantRepository assistantRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private CustomUserDetailsService userDetailsService;

    @Autowired
    private SecurityAuditService securityAuditService;

    @Autowired
    private OtpService otpService;

    @Autowired
    private NotificationService notificationService;

    /**
     * Authenticates user with email/phone and password, returns JWT token.
     * Implements account locking after failed attempts and role-based access.
     *
     * @param loginRequest Login credentials (identifier and password)
     * @return AuthResponse with JWT token and user details
     * @throws AuthenticationException if authentication fails
     */
    @Transactional
    public AuthResponse login(LoginRequest loginRequest) throws AuthenticationException {
        // Sanitize and validate input
        String identifier = sanitizeInput(loginRequest.getIdentifier());

        if (identifier == null || identifier.isEmpty()) {
            throw new InvalidCredentialsException("Email or phone number is required");
        }

        // Normalize email to lowercase to match stored value (registration lowercases
        // emails)
        if (identifier.contains("@")) {
            identifier = identifier.toLowerCase();
        }

        logger.info("Login attempt for identifier: {}", maskIdentifier(identifier));

        try {
            // Load user entity to check account status
            User user = userDetailsService.loadUserEntityByIdentifier(identifier);

            logger.debug("User found: userId={}, email={}, role={}, isActive={}, isLocked={}",
                    user.getUserId(), maskEmail(user.getEmail()), user.getRole(),
                    user.getIsActive(), user.getIsLocked());

            // Check account lock status
            if (Boolean.TRUE.equals(user.getIsLocked())) {
                if (isAccountLocked(user)) {
                    logger.warn("Login attempt on locked account: {}", maskIdentifier(identifier));
                    throw new AccountLockedException(
                            "Account is temporarily locked due to multiple failed login attempts. " +
                                    "Please try again later.");
                } else {
                    // Unlock account if lock duration has expired
                    unlockAccount(user);
                }
            }

            // Check if account is active
            if (!Boolean.TRUE.equals(user.getIsActive())) {
                logger.warn("Login attempt on inactive account: {}", maskIdentifier(identifier));
                throw new AccountInactiveException("Account is inactive. Please contact support.");
            }

            // Authenticate using Spring Security AuthenticationManager
            try {
                authenticationManager.authenticate(
                        new UsernamePasswordAuthenticationToken(identifier, loginRequest.getPassword()));

                logger.debug("Authentication successful for: {}", maskIdentifier(identifier));

                // Reset failed login attempts on successful authentication
                resetFailedAttempts(user);

                // Log successful login
                securityAuditService.logSecurityEvent(
                        user.getUserId(),
                        "LOGIN_SUCCESS",
                        "User logged in successfully");

                // Generate JWT token with user claims
                String jwtToken = jwtUtil.generateToken(
                        user.getEmail(),
                        user.getRole().getValue(),
                        user.getUserId());

                // Build response with user details and token
                AuthResponse response = buildAuthResponse(user, jwtToken);

                logger.info("Login successful for user: {} with role: {}",
                        maskIdentifier(identifier), user.getRole());

                return response;

            } catch (BadCredentialsException e) {
                // Handle invalid password
                handleFailedLogin(user, identifier);
                throw new InvalidCredentialsException("Invalid email/phone number or password");

            } catch (LockedException e) {
                logger.warn("Account is locked: {}", maskIdentifier(identifier));
                throw new AccountLockedException("Account is locked. Please try again later.");

            } catch (DisabledException e) {
                logger.warn("Account is disabled: {}", maskIdentifier(identifier));
                throw new AccountInactiveException("Account is disabled. Please contact support.");
            }

        } catch (org.springframework.security.core.userdetails.UsernameNotFoundException e) {
            // Don't reveal that user doesn't exist - use generic message
            logger.warn("Login attempt for non-existent user: {}", maskIdentifier(identifier));
            throw new InvalidCredentialsException("Invalid email/phone number or password");
        }
    }

    /**
     * Builds AuthResponse with user details and role-specific IDs.
     *
     * @param user  User entity
     * @param token JWT token
     * @return Complete AuthResponse
     */
    private AuthResponse buildAuthResponse(User user, String token) {
        AuthResponse response = new AuthResponse(
                token,
                user.getUserId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
            user.getProfileImageUrl(),
                user.getRole().getValue(),
                user.getPhoneNumber());

        // Add role-specific entity IDs
        switch (user.getRole()) {
            case DOCTOR:
                doctorRepository.findByUserUserId(user.getUserId())
                        .ifPresent(doctor -> response.setDoctorId(doctor.getDoctorId()));
                break;
            case PATIENT:
                patientRepository.findByUserUserId(user.getUserId())
                        .ifPresent(patient -> response.setPatientId(patient.getPatientId()));
                break;
            case ASSISTANT:
                assistantRepository.findByUserUserId(user.getUserId())
                        .ifPresent(assistant -> response.setAssistantId(assistant.getAssistantId()));
                break;
            case ADMIN:
                // Admin doesn't have additional entity ID
                break;
        }

        return response;
    }

    /**
     * Handles failed login attempt by incrementing counter and locking account if
     * needed.
     *
     * @param user       User entity
     * @param identifier User identifier for logging
     */
    private void handleFailedLogin(User user, String identifier) {
        incrementFailedAttempts(user);

        int attempts = user.getFailedLoginAttempts();
        logger.warn("Failed login attempt #{} for user: {}", attempts, maskIdentifier(identifier));

        // Log failed login
        securityAuditService.logSecurityEvent(
                user.getUserId(),
                "LOGIN_FAILED",
                "Invalid password - Attempt #" + attempts);
    }

    /**
     * Increments failed login attempts and locks account if max attempts exceeded.
     *
     * @param user User entity
     */
    private void incrementFailedAttempts(User user) {
        int attempts = user.getFailedLoginAttempts() != null ? user.getFailedLoginAttempts() : 0;
        attempts++;

        user.setFailedLoginAttempts(attempts);
        user.setLastLoginAttempt(TimezoneUtil.now());

        if (attempts >= MAX_FAILED_ATTEMPTS) {
            user.setIsLocked(true);
            user.setLockTime(TimezoneUtil.now());

            logger.warn("Account locked due to {} failed login attempts: {}",
                    attempts, maskIdentifier(user.getEmail()));

            securityAuditService.logSecurityEvent(
                    user.getUserId(),
                    "ACCOUNT_LOCKED",
                    "Account locked after " + attempts + " failed login attempts");
        }

        userRepository.save(user);
    }

    /**
     * Resets failed login attempts on successful login.
     *
     * @param user User entity
     */
    private void resetFailedAttempts(User user) {
        if (user.getFailedLoginAttempts() != null && user.getFailedLoginAttempts() > 0) {
            user.setFailedLoginAttempts(0);
            user.setLastLoginAttempt(TimezoneUtil.now());
            userRepository.save(user);
            logger.debug("Reset failed login attempts for user: {}", maskIdentifier(user.getEmail()));
        }
    }

    /**
     * Checks if account is still within lock duration.
     *
     * @param user User entity
     * @return true if still locked, false if lock expired
     */
    private boolean isAccountLocked(User user) {
        if (Boolean.FALSE.equals(user.getIsLocked())) {
            return false;
        }

        Instant lockTime = user.getLockTime();
        if (lockTime == null) {
            return false;
        }

        long minutesPassed = ChronoUnit.MINUTES.between(lockTime, TimezoneUtil.now());
        return minutesPassed < LOCK_TIME_DURATION_MINUTES;
    }

    /**
     * Unlocks account after lock duration expires.
     *
     * @param user User entity
     */
    private void unlockAccount(User user) {
        user.setIsLocked(false);
        user.setFailedLoginAttempts(0);
        user.setLockTime(null);
        userRepository.save(user);

        logger.info("Account automatically unlocked: {}", maskIdentifier(user.getEmail()));

        securityAuditService.logSecurityEvent(
                user.getUserId(),
                "ACCOUNT_UNLOCKED",
                "Account automatically unlocked after lock duration expired");
    }

    /**
     * Initiates registration with OTP verification.
     * Validates registration details and sends OTP to user's email.
     *
     * @param registerRequest Registration details
     * @return OtpResponse indicating OTP was sent
     */
    @Transactional
    public OtpResponse registerWithOtp(RegisterRequest registerRequest) {
        // Sanitize inputs
        String email = sanitizeInput(registerRequest.getEmail()).toLowerCase();
        String phoneNumber = sanitizePhoneNumber(registerRequest.getPhoneNumber());
        String firstName = sanitizeInput(registerRequest.getFirstName());
        String lastName = sanitizeInput(registerRequest.getLastName());

        logger.info("OTP registration initiated for email: {}", maskEmail(email));

        // Check email uniqueness
        if (userRepository.existsByEmail(email)) {
            logger.warn("Registration attempt with existing email: {}", maskEmail(email));
            throw new UserAlreadyExistsException("An account with this email already exists");
        }

        // Check phone number uniqueness
        if (userRepository.existsByPhoneNumber(phoneNumber)) {
            logger.warn("Registration attempt with existing phone number");
            throw new UserAlreadyExistsException("An account with this phone number already exists");
        }

        // Store registration details in session/cache for later use after OTP verification
        // For now, we'll generate and send OTP
        String otp = otpService.generateOtp(email, OtpVerification.OtpPurpose.REGISTRATION);

        // Send OTP via email
        boolean emailSent = notificationService.sendOtpEmail(email, otp, "REGISTRATION");

        if (!emailSent) {
            logger.error("Failed to send OTP email for registration: {}", maskEmail(email));
            throw new RuntimeException("Failed to send verification email. Please try again.");
        }

        logger.info("OTP sent successfully for registration: {}", maskEmail(email));

        return new OtpResponse(
                "Verification code sent to your email. Please check your inbox.",
                true,
                email);
    }

    /**
     * Verifies registration OTP and completes user account creation.
     *
     * @param registerRequest  Registration details
     * @param otpVerification  OTP verification request
     * @return AuthResponse with JWT token
     */
    @Transactional
    public AuthResponse verifyRegistrationOtp(RegisterRequest registerRequest, OtpVerificationRequest otpVerification) {
        // Sanitize inputs
        String email = sanitizeInput(registerRequest.getEmail()).toLowerCase();
        String phoneNumber = sanitizePhoneNumber(registerRequest.getPhoneNumber());
        String firstName = sanitizeInput(registerRequest.getFirstName());
        String lastName = sanitizeInput(registerRequest.getLastName());
        String otp = otpVerification.getOtp();

        logger.info("Verifying registration OTP for email: {}", maskEmail(email));

        // Verify OTP
        if (!otpService.verifyOtp(email, otp, OtpVerification.OtpPurpose.REGISTRATION)) {
            logger.warn("OTP verification failed for registration: {}", maskEmail(email));
            throw new InvalidCredentialsException("Invalid or expired verification code");
        }

        // Recheck email/phone uniqueness before creating user
        if (userRepository.existsByEmail(email)) {
            logger.warn("Email already exists during OTP verification: {}", maskEmail(email));
            throw new UserAlreadyExistsException("An account with this email already exists");
        }

        if (userRepository.existsByPhoneNumber(phoneNumber)) {
            logger.warn("Phone number already exists during OTP verification");
            throw new UserAlreadyExistsException("An account with this phone number already exists");
        }

        // Create user
        User user = new User();
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setEmail(email);
        user.setPhoneNumber(phoneNumber);

        // Encode the password before saving
        String encodedPassword = passwordEncoder.encode(registerRequest.getPassword());
        user.setPassword(encodedPassword);
        user.setRole(Role.PATIENT);
        user.setIsActive(true);
        user.setIsLocked(false);
        user.setFailedLoginAttempts(0);

        // Save user with encoded password
        user = userRepository.save(user);

        // Verify the user was saved correctly
        if (user.getUserId() == null || user.getPassword() == null || user.getPassword().isEmpty()) {
            logger.error("Failed to create user account for email: {}", maskEmail(email));
            throw new RuntimeException("Failed to create user account. Please try again.");
        }

        // Create patient record
        Patient patient = new Patient();
        patient.setUser(user);
        patient = patientRepository.save(patient);

        // Generate JWT token
        String token = jwtUtil.generateToken(user.getEmail(), user.getRole().getValue(), user.getUserId());

        // Create response
        AuthResponse response = new AuthResponse(
                token,
                user.getUserId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getProfileImageUrl(),
                user.getRole().getValue(),
                user.getPhoneNumber());

        response.setPatientId(patient.getPatientId());

        // Log successful registration
        securityAuditService.logSecurityEvent(user.getUserId(), "REGISTRATION_SUCCESS", "New patient account created with OTP verification");

        logger.info("New patient account created with OTP verification: {}", maskEmail(email));
        return response;
    }

    /**
     * Resends OTP for registration.
     *
     * @param resendRequest Resend request containing email
     * @return OtpResponse indicating OTP was resent
     */
    @Transactional
    public OtpResponse resendRegistrationOtp(OtpResendRequest resendRequest) {
        String email = sanitizeInput(resendRequest.getEmail()).toLowerCase();

        logger.info("Resend registration OTP requested for email: {}", maskEmail(email));

        // Generate new OTP
        String otp = otpService.generateOtp(email, OtpVerification.OtpPurpose.REGISTRATION);

        // Send OTP via email
        boolean emailSent = notificationService.sendOtpEmail(email, otp, "REGISTRATION");

        if (!emailSent) {
            logger.error("Failed to resend OTP email for registration: {}", maskEmail(email));
            throw new RuntimeException("Failed to resend verification email. Please try again.");
        }

        logger.info("OTP resent successfully for registration: {}", maskEmail(email));

        return new OtpResponse(
                "Verification code resent to your email. Please check your inbox.",
                true,
                email);
    }

    /**
     * Initiates password reset by sending OTP to the user's email.
     *
     * @param request Password reset request containing email
     * @return OtpResponse indicating OTP was sent
     */
    @Transactional
    public OtpResponse initiatePasswordReset(PasswordResetRequest request) {
        String email = sanitizeInput(request.getEmail()).toLowerCase();

        logger.info("Password reset OTP requested for email: {}", maskEmail(email));

        if (!userRepository.existsByEmail(email)) {
            logger.warn("Password reset requested for unknown email: {}", maskEmail(email));
            throw new RuntimeException("User not found");
        }

        String otp = otpService.generateOtp(email, OtpVerification.OtpPurpose.PASSWORD_RESET);
        boolean emailSent = notificationService.sendOtpEmail(email, otp, "PASSWORD_RESET");

        if (!emailSent) {
            logger.error("Failed to send OTP email for password reset: {}", maskEmail(email));
            throw new RuntimeException("Failed to send reset email. Please try again.");
        }

        logger.info("Password reset OTP sent successfully for email: {}", maskEmail(email));

        return new OtpResponse(
                "Password reset code sent to your email. Please check your inbox.",
                true,
                email);
    }

    /**
     * Registers a new patient user account (deprecated - use registerWithOtp instead).
     * Preserves existing registration functionality.
     *
     * @param registerRequest Registration details
     * @return AuthResponse with JWT token
     */
    @Transactional
    public AuthResponse register(RegisterRequest registerRequest) {
        // Sanitize inputs
        String email = sanitizeInput(registerRequest.getEmail()).toLowerCase();
        String phoneNumber = sanitizePhoneNumber(registerRequest.getPhoneNumber());
        String firstName = sanitizeInput(registerRequest.getFirstName());
        String lastName = sanitizeInput(registerRequest.getLastName());

        // Check email uniqueness
        if (userRepository.existsByEmail(email)) {
            logger.warn("Registration attempt with existing email: {}", maskEmail(email));
            throw new UserAlreadyExistsException("An account with this email already exists");
        }

        // Check phone number uniqueness
        if (userRepository.existsByPhoneNumber(phoneNumber)) {
            logger.warn("Registration attempt with existing phone number");
            throw new UserAlreadyExistsException("An account with this phone number already exists");
        }

        // Create user
        User user = new User();
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setEmail(email);
        user.setPhoneNumber(phoneNumber);

        // Encode the password before saving
        String encodedPassword = passwordEncoder.encode(registerRequest.getPassword());
        user.setPassword(encodedPassword);
        user.setRole(Role.PATIENT);
        user.setIsActive(true);
        user.setIsLocked(false);
        user.setFailedLoginAttempts(0);

        // Save user with encoded password
        user = userRepository.save(user);

        // Verify the user was saved correctly
        if (user.getUserId() == null || user.getPassword() == null || user.getPassword().isEmpty()) {
            logger.error("Failed to create user account for email: {}", maskEmail(email));
            throw new RuntimeException("Failed to create user account. Please try again.");
        }

        // Create patient record
        Patient patient = new Patient();
        patient.setUser(user);
        patient = patientRepository.save(patient);

        // Generate JWT token
        String token = jwtUtil.generateToken(user.getEmail(), user.getRole().getValue(), user.getUserId());

        // Create response
        AuthResponse response = new AuthResponse(
                token,
                user.getUserId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getProfileImageUrl(),
                user.getRole().getValue(),
                user.getPhoneNumber());

        response.setPatientId(patient.getPatientId());

        // Log successful registration
        securityAuditService.logSecurityEvent(user.getUserId(), "REGISTRATION_SUCCESS", "New patient account created");

        logger.info("New patient account created: {}", maskEmail(email));
        return response;
    }

    /**
     * Sanitizes input by trimming whitespace.
     * SQL injection is prevented by JPA/Hibernate parameterized queries,
     * so we don't strip valid characters like apostrophes from names (e.g.,
     * O'Brien).
     *
     * @param input Raw input string
     * @return Sanitized string
     */
    private String sanitizeInput(String input) {
        if (input == null) {
            return null;
        }
        return input.trim();
    }

    /**
     * Sanitizes and normalizes phone number.
     *
     * @param phoneNumber Raw phone number
     * @return Normalized phone number
     */
    private String sanitizePhoneNumber(String phoneNumber) {
        if (phoneNumber == null) {
            return null;
        }
        // Remove whitespace, hyphens, and parentheses
        return phoneNumber.replaceAll("[\\s()-]", "").trim();
    }

    /**
     * Masks email for logging privacy.
     *
     * @param email Email address
     * @return Masked email
     */
    private String maskEmail(String email) {
        if (email == null || email.length() < 3) {
            return "***";
        }
        int atIndex = email.indexOf('@');
        if (atIndex > 2) {
            return email.substring(0, 2) + "***" + email.substring(atIndex);
        }
        return email.substring(0, 2) + "***";
    }

    /**
     * Masks identifier for logging privacy.
     *
     * @param identifier Email or phone number
     * @return Masked identifier
     */
    private String maskIdentifier(String identifier) {
        if (identifier == null || identifier.length() < 3) {
            return "***";
        }
        if (identifier.contains("@")) {
            return maskEmail(identifier);
        }
        // For phone numbers, show last 4 digits
        if (identifier.length() > 4) {
            return "***" + identifier.substring(identifier.length() - 4);
        }
        return "***";
    }
}
