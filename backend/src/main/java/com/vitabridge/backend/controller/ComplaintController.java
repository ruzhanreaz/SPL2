package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.ComplaintDTO;
import com.vitabridge.backend.dto.ComplaintRequest;
import com.vitabridge.backend.dto.ErrorResponse;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.UserRepository;
import com.vitabridge.backend.service.ComplaintService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/complaints")
public class ComplaintController {

    @Autowired
    private ComplaintService complaintService;

    @Autowired
    private UserRepository userRepository;

    // Patient endpoints

    @PostMapping
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<?> submitComplaint(
            Authentication authentication,
            @Valid @RequestBody ComplaintRequest request) {
        try {
            String email = authentication.getName();
            User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
            ComplaintDTO result = complaintService.submitComplaintForUser(
                    user.getUserId(),
                    request.getTitle(),
                    request.getMessage()
            );
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("INVALID_INPUT", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to submit complaint: " + e.getMessage()));
        }
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<?> myComplaints(Authentication authentication) {
        try {
            String email = authentication.getName();
            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            List<ComplaintDTO> complaints = complaintService.getPatientComplaintsForUser(user.getUserId());
            return ResponseEntity.ok(complaints);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("INVALID_INPUT", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve complaints: " + e.getMessage()));
        }
    }

    // Admin endpoints

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getAllComplaints() {
        try {
            List<ComplaintDTO> complaints = complaintService.getAllComplaints();
            return ResponseEntity.ok(complaints);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve complaints: " + e.getMessage()));
        }
    }

    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getStats() {
        try {
            Map<String, Long> stats = complaintService.getStats();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve stats: " + e.getMessage()));
        }
    }

    @PatchMapping("/{id}/review")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> markReviewed(@PathVariable Integer id) {
        try {
            ComplaintDTO result = complaintService.markReviewed(id);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to mark complaint as reviewed: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteComplaint(@PathVariable Integer id) {
        try {
            complaintService.deleteComplaint(id);
            return ResponseEntity.ok(Map.of("message", "Complaint deleted successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to delete complaint: " + e.getMessage()));
        }
    }
}
