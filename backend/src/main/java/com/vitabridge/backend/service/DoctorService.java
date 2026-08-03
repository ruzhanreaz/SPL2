package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.AddDoctorRequest;
import com.vitabridge.backend.dto.DoctorResponse;
import com.vitabridge.backend.model.Doctor;
import com.vitabridge.backend.model.Role;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.DoctorRepository;
import com.vitabridge.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class DoctorService {

    @Autowired
    private DoctorRepository doctorRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AdminLogService adminLogService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public List<DoctorResponse> getAllDoctors() {
        List<Doctor> doctors = doctorRepository.findAll();
        return doctors.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    public DoctorResponse getDoctorById(Integer doctorId) {
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new RuntimeException("Doctor not found with id: " + doctorId));
        return convertToResponse(doctor);
    }

        public DoctorResponse getDoctorByEmail(String doctorEmail) {
        User user = userRepository.findByEmail(doctorEmail)
            .orElseThrow(() -> new RuntimeException("User not found"));

        Doctor doctor = doctorRepository.findByUser(user)
            .orElseThrow(() -> new RuntimeException("Doctor profile not found"));
        return convertToResponse(doctor);
        }

    @Transactional
    public void deleteDoctor(Integer doctorId) {
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new RuntimeException("Doctor not found with id: " + doctorId));

        String currentAdminEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        String deletedDoctorEmail = doctor.getUser().getEmail();

        doctorRepository.delete(doctor);

        adminLogService.logAction(currentAdminEmail, "DELETE_DOCTOR",
                "Deleted doctor: " + deletedDoctorEmail, "DOCTOR", doctorId);

        publishDoctorStatusUpdate(doctorId, false, true);
    }

    @Transactional
    public DoctorResponse toggleDoctorStatus(Integer doctorId) {
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new RuntimeException("Doctor not found with id: " + doctorId));

        User user = doctor.getUser();
        user.setIsActive(!user.getIsActive());
        userRepository.save(user);

        String currentAdminEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        String action = user.getIsActive() ? "ACTIVATE_DOCTOR" : "DEACTIVATE_DOCTOR";
        adminLogService.logAction(currentAdminEmail, action,
                "Changed status of doctor: " + user.getEmail() + " to " + (user.getIsActive() ? "active" : "inactive"),
                "DOCTOR", doctorId);

        publishDoctorStatusUpdate(doctorId, user.getIsActive(), false);

        return convertToResponse(doctor);
    }

    @Transactional
    public DoctorResponse createDoctor(AddDoctorRequest request) {
        String firstName = normalizeInput(request.getFirstName());
        String lastName = normalizeInput(request.getLastName());
        String email = normalizeEmail(request.getEmail());
        String phoneNumber = normalizePhoneNumber(request.getPhoneNumber());
        String specialization = normalizeInput(request.getSpecialization());
        String location = normalizeInput(request.getLocation());
        String about = normalizeInput(request.getAbout());
        String qualifications = normalizeInput(request.getQualifications());
        String languages = normalizeInput(request.getLanguages());
        String hospitalAffiliation = normalizeInput(request.getHospitalAffiliation());
        String registrationNumber = normalizeInput(request.getRegistrationNumber());

        // Validate email and phone uniqueness
        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("Email already exists");
        }
        if (userRepository.existsByPhoneNumber(phoneNumber)) {
            throw new RuntimeException("Phone number already exists");
        }

        // Create user
        User user = new User();
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setEmail(email);
        user.setPhoneNumber(phoneNumber);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(Role.DOCTOR);
        user.setIsActive(true);

        user = userRepository.save(user);

        // Create doctor record
        Doctor doctor = new Doctor();
        doctor.setUser(user);
        doctor.setSpecialization(specialization);
        doctor.setYearOfExperience(request.getYearOfExperience());
        doctor.setLocation(location);
        doctor.setConsultationFee(request.getConsultationFee());
        doctor.setIsAvailableForCalls(true);
        doctor.setAbout(about);
        doctor.setQualifications(qualifications);
        doctor.setLanguages(languages);
        doctor.setHospitalAffiliation(hospitalAffiliation);
        doctor.setRegistrationNumber(registrationNumber);

        doctor = doctorRepository.save(doctor);

        String currentAdminEmail = SecurityContextHolder.getContext().getAuthentication().getName();
        adminLogService.logAction(currentAdminEmail, "CREATE_DOCTOR",
                "Created new doctor: " + user.getEmail() + " (" + request.getSpecialization() + ")",
                "DOCTOR", doctor.getDoctorId());

        publishDoctorStatusUpdate(doctor.getDoctorId(), true, false);

        return convertToResponse(doctor);
    }

    private String normalizeInput(String value) {
        return value != null ? value.trim() : null;
    }

    private String normalizeEmail(String value) {
        String normalized = normalizeInput(value);
        return normalized != null ? normalized.toLowerCase() : null;
    }

    private String normalizePhoneNumber(String value) {
        String normalized = normalizeInput(value);
        if (normalized == null) {
            return null;
        }

        return normalized.replaceAll("[\\s()-]", "");
    }

    private void publishDoctorStatusUpdate(Integer doctorId, Boolean isActive, Boolean deleted) {
        if (doctorId == null) {
            return;
        }

        messagingTemplate.convertAndSend(
                "/topic/doctors/status",
                (Object) Map.of(
                        "doctorId", doctorId,
                        "isActive", isActive,
                "isAvailableForCalls", doctorRepository.findById(doctorId)
                    .map(Doctor::getIsAvailableForCalls)
                    .orElse(true),
                        "deleted", deleted,
                        "event", "DOCTOR_STATUS_UPDATED",
                        "timestamp", System.currentTimeMillis()));
    }

    private DoctorResponse convertToResponse(Doctor doctor) {
        User user = doctor.getUser();
        return new DoctorResponse(
                doctor.getDoctorId(),
                user.getUserId(),
                user.getFirstName(),
                user.getLastName(),
            user.getProfileImageUrl(),
                user.getEmail(),
                user.getPhoneNumber(),
                doctor.getSpecialization(),
                doctor.getYearOfExperience(),
                doctor.getLocation(),
                doctor.getConsultationFee(),
                doctor.getAbout(),
                doctor.getQualifications(),
                doctor.getLanguages(),
                doctor.getHospitalAffiliation(),
                doctor.getRegistrationNumber(),
                user.getIsActive(),
                doctor.getIsAvailableForCalls() != null ? doctor.getIsAvailableForCalls() : true,
                doctor.getAverageRating() != null ? doctor.getAverageRating() : 0.0,
                doctor.getTotalRatings() != null ? doctor.getTotalRatings() : 0);
    }

    @Transactional
    public DoctorResponse setCallAvailability(String doctorEmail, Boolean available) {
        if (available == null) {
            throw new RuntimeException("Call availability value is required");
        }

        User user = userRepository.findByEmail(doctorEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!Role.DOCTOR.equals(user.getRole())) {
            throw new RuntimeException("Only doctors can update call availability");
        }

        Doctor doctor = doctorRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("Doctor profile not found"));

        doctor.setIsAvailableForCalls(available);
        Doctor saved = doctorRepository.save(doctor);
        publishDoctorStatusUpdate(saved.getDoctorId(), saved.getUser().getIsActive(), false);
        return convertToResponse(saved);
    }
}
