package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.*;
import com.vitabridge.backend.service.ScheduleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assistant")
public class AssistantManagementController {

    @Autowired
    private ScheduleService scheduleService;

    @GetMapping("/schedule")
    public ResponseEntity<?> getDoctorSchedule(Authentication authentication) {
        try {
            String email = authentication.getName();
            // Assistant needs to get their assigned doctor's schedule
            // We'll modify ScheduleService to accept assistant email
            ScheduleResponseDTO schedule = scheduleService.getScheduleForAssistant(email);
            return ResponseEntity.ok(schedule);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve schedule: " + e.getMessage()));
        }
    }

    @PostMapping("/schedule/weekly")
    public ResponseEntity<?> addWeeklySchedule(@RequestBody AddWeeklyScheduleRequest request,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            WeeklyScheduleDTO schedule = scheduleService.addWeeklyScheduleForAssistant(email, request);
            return ResponseEntity.status(HttpStatus.CREATED).body(schedule);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to add weekly schedule: " + e.getMessage()));
        }
    }

    @PutMapping("/schedule/weekly/{weeklyScheduleId}/toggle")
    public ResponseEntity<?> toggleWeeklySchedule(@PathVariable Integer weeklyScheduleId,
            @RequestBody ToggleAvailabilityRequest request,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            WeeklyScheduleDTO schedule = scheduleService.updateWeeklyScheduleAvailabilityForAssistant(
                    email,
                    weeklyScheduleId,
                    request.getIsAvailable());
            return ResponseEntity.ok(schedule);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to update schedule: " + e.getMessage()));
        }
    }

    @DeleteMapping("/schedule/weekly/{weeklyScheduleId}")
    public ResponseEntity<?> deleteWeeklySchedule(@PathVariable Integer weeklyScheduleId,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            scheduleService.deleteWeeklyScheduleForAssistant(email, weeklyScheduleId);
            return ResponseEntity.ok(new SuccessResponse("SUCCESS", "Weekly schedule deleted successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to delete schedule: " + e.getMessage()));
        }
    }

    @PostMapping("/schedule/override")
    public ResponseEntity<?> addOrUpdateScheduleOverride(@RequestBody AddScheduleOverrideRequest request,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            ScheduleOverrideDTO override = scheduleService.addOrUpdateScheduleOverrideForAssistant(email, request);
            return ResponseEntity.ok(override);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to update schedule override: " + e.getMessage()));
        }
    }

    @DeleteMapping("/schedule/override/{overrideId}")
    public ResponseEntity<?> deleteScheduleOverride(@PathVariable Integer overrideId,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            scheduleService.deleteScheduleOverrideForAssistant(email, overrideId);
            return ResponseEntity.ok(new SuccessResponse("SUCCESS", "Schedule override deleted successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to delete schedule override: " + e.getMessage()));
        }
    }

}
