package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.Patient;
import com.vitabridge.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PatientRepository extends JpaRepository<Patient, Integer> {
    Optional<Patient> findByUserUserId(Integer userId);

    Optional<Patient> findByUser(User user);
}
