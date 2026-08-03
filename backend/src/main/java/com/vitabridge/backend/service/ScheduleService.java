package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.*;
import com.vitabridge.backend.model.*;
import com.vitabridge.backend.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ScheduleService {

    private static final Logger logger = LoggerFactory.getLogger(ScheduleService.class);

    @Autowired
    private ScheduleRepository scheduleRepository;

    @Autowired
    private WeeklyScheduleRepository weeklyScheduleRepository;

    @Autowired
    private ScheduleOverrideRepository scheduleOverrideRepository;

    @Autowired
    private DoctorRepository doctorRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AssistantRepository assistantRepository;

    @Autowired
    private AssistantLogRepository assistantLogRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Get or create schedule for a doctor
     */
    @Transactional
    public Schedule getOrCreateSchedule(Integer doctorId) {
        logger.debug("Getting or creating schedule for doctor ID: {}", doctorId);
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new RuntimeException("Doctor not found with ID: " + doctorId));

        return scheduleRepository.findByDoctor(doctor)
                .orElseGet(() -> {
                    logger.info("Creating new schedule for doctor ID: {}", doctorId);
                    Schedule newSchedule = new Schedule(doctor);
                    return scheduleRepository.save(newSchedule);
                });
    }

    /**
     * Get complete schedule for a doctor
     */
    public ScheduleResponseDTO getDoctorSchedule(Integer doctorId) {
        logger.debug("Fetching complete schedule for doctor ID: {}", doctorId);
        Schedule schedule = getOrCreateSchedule(doctorId);
        ScheduleResponseDTO dto = convertToDTO(schedule);
        logger.debug("Returning schedule with {} weekly schedules and {} overrides",
                dto.getWeeklySchedules().size(), dto.getScheduleOverrides().size());
        return dto;
    }

    /**
     * Add a new weekly schedule time slot
     */
    @Transactional
    public WeeklyScheduleDTO addWeeklySchedule(Integer doctorId, AddWeeklyScheduleRequest request) {
        logger.info("Adding weekly schedule for doctor ID: {}, day: {}, time: {}-{}",
                doctorId, request.getDayOfWeek(), request.getStartTime(), request.getEndTime());

        if (request.getDayOfWeek() < 1 || request.getDayOfWeek() > 7) {
            throw new IllegalArgumentException("Day of week must be between 1 and 7");
        }

        if (request.getStartTime() == null || request.getEndTime() == null) {
            throw new IllegalArgumentException("Start time and end time are required");
        }

        if (request.getStartTime().isAfter(request.getEndTime())) {
            throw new IllegalArgumentException("Start time must be before end time");
        }

        Schedule schedule = getOrCreateSchedule(doctorId);

        WeeklySchedule weeklySchedule = new WeeklySchedule();
        weeklySchedule.setSchedule(schedule);
        weeklySchedule.setDayOfWeek(request.getDayOfWeek());
        weeklySchedule.setStartTime(request.getStartTime());
        weeklySchedule.setEndTime(request.getEndTime());
        weeklySchedule.setIsAvailable(true); // Default to available
        weeklySchedule.setMaxPatients(request.getMaxPatients());
        if (request.getConsultationType() != null && !request.getConsultationType().isBlank()) {
            try {
                weeklySchedule.setConsultationType(
                        WeeklySchedule.ConsultationType.valueOf(request.getConsultationType()));
            } catch (IllegalArgumentException e) {
                weeklySchedule.setConsultationType(WeeklySchedule.ConsultationType.BOTH);
            }
        } else {
            weeklySchedule.setConsultationType(WeeklySchedule.ConsultationType.BOTH);
        }

        weeklySchedule = weeklyScheduleRepository.save(weeklySchedule);
        logger.info("Successfully saved weekly schedule with ID: {}", weeklySchedule.getWeeklyScheduleId());
        publishDoctorAvailabilityUpdate(doctorId);
        notifyPatientsOfScheduleChange(
            schedule.getDoctor(),
            String.format("Dr. %s %s updated weekly consultation slots. Please review your upcoming appointment details.",
                schedule.getDoctor().getUser().getFirstName(),
                schedule.getDoctor().getUser().getLastName()));
        return convertWeeklyScheduleToDTO(weeklySchedule);
    }

    /**
     * Update weekly schedule availability
     */
    @Transactional
    public WeeklyScheduleDTO updateWeeklyScheduleAvailability(Integer weeklyScheduleId, Boolean isAvailable) {
        logger.info("Updating weekly schedule ID: {} availability to: {}", weeklyScheduleId, isAvailable);
        WeeklySchedule weeklySchedule = weeklyScheduleRepository.findById(weeklyScheduleId)
                .orElseThrow(() -> new RuntimeException("Weekly schedule not found with ID: " + weeklyScheduleId));

        weeklySchedule.setIsAvailable(isAvailable);
        weeklySchedule = weeklyScheduleRepository.save(weeklySchedule);
        logger.info("Successfully updated weekly schedule availability");
        Integer doctorId = weeklySchedule.getSchedule().getDoctor().getDoctorId();
        publishDoctorAvailabilityUpdate(doctorId);
        notifyPatientsOfScheduleChange(
            weeklySchedule.getSchedule().getDoctor(),
            String.format("Dr. %s %s updated schedule availability. Please check your appointment status and time.",
                weeklySchedule.getSchedule().getDoctor().getUser().getFirstName(),
                weeklySchedule.getSchedule().getDoctor().getUser().getLastName()));
        return convertWeeklyScheduleToDTO(weeklySchedule);
    }

    /**
     * Update weekly schedule availability for a specific doctor.
     * Ensures a doctor can only mutate their own schedule entries.
     */
    @Transactional
    public WeeklyScheduleDTO updateWeeklyScheduleAvailabilityForDoctor(Integer doctorId, Integer weeklyScheduleId,
            Boolean isAvailable) {
        logger.info("Doctor {} updating weekly schedule ID: {} availability to: {}", doctorId, weeklyScheduleId,
                isAvailable);

        WeeklySchedule weeklySchedule = weeklyScheduleRepository.findById(weeklyScheduleId)
                .orElseThrow(() -> new RuntimeException("Weekly schedule not found with ID: " + weeklyScheduleId));

        Integer ownerDoctorId = weeklySchedule.getSchedule().getDoctor().getDoctorId();
        if (!ownerDoctorId.equals(doctorId)) {
            throw new RuntimeException("You are not authorized to modify this schedule entry");
        }

        weeklySchedule.setIsAvailable(isAvailable);
        weeklySchedule = weeklyScheduleRepository.save(weeklySchedule);
        logger.info("Doctor {} successfully updated weekly schedule ID: {}", doctorId, weeklyScheduleId);
        publishDoctorAvailabilityUpdate(doctorId);
        notifyPatientsOfScheduleChange(
            weeklySchedule.getSchedule().getDoctor(),
            String.format("Dr. %s %s updated schedule availability. Please check your appointment status and time.",
                weeklySchedule.getSchedule().getDoctor().getUser().getFirstName(),
                weeklySchedule.getSchedule().getDoctor().getUser().getLastName()));
        return convertWeeklyScheduleToDTO(weeklySchedule);
    }

    /**
     * Delete a weekly schedule time slot
     */
    @Transactional
    public void deleteWeeklySchedule(Integer weeklyScheduleId) {
        logger.info("Deleting weekly schedule ID: {}", weeklyScheduleId);
        WeeklySchedule weeklySchedule = weeklyScheduleRepository.findById(weeklyScheduleId)
                .orElseThrow(() -> new RuntimeException("Weekly schedule not found with ID: " + weeklyScheduleId));
        Integer doctorId = weeklySchedule.getSchedule().getDoctor().getDoctorId();
        weeklyScheduleRepository.deleteById(weeklyScheduleId);
        logger.info("Successfully deleted weekly schedule");
        publishDoctorAvailabilityUpdate(doctorId);
        notifyPatientsOfScheduleChange(
            weeklySchedule.getSchedule().getDoctor(),
            String.format("Dr. %s %s changed weekly schedule settings. Please review your appointment timing.",
                weeklySchedule.getSchedule().getDoctor().getUser().getFirstName(),
                weeklySchedule.getSchedule().getDoctor().getUser().getLastName()));
    }

    /**
     * Add or update a schedule override for a specific date
     */
    @Transactional
    public ScheduleOverrideDTO addOrUpdateScheduleOverride(Integer doctorId, AddScheduleOverrideRequest request) {
        logger.info("Adding/updating schedule override for doctor ID: {}, date: {}, available: {}",
                doctorId, request.getOverrideDate(), request.getIsAvailable());

        if (request.getOverrideDate() == null) {
            throw new IllegalArgumentException("Override date is required");
        }

        if (request.getIsAvailable() == null) {
            throw new IllegalArgumentException("Availability status is required");
        }

        Schedule schedule = getOrCreateSchedule(doctorId);

        ScheduleOverride override = scheduleOverrideRepository
                .findByScheduleAndOverrideDate(schedule, request.getOverrideDate())
                .orElse(new ScheduleOverride());

        override.setSchedule(schedule);
        override.setOverrideDate(request.getOverrideDate());
        override.setIsAvailable(request.getIsAvailable());

        override = scheduleOverrideRepository.save(override);

        if (Boolean.FALSE.equals(request.getIsAvailable())) {
            cancelActiveAppointmentsForDayOff(schedule.getDoctor(), request.getOverrideDate());
        } else {
            notifyPatientsOfScheduleChange(
                    schedule.getDoctor(),
                    String.format("Dr. %s %s updated availability for %s. Please re-check your appointment details.",
                            schedule.getDoctor().getUser().getFirstName(),
                            schedule.getDoctor().getUser().getLastName(),
                            request.getOverrideDate()));
        }

        logger.info("Successfully saved schedule override with ID: {}", override.getOverrideId());
        publishDoctorAvailabilityUpdate(doctorId);
        return convertOverrideToDTO(override);
    }

    /**
     * Delete a schedule override
     */
    @Transactional
    public void deleteScheduleOverride(Integer overrideId) {
        logger.info("Deleting schedule override ID: {}", overrideId);
        ScheduleOverride override = scheduleOverrideRepository.findById(overrideId)
                .orElseThrow(() -> new RuntimeException("Schedule override not found with ID: " + overrideId));
        Integer doctorId = override.getSchedule().getDoctor().getDoctorId();
        scheduleOverrideRepository.deleteById(overrideId);
        logger.info("Successfully deleted schedule override");
        publishDoctorAvailabilityUpdate(doctorId);
        notifyPatientsOfScheduleChange(
            override.getSchedule().getDoctor(),
            String.format("Dr. %s %s updated date-specific schedule settings. Please review your appointment details.",
                override.getSchedule().getDoctor().getUser().getFirstName(),
                override.getSchedule().getDoctor().getUser().getLastName()));
    }

    /**
     * Get schedule overrides for a date range
     */
    public List<ScheduleOverrideDTO> getScheduleOverrides(Integer doctorId, LocalDate startDate, LocalDate endDate) {
        logger.debug("Fetching schedule overrides for doctor ID: {} from {} to {}", doctorId, startDate, endDate);
        Schedule schedule = getOrCreateSchedule(doctorId);
        List<ScheduleOverride> overrides = scheduleOverrideRepository
                .findByScheduleAndOverrideDateBetween(schedule, startDate, endDate);

        return overrides.stream()
                .map(this::convertOverrideToDTO)
                .collect(Collectors.toList());
    }

    // DTO conversion methods
    private ScheduleResponseDTO convertToDTO(Schedule schedule) {
        List<WeeklyScheduleDTO> weeklyScheduleDTOs = schedule.getWeeklySchedules().stream()
                .map(this::convertWeeklyScheduleToDTO)
                .collect(Collectors.toList());

        List<ScheduleOverrideDTO> overrideDTOs = schedule.getScheduleOverrides().stream()
                .map(this::convertOverrideToDTO)
                .collect(Collectors.toList());

        return new ScheduleResponseDTO(
                schedule.getScheduleId(),
                schedule.getDoctor().getDoctorId(),
                weeklyScheduleDTOs,
                overrideDTOs);
    }

    private WeeklyScheduleDTO convertWeeklyScheduleToDTO(WeeklySchedule weeklySchedule) {
        return new WeeklyScheduleDTO(
                weeklySchedule.getWeeklyScheduleId(),
                weeklySchedule.getDayOfWeek(),
                weeklySchedule.getStartTime(),
                weeklySchedule.getEndTime(),
                weeklySchedule.getIsAvailable(),
                weeklySchedule.getMaxPatients(),
                weeklySchedule.getConsultationType() != null
                        ? weeklySchedule.getConsultationType().name()
                        : WeeklySchedule.ConsultationType.BOTH.name());
    }

    private ScheduleOverrideDTO convertOverrideToDTO(ScheduleOverride override) {
        return new ScheduleOverrideDTO(
                override.getOverrideId(),
                override.getOverrideDate(),
                override.getIsAvailable());
    }

    /**
     * Get schedule for assistant's assigned doctor
     */
    public ScheduleResponseDTO getScheduleForAssistant(String assistantEmail) {
        logger.debug("Fetching schedule for assistant: {}", assistantEmail);
        User user = userRepository.findByEmail(assistantEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Assistant assistant = assistantRepository.findByUserUserId(user.getUserId())
                .orElseThrow(() -> new RuntimeException("Assistant profile not found"));

        if (assistant.getDoctor() == null) {
            throw new RuntimeException("Assistant is not assigned to a doctor");
        }

        return getDoctorSchedule(assistant.getDoctor().getDoctorId());
    }

    /**
     * Add weekly schedule for assistant's assigned doctor
     */
    @Transactional
    public WeeklyScheduleDTO addWeeklyScheduleForAssistant(String assistantEmail, AddWeeklyScheduleRequest request) {
        logger.info("Assistant {} adding weekly schedule", assistantEmail);
        User user = userRepository.findByEmail(assistantEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Assistant assistant = assistantRepository.findByUserUserId(user.getUserId())
                .orElseThrow(() -> new RuntimeException("Assistant profile not found"));

        if (assistant.getDoctor() == null) {
            throw new RuntimeException("Assistant is not assigned to a doctor");
        }

        WeeklyScheduleDTO result = addWeeklySchedule(assistant.getDoctor().getDoctorId(), request);

        // Log the activity
        String description = String.format(
                "Added weekly schedule: Day %d, %s - %s",
                request.getDayOfWeek(), request.getStartTime(), request.getEndTime());
        logAssistantActivity(assistant, "SCHEDULE_UPDATED", description, "SCHEDULE", result.getWeeklyScheduleId());

        return result;
    }

    /**
     * Update weekly schedule availability for assistant's assigned doctor.
     * Ensures assistants cannot modify schedules outside their assignment.
     */
    @Transactional
    public WeeklyScheduleDTO updateWeeklyScheduleAvailabilityForAssistant(String assistantEmail,
            Integer weeklyScheduleId,
            Boolean isAvailable) {
        logger.info("Assistant {} updating weekly schedule ID: {} availability to: {}",
                assistantEmail, weeklyScheduleId, isAvailable);

        User user = userRepository.findByEmail(assistantEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Assistant assistant = assistantRepository.findByUserUserId(user.getUserId())
                .orElseThrow(() -> new RuntimeException("Assistant profile not found"));

        if (assistant.getDoctor() == null) {
            throw new RuntimeException("Assistant is not assigned to a doctor");
        }

        WeeklySchedule weeklySchedule = weeklyScheduleRepository.findById(weeklyScheduleId)
                .orElseThrow(() -> new RuntimeException("Weekly schedule not found with ID: " + weeklyScheduleId));

        Integer ownerDoctorId = weeklySchedule.getSchedule().getDoctor().getDoctorId();
        if (!ownerDoctorId.equals(assistant.getDoctor().getDoctorId())) {
            throw new RuntimeException("You are not authorized to modify this schedule entry");
        }

        weeklySchedule.setIsAvailable(isAvailable);
        weeklySchedule = weeklyScheduleRepository.save(weeklySchedule);

        logAssistantActivity(
                assistant,
                "SCHEDULE_UPDATED",
                String.format("Updated schedule availability (ID %d) to %s", weeklyScheduleId, isAvailable),
                "SCHEDULE",
                weeklyScheduleId);

        publishDoctorAvailabilityUpdate(ownerDoctorId);

        notifyPatientsOfScheduleChange(
            assistant.getDoctor(),
            String.format("Dr. %s %s updated schedule availability. Please check your appointment status and time.",
                assistant.getDoctor().getUser().getFirstName(),
                assistant.getDoctor().getUser().getLastName()));

        return convertWeeklyScheduleToDTO(weeklySchedule);
    }

    /**
     * Delete weekly schedule for assistant's assigned doctor.
     * Ensures assistants cannot modify schedules outside their assignment.
     */
    @Transactional
    public void deleteWeeklyScheduleForAssistant(String assistantEmail, Integer weeklyScheduleId) {
        logger.info("Assistant {} deleting weekly schedule ID: {}", assistantEmail, weeklyScheduleId);

        User user = userRepository.findByEmail(assistantEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Assistant assistant = assistantRepository.findByUserUserId(user.getUserId())
                .orElseThrow(() -> new RuntimeException("Assistant profile not found"));

        if (assistant.getDoctor() == null) {
            throw new RuntimeException("Assistant is not assigned to a doctor");
        }

        WeeklySchedule weeklySchedule = weeklyScheduleRepository.findById(weeklyScheduleId)
                .orElseThrow(() -> new RuntimeException("Weekly schedule not found with ID: " + weeklyScheduleId));

        Integer ownerDoctorId = weeklySchedule.getSchedule().getDoctor().getDoctorId();
        if (!ownerDoctorId.equals(assistant.getDoctor().getDoctorId())) {
            throw new RuntimeException("You are not authorized to delete this schedule entry");
        }

        deleteWeeklySchedule(weeklyScheduleId);

        logAssistantActivity(
                assistant,
                "SCHEDULE_UPDATED",
                String.format("Deleted weekly schedule entry (ID %d)", weeklyScheduleId),
                "SCHEDULE",
                weeklyScheduleId);
    }

            /**
             * Add or update schedule override for assistant's assigned doctor.
             */
            @Transactional
            public ScheduleOverrideDTO addOrUpdateScheduleOverrideForAssistant(String assistantEmail,
                AddScheduleOverrideRequest request) {
            logger.info("Assistant {} adding/updating schedule override for date {}", assistantEmail,
                request.getOverrideDate());

            User user = userRepository.findByEmail(assistantEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

            Assistant assistant = assistantRepository.findByUserUserId(user.getUserId())
                .orElseThrow(() -> new RuntimeException("Assistant profile not found"));

            if (assistant.getDoctor() == null) {
                throw new RuntimeException("Assistant is not assigned to a doctor");
            }

            ScheduleOverrideDTO result = addOrUpdateScheduleOverride(assistant.getDoctor().getDoctorId(), request);

            logAssistantActivity(
                assistant,
                "SCHEDULE_UPDATED",
                String.format("Updated date override for %s (available=%s)", request.getOverrideDate(),
                    request.getIsAvailable()),
                "SCHEDULE_OVERRIDE",
                result.getOverrideId());

            return result;
            }

            /**
             * Delete schedule override for assistant's assigned doctor.
             */
            @Transactional
            public void deleteScheduleOverrideForAssistant(String assistantEmail, Integer overrideId) {
            logger.info("Assistant {} deleting schedule override ID: {}", assistantEmail, overrideId);

            User user = userRepository.findByEmail(assistantEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

            Assistant assistant = assistantRepository.findByUserUserId(user.getUserId())
                .orElseThrow(() -> new RuntimeException("Assistant profile not found"));

            if (assistant.getDoctor() == null) {
                throw new RuntimeException("Assistant is not assigned to a doctor");
            }

            ScheduleOverride override = scheduleOverrideRepository.findById(overrideId)
                .orElseThrow(() -> new RuntimeException("Schedule override not found with ID: " + overrideId));

            Integer ownerDoctorId = override.getSchedule().getDoctor().getDoctorId();
            if (!ownerDoctorId.equals(assistant.getDoctor().getDoctorId())) {
                throw new RuntimeException("You are not authorized to delete this schedule override");
            }

            deleteScheduleOverride(overrideId);

            logAssistantActivity(
                assistant,
                "SCHEDULE_UPDATED",
                String.format("Deleted date override (ID %d)", overrideId),
                "SCHEDULE_OVERRIDE",
                overrideId);
            }

    private void publishDoctorAvailabilityUpdate(Integer doctorId) {
        if (doctorId == null) {
            return;
        }

        Map<String, Object> payload = Map.of(
                "doctorId", doctorId,
                "event", "SCHEDULE_UPDATED",
                "timestamp", System.currentTimeMillis());

        messagingTemplate.convertAndSend("/topic/doctor-availability/" + doctorId, (Object) payload);
        messagingTemplate.convertAndSend("/topic/doctor-availability", (Object) payload);
    }

    private void logAssistantActivity(Assistant assistant, String action, String description, String entityType,
            Integer entityId) {
        AssistantLog log = new AssistantLog(assistant, assistant.getDoctor(), action, description);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        assistantLogRepository.save(log);
    }

    private void cancelActiveAppointmentsForDayOff(Doctor doctor, LocalDate dayOffDate) {
        List<Appointment> activeAppointments = appointmentRepository
                .findScheduledAppointmentsByDoctorAndDate(doctor, dayOffDate);

        if (activeAppointments.isEmpty()) {
            return;
        }

        String doctorName = doctor.getUser().getFirstName() + " " + doctor.getUser().getLastName();
        String cancelReason = "Cancelled because the doctor marked this day as unavailable.";

        for (Appointment appointment : activeAppointments) {
            appointment.setStatus(Appointment.AppointmentStatus.CANCELLED);
            appointment.setCancelledBy(doctor.getUser().getEmail());
            appointment.setCancellationReason(cancelReason);

            String patientMessage = String.format(
                    "Your appointment with Dr. %s on %s at %s has been cancelled because the doctor set this day off.",
                    doctorName,
                    appointment.getAppointmentDate(),
                    appointment.getAppointmentTime());

            notificationService.createNotificationWithEntity(
                    appointment.getPatient().getUser(),
                    "Appointment Cancelled",
                    patientMessage,
                    Notification.NotificationType.APPOINTMENT_CANCELLED,
                    "APPOINTMENT",
                    appointment.getAppointmentId());
        }

        appointmentRepository.saveAll(activeAppointments);
        String doctorSummary = String.format(
            "Day-off override for %s cancelled %d patient appointment(s).",
            dayOffDate,
            activeAppointments.size());
        notificationService.createNotificationWithEntity(
            doctor.getUser(),
            "Day-Off Appointments Cancelled",
            doctorSummary,
            Notification.NotificationType.SCHEDULE_CHANGED,
            "SCHEDULE_OVERRIDE",
            null);

        List<Assistant> assistants = assistantRepository.findByDoctor(doctor);
        for (Assistant assistant : assistants) {
            String assistantSummary = String.format(
                "Dr. %s has a day off on %s. %d appointment(s) were cancelled and patients were notified.",
                doctorName,
                dayOffDate,
                activeAppointments.size());
            notificationService.createNotificationWithEntity(
                assistant.getUser(),
                "Schedule Change Applied",
                assistantSummary,
                Notification.NotificationType.SCHEDULE_CHANGED,
                "SCHEDULE_OVERRIDE",
                null);
        }

        logger.info("Cancelled {} active appointments for doctor {} on {} due to day-off override",
                activeAppointments.size(),
                doctor.getDoctorId(),
                dayOffDate);
    }

    private void notifyPatientsOfScheduleChange(Doctor doctor, String message) {
        if (doctor == null || doctor.getUser() == null) {
            return;
        }

        List<Appointment> appointments = appointmentRepository.findByDoctorOrderByAppointmentDateDescAppointmentTimeDesc(doctor);
        LocalDate today = LocalDate.now();
        Set<Integer> notifiedAppointmentIds = new HashSet<>();

        for (Appointment appointment : appointments) {
            if (appointment.getAppointmentId() == null || !notifiedAppointmentIds.add(appointment.getAppointmentId())) {
                continue;
            }

            if (appointment.getAppointmentDate() == null || appointment.getAppointmentDate().isBefore(today)) {
                continue;
            }

            Appointment.AppointmentStatus status = appointment.getStatus();
            if (status != Appointment.AppointmentStatus.PAYMENT_PENDING
                    && status != Appointment.AppointmentStatus.PENDING
                    && status != Appointment.AppointmentStatus.CONFIRMED
                    && status != Appointment.AppointmentStatus.IN_PROGRESS) {
                continue;
            }

            notificationService.createNotificationWithEntity(
                    appointment.getPatient().getUser(),
                    "Doctor Schedule Changed",
                    message,
                    Notification.NotificationType.SCHEDULE_CHANGED,
                    "APPOINTMENT",
                    appointment.getAppointmentId());
        }
    }
}