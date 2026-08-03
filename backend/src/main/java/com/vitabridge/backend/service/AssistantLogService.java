package com.vitabridge.backend.service;

import com.vitabridge.backend.dto.*;
import com.vitabridge.backend.model.*;
import com.vitabridge.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AssistantLogService {

        @Autowired
        private AssistantLogRepository assistantLogRepository;

        @Autowired
        private AssistantRepository assistantRepository;

        @Autowired
        private DoctorRepository doctorRepository;

        @Autowired
        private UserRepository userRepository;

        public List<AssistantLogResponse> getAssistantLogs(String assistantEmail) {
                User user = userRepository.findByEmail(assistantEmail)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                Assistant assistant = assistantRepository.findByUserUserId(user.getUserId())
                                .orElseThrow(() -> new RuntimeException("Assistant profile not found"));

                List<AssistantLog> logs = assistantLogRepository
                                .findByAssistant_AssistantIdOrderByCreatedAtDesc(assistant.getAssistantId());

                return logs.stream()
                                .map(this::convertToResponse)
                                .collect(Collectors.toList());
        }

        public List<AssistantLogResponse> getDoctorAssistantLogs(String doctorEmail) {
                User user = userRepository.findByEmail(doctorEmail)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                Doctor doctor = doctorRepository.findByUser(user)
                                .orElseThrow(() -> new RuntimeException("Doctor profile not found"));

                List<AssistantLog> logs = assistantLogRepository.findByDoctorOrderByCreatedAtDesc(doctor);

                return logs.stream()
                                .map(this::convertToResponse)
                                .collect(Collectors.toList());
        }

        private AssistantLogResponse convertToResponse(AssistantLog log) {
                User assistantUser = log.getAssistant().getUser();
                User doctorUser = log.getDoctor().getUser();

                return new AssistantLogResponse(
                                log.getLogId(),
                                log.getAssistant().getAssistantId(),
                                assistantUser.getFirstName() + " " + assistantUser.getLastName(),
                                assistantUser.getEmail(),
                                log.getDoctor().getDoctorId(),
                                doctorUser.getFirstName() + " " + doctorUser.getLastName(),
                                log.getAction(),
                                log.getDescription(),
                                log.getEntityType(),
                                log.getEntityId(),
                                log.getCreatedAt());
        }
}
