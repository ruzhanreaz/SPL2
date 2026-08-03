package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.ErrorResponse;
import com.vitabridge.backend.dto.NotificationResponse;
import com.vitabridge.backend.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @GetMapping
    public ResponseEntity<?> getUserNotifications(Authentication authentication) {
        try {
            String email = authentication.getName();
            List<NotificationResponse> notifications = notificationService.getUserNotifications(email);
            return ResponseEntity.ok(notifications);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve notifications: " + e.getMessage()));
        }
    }

    @GetMapping("/unread")
    public ResponseEntity<?> getUnreadNotifications(Authentication authentication) {
        try {
            String email = authentication.getName();
            List<NotificationResponse> notifications = notificationService.getUnreadNotifications(email);
            return ResponseEntity.ok(notifications);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve unread notifications: " + e.getMessage()));
        }
    }

    @GetMapping("/unread/count")
    public ResponseEntity<?> getUnreadCount(Authentication authentication) {
        try {
            String email = authentication.getName();
            Long count = notificationService.getUnreadCount(email);
            return ResponseEntity.ok(count);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to retrieve unread count: " + e.getMessage()));
        }
    }

    @PutMapping("/{notificationId}/read")
    public ResponseEntity<?> markAsRead(@PathVariable Integer notificationId,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            notificationService.markAsRead(notificationId, email);
            return ResponseEntity.ok(Map.of("message", "Notification marked as read"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("ERROR", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to mark notification as read: " + e.getMessage()));
        }
    }

    @PutMapping("/read-all")
    public ResponseEntity<?> markAllAsRead(Authentication authentication) {
        try {
            String email = authentication.getName();
            notificationService.markAllAsRead(email);
            return ResponseEntity.ok(Map.of("message", "All notifications marked as read"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("ERROR", "Failed to mark all notifications as read: " + e.getMessage()));
        }
    }
}
