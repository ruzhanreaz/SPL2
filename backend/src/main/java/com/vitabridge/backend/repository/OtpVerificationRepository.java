package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.OtpVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface OtpVerificationRepository extends JpaRepository<OtpVerification, Integer> {
    
    Optional<OtpVerification> findByEmailAndPurposeAndIsVerifiedFalse(
            String email, OtpVerification.OtpPurpose purpose);

    Optional<OtpVerification> findByEmailAndOtpCodeAndPurpose(
            String email, String otpCode, OtpVerification.OtpPurpose purpose);

    List<OtpVerification> findByEmailAndPurpose(String email, OtpVerification.OtpPurpose purpose);

    @Query("SELECT o FROM OtpVerification o WHERE o.expiresAt < :now")
    List<OtpVerification> findExpiredOtps(@Param("now") Instant now);

    @Query("DELETE FROM OtpVerification o WHERE o.expiresAt < :now")
    void deleteExpiredOtps(@Param("now") Instant now);
}
