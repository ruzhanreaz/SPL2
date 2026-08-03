package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.ConsultationMessageRequest;
import com.vitabridge.backend.dto.ConsultationMessageResponse;
import com.vitabridge.backend.model.Appointment;
import com.vitabridge.backend.model.Assistant;
import com.vitabridge.backend.model.ConsultationMessage;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.AppointmentRepository;
import com.vitabridge.backend.repository.AssistantRepository;
import com.vitabridge.backend.repository.ConsultationMessageRepository;
import com.vitabridge.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ConsultationMessageService {

    private static final List<Appointment.AppointmentStatus> ACTIVE_ROOM_STATUSES = List.of(
            Appointment.AppointmentStatus.CONFIRMED,
            Appointment.AppointmentStatus.SCHEDULED,
            Appointment.AppointmentStatus.IN_PROGRESS);

    @Autowired
    private ConsultationMessageRepository consultationMessageRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AssistantRepository assistantRepository;

    public List<ConsultationMessageResponse> getMessages(Integer appointmentId, String requesterEmail) {
        AuthorizationContext context = resolveAuthorizationContext(appointmentId, requesterEmail);

        List<ConsultationMessage> messages = consultationMessageRepository
                .findByAppointmentDoctorDoctorIdAndAppointmentPatientPatientIdAndAppointmentAppointmentTypeOrderByCreatedAtAsc(
                        context.appointment().getDoctor().getDoctorId(),
                        context.appointment().getPatient().getPatientId(),
                        Appointment.AppointmentType.ONLINE);

        return messages.stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public ConsultationMessageResponse createMessage(
            Integer appointmentId,
            String requesterEmail,
            ConsultationMessageRequest request) {

        AuthorizationContext context = resolveAuthorizationContext(appointmentId, requesterEmail);

        if (request == null || request.getText() == null || request.getText().trim().isEmpty()) {
            throw new RuntimeException("Message text is required");
        }

        String text = request.getText().trim();
        if (text.length() > 2000) {
            throw new RuntimeException("Message must be 2000 characters or fewer");
        }

        Appointment writableAppointment = appointmentRepository
                .findFirstByDoctorDoctorIdAndPatientPatientIdAndAppointmentTypeAndStatusInOrderByAppointmentDateDescAppointmentTimeDescAppointmentIdDesc(
                        context.appointment().getDoctor().getDoctorId(),
                        context.appointment().getPatient().getPatientId(),
                        Appointment.AppointmentType.ONLINE,
                        ACTIVE_ROOM_STATUSES)
                .orElseThrow(() -> new RuntimeException("Session is ended. Messaging is locked."));

        ConsultationMessage message = new ConsultationMessage();
        message.setAppointment(writableAppointment);
        message.setSender(context.user());
        message.setSenderRole(context.senderRole());
        message.setMessageText(text);

        ConsultationMessage saved = consultationMessageRepository.save(message);
        return toResponse(saved);
    }

    private AuthorizationContext resolveAuthorizationContext(Integer appointmentId, String requesterEmail) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        if (appointment.getAppointmentType() != Appointment.AppointmentType.ONLINE) {
            throw new RuntimeException("Telemedicine messages are only available for online appointments");
        }

        User user = userRepository.findByEmail(requesterEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Integer userId = user.getUserId();

        if (appointment.getPatient().getUser().getUserId().equals(userId)) {
            return new AuthorizationContext(appointment, user, "patient");
        }

        if (appointment.getDoctor().getUser().getUserId().equals(userId)) {
            return new AuthorizationContext(appointment, user, "doctor");
        }

        Assistant assistant = assistantRepository.findByUserUserId(userId).orElse(null);
        if (assistant != null
                && assistant.getDoctor() != null
                && assistant.getDoctor().getDoctorId().equals(appointment.getDoctor().getDoctorId())) {
            return new AuthorizationContext(appointment, user, "assistant");
        }

        throw new RuntimeException("Not authorized for this telemedicine appointment");
    }

    private ConsultationMessageResponse toResponse(ConsultationMessage message) {
        User sender = message.getSender();
        String firstName = sender.getFirstName() == null ? "" : sender.getFirstName().trim();
        String lastName = sender.getLastName() == null ? "" : sender.getLastName().trim();
        String fullName = (firstName + " " + lastName).trim();

        return new ConsultationMessageResponse(
                message.getMessageId(),
                message.getAppointment().getAppointmentId(),
                sender.getUserId(),
                message.getSenderRole(),
                fullName.isBlank() ? "Participant" : fullName,
                message.getMessageText(),
                message.getCreatedAt());
    }

    private record AuthorizationContext(Appointment appointment, User user, String senderRole) {
    }
}
