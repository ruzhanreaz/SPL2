package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.TelemedicineCallEventResponse;
import com.vitabridge.backend.dto.TelemedicineCallSignalActionRequest;
import com.vitabridge.backend.dto.TelemedicineCallSignalInitiateRequest;
import com.vitabridge.backend.service.TelemedicineCallService;
import jakarta.validation.Valid;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;

@Controller
public class TelemedicineCallStompController {

    private final TelemedicineCallService telemedicineCallService;
    private final SimpMessagingTemplate messagingTemplate;

    public TelemedicineCallStompController(
            TelemedicineCallService telemedicineCallService,
            SimpMessagingTemplate messagingTemplate) {
        this.telemedicineCallService = telemedicineCallService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/calls/initiate")
    public void initiateCall(@Payload @Valid TelemedicineCallSignalInitiateRequest request, Principal principal) {
        telemedicineCallService.initiateCallFromSignal(request, principalName(principal));
    }

    @MessageMapping("/calls/accept")
    public void acceptCall(@Payload @Valid TelemedicineCallSignalActionRequest request, Principal principal) {
        telemedicineCallService.acceptCallFromSignal(request, principalName(principal));
    }

    @MessageMapping("/calls/reject")
    public void rejectCall(@Payload @Valid TelemedicineCallSignalActionRequest request, Principal principal) {
        telemedicineCallService.rejectCallFromSignal(request, principalName(principal));
    }

    @MessageMapping("/calls/end")
    public void endCall(@Payload @Valid TelemedicineCallSignalActionRequest request, Principal principal) {
        telemedicineCallService.endCallFromSignal(request, principalName(principal));
    }

    @MessageExceptionHandler({ ResponseStatusException.class, RuntimeException.class })
    public void handleSignalError(Exception exception, Principal principal) {
        TelemedicineCallEventResponse errorEvent = new TelemedicineCallEventResponse();
        errorEvent.setType("telemedicine-call");
        errorEvent.setSignalType("CALL_ERROR");
        errorEvent.setEvent("IDLE");
        errorEvent.setReason(exception.getMessage());

        pushToCaller(principal, errorEvent);
    }

    private String principalName(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Authentication is required");
        }
        return principal.getName();
    }

    private void pushToCaller(Principal principal, TelemedicineCallEventResponse event) {
        if (principal == null || event == null) {
            return;
        }

        messagingTemplate.convertAndSendToUser(principal.getName(), "/queue/calls", event);
    }
}
