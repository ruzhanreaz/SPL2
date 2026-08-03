package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.AddAdminRequest;
import com.vitabridge.backend.dto.AdminResponse;
import com.vitabridge.backend.dto.ErrorResponse;
import com.vitabridge.backend.service.AdminService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/admin/admins")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @GetMapping
    public ResponseEntity<?> getAllAdmins() {
        try {
            List<AdminResponse> admins = adminService.getAllAdmins();
            return ResponseEntity.ok(admins);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve admins: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getAdminById(@PathVariable Integer id) {
        try {
            AdminResponse admin = adminService.getAdminById(id);
            return ResponseEntity.ok(admin);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve admin: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAdmin(@PathVariable Integer id) {
        try {
            adminService.deleteAdmin(id);
            return ResponseEntity.ok(Map.of("message", "Admin deleted successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to delete admin: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/toggle-status")
    public ResponseEntity<?> toggleAdminStatus(@PathVariable Integer id) {
        try {
            AdminResponse admin = adminService.toggleAdminStatus(id);
            return ResponseEntity.ok(admin);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("NOT_FOUND", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to toggle admin status: " + e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createAdmin(@Valid @RequestBody AddAdminRequest request) {
        try {
            AdminResponse admin = adminService.createAdmin(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(admin);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("CREATE_FAILED", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to create admin: " + e.getMessage()));
        }
    }
}
