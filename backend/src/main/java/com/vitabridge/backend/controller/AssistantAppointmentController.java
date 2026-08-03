package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.*;
import com.vitabridge.backend.service.AssistantAppointmentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/assistant/appointments")
public class AssistantAppointmentController {

    @Autowired
    private AssistantAppointmentService assistantAppointmentService;

    @GetMapping("/list")
    public ResponseEntity<?> getDoctorAppointments(Authentication authentication) {
        try {
            String email = authentication.getName();
            List<AppointmentResponse> appointments = assistantAppointmentService.getDoctorAppointments(email);
            return ResponseEntity.ok(appointments);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve appointments: " + e.getMessage()));
        }
    }

    @PostMapping("/create")
    public ResponseEntity<?> createAppointment(@RequestBody CreateAppointmentRequest request,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            AppointmentResponse appointment = assistantAppointmentService.createAppointment(request, email);
            return ResponseEntity.status(HttpStatus.CREATED).body(appointment);
        } catch (DataIntegrityViolationException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new ErrorResponse(
                            "APPOINTMENT_SLOT_UNAVAILABLE",
                            "This appointment slot is already booked. Please choose another available time."));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to create appointment: " + e.getMessage()));
        }
    }

    @PutMapping("/{appointmentId}/confirm")
    public ResponseEntity<?> confirmAppointment(@PathVariable Integer appointmentId,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            AppointmentResponse appointment = assistantAppointmentService.confirmAppointment(appointmentId, email);
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
            String email = authentication.getName();
            AppointmentResponse appointment = assistantAppointmentService.confirmPayment(appointmentId, email);
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
            @RequestBody(required = false) Map<String, String> requestBody,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            String reason = requestBody != null ? requestBody.get("reason") : null;
            if (reason == null || reason.trim().isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new ErrorResponse("ERROR", "Rejection reason is required"));
            }
            AppointmentResponse appointment = assistantAppointmentService.rejectAppointment(appointmentId, email,
                    reason);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to reject appointment: " + e.getMessage()));
        }
    }

    @PutMapping("/{appointmentId}/cancel")
    public ResponseEntity<?> cancelInPersonAppointment(@PathVariable Integer appointmentId,
            @RequestBody(required = false) Map<String, String> requestBody,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            String reason = requestBody != null ? requestBody.get("reason") : "Cancelled by assistant";
            AppointmentResponse appointment = assistantAppointmentService.cancelInPersonAppointment(appointmentId,
                    email, reason);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to cancel appointment: " + e.getMessage()));
        }
    }

    @PutMapping("/{appointmentId}/complete")
    public ResponseEntity<?> markAsCompleted(@PathVariable Integer appointmentId,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            AppointmentResponse appointment = assistantAppointmentService.markAsCompleted(appointmentId, email);
            return ResponseEntity.ok(appointment);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to mark appointment as completed: " + e.getMessage()));
        }
    }
}
