package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.CallAvailabilityRequest;
import com.vitabridge.backend.dto.ErrorResponse;
import com.vitabridge.backend.service.DoctorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/doctor/call-availability")
public class DoctorCallAvailabilityController {

    @Autowired
    private DoctorService doctorService;

    @GetMapping
    public ResponseEntity<?> getCallAvailability(Authentication authentication) {
        try {
            return ResponseEntity.ok(Map.of(
                    "isAvailableForCalls",
                    doctorService.getDoctorByEmail(authentication.getName()).getIsAvailableForCalls()));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(new ErrorResponse("ERROR", e.getReason()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve call availability: " + e.getMessage()));
        }
    }

    @PutMapping
    public ResponseEntity<?> updateCallAvailability(
            Authentication authentication,
            @RequestBody CallAvailabilityRequest request) {
        try {
            return ResponseEntity.ok(doctorService.setCallAvailability(
                    authentication.getName(),
                    request != null ? request.getIsAvailableForCalls() : null));
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(new ErrorResponse("ERROR", e.getReason()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to update call availability: " + e.getMessage()));
        }
    }
}