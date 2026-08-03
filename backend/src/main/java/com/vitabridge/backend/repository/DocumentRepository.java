package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.Document;
import com.vitabridge.backend.model.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Integer>, JpaSpecificationExecutor<Document> {
    List<Document> findByPatientOrderByUploadedAtDesc(Patient patient);

    List<Document> findByPatientAndDocumentTypeOrderByUploadedAtDesc(Patient patient,
            Document.DocumentType documentType);

    boolean existsByPatientAndFileName(Patient patient, String fileName);

    boolean existsByPatientAndFileNameAndDocumentIdNot(Patient patient, String fileName, Integer documentId);

    long countByPatient(Patient patient);

    long countByPatientAndDocumentType(Patient patient, Document.DocumentType documentType);

    @Query("SELECT COALESCE(SUM(d.fileSize), 0) FROM Document d WHERE d.patient = :patient")
    Long getTotalFileSizeByPatient(Patient patient);

    @Query("SELECT COALESCE(SUM(d.fileSize), 0) FROM Document d WHERE d.patient = :patient AND d.documentType = :documentType")
    Long getTotalFileSizeByPatientAndDocumentType(Patient patient, Document.DocumentType documentType);
}
