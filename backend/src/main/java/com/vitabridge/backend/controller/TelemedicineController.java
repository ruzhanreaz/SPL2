package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.SignalMessage;
import com.vitabridge.backend.dto.TelemedicineCallEventResponse;
import com.vitabridge.backend.model.Appointment;
import com.vitabridge.backend.model.Assistant;
import com.vitabridge.backend.model.TelemedicineCallStatus;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.AppointmentRepository;
import com.vitabridge.backend.repository.AssistantRepository;
import com.vitabridge.backend.repository.UserRepository;
import com.vitabridge.backend.util.TimezoneUtil;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.Principal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Controller
public class TelemedicineController {

    private static final Logger logger = LoggerFactory.getLogger(TelemedicineController.class);
    private static final String APPOINTMENT_ROOM_PREFIX = "appointment-";
    private static final String CONSULTATION_ROOM_PREFIX = "consultation-";
    private static final String USER_CALL_QUEUE = "/queue/calls";
    private static final String DOCTOR_JOINED_SIGNAL = "DOCTOR_JOINED_CONSULTATION";
    private static final List<Appointment.AppointmentStatus> ACTIVE_ROOM_STATUSES = List.of(
            Appointment.AppointmentStatus.CONFIRMED,
            Appointment.AppointmentStatus.SCHEDULED,
            Appointment.AppointmentStatus.IN_PROGRESS);
    private final SimpMessagingTemplate messagingTemplate;
    private final AppointmentRepository appointmentRepository;
    private final UserRepository userRepository;
    private final AssistantRepository assistantRepository;

    public TelemedicineController(
            SimpMessagingTemplate messagingTemplate,
            AppointmentRepository appointmentRepository,
            UserRepository userRepository,
            AssistantRepository assistantRepository) {
        this.messagingTemplate = messagingTemplate;
        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
        this.assistantRepository = assistantRepository;
    }

    @MessageMapping("/signal")
    public void handleSignal(@Payload SignalMessage signal, Principal principal) {
        Appointment appointment = resolveAppointmentFromRoom(signal.getRoomId());
        Participant sender = resolveAndAuthorizeParticipant(signal.getRoomId(), signal.getFrom(), principal,
                appointment);
        if (!isAppointmentActiveForActions(appointment)) {
            throw new RuntimeException("Session is ended. Actions are locked.");
        }
        signal.setFrom(sender.participantKey());

        if (signal.getTo() != null && !signal.getTo().isBlank()) {
            resolveAndAuthorizeParticipant(signal.getRoomId(), signal.getTo(), null, appointment);
        }

        logger.info("Received signal: type={}, from={}, roomId={}",
                signal.getType(), signal.getFrom(), signal.getRoomId());

        // Forward signaling messages to the recipient
        if (signal.getTo() != null && !signal.getTo().isEmpty()) {
            messagingTemplate.convertAndSendToUser(
                    signal.getTo(),
                    "/queue/signal",
                    signal);
            logger.info("Signal sent to user: {}", signal.getTo());
        } else {
            // Broadcast to room if no specific recipient
            messagingTemplate.convertAndSend(
                    "/topic/room/" + signal.getRoomId(),
                    signal);
            logger.info("Signal broadcasted to room: {}", signal.getRoomId());
        }
    }

    @MessageMapping("/join")
    public void handleJoin(@Payload SignalMessage signal, Principal principal) {
        Appointment appointment = resolveAppointmentFromRoom(signal.getRoomId());
        Participant sender = resolveAndAuthorizeParticipant(signal.getRoomId(), signal.getFrom(), principal,
                appointment);
        signal.setFrom(sender.participantKey());

        signal.setData(enrichJoinSignalData(signal.getData(), sender.role()));

        logger.info("User joined: from={}, roomId={}, role={}",
                signal.getFrom(), signal.getRoomId(),
                signal.getData() != null ? signal.getData() : "N/A");

        // Notify room that someone joined
        messagingTemplate.convertAndSend(
                "/topic/room/" + signal.getRoomId(),
                signal);
        logger.info("Join notification sent to room: {}", signal.getRoomId());

        notifyPatientDoctorJoined(appointment, sender, signal.getRoomId());
    }

    private void notifyPatientDoctorJoined(Appointment appointment, Participant sender, String roomId) {
        if (appointment == null || sender == null || roomId == null || roomId.isBlank()) {
            return;
        }

        if (!"doctor".equals(sender.role())) {
            return;
        }

        if (appointment.getPatient() == null || appointment.getPatient().getUser() == null) {
            logger.warn("Skipping doctor-joined event: patient user is missing for appointmentId={}",
                    appointment.getAppointmentId());
            return;
        }

        User patientUser = appointment.getPatient().getUser();
        if (patientUser.getEmail() == null || patientUser.getEmail().isBlank()) {
            logger.warn("Skipping doctor-joined event: patient email is missing for appointmentId={}",
                    appointment.getAppointmentId());
            return;
        }

        TelemedicineCallEventResponse event = buildDoctorJoinedEvent(appointment, sender, roomId, patientUser);
        messagingTemplate.convertAndSendToUser(patientUser.getEmail(), USER_CALL_QUEUE, event);

        logger.info("Doctor-joined event sent: appointmentId={}, roomId={}, doctorUserId={}, patientUserId={}",
                appointment.getAppointmentId(), roomId, sender.userId(), patientUser.getUserId());
    }

    private TelemedicineCallEventResponse buildDoctorJoinedEvent(
            Appointment appointment,
            Participant sender,
            String roomId,
            User patientUser) {
        TelemedicineCallEventResponse event = new TelemedicineCallEventResponse();
        event.setType("telemedicine-call");
        event.setSignalType(DOCTOR_JOINED_SIGNAL);
        event.setEvent("DOCTOR_JOINED");
        event.setAppointmentId(appointment.getAppointmentId());
        event.setRoomId(roomId);
        event.setStatus(TelemedicineCallStatus.CONNECTED);
        event.setCallerName(sender.displayName());
        event.setCallerUserId(sender.userId());
        event.setCallerRole("doctor");
        event.setReceiverUserId(patientUser.getUserId());
        event.setReceiverRole("patient");
        event.setReason("Doctor joined consultation room");
        event.setTimestamp(TimezoneUtil.now());
        return event;
    }

    private Map<String, Object> enrichJoinSignalData(Object originalData, String senderRole) {
        Map<String, Object> enriched = new LinkedHashMap<>();
        if (originalData instanceof Map<?, ?> rawMap) {
            rawMap.forEach((key, value) -> {
                if (key != null) {
                    enriched.put(String.valueOf(key), value);
                }
            });
        }

        String normalizedRole = senderRole == null ? "" : senderRole.toLowerCase(Locale.ROOT);
        enriched.putIfAbsent("role", normalizedRole);

        if ("doctor".equals(normalizedRole)) {
            enriched.put("promptPatientJoin", true);
            enriched.put("promptMessage", "Please Join the Call");
            enriched.putIfAbsent("callType", "video");
        }

        return enriched;
    }

    @MessageMapping("/leave")
    public void handleLeave(@Payload SignalMessage signal, Principal principal) {
        Appointment appointment = resolveAppointmentFromRoom(signal.getRoomId());
        Participant sender = resolveAndAuthorizeParticipant(signal.getRoomId(), signal.getFrom(), principal,
                appointment);
        signal.setFrom(sender.participantKey());

        logger.info("User left: from={}, roomId={}", signal.getFrom(), signal.getRoomId());

        // Notify room that someone left
        messagingTemplate.convertAndSend(
                "/topic/room/" + signal.getRoomId(),
                signal);
        logger.info("Leave notification sent to room: {}", signal.getRoomId());
    }

    private Participant resolveAndAuthorizeParticipant(String roomId, String participantKey, Principal principal,
            Appointment appointment) {

        if (appointment.getAppointmentType() != Appointment.AppointmentType.ONLINE) {
            throw new RuntimeException("Telemedicine room is only available for online appointments");
        }

        Participant payloadParticipant = parseParticipantKey(participantKey);
        if (payloadParticipant == null) {
            throw new RuntimeException("Invalid participant identity");
        }

        Optional<User> principalUser = resolvePrincipalUser(principal);
        if (principalUser.isPresent() && !principalUser.get().getUserId().equals(payloadParticipant.userId())) {
            throw new RuntimeException("Participant identity does not match authenticated user");
        }

        if (!isAuthorizedForAppointment(payloadParticipant, appointment)) {
            throw new RuntimeException("You are not authorized for this telemedicine appointment");
        }

        User senderUser = userRepository.findById(payloadParticipant.userId())
                .orElseThrow(() -> new RuntimeException("Participant user not found"));

        return new Participant(
                payloadParticipant.role(),
                payloadParticipant.userId(),
                senderUser.getFirstName() + " " + senderUser.getLastName());
    }

    private boolean isAppointmentActiveForActions(Appointment appointment) {
        return ACTIVE_ROOM_STATUSES.contains(appointment.getStatus());
    }

    private Appointment resolveAppointmentFromRoom(String roomId) {
        if (roomId == null) {
            throw new RuntimeException("Invalid room id");
        }

        if (roomId.startsWith(CONSULTATION_ROOM_PREFIX)) {
            String idPart = roomId.substring(CONSULTATION_ROOM_PREFIX.length());
            String[] parts = idPart.split("-", 2);
            if (parts.length != 2) {
                throw new RuntimeException("Invalid room id");
            }

            Integer doctorId;
            Integer patientId;
            try {
                doctorId = Integer.parseInt(parts[0]);
                patientId = Integer.parseInt(parts[1]);
            } catch (NumberFormatException ex) {
                throw new RuntimeException("Invalid room id");
            }

            return appointmentRepository
                    .findFirstByDoctorDoctorIdAndPatientPatientIdAndAppointmentTypeAndStatusInOrderByAppointmentDateDescAppointmentTimeDescAppointmentIdDesc(
                            doctorId,
                            patientId,
                            Appointment.AppointmentType.ONLINE,
                            ACTIVE_ROOM_STATUSES)
                    .orElseThrow(() -> new RuntimeException("Appointment not found or session is inactive"));
        }

        if (roomId.startsWith(APPOINTMENT_ROOM_PREFIX)) {
            String idPart = roomId.substring(APPOINTMENT_ROOM_PREFIX.length());
            Integer appointmentId;
            try {
                appointmentId = Integer.parseInt(idPart);
            } catch (NumberFormatException ex) {
                throw new RuntimeException("Invalid room id");
            }

            return appointmentRepository.findById(appointmentId)
                    .orElseThrow(() -> new RuntimeException("Appointment not found"));
        }

        throw new RuntimeException("Invalid room id");
    }

    private Participant parseParticipantKey(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }

        String[] parts = key.split("-", 2);
        if (parts.length != 2) {
            return null;
        }

        Integer userId;
        try {
            userId = Integer.parseInt(parts[1]);
        } catch (NumberFormatException ex) {
            return null;
        }

        String role = parts[0].toLowerCase();
        if (!"doctor".equals(role) && !"patient".equals(role) && !"assistant".equals(role)) {
            return null;
        }

        return new Participant(role, userId, null);
    }

    private Optional<User> resolvePrincipalUser(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            return Optional.empty();
        }
        return userRepository.findByEmail(principal.getName());
    }

    private boolean isAuthorizedForAppointment(Participant participant, Appointment appointment) {
        if ("patient".equals(participant.role())) {
            return appointment.getPatient().getUser().getUserId().equals(participant.userId());
        }

        if ("doctor".equals(participant.role())) {
            return appointment.getDoctor().getUser().getUserId().equals(participant.userId());
        }

        if ("assistant".equals(participant.role())) {
            Optional<Assistant> assistantOpt = assistantRepository.findByUserUserId(participant.userId());
            if (assistantOpt.isEmpty() || assistantOpt.get().getDoctor() == null) {
                return false;
            }
            return assistantOpt.get().getDoctor().getDoctorId().equals(appointment.getDoctor().getDoctorId());
        }

        return false;
    }

    private record Participant(String role, Integer userId, String displayName) {
        private String participantKey() {
            return role + "-" + userId;
        }
    }
}
