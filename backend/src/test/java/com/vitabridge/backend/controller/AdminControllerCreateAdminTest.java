package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.AddAdminRequest;
import com.vitabridge.backend.dto.AdminResponse;
import com.vitabridge.backend.model.Admin;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.AdminRepository;
import com.vitabridge.backend.repository.UserRepository;
import com.vitabridge.backend.service.AdminLogService;
import com.vitabridge.backend.service.AdminService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminControllerCreateAdminTest {

        @Mock
        private AdminRepository adminRepository;

        @Mock
        private UserRepository userRepository;

        @Mock
        private PasswordEncoder passwordEncoder;

        @Mock
        private AdminLogService adminLogService;

        @InjectMocks
        private AdminService adminService;

        @AfterEach
        void clearSecurityContext() {
                SecurityContextHolder.clearContext();
        }

        @Test
        void createAdminCreatesAdminUserAndReturnsResponse() {
                SecurityContextHolder.getContext()
                                .setAuthentication(new TestingAuthenticationToken("root.admin@example.com", null));

                AddAdminRequest request = new AddAdminRequest(
                                "  Alice  ",
                                " Admin ",
                                "  Alice.Admin@Example.com  ",
                                " +88017 0000-0000 ",
                                "Password123!");

                when(userRepository.existsByEmail(anyString())).thenReturn(false);
                when(userRepository.existsByPhoneNumber(anyString())).thenReturn(false);
                when(passwordEncoder.encode(request.getPassword())).thenReturn("encoded-password");
                when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
                        User user = invocation.getArgument(0);
                        user.setUserId(101);
                        return user;
                });
                when(adminRepository.save(any(Admin.class))).thenAnswer(invocation -> {
                        Admin admin = invocation.getArgument(0);
                        admin.setAdminId(1);
                        return admin;
                });

                AdminResponse created = adminService.createAdmin(request);

                assertEquals(1, created.getAdminId());
                assertEquals(101, created.getUserId());
                assertEquals("alice.admin@example.com", created.getEmail());
                assertEquals("Alice", created.getFirstName());
                assertEquals("Admin", created.getLastName());
                assertEquals("+8801700000000", created.getPhoneNumber());
                assertTrue(created.getIsActive());
        }
}
