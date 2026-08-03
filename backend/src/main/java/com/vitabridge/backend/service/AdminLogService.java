package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.AdminLogResponse;
import com.vitabridge.backend.model.Admin;
import com.vitabridge.backend.model.AdminLog;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.AdminLogRepository;
import com.vitabridge.backend.repository.AdminRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AdminLogService {

    private static final Logger logger = LoggerFactory.getLogger(AdminLogService.class);

    @Autowired
    private AdminLogRepository adminLogRepository;

    @Autowired
    private AdminRepository adminRepository;

    @Transactional
    public void logAction(String adminEmail, String action, String description, String targetType, Integer targetId) {
        try {
            Admin admin = adminRepository.findByUserEmail(adminEmail).orElse(null);

            if (admin != null) {
                AdminLog log = new AdminLog(admin, action, description, targetType, targetId);
                adminLogRepository.save(log);
            } else {
                logger.warn("Admin not found for email: {} - skipping log for action: {}", adminEmail, action);
            }
        } catch (Exception e) {
            logger.error("Failed to create admin log for action '{}': {}", action, e.getMessage(), e);
        }
    }

    public List<AdminLogResponse> getAllLogs() {
        List<AdminLog> logs = adminLogRepository.findAllByOrderByTimestampDesc();
        return logs.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    private AdminLogResponse convertToResponse(AdminLog log) {
        User user = log.getAdmin().getUser();
        String adminName = user.getFirstName() + " " + user.getLastName();

        return new AdminLogResponse(
                log.getLogId(),
                log.getAdmin().getAdminId(),
                adminName,
                user.getEmail(),
                log.getAction(),
                log.getDescription(),
                log.getTargetType(),
                log.getTargetId(),
                log.getTimestamp());
    }
}
