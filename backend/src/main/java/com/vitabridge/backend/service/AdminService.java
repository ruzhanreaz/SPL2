package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.AddAdminRequest;
import com.vitabridge.backend.dto.AdminResponse;
import com.vitabridge.backend.model.Admin;
import com.vitabridge.backend.model.Role;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.AdminRepository;
import com.vitabridge.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AdminService {

    @Autowired
    private AdminRepository adminRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AdminLogService adminLogService;

    public List<AdminResponse> getAllAdmins() {
        List<Admin> admins = adminRepository.findAll();
        return admins.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    public AdminResponse getAdminById(Integer adminId) {
        Admin admin = adminRepository.findById(adminId)
                .orElseThrow(() -> new RuntimeException("Admin not found with id: " + adminId));
        return convertToResponse(admin);
    }

    @Transactional
    public void deleteAdmin(Integer adminId) {
        Admin admin = adminRepository.findById(adminId)
                .orElseThrow(() -> new RuntimeException("Admin not found with id: " + adminId));

        String currentAdminEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        String deletedAdminEmail = admin.getUser().getEmail();

        adminRepository.delete(admin);

        adminLogService.logAction(currentAdminEmail, "DELETE_ADMIN",
                "Deleted admin: " + deletedAdminEmail, "ADMIN", adminId);
    }

    @Transactional
    public AdminResponse toggleAdminStatus(Integer adminId) {
        Admin admin = adminRepository.findById(adminId)
                .orElseThrow(() -> new RuntimeException("Admin not found with id: " + adminId));

        User user = admin.getUser();
        user.setIsActive(!user.getIsActive());
        userRepository.save(user);

        String currentAdminEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        String action = user.getIsActive() ? "ACTIVATE_ADMIN" : "DEACTIVATE_ADMIN";
        adminLogService.logAction(currentAdminEmail, action,
                "Changed status of admin: " + user.getEmail() + " to " + (user.getIsActive() ? "active" : "inactive"),
                "ADMIN", adminId);

        return convertToResponse(admin);
    }

    @Transactional
    public AdminResponse createAdmin(AddAdminRequest request) {
        String firstName = normalizeInput(request.getFirstName());
        String lastName = normalizeInput(request.getLastName());
        String email = normalizeEmail(request.getEmail());
        String phoneNumber = normalizePhoneNumber(request.getPhoneNumber());

        // Validate email uniqueness
        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("Email already exists");
        }

        // Validate phone number uniqueness
        if (userRepository.existsByPhoneNumber(phoneNumber)) {
            throw new RuntimeException("Phone number already exists");
        }

        // Create user
        User user = new User();
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setEmail(email);
        user.setPhoneNumber(phoneNumber);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(Role.ADMIN);
        user.setIsActive(true);

        user = userRepository.save(user);

        // Create admin record
        Admin admin = new Admin();
        admin.setUser(user);

        admin = adminRepository.save(admin);

        String currentAdminEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        adminLogService.logAction(currentAdminEmail, "CREATE_ADMIN",
                "Created new admin: " + user.getEmail(), "ADMIN", admin.getAdminId());

        return convertToResponse(admin);
    }

    private String normalizeInput(String value) {
        return value != null ? value.trim() : null;
    }

    private String normalizeEmail(String value) {
        String normalized = normalizeInput(value);
        return normalized != null ? normalized.toLowerCase() : null;
    }

    private String normalizePhoneNumber(String value) {
        String normalized = normalizeInput(value);
        if (normalized == null) {
            return null;
        }

        return normalized.replaceAll("[\\s()-]", "");
    }

    private AdminResponse convertToResponse(Admin admin) {
        User user = admin.getUser();
        return new AdminResponse(
                admin.getAdminId(),
                user.getUserId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getPhoneNumber(),
                user.getIsActive());
    }
}
