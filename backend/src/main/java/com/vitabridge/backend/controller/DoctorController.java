package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.AddDoctorRequest;
import com.vitabridge.backend.dto.DoctorResponse;
import com.vitabridge.backend.dto.ErrorResponse;
import com.vitabridge.backend.service.DoctorService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/admin/doctors")
public class DoctorController {

    @Autowired
    private DoctorService doctorService;

    @GetMapping
    public ResponseEntity<?> getAllDoctors() {
        try {
            List<DoctorResponse> doctors = doctorService.getAllDoctors();
            return ResponseEntity.ok(doctors);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve doctors: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getDoctorById(@PathVariable Integer id) {
        try {
            DoctorResponse doctor = doctorService.getDoctorById(id);
            return ResponseEntity.ok(doctor);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve doctor: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDoctor(@PathVariable Integer id) {
        try {
            doctorService.deleteDoctor(id);
            return ResponseEntity.ok(Map.of("message", "Doctor deleted successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to delete doctor: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/toggle-status")
    public ResponseEntity<?> toggleDoctorStatus(@PathVariable Integer id) {
        try {
            DoctorResponse doctor = doctorService.toggleDoctorStatus(id);
            return ResponseEntity.ok(doctor);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to toggle doctor status: " + e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createDoctor(@Valid @RequestBody AddDoctorRequest request) {
        try {
            DoctorResponse doctor = doctorService.createDoctor(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(doctor);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("CREATE_FAILED", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to create doctor: " + e.getMessage()));
        }
    }
}
