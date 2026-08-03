package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.Doctor;
import com.vitabridge.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DoctorRepository extends JpaRepository<Doctor, Integer> {
    Optional<Doctor> findByUser(User user);

    Optional<Doctor> findByUserUserId(Integer userId);
}
