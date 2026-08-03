package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.AppointmentResponse;
import com.vitabridge.backend.dto.AssistantResponse;
import com.vitabridge.backend.model.Appointment;
import com.vitabridge.backend.model.Assistant;
import com.vitabridge.backend.model.Doctor;
import com.vitabridge.backend.model.Patient;
import com.vitabridge.backend.model.Role;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.AdminRepository;
import com.vitabridge.backend.repository.AppointmentRepository;
import com.vitabridge.backend.repository.AssistantRepository;
import com.vitabridge.backend.repository.DoctorRepository;
import com.vitabridge.backend.repository.PatientRepository;
import com.vitabridge.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AdminPortalService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AssistantRepository assistantRepository;

    @Autowired
    private DoctorRepository doctorRepository;

        @Autowired
        private PatientRepository patientRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private AppointmentService appointmentService;

        @Autowired
        private AdminRepository adminRepository;

        @Autowired
        private AdminReportPdfService adminReportPdfService;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(this::toUserMap)
                .collect(Collectors.toList());
    }

    @Transactional
        public Map<String, Object> toggleUserStatus(Integer userId, String currentAdminEmail) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

                if (Role.ADMIN.equals(user.getRole()) && user.getEmail() != null
                                && user.getEmail().equalsIgnoreCase(currentAdminEmail)) {
                        throw new RuntimeException("You cannot deactivate your own admin account");
                }

                if (Role.ADMIN.equals(user.getRole()) && Boolean.TRUE.equals(user.getIsActive())) {
                        long activeAdmins = adminRepository.countByUserIsActiveTrue();
                        if (activeAdmins <= 1) {
                                throw new RuntimeException("Cannot deactivate the last active admin account");
                        }
                }

        user.setIsActive(!Boolean.TRUE.equals(user.getIsActive()));
        userRepository.save(user);

        return toUserMap(user);
    }

        @Transactional
        public Map<String, Object> deleteUser(Integer userId, String currentAdminEmail) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                if (Role.ADMIN.equals(user.getRole()) && user.getEmail() != null
                                && user.getEmail().equalsIgnoreCase(currentAdminEmail)) {
                        throw new RuntimeException("You cannot delete your own admin account");
                }

                if (Role.ADMIN.equals(user.getRole()) && Boolean.TRUE.equals(user.getIsActive())) {
                        long activeAdmins = adminRepository.countByUserIsActiveTrue();
                        if (activeAdmins <= 1) {
                                throw new RuntimeException("Cannot delete the last active admin account");
                        }
                }

                if (Role.DOCTOR.equals(user.getRole())) {
                        Doctor doctor = doctorRepository.findByUserUserId(userId).orElse(null);
                        if (doctor != null) {
                                if (!appointmentRepository.findByDoctorOrderByAppointmentDateDescAppointmentTimeDesc(doctor).isEmpty()) {
                                        throw new RuntimeException("Cannot delete this doctor because appointment history exists");
                                }
                                doctorRepository.delete(doctor);
                        }
                } else if (Role.ASSISTANT.equals(user.getRole())) {
                        assistantRepository.findByUserUserId(userId).ifPresent(assistantRepository::delete);
                } else if (Role.PATIENT.equals(user.getRole())) {
                        Patient patient = patientRepository.findByUserUserId(userId).orElse(null);
                        if (patient != null) {
                                if (!appointmentRepository.findByPatientOrderByAppointmentDateDescAppointmentTimeDesc(patient).isEmpty()) {
                                        throw new RuntimeException("Cannot delete this patient because appointment history exists");
                                }
                                patientRepository.delete(patient);
                        }
                } else if (Role.ADMIN.equals(user.getRole())) {
                        adminRepository.findByUserUserId(userId).ifPresent(adminRepository::delete);
                }

                String deletedEmail = user.getEmail();
                userRepository.delete(user);

                Map<String, Object> response = new LinkedHashMap<>();
                response.put("deleted", true);
                response.put("userId", userId);
                response.put("email", deletedEmail);
                return response;
        }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> getAllAppointments() {
        return appointmentService.getAllAppointmentsForAdmin();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllPayments() {
        return appointmentRepository.findAll()
                .stream()
                .filter(a -> a.getTransactionId() != null || a.getStatus() == Appointment.AppointmentStatus.PAYMENT_PENDING)
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(this::toPaymentMap)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<AssistantResponse> getAllAssistants() {
        return assistantRepository.findAll()
                .stream()
                .map(this::toAssistantResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public AssistantResponse assignAssistantDoctor(Integer assistantId, Integer doctorId) {
        Assistant assistant = assistantRepository.findById(assistantId)
                .orElseThrow(() -> new RuntimeException("Assistant not found"));

        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new RuntimeException("Doctor not found"));

        assistant.setDoctor(doctor);
        assistantRepository.save(assistant);

        return toAssistantResponse(assistant);
    }

        @Transactional
        public AssistantResponse unassignAssistantDoctor(Integer assistantId) {
                Assistant assistant = assistantRepository.findById(assistantId)
                                .orElseThrow(() -> new RuntimeException("Assistant not found"));

                assistant.setDoctor(null);
                assistantRepository.save(assistant);

                return toAssistantResponse(assistant);
        }

    @Transactional(readOnly = true)
    public Map<String, Object> getDailyReport(LocalDate date, Integer doctorId) {
        List<Appointment> all = appointmentRepository.findAll();

        String selectedDoctorName = "All Doctors";
        if (doctorId != null) {
            Doctor selectedDoctor = doctorRepository.findById(doctorId)
                    .orElseThrow(() -> new RuntimeException("Doctor not found"));
            User selectedDoctorUser = selectedDoctor.getUser();
            selectedDoctorName = selectedDoctorUser != null
                    ? (selectedDoctorUser.getFirstName() + " " + selectedDoctorUser.getLastName()).trim()
                    : "Doctor #" + doctorId;
        }

        List<Appointment> today = all.stream()
                .filter(a -> date.equals(a.getAppointmentDate()))
                .filter(a -> doctorId == null
                        || (a.getDoctor() != null && doctorId.equals(a.getDoctor().getDoctorId())))
                .collect(Collectors.toList());

        long todayAppointments = today.size();

        long confirmedToday = today.stream()
                .filter(a -> a.getStatus() == Appointment.AppointmentStatus.CONFIRMED
                        || a.getStatus() == Appointment.AppointmentStatus.COMPLETED
                        || a.getStatus() == Appointment.AppointmentStatus.IN_PROGRESS)
                .count();

        long pendingToday = today.stream()
                .filter(a -> a.getStatus() == Appointment.AppointmentStatus.PENDING
                        || a.getStatus() == Appointment.AppointmentStatus.PAYMENT_PENDING)
                .count();

        long completedToday = today.stream()
                .filter(a -> a.getStatus() == Appointment.AppointmentStatus.COMPLETED)
                .count();

        long cancelledToday = today.stream()
                .filter(a -> a.getStatus() == Appointment.AppointmentStatus.CANCELLED
                        || a.getStatus() == Appointment.AppointmentStatus.REJECTED)
                .count();

        long noShowToday = today.stream()
                .filter(a -> a.getStatus() == Appointment.AppointmentStatus.NO_SHOW)
                .count();

        long onlineToday = today.stream()
                .filter(a -> a.getAppointmentType() == Appointment.AppointmentType.ONLINE)
                .count();

        long inPersonToday = today.stream()
                .filter(a -> a.getAppointmentType() == Appointment.AppointmentType.IN_PERSON)
                .count();

        double estimatedRevenue = today.stream()
                .filter(a -> a.getStatus() == Appointment.AppointmentStatus.CONFIRMED
                        || a.getStatus() == Appointment.AppointmentStatus.COMPLETED)
                .mapToDouble(a -> {
                    if (a.getDoctor() != null && a.getDoctor().getConsultationFee() != null) {
                        return a.getDoctor().getConsultationFee();
                    }
                    return 0.0;
                })
                .sum();

        double potentialRevenue = today.stream()
                .filter(a -> a.getStatus() != Appointment.AppointmentStatus.CANCELLED
                        && a.getStatus() != Appointment.AppointmentStatus.REJECTED)
                .mapToDouble(a -> {
                    if (a.getDoctor() != null && a.getDoctor().getConsultationFee() != null) {
                        return a.getDoctor().getConsultationFee();
                    }
                    return 0.0;
                })
                .sum();

        double collectionRate = potentialRevenue > 0.0
                ? (estimatedRevenue / potentialRevenue) * 100.0
                : 0.0;

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("date", date);
        report.put("totalAppointments", todayAppointments);
        report.put("confirmedAppointments", confirmedToday);
        report.put("pendingAppointments", pendingToday);
        report.put("completedAppointments", completedToday);
        report.put("cancelledAppointments", cancelledToday);
        report.put("noShowAppointments", noShowToday);
        report.put("onlineAppointments", onlineToday);
        report.put("inPersonAppointments", inPersonToday);
        report.put("estimatedRevenue", estimatedRevenue);
        report.put("collectionRate", Math.round(collectionRate * 100.0) / 100.0);
        report.put("totalUsers", userRepository.count());
        report.put("totalAssistants", assistantRepository.count());
        report.put("totalDoctors", doctorId != null ? 1 : doctorRepository.count());
        report.put("selectedDoctorId", doctorId);
        report.put("selectedDoctorName", selectedDoctorName);
        report.put("doctorWiseReport", buildDoctorWiseReport(today));

        return report;
    }

    @Transactional(readOnly = true)
    public byte[] getDailyReportPdf(LocalDate date, Integer doctorId, String generatedByEmail) {
        Map<String, Object> report = getDailyReport(date, doctorId);
        List<AppointmentResponse> appointments = appointmentService.getAllAppointmentsForAdmin()
                .stream()
                .filter(a -> date.equals(a.getAppointmentDate()))
                .filter(a -> doctorId == null || doctorId.equals(a.getDoctorId()))
                .collect(Collectors.toList());
        return adminReportPdfService.generateDailyReportPdf(date, report, appointments, generatedByEmail);
    }

        private List<Map<String, Object>> buildDoctorWiseReport(List<Appointment> appointments) {
                Map<String, DoctorReportSummary> summaries = new LinkedHashMap<>();

                for (Appointment appointment : appointments) {
                        Doctor doctor = appointment.getDoctor();
                        User doctorUser = doctor != null ? doctor.getUser() : null;

                        Integer doctorId = doctor != null ? doctor.getDoctorId() : null;
                        String doctorName = doctorUser != null
                                        ? doctorUser.getFirstName() + " " + doctorUser.getLastName()
                                        : "Unassigned Doctor";
                        String specialization = doctor != null && doctor.getSpecialization() != null
                                        ? doctor.getSpecialization()
                                        : "-";
                        String key = doctorId != null ? String.valueOf(doctorId) : doctorName;

                        DoctorReportSummary summary = summaries.computeIfAbsent(key,
                                        ignored -> new DoctorReportSummary(doctorId, doctorName, specialization));
                        summary.totalAppointments++;

                        Appointment.AppointmentStatus status = appointment.getStatus();
                        if (status == Appointment.AppointmentStatus.CONFIRMED
                                        || status == Appointment.AppointmentStatus.COMPLETED
                                        || status == Appointment.AppointmentStatus.IN_PROGRESS) {
                                summary.confirmedAppointments++;
                        }
                        if (status == Appointment.AppointmentStatus.PENDING
                                        || status == Appointment.AppointmentStatus.PAYMENT_PENDING) {
                                summary.pendingAppointments++;
                        }
                        if (status == Appointment.AppointmentStatus.COMPLETED) {
                                summary.completedAppointments++;
                        }
                        if (status == Appointment.AppointmentStatus.CANCELLED
                                        || status == Appointment.AppointmentStatus.REJECTED) {
                                summary.cancelledAppointments++;
                        }
                        if (status == Appointment.AppointmentStatus.NO_SHOW) {
                                summary.noShowAppointments++;
                        }
                        if (appointment.getAppointmentType() == Appointment.AppointmentType.ONLINE) {
                                summary.onlineAppointments++;
                        }
                        if (appointment.getAppointmentType() == Appointment.AppointmentType.IN_PERSON) {
                                summary.inPersonAppointments++;
                        }
                        if ((status == Appointment.AppointmentStatus.CONFIRMED
                                        || status == Appointment.AppointmentStatus.COMPLETED)
                                        && doctor != null
                                        && doctor.getConsultationFee() != null) {
                                summary.estimatedRevenue += doctor.getConsultationFee();
                        }
                }

                return summaries.values().stream()
                                .sorted((a, b) -> {
                                        int totalCompare = Long.compare(b.totalAppointments, a.totalAppointments);
                                        if (totalCompare != 0) {
                                                return totalCompare;
                                        }
                                                                                return safeDoctorName(a.doctorName).compareToIgnoreCase(safeDoctorName(b.doctorName));
                                })
                                .map(DoctorReportSummary::toMap)
                                .collect(Collectors.toList());
        }

        private String safeDoctorName(String doctorName) {
                if (doctorName == null || doctorName.isBlank()) {
                        return "";
                }
                return doctorName;
        }

    private Map<String, Object> toUserMap(User user) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("userId", user.getUserId());
        item.put("firstName", user.getFirstName());
        item.put("lastName", user.getLastName());
        item.put("email", user.getEmail());
        item.put("phoneNumber", user.getPhoneNumber());
        item.put("role", user.getRole());
        item.put("isActive", user.getIsActive());
        item.put("createdAt", user.getCreatedAt());
        return item;
    }

    private Map<String, Object> toPaymentMap(Appointment appointment) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("appointmentId", appointment.getAppointmentId());
        item.put("transactionId", appointment.getTransactionId());
        item.put("status", appointment.getStatus() != null ? appointment.getStatus().name() : null);
        item.put("createdAt", appointment.getCreatedAt());
        item.put("appointmentDate", appointment.getAppointmentDate());
        item.put("patientName", appointment.getPatient() != null && appointment.getPatient().getUser() != null
                ? appointment.getPatient().getUser().getFirstName() + " " + appointment.getPatient().getUser().getLastName()
                : null);
        item.put("doctorName", appointment.getDoctor() != null && appointment.getDoctor().getUser() != null
                ? appointment.getDoctor().getUser().getFirstName() + " " + appointment.getDoctor().getUser().getLastName()
                : null);
        item.put("amount", appointment.getDoctor() != null ? appointment.getDoctor().getConsultationFee() : null);
        return item;
    }

    private AssistantResponse toAssistantResponse(Assistant assistant) {
        User user = assistant.getUser();
        Doctor doctor = assistant.getDoctor();

        Integer doctorId = null;
        String doctorName = null;
        if (doctor != null && doctor.getUser() != null) {
            doctorId = doctor.getDoctorId();
            doctorName = doctor.getUser().getFirstName() + " " + doctor.getUser().getLastName();
        }

        return new AssistantResponse(
                assistant.getAssistantId(),
                user != null ? user.getUserId() : null,
                user != null ? user.getFirstName() : null,
                user != null ? user.getLastName() : null,
                user != null ? user.getEmail() : null,
                user != null ? user.getPhoneNumber() : null,
                user != null ? user.getIsActive() : null,
                doctorId,
                doctorName
        );
    }

        private static final class DoctorReportSummary {
                private final Integer doctorId;
                private final String doctorName;
                private final String specialization;
                private long totalAppointments;
                private long confirmedAppointments;
                private long pendingAppointments;
                private long completedAppointments;
                private long cancelledAppointments;
                private long noShowAppointments;
                private long onlineAppointments;
                private long inPersonAppointments;
                private double estimatedRevenue;

                private DoctorReportSummary(Integer doctorId, String doctorName, String specialization) {
                        this.doctorId = doctorId;
                        this.doctorName = doctorName;
                        this.specialization = specialization;
                }

                private Map<String, Object> toMap() {
                        Map<String, Object> item = new LinkedHashMap<>();
                        item.put("doctorId", doctorId);
                        item.put("doctorName", doctorName);
                        item.put("specialization", specialization);
                        item.put("totalAppointments", totalAppointments);
                        item.put("confirmedAppointments", confirmedAppointments);
                        item.put("pendingAppointments", pendingAppointments);
                        item.put("completedAppointments", completedAppointments);
                        item.put("cancelledAppointments", cancelledAppointments);
                        item.put("noShowAppointments", noShowAppointments);
                        item.put("onlineAppointments", onlineAppointments);
                        item.put("inPersonAppointments", inPersonAppointments);
                        item.put("estimatedRevenue", estimatedRevenue);
                        return item;
                }
        }
}
