package com.vitabridge.backend.service;

import com.vitabridge.backend.model.OtpVerification;
import com.vitabridge.backend.repository.OtpVerificationRepository;
import com.vitabridge.backend.util.TimezoneUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Random;

/**
 * Service for handling OTP (One-Time Password) generation, verification, and management.
 * Supports multiple purposes: registration, password reset, and password change.
 */
@Service
public class OtpService {

    private static final Logger logger = LoggerFactory.getLogger(OtpService.class);
    private static final int OTP_LENGTH = 6;
    private static final int MAX_VERIFICATION_ATTEMPTS = 5;
    private static final long OTP_VALIDITY_SECONDS = 600; // 10 minutes

    @Autowired
    private OtpVerificationRepository otpRepository;

    /**
     * Generates a new 6-digit OTP and stores it in the database.
     *
     * @param email   The email address for which OTP is generated
     * @param purpose The purpose of OTP (REGISTRATION, PASSWORD_RESET, PASSWORD_CHANGE)
     * @return The generated OTP code
     */
    @Transactional
    public String generateOtp(String email, OtpVerification.OtpPurpose purpose) {
        logger.info("Generating OTP for email: {} with purpose: {}", maskEmail(email), purpose);

        // Invalidate any existing unverified OTP for this email and purpose
        otpRepository.findByEmailAndPurposeAndIsVerifiedFalse(email, purpose)
                .ifPresent(otp -> {
                    logger.debug("Invalidating existing OTP for email: {}", maskEmail(email));
                    otpRepository.delete(otp);
                });

        // Generate random 6-digit OTP
        String otpCode = generateRandomOtp();
        
        // Create and save OTP verification record
        OtpVerification otpVerification = new OtpVerification(email, otpCode, purpose);
        otpVerification = otpRepository.save(otpVerification);

        logger.info("OTP generated successfully for email: {} with purpose: {}", maskEmail(email), purpose);
        return otpCode;
    }

    /**
     * Verifies the provided OTP code for the given email and purpose.
     *
     * @param email   The email address
     * @param otpCode The OTP code provided by user
     * @param purpose The purpose of OTP
     * @return true if OTP is valid and verified, false otherwise
     */
    @Transactional
    public boolean verifyOtp(String email, String otpCode, OtpVerification.OtpPurpose purpose) {
        logger.debug("Verifying OTP for email: {} with purpose: {}", maskEmail(email), purpose);

        var otpOpt = otpRepository.findByEmailAndOtpCodeAndPurpose(email, otpCode, purpose);

        if (otpOpt.isEmpty()) {
            logger.warn("OTP not found for email: {} with purpose: {}", maskEmail(email), purpose);
            return false;
        }

        OtpVerification otp = otpOpt.get();

        // Check if OTP is already verified
        if (Boolean.TRUE.equals(otp.getIsVerified())) {
            logger.warn("OTP already verified for email: {}", maskEmail(email));
            return false;
        }

        // Check if OTP has expired
        if (isOtpExpired(otp)) {
            logger.warn("OTP has expired for email: {}", maskEmail(email));
            otpRepository.delete(otp);
            return false;
        }

        // Check if max verification attempts exceeded
        int attempts = otp.getVerificationAttempts() != null ? otp.getVerificationAttempts() : 0;
        if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
            logger.warn("Max verification attempts exceeded for email: {}", maskEmail(email));
            otpRepository.delete(otp);
            return false;
        }

        // Mark OTP as verified
        otp.setIsVerified(true);
        otp.setVerifiedAt(TimezoneUtil.now());
        otpRepository.save(otp);

        logger.info("OTP verified successfully for email: {}", maskEmail(email));
        return true;
    }

    /**
     * Validates OTP without marking it as verified (for checking before processing).
     * Increments verification attempts on invalid OTP.
     *
     * @param email   The email address
     * @param otpCode The OTP code provided by user
     * @param purpose The purpose of OTP
     * @return true if OTP is valid (not expired, exists, not verified yet), false otherwise
     */
    @Transactional
    public boolean validateOtp(String email, String otpCode, OtpVerification.OtpPurpose purpose) {
        logger.debug("Validating OTP for email: {} with purpose: {}", maskEmail(email), purpose);

        var otpOpt = otpRepository.findByEmailAndOtpCodeAndPurpose(email, otpCode, purpose);

        if (otpOpt.isEmpty()) {
            logger.warn("OTP validation failed: OTP not found for email: {}", maskEmail(email));
            return false;
        }

        OtpVerification otp = otpOpt.get();

        // Check if OTP is already verified
        if (Boolean.TRUE.equals(otp.getIsVerified())) {
            logger.warn("OTP validation failed: Already verified for email: {}", maskEmail(email));
            return false;
        }

        // Check if OTP has expired
        if (isOtpExpired(otp)) {
            logger.warn("OTP validation failed: Expired for email: {}", maskEmail(email));
            otpRepository.delete(otp);
            return false;
        }

        // Check if max verification attempts exceeded
        int attempts = otp.getVerificationAttempts() != null ? otp.getVerificationAttempts() : 0;
        if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
            logger.warn("OTP validation failed: Max attempts exceeded for email: {}", maskEmail(email));
            otpRepository.delete(otp);
            return false;
        }

        // Increment verification attempts
        otp.setVerificationAttempts(attempts + 1);
        otpRepository.save(otp);

        logger.debug("OTP validation passed for email: {}", maskEmail(email));
        return true;
    }

    /**
     * Invalidates all unverified OTPs for a given email and purpose.
     *
     * @param email   The email address
     * @param purpose The purpose of OTP
     */
    @Transactional
    public void invalidateOtp(String email, OtpVerification.OtpPurpose purpose) {
        logger.debug("Invalidating OTP for email: {} with purpose: {}", maskEmail(email), purpose);
        otpRepository.findByEmailAndPurposeAndIsVerifiedFalse(email, purpose)
                .ifPresent(otpRepository::delete);
    }

    /**
     * Cleans up expired OTPs from the database.
     */
    @Transactional
    public void cleanupExpiredOtps() {
        logger.debug("Cleaning up expired OTPs");
        Instant now = TimezoneUtil.now();
        otpRepository.deleteExpiredOtps(now);
        logger.debug("Expired OTPs cleanup completed");
    }

    /**
     * Generates a random 6-digit OTP code.
     *
     * @return Random 6-digit OTP as string
     */
    private String generateRandomOtp() {
        Random random = new Random();
        int otp = 100000 + random.nextInt(900000); // Generates random number between 100000-999999
        return String.valueOf(otp);
    }

    /**
     * Checks if the OTP has expired.
     *
     * @param otp The OTP verification record
     * @return true if OTP has expired, false otherwise
     */
    private boolean isOtpExpired(OtpVerification otp) {
        Instant now = TimezoneUtil.now();
        return otp.getExpiresAt() != null && now.isAfter(otp.getExpiresAt());
    }

    /**
     * Masks email for logging purposes.
     *
     * @param email The email address
     * @return Masked email (first 3 chars + ***)
     */
    private String maskEmail(String email) {
        if (email == null || email.length() < 4) {
            return "***";
        }
        return email.substring(0, 3) + "***";
    }
}
