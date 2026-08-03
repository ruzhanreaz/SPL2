package com.vitabridge.backend.controller;

import com.vitabridge.backend.service.AgoraService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/agora")
@CrossOrigin(origins = "*")
public class AgoraController {

    private static final Logger logger = LoggerFactory.getLogger(AgoraController.class);
    private final AgoraService agoraService;

    public AgoraController(AgoraService agoraService) {
        this.agoraService = agoraService;
    }

    /**
     * Generate Agora token for joining a channel
     * Request: POST /api/agora/token
     * Body: {
     * "channelName": "appointment-123",
     * "uid": 12345
     * }
     */
    @PostMapping("/token")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> generateToken(
            @RequestParam(required = true) String channelName,
            @RequestParam(required = true) int uid) {

        try {
            logger.info("Generating token for channel: {}, uid: {}", channelName, uid);

            String token = agoraService.generateToken(channelName, uid);
            String appId = agoraService.getAppId();

            Map<String, Object> response = new HashMap<>();
            response.put("appId", appId);
            response.put("token", token);
            response.put("channelName", channelName);
            response.put("uid", uid);
            response.put("timestamp", System.currentTimeMillis());

            logger.info("Token generated successfully for channel: {}", channelName);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            logger.error("Failed to generate token: {}", e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", "Token generation failed");
            error.put("message", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Get Agora App ID and configuration
     * Request: GET /api/agora/config
     * Response: { "appId": "...", "tokenRequired": boolean }
     */
    @GetMapping("/config")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getConfig() {
        try {
            Map<String, Object> config = new HashMap<>();
            config.put("appId", agoraService.getAppId());
            config.put("tokenRequired", agoraService.isTokenenabled());

            return ResponseEntity.ok(config);
        } catch (Exception e) {
            logger.error("Failed to get config: {}", e.getMessage());
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to get config");
            error.put("message", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    /**
     * Health check endpoint for Agora integration
     * Request: GET /api/agora/health
     */
    @GetMapping("/health")
    public ResponseEntity<?> health() {
        try {
            Map<String, Object> health = new HashMap<>();
            health.put("status", "healthy");
            health.put("appId", agoraService.getAppId() != null ? "configured" : "missing");
            health.put("tokenRequired", agoraService.isTokenenabled());

            return ResponseEntity.ok(health);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("status", "unhealthy");
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }
}
