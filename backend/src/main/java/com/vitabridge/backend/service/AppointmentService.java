package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.AppointmentRequest;
import com.vitabridge.backend.dto.AppointmentResponse;
import com.vitabridge.backend.dto.AvailableTimeSlot;
import com.vitabridge.backend.dto.RatingRequest;
import com.vitabridge.backend.model.*;
import com.vitabridge.backend.repository.*;
import com.vitabridge.backend.util.TimezoneUtil;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AppointmentService {

        private enum PaymentMode {
                PAY_NOW,
                PAY_LATER
        }

        @Autowired
        private AppointmentRepository appointmentRepository;

        @Autowired
        private PatientRepository patientRepository;

        @Autowired
        private DoctorRepository doctorRepository;

        @Autowired
        private ScheduleRepository scheduleRepository;

        @Autowired
        private UserRepository userRepository;

        @Autowired
        private NotificationService notificationService;

        @Autowired
        @Lazy
        private PaymentService paymentService;

        @Value("${app.timezone:Asia/Dhaka}")
        private String appTimezone;

        public List<AppointmentResponse> getPatientAppointments(String email) {
                User user = userRepository.findByEmail(email)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                Patient patient = patientRepository.findByUserUserId(user.getUserId())
                                .orElseThrow(() -> new RuntimeException("Patient profile not found"));

                List<Appointment> appointments = appointmentRepository
                                .findByPatientOrderByAppointmentDateDescAppointmentTimeDesc(patient);

                return appointments.stream()
                                .map(this::convertToResponse)
                                .collect(Collectors.toList());
        }

        public List<AppointmentResponse> getDoctorAppointments(String email) {
                User user = userRepository.findByEmail(email)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                Doctor doctor = doctorRepository.findByUser(user)
                                .orElseThrow(() -> new RuntimeException("Doctor profile not found"));

                List<Appointment> appointments = appointmentRepository
                                .findByDoctorOrderByAppointmentDateDescAppointmentTimeDesc(doctor);

                return appointments.stream()
                                .map(this::convertToResponse)
                                .collect(Collectors.toList());
        }

        public List<AppointmentResponse> getAllAppointmentsForAdmin() {
                List<Appointment> appointments = appointmentRepository.findAll();
                appointments.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));

                return appointments.stream()
                                .map(this::convertToResponse)
                                .collect(Collectors.toList());
        }

        @Transactional
        public AppointmentResponse autoBookFollowUpFromPrescription(Appointment sourceAppointment,
                        Integer followUpNumber,
                        LocalDate followUpDate,
                        String followUpInstruction) {
                if (sourceAppointment == null || followUpDate == null || followUpNumber == null) {
                        return null;
                }

                if (followUpNumber <= 0) {
                        throw new RuntimeException("Visit number must be greater than zero for follow-up booking");
                }

                if (followUpDate.isBefore(currentDate())) {
                        throw new RuntimeException("Follow-up date must be today or a future date");
                }

                Doctor doctor = sourceAppointment.getDoctor();
                Patient patient = sourceAppointment.getPatient();

                validateConsultationType(doctor, followUpDate, sourceAppointment.getAppointmentType().name());

                boolean alreadyBooked = appointmentRepository
                                .existsActiveByDoctorAndPatientAndDate(doctor, patient, followUpDate);
                if (alreadyBooked) {
                        throw new RuntimeException(
                                        "Patient already has an active appointment with this doctor on the selected follow-up date");
                }

                AllocatedSlot slot = allocateTimeSlotByVisitNumber(doctor, followUpDate, followUpNumber);

                Appointment followUp = new Appointment();
                followUp.setPatient(patient);
                followUp.setDoctor(doctor);
                followUp.setAppointmentDate(followUpDate);
                followUp.setAppointmentTime(slot.time);
                followUp.setSerialNumber(slot.serial);
                followUp.setAppointmentType(sourceAppointment.getAppointmentType());
                followUp.setStatus(Appointment.AppointmentStatus.PAYMENT_PENDING);
                followUp.setIsPreferredSlot(true);
                followUp.setNotes(buildFollowUpNote(sourceAppointment, followUpInstruction));

                Appointment saved = appointmentRepository.save(followUp);

                String patientNotice = String.format(
                                "Follow-up appointment auto-booked with Dr. %s %s on %s at %s (Visit No: %d). Payment is pending confirmation.",
                                doctor.getUser().getFirstName(),
                                doctor.getUser().getLastName(),
                                saved.getAppointmentDate(),
                                saved.getAppointmentTime(),
                                saved.getSerialNumber());
                notificationService.createNotificationWithEntity(
                                patient.getUser(),
                                "Follow-up Appointment Booked",
                                patientNotice,
                                Notification.NotificationType.APPOINTMENT_REQUEST,
                                "APPOINTMENT",
                                saved.getAppointmentId());

                String doctorNotice = String.format(
                                "Follow-up appointment auto-booked for %s %s on %s at %s (Visit No: %d). Payment is pending confirmation.",
                                patient.getUser().getFirstName(),
                                patient.getUser().getLastName(),
                                saved.getAppointmentDate(),
                                saved.getAppointmentTime(),
                                saved.getSerialNumber());
                notificationService.createNotificationWithEntity(
                                doctor.getUser(),
                                "Follow-up Appointment Reserved",
                                doctorNotice,
                                Notification.NotificationType.APPOINTMENT_REQUEST,
                                "APPOINTMENT",
                                saved.getAppointmentId());

                return convertToResponse(saved);
        }

        @Transactional
        public AppointmentResponse autoBookFollowUpFromPrescription(Appointment sourceAppointment,
                        LocalDate followUpDate,
                        LocalTime followUpTime,
                        String followUpInstruction) {
                if (sourceAppointment == null || followUpDate == null || followUpTime == null) {
                        return null;
                }

                if (followUpDate.isBefore(currentDate())) {
                        throw new RuntimeException("Follow-up date must be today or a future date");
                }

                Doctor doctor = sourceAppointment.getDoctor();
                Patient patient = sourceAppointment.getPatient();

                validateConsultationType(doctor, followUpDate, sourceAppointment.getAppointmentType().name());

                AllocatedSlot slot = suggestFollowUpSlotByPreferredTime(doctor, followUpDate, followUpTime);

                boolean alreadyBooked = appointmentRepository
                                .existsActiveByDoctorAndPatientAndDate(doctor, patient, followUpDate);
                if (alreadyBooked) {
                        throw new RuntimeException(
                                        "Patient already has an active appointment with this doctor on the selected follow-up date");
                }

                Appointment followUp = new Appointment();
                followUp.setPatient(patient);
                followUp.setDoctor(doctor);
                followUp.setAppointmentDate(followUpDate);
                followUp.setAppointmentTime(slot.time);
                followUp.setSerialNumber(slot.serial);
                followUp.setAppointmentType(sourceAppointment.getAppointmentType());
                followUp.setStatus(Appointment.AppointmentStatus.PAYMENT_PENDING);
                followUp.setIsPreferredSlot(true);
                followUp.setNotes(buildFollowUpNote(sourceAppointment, followUpInstruction));

                Appointment saved = appointmentRepository.save(followUp);

                String patientNotice = String.format(
                                "Follow-up appointment auto-booked with Dr. %s %s on %s at %s (Visit No: %d). Payment is pending confirmation.",
                                doctor.getUser().getFirstName(),
                                doctor.getUser().getLastName(),
                                saved.getAppointmentDate(),
                                saved.getAppointmentTime(),
                                saved.getSerialNumber());
                notificationService.createNotificationWithEntity(
                                patient.getUser(),
                                "Follow-up Appointment Booked",
                                patientNotice,
                                Notification.NotificationType.APPOINTMENT_REQUEST,
                                "APPOINTMENT",
                                saved.getAppointmentId());

                String doctorNotice = String.format(
                                "Follow-up appointment auto-booked for %s %s on %s at %s (Visit No: %d). Payment is pending confirmation.",
                                patient.getUser().getFirstName(),
                                patient.getUser().getLastName(),
                                saved.getAppointmentDate(),
                                saved.getAppointmentTime(),
                                saved.getSerialNumber());
                notificationService.createNotificationWithEntity(
                                doctor.getUser(),
                                "Follow-up Appointment Reserved",
                                doctorNotice,
                                Notification.NotificationType.APPOINTMENT_REQUEST,
                                "APPOINTMENT",
                                saved.getAppointmentId());

                return convertToResponse(saved);
        }

        @Transactional
        public AppointmentResponse bookAppointment(String patientEmail, AppointmentRequest request) {
                // Get patient
                User patientUser = userRepository.findByEmail(patientEmail)
                                .orElseThrow(() -> new RuntimeException("Patient user not found"));

                Patient patient = patientRepository.findByUserUserId(patientUser.getUserId())
                                .orElseThrow(() -> new RuntimeException("Patient profile not found"));

                // Get doctor
                Doctor doctor = doctorRepository.findById(request.getDoctorId())
                                .orElseThrow(() -> new RuntimeException("Doctor not found"));

                // Validate appointment date is in the future
                if (request.getAppointmentDate().isBefore(currentDate())) {
                        throw new RuntimeException("Appointment date must be in the future");
                }

                // Validate consultation type against doctor's schedule
                validateConsultationType(doctor, request.getAppointmentDate(), request.getAppointmentType());

                // Create appointment
                List<AllocatedSlot> candidateSlots = buildBookingCandidates(
                                doctor,
                                request.getAppointmentDate(),
                                request.getPreferredTime());

                PaymentMode paymentMode = resolvePaymentMode(request.getPaymentMode());
                DataIntegrityViolationException lastConflict = null;

                for (AllocatedSlot slot : candidateSlots) {
                        Appointment appointment = new Appointment();
                        appointment.setPatient(patient);
                        appointment.setDoctor(doctor);
                        appointment.setAppointmentDate(request.getAppointmentDate());
                        appointment.setAppointmentTime(slot.time);
                        appointment.setSerialNumber(slot.serial);
                        appointment.setAppointmentType(Appointment.AppointmentType.valueOf(request.getAppointmentType()));
                        appointment.setNotes(request.getNotes());
                        appointment.setStatus(Appointment.AppointmentStatus.PAYMENT_PENDING);
                        appointment.setIsPreferredSlot(request.getPreferredTime() != null);

                        try {
                                Appointment savedAppointment = appointmentRepository.saveAndFlush(appointment);

                                String patientNotice = String.format(
                                                "Your appointment request with Dr. %s %s for %s at %s has been submitted with queue token #%d and is waiting for payment confirmation.",
                                                doctor.getUser().getFirstName(),
                                                doctor.getUser().getLastName(),
                                                savedAppointment.getAppointmentDate(),
                                                savedAppointment.getAppointmentTime(),
                                                savedAppointment.getSerialNumber());
                                notificationService.createNotificationWithEntity(
                                                patientUser,
                                                "Appointment Request Submitted",
                                                patientNotice,
                                                Notification.NotificationType.APPOINTMENT_REQUEST,
                                                "APPOINTMENT",
                                                savedAppointment.getAppointmentId());

                                String doctorNotice = String.format(
                                                "New appointment request from %s %s for %s at %s (Queue #%d).",
                                                patientUser.getFirstName(),
                                                patientUser.getLastName(),
                                                savedAppointment.getAppointmentDate(),
                                                savedAppointment.getAppointmentTime(),
                                                savedAppointment.getSerialNumber());
                                notificationService.createNotificationWithEntity(
                                                doctor.getUser(),
                                                "New Appointment Request",
                                                doctorNotice,
                                                Notification.NotificationType.APPOINTMENT_REQUEST,
                                                "APPOINTMENT",
                                                savedAppointment.getAppointmentId());

                                AppointmentResponse resp = convertToResponse(savedAppointment);
                                if (paymentMode == PaymentMode.PAY_NOW) {
                                        // Initiate online payment and return gateway URL.
                                        String patientName = patientUser.getFirstName() + " " + patientUser.getLastName();
                                        String paymentUrl = paymentService.initiatePayment(
                                                        savedAppointment, patientName,
                                                        patientUser.getEmail(), patientUser.getPhoneNumber(),
                                                        request.getClientOrigin());
                                        resp.setPaymentUrl(paymentUrl);
                                }
                                return resp;
                        } catch (DataIntegrityViolationException ex) {
                                lastConflict = ex;
                                if (request.getPreferredTime() != null) {
                                        throw new DataIntegrityViolationException(
                                                        "The selected time slot is no longer available. Please choose another slot.",
                                                        ex);
                                }
                        }
                }

                if (lastConflict != null) {
                        throw new DataIntegrityViolationException(
                                        "No available queue slots on this day. The doctor's schedule is fully booked.",
                                        lastConflict);
                }

                throw new DataIntegrityViolationException(
                                "No available queue slots on this day. The doctor's schedule is fully booked.");
        }

        @Transactional
        public String initiateAppointmentPayment(Integer appointmentId, String patientEmail, String clientOrigin) {
                Appointment appointment = appointmentRepository.findById(appointmentId)
                                .orElseThrow(() -> new RuntimeException("Appointment not found"));

                User patientUser = userRepository.findByEmail(patientEmail)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                Integer requesterUserId = patientUser.getUserId();
                Integer appointmentPatientUserId = appointment.getPatient().getUser().getUserId();
                if (!appointmentPatientUserId.equals(requesterUserId)) {
                        throw new RuntimeException("You are not authorized to pay for this appointment");
                }

                if (appointment.getStatus() != Appointment.AppointmentStatus.PAYMENT_PENDING) {
                        throw new RuntimeException("Only payment-pending appointments can be paid");
                }

                String patientName = patientUser.getFirstName() + " " + patientUser.getLastName();
                return paymentService.initiatePayment(
                                appointment,
                                patientName,
                                patientUser.getEmail(),
                                patientUser.getPhoneNumber(),
                                clientOrigin);
        }

        @Transactional
        public AppointmentResponse confirmPayment(Integer appointmentId, String doctorEmail) {
                Appointment appointment = appointmentRepository.findById(appointmentId)
                                .orElseThrow(() -> new RuntimeException("Appointment not found"));

                User doctorUser = userRepository.findByEmail(doctorEmail)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                if (!appointment.getDoctor().getUser().getUserId().equals(doctorUser.getUserId())) {
                        throw new RuntimeException("Only the assigned doctor can confirm payment for this appointment");
                }

                if (appointment.getStatus() != Appointment.AppointmentStatus.PAYMENT_PENDING) {
                        throw new RuntimeException("Only payment-pending appointments can be marked as paid");
                }

                appointment.setStatus(Appointment.AppointmentStatus.CONFIRMED);
                Appointment savedAppointment = appointmentRepository.save(appointment);

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
                                "You confirmed payment and appointment for %s %s on %s at %s.",
                                appointment.getPatient().getUser().getFirstName(),
                                appointment.getPatient().getUser().getLastName(),
                                appointment.getAppointmentDate(),
                                appointment.getAppointmentTime());
                notificationService.createNotificationWithEntity(
                                doctorUser,
                                "Payment Confirmed",
                                doctorNotificationMessage,
                                Notification.NotificationType.APPOINTMENT_CONFIRMED,
                                "APPOINTMENT",
                                appointmentId);

                return convertToResponse(savedAppointment);
        }

        @Transactional
        public AppointmentResponse cancelAppointment(Integer appointmentId, String userEmail, String reason) {
                Appointment appointment = appointmentRepository.findById(appointmentId)
                                .orElseThrow(() -> new RuntimeException("Appointment not found"));

                // Verify the user is either the patient or the doctor
                User user = userRepository.findByEmail(userEmail)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                boolean isPatient = appointment.getPatient().getUser().getUserId().equals(user.getUserId());
                boolean isDoctor = appointment.getDoctor().getUser().getUserId().equals(user.getUserId());

                if (!isPatient && !isDoctor) {
                        throw new RuntimeException("You are not authorized to cancel this appointment");
                }

                if (appointment.getStatus() != Appointment.AppointmentStatus.CONFIRMED &&
                                appointment.getStatus() != Appointment.AppointmentStatus.PENDING &&
                                appointment.getStatus() != Appointment.AppointmentStatus.PAYMENT_PENDING &&
                                appointment.getStatus() != Appointment.AppointmentStatus.IN_PROGRESS) {
                        throw new RuntimeException(
                                        "Only confirmed, pending, or in-progress appointments can be cancelled");
                }

                appointment.setStatus(Appointment.AppointmentStatus.CANCELLED);
                appointment.setCancelledBy(userEmail);
                appointment.setCancellationReason(reason);

                Appointment savedAppointment = appointmentRepository.save(appointment);

                String finalReason = (reason == null || reason.trim().isEmpty())
                                ? "No reason provided"
                                : reason.trim();

                // Send notification to the other party
                User notifyUser = isPatient ? appointment.getDoctor().getUser() : appointment.getPatient().getUser();
                String notificationTitle = "Appointment Cancelled";
                String notificationMessage = String.format(
                                "Your appointment (queue token #%d) on %s at %s has been cancelled. Reason: %s",
                                appointment.getSerialNumber(),
                                appointment.getAppointmentDate(), appointment.getAppointmentTime(), finalReason);
                notificationService.createNotificationWithEntity(
                                notifyUser,
                                notificationTitle,
                                notificationMessage,
                                Notification.NotificationType.APPOINTMENT_CANCELLED,
                                "APPOINTMENT",
                                appointmentId);

                String actorNotificationMessage = String.format(
                                "You cancelled appointment (queue token #%d) on %s at %s. Reason: %s",
                                appointment.getSerialNumber(),
                                appointment.getAppointmentDate(),
                                appointment.getAppointmentTime(),
                                finalReason);
                notificationService.createNotificationWithEntity(
                                user,
                                notificationTitle,
                                actorNotificationMessage,
                                Notification.NotificationType.APPOINTMENT_CANCELLED,
                                "APPOINTMENT",
                                appointmentId);

                return convertToResponse(savedAppointment);
        }

        @Transactional
        public AppointmentResponse confirmAppointment(Integer appointmentId, String doctorEmail) {
                Appointment appointment = appointmentRepository.findById(appointmentId)
                                .orElseThrow(() -> new RuntimeException("Appointment not found"));

                // Verify the user is the doctor
                User doctorUser = userRepository.findByEmail(doctorEmail)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                if (!appointment.getDoctor().getUser().getUserId().equals(doctorUser.getUserId())) {
                        throw new RuntimeException("Only the assigned doctor can confirm this appointment");
                }

                // Check if appointment is waiting for payment
                if (appointment.getStatus() == Appointment.AppointmentStatus.PAYMENT_PENDING) {
                        throw new RuntimeException(
                                        "Appointment is waiting for payment confirmation. Cannot confirm until payment is completed.");
                }

                if (appointment.getStatus() != Appointment.AppointmentStatus.PENDING) {
                        throw new RuntimeException("Only pending appointments can be confirmed");
                }

                appointment.setStatus(Appointment.AppointmentStatus.CONFIRMED);

                Appointment savedAppointment = appointmentRepository.save(appointment);

                // Send notification to patient
                String notificationTitle = "Appointment Confirmed";
                String notificationMessage = String.format(
                                "Dr. %s %s has confirmed your appointment on %s at %s",
                                doctorUser.getFirstName(), doctorUser.getLastName(),
                                appointment.getAppointmentDate(), appointment.getAppointmentTime());
                notificationService.createNotificationWithEntity(
                                appointment.getPatient().getUser(),
                                notificationTitle,
                                notificationMessage,
                                Notification.NotificationType.APPOINTMENT_CONFIRMED,
                                "APPOINTMENT",
                                appointmentId);

                String doctorConfirmationMessage = String.format(
                                "You confirmed the appointment for %s %s on %s at %s.",
                                appointment.getPatient().getUser().getFirstName(),
                                appointment.getPatient().getUser().getLastName(),
                                appointment.getAppointmentDate(),
                                appointment.getAppointmentTime());
                notificationService.createNotificationWithEntity(
                                doctorUser,
                                "Appointment Confirmed",
                                doctorConfirmationMessage,
                                Notification.NotificationType.APPOINTMENT_CONFIRMED,
                                "APPOINTMENT",
                                appointmentId);

                return convertToResponse(savedAppointment);
        }

        @Transactional
        public AppointmentResponse rejectAppointment(Integer appointmentId, String doctorEmail, String reason) {
                Appointment appointment = appointmentRepository.findById(appointmentId)
                                .orElseThrow(() -> new RuntimeException("Appointment not found"));

                // Verify the user is the doctor
                User doctorUser = userRepository.findByEmail(doctorEmail)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                if (!appointment.getDoctor().getUser().getUserId().equals(doctorUser.getUserId())) {
                        throw new RuntimeException("Only the assigned doctor can reject this appointment");
                }

                if (appointment.getStatus() != Appointment.AppointmentStatus.PENDING &&
                                appointment.getStatus() != Appointment.AppointmentStatus.PAYMENT_PENDING) {
                        throw new RuntimeException("Only pending or payment-pending appointments can be rejected");
                }

                appointment.setStatus(Appointment.AppointmentStatus.REJECTED);
                appointment.setRejectionReason(reason);

                Appointment savedAppointment = appointmentRepository.save(appointment);

                // Send notification to patient
                String notificationTitle = "Appointment Request Rejected";
                String notificationMessage = String.format(
                                "Dr. %s %s has declined your appointment request for %s at %s. Reason: %s",
                                doctorUser.getFirstName(), doctorUser.getLastName(),
                                appointment.getAppointmentDate(), appointment.getAppointmentTime(), reason);
                notificationService.createNotificationWithEntity(
                                appointment.getPatient().getUser(),
                                notificationTitle,
                                notificationMessage,
                                Notification.NotificationType.APPOINTMENT_REJECTED,
                                "APPOINTMENT",
                                appointmentId);

                return convertToResponse(savedAppointment);
        }

        public List<AvailableTimeSlot> getAvailableTimeSlots(Integer doctorId, LocalDate date) {
                Doctor doctor = doctorRepository.findById(doctorId)
                                .orElseThrow(() -> new RuntimeException("Doctor not found"));

                Schedule schedule = scheduleRepository.findByDoctor(doctor)
                                .orElse(null);

                if (schedule == null) {
                        return new ArrayList<>();
                }

                // Check schedule overrides for this specific date
                boolean hasOverride = schedule.getScheduleOverrides().stream()
                                .anyMatch(so -> so.getOverrideDate().equals(date));
                if (hasOverride) {
                        boolean overrideAvailable = schedule.getScheduleOverrides().stream()
                                        .filter(so -> so.getOverrideDate().equals(date))
                                        .findFirst()
                                        .map(ScheduleOverride::getIsAvailable)
                                        .orElse(false);
                        if (!overrideAvailable) {
                                return new ArrayList<>(); // Doctor is unavailable on this date
                        }
                }

                // Get day of week (1=Monday, 7=Sunday)
                int dayOfWeek = date.getDayOfWeek().getValue();

                // Find weekly schedule for this day
                WeeklySchedule weeklySchedule = schedule.getWeeklySchedules().stream()
                                .filter(ws -> ws.getDayOfWeek().equals(dayOfWeek) && ws.getIsAvailable())
                                .findFirst()
                                .orElse(null);

                if (weeklySchedule == null) {
                        return new ArrayList<>();
                }

                // Derive slot duration from maxPatients — same logic as allocateTimeSlot
                long totalMinutes = Duration.between(weeklySchedule.getStartTime(), weeklySchedule.getEndTime())
                                .toMinutes();
                int slotDuration;
                int maxSlots;
                if (weeklySchedule.getMaxPatients() != null && weeklySchedule.getMaxPatients() > 0) {
                        slotDuration = (int) (totalMinutes / weeklySchedule.getMaxPatients());
                        if (slotDuration < 5)
                                slotDuration = 5;
                        maxSlots = weeklySchedule.getMaxPatients();
                } else {
                        slotDuration = DEFAULT_SLOT_MINUTES;
                        maxSlots = (int) (totalMinutes / slotDuration);
                }

                // Treat completed/no-show tokens as occupied to prevent rebooking.
                List<Appointment> scheduledAppointments = appointmentRepository
                                .findOccupiedAppointmentsByDoctorAndDate(doctor, date);
                Set<LocalTime> bookedTimes = scheduledAppointments.stream()
                                .map(Appointment::getAppointmentTime)
                                .collect(Collectors.toCollection(HashSet::new));

                LocalTime now = currentDate().equals(date) ? currentTime() : null;

                // Generate one slot per patient position
                List<AvailableTimeSlot> timeSlots = new ArrayList<>();
                for (int i = 0; i < maxSlots; i++) {
                        LocalTime slotTime = weeklySchedule.getStartTime().plusMinutes((long) i * slotDuration);
                        // Safety: don't generate slots that start at or after the end time
                        if (!slotTime.isBefore(weeklySchedule.getEndTime()))
                                break;

                        // On today's date, do not expose past slots.
                        if (now != null && slotTime.isBefore(now)) {
                                continue;
                        }

                        int serial = i + 1;
                        boolean isBooked = bookedTimes.contains(slotTime);

                        timeSlots.add(new AvailableTimeSlot(
                                        slotTime,
                                        !isBooked,
                                        isBooked ? "Already booked" : null,
                                        serial,
                                        slotDuration));
                }

                return timeSlots;
        }

        // -------------------------------------------------------------------------
        // Queue slot allocation
        // -------------------------------------------------------------------------

        private static final int DEFAULT_SLOT_MINUTES = 15;

        /** Simple value holder for the allocated serial number and computed time. */
        static class AllocatedSlot {
                final int serial;
                final LocalTime time;

                AllocatedSlot(int serial, LocalTime time) {
                        this.serial = serial;
                        this.time = time;
                }
        }

        /**
         * Assigns a queue serial number and an estimated appointment time.
         *
         * <p>
         * Algorithm:
         * <ul>
         * <li>Slot duration = (scheduleEnd – scheduleStart) / maxPatients, or
         * {@value #DEFAULT_SLOT_MINUTES} min if maxPatients is not set.</li>
         * <li>No preferred time → next sequential slot from the start of the
         * schedule.</li>
         * <li>Preferred time → snapped to the nearest slot boundary at-or-after the
         * requested time; serial reflects that position.</li>
         * </ul>
         */
        private AllocatedSlot allocateTimeSlot(Doctor doctor, LocalDate date, LocalTime preferredTime) {
                WeeklySchedule ws = getAvailableWeeklyScheduleOrThrow(doctor, date);
                long totalMinutes = Duration.between(ws.getStartTime(), ws.getEndTime()).toMinutes();
                int slotDuration;
                if (ws.getMaxPatients() != null && ws.getMaxPatients() > 0) {
                        slotDuration = (int) (totalMinutes / ws.getMaxPatients());
                        if (slotDuration < 5)
                                slotDuration = 5; // enforce a 5-min floor
                } else {
                        slotDuration = DEFAULT_SLOT_MINUTES;
                }

                int maxSlots = (ws.getMaxPatients() != null && ws.getMaxPatients() > 0)
                                ? ws.getMaxPatients()
                                : (int) (totalMinutes / slotDuration);

                if (maxSlots <= 0) {
                        throw new RuntimeException(
                                        "No available queue slots on this day. The doctor's schedule is fully booked.");
                }

                List<LocalTime> allSlots = new ArrayList<>();
                for (int i = 0; i < maxSlots; i++) {
                        LocalTime slotTime = ws.getStartTime().plusMinutes((long) i * slotDuration);
                        if (!slotTime.isBefore(ws.getEndTime())) {
                                break;
                        }
                        allSlots.add(slotTime);
                }

                if (allSlots.isEmpty()) {
                        throw new RuntimeException(
                                        "No available queue slots on this day. The doctor's schedule is fully booked.");
                }

                List<Appointment> scheduledAppointments = appointmentRepository
                                .findOccupiedAppointmentsByDoctorAndDate(doctor, date);
                Set<LocalTime> bookedTimes = scheduledAppointments.stream()
                                .map(Appointment::getAppointmentTime)
                                .collect(Collectors.toCollection(HashSet::new));

                LocalTime now = currentDate().equals(date) ? currentTime() : null;

                List<LocalTime> candidateSlots = allSlots.stream()
                                .filter(slot -> now == null || !slot.isBefore(now))
                                .collect(Collectors.toList());

                if (candidateSlots.isEmpty()) {
                        throw new RuntimeException("No available queue slots remaining for today.");
                }

                if (preferredTime != null) {
                        if (!allSlots.contains(preferredTime)) {
                                throw new RuntimeException(
                                                "The selected time slot is invalid. Please choose a listed slot.");
                        }

                        if (now != null && preferredTime.isBefore(now)) {
                                throw new RuntimeException("Cannot book a past time slot for today.");
                        }

                        if (bookedTimes.contains(preferredTime)) {
                                throw new RuntimeException(
                                                "The selected time slot is no longer available. Please choose another slot.");
                        }

                        int serial = allSlots.indexOf(preferredTime) + 1;
                        return new AllocatedSlot(serial, preferredTime);
                }

                for (LocalTime slot : candidateSlots) {
                        if (!bookedTimes.contains(slot)) {
                                int serial = allSlots.indexOf(slot) + 1;
                                return new AllocatedSlot(serial, slot);
                        }
                }

                throw new RuntimeException(
                                "No available queue slots on this day. The doctor's schedule is fully booked.");
        }

        private List<AllocatedSlot> buildBookingCandidates(Doctor doctor, LocalDate date, LocalTime preferredTime) {
                WeeklySchedule ws = getAvailableWeeklyScheduleOrThrow(doctor, date);
                long totalMinutes = Duration.between(ws.getStartTime(), ws.getEndTime()).toMinutes();

                int slotDuration;
                if (ws.getMaxPatients() != null && ws.getMaxPatients() > 0) {
                        slotDuration = (int) (totalMinutes / ws.getMaxPatients());
                        if (slotDuration < 5) {
                                slotDuration = 5;
                        }
                } else {
                        slotDuration = DEFAULT_SLOT_MINUTES;
                }

                int maxSlots = (ws.getMaxPatients() != null && ws.getMaxPatients() > 0)
                                ? ws.getMaxPatients()
                                : (int) (totalMinutes / slotDuration);

                if (maxSlots <= 0) {
                        throw new RuntimeException(
                                        "No available queue slots on this day. The doctor's schedule is fully booked.");
                }

                LocalTime now = currentDate().equals(date) ? currentTime() : null;
                List<AllocatedSlot> allSlots = new ArrayList<>();

                List<Appointment> scheduledAppointments = appointmentRepository
                                .findOccupiedAppointmentsByDoctorAndDate(doctor, date);
                Set<LocalTime> bookedTimes = scheduledAppointments.stream()
                                .map(Appointment::getAppointmentTime)
                                .collect(Collectors.toCollection(HashSet::new));

                for (int i = 0; i < maxSlots; i++) {
                        LocalTime slotTime = ws.getStartTime().plusMinutes((long) i * slotDuration);
                        if (!slotTime.isBefore(ws.getEndTime())) {
                                break;
                        }

                        if (now != null && slotTime.isBefore(now)) {
                                continue;
                        }

                        if (bookedTimes.contains(slotTime)) {
                                continue;
                        }

                        allSlots.add(new AllocatedSlot(i + 1, slotTime));
                }

                if (allSlots.isEmpty()) {
                        throw new RuntimeException("No available queue slots remaining for today.");
                }

                if (preferredTime != null) {
                        return allSlots.stream()
                                        .filter(slot -> slot.time.equals(preferredTime))
                                        .findFirst()
                                        .map(List::of)
                                        .orElseThrow(() -> new RuntimeException(
                                                        "The selected time slot is invalid. Please choose a listed slot."));
                }

                return allSlots;
        }

        public AllocatedSlot suggestFollowUpSlotByPreferredTime(Doctor doctor, LocalDate date, LocalTime preferredTime) {
                if (doctor == null) {
                        throw new RuntimeException("Doctor is required for follow-up booking");
                }

                if (date == null) {
                        throw new RuntimeException("Follow-up date is required for follow-up booking");
                }

                if (preferredTime == null) {
                        throw new RuntimeException("Follow-up time is required for follow-up booking");
                }

                if (date.isBefore(currentDate())) {
                        throw new RuntimeException("Follow-up date must be today or a future date");
                }

                return allocateClosestAvailableSlotByTime(doctor, date, preferredTime);
        }

        private AllocatedSlot allocateClosestAvailableSlotByTime(Doctor doctor, LocalDate date, LocalTime preferredTime) {
                WeeklySchedule ws = getAvailableWeeklyScheduleOrThrow(doctor, date);
                long totalMinutes = Duration.between(ws.getStartTime(), ws.getEndTime()).toMinutes();

                int slotDuration;
                if (ws.getMaxPatients() != null && ws.getMaxPatients() > 0) {
                        slotDuration = (int) (totalMinutes / ws.getMaxPatients());
                        if (slotDuration < 5) {
                                slotDuration = 5;
                        }
                } else {
                        slotDuration = DEFAULT_SLOT_MINUTES;
                }

                int maxSlots = (ws.getMaxPatients() != null && ws.getMaxPatients() > 0)
                                ? ws.getMaxPatients()
                                : (int) (totalMinutes / slotDuration);

                if (maxSlots <= 0) {
                        throw new RuntimeException(
                                        "No available queue slots on this day. The doctor's schedule is fully booked.");
                }

                List<LocalTime> allSlots = new ArrayList<>();
                for (int i = 0; i < maxSlots; i++) {
                        LocalTime slotTime = ws.getStartTime().plusMinutes((long) i * slotDuration);
                        if (!slotTime.isBefore(ws.getEndTime())) {
                                break;
                        }
                        allSlots.add(slotTime);
                }

                if (allSlots.isEmpty()) {
                        throw new RuntimeException(
                                        "No available queue slots on this day. The doctor's schedule is fully booked.");
                }

                LocalTime now = currentDate().equals(date) ? currentTime() : null;

                List<Appointment> scheduledAppointments = appointmentRepository
                                .findOccupiedAppointmentsByDoctorAndDate(doctor, date);
                Set<LocalTime> bookedTimes = scheduledAppointments.stream()
                                .map(Appointment::getAppointmentTime)
                                .collect(Collectors.toCollection(HashSet::new));

                List<LocalTime> availableSlots = allSlots.stream()
                                .filter(slot -> now == null || !slot.isBefore(now))
                                .filter(slot -> !bookedTimes.contains(slot))
                                .collect(Collectors.toList());

                if (availableSlots.isEmpty()) {
                        throw new RuntimeException("No available queue slots remaining for the selected follow-up time.");
                }

                LocalTime closest = availableSlots.stream()
                                .min((a, b) -> {
                                        long diffA = Math.abs(Duration.between(preferredTime, a).toMinutes());
                                        long diffB = Math.abs(Duration.between(preferredTime, b).toMinutes());
                                        if (diffA == diffB) {
                                                return a.compareTo(b);
                                        }
                                        return Long.compare(diffA, diffB);
                                })
                                .orElseThrow(() -> new RuntimeException(
                                                "No available queue slots remaining for the selected follow-up time."));

                int serial = allSlots.indexOf(closest) + 1;
                return new AllocatedSlot(serial, closest);
        }

        private AllocatedSlot allocateTimeSlotByVisitNumber(Doctor doctor, LocalDate date, Integer visitNumber) {
                WeeklySchedule ws = getAvailableWeeklyScheduleOrThrow(doctor, date);
                long totalMinutes = Duration.between(ws.getStartTime(), ws.getEndTime()).toMinutes();

                int slotDuration;
                if (ws.getMaxPatients() != null && ws.getMaxPatients() > 0) {
                        slotDuration = (int) (totalMinutes / ws.getMaxPatients());
                        if (slotDuration < 5) {
                                slotDuration = 5;
                        }
                } else {
                        slotDuration = DEFAULT_SLOT_MINUTES;
                }

                int maxSlots = (ws.getMaxPatients() != null && ws.getMaxPatients() > 0)
                                ? ws.getMaxPatients()
                                : (int) (totalMinutes / slotDuration);

                if (visitNumber > maxSlots) {
                        throw new RuntimeException("Requested visit number exceeds doctor's daily capacity");
                }

                LocalTime selectedTime = ws.getStartTime().plusMinutes((long) (visitNumber - 1) * slotDuration);
                if (!selectedTime.isBefore(ws.getEndTime())) {
                        throw new RuntimeException("Requested visit number maps outside doctor's schedule hours");
                }

                LocalTime now = currentDate().equals(date) ? currentTime() : null;
                if (now != null && selectedTime.isBefore(now)) {
                        throw new RuntimeException("Requested follow-up visit number is already in the past for today");
                }

                List<Appointment> scheduledAppointments = appointmentRepository
                                .findOccupiedAppointmentsByDoctorAndDate(doctor, date);
                boolean occupied = scheduledAppointments.stream()
                                .map(Appointment::getAppointmentTime)
                                .anyMatch(selectedTime::equals);

                if (occupied) {
                        throw new RuntimeException("Requested follow-up visit number is already booked");
                }

                return new AllocatedSlot(visitNumber, selectedTime);
        }

        public void validateFollowUpVisitNumber(Doctor doctor, LocalDate date, Integer visitNumber) {
                if (doctor == null) {
                        throw new RuntimeException("Doctor is required for follow-up booking");
                }

                if (date == null) {
                        throw new RuntimeException("Follow-up date is required when visit number is provided");
                }

                if (visitNumber == null) {
                        throw new RuntimeException("Visit number is required when follow-up date is provided");
                }

                if (visitNumber <= 0) {
                        throw new RuntimeException("Visit number must be greater than zero for follow-up booking");
                }

                if (date.isBefore(currentDate())) {
                        throw new RuntimeException("Follow-up date must be today or a future date");
                }

                WeeklySchedule ws = getAvailableWeeklyScheduleOrThrow(doctor, date);
                long totalMinutes = Duration.between(ws.getStartTime(), ws.getEndTime()).toMinutes();

                int slotDuration;
                if (ws.getMaxPatients() != null && ws.getMaxPatients() > 0) {
                        slotDuration = (int) (totalMinutes / ws.getMaxPatients());
                        if (slotDuration < 5) {
                                slotDuration = 5;
                        }
                } else {
                        slotDuration = DEFAULT_SLOT_MINUTES;
                }

                int maxSlots = (ws.getMaxPatients() != null && ws.getMaxPatients() > 0)
                                ? ws.getMaxPatients()
                                : (int) (totalMinutes / slotDuration);

                if (visitNumber > maxSlots) {
                        throw new RuntimeException("Requested visit number exceeds doctor's daily capacity");
                }

                LocalTime selectedTime = ws.getStartTime().plusMinutes((long) (visitNumber - 1) * slotDuration);
                if (!selectedTime.isBefore(ws.getEndTime())) {
                        throw new RuntimeException("Requested visit number maps outside doctor's schedule hours");
                }

                LocalTime now = currentDate().equals(date) ? currentTime() : null;
                if (now != null && selectedTime.isBefore(now)) {
                        throw new RuntimeException("Requested follow-up visit number is already in the past for today");
                }

                List<Appointment> scheduledAppointments = appointmentRepository
                                .findOccupiedAppointmentsByDoctorAndDate(doctor, date);
                boolean occupied = scheduledAppointments.stream()
                                .map(Appointment::getAppointmentTime)
                                .anyMatch(selectedTime::equals);

                if (occupied) {
                        throw new RuntimeException("Requested follow-up visit number is already booked");
                }
        }

        private String buildFollowUpNote(Appointment sourceAppointment, String followUpInstruction) {
                StringBuilder note = new StringBuilder("Auto-booked from prescription for appointment #")
                                .append(sourceAppointment.getAppointmentId());
                if (followUpInstruction != null && !followUpInstruction.isBlank()) {
                        note.append(". Follow-up instruction: ").append(followUpInstruction.trim());
                }
                return note.toString();
        }

        /**
         * Validate that the requested appointment type is allowed on this day's
         * schedule.
         * BOTH → any type allowed, IN_PERSON → only in-person, ONLINE → only online
         */
        private void validateConsultationType(Doctor doctor, LocalDate date, String requestedType) {
                WeeklySchedule ws = getAvailableWeeklyScheduleOrThrow(doctor, date);

                WeeklySchedule.ConsultationType allowed = ws.getConsultationType();
                if (allowed == null || allowed == WeeklySchedule.ConsultationType.BOTH)
                        return;

                Appointment.AppointmentType requested = Appointment.AppointmentType.valueOf(requestedType);
                if (allowed == WeeklySchedule.ConsultationType.IN_PERSON
                                && requested == Appointment.AppointmentType.ONLINE) {
                        throw new RuntimeException(
                                        "Doctor only accepts in-person appointments on this day");
                }
                if (allowed == WeeklySchedule.ConsultationType.ONLINE
                                && requested == Appointment.AppointmentType.IN_PERSON) {
                        throw new RuntimeException(
                                        "Doctor only accepts online appointments on this day");
                }
        }

        private WeeklySchedule getAvailableWeeklyScheduleOrThrow(Doctor doctor, LocalDate date) {
                Schedule schedule = scheduleRepository.findByDoctor(doctor)
                                .orElseThrow(() -> new RuntimeException(
                                                "Doctor has no published schedule. Please choose another doctor or date."));

                boolean hasOverride = schedule.getScheduleOverrides().stream()
                                .anyMatch(so -> so.getOverrideDate().equals(date));

                if (hasOverride) {
                        boolean overrideAvailable = schedule.getScheduleOverrides().stream()
                                        .filter(so -> so.getOverrideDate().equals(date))
                                        .findFirst()
                                        .map(ScheduleOverride::getIsAvailable)
                                        .orElse(false);
                        if (!overrideAvailable) {
                                throw new RuntimeException("Doctor is unavailable on the selected date");
                        }
                }

                int dayOfWeek = date.getDayOfWeek().getValue();
                return schedule.getWeeklySchedules().stream()
                                .filter(s -> s.getDayOfWeek().equals(dayOfWeek)
                                                && Boolean.TRUE.equals(s.getIsAvailable()))
                                .findFirst()
                                .orElseThrow(() -> new RuntimeException(
                                                "Doctor is not available on the selected day"));
        }

        private PaymentMode resolvePaymentMode(String rawPaymentMode) {
                if (rawPaymentMode == null || rawPaymentMode.isBlank()) {
                        return PaymentMode.PAY_NOW;
                }

                try {
                        return PaymentMode.valueOf(rawPaymentMode.trim().toUpperCase());
                } catch (IllegalArgumentException ex) {
                        throw new RuntimeException("Invalid payment mode. Supported values are PAY_NOW and PAY_LATER");
                }
        }

        private LocalDate currentDate() {
                return LocalDate.now(resolveAppZone());
        }

        private LocalTime currentTime() {
                return LocalTime.now(resolveAppZone());
        }

        private ZoneId resolveAppZone() {
                try {
                        return ZoneId.of(appTimezone);
                } catch (Exception ex) {
                        return ZoneId.systemDefault();
                }
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
                response.setSerialNumber(appointment.getSerialNumber());
                response.setIsPreferredSlot(
                                appointment.getIsPreferredSlot() != null ? appointment.getIsPreferredSlot() : false);
                response.setConsultationFee(appointment.getDoctor().getConsultationFee());
                response.setRating(appointment.getRating());
                response.setReviewText(appointment.getReviewText());
                response.setRatedAt(appointment.getRatedAt());

                return response;
        }

        @Transactional
        public AppointmentResponse submitRating(Integer appointmentId, String patientEmail, RatingRequest request) {
                Appointment appointment = appointmentRepository.findById(appointmentId)
                                .orElseThrow(() -> new RuntimeException("Appointment not found"));

                User patientUser = userRepository.findByEmail(patientEmail)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                Patient patient = patientRepository.findByUserUserId(patientUser.getUserId())
                                .orElseThrow(() -> new RuntimeException("Patient profile not found"));

                if (!appointment.getPatient().getPatientId().equals(patient.getPatientId())) {
                        throw new RuntimeException("You are not authorized to rate this appointment");
                }

                if (appointment.getStatus() != Appointment.AppointmentStatus.COMPLETED) {
                        throw new RuntimeException("You can only rate completed appointments");
                }

                if (appointment.getRating() != null) {
                        throw new RuntimeException("You have already rated this appointment");
                }

                appointment.setRating(request.getRating());
                String normalizedReview = request.getReviewText() != null ? request.getReviewText().trim() : null;
                appointment.setReviewText(
                                normalizedReview == null || normalizedReview.isEmpty() ? null : normalizedReview);
                appointment.setRatedAt(TimezoneUtil.now());

                Appointment saved = appointmentRepository.save(appointment);

                // Recalculate doctor's aggregate rating
                Doctor doctor = saved.getDoctor();
                Double avg = appointmentRepository.findAverageRatingByDoctor(doctor);
                Long count = appointmentRepository.countRatingsByDoctor(doctor);
                doctor.setAverageRating(avg != null ? Math.round(avg * 10.0) / 10.0 : 0.0);
                doctor.setTotalRatings(count != null ? count.intValue() : 0);
                doctorRepository.save(doctor);

                return convertToResponse(saved);
        }
}
