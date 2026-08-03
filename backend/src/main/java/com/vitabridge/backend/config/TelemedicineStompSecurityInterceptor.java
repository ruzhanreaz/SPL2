package com.vitabridge.backend.config;

import com.vitabridge.backend.model.Appointment;
import com.vitabridge.backend.model.Assistant;
import com.vitabridge.backend.model.Role;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.AppointmentRepository;
import com.vitabridge.backend.repository.AssistantRepository;
import com.vitabridge.backend.repository.UserRepository;
import com.vitabridge.backend.service.CustomUserDetailsService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

@Component
public class TelemedicineStompSecurityInterceptor implements ChannelInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(TelemedicineStompSecurityInterceptor.class);
    private static final String APPOINTMENT_ROOM_PREFIX = "appointment-";
    private static final String CONSULTATION_ROOM_PREFIX = "consultation-";
    private static final int SIGNAL_LIMIT = 60;
    private static final long SIGNAL_WINDOW_MS = 10_000L;
    private static final int CALL_CONTROL_LIMIT = 20;
    private static final long CALL_CONTROL_WINDOW_MS = 10_000L;
    private static final int PRESENCE_LIMIT = 6;
    private static final long PRESENCE_WINDOW_MS = 30_000L;
    private static final int MAX_PAYLOAD_BYTES = 32 * 1024;
    private static final int MAX_SIGNAL_DATA_CHARS = 16_384;
    private static final List<String> ALLOWED_SIGNAL_TYPES = List.of("join", "leave", "webrtc-signal");
        private static final List<String> DISALLOWED_CALL_KINDS = List.of(
            "call-request",
            "call-availability",
            "call-ended",
            "call-initiate",
            "call-accept",
            "call-decline",
            "call-heartbeat",
            "session-ended");
    private static final List<Appointment.AppointmentStatus> ACTIVE_ROOM_STATUSES = List.of(
            Appointment.AppointmentStatus.CONFIRMED,
            Appointment.AppointmentStatus.SCHEDULED,
            Appointment.AppointmentStatus.IN_PROGRESS);

    private final JwtUtil jwtUtil;
    private final CustomUserDetailsService userDetailsService;
    private final UserRepository userRepository;
    private final AppointmentRepository appointmentRepository;
    private final AssistantRepository assistantRepository;
    private final ObjectMapper objectMapper;
    private final Map<String, Deque<Long>> sendRateBuckets = new ConcurrentHashMap<>();

    public TelemedicineStompSecurityInterceptor(
            JwtUtil jwtUtil,
            CustomUserDetailsService userDetailsService,
            UserRepository userRepository,
            AppointmentRepository appointmentRepository,
            AssistantRepository assistantRepository,
            ObjectMapper objectMapper) {
        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
        this.userRepository = userRepository;
        this.appointmentRepository = appointmentRepository;
        this.assistantRepository = assistantRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        StompCommand command = accessor.getCommand();

        if (command == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(command)) {
            authenticateConnect(accessor);
            return message;
        }

        if (StompCommand.SUBSCRIBE.equals(command)) {
            authorizeSubscription(accessor);
            return message;
        }

        if (StompCommand.SEND.equals(command)) {
            authorizeSend(accessor, message);
            return message;
        }

        return message;
    }

    private void authenticateConnect(StompHeaderAccessor accessor) {
        String authorization = Optional
                .ofNullable(accessor.getFirstNativeHeader("Authorization"))
                .orElse(accessor.getFirstNativeHeader("authorization"));

        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new RuntimeException("Missing Authorization token for WebSocket CONNECT");
        }

        String jwt = authorization.substring(7);
        String username = jwtUtil.extractUsername(jwt);
        UserDetails userDetails = userDetailsService.loadUserByUsername(username);

        if (!jwtUtil.validateToken(jwt, userDetails.getUsername())) {
            throw new RuntimeException("Invalid JWT token for WebSocket CONNECT");
        }

        Authentication auth = new UsernamePasswordAuthenticationToken(
                userDetails,
                null,
                userDetails.getAuthorities());
        accessor.setUser(auth);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private void authorizeSubscription(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null) {
            return;
        }

        if (!destination.startsWith("/topic/room/")) {
            return;
        }

        if (!(accessor.getUser() instanceof Authentication authentication)) {
            throw new RuntimeException("Unauthorized subscription: missing authenticated user");
        }

        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));

        String roomId = extractRoomId(destination);
        Appointment appointment = resolveAppointment(roomId);

        if (!isUserAuthorizedForAppointment(user, appointment)) {
            logger.warn("Denied STOMP subscription. userId={}, destination={}", user.getUserId(), destination);
            throw new RuntimeException("Not authorized to subscribe to this telemedicine room");
        }
    }

    private void authorizeSend(StompHeaderAccessor accessor, Message<?> message) {
        String destination = accessor.getDestination();
        if (destination == null) {
            return;
        }

        if (!destination.startsWith("/app/join")
                && !destination.startsWith("/app/leave")
                && !destination.startsWith("/app/signal")
                && !destination.startsWith("/app/calls/")) {
            return;
        }

        if (!(accessor.getUser() instanceof Authentication authentication)) {
            throw new RuntimeException("Unauthorized send: missing authenticated user");
        }

        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));

        enforceSendRateLimit(user.getUserId(), destination);

        if (destination.startsWith("/app/calls/")) {
            return;
        }

        Map<String, Object> payload = parsePayload(message);
        String roomId = readString(payload, "roomId");
        if (roomId == null || roomId.isBlank()) {
            throw new RuntimeException("Missing room id in telemedicine message");
        }

        Appointment appointment = resolveAppointment(roomId);
        if (!isUserAuthorizedForAppointment(user, appointment)) {
            logger.warn("Denied STOMP send. userId={}, destination={}, roomId={}",
                    user.getUserId(), destination, roomId);
            throw new RuntimeException("Not authorized for this telemedicine room");
        }

        if (destination.startsWith("/app/signal") && !isAppointmentActiveForActions(appointment)) {
            throw new RuntimeException("Session is ended. Actions are locked.");
        }

        validateSenderIdentity(payload, user, appointment);
        validateTargetIdentity(payload, appointment);
        validatePayloadContent(destination, payload);
    }

    private void enforceSendRateLimit(Integer userId, String destination) {
        if (userId == null || destination == null) {
            return;
        }

        final int limit;
        final long windowMs;
        final String message;

        if (destination.startsWith("/app/signal")) {
            limit = SIGNAL_LIMIT;
            windowMs = SIGNAL_WINDOW_MS;
            message = "Connection events are too frequent. Please wait a moment.";
        } else if (destination.startsWith("/app/calls/")) {
            limit = CALL_CONTROL_LIMIT;
            windowMs = CALL_CONTROL_WINDOW_MS;
            message = "Call control actions are too frequent. Please wait and retry.";
        } else if (destination.startsWith("/app/join") || destination.startsWith("/app/leave")) {
            limit = PRESENCE_LIMIT;
            windowMs = PRESENCE_WINDOW_MS;
            message = "Too many join/leave actions. Please wait and retry.";
        } else {
            return;
        }

        String bucketKey = userId + ":" + destination;
        Deque<Long> bucket = sendRateBuckets.computeIfAbsent(bucketKey, ignored -> new ConcurrentLinkedDeque<>());
        long now = System.currentTimeMillis();
        long cutoff = now - windowMs;

        synchronized (bucket) {
            while (!bucket.isEmpty() && bucket.peekFirst() < cutoff) {
                bucket.pollFirst();
            }

            if (bucket.size() >= limit) {
                logger.warn("Rate limit exceeded. userId={}, destination={}, limit={}, windowMs={}",
                        userId, destination, limit, windowMs);
                throw new RuntimeException(message);
            }

            bucket.addLast(now);
        }
    }

    private String extractRoomId(String destination) {
        if (destination.startsWith("/topic/room/")) {
            return destination.substring("/topic/room/".length());
        }
        throw new RuntimeException("Unsupported destination");
    }

    private void validateSenderIdentity(Map<String, Object> payload, User user, Appointment appointment) {
        String sender = firstNonBlank(
                readString(payload, "from"),
                readString(payload, "senderId"));

        if (sender == null) {
            return;
        }

        Participant participant = parseParticipantKey(sender);
        if (participant == null) {
            throw new RuntimeException("Invalid sender identity in telemedicine payload");
        }

        if (!participant.userId().equals(user.getUserId())) {
            throw new RuntimeException("Sender identity does not match authenticated user");
        }

        String expectedRolePrefix = rolePrefix(user.getRole());
        if (!expectedRolePrefix.equals(participant.role())) {
            throw new RuntimeException("Sender role does not match authenticated user role");
        }

        if (!isParticipantAuthorizedForAppointment(participant, appointment)) {
            throw new RuntimeException("Sender is not a valid participant for this appointment");
        }
    }

    private void validateTargetIdentity(Map<String, Object> payload, Appointment appointment) {
        String target = readString(payload, "to");
        if (target == null || target.isBlank()) {
            return;
        }

        Participant participant = parseParticipantKey(target);
        if (participant == null || !isParticipantAuthorizedForAppointment(participant, appointment)) {
            throw new RuntimeException("Signal target is not a valid participant for this appointment");
        }
    }

    private Map<String, Object> parsePayload(Message<?> message) {
        try {
            Object payload = message.getPayload();
            if (payload instanceof byte[] bytes) {
                if (bytes.length > MAX_PAYLOAD_BYTES) {
                    throw new RuntimeException("Telemedicine payload is too large");
                }
                String json = new String(bytes, StandardCharsets.UTF_8);
                return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {
                });
            }

            if (payload instanceof String stringPayload) {
                if (stringPayload.getBytes(StandardCharsets.UTF_8).length > MAX_PAYLOAD_BYTES) {
                    throw new RuntimeException("Telemedicine payload is too large");
                }
                return objectMapper.readValue(stringPayload, new TypeReference<Map<String, Object>>() {
                });
            }

            throw new RuntimeException("Unsupported STOMP payload type");
        } catch (Exception ex) {
            throw new RuntimeException("Invalid telemedicine payload");
        }
    }

    private void validatePayloadContent(String destination, Map<String, Object> payload) {
        if (destination.startsWith("/app/signal")
                || destination.startsWith("/app/join")
                || destination.startsWith("/app/leave")) {
            validateSignalPayload(payload);
        }
    }

    private void validateSignalPayload(Map<String, Object> payload) {
        String signalType = readString(payload, "type");
        if (signalType == null || signalType.isBlank()) {
            throw new RuntimeException("Signal type is required");
        }

        if (!ALLOWED_SIGNAL_TYPES.contains(signalType)) {
            throw new RuntimeException("Unsupported signal type");
        }

        Object data = payload.get("data");
        if (data != null) {
            String asString = String.valueOf(data);
            if (asString.length() > MAX_SIGNAL_DATA_CHARS) {
                throw new RuntimeException("Signal payload data is too large");
            }
        }

        String kind = readString(payload, "kind");
        if (kind == null) {
            Object nestedData = payload.get("data");
            if (nestedData instanceof Map<?, ?> dataMap) {
                Object nestedKind = dataMap.get("kind");
                kind = nestedKind != null ? nestedKind.toString() : null;
            }
        }
        if (kind != null && DISALLOWED_CALL_KINDS.contains(kind)) {
            throw new RuntimeException("Telemedicine call control must use the REST signaling API");
        }
    }

    private String readString(Map<String, Object> payload, String key) {
        if (payload == null || !payload.containsKey(key)) {
            return null;
        }
        Object value = payload.get(key);
        return value == null ? null : value.toString();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private Appointment resolveAppointment(String roomId) {
        if (roomId == null) {
            throw new RuntimeException("Invalid telemedicine room id");
        }

        if (roomId.startsWith(CONSULTATION_ROOM_PREFIX)) {
            String pairPart = roomId.substring(CONSULTATION_ROOM_PREFIX.length());
            String[] parts = pairPart.split("-", 2);
            if (parts.length != 2) {
                throw new RuntimeException("Invalid telemedicine room id");
            }

            Integer doctorId;
            Integer patientId;
            try {
                doctorId = Integer.parseInt(parts[0]);
                patientId = Integer.parseInt(parts[1]);
            } catch (NumberFormatException ex) {
                throw new RuntimeException("Invalid telemedicine room id");
            }

            return appointmentRepository
                    .findFirstByDoctorDoctorIdAndPatientPatientIdAndAppointmentTypeAndStatusInOrderByAppointmentDateDescAppointmentTimeDescAppointmentIdDesc(
                            doctorId,
                            patientId,
                            Appointment.AppointmentType.ONLINE,
                            ACTIVE_ROOM_STATUSES)
                    .orElseThrow(() -> new RuntimeException("Telemedicine session is not active"));
        }

        if (roomId.startsWith(APPOINTMENT_ROOM_PREFIX)) {
            Integer appointmentId;
            try {
                appointmentId = Integer.parseInt(roomId.substring(APPOINTMENT_ROOM_PREFIX.length()));
            } catch (NumberFormatException ex) {
                throw new RuntimeException("Invalid telemedicine room id");
            }

            Appointment appointment = appointmentRepository.findById(appointmentId)
                    .orElseThrow(() -> new RuntimeException("Appointment not found"));

            if (appointment.getAppointmentType() != Appointment.AppointmentType.ONLINE) {
                throw new RuntimeException("Telemedicine room is only available for online appointments");
            }

            return appointment;
        }

        throw new RuntimeException("Invalid telemedicine room id");
    }

    private boolean isAppointmentActiveForActions(Appointment appointment) {
        return ACTIVE_ROOM_STATUSES.contains(appointment.getStatus());
    }

    private boolean isUserAuthorizedForAppointment(User user, Appointment appointment) {
        Integer userId = user.getUserId();

        if (appointment.getPatient().getUser().getUserId().equals(userId)) {
            return true;
        }

        if (appointment.getDoctor().getUser().getUserId().equals(userId)) {
            return true;
        }

        Optional<Assistant> assistantOpt = assistantRepository.findByUserUserId(userId);
        return assistantOpt.isPresent()
                && assistantOpt.get().getDoctor() != null
                && assistantOpt.get().getDoctor().getDoctorId().equals(appointment.getDoctor().getDoctorId());
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

        return new Participant(role, userId);
    }

    private String rolePrefix(Role role) {
        return role.getValue().toLowerCase();
    }

    private boolean isParticipantAuthorizedForAppointment(Participant participant, Appointment appointment) {
        if ("patient".equals(participant.role())) {
            return appointment.getPatient().getUser().getUserId().equals(participant.userId());
        }

        if ("doctor".equals(participant.role())) {
            return appointment.getDoctor().getUser().getUserId().equals(participant.userId());
        }

        if ("assistant".equals(participant.role())) {
            Optional<Assistant> assistantOpt = assistantRepository.findByUserUserId(participant.userId());
            return assistantOpt.isPresent()
                    && assistantOpt.get().getDoctor() != null
                    && assistantOpt.get().getDoctor().getDoctorId().equals(appointment.getDoctor().getDoctorId());
        }

        return false;
    }

    private record Participant(String role, Integer userId) {
    }
}
