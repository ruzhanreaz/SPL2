package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.TelemedicineCallSession;
import com.vitabridge.backend.model.TelemedicineCallStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface TelemedicineCallSessionRepository extends JpaRepository<TelemedicineCallSession, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM TelemedicineCallSession c WHERE c.callSessionId = :callSessionId")
    Optional<TelemedicineCallSession> findByIdForUpdate(@Param("callSessionId") Long callSessionId);

    Optional<TelemedicineCallSession> findFirstByAppointmentAppointmentIdAndStatusInOrderByInitiatedAtDesc(
            Integer appointmentId,
            List<TelemedicineCallStatus> statuses);

    Optional<TelemedicineCallSession> findFirstByRoomIdAndStatusInOrderByInitiatedAtDesc(
            String roomId,
            List<TelemedicineCallStatus> statuses);

    List<TelemedicineCallSession> findByStatusInAndExpiresAtBefore(
            List<TelemedicineCallStatus> statuses,
            Instant expiresAt);
}