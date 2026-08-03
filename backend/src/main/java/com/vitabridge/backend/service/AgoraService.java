package com.vitabridge.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class AgoraService {

    private static final Logger logger = LoggerFactory.getLogger(AgoraService.class);
    private static final int ROLE_PUBLISHER = 1;

    @Value("${agora.appId}")
    private String appId;

    @Value("${agora.appCertificate}")
    private String appCertificate;

    @Value("${agora.useToken}")
    private boolean useToken;

    /**
     * Generate an Agora RTC token for a user to join a channel
     * 
     * @param channelName            The channel name (e.g., "appointment-123")
     * @param uid                    The user ID (must be unique within the channel)
     * @param role                   The role (USER = 0, PUBLISHER = 1, SUBSCRIBER =
     *                               2)
     * @param tokenExpirationSeconds Token expiration time in seconds (0 = no
     *                               expiration, max 24 hours)
     * @return Generated token string
     */
    public String generateToken(String channelName, int uid, int role, int tokenExpirationSeconds) {
        try {
            if (!useToken || appCertificate == null || appCertificate.isEmpty()) {
                logger.info("Token generation disabled or certificate empty. Returning empty token.");
                return "";
            }

            // Keep the backend compiling even when Agora SDK is not resolvable in this environment.
            logger.warn("Agora token generation requested but no Agora SDK is on the compile classpath.");
            throw new IllegalStateException(
                    "Agora token generation requires an available Agora token builder library.");
        } catch (Exception e) {
            logger.error("Error generating Agora token: {}", e.getMessage());
            throw new RuntimeException("Failed to generate Agora token: " + e.getMessage());
        }
    }

    /**
     * Simplified token generation with default settings
     * 
     * @param channelName The channel name
     * @param uid         The user ID
     * @return Generated token string
     */
    public String generateToken(String channelName, int uid) {
        return generateToken(channelName, uid, ROLE_PUBLISHER, 3600);
    }

    /**
     * Get the Agora App ID
     * 
     * @return App ID
     */
    public String getAppId() {
        return appId;
    }

    /**
     * Check if token-based authentication is enabled
     * 
     * @return true if enabled
     */
    public boolean isTokenenabled() {
        return useToken && appCertificate != null && !appCertificate.isEmpty();
    }
}
