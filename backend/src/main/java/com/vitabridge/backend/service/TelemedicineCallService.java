package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.TelemedicineCallActionRequest;
import com.vitabridge.backend.dto.TelemedicineCallEventResponse;
import com.vitabridge.backend.dto.TelemedicineCallInitiateRequest;
import com.vitabridge.backend.dto.TelemedicineCallSignalActionRequest;
import com.vitabridge.backend.dto.TelemedicineCallSignalInitiateRequest;
import com.vitabridge.backend.model.Appointment;
import com.vitabridge.backend.model.Doctor;
import com.vitabridge.backend.model.TelemedicineCallSession;
import com.vitabridge.backend.model.TelemedicineCallStatus;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.AppointmentRepository;
import com.vitabridge.backend.repository.DoctorRepository;
import com.vitabridge.backend.repository.TelemedicineCallSessionRepository;
import com.vitabridge.backend.repository.UserRepository;
import com.vitabridge.backend.util.TimezoneUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Service
public class TelemedicineCallService {

    private static final List<Appointment.AppointmentStatus> ACTIVE_STATUSES = List.of(
        Appointment.AppointmentStatus.SCHEDULED,
            Appointment.AppointmentStatus.IN_PROGRESS);

    private static final List<TelemedicineCallStatus> ACTIVE_CALL_STATUSES = List.of(
            TelemedicineCallStatus.INITIATED,
            TelemedicineCallStatus.RINGING,
            TelemedicineCallStatus.CONNECTED);

    private static final String USER_CALL_QUEUE = "/queue/calls";

    private final AppointmentRepository appointmentRepository;
    private final UserRepository userRepository;
    private final DoctorRepository doctorRepository;
    private final TelemedicineCallSessionRepository callSessionRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final long ringTtlSeconds;

    public TelemedicineCallService(
            AppointmentRepository appointmentRepository,
            UserRepository userRepository,
            DoctorRepository doctorRepository,
            TelemedicineCallSessionRepository callSessionRepository,
            SimpMessagingTemplate messagingTemplate,
            @Value("${telemedicine.call-ring-ttl-seconds:30}") long ringTtlSeconds) {
        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
        this.doctorRepository = doctorRepository;
        this.callSessionRepository = callSessionRepository;
        this.messagingTemplate = messagingTemplate;
        this.ringTtlSeconds = ringTtlSeconds;
    }

    @Transactional
    public TelemedicineCallEventResponse initiateCall(TelemedicineCallInitiateRequest request, String requesterEmail) {
        return initiateCallInternal(
                request != null ? request.getAppointmentId() : null,
                request != null ? request.getCallType() : null,
                requesterEmail,
                false,
                false);
    }

    @Transactional
    public TelemedicineCallEventResponse initiateCallFromSignal(TelemedicineCallSignalInitiateRequest request, String requesterEmail) {
        return initiateCallInternal(
                request != null ? request.getAppointmentId() : null,
                request != null ? request.getCallType() : null,
                requesterEmail,
                true,
                true);
    }

    private TelemedicineCallEventResponse initiateCallInternal(
            Integer appointmentId,
            String callType,
            String requesterEmail,
            boolean ignoreDuplicateRinging,
            boolean sendUnavailableSignal) {
        if (appointmentId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "appointmentId is required");
        }

        User requester = requireUser(requesterEmail);
        Appointment appointment = requireAppointmentForUpdate(appointmentId);
        validateAppointmentIsCallable(appointment);

        ParticipantRole participantRole = resolveParticipantRole(requester, appointment);
        if (participantRole == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not authorized for this appointment");
        }

        Doctor doctor = appointment.getDoctor();
        if (!Boolean.TRUE.equals(doctor.getIsAvailableForCalls())) {
            if (sendUnavailableSignal) {
                TelemedicineCallEventResponse unavailableEvent = buildSystemSignal(
                        appointment,
                        "DOCTOR_UNAVAILABLE",
                        "Doctor Unavailable");
                sendToUser(requester, unavailableEvent);
                return unavailableEvent;
            }
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "The doctor is currently unavailable for calls");
        }

        TelemedicineCallSession activeSession = findActiveCallSession(appointment.getAppointmentId());
        if (activeSession != null) {
            if (ignoreDuplicateRinging && activeSession.getStatus() == TelemedicineCallStatus.RINGING) {
                TelemedicineCallEventResponse ignoredEvent = toEvent(activeSession, "CALL_IGNORED", "ALREADY_RINGING");
                sendToUser(requester, ignoredEvent);
                return ignoredEvent;
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A telemedicine call is already active for this appointment");
        }

        User receiver = participantRole == ParticipantRole.DOCTOR
                ? appointment.getPatient().getUser()
                : appointment.getDoctor().getUser();

        TelemedicineCallSession session = new TelemedicineCallSession();
        session.setAppointment(appointment);
        session.setRoomId(buildRoomId(appointment));
        session.setCaller(requester);
        session.setReceiver(receiver);
        session.setCallType(normalizeCallType(callType));
        session.setStatus(TelemedicineCallStatus.INITIATED);
        session.setInitiatedAt(TimezoneUtil.now());
        session.setLastHeartbeatAt(TimezoneUtil.now());

        TelemedicineCallSession initiated = callSessionRepository.save(session);
        TelemedicineCallEventResponse initiatedEvent = toEvent(initiated, "CALL_INITIATED", null);
        sendToUser(requester, initiatedEvent);

        initiated.setStatus(TelemedicineCallStatus.RINGING);
        initiated.setRingingAt(TimezoneUtil.now());
        initiated.setLastHeartbeatAt(TimezoneUtil.now());
        initiated.setExpiresAt(TimezoneUtil.now().plusSeconds(ringTtlSeconds));

        TelemedicineCallSession ringing = callSessionRepository.save(initiated);
        TelemedicineCallEventResponse ringingEvent = toEvent(ringing, "CALL_RINGING", null);
        dispatchToParticipants(ringing, ringingEvent, true);
        return ringingEvent;
    }

    @Transactional
    public TelemedicineCallEventResponse acceptCallFromSignal(TelemedicineCallSignalActionRequest request, String requesterEmail) {
        if (request == null || request.getCallId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "callId is required");
        }
        return acceptCall(request.getCallId(), requesterEmail);
    }

    @Transactional
    public TelemedicineCallEventResponse rejectCallFromSignal(TelemedicineCallSignalActionRequest request, String requesterEmail) {
        if (request == null || request.getCallId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "callId is required");
        }
        TelemedicineCallActionRequest actionRequest = new TelemedicineCallActionRequest();
        actionRequest.setReason(request.getReason());
        return declineCall(request.getCallId(), requesterEmail, actionRequest);
    }

    @Transactional
    public TelemedicineCallEventResponse endCallFromSignal(TelemedicineCallSignalActionRequest request, String requesterEmail) {
        if (request == null || request.getCallId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "callId is required");
        }
        TelemedicineCallActionRequest actionRequest = new TelemedicineCallActionRequest();
        actionRequest.setReason(request.getReason());
        return endCall(request.getCallId(), requesterEmail, actionRequest);
    }

    @Transactional
    public TelemedicineCallEventResponse acceptCall(Long callSessionId, String requesterEmail) {
        TelemedicineCallSession session = requireSessionForUpdate(callSessionId);
        User requester = requireUser(requesterEmail);

        ensureCallerOrReceiver(requester, session, true);
        ensureRingState(session);

        session.setStatus(TelemedicineCallStatus.CONNECTED);
        session.setAcceptedAt(TimezoneUtil.now());
        session.setExpiresAt(null);

        TelemedicineCallSession saved = callSessionRepository.save(session);
        TelemedicineCallEventResponse event = toEvent(saved, "CALL_ACCEPT", null);
        dispatchToParticipants(saved, event, true);
        return event;
    }

    @Transactional
    public TelemedicineCallEventResponse declineCall(Long callSessionId, String requesterEmail, TelemedicineCallActionRequest request) {
        TelemedicineCallSession session = requireSessionForUpdate(callSessionId);
        User requester = requireUser(requesterEmail);

        ensureReceiverOnly(requester, session);
        ensureRingState(session);

        session.setStatus(TelemedicineCallStatus.MISSED);
        session.setDeclinedAt(TimezoneUtil.now());
        session.setEndedAt(TimezoneUtil.now());
        session.setEndedReason(normalizeReason(request != null ? request.getReason() : null, "REJECTED_BY_RECEIVER"));
        session.setExpiresAt(null);

        TelemedicineCallSession saved = callSessionRepository.save(session);
        TelemedicineCallEventResponse event = toEvent(saved, "CALL_REJECT", saved.getEndedReason());
        dispatchToParticipants(saved, event, true);
        return event;
    }

    @Transactional
    public TelemedicineCallEventResponse endCall(Long callSessionId, String requesterEmail, TelemedicineCallActionRequest request) {
        TelemedicineCallSession session = requireSessionForUpdate(callSessionId);
        User requester = requireUser(requesterEmail);

        ensureCallerOrReceiver(requester, session, false);
        ensureActiveState(session);

        session.setStatus(TelemedicineCallStatus.ENDED);
        session.setEndedAt(TimezoneUtil.now());
        session.setEndedReason(normalizeReason(request != null ? request.getReason() : null, "ENDED"));
        session.setExpiresAt(null);

        TelemedicineCallSession saved = callSessionRepository.save(session);
        TelemedicineCallEventResponse event = toEvent(saved, "CALL_END", saved.getEndedReason());
        dispatchToParticipants(saved, event, true);
        return event;
    }

    @Transactional
    public TelemedicineCallEventResponse heartbeat(Long callSessionId, String requesterEmail) {
        TelemedicineCallSession session = requireSessionForUpdate(callSessionId);
        User requester = requireUser(requesterEmail);

        if (!requester.getUserId().equals(session.getCaller().getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the caller can heartbeat a ringing call");
        }

        ensureRingState(session);
        session.setLastHeartbeatAt(TimezoneUtil.now());
        session.setExpiresAt(TimezoneUtil.now().plusSeconds(ringTtlSeconds));

        TelemedicineCallSession saved = callSessionRepository.save(session);
        return toEvent(saved, "CALL_HEARTBEAT", null);
    }

    @Transactional(readOnly = true)
    public TelemedicineCallEventResponse getStatus(Integer appointmentId, String requesterEmail) {
        Appointment appointment = requireAppointment(appointmentId);
        User requester = requireUser(requesterEmail);
        if (resolveParticipantRole(requester, appointment) == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not authorized for this appointment");
        }

        TelemedicineCallSession session = callSessionRepository
                .findFirstByAppointmentAppointmentIdAndStatusInOrderByInitiatedAtDesc(
                        appointmentId,
                        ACTIVE_CALL_STATUSES)
                .orElse(null);

        if (session == null) {
            return null;
        }

        return toEvent(session, "CALL_STATUS", session.getEndedReason());
    }

    @Transactional
    public void purgeExpiredRingingCalls() {
        Instant now = TimezoneUtil.now();
        List<TelemedicineCallSession> expired = callSessionRepository.findByStatusInAndExpiresAtBefore(
                List.of(TelemedicineCallStatus.RINGING, TelemedicineCallStatus.INITIATED),
                now);

        for (TelemedicineCallSession session : expired) {
            if (session.getStatus() == TelemedicineCallStatus.ENDED
                    || session.getStatus() == TelemedicineCallStatus.MISSED
                    || session.getStatus() == TelemedicineCallStatus.REJECTED
                    || session.getStatus() == TelemedicineCallStatus.DECLINED
                    || session.getStatus() == TelemedicineCallStatus.EXPIRED) {
                continue;
            }

            session.setStatus(TelemedicineCallStatus.MISSED);
            session.setEndedAt(now);
            session.setEndedReason("CALLER_TIMEOUT");
            session.setExpiresAt(null);
            TelemedicineCallSession saved = callSessionRepository.save(session);
            dispatchToParticipants(saved, toEvent(saved, "CALL_MISSED", "CALLER_TIMEOUT"), true);
        }
    }

    private Appointment requireAppointmentForUpdate(Integer appointmentId) {
        return appointmentRepository.findByIdForUpdate(appointmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));
    }

    private Appointment requireAppointment(Integer appointmentId) {
        return appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));
    }

    private TelemedicineCallSession requireSessionForUpdate(Long callSessionId) {
        if (callSessionId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "callId is required");
        }

        return callSessionRepository.findByIdForUpdate(callSessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Call session not found"));
    }

    private User requireUser(String email) {
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required");
        }

        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user not found"));
    }

    private void validateAppointmentIsCallable(Appointment appointment) {
        if (appointment.getAppointmentType() != Appointment.AppointmentType.ONLINE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only online appointments can start telemedicine calls");
        }

        if (!ACTIVE_STATUSES.contains(appointment.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Appointment is not in a callable state");
        }
    }

    private ParticipantRole resolveParticipantRole(User user, Appointment appointment) {
        Integer userId = user.getUserId();
        if (appointment.getPatient() != null
                && appointment.getPatient().getUser() != null
                && appointment.getPatient().getUser().getUserId().equals(userId)) {
            return ParticipantRole.PATIENT;
        }

        if (appointment.getDoctor() != null
                && appointment.getDoctor().getUser() != null
                && appointment.getDoctor().getUser().getUserId().equals(userId)) {
            return ParticipantRole.DOCTOR;
        }

        return null;
    }

    private boolean hasActiveCallSession(Integer appointmentId) {
        return findActiveCallSession(appointmentId) != null;
    }

    private TelemedicineCallSession findActiveCallSession(Integer appointmentId) {
        return callSessionRepository.findFirstByAppointmentAppointmentIdAndStatusInOrderByInitiatedAtDesc(
                appointmentId,
                ACTIVE_CALL_STATUSES).orElse(null);
    }

    private void ensureRingState(TelemedicineCallSession session) {
        if (session.getStatus() != TelemedicineCallStatus.RINGING
                && session.getStatus() != TelemedicineCallStatus.INITIATED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Call is no longer ringing");
        }

        Instant expiresAt = session.getExpiresAt();
        if (expiresAt != null && expiresAt.isBefore(TimezoneUtil.now())) {
            throw new ResponseStatusException(HttpStatus.GONE, "Ringing window expired");
        }
    }

    private void ensureActiveState(TelemedicineCallSession session) {
        if (session.getStatus() != TelemedicineCallStatus.RINGING
                && session.getStatus() != TelemedicineCallStatus.CONNECTED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Call is not active");
        }
    }

    private void ensureCallerOrReceiver(User requester, TelemedicineCallSession session, boolean allowReceiverOnlyForAccept) {
        Integer requesterUserId = requester.getUserId();
        boolean isCaller = session.getCaller() != null && session.getCaller().getUserId().equals(requesterUserId);
        boolean isReceiver = session.getReceiver() != null && session.getReceiver().getUserId().equals(requesterUserId);

        if (allowReceiverOnlyForAccept && !isReceiver) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the receiving participant can accept this call");
        }

        if (!allowReceiverOnlyForAccept && !isCaller && !isReceiver) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not a participant in this call");
        }
    }

    private void ensureReceiverOnly(User requester, TelemedicineCallSession session) {
        Integer requesterUserId = requester.getUserId();
        if (session.getReceiver() == null || !session.getReceiver().getUserId().equals(requesterUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the receiving participant can decline this call");
        }
    }

    private String buildRoomId(Appointment appointment) {
        return "consultation-" + appointment.getDoctor().getDoctorId() + "-" + appointment.getPatient().getPatientId();
    }

    private TelemedicineCallEventResponse toEvent(TelemedicineCallSession session, String event, String reason) {
        TelemedicineCallEventResponse response = new TelemedicineCallEventResponse();
        response.setType("telemedicine-call");
        response.setSignalType(event);
        response.setEvent(session.getStatus().name());
        response.setCallId(session.getCallSessionId());
        response.setAppointmentId(session.getAppointment() != null ? session.getAppointment().getAppointmentId() : null);
        response.setRoomId(session.getRoomId());
        response.setCallType(session.getCallType());
        response.setStatus(session.getStatus());
        response.setCallerName(resolveDisplayName(session.getCaller()));
        response.setCallerUserId(session.getCaller() != null ? session.getCaller().getUserId() : null);
        response.setCallerRole(session.getCaller() != null ? session.getCaller().getRole().getValue() : null);
        response.setReceiverUserId(session.getReceiver() != null ? session.getReceiver().getUserId() : null);
        response.setReceiverRole(session.getReceiver() != null ? session.getReceiver().getRole().getValue() : null);
        response.setReason(reason);
        response.setTimestamp(TimezoneUtil.now());
        response.setExpiresAt(session.getExpiresAt());
        response.setLastHeartbeatAt(session.getLastHeartbeatAt());
        return response;
    }

    private TelemedicineCallEventResponse buildSystemSignal(Appointment appointment, String signalType, String reason) {
        TelemedicineCallEventResponse response = new TelemedicineCallEventResponse();
        response.setType("telemedicine-call");
        response.setSignalType(signalType);
        response.setEvent("IDLE");
        response.setAppointmentId(appointment.getAppointmentId());
        response.setRoomId(buildRoomId(appointment));
        response.setReason(reason);
        response.setTimestamp(TimezoneUtil.now());
        return response;
    }

    private void dispatchToParticipants(TelemedicineCallSession session, TelemedicineCallEventResponse event, boolean includeRoomTopic) {
        if (session == null || event == null) {
            return;
        }

        sendToUser(session.getCaller(), event);
        sendToUser(session.getReceiver(), event);

        if (includeRoomTopic && event.getRoomId() != null) {
            messagingTemplate.convertAndSend("/topic/room/" + event.getRoomId(), event);
        }
    }

    private void sendToUser(User user, TelemedicineCallEventResponse event) {
        if (user == null || event == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return;
        }

        messagingTemplate.convertAndSendToUser(user.getEmail(), USER_CALL_QUEUE, event);
    }

    private String resolveDisplayName(User user) {
        if (user == null) {
            return null;
        }

        String firstName = user.getFirstName() != null ? user.getFirstName().trim() : "";
        String lastName = user.getLastName() != null ? user.getLastName().trim() : "";
        String fullName = (firstName + " " + lastName).trim();
        return fullName.isBlank() ? user.getEmail() : fullName;
    }

    private String normalizeCallType(String callType) {
        if (callType == null || callType.isBlank()) {
            return "VIDEO";
        }

        String normalized = callType.trim().toUpperCase(Locale.ROOT);
        if (!"VIDEO".equals(normalized) && !"AUDIO".equals(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "callType must be VIDEO or AUDIO");
        }
        return normalized;
    }

    private String normalizeReason(String reason, String fallback) {
        if (reason == null || reason.isBlank()) {
            return fallback;
        }
        return reason.trim();
    }

    private enum ParticipantRole {
        PATIENT,
        DOCTOR
    }
}