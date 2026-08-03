package com.vitabridge.backend.controller;

import com.vitabridge.backend.service.AgoraService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/video")
public class VideoControllerCompat {

    private final AgoraService agoraService;

    public VideoControllerCompat(AgoraService agoraService) {
        this.agoraService = agoraService;
    }

    @GetMapping("/token")
    public ResponseEntity<?> getToken(
            @RequestParam String channel,
            @RequestParam(defaultValue = "0") int uid,
            @RequestParam(defaultValue = "1") int role) {
        String token = agoraService.generateToken(channel, uid, role, 3600);

        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("channel", channel);
        response.put("uid", uid);
        response.put("role", role);
        response.put("appId", agoraService.getAppId());
        response.put("expiresAt", System.currentTimeMillis() + 3600_000L);

        return ResponseEntity.ok(response);
    }
}