package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.AddAssistantRequest;
import com.vitabridge.backend.dto.AssistantResponse;
import com.vitabridge.backend.model.Assistant;
import com.vitabridge.backend.model.Doctor;
import com.vitabridge.backend.model.Role;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.AssistantRepository;
import com.vitabridge.backend.repository.DoctorRepository;
import com.vitabridge.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AssistantService {

    @Autowired
    private AssistantRepository assistantRepository;

    @Autowired
    private DoctorRepository doctorRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public List<AssistantResponse> getAllAssistantsByDoctor(Integer doctorId) {
        List<Assistant> assistants = assistantRepository.findByDoctorDoctorId(doctorId);
        return assistants.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    public AssistantResponse getAssistantById(Integer assistantId) {
        Assistant assistant = assistantRepository.findById(assistantId)
                .orElseThrow(() -> new RuntimeException("Assistant not found with id: " + assistantId));
        return convertToResponse(assistant);
    }

    @Transactional
    public void deleteAssistant(Integer assistantId, Integer doctorId) {
        Assistant assistant = assistantRepository.findById(assistantId)
                .orElseThrow(() -> new RuntimeException("Assistant not found with id: " + assistantId));

        // Verify that the assistant belongs to the doctor
        if (assistant.getDoctor() == null || !assistant.getDoctor().getDoctorId().equals(doctorId)) {
            throw new RuntimeException("This assistant does not belong to the specified doctor");
        }

        assistantRepository.delete(assistant);
    }

    @Transactional
    public AssistantResponse toggleAssistantStatus(Integer assistantId, Integer doctorId) {
        Assistant assistant = assistantRepository.findById(assistantId)
                .orElseThrow(() -> new RuntimeException("Assistant not found with id: " + assistantId));

        // Verify that the assistant belongs to the doctor
        if (assistant.getDoctor() == null || !assistant.getDoctor().getDoctorId().equals(doctorId)) {
            throw new RuntimeException("This assistant does not belong to the specified doctor");
        }

        User user = assistant.getUser();
        user.setIsActive(!user.getIsActive());
        userRepository.save(user);

        return convertToResponse(assistant);
    }

    @Transactional
    public AssistantResponse createAssistant(AddAssistantRequest request, Integer doctorId) {
        // Validate email uniqueness
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already exists");
        }

        // Validate phone number uniqueness
        if (userRepository.existsByPhoneNumber(request.getPhoneNumber())) {
            throw new RuntimeException("Phone number already exists");
        }

        // Get the doctor
        Doctor doctor = doctorRepository.findById(doctorId)
                .orElseThrow(() -> new RuntimeException("Doctor not found with id: " + doctorId));

        // Create user
        User user = new User();
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setEmail(request.getEmail());
        user.setPhoneNumber(request.getPhoneNumber());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(Role.ASSISTANT);
        user.setIsActive(true);

        user = userRepository.save(user);

        // Create assistant record
        Assistant assistant = new Assistant();
        assistant.setUser(user);
        assistant.setDoctor(doctor);

        assistant = assistantRepository.save(assistant);

        return convertToResponse(assistant);
    }

    private AssistantResponse convertToResponse(Assistant assistant) {
        User user = assistant.getUser();
        Doctor doctor = assistant.getDoctor();

        Integer doctorId = null;
        String doctorName = null;

        if (doctor != null) {
            User doctorUser = doctor.getUser();
            doctorId = doctor.getDoctorId();
            doctorName = doctorUser.getFirstName() + " " + doctorUser.getLastName();
        }

        return new AssistantResponse(
                assistant.getAssistantId(),
                user.getUserId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getPhoneNumber(),
                user.getIsActive(),
                doctorId,
                doctorName);
    }
}
