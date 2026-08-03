package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.Appointment;
import com.vitabridge.backend.model.MedicalAccessGrant;
import com.vitabridge.backend.model.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MedicalAccessGrantRepository extends JpaRepository<MedicalAccessGrant, Integer> {

    Optional<MedicalAccessGrant> findFirstByAppointmentAndRevokedAtIsNullOrderByGrantedAtDesc(Appointment appointment);

    List<MedicalAccessGrant> findByPatientOrderByGrantedAtDesc(Patient patient);
}
