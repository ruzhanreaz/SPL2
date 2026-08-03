package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.AddDoctorRequest;
import com.vitabridge.backend.dto.DoctorResponse;
import com.vitabridge.backend.model.Doctor;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.DoctorRepository;
import com.vitabridge.backend.repository.UserRepository;
import com.vitabridge.backend.service.AdminLogService;
import com.vitabridge.backend.service.DoctorService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DoctorControllerCreateDoctorTest {

        @Mock
        private DoctorRepository doctorRepository;

        @Mock
        private UserRepository userRepository;

        @Mock
        private PasswordEncoder passwordEncoder;

        @Mock
        private AdminLogService adminLogService;

        @Mock
        private SimpMessagingTemplate messagingTemplate;

        @InjectMocks
        private DoctorService doctorService;

        @AfterEach
        void clearSecurityContext() {
                SecurityContextHolder.clearContext();
        }

        @Test
        void createDoctorCreatesDoctorUserAndReturnsResponse() {
                SecurityContextHolder.getContext()
                                .setAuthentication(new TestingAuthenticationToken("root.admin@example.com", null));

                AddDoctorRequest request = new AddDoctorRequest(
                                "  David  ",
                                " Doctor ",
                                "  David.Doctor@Example.com  ",
                                " +88017 1111-1111 ",
                                "Password123!",
                                " Cardiology ");

                when(userRepository.existsByEmail(anyString())).thenReturn(false);
                when(userRepository.existsByPhoneNumber(anyString())).thenReturn(false);
                when(passwordEncoder.encode(request.getPassword())).thenReturn("encoded-password");
                when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
                        User user = invocation.getArgument(0);
                        user.setUserId(201);
                        return user;
                });
                when(doctorRepository.save(any(Doctor.class))).thenAnswer(invocation -> {
                        Doctor doctor = invocation.getArgument(0);
                        doctor.setDoctorId(1);
                        return doctor;
                });

                DoctorResponse created = doctorService.createDoctor(request);

                assertEquals(1, created.getDoctorId());
                assertEquals(201, created.getUserId());
                assertEquals("david.doctor@example.com", created.getEmail());
                assertEquals("+8801711111111", created.getPhoneNumber());
                assertEquals("Cardiology", created.getSpecialization());
                assertEquals("David", created.getFirstName());
                assertEquals("Doctor", created.getLastName());
                assertTrue(created.getIsActive());
        }
}
