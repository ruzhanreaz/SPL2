package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.Doctor;
import com.vitabridge.backend.model.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ScheduleRepository extends JpaRepository<Schedule, Integer> {
    Optional<Schedule> findByDoctor(Doctor doctor);

    Optional<Schedule> findByDoctorDoctorId(Integer doctorId);
}
