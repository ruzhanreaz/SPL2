package com.vitabridge.backend.config;

import com.vitabridge.backend.service.CustomUserDetailsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.ForwardedHeaderFilter;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

        @Value("${cors.allowed-origins}")
        private String[] allowedOrigins;

        @Autowired
        private CustomUserDetailsService userDetailsService;

        @Autowired
        private JwtRequestFilter jwtRequestFilter;

        @Autowired
        private CustomAuthenticationEntryPoint authenticationEntryPoint;

        @Autowired
        private CustomAccessDeniedHandler accessDeniedHandler;

        @Bean
        public PasswordEncoder passwordEncoder() {
                // BCrypt with strength 12 for better security
                return new BCryptPasswordEncoder(12);
        }

        @Bean
        public AuthenticationProvider authenticationProvider() {
                DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider(userDetailsService);
                authProvider.setPasswordEncoder(passwordEncoder());
                return authProvider;
        }

        @Bean
        public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
                return authConfig.getAuthenticationManager();
        }

        @Bean
        public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
                http
                                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                                .csrf(csrf -> csrf.disable()) // Disabled for JWT-based API

                                // Configure authentication provider
                                .authenticationProvider(authenticationProvider())

                                // Security headers
                                .headers(headers -> headers
                                                .xssProtection(xss -> xss.disable()) // Deprecated header; CSP provides
                                                                                     // protection
                                                .contentSecurityPolicy(csp -> csp
                                                                .policyDirectives(
                                                                                "default-src 'self'; frame-ancestors 'none'; form-action 'self';"))
                                                .frameOptions(frame -> frame.deny())
                                                .httpStrictTransportSecurity(hsts -> hsts
                                                                .includeSubDomains(true)
                                                                .maxAgeInSeconds(31536000))) // 1 year;
                                                                                             // X-Content-Type-Options:
                                                                                             // nosniff is enabled by
                                                                                             // default

                                // Authorization rules
                                .authorizeHttpRequests(authz -> authz
                                                // Public endpoints
                                                .requestMatchers("/api/auth/**").permitAll()
                                                .requestMatchers("/api/public/**").permitAll()
                                                .requestMatchers("/api/contact").permitAll()
                                                .requestMatchers("/api/patient/ai-health-checker/**").permitAll()
                                                .requestMatchers("/error").permitAll()

                                                // Payment callback endpoints (hit by aamarpay redirect / browser)
                                                .requestMatchers("/api/payments/success").permitAll()
                                                .requestMatchers("/api/payments/fail").permitAll()
                                                .requestMatchers("/api/payments/cancel").permitAll()
                                                .requestMatchers("/api/payments/entry/**").permitAll()
                                                .requestMatchers("/api/payments/aamarpay/success").permitAll()
                                                .requestMatchers("/api/payments/aamarpay/fail").permitAll()
                                                .requestMatchers("/api/payments/aamarpay/cancel").permitAll()
                                                .requestMatchers("/api/video/token").permitAll()

                                                // WebSocket endpoints
                                                .requestMatchers(
                                                                "/ws",
                                                                "/ws/**",
                                                                "/ws-telemedicine",
                                                                "/ws-telemedicine/**",
                                                                "/ws-telemedicine-native",
                                                                "/ws-telemedicine-native/**")
                                                .permitAll()

                                                // Admin-only endpoints
                                                .requestMatchers("/api/admin/**").hasRole("ADMIN")

                                                // Doctor endpoints (doctor-specific operations)
                                                .requestMatchers("/api/doctor/assistants/**").hasRole("DOCTOR")
                                                .requestMatchers("/api/doctor/**").hasAnyRole("ADMIN", "DOCTOR")

                                                // Patient endpoints
                                                .requestMatchers("/api/patient/**")
                                                .hasAnyRole("ADMIN", "PATIENT", "DOCTOR")

                                                // Appointment endpoints (accessible by multiple roles)
                                                .requestMatchers("/api/appointments/**").authenticated()

                                                // Queue endpoints
                                                .requestMatchers("/api/queue/**").authenticated()

                                                // Notification endpoints (accessible by all authenticated users)
                                                .requestMatchers("/api/notifications/**").authenticated()

                                                // Profile endpoints (accessible by all authenticated users)
                                                .requestMatchers("/api/profile/**").authenticated()

                                                // Assistant endpoints
                                                .requestMatchers("/api/assistant/**").hasAnyRole("ADMIN", "ASSISTANT")

                                                // Document endpoints
                                                .requestMatchers("/api/documents/**").hasAnyRole("ADMIN", "PATIENT")

                                                // All other requests must be authenticated
                                                .anyRequest().authenticated())

                                // Exception handling
                                .exceptionHandling(exceptions -> exceptions
                                                .authenticationEntryPoint(authenticationEntryPoint)
                                                .accessDeniedHandler(accessDeniedHandler))

                                // Session management - stateless for JWT
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                                // Add JWT filter
                                .addFilterBefore(jwtRequestFilter, UsernamePasswordAuthenticationFilter.class);

                return http.build();
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration configuration = new CorsConfiguration();
                // Use allowed origins from application.properties and support wildcard patterns
                // for network access
                configuration.setAllowedOriginPatterns(Arrays.asList(allowedOrigins));
                configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
                configuration.setAllowedHeaders(Arrays.asList("*"));
                configuration.setAllowCredentials(true);
                configuration.setMaxAge(3600L); // Cache preflight response for 1 hour

                // Payment callbacks can originate from external payment pages. Keep this
                // endpoint permissive so mock/sandbox "success" actions can complete and
                // redirect users back to the frontend result page.
                CorsConfiguration paymentConfiguration = new CorsConfiguration();
                paymentConfiguration.setAllowedOriginPatterns(Arrays.asList("*"));
                paymentConfiguration.setAllowedMethods(Arrays.asList("GET", "POST", "OPTIONS"));
                paymentConfiguration.setAllowedHeaders(Arrays.asList("*"));
                paymentConfiguration.setAllowCredentials(false);
                paymentConfiguration.setMaxAge(3600L);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/api/payments/**", paymentConfiguration);
                source.registerCorsConfiguration("/**", configuration);
                return source;
        }

        @Bean
        public ForwardedHeaderFilter forwardedHeaderFilter() {
                return new ForwardedHeaderFilter();
        }
}
