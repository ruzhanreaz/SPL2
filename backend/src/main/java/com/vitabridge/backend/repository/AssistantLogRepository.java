package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.AssistantLog;
import com.vitabridge.backend.model.Doctor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssistantLogRepository extends JpaRepository<AssistantLog, Integer> {
    List<AssistantLog> findByDoctorOrderByCreatedAtDesc(Doctor doctor);

    List<AssistantLog> findByAssistant_AssistantIdOrderByCreatedAtDesc(Integer assistantId);
}
