package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.*;
import com.vitabridge.backend.model.*;
import com.vitabridge.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class AssistantAppointmentService {

        @Autowired
        private AppointmentRepository appointmentRepository;

        @Autowired
        private PatientRepository patientRepository;

        @Autowired
        private UserRepository userRepository;

        @Autowired
        private AssistantRepository assistantRepository;

        @Autowired
        private AssistantLogRepository assistantLogRepository;

        @Autowired
        private PasswordEncoder passwordEncoder;

        @Autowired
        private NotificationService notificationService;

        @Value("${app.timezone:Asia/Dhaka}")
        private String appTimezone;

        public List<AppointmentResponse> getDoctorAppointments(String assistantEmail) {
                User user = userRepository.findByEmail(assistantEmail)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                Assistant assistant = assistantRepository.findByUserUserId(user.getUserId())
                                .orElseThrow(() -> new RuntimeException("Assistant profile not found"));

                if (assistant.getDoctor() == null) {
                        throw new RuntimeException("Assistant is not assigned to a doctor");
                }

                List<Appointment> appointments = appointmentRepository
                                .findByDoctorOrderByAppointmentDateDescAppointmentTimeDesc(assistant.getDoctor());

                return appointments.stream()
                                .map(this::convertToResponse)
                                .collect(Collectors.toList());
        }

        @Transactional
        public AppointmentResponse confirmAppointment(Integer appointmentId, String assistantEmail) {
                User user = userRepository.findByEmail(assistantEmail)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                Assistant assistant = assistantRepository.findByUserUserId(user.getUserId())
                                .orElseThrow(() -> new RuntimeException("Assistant profile not found"));

                Appointment appointment = appointmentRepository.findById(appointmentId)
                                .orElseThrow(() -> new RuntimeException("Appointment not found"));

                if (!appointment.getDoctor().getDoctorId().equals(assistant.getDoctor().getDoctorId())) {
                        throw new RuntimeException("This appointment does not belong to your assigned doctor");
                }

                if (appointment.getStatus() != Appointment.AppointmentStatus.PENDING) {
                        throw new RuntimeException("Only pending appointments can be confirmed");
                }

                appointment.setStatus(Appointment.AppointmentStatus.CONFIRMED);
                Appointment savedAppointment = appointmentRepository.save(appointment);

                // Log the activity
                String description = String.format(
                                "Confirmed appointment for %s on %s at %s",
                                appointment.getPatient().getUser().getFirstName() + " " +
                                                appointment.getPatient().getUser().getLastName(),
                                appointment.getAppointmentDate(),
                                appointment.getAppointmentTime());
                logActivity(assistant, "APPOINTMENT_CONFIRMED", description, "APPOINTMENT", appointmentId);

                // Send notification to patient
                String notificationMessage = String.format(
                                "Your appointment on %s at %s has been confirmed",
                                appointment.getAppointmentDate(), appointment.getAppointmentTime());
                notificationService.createNotificationWithEntity(
                                appointment.getPatient().getUser(),
                                "Appointment Confirmed",
                                notificationMessage,
                                Notification.NotificationType.APPOINTMENT_CONFIRMED,
                                "APPOINTMENT",
                                appointmentId);

                // Send notification to assistant
                String assistantNotificationMessage = String.format(
                                "You confirmed an appointment for %s %s on %s at %s",
                                appointment.getPatient().getUser().getFirstName(),
                                appointment.getPatient().getUser().getLastName(),
                                appointment.getAppointmentDate(),
                                appointment.getAppointmentTime());
                notificationService.createNotificationWithEntity(
                                assistant.getUser(),
                                "Appointment Confirmed",
                                assistantNotificationMessage,
                                Notification.NotificationType.APPOINTMENT_CONFIRMED,
                                "APPOINTMENT",
                                appointmentId);

                return convertToResponse(savedAppointment);
        }

        @Transactional
        public AppointmentResponse confirmPayment(Integer appointmentId, String assistantEmail) {
                User user = userRepository.findByEmail(assistantEmail)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                Assistant assistant = assistantRepository.findByUserUserId(user.getUserId())
                                .orElseThrow(() -> new RuntimeException("Assistant profile not found"));

                Appointment appointment = appointmentRepository.findById(appointmentId)
                                .orElseThrow(() -> new RuntimeException("Appointment not found"));

                if (!appointment.getDoctor().getDoctorId().equals(assistant.getDoctor().getDoctorId())) {
                        throw new RuntimeException("This appointment does not belong to your assigned doctor");
                }

                if (appointment.getStatus() != Appointment.AppointmentStatus.PAYMENT_PENDING) {
                        throw new RuntimeException("Only payment-pending appointments can be marked as paid");
                }

                appointment.setStatus(Appointment.AppointmentStatus.CONFIRMED);
                Appointment savedAppointment = appointmentRepository.save(appointment);

                String description = String.format(
                                "Confirmed offline payment for %s on %s at %s",
                                appointment.getPatient().getUser().getFirstName() + " " +
                                                appointment.getPatient().getUser().getLastName(),
                                appointment.getAppointmentDate(),
                                appointment.getAppointmentTime());
                logActivity(assistant, "PAYMENT_CONFIRMED", description, "APPOINTMENT", appointmentId);

                String notificationMessage = String.format(
                                "Your payment for appointment on %s at %s has been confirmed and the appointment is now confirmed.",
                                appointment.getAppointmentDate(), appointment.getAppointmentTime());
                notificationService.createNotificationWithEntity(
                                appointment.getPatient().getUser(),
                                "Payment Confirmed",
                                notificationMessage,
                                Notification.NotificationType.APPOINTMENT_CONFIRMED,
                                "APPOINTMENT",
                                appointmentId);

                String doctorNotificationMessage = String.format(
                                "Assistant %s %s confirmed payment and appointment for %s %s on %s at %s.",
                                assistant.getUser().getFirstName(),
                                assistant.getUser().getLastName(),
                                appointment.getPatient().getUser().getFirstName(),
                                appointment.getPatient().getUser().getLastName(),
                                appointment.getAppointmentDate(),
                                appointment.getAppointmentTime());
                notificationService.createNotificationWithEntity(
                                appointment.getDoctor().getUser(),
                                "Payment Confirmed",
                                doctorNotificationMessage,
                                Notification.NotificationType.APPOINTMENT_CONFIRMED,
                                "APPOINTMENT",
                                appointmentId);

                return convertToResponse(savedAppointment);
        }

        @Transactional
        public AppointmentResponse rejectAppointment(Integer appointmentId, String assistantEmail, String reason) {
                User user = userRepository.findByEmail(assistantEmail)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                Assistant assistant = assistantRepository.findByUserUserId(user.getUserId())
                                .orElseThrow(() -> new RuntimeException("Assistant profile not found"));

                Appointment appointment = appointmentRepository.findById(appointmentId)
                                .orElseThrow(() -> new RuntimeException("Appointment not found"));

                if (!appointment.getDoctor().getDoctorId().equals(assistant.getDoctor().getDoctorId())) {
                        throw new RuntimeException("This appointment does not belong to your assigned doctor");
                }

                if (appointment.getStatus() != Appointment.AppointmentStatus.PENDING &&
                                appointment.getStatus() != Appointment.AppointmentStatus.PAYMENT_PENDING) {
                        throw new RuntimeException("Only pending or payment-pending appointments can be rejected");
                }

                appointment.setStatus(Appointment.AppointmentStatus.REJECTED);
                appointment.setRejectionReason(reason);
                Appointment savedAppointment = appointmentRepository.save(appointment);

                String description = String.format(
                                "Rejected appointment for %s on %s at %s. Reason: %s",
                                appointment.getPatient().getUser().getFirstName() + " " +
                                                appointment.getPatient().getUser().getLastName(),
                                appointment.getAppointmentDate(),
                                appointment.getAppointmentTime(),
                                reason);
                logActivity(assistant, "APPOINTMENT_REJECTED", description, "APPOINTMENT", appointmentId);

                String patientNotification = String.format(
                                "Your appointment request for %s at %s has been rejected. Reason: %s",
                                appointment.getAppointmentDate(),
                                appointment.getAppointmentTime(),
                                reason);
                notificationService.createNotificationWithEntity(
                                appointment.getPatient().getUser(),
                                "Appointment Request Rejected",
                                patientNotification,
                                Notification.NotificationType.APPOINTMENT_REJECTED,
                                "APPOINTMENT",
                                appointmentId);

                return convertToResponse(savedAppointment);
        }

        @Transactional
        public AppointmentResponse cancelInPersonAppointment(Integer appointmentId, String assistantEmail,
                        String reason) {
                User user = userRepository.findByEmail(assistantEmail)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                Assistant assistant = assistantRepository.findByUserUserId(user.getUserId())
                                .orElseThrow(() -> new RuntimeException("Assistant profile not found"));

                Appointment appointment = appointmentRepository.findById(appointmentId)
                                .orElseThrow(() -> new RuntimeException("Appointment not found"));

                if (!appointment.getDoctor().getDoctorId().equals(assistant.getDoctor().getDoctorId())) {
                        throw new RuntimeException("This appointment does not belong to your assigned doctor");
                }

                if (appointment.getAppointmentType() != Appointment.AppointmentType.IN_PERSON) {
                        throw new RuntimeException("Only in-person appointments can be cancelled by assistant");
                }

                if (appointment.getStatus() == Appointment.AppointmentStatus.CANCELLED ||
                                appointment.getStatus() == Appointment.AppointmentStatus.REJECTED) {
                        throw new RuntimeException("Appointment is already cancelled or rejected");
                }

                appointment.setStatus(Appointment.AppointmentStatus.CANCELLED);
                appointment.setCancelledBy(assistantEmail);
                appointment.setCancellationReason(reason);
                Appointment savedAppointment = appointmentRepository.save(appointment);

                // Log the activity
                String description = String.format(
                                "Cancelled in-person appointment for %s on %s at %s. Reason: %s",
                                appointment.getPatient().getUser().getFirstName() + " " +
                                                appointment.getPatient().getUser().getLastName(),
                                appointment.getAppointmentDate(),
                                appointment.getAppointmentTime(),
                                reason);
                logActivity(assistant, "APPOINTMENT_CANCELLED", description, "APPOINTMENT", appointmentId);

                // Send notification to patient
                String notificationMessage = String.format(
                                "Your appointment on %s at %s has been cancelled. Reason: %s",
                                appointment.getAppointmentDate(), appointment.getAppointmentTime(), reason);
                notificationService.createNotificationWithEntity(
                                appointment.getPatient().getUser(),
                                "Appointment Cancelled",
                                notificationMessage,
                                Notification.NotificationType.APPOINTMENT_CANCELLED,
                                "APPOINTMENT",
                                appointmentId);

                return convertToResponse(savedAppointment);
        }

        @Transactional
        public AppointmentResponse markAsCompleted(Integer appointmentId, String assistantEmail) {
                User user = userRepository.findByEmail(assistantEmail)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                Assistant assistant = assistantRepository.findByUserUserId(user.getUserId())
                                .orElseThrow(() -> new RuntimeException("Assistant profile not found"));

                Appointment appointment = appointmentRepository.findById(appointmentId)
                                .orElseThrow(() -> new RuntimeException("Appointment not found"));

                if (!appointment.getDoctor().getDoctorId().equals(assistant.getDoctor().getDoctorId())) {
                        throw new RuntimeException("This appointment does not belong to your assigned doctor");
                }

                if (appointment.getStatus() != Appointment.AppointmentStatus.CONFIRMED &&
                                appointment.getStatus() != Appointment.AppointmentStatus.SCHEDULED) {
                        throw new RuntimeException("Only confirmed appointments can be marked as completed");
                }

                appointment.setStatus(Appointment.AppointmentStatus.COMPLETED);
                Appointment savedAppointment = appointmentRepository.save(appointment);

                // Log the activity
                String description = String.format(
                                "Marked appointment as completed for %s on %s at %s",
                                appointment.getPatient().getUser().getFirstName() + " " +
                                                appointment.getPatient().getUser().getLastName(),
                                appointment.getAppointmentDate(),
                                appointment.getAppointmentTime());
                logActivity(assistant, "APPOINTMENT_COMPLETED", description, "APPOINTMENT", appointmentId);

                String patientNotification = String.format(
                                "Your appointment on %s at %s has been marked as completed.",
                                appointment.getAppointmentDate(),
                                appointment.getAppointmentTime());
                notificationService.createNotificationWithEntity(
                                appointment.getPatient().getUser(),
                                "Appointment Completed",
                                patientNotification,
                                Notification.NotificationType.APPOINTMENT_COMPLETED,
                                "APPOINTMENT",
                                appointmentId);

                if (appointment.getRating() == null) {
                        String reviewMessage =
                                        "Your appointment is complete. Please rate your doctor and leave a review.";
                        notificationService.createNotificationWithEntity(
                                        appointment.getPatient().getUser(),
                                        "Rate Your Doctor",
                                        reviewMessage,
                                        Notification.NotificationType.REVIEW_REQUEST,
                                        "APPOINTMENT",
                                        appointmentId);
                }

                String doctorNotification = String.format(
                                "Appointment with %s %s on %s at %s has been marked as completed by your assistant.",
                                appointment.getPatient().getUser().getFirstName(),
                                appointment.getPatient().getUser().getLastName(),
                                appointment.getAppointmentDate(),
                                appointment.getAppointmentTime());
                notificationService.createNotificationWithEntity(
                                appointment.getDoctor().getUser(),
                                "Appointment Completed",
                                doctorNotification,
                                Notification.NotificationType.APPOINTMENT_COMPLETED,
                                "APPOINTMENT",
                                appointmentId);

                return convertToResponse(savedAppointment);
        }

        @Transactional
        public AppointmentResponse createAppointment(CreateAppointmentRequest request, String assistantEmail) {
                User assistantUser = userRepository.findByEmail(assistantEmail)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                Assistant assistant = assistantRepository.findByUserUserId(assistantUser.getUserId())
                                .orElseThrow(() -> new RuntimeException("Assistant profile not found"));

                if (assistant.getDoctor() == null) {
                        throw new RuntimeException("Assistant is not assigned to a doctor");
                }

                // Check if patient exists or create new one
                java.util.Optional<User> existingUserOpt = userRepository.findByEmail(request.getPatientEmail());
                boolean isNewPatient = existingUserOpt.isEmpty();
                User patientUser;
                Patient patient;

                if (isNewPatient) {
                        // Create new patient user with a temporary password
                        patientUser = new User();
                        String[] nameParts = request.getPatientName().split(" ", 2);
                        patientUser.setFirstName(nameParts[0]);
                        patientUser.setLastName(nameParts.length > 1 ? nameParts[1] : "");
                        patientUser.setEmail(request.getPatientEmail());
                        patientUser.setPhoneNumber(request.getPatientPhone());
                        String tempPassword = java.util.UUID.randomUUID().toString();
                        patientUser.setPassword(passwordEncoder.encode(tempPassword));
                        patientUser.setRole(Role.PATIENT);
                        patientUser.setIsActive(true);
                        patientUser = userRepository.save(patientUser);

                        // Create patient profile
                        patient = new Patient();
                        patient.setUser(patientUser);
                        patient = patientRepository.save(patient);
                } else {
                        patientUser = existingUserOpt.get();
                        patient = patientRepository.findByUserUserId(patientUser.getUserId())
                                        .orElseThrow(() -> new RuntimeException("Patient profile not found"));
                }

                // Validate date is in the future
                if (request.getAppointmentDate().isBefore(currentDate())) {
                        throw new RuntimeException("Appointment date must be in the future or today");
                }

                // Create appointment
                Appointment appointment = new Appointment();
                appointment.setPatient(patient);
                appointment.setDoctor(assistant.getDoctor());
                appointment.setAppointmentDate(request.getAppointmentDate());
                appointment.setAppointmentTime(request.getAppointmentTime());
                appointment.setAppointmentType(Appointment.AppointmentType.valueOf(request.getAppointmentType()));
                appointment.setNotes(request.getNotes());
                appointment.setStatus(Appointment.AppointmentStatus.CONFIRMED); // Auto-confirmed

                Appointment savedAppointment = appointmentRepository.save(appointment);

                // Log the activity
                String description = String.format(
                                "Created appointment for %s on %s at %s",
                                request.getPatientName(),
                                request.getAppointmentDate(),
                                request.getAppointmentTime());
                logActivity(assistant, "APPOINTMENT_CREATED", description, "APPOINTMENT",
                                savedAppointment.getAppointmentId());

                // Send notification only to pre-existing registered patients
                if (!isNewPatient) {
                        String notificationMessage = String.format(
                                        "An appointment has been scheduled for you on %s at %s",
                                        request.getAppointmentDate(), request.getAppointmentTime());
                        notificationService.createNotificationWithEntity(
                                        patientUser,
                                        "Appointment Scheduled",
                                        notificationMessage,
                                        Notification.NotificationType.APPOINTMENT_CONFIRMED,
                                        "APPOINTMENT",
                                        savedAppointment.getAppointmentId());
                }

                String doctorNotification = String.format(
                                "%s scheduled an appointment for %s on %s at %s.",
                                assistant.getUser().getFirstName() + " " + assistant.getUser().getLastName(),
                                request.getPatientName(),
                                request.getAppointmentDate(),
                                request.getAppointmentTime());
                notificationService.createNotificationWithEntity(
                                assistant.getDoctor().getUser(),
                                "Assistant Scheduled Appointment",
                                doctorNotification,
                                Notification.NotificationType.APPOINTMENT_CONFIRMED,
                                "APPOINTMENT",
                                savedAppointment.getAppointmentId());

                return convertToResponse(savedAppointment);
        }

        private void logActivity(Assistant assistant, String action, String description, String entityType,
                        Integer entityId) {
                AssistantLog log = new AssistantLog(assistant, assistant.getDoctor(), action, description);
                log.setEntityType(entityType);
                log.setEntityId(entityId);
                assistantLogRepository.save(log);
        }

        private AppointmentResponse convertToResponse(Appointment appointment) {
                AppointmentResponse response = new AppointmentResponse();
                response.setAppointmentId(appointment.getAppointmentId());

                // Patient details
                response.setPatientId(appointment.getPatient().getPatientId());
                response.setPatientName(appointment.getPatient().getUser().getFirstName() + " " +
                                appointment.getPatient().getUser().getLastName());
                response.setPatientEmail(appointment.getPatient().getUser().getEmail());
                response.setPatientPhone(appointment.getPatient().getUser().getPhoneNumber());

                // Doctor details
                response.setDoctorId(appointment.getDoctor().getDoctorId());
                response.setDoctorName(appointment.getDoctor().getUser().getFirstName() + " " +
                                appointment.getDoctor().getUser().getLastName());
                response.setDoctorSpecialization(appointment.getDoctor().getSpecialization());
                response.setDoctorEmail(appointment.getDoctor().getUser().getEmail());
                response.setDoctorPhone(appointment.getDoctor().getUser().getPhoneNumber());

                // Appointment details
                response.setAppointmentDate(appointment.getAppointmentDate());
                response.setAppointmentTime(appointment.getAppointmentTime());
                response.setAppointmentType(appointment.getAppointmentType().toString());
                response.setStatus(appointment.getStatus().toString());
                response.setNotes(appointment.getNotes());
                response.setCreatedAt(appointment.getCreatedAt());
                response.setUpdatedAt(appointment.getUpdatedAt());
                response.setCancelledBy(appointment.getCancelledBy());
                response.setCancellationReason(appointment.getCancellationReason());
                response.setRejectionReason(appointment.getRejectionReason());
                response.setRating(appointment.getRating());
                response.setReviewText(appointment.getReviewText());
                response.setRatedAt(appointment.getRatedAt());

                return response;
        }

        private LocalDate currentDate() {
                try {
                        return LocalDate.now(ZoneId.of(appTimezone));
                } catch (Exception ex) {
                        return LocalDate.now();
                }
        }
}
