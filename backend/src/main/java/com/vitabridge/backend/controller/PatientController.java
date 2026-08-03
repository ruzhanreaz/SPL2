package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.DoctorResponse;
import com.vitabridge.backend.dto.AiDoctorSuggestionRequest;
import com.vitabridge.backend.dto.AiDoctorSuggestionResponse;
import com.vitabridge.backend.dto.ErrorResponse;
import com.vitabridge.backend.dto.ScheduleResponseDTO;
import com.vitabridge.backend.service.AiDoctorConversationService;
import com.vitabridge.backend.service.DoctorService;
import com.vitabridge.backend.service.ScheduleService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/patient")
public class PatientController {

    @Autowired
    private DoctorService doctorService;

    @Autowired
    private ScheduleService scheduleService;

    @Autowired
    private AiDoctorConversationService aiDoctorSuggestionService;

    @GetMapping("/doctors")
    public ResponseEntity<?> getActiveDoctors() {
        try {
            List<DoctorResponse> doctors = doctorService.getAllDoctors();
            // Filter to return only active doctors for patients
            List<DoctorResponse> activeDoctors = doctors.stream()
                    .filter(doctor -> Boolean.TRUE.equals(doctor.getIsActive()))
                    .collect(Collectors.toList());
            return ResponseEntity.ok(activeDoctors);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve doctors: " + e.getMessage()));
        }
    }

    @GetMapping("/doctors/{id}")
    public ResponseEntity<?> getDoctorById(@PathVariable Integer id) {
        try {
            DoctorResponse doctor = doctorService.getDoctorById(id);
            // Only return if the doctor is active
            if (!Boolean.TRUE.equals(doctor.getIsActive())) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ErrorResponse("NOT_FOUND", "Doctor not found or not available"));
            }
            return ResponseEntity.ok(doctor);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve doctor: " + e.getMessage()));
        }
    }

    @GetMapping("/doctors/{id}/schedule")
    public ResponseEntity<?> getDoctorSchedule(@PathVariable Integer id) {
        try {
            ScheduleResponseDTO schedule = scheduleService.getDoctorSchedule(id);
            return ResponseEntity.ok(schedule);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve schedule: " + e.getMessage()));
        }
    }

    @PostMapping("/ai-health-checker/suggestions")
    public ResponseEntity<AiDoctorSuggestionResponse> getAiDoctorSuggestions(
            @Valid @RequestBody AiDoctorSuggestionRequest request) {
        AiDoctorSuggestionResponse response = aiDoctorSuggestionService.suggestForSymptoms(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/ai-health-checker/status")
    public ResponseEntity<Map<String, Object>> getAiHealthCheckerStatus() {
        return ResponseEntity.ok(aiDoctorSuggestionService.getAiEngineStatus());
    }
}
