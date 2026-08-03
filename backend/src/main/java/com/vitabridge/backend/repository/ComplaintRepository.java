package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.Complaint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ComplaintRepository extends JpaRepository<Complaint, Integer> {

    @Query("SELECT c FROM Complaint c JOIN FETCH c.patient WHERE c.patient.patientId = :patientId ORDER BY c.createdAt DESC")
    List<Complaint> findByPatientIdOrderByCreatedAtDesc(@Param("patientId") Integer patientId);

    @Query("SELECT c FROM Complaint c JOIN FETCH c.patient ORDER BY c.createdAt DESC")
    List<Complaint> findAllByOrderByCreatedAtDesc();

    void deleteByPatient_PatientId(Integer patientId);

    long countByStatus(String status);
}
