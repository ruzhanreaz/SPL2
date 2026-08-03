package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.Appointment;
import com.vitabridge.backend.model.Prescription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PrescriptionRepository extends JpaRepository<Prescription, Integer> {

    Optional<Prescription> findFirstByAppointmentOrderByCreatedAtDesc(Appointment appointment);

    List<Prescription> findByPatientPatientIdOrderByCreatedAtDesc(Integer patientId);

    List<Prescription> findByDoctorDoctorIdOrderByCreatedAtDesc(Integer doctorId);
}
