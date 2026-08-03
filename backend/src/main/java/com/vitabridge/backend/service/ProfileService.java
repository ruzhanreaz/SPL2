package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.ProfileResponse;
import com.vitabridge.backend.dto.ChangePasswordRequest;
import com.vitabridge.backend.dto.UpdateProfileRequest;
import com.vitabridge.backend.dto.ChangePasswordWithOtpRequest;
import com.vitabridge.backend.dto.OtpResponse;
import com.vitabridge.backend.model.Doctor;
import com.vitabridge.backend.model.EmergencyContact;
import com.vitabridge.backend.model.OtpVerification;
import com.vitabridge.backend.model.Patient;
import com.vitabridge.backend.model.Assistant;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.DoctorRepository;
import com.vitabridge.backend.repository.PatientRepository;
import com.vitabridge.backend.repository.AssistantRepository;
import com.vitabridge.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class ProfileService {

    private static final Logger logger = LoggerFactory.getLogger(ProfileService.class);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DoctorRepository doctorRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private AssistantRepository assistantRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private OtpService otpService;

    @Autowired
    private NotificationService notificationService;

    public ProfileResponse getUserProfileByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return getUserProfile(user.getUserId());
    }

    public ProfileResponse updateUserProfileByEmail(String email, UpdateProfileRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return updateUserProfile(user.getUserId(), request);
    }

    @Transactional
    public void changePasswordByEmail(String email, ChangePasswordRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new RuntimeException("Current password is incorrect");
        }

        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new RuntimeException("New password and confirmation do not match");
        }

        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new RuntimeException("New password must be different from current password");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    public ProfileResponse getUserProfile(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        ProfileResponse response = new ProfileResponse();
        response.setUserId(user.getUserId());
        response.setFirstName(user.getFirstName());
        response.setLastName(user.getLastName());
        response.setEmail(user.getEmail());
        response.setPhoneNumber(user.getPhoneNumber());
        response.setProfileImageUrl(user.getProfileImageUrl());
        response.setRole(user.getRole().getValue());
        response.setIsActive(user.getIsActive());

        // If user is a doctor, fetch doctor-specific data
        if ("DOCTOR".equalsIgnoreCase(user.getRole().getValue())) {
            Optional<Doctor> doctorOpt = doctorRepository.findByUserUserId(userId);
            if (doctorOpt.isPresent()) {
                Doctor doctor = doctorOpt.get();
                response.setDoctorId(doctor.getDoctorId());
                response.setDoctorName(doctor.getUser().getFirstName() + " " + doctor.getUser().getLastName());
                response.setSpecialization(doctor.getSpecialization());
                response.setYearOfExperience(doctor.getYearOfExperience());
                response.setLocation(doctor.getLocation());
                response.setConsultationFee(doctor.getConsultationFee());
                response.setAbout(doctor.getAbout());
                response.setQualifications(doctor.getQualifications());
                response.setLanguages(doctor.getLanguages());
                response.setHospitalAffiliation(doctor.getHospitalAffiliation());
            }
        }

        // If user is an assistant, fetch assistant-specific data
        if ("ASSISTANT".equalsIgnoreCase(user.getRole().getValue())) {
            Optional<Assistant> assistantOpt = assistantRepository.findByUserUserId(userId);
            if (assistantOpt.isPresent()) {
                Assistant assistant = assistantOpt.get();
                response.setAssistantId(assistant.getAssistantId());

                if (assistant.getDoctor() != null) {
                    response.setDoctorId(assistant.getDoctor().getDoctorId());
                    response.setDoctorName(
                            assistant.getDoctor().getUser().getFirstName() + " " +
                                    assistant.getDoctor().getUser().getLastName());
                }
            }
        }

        // If user is a patient, fetch patient-specific data
        if ("PATIENT".equalsIgnoreCase(user.getRole().getValue())) {
            Optional<Patient> patientOpt = patientRepository.findByUserUserId(userId);
            if (patientOpt.isPresent()) {
                Patient patient = patientOpt.get();
                response.setPatientId(patient.getPatientId());
                response.setDateOfBirth(patient.getDateOfBirth() != null ? patient.getDateOfBirth().toString() : null);
                if (patient.getDateOfBirth() != null) {
                    response.setAge(Period.between(patient.getDateOfBirth(), LocalDate.now()).getYears());
                }
                response.setGender(patient.getGender());
                response.setWeight(patient.getWeight());
                response.setHeight(patient.getHeight());
                response.setBloodGroup(patient.getBloodGroup());
                response.setCondition(patient.getCondition());
                List<com.vitabridge.backend.dto.EmergencyContactDto> emergencyContacts = new ArrayList<>();
                if (patient.getEmergencyContacts() != null) {
                    for (EmergencyContact contact : patient.getEmergencyContacts()) {
                        emergencyContacts.add(new com.vitabridge.backend.dto.EmergencyContactDto(
                                contact.getName(),
                                contact.getPhone(),
                                contact.getRelation()));
                    }
                }
                response.setEmergencyContacts(emergencyContacts);
            }
        }

        return response;
    }

    @Transactional
    public ProfileResponse updateUserProfile(Integer userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Update common fields
        if (request.getFirstName() != null && !request.getFirstName().trim().isEmpty()) {
            user.setFirstName(request.getFirstName().trim());
        }
        if (request.getLastName() != null && !request.getLastName().trim().isEmpty()) {
            user.setLastName(request.getLastName().trim());
        }
        if (request.getPhoneNumber() != null && !request.getPhoneNumber().trim().isEmpty()) {
            user.setPhoneNumber(request.getPhoneNumber().trim());
        }
        if (request.getProfileImageUrl() != null) {
            String normalizedProfileImageUrl = request.getProfileImageUrl().trim();
            user.setProfileImageUrl(normalizedProfileImageUrl.isEmpty() ? null : normalizedProfileImageUrl);
        }

        userRepository.save(user);

        // Update doctor-specific fields
        if ("DOCTOR".equalsIgnoreCase(user.getRole().getValue())) {
            Optional<Doctor> doctorOpt = doctorRepository.findByUserUserId(userId);
            if (doctorOpt.isPresent()) {
                Doctor doctor = doctorOpt.get();

                if (request.getSpecialization() != null) {
                    doctor.setSpecialization(request.getSpecialization().trim());
                }
                if (request.getYearOfExperience() != null) {
                    doctor.setYearOfExperience(request.getYearOfExperience());
                }
                if (request.getLocation() != null) {
                    doctor.setLocation(request.getLocation().trim());
                }
                if (request.getConsultationFee() != null) {
                    doctor.setConsultationFee(request.getConsultationFee());
                }
                if (request.getAbout() != null) {
                    doctor.setAbout(request.getAbout().trim());
                }
                if (request.getQualifications() != null) {
                    doctor.setQualifications(request.getQualifications().trim());
                }
                if (request.getLanguages() != null) {
                    doctor.setLanguages(request.getLanguages().trim());
                }
                if (request.getHospitalAffiliation() != null) {
                    doctor.setHospitalAffiliation(request.getHospitalAffiliation().trim());
                }

                doctorRepository.save(doctor);
            }
        }

        // Update patient-specific fields
        if ("PATIENT".equalsIgnoreCase(user.getRole().getValue())) {
            Optional<Patient> patientOpt = patientRepository.findByUserUserId(userId);
            if (patientOpt.isPresent()) {
                Patient patient = patientOpt.get();

                if (request.getDateOfBirth() != null && !request.getDateOfBirth().trim().isEmpty()) {
                    patient.setDateOfBirth(LocalDate.parse(request.getDateOfBirth()));
                }
                if (request.getGender() != null) {
                    patient.setGender(request.getGender());
                }
                if (request.getWeight() != null) {
                    patient.setWeight(request.getWeight());
                }
                if (request.getHeight() != null) {
                    patient.setHeight(request.getHeight());
                }
                if (request.getBloodGroup() != null) {
                    patient.setBloodGroup(request.getBloodGroup());
                }
                if (request.getCondition() != null) {
                    patient.setCondition(request.getCondition().trim());
                }
                if (request.getEmergencyContacts() != null) {
                    List<EmergencyContact> emergencyContacts = new ArrayList<>();
                    for (com.vitabridge.backend.dto.EmergencyContactDto contact : request.getEmergencyContacts()) {
                        if (contact == null) {
                            continue;
                        }

                        String name = trimToNull(contact.getName());
                        String phone = trimToNull(contact.getPhone());
                        String relation = trimToNull(contact.getRelation());

                        if (name == null && phone == null && relation == null) {
                            continue;
                        }
                        if (name == null || phone == null) {
                            continue;
                        }

                        emergencyContacts.add(new EmergencyContact(name, phone, relation));
                    }
                    patient.setEmergencyContacts(emergencyContacts);
                }

                patientRepository.save(patient);
            }
        }

        return getUserProfile(userId);
    }

    /**
     * Initiates password change by sending OTP to user's email.
     *
     * @param email User's email address
     * @return OtpResponse indicating OTP was sent
     */
    @Transactional
    public OtpResponse initiatePasswordChange(String email) {
        logger.info("Initiating password change for email: {}", maskEmail(email));

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Generate OTP for password change
        String otp = otpService.generateOtp(email, OtpVerification.OtpPurpose.PASSWORD_CHANGE);

        // Send OTP via email
        boolean emailSent = notificationService.sendOtpEmail(email, otp, "PASSWORD_CHANGE");

        if (!emailSent) {
            logger.error("Failed to send OTP email for password change: {}", maskEmail(email));
            throw new RuntimeException("Failed to send verification email. Please try again.");
        }

        logger.info("OTP sent successfully for password change: {}", maskEmail(email));

        return new OtpResponse(
                "Verification code sent to your email. Please check your inbox.",
                true,
                email);
    }

    /**
     * Changes password after OTP verification.
     *
     * @param email              User's email address
     * @param changePasswordReq   Password change request with OTP
     */
    @Transactional
    public void changePasswordWithOtp(String email, ChangePasswordWithOtpRequest changePasswordReq) {
        logger.info("Changing password with OTP verification for email: {}", maskEmail(email));

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Verify OTP
        if (!otpService.verifyOtp(email, changePasswordReq.getOtp(), OtpVerification.OtpPurpose.PASSWORD_CHANGE)) {
            logger.warn("OTP verification failed for password change: {}", maskEmail(email));
            throw new RuntimeException("Invalid or expired verification code");
        }

        // Validate new password confirmation
        if (!changePasswordReq.getNewPassword().equals(changePasswordReq.getConfirmPassword())) {
            throw new RuntimeException("New password and confirmation do not match");
        }

        // Validate new password is different from current password
        if (passwordEncoder.matches(changePasswordReq.getNewPassword(), user.getPassword())) {
            throw new RuntimeException("New password must be different from current password");
        }

        // Update password
        user.setPassword(passwordEncoder.encode(changePasswordReq.getNewPassword()));
        userRepository.save(user);

        logger.info("Password changed successfully with OTP verification for email: {}", maskEmail(email));
    }

    private String maskEmail(String email) {
        if (email == null || email.length() < 3) {
            return "***";
        }
        int atIndex = email.indexOf('@');
        if (atIndex > 2) {
            return email.substring(0, 2) + "***" + email.substring(atIndex);
        }
        return email.substring(0, 2) + "***";
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
