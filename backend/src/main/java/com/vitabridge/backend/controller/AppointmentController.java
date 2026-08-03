package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.AppointmentRequest;
import com.vitabridge.backend.dto.AppointmentResponse;
import com.vitabridge.backend.dto.ConsultationMessageRequest;
import com.vitabridge.backend.dto.ConsultationMessageResponse;
import com.vitabridge.backend.dto.AvailableTimeSlot;
import com.vitabridge.backend.dto.ErrorResponse;
import com.vitabridge.backend.dto.PrescriptionRequest;
import com.vitabridge.backend.dto.RatingRequest;
import com.vitabridge.backend.model.Document;
import com.vitabridge.backend.service.AppointmentService;
import com.vitabridge.backend.service.ConsultationAccessService;
import com.vitabridge.backend.service.ConsultationMessageService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {

    @Autowired
    private AppointmentService appointmentService;

    @Autowired
    private ConsultationMessageService consultationMessageService;

    @Autowired
    private ConsultationAccessService consultationAccessService;

    @GetMapping("/patient/my-appointments")
    public ResponseEntity<?> getPatientAppointments(Authentication authentication) {
        try {
            String email = authentication.getName();
            List<AppointmentResponse> appointments = appointmentService.getPatientAppointments(email);
            return ResponseEntity.ok(appointments);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve appointments: " + e.getMessage()));
        }
    }

    @GetMapping("/doctor/my-appointments")
    public ResponseEntity<?> getDoctorAppointments(Authentication authentication) {
        try {
            String email = authentication.getName();
            List<AppointmentResponse> appointments = appointmentService.getDoctorAppointments(email);
            return ResponseEntity.ok(appointments);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve appointments: " + e.getMessage()));
        }
    }

    @PostMapping("/book")
    public ResponseEntity<?> bookAppointment(@RequestBody AppointmentRequest request,
            Authentication authentication) {
        try {
            String patientEmail = authentication.getName();
            AppointmentResponse appointment = appointmentService.bookAppointment(patientEmail, request);
            return ResponseEntity.status(HttpStatus.CREATED).body(appointment);
        } catch (DataIntegrityViolationException e) {
            String conflictMessage = resolveBookingConflictMessage(e);
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new ErrorResponse("APPOINTMENT_SLOT_UNAVAILABLE", conflictMessage));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to book appointment: " + e.getMessage()));
        }
    }

    private String resolveBookingConflictMessage(DataIntegrityViolationException ex) {
        if (hasConstraintInCauseChain(ex, "uk_appointment_active_slot")) {
            return "This appointment slot was just booked by another patient. Please choose another available slot.";
        }

        String rawMessage = ex.getMessage();
        if (rawMessage == null || rawMessage.isBlank()) {
            return "Your booking could not be completed because this slot is no longer available. Please choose another slot.";
        }

        String normalized = rawMessage.toLowerCase();
        if (normalized.contains("duplicate key") || normalized.contains("constraint")) {
            return "Your booking could not be completed because this slot is no longer available. Please choose another slot.";
        }

        return rawMessage;
    }

    private boolean hasConstraintInCauseChain(Throwable throwable, String constraintName) {
        Throwable current = throwable;
        String target = constraintName.toLowerCase();

        while (current != null) {
            String message = current.getMessage();
            if (message != null && message.toLowerCase().contains(target)) {
                return true;
            }
            current = current.getCause();
        }

        return false;
    }

    @PostMapping("/{appointmentId}/pay")
    public ResponseEntity<?> initiateAppointmentPayment(@PathVariable Integer appointmentId,
            @RequestBody(required = false) Map<String, String> requestBody,
            Authentication authentication) {
        try {
            String patientEmail = authentication.getName();
            String clientOrigin = requestBody != null ? requestBody.get("clientOrigin") : null;
            String paymentUrl = appointmentService.initiateAppointmentPayment(appointmentId, patientEmail, clientOrigin);
            return ResponseEntity.ok(Map.of("paymentUrl", paymentUrl));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to initiate payment: " + e.getMessage()));
        }
    }

    @PutMapping("/{appointmentId}/cancel")
    public ResponseEntity<?> cancelAppointment(@PathVariable Integer appointmentId,
            @RequestBody(required = false) Map<String, String> requestBody,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            String reason = requestBody != null ? requestBody.get("reason") : null;
            AppointmentResponse appointment = appointmentService.cancelAppointment(appointmentId, email, reason);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to cancel appointment: " + e.getMessage()));
        }
    }

    @GetMapping("/available-slots")
    public ResponseEntity<?> getAvailableTimeSlots(
            @RequestParam Integer doctorId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        try {
            List<AvailableTimeSlot> timeSlots = appointmentService.getAvailableTimeSlots(doctorId, date);
            return ResponseEntity.ok(timeSlots);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve available time slots: " + e.getMessage()));
        }
    }

    @PutMapping("/{appointmentId}/confirm")
    public ResponseEntity<?> confirmAppointment(@PathVariable Integer appointmentId,
            Authentication authentication) {
        try {
            String doctorEmail = authentication.getName();
            AppointmentResponse appointment = appointmentService.confirmAppointment(appointmentId, doctorEmail);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to confirm appointment: " + e.getMessage()));
        }
    }

    @PutMapping("/{appointmentId}/confirm-payment")
    public ResponseEntity<?> confirmPayment(@PathVariable Integer appointmentId,
            Authentication authentication) {
        try {
            String doctorEmail = authentication.getName();
            AppointmentResponse appointment = appointmentService.confirmPayment(appointmentId, doctorEmail);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to confirm payment: " + e.getMessage()));
        }
    }

    @PutMapping("/{appointmentId}/reject")
    public ResponseEntity<?> rejectAppointment(@PathVariable Integer appointmentId,
            @RequestBody Map<String, String> requestBody,
            Authentication authentication) {
        try {
            String doctorEmail = authentication.getName();
            String reason = requestBody.get("reason");
            if (reason == null || reason.trim().isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new ErrorResponse("ERROR", "Rejection reason is required"));
            }
            AppointmentResponse appointment = appointmentService.rejectAppointment(appointmentId, doctorEmail, reason);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to reject appointment: " + e.getMessage()));
        }
    }

    @GetMapping("/{appointmentId}/messages")
    public ResponseEntity<?> getConsultationMessages(@PathVariable Integer appointmentId,
            Authentication authentication) {
        try {
            String requesterEmail = authentication.getName();
            List<ConsultationMessageResponse> messages = consultationMessageService.getMessages(
                    appointmentId,
                    requesterEmail);
            return ResponseEntity.ok(messages);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve consultation messages: " + e.getMessage()));
        }
    }

    @PostMapping("/{appointmentId}/messages")
    public ResponseEntity<?> sendConsultationMessage(
            @PathVariable Integer appointmentId,
            @RequestBody ConsultationMessageRequest request,
            Authentication authentication) {
        try {
            String requesterEmail = authentication.getName();
            ConsultationMessageResponse message = consultationMessageService.createMessage(
                    appointmentId,
                    requesterEmail,
                    request);
            return ResponseEntity.status(HttpStatus.CREATED).body(message);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to send consultation message: " + e.getMessage()));
        }
    }

    @PostMapping("/{appointmentId}/document-access/grant")
    public ResponseEntity<?> grantDocumentAccess(
            @PathVariable Integer appointmentId,
            @RequestBody(required = false) Map<String, Object> requestBody,
            Authentication authentication) {
        try {
            String requesterEmail = authentication.getName();
            Integer durationMinutes = null;
            List<Integer> selectedDocumentIds = List.of();

            if (requestBody != null) {
                Object durationObj = requestBody.get("durationMinutes");
                if (durationObj instanceof Number number) {
                    durationMinutes = number.intValue();
                }

                Object selectedObj = requestBody.get("selectedDocumentIds");
                if (selectedObj instanceof List<?> rawList) {
                    selectedDocumentIds = rawList.stream()
                            .filter(Number.class::isInstance)
                            .map(Number.class::cast)
                            .map(Number::intValue)
                            .toList();
                }
            }

            return ResponseEntity.ok(
                    consultationAccessService.grantAccess(
                            appointmentId,
                            requesterEmail,
                            durationMinutes,
                            selectedDocumentIds));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to grant document access: " + e.getMessage()));
        }
    }

    @PostMapping("/{appointmentId}/document-access/revoke")
    public ResponseEntity<?> revokeDocumentAccess(
            @PathVariable Integer appointmentId,
            Authentication authentication) {
        try {
            String requesterEmail = authentication.getName();
            return ResponseEntity.ok(consultationAccessService.revokeAccess(appointmentId, requesterEmail));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to revoke document access: " + e.getMessage()));
        }
    }

    @GetMapping("/patient/document-access")
    public ResponseEntity<?> getPatientDocumentAccess(Authentication authentication) {
        try {
            String requesterEmail = authentication.getName();
            return ResponseEntity.ok(consultationAccessService.getPatientAccessGrants(requesterEmail));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to load document access list: " + e.getMessage()));
        }
    }

    @GetMapping("/{appointmentId}/patient/access-status")
    public ResponseEntity<?> getPatientAccessStatus(
            @PathVariable Integer appointmentId,
            Authentication authentication) {
        try {
            String requesterEmail = authentication.getName();
            return ResponseEntity.ok(consultationAccessService.getAccessStatusForDoctor(appointmentId, requesterEmail));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to load access status: " + e.getMessage()));
        }
    }

    @GetMapping("/{appointmentId}/patient/documents")
    public ResponseEntity<?> getPatientDocumentsForDoctor(
            @PathVariable Integer appointmentId,
            Authentication authentication) {
        try {
            String requesterEmail = authentication.getName();
            return ResponseEntity.ok(consultationAccessService.getPatientDocumentsForDoctor(appointmentId, requesterEmail));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to load patient documents: " + e.getMessage()));
        }
    }

                @GetMapping("/{appointmentId}/patient/documents/{documentId}/open")
                public ResponseEntity<?> openPatientDocumentForDoctor(
                    @PathVariable Integer appointmentId,
                    @PathVariable Integer documentId,
                    Authentication authentication) {
                try {
                    String requesterEmail = authentication.getName();
                    Document document = consultationAccessService.getAuthorizedPatientDocumentForDoctor(
                        appointmentId,
                        documentId,
                        requesterEmail);

                    byte[] fileBytes = consultationAccessService.loadDocumentBytesForDoctor(document);
                    String contentType = consultationAccessService.resolveDocumentContentTypeForDoctor(document);
                    String safeFileName = document.getFileName() == null
                        ? "patient-document"
                        : document.getFileName().replace("\"", "");

                    return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + safeFileName + "\"")
                        .contentType(MediaType.parseMediaType(contentType))
                        .body(fileBytes);
                } catch (RuntimeException e) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new ErrorResponse("ERROR", e.getMessage()));
                } catch (Exception e) {
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(new ErrorResponse("ERROR", "Failed to open patient document: " + e.getMessage()));
                }
                }

    @PostMapping("/{appointmentId}/prescription")
    public ResponseEntity<?> createPrescription(
            @PathVariable Integer appointmentId,
            @RequestBody PrescriptionRequest request,
            Authentication authentication) {
        try {
            String requesterEmail = authentication.getName();
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(consultationAccessService.createPrescription(appointmentId, requesterEmail, request));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to create prescription: " + e.getMessage()));
        }
    }

    @PostMapping("/{appointmentId}/prescription/preview")
    public ResponseEntity<?> previewPrescription(
            @PathVariable Integer appointmentId,
            @RequestBody PrescriptionRequest request,
            Authentication authentication) {
        try {
            String requesterEmail = authentication.getName();
            byte[] pdf = consultationAccessService.previewPrescriptionPdf(appointmentId, requesterEmail, request);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "inline; filename=prescription-preview-" + appointmentId + ".pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(pdf);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to preview prescription: " + e.getMessage()));
        }
    }

    @GetMapping("/{appointmentId}/prescription")
    public ResponseEntity<?> getLatestPrescription(
            @PathVariable Integer appointmentId,
            Authentication authentication) {
        try {
            String requesterEmail = authentication.getName();
            return ResponseEntity.ok(consultationAccessService.getLatestPrescription(appointmentId, requesterEmail));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to load prescription: " + e.getMessage()));
        }
    }

    @PostMapping("/{appointmentId}/rate")
    public ResponseEntity<?> rateAppointment(
            @PathVariable Integer appointmentId,
            @Valid @RequestBody RatingRequest request,
            Authentication authentication) {
        try {
            String patientEmail = authentication.getName();
            AppointmentResponse appointment = appointmentService.submitRating(appointmentId, patientEmail, request);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to submit rating: " + e.getMessage()));
        }
    }
}
