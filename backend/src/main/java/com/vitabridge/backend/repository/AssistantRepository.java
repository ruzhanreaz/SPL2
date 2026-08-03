package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.Assistant;
import com.vitabridge.backend.model.Doctor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AssistantRepository extends JpaRepository<Assistant, Integer> {
    List<Assistant> findByDoctor(Doctor doctor);

    List<Assistant> findByDoctorDoctorId(Integer doctorId);

    Optional<Assistant> findByUserUserId(Integer userId);
}
