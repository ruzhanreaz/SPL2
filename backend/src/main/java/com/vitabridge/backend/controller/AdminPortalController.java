package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.AssistantResponse;
import com.vitabridge.backend.dto.ErrorResponse;
import com.vitabridge.backend.service.AdminPortalService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminPortalController {

    @Autowired
    private AdminPortalService adminPortalService;

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        try {
            List<Map<String, Object>> users = adminPortalService.getAllUsers();
            return ResponseEntity.ok(users);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve users: " + e.getMessage()));
        }
    }

    @PutMapping("/users/{userId}/toggle-status")
    public ResponseEntity<?> toggleUserStatus(@PathVariable Integer userId, Authentication authentication) {
        try {
            return ResponseEntity.ok(adminPortalService.toggleUserStatus(userId, authentication.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to update user status: " + e.getMessage()));
        }
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<?> deleteUser(@PathVariable Integer userId, Authentication authentication) {
        try {
            return ResponseEntity.ok(adminPortalService.deleteUser(userId, authentication.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("BAD_REQUEST", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to delete user: " + e.getMessage()));
        }
    }

    @GetMapping("/appointments")
    public ResponseEntity<?> getAllAppointments() {
        try {
            return ResponseEntity.ok(adminPortalService.getAllAppointments());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve appointments: " + e.getMessage()));
        }
    }

    @GetMapping("/payments")
    public ResponseEntity<?> getAllPayments() {
        try {
            return ResponseEntity.ok(adminPortalService.getAllPayments());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve payments: " + e.getMessage()));
        }
    }

    @GetMapping("/assistants")
    public ResponseEntity<?> getAllAssistants() {
        try {
            List<AssistantResponse> assistants = adminPortalService.getAllAssistants();
            return ResponseEntity.ok(assistants);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve assistants: " + e.getMessage()));
        }
    }

    @PutMapping("/assistants/{assistantId}/assign-doctor/{doctorId}")
    public ResponseEntity<?> assignDoctor(@PathVariable Integer assistantId, @PathVariable Integer doctorId) {
        try {
            return ResponseEntity.ok(adminPortalService.assignAssistantDoctor(assistantId, doctorId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to assign doctor: " + e.getMessage()));
        }
    }

    @PutMapping("/assistants/{assistantId}/unassign")
    public ResponseEntity<?> unassignDoctor(@PathVariable Integer assistantId) {
        try {
            return ResponseEntity.ok(adminPortalService.unassignAssistantDoctor(assistantId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to unassign doctor: " + e.getMessage()));
        }
    }

    @GetMapping("/reports/daily")
    public ResponseEntity<?> getDailyReport(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) Integer doctorId
    ) {
        try {
            LocalDate reportDate = date != null ? date : LocalDate.now();
            return ResponseEntity.ok(adminPortalService.getDailyReport(reportDate, doctorId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("BAD_REQUEST", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve daily report: " + e.getMessage()));
        }
    }

    @GetMapping("/reports/daily/pdf")
    public ResponseEntity<?> getDailyReportPdf(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) Integer doctorId,
            Authentication authentication
    ) {
        try {
            LocalDate reportDate = date != null ? date : LocalDate.now();
            byte[] pdfBytes = adminPortalService.getDailyReportPdf(reportDate, doctorId, authentication.getName());

            String fileName = doctorId != null
                ? "daily-report-" + reportDate + "-doctor-" + doctorId + ".pdf"
                : "daily-report-" + reportDate + ".pdf";

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=" + fileName)
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(pdfBytes);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse("BAD_REQUEST", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to generate report PDF: " + e.getMessage()));
        }
    }
}
