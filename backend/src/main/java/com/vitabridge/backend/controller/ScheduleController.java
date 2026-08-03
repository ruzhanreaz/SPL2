package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.*;
import com.vitabridge.backend.model.Doctor;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.DoctorRepository;
import com.vitabridge.backend.repository.UserRepository;
import com.vitabridge.backend.service.ScheduleService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/doctor/schedule")
public class ScheduleController {

    private static final Logger logger = LoggerFactory.getLogger(ScheduleController.class);

    @Autowired
    private ScheduleService scheduleService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DoctorRepository doctorRepository;

    /**
     * Get the currently authenticated doctor's ID
     */
    private Integer getCurrentDoctorId() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            logger.debug("Authenticated user email: {}", email);
            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            logger.debug("User found: {} with role: {}", user.getEmail(), user.getRole());
            Doctor doctor = doctorRepository.findByUser(user)
                    .orElseThrow(() -> new RuntimeException("Doctor profile not found"));
            logger.debug("Doctor found with ID: {}", doctor.getDoctorId());
            return doctor.getDoctorId();
        } catch (Exception e) {
            logger.error("Error getting current doctor ID: {}", e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Get complete schedule for the authenticated doctor
     * GET /api/doctor/schedule
     */
    @GetMapping
    public ResponseEntity<?> getDoctorSchedule() {
        try {
            Integer doctorId = getCurrentDoctorId();
            logger.info("Received request to get schedule for doctor ID: {}", doctorId);
            ScheduleResponseDTO schedule = scheduleService.getDoctorSchedule(doctorId);
            logger.info("Successfully retrieved schedule for doctor ID: {}", doctorId);
            return ResponseEntity.ok(schedule);
        } catch (RuntimeException e) {
            logger.error("Runtime error retrieving schedule: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            logger.error("Error retrieving schedule: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve schedule: " + e.getMessage()));
        }
    }

    /**
     * Add a new weekly schedule time slot for the authenticated doctor
     * POST /api/doctor/schedule/weekly
     */
    @PostMapping("/weekly")
    public ResponseEntity<?> addWeeklySchedule(@RequestBody AddWeeklyScheduleRequest request) {
        try {
            Integer doctorId = getCurrentDoctorId();
            logger.info("Received request to add weekly schedule for doctor ID: {}", doctorId);
            WeeklyScheduleDTO weeklySchedule = scheduleService.addWeeklySchedule(doctorId, request);
            logger.info("Successfully added weekly schedule for doctor ID: {}", doctorId);
            return ResponseEntity.status(HttpStatus.CREATED).body(weeklySchedule);
        } catch (IllegalArgumentException e) {
            logger.error("Validation error adding weekly schedule: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("VALIDATION_ERROR", e.getMessage()));
        } catch (Exception e) {
            logger.error("Error adding weekly schedule: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to add weekly schedule: " + e.getMessage()));
        }
    }

    /**
     * Update weekly schedule availability
     * PATCH /api/doctor/schedule/weekly/{weeklyScheduleId}
     */
    @PatchMapping("/weekly/{weeklyScheduleId}")
    public ResponseEntity<?> updateWeeklyScheduleAvailability(
            @PathVariable Integer weeklyScheduleId,
            @RequestParam Boolean isAvailable) {
        try {
            Integer doctorId = getCurrentDoctorId();
            logger.info("Received request to update availability for weekly schedule ID: {}", weeklyScheduleId);
            WeeklyScheduleDTO weeklySchedule = scheduleService.updateWeeklyScheduleAvailabilityForDoctor(
                    doctorId,
                    weeklyScheduleId,
                    isAvailable);
            logger.info("Successfully updated availability for weekly schedule ID: {}", weeklyScheduleId);
            return ResponseEntity.ok(weeklySchedule);
        } catch (RuntimeException e) {
            logger.error("Error updating weekly schedule ID {}: {}", weeklyScheduleId, e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            logger.error("Error updating weekly schedule ID {}: {}", weeklyScheduleId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to update weekly schedule: " + e.getMessage()));
        }
    }

    /**
     * Delete a weekly schedule time slot
     * DELETE /api/doctor/schedule/weekly/{weeklyScheduleId}
     */
    @DeleteMapping("/weekly/{weeklyScheduleId}")
    public ResponseEntity<?> deleteWeeklySchedule(@PathVariable Integer weeklyScheduleId) {
        try {
            logger.info("Received request to delete weekly schedule ID: {}", weeklyScheduleId);
            scheduleService.deleteWeeklySchedule(weeklyScheduleId);
            logger.info("Successfully deleted weekly schedule ID: {}", weeklyScheduleId);
            return ResponseEntity.ok(Map.of("message", "Weekly schedule deleted successfully"));
        } catch (RuntimeException e) {
            logger.error("Error deleting weekly schedule ID {}: {}", weeklyScheduleId, e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            logger.error("Error deleting weekly schedule ID {}: {}", weeklyScheduleId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to delete weekly schedule: " + e.getMessage()));
        }
    }

    /**
     * Add or update schedule override for a specific date for the authenticated
     * doctor
     * POST /api/doctor/schedule/override
     */
    @PostMapping("/override")
    public ResponseEntity<?> addOrUpdateScheduleOverride(@RequestBody AddScheduleOverrideRequest request) {
        try {
            Integer doctorId = getCurrentDoctorId();
            logger.info("Received request to add/update override for doctor ID: {}", doctorId);
            ScheduleOverrideDTO override = scheduleService.addOrUpdateScheduleOverride(doctorId, request);
            logger.info("Successfully added/updated override for doctor ID: {}", doctorId);
            return ResponseEntity.ok(override);
        } catch (IllegalArgumentException e) {
            logger.error("Validation error adding override: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("VALIDATION_ERROR", e.getMessage()));
        } catch (Exception e) {
            logger.error("Error adding override: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to update schedule override: " + e.getMessage()));
        }
    }

    /**
     * Delete a schedule override
     * DELETE /api/doctor/schedule/override/{overrideId}
     */
    @DeleteMapping("/override/{overrideId}")
    public ResponseEntity<?> deleteScheduleOverride(@PathVariable Integer overrideId) {
        try {
            logger.info("Received request to delete override ID: {}", overrideId);
            scheduleService.deleteScheduleOverride(overrideId);
            logger.info("Successfully deleted override ID: {}", overrideId);
            return ResponseEntity.ok(Map.of("message", "Schedule override deleted successfully"));
        } catch (RuntimeException e) {
            logger.error("Error deleting override ID {}: {}", overrideId, e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            logger.error("Error deleting override ID {}: {}", overrideId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to delete schedule override: " + e.getMessage()));
        }
    }

    /**
     * Get schedule overrides for a date range for the authenticated doctor
     * GET /api/doctor/schedule/overrides
     */
    @GetMapping("/overrides")
    public ResponseEntity<?> getScheduleOverrides(
            @RequestParam String startDate,
            @RequestParam String endDate) {
        try {
            Integer doctorId = getCurrentDoctorId();
            logger.info("Received request to get overrides for doctor ID: {}", doctorId);
            LocalDate start = LocalDate.parse(startDate);
            LocalDate end = LocalDate.parse(endDate);
            List<ScheduleOverrideDTO> overrides = scheduleService.getScheduleOverrides(doctorId, start, end);
            logger.info("Successfully retrieved overrides for doctor ID: {}", doctorId);
            return ResponseEntity.ok(overrides);
        } catch (Exception e) {
            logger.error("Error retrieving overrides: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve schedule overrides: " + e.getMessage()));
        }
    }

    /**
     * Backward-compatible route for older frontend clients.
     * GET /api/doctor/schedule/{doctorId}/overrides
     */
    @GetMapping("/{doctorId}/overrides")
    public ResponseEntity<?> getScheduleOverridesForDoctorId(
            @PathVariable Integer doctorId,
            @RequestParam String startDate,
            @RequestParam String endDate) {
        try {
            Integer currentDoctorId = getCurrentDoctorId();
            if (!currentDoctorId.equals(doctorId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ErrorResponse("FORBIDDEN", "You do not have permission to access this schedule"));
            }

            LocalDate start = LocalDate.parse(startDate);
            LocalDate end = LocalDate.parse(endDate);
            List<ScheduleOverrideDTO> overrides = scheduleService.getScheduleOverrides(currentDoctorId, start, end);
            return ResponseEntity.ok(overrides);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve schedule overrides: " + e.getMessage()));
        }
    }
}
