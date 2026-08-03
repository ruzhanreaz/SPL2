package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.QueueStateDTO;
import com.vitabridge.backend.model.*;
import com.vitabridge.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class QueueService {

    private static final Set<Integer> QUEUE_ALERT_THRESHOLDS = Set.of(7, 5, 3, 1);

    @Autowired
    private QueueStateRepository queueStateRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private DoctorRepository doctorRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ScheduleRepository scheduleRepository;

    @Autowired
    private WeeklyScheduleRepository weeklyScheduleRepository;

    @Autowired
    private AssistantRepository assistantRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // -------------------------------------------------------------------------
    // Read queue state
    // -------------------------------------------------------------------------

    public QueueStateDTO getQueueState(Integer doctorId, LocalDate date) {
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new RuntimeException("Doctor not found"));

        QueueState state = queueStateRepository.findByDoctorAndQueueDate(doctor, date)
                .orElse(null);

        List<Appointment> allAppointments = appointmentRepository
                .findByDoctorOrderByAppointmentDateDescAppointmentTimeDesc(doctor)
                .stream()
                .filter(a -> a.getAppointmentDate().equals(date))
                .sorted((a, b) -> {
                    Integer sa = a.getSerialNumber() != null ? a.getSerialNumber() : 999;
                    Integer sb = b.getSerialNumber() != null ? b.getSerialNumber() : 999;
                    return sa.compareTo(sb);
                })
                .collect(Collectors.toList());

        return buildDTO(state, doctor, date, allAppointments);
    }

    public QueueStateDTO getQueueStateForDoctor(String doctorEmail, LocalDate date) {
        User user = userRepository.findByEmail(doctorEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Doctor doctor = doctorRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("Doctor not found"));
        return getQueueState(doctor.getDoctorId(), date);
    }

    public QueueStateDTO getQueueStateForAssistant(String assistantEmail, LocalDate date) {
        User user = userRepository.findByEmail(assistantEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Assistant assistant = assistantRepository.findByUserUserId(user.getUserId())
                .orElseThrow(() -> new RuntimeException("Assistant not found"));
        if (assistant.getDoctor() == null) {
            throw new RuntimeException("Assistant is not assigned to a doctor");
        }
        return getQueueState(assistant.getDoctor().getDoctorId(), date);
    }

    // -------------------------------------------------------------------------
    // Queue management actions
    // -------------------------------------------------------------------------

    @Transactional
    public QueueStateDTO startQueue(Integer doctorId, LocalDate date) {
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new RuntimeException("Doctor not found"));

        QueueState state = queueStateRepository.findByDoctorAndQueueDate(doctor, date)
                .orElse(new QueueState(doctor, date));
        state.setIsActive(true);
        if (state.getCurrentServingSerial() == null || state.getCurrentServingSerial() == 0) {
            state.setCurrentServingSerial(0);
        }
        queueStateRepository.save(state);

        QueueStateDTO dto = getQueueState(doctorId, date);
        notifyQueueThresholds(doctor, date, dto.getCurrentServingSerial());
        broadcast(doctorId, date, dto);
        return dto;
    }

    @Transactional
    public QueueStateDTO callNext(Integer doctorId, LocalDate date) {
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new RuntimeException("Doctor not found"));

        QueueState state = queueStateRepository.findByDoctorAndQueueDate(doctor, date)
                .orElse(new QueueState(doctor, date));

        // Mark current IN_PROGRESS appointment as COMPLETED if not already
        if (state.getCurrentServingSerial() != null && state.getCurrentServingSerial() > 0) {
            List<Appointment> current = appointmentRepository.findQueueByDoctorAndDate(doctor, date)
                    .stream()
                    .filter(a -> a.getSerialNumber() != null &&
                            a.getSerialNumber().equals(state.getCurrentServingSerial()) &&
                            a.getStatus() == Appointment.AppointmentStatus.IN_PROGRESS)
                    .collect(Collectors.toList());
            for (Appointment a : current) {
                a.setStatus(Appointment.AppointmentStatus.COMPLETED);
                appointmentRepository.save(a);
                notifyAppointmentCompleted(a, "Your consultation has been completed. Thank you for visiting.");
            }
        }

        // Find next appointment in queue (next serial after current)
        List<Appointment> pending = appointmentRepository.findQueueByDoctorAndDate(doctor, date)
                .stream()
                .filter(a -> a.getStatus() == Appointment.AppointmentStatus.CONFIRMED ||
                        a.getStatus() == Appointment.AppointmentStatus.SCHEDULED)
                .sorted((a, b) -> {
                    Integer sa = a.getSerialNumber() != null ? a.getSerialNumber() : 999;
                    Integer sb = b.getSerialNumber() != null ? b.getSerialNumber() : 999;
                    return sa.compareTo(sb);
                })
                .collect(Collectors.toList());

        if (!pending.isEmpty()) {
            Appointment next = pending.get(0);
            next.setStatus(Appointment.AppointmentStatus.IN_PROGRESS);
            appointmentRepository.save(next);
            state.setCurrentServingSerial(next.getSerialNumber());
            // Dispatch popup + realtime push + email bundle asynchronously.
            notificationService.dispatchCallNextNotificationBundleAsync(next.getAppointmentId());
        } else {
            state.setCurrentServingSerial(0);
        }

        state.setIsActive(true);
        queueStateRepository.save(state);

        QueueStateDTO dto = getQueueState(doctorId, date);
        notifyQueueThresholds(doctor, date, dto.getCurrentServingSerial());
        broadcast(doctorId, date, dto);
        return dto;
    }

    @Transactional
    public QueueStateDTO skipPatient(Integer appointmentId, Integer doctorId) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        if (!appointment.getDoctor().getDoctorId().equals(doctorId)) {
            throw new RuntimeException("Not authorized");
        }

        appointment.setStatus(Appointment.AppointmentStatus.NO_SHOW);
        appointmentRepository.save(appointment);

        String refundMessage = (appointment.getTransactionId() != null && !appointment.getTransactionId().isBlank())
            ? String.format(
                "Your queue token #%d on %s was skipped. A refund has been initiated for your appointment payment.",
                appointment.getSerialNumber(),
                appointment.getAppointmentDate())
            : String.format(
                "Your queue token #%d on %s was skipped. If you paid online, a refund notification will follow shortly.",
                appointment.getSerialNumber(),
                appointment.getAppointmentDate());

        // Notify patient
        notificationService.createNotificationWithEntity(
                appointment.getPatient().getUser(),
            "Refund Update",
            refundMessage,
            Notification.NotificationType.QUEUE_UPDATE,
                "APPOINTMENT",
                appointmentId);

        LocalDate date = appointment.getAppointmentDate();
        return callNext(doctorId, date);
    }

    @Transactional
    public QueueStateDTO setDelay(Integer doctorId, LocalDate date, Integer delayMinutes) {
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new RuntimeException("Doctor not found"));

        QueueState state = queueStateRepository.findByDoctorAndQueueDate(doctor, date)
                .orElse(new QueueState(doctor, date));
        Integer previousDelay = state.getDoctorDelayMinutes() != null ? state.getDoctorDelayMinutes() : 0;
        state.setDoctorDelayMinutes(delayMinutes != null ? delayMinutes : 0);
        queueStateRepository.save(state);

        QueueStateDTO dto = getQueueState(doctorId, date);
        if (!previousDelay.equals(dto.getDoctorDelayMinutes())) {
            notifyQueueDelay(doctor, date, dto.getCurrentServingSerial(), dto.getDoctorDelayMinutes());
        }
        notifyQueueThresholds(doctor, date, dto.getCurrentServingSerial());
        broadcast(doctorId, date, dto);
        return dto;
    }

    @Transactional
    public QueueStateDTO markCompleted(Integer appointmentId, Integer doctorId) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        if (!appointment.getDoctor().getDoctorId().equals(doctorId)) {
            throw new RuntimeException("Not authorized");
        }

        appointment.setStatus(Appointment.AppointmentStatus.COMPLETED);
        appointmentRepository.save(appointment);
        notifyAppointmentCompleted(
            appointment,
            String.format("Your appointment (#%d) has been marked as completed.", appointment.getSerialNumber()));

        LocalDate date = appointment.getAppointmentDate();
        Doctor doctor = appointment.getDoctor();
        QueueStateDTO dto = getQueueState(doctorId, date);
        notifyQueueThresholds(doctor, date, dto.getCurrentServingSerial());
        broadcast(doctorId, date, dto);
        return dto;
    }

    // -------------------------------------------------------------------------
    // Patient-facing: get my queue position
    // -------------------------------------------------------------------------

    public QueueStateDTO getPatientQueueView(String patientEmail, Integer doctorId, LocalDate date) {
        return getQueueState(doctorId, date);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private QueueStateDTO buildDTO(QueueState state, Doctor doctor, LocalDate date,
            List<Appointment> allAppointments) {
        QueueStateDTO dto = new QueueStateDTO();
        dto.setDoctorId(doctor.getDoctorId());
        dto.setDoctorName(doctor.getUser().getFirstName() + " " + doctor.getUser().getLastName());
        dto.setQueueDate(date);

        if (state != null) {
            dto.setQueueStateId(state.getQueueStateId());
            dto.setCurrentServingSerial(state.getCurrentServingSerial());
            dto.setDoctorDelayMinutes(state.getDoctorDelayMinutes() != null ? state.getDoctorDelayMinutes() : 0);
            dto.setIsActive(Boolean.TRUE.equals(state.getIsActive()) || !allAppointments.isEmpty());
            dto.setLastUpdated(state.getLastUpdated());
        } else {
            dto.setCurrentServingSerial(0);
            dto.setDoctorDelayMinutes(0);
            dto.setIsActive(!allAppointments.isEmpty());
        }

        Integer effectiveCurrentServingSerial = resolveEffectiveCurrentServingSerial(state, allAppointments);
        dto.setCurrentServingSerial(effectiveCurrentServingSerial);

        int delayMinutes = dto.getDoctorDelayMinutes() != null ? dto.getDoctorDelayMinutes() : 0;

        // Build queue entries
        List<QueueStateDTO.QueueEntry> entries = allAppointments.stream().map(a -> {
            QueueStateDTO.QueueEntry entry = new QueueStateDTO.QueueEntry();
            entry.setAppointmentId(a.getAppointmentId());
            entry.setSerialNumber(a.getSerialNumber());
            entry.setPatientName(a.getPatient().getUser().getFirstName() + " " +
                    a.getPatient().getUser().getLastName());
            entry.setScheduledTime(a.getAppointmentTime());
            // Estimated time = scheduled time + doctor delay
            if (a.getAppointmentTime() != null) {
                entry.setEstimatedTime(a.getAppointmentTime().plusMinutes(delayMinutes));
            }
            entry.setStatus(a.getStatus().toString());
            entry.setAppointmentType(a.getAppointmentType().toString());
            entry.setIsPreferredSlot(a.getIsPreferredSlot() != null ? a.getIsPreferredSlot() : false);
            return entry;
        }).collect(Collectors.toList());

        dto.setQueue(entries);
        dto.setTotalPatients(entries.size());
        return dto;
    }

    private Integer resolveEffectiveCurrentServingSerial(QueueState state, List<Appointment> allAppointments) {
        Integer currentServingSerial = state != null ? state.getCurrentServingSerial() : null;
        if (currentServingSerial != null && currentServingSerial > 0) {
            return currentServingSerial;
        }

        boolean queueActive = state == null || Boolean.TRUE.equals(state.getIsActive());
        if (!queueActive || allAppointments.isEmpty()) {
            return 0;
        }

        return allAppointments.stream()
                .filter(appointment -> appointment.getSerialNumber() != null)
                .filter(appointment -> appointment.getStatus() == Appointment.AppointmentStatus.CONFIRMED
                        || appointment.getStatus() == Appointment.AppointmentStatus.SCHEDULED
                        || appointment.getStatus() == Appointment.AppointmentStatus.IN_PROGRESS)
                .map(Appointment::getSerialNumber)
                .findFirst()
                .orElse(0);
    }

    private void notifyQueueThresholds(Doctor doctor, LocalDate date, Integer currentServingSerial) {
        if (currentServingSerial == null || currentServingSerial <= 0) {
            return;
        }

        List<Appointment> queueAppointments = getActiveQueueAppointments(doctor, date);

        int currentIndex = -1;
        for (int index = 0; index < queueAppointments.size(); index++) {
            Appointment appointment = queueAppointments.get(index);
            if (appointment.getSerialNumber().equals(currentServingSerial)) {
                currentIndex = index;
                break;
            }
        }

        if (currentIndex < 0) {
            return;
        }

        for (int index = currentIndex + 1; index < queueAppointments.size(); index++) {
            Appointment appointment = queueAppointments.get(index);
            int patientsAhead = index - currentIndex;

            if (!QUEUE_ALERT_THRESHOLDS.contains(patientsAhead)) {
                continue;
            }

            User patientUser = appointment.getPatient().getUser();
            String title = "Queue Update";
                String message;
                if (patientsAhead == 3) {
                message = String.format(
                    "Queue update: Your token #%d is after 3 patients on %s.",
                    appointment.getSerialNumber(),
                    date);
                } else if (patientsAhead == 1) {
                message = String.format(
                    "Queue update: Your token #%d is next on %s.",
                    appointment.getSerialNumber(),
                    date);
                } else {
                message = String.format(
                    "Queue update: Your token #%d is now %d patients away from consultation on %s.",
                    appointment.getSerialNumber(),
                    patientsAhead,
                    date);
                }

            boolean alreadySent = notificationRepository
                    .existsByUserAndRelatedEntityTypeAndRelatedEntityIdAndTitleAndMessage(
                            patientUser,
                            "APPOINTMENT",
                            appointment.getAppointmentId(),
                            title,
                            message);

            if (!alreadySent) {
                notificationService.createNotificationWithEntity(
                        patientUser,
                        title,
                        message,
                        Notification.NotificationType.QUEUE_UPDATE,
                        "APPOINTMENT",
                        appointment.getAppointmentId());
            }
        }
    }

    private List<Appointment> getActiveQueueAppointments(Doctor doctor, LocalDate date) {
        return appointmentRepository.findQueueByDoctorAndDate(doctor, date)
                .stream()
                .filter(appointment -> appointment.getSerialNumber() != null)
                .filter(appointment -> appointment.getStatus() == Appointment.AppointmentStatus.CONFIRMED
                        || appointment.getStatus() == Appointment.AppointmentStatus.SCHEDULED
                        || appointment.getStatus() == Appointment.AppointmentStatus.IN_PROGRESS)
                .sorted((left, right) -> left.getSerialNumber().compareTo(right.getSerialNumber()))
                .collect(Collectors.toList());
    }

    private void notifyQueueDelay(Doctor doctor, LocalDate date, Integer currentServingSerial, Integer delayMinutes) {
        List<Appointment> queueAppointments = getActiveQueueAppointments(doctor, date);
        int servingSerial = currentServingSerial != null ? currentServingSerial : 0;
        String title = "Queue Delay Update";
        String message = delayMinutes != null && delayMinutes > 0
            ? String.format("Queue delay notice: Today's queue is delayed by %d minute(s). Please plan accordingly.", delayMinutes)
                : "Queue delay has been cleared. Consultations are back on regular schedule.";

        for (Appointment appointment : queueAppointments) {
            if (servingSerial > 0 && appointment.getSerialNumber() < servingSerial) {
                continue;
            }

            User patientUser = appointment.getPatient().getUser();
            boolean alreadySent = notificationRepository
                    .existsByUserAndRelatedEntityTypeAndRelatedEntityIdAndTitleAndMessage(
                            patientUser,
                            "APPOINTMENT",
                            appointment.getAppointmentId(),
                            title,
                            message);

            if (!alreadySent) {
                notificationService.createNotificationWithEntity(
                        patientUser,
                        title,
                        message,
                        Notification.NotificationType.QUEUE_UPDATE,
                        "APPOINTMENT",
                        appointment.getAppointmentId());
            }
        }
    }

    private void notifyAppointmentCompleted(Appointment appointment, String message) {
        if (appointment == null || appointment.getPatient() == null || appointment.getPatient().getUser() == null) {
            return;
        }

        String title = "Appointment Completed";
        notificationService.createNotificationWithEntity(
                appointment.getPatient().getUser(),
                title,
                message,
                Notification.NotificationType.APPOINTMENT_COMPLETED,
                "APPOINTMENT",
                appointment.getAppointmentId());

        if (appointment.getRating() == null) {
            String reviewTitle = "Rate Your Doctor";
            String reviewMessage = "Your appointment is complete. Please rate your doctor and leave a review.";

            boolean alreadySent = notificationRepository
                .existsByUserAndRelatedEntityTypeAndRelatedEntityIdAndTitleAndMessage(
                    appointment.getPatient().getUser(),
                    "APPOINTMENT",
                    appointment.getAppointmentId(),
                    reviewTitle,
                    reviewMessage);

            if (!alreadySent) {
            notificationService.createNotificationWithEntity(
                appointment.getPatient().getUser(),
                reviewTitle,
                reviewMessage,
                Notification.NotificationType.REVIEW_REQUEST,
                "APPOINTMENT",
                appointment.getAppointmentId());
            }
        }
    }

    private int getSlotDuration(Doctor doctor, LocalDate date) {
        Schedule schedule = scheduleRepository.findByDoctor(doctor).orElse(null);
        if (schedule == null)
            return 15;

        int dayOfWeek = date.getDayOfWeek().getValue();
        WeeklySchedule ws = schedule.getWeeklySchedules().stream()
                .filter(s -> s.getDayOfWeek().equals(dayOfWeek) && Boolean.TRUE.equals(s.getIsAvailable()))
                .findFirst().orElse(null);

        if (ws == null)
            return 15;

        long totalMinutes = Duration.between(ws.getStartTime(), ws.getEndTime()).toMinutes();
        if (ws.getMaxPatients() != null && ws.getMaxPatients() > 0) {
            int dur = (int) (totalMinutes / ws.getMaxPatients());
            return Math.max(dur, 5);
        }
        return 15;
    }

    private void broadcast(Integer doctorId, LocalDate date, QueueStateDTO dto) {
        String destination = "/topic/queue/" + doctorId + "/" + date;
        messagingTemplate.convertAndSend(destination, dto);
    }
}
