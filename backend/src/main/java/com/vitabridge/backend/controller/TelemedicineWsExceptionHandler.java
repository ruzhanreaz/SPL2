package com.vitabridge.backend.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import java.util.HashMap;
import java.util.Map;

@Controller
public class TelemedicineWsExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(TelemedicineWsExceptionHandler.class);

    @MessageExceptionHandler(RuntimeException.class)
    @SendToUser("/queue/errors")
    public Map<String, String> handleRuntimeException(RuntimeException ex) {
        logger.warn("Telemedicine websocket error: {}", ex.getMessage());
        Map<String, String> payload = new HashMap<>();
        payload.put("type", "TELEMEDICINE_ERROR");
        payload.put("message", ex.getMessage() == null ? "Telemedicine request failed" : ex.getMessage());
        return payload;
    }
}
