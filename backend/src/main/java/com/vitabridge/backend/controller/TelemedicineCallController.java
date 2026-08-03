package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.ErrorResponse;
import com.vitabridge.backend.dto.TelemedicineCallActionRequest;
import com.vitabridge.backend.dto.TelemedicineCallEventResponse;
import com.vitabridge.backend.dto.TelemedicineCallInitiateRequest;
import com.vitabridge.backend.service.TelemedicineCallService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/telemedicine/calls")
public class TelemedicineCallController {

    @Autowired
    private TelemedicineCallService telemedicineCallService;

    @PostMapping("/initiate")
    public ResponseEntity<?> initiateCall(
            @Valid @RequestBody TelemedicineCallInitiateRequest request,
            Authentication authentication) {
        try {
            TelemedicineCallEventResponse response = telemedicineCallService.initiateCall(request, authentication.getName());
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(new ErrorResponse("ERROR", e.getReason()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to initiate call: " + e.getMessage()));
        }
    }

    @PostMapping("/{callId}/accept")
    public ResponseEntity<?> acceptCall(
            @PathVariable Long callId,
            Authentication authentication) {
        try {
            TelemedicineCallEventResponse response = telemedicineCallService.acceptCall(callId, authentication.getName());
            return ResponseEntity.ok(response);
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(new ErrorResponse("ERROR", e.getReason()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to accept call: " + e.getMessage()));
        }
    }

    @PostMapping("/{callId}/decline")
    public ResponseEntity<?> declineCall(
            @PathVariable Long callId,
            @RequestBody(required = false) TelemedicineCallActionRequest request,
            Authentication authentication) {
        try {
            TelemedicineCallEventResponse response = telemedicineCallService.declineCall(callId, authentication.getName(), request);
            return ResponseEntity.ok(response);
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(new ErrorResponse("ERROR", e.getReason()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to decline call: " + e.getMessage()));
        }
    }

    @PostMapping("/{callId}/end")
    public ResponseEntity<?> endCall(
            @PathVariable Long callId,
            @RequestBody(required = false) TelemedicineCallActionRequest request,
            Authentication authentication) {
        try {
            TelemedicineCallEventResponse response = telemedicineCallService.endCall(callId, authentication.getName(), request);
            return ResponseEntity.ok(response);
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(new ErrorResponse("ERROR", e.getReason()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to end call: " + e.getMessage()));
        }
    }

    @PutMapping("/{callId}/heartbeat")
    public ResponseEntity<?> heartbeat(
            @PathVariable Long callId,
            Authentication authentication) {
        try {
            TelemedicineCallEventResponse response = telemedicineCallService.heartbeat(callId, authentication.getName());
            return ResponseEntity.ok(response);
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(new ErrorResponse("ERROR", e.getReason()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to refresh call heartbeat: " + e.getMessage()));
        }
    }

    @GetMapping("/appointments/{appointmentId}/status")
    public ResponseEntity<?> getCallStatus(
            @PathVariable Integer appointmentId,
            Authentication authentication) {
        try {
            TelemedicineCallEventResponse response = telemedicineCallService.getStatus(appointmentId, authentication.getName());
            return ResponseEntity.ok(response);
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(new ErrorResponse("ERROR", e.getReason()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve call status: " + e.getMessage()));
        }
    }
}