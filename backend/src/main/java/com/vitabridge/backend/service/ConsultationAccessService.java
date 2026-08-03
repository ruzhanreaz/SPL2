package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.PrescriptionRequest;
import com.vitabridge.backend.dto.PrescriptionResponse;
import com.vitabridge.backend.dto.AppointmentResponse;
import com.vitabridge.backend.model.*;
import com.vitabridge.backend.repository.*;
import com.vitabridge.backend.util.TimezoneUtil;
import io.minio.GetObjectArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import io.minio.http.Method;
import org.springframework.http.MediaType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.URLConnection;

@Service
public class ConsultationAccessService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private DoctorRepository doctorRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private MedicalAccessGrantRepository medicalAccessGrantRepository;

    @Autowired
    private PrescriptionRepository prescriptionRepository;

    @Autowired
    private PrescriptionPdfService prescriptionPdfService;

    @Autowired
    private AppointmentService appointmentService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private DocumentService documentService;

    @Autowired
    private MinioClient minioClient;

    @Value("${minio.bucket-name}")
    private String bucketName;

    @Transactional
    public Map<String, Object> grantAccess(
            Integer appointmentId,
            String patientEmail,
            Integer durationMinutes,
            List<Integer> selectedDocumentIds) {
        Appointment appointment = requireAppointment(appointmentId);
        validatePatientOwnsAppointment(appointment, patientEmail);

        List<Integer> validatedDocumentIds = validateSelectedDocuments(appointment.getPatient(), selectedDocumentIds);

        MedicalAccessGrant grant = medicalAccessGrantRepository
                .findFirstByAppointmentAndRevokedAtIsNullOrderByGrantedAtDesc(appointment)
                .orElseGet(MedicalAccessGrant::new);

        grant.setAppointment(appointment);
        grant.setPatient(appointment.getPatient());
        grant.setDoctor(appointment.getDoctor());
        grant.setGrantedAt(TimezoneUtil.now());
        grant.setRevokedAt(null);
        grant.setRevokeReason(null);
        grant.setSharedDocumentIds(validatedDocumentIds);

        if (durationMinutes != null && durationMinutes > 0) {
            grant.setExpiresAt(TimezoneUtil.now().plusSeconds(durationMinutes * 60));
        } else {
            grant.setExpiresAt(null);
        }

        MedicalAccessGrant saved = medicalAccessGrantRepository.save(grant);
        return toGrantSummary(saved, false);
    }

    @Transactional
    public Map<String, Object> revokeAccess(Integer appointmentId, String patientEmail) {
        Appointment appointment = requireAppointment(appointmentId);
        validatePatientOwnsAppointment(appointment, patientEmail);

        MedicalAccessGrant grant = medicalAccessGrantRepository
                .findFirstByAppointmentAndRevokedAtIsNullOrderByGrantedAtDesc(appointment)
                .orElseThrow(() -> new RuntimeException("No active access grant found for this appointment"));

        revokeGrant(grant, "PATIENT_REVOKED");
        return toGrantSummary(grant, false);
    }

    @Transactional
    public Map<String, Object> getAccessStatusForDoctor(Integer appointmentId, String doctorEmail) {
        Appointment appointment = requireAppointment(appointmentId);
        validateDoctorOwnsAppointment(appointment, doctorEmail);

        MedicalAccessGrant activeGrant = getUsableGrant(appointment);
        boolean hasAccess = activeGrant != null;

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("hasAccess", hasAccess);
        response.put("expiresAt", activeGrant != null ? activeGrant.getExpiresAt() : null);
        response.put("grantedAt", activeGrant != null ? activeGrant.getGrantedAt() : null);
        response.put("sharedDocumentIds", activeGrant != null ? activeGrant.getSharedDocumentIds() : List.of());
        response.put("sharedDocumentCount", activeGrant != null ? activeGrant.getSharedDocumentIds().size() : 0);
        response.put("autoRevokedOnEnd", true);
        return response;
    }

    @Transactional
    public List<Map<String, Object>> getPatientDocumentsForDoctor(Integer appointmentId, String doctorEmail) {
        Appointment appointment = requireAppointment(appointmentId);
        validateDoctorOwnsAppointment(appointment, doctorEmail);

        MedicalAccessGrant grant = getUsableGrant(appointment);
        if (grant == null) {
            throw new RuntimeException("Patient has not granted access to medical documents");
        }

        Set<Integer> allowedDocumentIds = new HashSet<>(grant.getSharedDocumentIds());
        if (allowedDocumentIds.isEmpty()) {
            return List.of();
        }

        List<Document> documents = documentRepository.findByPatientOrderByUploadedAtDesc(appointment.getPatient())
                .stream()
                .filter(doc -> allowedDocumentIds.contains(doc.getDocumentId()))
                .toList();

        List<Map<String, Object>> result = new ArrayList<>();

        for (Document doc : documents) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("documentId", doc.getDocumentId());
            row.put("fileName", doc.getFileName());
            row.put("documentType", doc.getDocumentType());
            row.put("fileSize", doc.getFileSize());
            row.put("uploadedAt", doc.getUploadedAt());
            row.put("issuedAt", doc.getIssuedAt());
            row.put("downloadUrl", buildDownloadUrl(doc.getFileUrl()));
            result.add(row);
        }

        return result;
    }

    @Transactional(readOnly = true)
    public Document getAuthorizedPatientDocumentForDoctor(Integer appointmentId, Integer documentId, String doctorEmail) {
        Appointment appointment = requireAppointment(appointmentId);
        validateDoctorOwnsAppointment(appointment, doctorEmail);

        MedicalAccessGrant grant = getUsableGrant(appointment);
        if (grant == null) {
            throw new RuntimeException("Patient has not granted access to medical documents");
        }

        Set<Integer> allowedDocumentIds = new HashSet<>(grant.getSharedDocumentIds());
        if (!allowedDocumentIds.contains(documentId)) {
            throw new RuntimeException("Requested document is not in the shared secure folder");
        }

        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Document not found"));

        if (!Objects.equals(document.getPatient().getPatientId(), appointment.getPatient().getPatientId())) {
            throw new RuntimeException("Requested document does not belong to this appointment patient");
        }

        return document;
    }

    @Transactional(readOnly = true)
    public byte[] loadDocumentBytesForDoctor(Document document) {
        if (document == null || document.getFileUrl() == null || document.getFileUrl().isBlank()) {
            throw new RuntimeException("Document storage object is missing");
        }

        try (InputStream stream = minioClient.getObject(
                GetObjectArgs.builder()
                        .bucket(bucketName)
                        .object(document.getFileUrl())
                        .build())) {
            return stream.readAllBytes();
        } catch (Exception ex) {
            throw new RuntimeException("Failed to load document content", ex);
        }
    }

    @Transactional(readOnly = true)
    public String resolveDocumentContentTypeForDoctor(Document document) {
        if (document == null || document.getFileUrl() == null || document.getFileUrl().isBlank()) {
            return MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }

        try {
            StatObjectResponse stat = minioClient.statObject(
                    StatObjectArgs.builder()
                            .bucket(bucketName)
                            .object(document.getFileUrl())
                            .build());
            String statContentType = stat.contentType();
            if (statContentType != null && !statContentType.isBlank()) {
                return statContentType;
            }
        } catch (Exception ignored) {
            // Fallback to filename-based detection.
        }

        String guessed = URLConnection.guessContentTypeFromName(document.getFileName());
        if (guessed != null && !guessed.isBlank()) {
            return guessed;
        }

        return MediaType.APPLICATION_OCTET_STREAM_VALUE;
    }

    @Transactional
    public List<Map<String, Object>> getPatientAccessGrants(String patientEmail) {
        Patient patient = requirePatient(patientEmail);
        List<MedicalAccessGrant> grants = medicalAccessGrantRepository.findByPatientOrderByGrantedAtDesc(patient);

        List<Map<String, Object>> result = new ArrayList<>();
        for (MedicalAccessGrant grant : grants) {
            purgeGrantIfNeeded(grant);
            boolean active = grant.getRevokedAt() == null;
            result.add(toGrantSummary(grant, active));
        }
        return result;
    }

    @Transactional
    public PrescriptionResponse createPrescription(Integer appointmentId, String doctorEmail, PrescriptionRequest request) {
        Appointment appointment = requireAppointment(appointmentId);
        validateDoctorOwnsAppointment(appointment, doctorEmail);

        AppointmentService.AllocatedSlot suggestedFollowUpSlot = null;
        if (request.getFollowUpDate() != null || request.getFollowUpTime() != null || request.getFollowUpNumber() != null) {
            if (request.getFollowUpDate() == null) {
                throw new RuntimeException("Follow-up date is required for follow-up booking");
            }

            if (request.getFollowUpTime() != null) {
                suggestedFollowUpSlot = appointmentService.suggestFollowUpSlotByPreferredTime(
                        appointment.getDoctor(),
                        request.getFollowUpDate(),
                        request.getFollowUpTime());
            } else if (request.getFollowUpNumber() != null) {
                appointmentService.validateFollowUpVisitNumber(
                        appointment.getDoctor(),
                        request.getFollowUpDate(),
                        request.getFollowUpNumber());
            } else {
                throw new RuntimeException("Follow-up time is required when scheduling the next visit");
            }
        }

        Prescription prescription = new Prescription();
        prescription.setAppointment(appointment);
        prescription.setPatient(appointment.getPatient());
        prescription.setDoctor(appointment.getDoctor());
        mapPrescriptionFields(prescription, request);
        if (suggestedFollowUpSlot != null) {
            prescription.setFollowUpNumber(suggestedFollowUpSlot.serial);
        }

        Prescription saved = prescriptionRepository.save(prescription);

        Integer followUpBookedAppointmentId = null;
        LocalTime followUpAssignedTime = request.getFollowUpTime();

        if (saved.getFollowUpNumber() != null && saved.getFollowUpDate() != null) {
            AppointmentResponse followUpAppointment;
            if (request.getFollowUpTime() != null) {
                followUpAppointment = appointmentService.autoBookFollowUpFromPrescription(
                        appointment,
                        saved.getFollowUpDate(),
                        request.getFollowUpTime(),
                        saved.getFollowUpInstruction());
            } else {
                // Backward compatibility for old prescriptions that only have visit number.
                followUpAppointment = appointmentService.autoBookFollowUpFromPrescription(
                        appointment,
                        saved.getFollowUpNumber(),
                        saved.getFollowUpDate(),
                        saved.getFollowUpInstruction());
            }

            if (followUpAppointment != null) {
                followUpBookedAppointmentId = followUpAppointment.getAppointmentId();
                followUpAssignedTime = followUpAppointment.getAppointmentTime();
                if (followUpAppointment.getSerialNumber() != null) {
                    saved.setFollowUpNumber(followUpAppointment.getSerialNumber());
                    saved = prescriptionRepository.save(saved);
                }
            }
        }

        persistPrescriptionPdfDocument(saved);

        String doctorName = appointment.getDoctor().getUser().getFirstName() + " "
            + appointment.getDoctor().getUser().getLastName();
        String prescriptionMessage = String.format(
            "You have received a new prescription from Dr. %s for your appointment on %s.",
            doctorName,
            appointment.getAppointmentDate());
        notificationService.createNotificationWithEntity(
            appointment.getPatient().getUser(),
            "Prescription Received",
            prescriptionMessage,
            Notification.NotificationType.PRESCRIPTION_RECEIVED,
            "APPOINTMENT",
            appointment.getAppointmentId());

        PrescriptionResponse response = toPrescriptionResponse(saved);
        response.setFollowUpBookedAppointmentId(followUpBookedAppointmentId);
        response.setFollowUpTime(followUpAssignedTime);
        return response;
    }

    @Transactional(readOnly = true)
    public byte[] previewPrescriptionPdf(Integer appointmentId, String doctorEmail, PrescriptionRequest request) {
        Appointment appointment = requireAppointment(appointmentId);
        validateDoctorOwnsAppointment(appointment, doctorEmail);

        if (request.getFollowUpDate() != null || request.getFollowUpTime() != null || request.getFollowUpNumber() != null) {
            if (request.getFollowUpDate() == null) {
                throw new RuntimeException("Follow-up date is required for follow-up booking");
            }

            if (request.getFollowUpTime() != null) {
                AppointmentService.AllocatedSlot suggested = appointmentService.suggestFollowUpSlotByPreferredTime(
                        appointment.getDoctor(),
                        request.getFollowUpDate(),
                        request.getFollowUpTime());
                request.setFollowUpNumber(suggested.serial);
            } else if (request.getFollowUpNumber() != null) {
                appointmentService.validateFollowUpVisitNumber(
                        appointment.getDoctor(),
                        request.getFollowUpDate(),
                        request.getFollowUpNumber());
            } else {
                throw new RuntimeException("Follow-up time is required when scheduling the next visit");
            }
        }

        Prescription preview = new Prescription();
        preview.setAppointment(appointment);
        preview.setPatient(appointment.getPatient());
        preview.setDoctor(appointment.getDoctor());
        mapPrescriptionFields(preview, request);

        return prescriptionPdfService.generatePrescriptionPdf(preview);
    }

    @Transactional(readOnly = true)
    public PrescriptionResponse getLatestPrescription(Integer appointmentId, String requesterEmail) {
        Appointment appointment = requireAppointment(appointmentId);
        validateRequesterOwnsAppointment(appointment, requesterEmail);

        Prescription prescription = prescriptionRepository.findFirstByAppointmentOrderByCreatedAtDesc(appointment)
                .orElseThrow(() -> new RuntimeException("Prescription not found"));

        return toPrescriptionResponse(prescription);
    }

    private Appointment requireAppointment(Integer appointmentId) {
        return appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));
    }

    private Patient requirePatient(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return patientRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("Patient profile not found"));
    }

    private Doctor requireDoctor(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return doctorRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("Doctor profile not found"));
    }

    private void validatePatientOwnsAppointment(Appointment appointment, String patientEmail) {
        Patient patient = requirePatient(patientEmail);
        if (!Objects.equals(appointment.getPatient().getPatientId(), patient.getPatientId())) {
            throw new RuntimeException("You are not authorized for this appointment");
        }
    }

    private void validateDoctorOwnsAppointment(Appointment appointment, String doctorEmail) {
        Doctor doctor = requireDoctor(doctorEmail);
        if (!Objects.equals(appointment.getDoctor().getDoctorId(), doctor.getDoctorId())) {
            throw new RuntimeException("You are not authorized for this appointment");
        }
    }

    private void validateRequesterOwnsAppointment(Appointment appointment, String requesterEmail) {
        User user = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Integer userId = user.getUserId();
        boolean isPatient = Objects.equals(appointment.getPatient().getUser().getUserId(), userId);
        boolean isDoctor = Objects.equals(appointment.getDoctor().getUser().getUserId(), userId);
        if (!isPatient && !isDoctor) {
            throw new RuntimeException("You are not authorized for this appointment");
        }
    }

    private void validateInPerson(Appointment appointment) {
        if (appointment.getAppointmentType() != Appointment.AppointmentType.IN_PERSON) {
            throw new RuntimeException("This action is only available for in-person consultations");
        }
    }

    private MedicalAccessGrant getUsableGrant(Appointment appointment) {
        MedicalAccessGrant grant = medicalAccessGrantRepository
                .findFirstByAppointmentAndRevokedAtIsNullOrderByGrantedAtDesc(appointment)
                .orElse(null);

        if (grant == null) {
            return null;
        }

        purgeGrantIfNeeded(grant);
        return grant.getRevokedAt() == null ? grant : null;
    }

    private void purgeGrantIfNeeded(MedicalAccessGrant grant) {
        if (grant.getRevokedAt() != null) {
            return;
        }

        java.time.Instant now = TimezoneUtil.now();
        if (grant.getExpiresAt() != null && grant.getExpiresAt().isBefore(now)) {
            revokeGrant(grant, "TIMER_EXPIRED");
            return;
        }

        if (isAppointmentEnded(grant.getAppointment().getStatus())) {
            revokeGrant(grant, "CONSULTATION_ENDED");
        }
    }

    private boolean isAppointmentEnded(Appointment.AppointmentStatus status) {
        return status == Appointment.AppointmentStatus.COMPLETED
                || status == Appointment.AppointmentStatus.CANCELLED
                || status == Appointment.AppointmentStatus.REJECTED
                || status == Appointment.AppointmentStatus.NO_SHOW;
    }

    private void revokeGrant(MedicalAccessGrant grant, String reason) {
        grant.setRevokedAt(TimezoneUtil.now());
        grant.setRevokeReason(reason);
        medicalAccessGrantRepository.save(grant);
    }

    private List<Integer> validateSelectedDocuments(Patient patient, List<Integer> selectedDocumentIds) {
        if (selectedDocumentIds == null || selectedDocumentIds.isEmpty()) {
            throw new RuntimeException("Please select at least one document to share");
        }

        Set<Integer> selectedSet = selectedDocumentIds.stream()
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());

        List<Document> patientDocuments = documentRepository.findByPatientOrderByUploadedAtDesc(patient);
        Set<Integer> ownedDocumentIds = patientDocuments.stream()
                .map(Document::getDocumentId)
                .collect(java.util.stream.Collectors.toSet());

        if (!ownedDocumentIds.containsAll(selectedSet)) {
            throw new RuntimeException("One or more selected documents are invalid");
        }

        return new ArrayList<>(selectedSet);
    }

    private Map<String, Object> toGrantSummary(MedicalAccessGrant grant, boolean active) {
        Appointment appointment = grant.getAppointment();

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("grantId", grant.getGrantId());
        row.put("appointmentId", appointment.getAppointmentId());
        row.put("appointmentDate", appointment.getAppointmentDate());
        row.put("appointmentTime", appointment.getAppointmentTime());
        row.put("appointmentStatus", appointment.getStatus().toString());
        row.put("doctorId", appointment.getDoctor().getDoctorId());
        row.put("doctorName", appointment.getDoctor().getUser().getFirstName() + " "
                + appointment.getDoctor().getUser().getLastName());
        row.put("grantedAt", grant.getGrantedAt());
        row.put("expiresAt", grant.getExpiresAt());
        row.put("revokedAt", grant.getRevokedAt());
        row.put("revokeReason", grant.getRevokeReason());
        row.put("sharedDocumentIds", grant.getSharedDocumentIds());
        row.put("sharedDocumentCount", grant.getSharedDocumentIds() != null ? grant.getSharedDocumentIds().size() : 0);
        row.put("active", active);
        return row;
    }

    private PrescriptionResponse toPrescriptionResponse(Prescription prescription) {
        PrescriptionResponse response = new PrescriptionResponse();
        response.setPrescriptionId(prescription.getPrescriptionId());
        response.setAppointmentId(prescription.getAppointment().getAppointmentId());
        response.setPatientName(prescription.getPatient().getUser().getFirstName() + " "
                + prescription.getPatient().getUser().getLastName());
        response.setDoctorName(prescription.getDoctor().getUser().getFirstName() + " "
                + prescription.getDoctor().getUser().getLastName());
        response.setDoctorSpecialty(prescription.getDoctor().getSpecialization());
        response.setAppointmentDate(prescription.getAppointment().getAppointmentDate());
        response.setDiagnosis(prescription.getDiagnosis());
        response.setChiefComplaints(prescription.getChiefComplaints());
        response.setPastHistory(prescription.getPastHistory());
        response.setDrugHistory(prescription.getDrugHistory());
        response.setOnExamination(prescription.getOnExamination());
        response.setFollowUpNumber(prescription.getFollowUpNumber());
        response.setFollowUpInstruction(prescription.getFollowUpInstruction());
        response.setEmergencyInstruction(prescription.getEmergencyInstruction());
        response.setLabTests(prescription.getLabTests());
        response.setAdvice(prescription.getAdvice());
        response.setFollowUpDate(prescription.getFollowUpDate());
        response.setFollowUpTime(null);
        response.setCreatedAt(prescription.getCreatedAt());

        List<PrescriptionResponse.MedicationResponse> medicationResponses = new ArrayList<>();
        for (PrescriptionMedication medication : prescription.getMedications()) {
            if (medication == null || medication.getName() == null || medication.getName().isBlank()) {
                continue;
            }

            PrescriptionResponse.MedicationResponse m = new PrescriptionResponse.MedicationResponse();
            m.setName(medication.getName());
            m.setDosage(medication.getDosage());
            m.setQuantity(medication.getQuantity());
            m.setFrequency(medication.getFrequency());
            m.setDuration(medication.getDuration());
            m.setInstructions(medication.getInstructions());
            medicationResponses.add(m);
        }
        response.setMedications(medicationResponses);
        return response;
    }

    private void mapPrescriptionFields(Prescription prescription, PrescriptionRequest request) {
        prescription.setDiagnosis(request.getDiagnosis());
        prescription.setChiefComplaints(request.getChiefComplaints());
        prescription.setPastHistory(request.getPastHistory());
        prescription.setDrugHistory(request.getDrugHistory());
        prescription.setOnExamination(request.getOnExamination());
        prescription.setFollowUpNumber(request.getFollowUpNumber());
        prescription.setFollowUpInstruction(request.getFollowUpInstruction());
        prescription.setEmergencyInstruction(request.getEmergencyInstruction());
        prescription.setLabTests(request.getLabTests());
        prescription.setAdvice(request.getAdvice());
        prescription.setFollowUpDate(request.getFollowUpDate());

        List<PrescriptionMedication> medications = new ArrayList<>();
        if (request.getMedications() != null) {
            for (PrescriptionRequest.MedicationRequest med : request.getMedications()) {
                if (med == null || med.getName() == null || med.getName().isBlank()) {
                    continue;
                }

                PrescriptionMedication row = new PrescriptionMedication();
                row.setName(med.getName().trim());
                row.setDosage(med.getDosage());
                row.setQuantity(med.getQuantity());
                row.setFrequency(med.getFrequency());
                row.setDuration(med.getDuration());
                row.setInstructions(med.getInstructions());
                medications.add(row);
            }
        }

        prescription.setMedications(medications);
    }

    private String buildDownloadUrl(String objectKey) {
        try {
            return minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucketName)
                            .object(objectKey)
                            .expiry(1, TimeUnit.HOURS)
                            .build());
        } catch (Exception ex) {
            throw new RuntimeException("Failed to generate download URL", ex);
        }
    }

    private void persistPrescriptionPdfDocument(Prescription prescription) {
        byte[] pdfBytes = prescriptionPdfService.generatePrescriptionPdf(prescription);

        documentService.initializeBucket();

        String objectName = String.format(
                "%d_prescription_%d_%s.pdf",
                prescription.getPatient().getPatientId(),
                prescription.getAppointment().getAppointmentId(),
                UUID.randomUUID());

        try (ByteArrayInputStream inputStream = new ByteArrayInputStream(pdfBytes)) {
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(objectName)
                            .stream(inputStream, pdfBytes.length, -1)
                            .contentType("application/pdf")
                            .build());
        } catch (Exception e) {
            throw new RuntimeException("Failed to store prescription PDF in patient documents", e);
        }

        Document document = new Document();
        document.setPatient(prescription.getPatient());
        document.setFileName(String.format(
                "Prescription_%d_%s.pdf",
                prescription.getAppointment().getAppointmentId(),
                TimezoneUtil.instantToISO8601(TimezoneUtil.now()).substring(0, 8) + "_" +
                TimezoneUtil.instantToISO8601(TimezoneUtil.now()).substring(11, 19).replace(":", "")));
        document.setFileUrl(objectName);
        document.setDocumentType(Document.DocumentType.PRESCRIPTION);
        document.setFileSize((long) pdfBytes.length);
        document.setUploadedAt(TimezoneUtil.now());
        document.setIssuedAt(TimezoneUtil.now());
        documentRepository.save(document);
    }
}
