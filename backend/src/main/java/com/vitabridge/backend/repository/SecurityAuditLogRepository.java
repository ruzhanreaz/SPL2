package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.SecurityAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SecurityAuditLogRepository extends JpaRepository<SecurityAuditLog, Long> {
    List<SecurityAuditLog> findByUserIdOrderByTimestampDesc(Integer userId);

    List<SecurityAuditLog> findByEventTypeAndTimestampAfter(String eventType, LocalDateTime timestamp);

    List<SecurityAuditLog> findByUserIdAndEventTypeOrderByTimestampDesc(Integer userId, String eventType);
}
