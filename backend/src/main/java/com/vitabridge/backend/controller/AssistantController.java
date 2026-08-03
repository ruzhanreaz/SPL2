package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.AddAssistantRequest;
import com.vitabridge.backend.dto.AssistantResponse;
import com.vitabridge.backend.dto.ErrorResponse;
import com.vitabridge.backend.model.Doctor;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.DoctorRepository;
import com.vitabridge.backend.repository.UserRepository;
import com.vitabridge.backend.service.AssistantService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/doctor/assistants")
public class AssistantController {

    @Autowired
    private AssistantService assistantService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DoctorRepository doctorRepository;

    private Integer getCurrentDoctorId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Doctor doctor = doctorRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("Doctor profile not found"));
        return doctor.getDoctorId();
    }

    @GetMapping
    public ResponseEntity<?> getAllAssistants() {
        try {
            Integer doctorId = getCurrentDoctorId();
            List<AssistantResponse> assistants = assistantService.getAllAssistantsByDoctor(doctorId);
            return ResponseEntity.ok(assistants);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve assistants: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getAssistantById(@PathVariable Integer id) {
        try {
            Integer doctorId = getCurrentDoctorId();
            AssistantResponse assistant = assistantService.getAssistantById(id);

            if (!assistant.getDoctorId().equals(doctorId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ErrorResponse("FORBIDDEN", "You do not have permission to access this assistant"));
            }

            return ResponseEntity.ok(assistant);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve assistant: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAssistant(@PathVariable Integer id) {
        try {
            Integer doctorId = getCurrentDoctorId();
            assistantService.deleteAssistant(id, doctorId);
            return ResponseEntity.ok(Map.of("message", "Assistant deleted successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to delete assistant: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/toggle-status")
    public ResponseEntity<?> toggleAssistantStatus(@PathVariable Integer id) {
        try {
            Integer doctorId = getCurrentDoctorId();
            AssistantResponse assistant = assistantService.toggleAssistantStatus(id, doctorId);
            return ResponseEntity.ok(assistant);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to toggle assistant status: " + e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createAssistant(@Valid @RequestBody AddAssistantRequest request) {
        try {
            Integer doctorId = getCurrentDoctorId();
            AssistantResponse assistant = assistantService.createAssistant(request, doctorId);
            return ResponseEntity.status(HttpStatus.CREATED).body(assistant);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("CREATE_FAILED", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to create assistant: " + e.getMessage()));
        }
    }
}
