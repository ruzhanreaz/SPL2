package com.vitabridge.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import java.util.Arrays;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketConfig.class);
    private final TelemedicineStompSecurityInterceptor telemedicineStompSecurityInterceptor;

    public WebSocketConfig(TelemedicineStompSecurityInterceptor telemedicineStompSecurityInterceptor) {
        this.telemedicineStompSecurityInterceptor = telemedicineStompSecurityInterceptor;
    }

    @Value("${cors.allowed-origins}")
    private String[] allowedOrigins;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
        logger.info("Message broker configured with /topic and /queue");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        logger.info("Configuring STOMP endpoints with allowed origin patterns: {}", Arrays.toString(allowedOrigins));

        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins)
                .withSockJS();

        registry.addEndpoint("/ws-telemedicine-native")
            .setAllowedOriginPatterns(allowedOrigins);

        registry.addEndpoint("/ws-telemedicine")
                .setAllowedOriginPatterns(allowedOrigins)
                .withSockJS();
        logger.info("WebSocket endpoints registered: /ws (SockJS), /ws-telemedicine-native (native), /ws-telemedicine (SockJS)");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(telemedicineStompSecurityInterceptor);
    }
}
