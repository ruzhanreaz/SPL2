package com.vitabridge.backend.service;

import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

/**
 * Custom UserDetailsService implementation for loading user-specific data.
 * Supports authentication via email or phone number.
 */
@Service
public class CustomUserDetailsService implements UserDetailsService {

        private static final Logger logger = LoggerFactory.getLogger(CustomUserDetailsService.class);

        @Autowired
        private UserRepository userRepository;

        /**
         * Loads user by username (email or phone number).
         * Used by Spring Security for authentication.
         *
         * @param identifier Email or phone number
         * @return UserDetails object for Spring Security
         * @throws UsernameNotFoundException if user not found
         */
        @Override
        public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
                logger.debug("Loading user by identifier: {}", identifier);

                User user = findUserByIdentifier(identifier);

                // Build authorities with ROLE_ prefix required by Spring Security
                SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + user.getRole().getValue());

                return org.springframework.security.core.userdetails.User.builder()
                                .username(user.getEmail()) // Use email as principal username
                                .password(user.getPassword())
                                .authorities(Collections.singletonList(authority))
                                .accountExpired(false)
                                .accountLocked(Boolean.TRUE.equals(user.getIsLocked()))
                                .credentialsExpired(false)
                                .disabled(!Boolean.TRUE.equals(user.getIsActive()))
                                .build();
        }

        /**
         * Loads the User entity by identifier (email or phone number).
         * Used for retrieving full user information.
         *
         * @param identifier Email or phone number
         * @return User entity
         * @throws UsernameNotFoundException if user not found
         */
        public User loadUserEntityByIdentifier(String identifier) throws UsernameNotFoundException {
                logger.debug("Loading user entity by identifier");
                return findUserByIdentifier(identifier);
        }

        /**
         * Helper method to find user by email or phone number.
         *
         * @param identifier Email or phone number
         * @return User entity
         * @throws UsernameNotFoundException if user not found
         */
        private User findUserByIdentifier(String identifier) throws UsernameNotFoundException {
                if (identifier == null || identifier.trim().isEmpty()) {
                        throw new UsernameNotFoundException("Identifier cannot be empty");
                }

                String normalizedIdentifier = identifier.trim();

                // Try to find by email first, then by phone number
                return userRepository.findByEmail(normalizedIdentifier)
                                .or(() -> userRepository.findByPhoneNumber(normalizedIdentifier))
                                .orElseThrow(() -> {
                                        logger.warn("User not found with identifier: {}", normalizedIdentifier);
                                        return new UsernameNotFoundException(
                                                        "User not found with provided credentials");
                                });
        }
}
