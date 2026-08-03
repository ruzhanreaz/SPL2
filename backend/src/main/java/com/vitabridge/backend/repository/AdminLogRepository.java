package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.AdminLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AdminLogRepository extends JpaRepository<AdminLog, Integer> {
    List<AdminLog> findAllByOrderByTimestampDesc();
}
