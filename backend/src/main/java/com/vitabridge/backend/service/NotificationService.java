package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.NotificationResponse;
import com.vitabridge.backend.model.Assistant;
import com.vitabridge.backend.model.Appointment;
import com.vitabridge.backend.model.Notification;
import com.vitabridge.backend.model.Role;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.AssistantRepository;
import com.vitabridge.backend.repository.AppointmentRepository;
import com.vitabridge.backend.repository.NotificationRepository;
import com.vitabridge.backend.repository.UserRepository;
import com.vitabridge.backend.util.TimezoneUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    private static final Logger logger = LoggerFactory.getLogger(NotificationService.class);
    private static final EnumSet<Notification.NotificationType> EMAIL_NOTIFICATION_TYPES = EnumSet.of(
        Notification.NotificationType.APPOINTMENT_CONFIRMED,
        Notification.NotificationType.APPOINTMENT_CANCELLED,
        Notification.NotificationType.PRESCRIPTION_RECEIVED,
        Notification.NotificationType.SCHEDULE_CHANGED,
        Notification.NotificationType.SYSTEM_COMPLAINT,
        Notification.NotificationType.REMINDER);

    private static final EnumSet<Notification.NotificationType> ASSISTANT_FAN_OUT_TYPES = EnumSet.of(
        Notification.NotificationType.APPOINTMENT_REQUEST,
        Notification.NotificationType.APPOINTMENT_CONFIRMED,
        Notification.NotificationType.APPOINTMENT_REJECTED,
        Notification.NotificationType.APPOINTMENT_CANCELLED,
        Notification.NotificationType.APPOINTMENT_COMPLETED);

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AssistantRepository assistantRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${app.notification.from:}")
    private String notificationFrom;

    @Value("${app.notification.email-enabled:true}")
    private boolean emailEnabled;

    @Transactional
    public void createNotification(User user, String title, String message, Notification.NotificationType type) {
        persistNotification(user, title, message, type, null, null, true);
    }

    @Transactional
    public void createNotificationWithEntity(User user, String title, String message,
            Notification.NotificationType type, String entityType, Integer entityId) {
        persistNotification(user, title, message, type, entityType, entityId, true);
    }

    @Transactional
    public void createNotificationWithEntity(User user, String title, String message,
            Notification.NotificationType type, String entityType, Integer entityId, boolean fanOutToAssistants) {
        persistNotification(user, title, message, type, entityType, entityId, fanOutToAssistants);
    }

    @Async("taskExecutor")
    public void dispatchCallNextNotificationBundleAsync(Integer appointmentId) {
        if (appointmentId == null) {
            return;
        }

        Appointment appointment = appointmentRepository.findById(appointmentId).orElse(null);
        if (appointment == null || appointment.getPatient() == null || appointment.getPatient().getUser() == null) {
            return;
        }

        User patient = appointment.getPatient().getUser();
        String title;
        String message;

        if (appointment.getAppointmentType() == Appointment.AppointmentType.ONLINE) {
            title = "Consultation In Progress";
            message = "Please join your telemedicine call";
        } else {
            title = "Consultation In Progress";
            message = "It's your turn, please proceed to the examination room";
        }

        // Popup/In-app notification (also published on realtime user queue).
        createNotificationWithEntity(
                patient,
                title,
                message,
                Notification.NotificationType.QUEUE_UPDATE,
                "APPOINTMENT",
                appointmentId,
                false);

        // Explicit email for call-next bundle without enabling email for all queue updates.
        sendEmailNotification(patient, title, message, Notification.NotificationType.QUEUE_UPDATE, appointmentId);
    }

    private void persistNotification(User user, String title, String message,
            Notification.NotificationType type, String entityType, Integer entityId, boolean fanOutToAssistants) {
        Notification notification = new Notification(user, title, message, type);
        notification.setRelatedEntityType(entityType);
        notification.setRelatedEntityId(entityId);
        Notification saved = notificationRepository.save(notification);
        publishRealtimeUpdate(user, saved, "CREATED");

        if (shouldSendEmail(type)) {
            sendEmailNotification(user, title, message, type, entityId);
        }

        if (fanOutToAssistants) {
            sendAssistantNotifications(saved, entityType, entityId);
        }
    }

    private void sendEmailNotification(User user, String title, String message,
            Notification.NotificationType type, Integer appointmentId) {
        if (!emailEnabled || user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return;
        }

        if (mailSender == null) {
            logger.warn("Email notification skipped for user {} because JavaMailSender is not configured", user.getEmail());
            return;
        }

        Appointment appointment = appointmentId != null
                ? appointmentRepository.findById(appointmentId).orElse(null)
                : null;

        try {
            var mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper mail = new MimeMessageHelper(mimeMessage, false, "UTF-8");

            mail.setTo(user.getEmail());
            if (notificationFrom != null && !notificationFrom.isBlank()) {
                mail.setFrom(notificationFrom);
            }

            mail.setSubject(getNotificationEmailSubject(type, title, appointment));
            mail.setText(buildNotificationEmail(user, title, message, type, appointment), true);
            mailSender.send(mimeMessage);
        } catch (Exception ex) {
            logger.warn("Failed to send email notification to {}: {}", user.getEmail(), ex.getMessage());
        }
    }

    private boolean shouldSendEmail(Notification.NotificationType type) {
        return EMAIL_NOTIFICATION_TYPES.contains(type);
    }

    private void sendAssistantNotifications(Notification sourceNotification, String entityType, Integer entityId) {
        if (!"APPOINTMENT".equals(entityType) || entityId == null || sourceNotification.getUser() == null) {
            return;
        }

        Notification.NotificationType type = sourceNotification.getType();
        if (!ASSISTANT_FAN_OUT_TYPES.contains(type)) {
            return;
        }

        if (sourceNotification.getUser().getRole() == Role.ASSISTANT || sourceNotification.getUser().getRole() == Role.ADMIN) {
            return;
        }

        Appointment appointment = appointmentRepository.findById(entityId).orElse(null);
        if (appointment == null || appointment.getDoctor() == null || appointment.getDoctor().getDoctorId() == null) {
            return;
        }

        List<Assistant> assistants = assistantRepository.findByDoctorDoctorId(appointment.getDoctor().getDoctorId());
        if (assistants.isEmpty()) {
            return;
        }

        String assistantTitle = buildAssistantNotificationTitle(type);
        String assistantMessage = buildAssistantNotificationMessage(type, appointment);

        for (Assistant assistant : assistants) {
            if (assistant == null || assistant.getUser() == null || assistant.getUser().getEmail() == null
                    || assistant.getUser().getEmail().isBlank()) {
                continue;
            }

            boolean alreadySent = notificationRepository.existsByUserAndRelatedEntityTypeAndRelatedEntityIdAndTitleAndMessage(
                    assistant.getUser(),
                    entityType,
                    entityId,
                    assistantTitle,
                    assistantMessage);

            if (!alreadySent) {
                persistNotification(assistant.getUser(), assistantTitle, assistantMessage, type, entityType, entityId,
                        false);
            }
        }
    }

            @Scheduled(cron = "${app.notification.reminder-cron:0 0 8 * * *}")
            @Transactional
            public void dispatchAppointmentReminders() {
            LocalDate reminderDate = TimezoneUtil.todayInDhaka().plusDays(1);
            List<Appointment> appointments = appointmentRepository.findByAppointmentDateAndStatusIn(reminderDate, List.of(
                Appointment.AppointmentStatus.PENDING,
                Appointment.AppointmentStatus.PAYMENT_PENDING,
                Appointment.AppointmentStatus.CONFIRMED,
                Appointment.AppointmentStatus.SCHEDULED,
                Appointment.AppointmentStatus.IN_PROGRESS));

            for (Appointment appointment : appointments) {
                if (appointment.getPatient() == null || appointment.getPatient().getUser() == null) {
                continue;
                }

                User patient = appointment.getPatient().getUser();
                String title = "Appointment Reminder";
                String message = String.format(
                    "Reminder: You have an appointment with Dr. %s %s on %s at %s (Queue #%s).",
                    appointment.getDoctor() != null && appointment.getDoctor().getUser() != null
                        ? appointment.getDoctor().getUser().getFirstName()
                        : "Your doctor",
                    appointment.getDoctor() != null && appointment.getDoctor().getUser() != null
                        ? appointment.getDoctor().getUser().getLastName()
                        : "",
                    appointment.getAppointmentDate(),
                    appointment.getAppointmentTime(),
                    appointment.getSerialNumber() != null ? appointment.getSerialNumber() : "N/A");

                boolean alreadySent = notificationRepository.existsByUserAndRelatedEntityTypeAndRelatedEntityIdAndTitleAndMessage(
                    patient,
                    "APPOINTMENT",
                    appointment.getAppointmentId(),
                    title,
                    message);

                if (!alreadySent) {
                createNotificationWithEntity(patient, title, message, Notification.NotificationType.REMINDER,
                    "APPOINTMENT", appointment.getAppointmentId(), false);
                }
            }
            }

    private String getNotificationEmailSubject(Notification.NotificationType type, String title, Appointment appointment) {
        return switch (type) {
            case APPOINTMENT_CONFIRMED -> "[VitaBridge] Appointment Booking Confirmation";
            case APPOINTMENT_CANCELLED -> "[VitaBridge] Appointment Cancelled";
            case PRESCRIPTION_RECEIVED -> "[VitaBridge] Prescription Received";
            case SCHEDULE_CHANGED -> "[VitaBridge] Schedule Changed";
            case SYSTEM_COMPLAINT -> "[VitaBridge] Complaint Update";
            case REMINDER -> "[VitaBridge] Appointment Reminder";
            case QUEUE_UPDATE -> "[VitaBridge] Queue Update";
            default -> title != null && !title.isBlank() ? "[VitaBridge] " + title : "[VitaBridge] Notification";
        };
    }

    private String buildNotificationEmail(User user, String title, String message,
            Notification.NotificationType type, Appointment appointment) {
        if (type == Notification.NotificationType.APPOINTMENT_CONFIRMED) {
            return buildAppointmentConfirmationEmail(user, title, message, appointment);
        }

        String fullName = buildFullName(user);
        String appointmentSummary = buildAppointmentSummary(appointment);
        String html = """
                        <!doctype html>
                        <html>
                        <head>
                            <meta charset="UTF-8" />
                            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                        </head>
                        <body style="margin:0;padding:0;background:#f3f6fb;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 12px;">
                                <tr>
                                    <td align="center">
                                        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
                                            <tr>
                                                <td style="background:linear-gradient(135deg,#0f766e,#115e59);padding:16px 24px;color:#ffffff;">
                                                    <div style="font-size:20px;font-weight:700;letter-spacing:0.2px;">VitaBridge</div>
                                                    <div style="font-size:13px;opacity:0.95;margin-top:2px;">__SUBJECT__</div>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:24px;">
                                                    <p style="margin:0 0 12px 0;font-size:15px;">Dear __FULL_NAME__,</p>
                                                    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#374151;">
                                                        __MESSAGE__
                                                    </p>
                                                    __APPOINTMENT_SUMMARY__
                                                    <p style="margin:20px 0 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
                                                        This notification was generated automatically by VitaBridge.
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </body>
                        </html>
                        """;

        return html
                .replace("__SUBJECT__", escapeHtml(getNotificationEmailSubject(type, title, appointment)))
                .replace("__FULL_NAME__", escapeHtml(fullName))
                .replace("__MESSAGE__", escapeHtml(message))
                .replace("__APPOINTMENT_SUMMARY__", appointmentSummary);
    }

    private String buildFullName(User user) {
        if (user == null) {
            return "Valued User";
        }

        String fullName = ((user.getFirstName() != null ? user.getFirstName() : "") + " "
                + (user.getLastName() != null ? user.getLastName() : "")).trim();
        return fullName.isBlank() ? "Valued User" : fullName;
    }

    private String buildAppointmentSummary(Appointment appointment) {
        if (appointment == null) {
            return "";
        }

        String doctorName = appointment.getDoctor() != null && appointment.getDoctor().getUser() != null
                ? buildFullName(appointment.getDoctor().getUser())
                : "Your doctor";
        String date = appointment.getAppointmentDate() != null ? appointment.getAppointmentDate().toString() : "As scheduled";
        String time = appointment.getAppointmentTime() != null ? appointment.getAppointmentTime().toString() : "As scheduled";
        String token = appointment.getSerialNumber() != null ? "#" + appointment.getSerialNumber() : "N/A";

        return """
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;border:1px solid #dbeafe;background:#f8fbff;border-radius:12px;">
                            <tr>
                                <td style="padding:16px 18px;line-height:1.7;color:#374151;font-size:14px;">
                                    <div><strong>Queue Token:</strong> __TOKEN__</div>
                                    <div><strong>Doctor:</strong> __DOCTOR__</div>
                                    <div><strong>Date:</strong> __DATE__</div>
                                    <div><strong>Time:</strong> __TIME__</div>
                                </td>
                            </tr>
                        </table>
                        """
                .replace("__TOKEN__", escapeHtml(token))
                .replace("__DOCTOR__", escapeHtml(doctorName))
                .replace("__DATE__", escapeHtml(date))
                .replace("__TIME__", escapeHtml(time));
    }

    private String buildAssistantNotificationTitle(Notification.NotificationType type) {
        return switch (type) {
            case APPOINTMENT_REQUEST -> "Appointment Request";
            case APPOINTMENT_CONFIRMED -> "Appointment Confirmed";
            case APPOINTMENT_REJECTED -> "Appointment Rejected";
            case APPOINTMENT_CANCELLED -> "Appointment Cancelled";
            case APPOINTMENT_COMPLETED -> "Appointment Completed";
            default -> "Appointment Update";
        };
    }

    private String buildAssistantNotificationMessage(Notification.NotificationType type, Appointment appointment) {
        String patientName = appointment != null && appointment.getPatient() != null && appointment.getPatient().getUser() != null
                ? buildFullName(appointment.getPatient().getUser())
                : "a patient";
        String doctorName = appointment != null && appointment.getDoctor() != null && appointment.getDoctor().getUser() != null
                ? buildFullName(appointment.getDoctor().getUser())
                : "the assigned doctor";
        String date = appointment != null && appointment.getAppointmentDate() != null ? appointment.getAppointmentDate().toString()
                : "As scheduled";
        String time = appointment != null && appointment.getAppointmentTime() != null ? appointment.getAppointmentTime().toString()
                : "As scheduled";
        String token = appointment != null && appointment.getSerialNumber() != null ? "#" + appointment.getSerialNumber() : "N/A";

        return switch (type) {
            case APPOINTMENT_REQUEST -> String.format(
                    "Appointment %s for %s with Dr. %s on %s at %s has been requested.", token, patientName,
                    doctorName, date, time);
            case APPOINTMENT_CONFIRMED -> String.format(
                    "Appointment %s for %s with Dr. %s on %s at %s has been confirmed.", token, patientName,
                    doctorName, date, time);
            case APPOINTMENT_REJECTED -> String.format(
                    "Appointment %s for %s with Dr. %s on %s at %s has been rejected.", token, patientName,
                    doctorName, date, time);
            case APPOINTMENT_CANCELLED -> String.format(
                    "Appointment %s for %s with Dr. %s on %s at %s has been cancelled.", token, patientName,
                    doctorName, date, time);
            case APPOINTMENT_COMPLETED -> String.format(
                    "Appointment %s for %s with Dr. %s on %s at %s has been completed.", token, patientName,
                    doctorName, date, time);
            default -> String.format("Appointment update for %s with Dr. %s on %s at %s.", patientName, doctorName,
                    date, time);
        };
    }

    private String escapeHtml(String value) {
        if (value == null) {
            return "";
        }

        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

        private String buildAppointmentConfirmationEmail(User user, String title, String message, Appointment appointment) {
            String fullName = buildFullName(user);

                String token = appointment != null && appointment.getSerialNumber() != null
                                ? "#" + appointment.getSerialNumber()
                                : "N/A";
                String date = appointment != null && appointment.getAppointmentDate() != null
                                ? appointment.getAppointmentDate().toString()
                                : "As scheduled";
                String time = appointment != null && appointment.getAppointmentTime() != null
                                ? appointment.getAppointmentTime().toString()
                                : "As scheduled";
                String doctor = appointment != null && appointment.getDoctor() != null && appointment.getDoctor().getUser() != null
                                ? (appointment.getDoctor().getUser().getFirstName() + " "
                                                + appointment.getDoctor().getUser().getLastName()).trim()
                                : "Your doctor";

                String html = """
                                <!doctype html>
                                <html>
                                <head>
                                    <meta charset="UTF-8" />
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                                </head>
                                <body style="margin:0;padding:0;background:#f3f6fb;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 12px;">
                                        <tr>
                                            <td align="center">
                                                <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
                                                    <tr>
                                                        <td style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:16px 24px;color:#ffffff;">
                                                            <div style="font-size:20px;font-weight:700;letter-spacing:0.2px;">VitaBridge</div>
                                                            <div style="font-size:13px;opacity:0.95;margin-top:2px;">Appointment Booking Confirmation</div>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding:24px;">
                                                            <p style="margin:0 0 12px 0;font-size:15px;">Dear __FULL_NAME__,</p>
                                                            <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#374151;">
                                                                __TITLE__<br/>__MESSAGE__
                                                            </p>
                                                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dbeafe;background:#f8fbff;border-radius:12px;">
                                                                <tr>
                                                                    <td style="padding:16px 18px;">
                                                                        <div style="font-size:12px;color:#6b7280;letter-spacing:0.3px;text-transform:uppercase;">Queue Token</div>
                                                                        <div style="display:inline-block;margin-top:8px;background:#1d4ed8;color:#ffffff;font-weight:700;font-size:26px;line-height:1;padding:10px 14px;border-radius:10px;">__TOKEN__</div>
                                                                        <div style="margin-top:16px;font-size:14px;color:#374151;line-height:1.7;">
                                                                            <div><strong>Doctor:</strong> __DOCTOR__</div>
                                                                            <div><strong>Date:</strong> __DATE__</div>
                                                                            <div><strong>Estimated Time:</strong> __TIME__</div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                            <p style="margin:18px 0 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
                                                                Please arrive on time and keep your token ready. If any schedule changes happen, you will still receive in-app notifications.
                                                            </p>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
                                                            This is an automated email from VitaBridge Healthcare.
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </body>
                                </html>
                                """;

                return html
                                .replace("__FULL_NAME__", escapeHtml(fullName))
                                .replace("__TITLE__", escapeHtml(title))
                                .replace("__MESSAGE__", escapeHtml(message))
                                .replace("__TOKEN__", escapeHtml(token))
                                .replace("__DOCTOR__", escapeHtml(doctor))
                                .replace("__DATE__", escapeHtml(date))
                                .replace("__TIME__", escapeHtml(time));
        }

    public List<NotificationResponse> getUserNotifications(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Notification> notifications = notificationRepository.findByUserOrderByCreatedAtDesc(user);
        return notifications.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    public List<NotificationResponse> getUnreadNotifications(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Notification> notifications = notificationRepository.findByUserAndIsReadFalseOrderByCreatedAtDesc(user);
        return notifications.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    public Long getUnreadCount(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return notificationRepository.countByUserAndIsReadFalse(user);
    }

    @Transactional
    public void markAsRead(Integer notificationId, String userEmail) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        if (!notification.getUser().getEmail().equals(userEmail)) {
            throw new RuntimeException("Unauthorized to access this notification");
        }

        notification.setIsRead(true);
        Notification saved = notificationRepository.save(notification);
        publishRealtimeUpdate(saved.getUser(), saved, "READ");
    }

    @Transactional
    public void markAllAsRead(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Notification> unreadNotifications = notificationRepository
                .findByUserAndIsReadFalseOrderByCreatedAtDesc(user);
        unreadNotifications.forEach(notification -> notification.setIsRead(true));
        notificationRepository.saveAll(unreadNotifications);
        publishRealtimeUpdate(user, null, "READ_ALL");
    }

    private void publishRealtimeUpdate(User user, Notification notification, String eventType) {
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return;
        }

        Runnable publishAction = () -> {
            Long unreadCount = notificationRepository.countByUserAndIsReadFalse(user);
            Map<String, Object> payload = new HashMap<>();
            payload.put("eventType", eventType);
            payload.put("unreadCount", unreadCount != null ? unreadCount : 0L);
            if (notification != null) {
                payload.put("notification", convertToResponse(notification));
            }
            messagingTemplate.convertAndSendToUser(user.getEmail(), "/queue/notifications", payload);
        };

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publishAction.run();
                }
            });
            return;
        }

        publishAction.run();
    }

    private NotificationResponse convertToResponse(Notification notification) {
        NotificationResponse response = new NotificationResponse();
        response.setNotificationId(notification.getNotificationId());
        response.setTitle(notification.getTitle());
        response.setMessage(notification.getMessage());
        response.setType(notification.getType().toString());
        response.setIsRead(notification.getIsRead());
        response.setRelatedEntityType(notification.getRelatedEntityType());
        response.setRelatedEntityId(notification.getRelatedEntityId());
        response.setCreatedAt(notification.getCreatedAt());

        if ("APPOINTMENT".equals(notification.getRelatedEntityType())
                && notification.getRelatedEntityId() != null) {
            Appointment appointment = appointmentRepository.findById(notification.getRelatedEntityId())
                    .orElse(null);
            if (appointment != null) {
                response.setAppointmentType(appointment.getAppointmentType().toString());
                response.setAppointmentStatus(appointment.getStatus().toString());
            }
        }

        return response;
    }

    /**
     * Sends OTP verification email to the user.
     *
     * @param email      The email address to send OTP to
     * @param otp        The OTP code
     * @param purpose    The purpose of OTP (REGISTRATION, PASSWORD_RESET, PASSWORD_CHANGE)
     * @return true if email sent successfully, false otherwise
     */
    public boolean sendOtpEmail(String email, String otp, String purpose) {
        if (email == null || email.isBlank() || !emailEnabled) {
            logger.warn("OTP email skipped for {} - email disabled or invalid address", email);
            return false;
        }

        if (mailSender == null) {
            logger.warn("OTP email skipped for {} because JavaMailSender is not configured", email);
            return false;
        }

        try {
            var mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper mail = new MimeMessageHelper(mimeMessage, false, "UTF-8");

            mail.setTo(email);
            if (notificationFrom != null && !notificationFrom.isBlank()) {
                mail.setFrom(notificationFrom);
            }

            String subject = getOtpEmailSubject(purpose);
            mail.setSubject(subject);
            mail.setText(buildOtpEmail(email, otp, purpose), true);
            mailSender.send(mimeMessage);

            logger.info("OTP email sent successfully to: {}", email);
            return true;
        } catch (Exception ex) {
            logger.warn("Failed to send OTP email to {}: {}", email, ex.getMessage());
            return false;
        }
    }

    private String getOtpEmailSubject(String purpose) {
        return switch (purpose.toUpperCase()) {
            case "REGISTRATION" -> "[VitaBridge] Verify Your Email - Registration";
            case "PASSWORD_RESET" -> "[VitaBridge] Reset Your Password";
            case "PASSWORD_CHANGE" -> "[VitaBridge] Confirm Password Change";
            default -> "[VitaBridge] Verification Code";
        };
    }

    private String buildOtpEmail(String email, String otp, String purpose) {
        String title = getOtpEmailTitle(purpose);
        String description = getOtpEmailDescription(purpose);

        String html = """
                        <!doctype html>
                        <html>
                        <head>
                            <meta charset="UTF-8" />
                            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                        </head>
                        <body style="margin:0;padding:0;background:#f3f6fb;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 12px;">
                                <tr>
                                    <td align="center">
                                        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
                                            <tr>
                                                <td style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:16px 24px;color:#ffffff;">
                                                    <div style="font-size:20px;font-weight:700;letter-spacing:0.2px;">VitaBridge</div>
                                                    <div style="font-size:13px;opacity:0.95;margin-top:2px;">Email Verification</div>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:24px;">
                                                    <p style="margin:0 0 12px 0;font-size:15px;">Dear User,</p>
                                                    <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#374151;">
                                                        __TITLE__<br/>__DESCRIPTION__
                                                    </p>
                                                    <div style="text-align:center;margin:24px 0;">
                                                        <p style="margin:0 0 12px 0;font-size:13px;color:#6b7280;letter-spacing:0.3px;text-transform:uppercase;">Your Verification Code</p>
                                                        <div style="display:inline-block;background:#1d4ed8;color:#ffffff;font-weight:700;font-size:32px;line-height:1;padding:16px 24px;border-radius:12px;font-family:monospace;letter-spacing:8px;">__OTP__</div>
                                                    </div>
                                                    <p style="margin:24px 0 0 0;font-size:12px;color:#6b7280;line-height:1.6;">
                                                        <strong>This code expires in 10 minutes.</strong><br/>
                                                        If you didn't request this code, please ignore this email or contact support immediately.
                                                    </p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
                                                    This is an automated email from VitaBridge Healthcare. Please do not reply to this email.
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </body>
                        </html>
                        """;

        return html
            .replace("__TITLE__", escapeHtml(title))
            .replace("__DESCRIPTION__", escapeHtml(description))
            .replace("__OTP__", escapeHtml(otp));
    }

    private String getOtpEmailTitle(String purpose) {
        return switch (purpose.toUpperCase()) {
            case "REGISTRATION" -> "Welcome to VitaBridge!";
            case "PASSWORD_RESET" -> "Password Reset Request";
            case "PASSWORD_CHANGE" -> "Confirm Your Password Change";
            default -> "Verify Your Email";
        };
    }

    private String getOtpEmailDescription(String purpose) {
        return switch (purpose.toUpperCase()) {
            case "REGISTRATION" -> "Please use the verification code below to confirm your email address and complete your registration.";
            case "PASSWORD_RESET" -> "We received a request to reset your password. Please use the code below to proceed. If you didn't request this, please ignore this email.";
            case "PASSWORD_CHANGE" -> "You recently requested to change your password. Please confirm this action using the code below.";
            default -> "Please verify your email using the code below.";
        };
    }
}
