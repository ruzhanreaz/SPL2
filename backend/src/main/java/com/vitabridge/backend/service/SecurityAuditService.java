package com.vitabridge.backend.service;

import com.vitabridge.backend.model.SecurityAuditLog;
import com.vitabridge.backend.repository.SecurityAuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
public class SecurityAuditService {

    private static final Logger logger = LoggerFactory.getLogger(SecurityAuditService.class);

    @Autowired
    private SecurityAuditLogRepository auditLogRepository;

    /**
     * Log security events asynchronously.
     * IP/UserAgent are captured eagerly since request context is thread-local
     * and won't be available on the async thread.
     */
    public void logSecurityEvent(Integer userId, String eventType, String details) {
        // Capture request info on the calling thread (before going async)
        String ipAddress = "unknown";
        String userAgent = "unknown";
        try {
            HttpServletRequest request = getCurrentRequest();
            if (request != null) {
                ipAddress = getClientIpAddress(request);
                userAgent = request.getHeader("User-Agent");
                if (userAgent == null) {
                    userAgent = "unknown";
                }
            }
        } catch (Exception e) {
            logger.debug("Could not extract request info for audit log: {}", e.getMessage());
        }

        saveAuditLogAsync(userId, eventType, ipAddress, userAgent, details);
    }

    @Async("taskExecutor")
    public void saveAuditLogAsync(Integer userId, String eventType, String ipAddress, String userAgent,
            String details) {
        try {
            SecurityAuditLog log = new SecurityAuditLog(userId, eventType, ipAddress, userAgent, details);
            auditLogRepository.save(log);
        } catch (Exception e) {
            logger.error("Failed to log security event '{}' for userId {}: {}", eventType, userId, e.getMessage(), e);
        }
    }

    /**
     * Get the current HTTP request
     */
    private HttpServletRequest getCurrentRequest() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder
                    .getRequestAttributes();
            return attributes != null ? attributes.getRequest() : null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Get client IP address, handling proxies
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String[] headerNames = {
                "X-Forwarded-For",
                "Proxy-Client-IP",
                "WL-Proxy-Client-IP"
        };

        for (String header : headerNames) {
            String ip = request.getHeader(header);
            if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
                // X-Forwarded-For can contain multiple IPs, get the first one
                if (ip.contains(",")) {
                    ip = ip.split(",")[0].trim();
                }
                return ip;
            }
        }

        return request.getRemoteAddr();
    }
}
