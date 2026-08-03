package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.ComplaintDTO;
import com.vitabridge.backend.model.Admin;
import com.vitabridge.backend.model.Complaint;
import com.vitabridge.backend.model.Notification;
import com.vitabridge.backend.model.Patient;
import com.vitabridge.backend.repository.AdminRepository;
import com.vitabridge.backend.repository.ComplaintRepository;
import com.vitabridge.backend.repository.PatientRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ComplaintService {

    @Autowired
    private ComplaintRepository complaintRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private AdminRepository adminRepository;

    @Autowired
    private NotificationService notificationService;

    @Transactional
    public ComplaintDTO submitComplaintForUser(Integer userId, String title, String message) {
        Patient patient = patientRepository.findByUserUserId(userId)
                .orElseThrow(() -> new RuntimeException("Patient not found"));

        return submitComplaint(patient.getPatientId(), title, message);
    }

    @Transactional
    public ComplaintDTO submitComplaint(Integer patientId, String title, String message) {
        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> new RuntimeException("Patient not found"));

        Complaint complaint = new Complaint();
        complaint.setPatient(patient);
        complaint.setTitle(title.trim());
        complaint.setMessage(message.trim());
        complaint.setStatus("PENDING");

        complaint = complaintRepository.save(complaint);

        final Complaint savedComplaint = complaint;
        adminRepository.findAll().stream()
            .map(Admin::getUser)
            .filter(user -> user != null && Boolean.TRUE.equals(user.getIsActive()))
            .forEach(adminUser -> notificationService.createNotificationWithEntity(
                adminUser,
                "New Complaint Submitted",
                String.format("A new complaint was submitted by %s.",
                    savedComplaint.getPatient().getUser().getFirstName() + " " +
                        savedComplaint.getPatient().getUser().getLastName()),
                Notification.NotificationType.SYSTEM_COMPLAINT,
                "COMPLAINT",
                savedComplaint.getComplaintId()));

        return toDTO(complaint);
    }

    @Transactional(readOnly = true)
    public List<ComplaintDTO> getAllComplaints() {
        return complaintRepository.findAllByOrderByCreatedAtDesc()
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ComplaintDTO> getPatientComplaints(Integer patientId) {
        return complaintRepository.findByPatientIdOrderByCreatedAtDesc(patientId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ComplaintDTO> getPatientComplaintsForUser(Integer userId) {
        Patient patient = patientRepository.findByUserUserId(userId)
                .orElseThrow(() -> new RuntimeException("Patient not found"));

        return getPatientComplaints(patient.getPatientId());
    }

    @Transactional
    public ComplaintDTO markReviewed(Integer complaintId) {
        Complaint complaint = complaintRepository.findById(complaintId)
                .orElseThrow(() -> new RuntimeException("Complaint not found"));
        complaint.setStatus("REVIEWED");
        Complaint reviewedComplaint = complaintRepository.save(complaint);

        notificationService.createNotificationWithEntity(
            reviewedComplaint.getPatient().getUser(),
            "Complaint Reviewed",
            String.format("Your complaint \"%s\" has been reviewed by our support team.",
                reviewedComplaint.getTitle()),
            Notification.NotificationType.SYSTEM,
            "COMPLAINT",
            reviewedComplaint.getComplaintId());

        return toDTO(reviewedComplaint);
    }

    @Transactional
    public void deleteComplaint(Integer complaintId) {
        complaintRepository.deleteById(complaintId);
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getStats() {
        return Map.of(
                "total",    complaintRepository.count(),
                "pending",  complaintRepository.countByStatus("PENDING"),
                "reviewed", complaintRepository.countByStatus("REVIEWED")
        );
    }

    private ComplaintDTO toDTO(Complaint c) {
        ComplaintDTO dto = new ComplaintDTO();
        dto.setComplaintId(c.getComplaintId());
        dto.setPatientId(c.getPatient().getPatientId());
        dto.setPatientName(c.getPatient().getUser().getFirstName() + " " + c.getPatient().getUser().getLastName());
        dto.setPatientEmail(c.getPatient().getUser().getEmail());
        dto.setPatientPhoneNumber(c.getPatient().getUser().getPhoneNumber());
        dto.setTitle(c.getTitle());
        dto.setMessage(c.getMessage());
        dto.setStatus(c.getStatus());
        dto.setCreatedAt(c.getCreatedAt());
        return dto;
    }
}
