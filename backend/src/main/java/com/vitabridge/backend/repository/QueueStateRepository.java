package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.Doctor;
import com.vitabridge.backend.model.QueueState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface QueueStateRepository extends JpaRepository<QueueState, Integer> {
    Optional<QueueState> findByDoctorAndQueueDate(Doctor doctor, LocalDate queueDate);
}
