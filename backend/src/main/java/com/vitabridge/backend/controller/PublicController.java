package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.ContactRequest;
import com.vitabridge.backend.dto.DoctorResponse;
import com.vitabridge.backend.dto.ScheduleResponseDTO;
import com.vitabridge.backend.dto.PublicStatsResponse;
import com.vitabridge.backend.model.Appointment;
import com.vitabridge.backend.model.Doctor;
import com.vitabridge.backend.model.User;
import com.vitabridge.backend.repository.AppointmentRepository;
import com.vitabridge.backend.repository.DoctorRepository;
import com.vitabridge.backend.repository.PatientRepository;
import com.vitabridge.backend.service.DoctorService;
import com.vitabridge.backend.service.ScheduleService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class PublicController {

        private static final Logger logger = LoggerFactory.getLogger(PublicController.class);

        private final DoctorRepository doctorRepository;
        private final PatientRepository patientRepository;
        private final AppointmentRepository appointmentRepository;
        private final DoctorService doctorService;
        private final ScheduleService scheduleService;
        private final JavaMailSender mailSender;

        @Value("${app.notification.from:${spring.mail.username}}")
        private String notificationFrom;

        @Value("${app.contact.recipient:vitabridge.healthcare.demo@gmail.com}")
        private String contactRecipient;

        public PublicController(DoctorRepository doctorRepository,
                        PatientRepository patientRepository,
                        AppointmentRepository appointmentRepository,
                        DoctorService doctorService,
                        ScheduleService scheduleService,
                        JavaMailSender mailSender) {
                this.doctorRepository = doctorRepository;
                this.patientRepository = patientRepository;
                this.appointmentRepository = appointmentRepository;
                this.doctorService = doctorService;
                this.scheduleService = scheduleService;
                this.mailSender = mailSender;
        }

        @GetMapping("/public/stats")
        public ResponseEntity<PublicStatsResponse> getPublicStats() {
                PublicStatsResponse response = new PublicStatsResponse(
                                doctorRepository.count(),
                                patientRepository.count());
                return ResponseEntity.ok(response);
        }

        @GetMapping("/public/doctors")
        public ResponseEntity<List<Map<String, Object>>> getPublicDoctorsBrief() {
                List<Map<String, Object>> doctors = doctorService.getAllDoctors().stream()
                                .filter(doctor -> Boolean.TRUE.equals(doctor.getIsActive()))
                                .map(doctor -> {
                                        Map<String, Object> doctorMap = new LinkedHashMap<>();
                                        doctorMap.put("doctorId", doctor.getDoctorId());
                                        doctorMap.put("firstName", doctor.getFirstName());
                                        doctorMap.put("lastName", doctor.getLastName());
                                        doctorMap.put("profileImageUrl", doctor.getProfileImageUrl());
                                        doctorMap.put("specialization", doctor.getSpecialization());
                                        doctorMap.put("yearOfExperience", doctor.getYearOfExperience());
                                        doctorMap.put("location", doctor.getLocation());
                                        doctorMap.put("consultationFee", doctor.getConsultationFee());
                                        doctorMap.put("about", doctor.getAbout());
                                        doctorMap.put("qualifications", doctor.getQualifications());
                                        doctorMap.put("languages", doctor.getLanguages());
                                        doctorMap.put("hospitalAffiliation", doctor.getHospitalAffiliation());
                                        doctorMap.put("averageRating", doctor.getAverageRating() != null ? doctor.getAverageRating() : 0.0);
                                        doctorMap.put("totalRatings", doctor.getTotalRatings() != null ? doctor.getTotalRatings() : 0);
                                        return doctorMap;
                                })
                                .collect(Collectors.toList());

                return ResponseEntity.ok(doctors);
        }

        @GetMapping("/public/doctors/{doctorId}")
        public ResponseEntity<?> getPublicDoctorProfile(@PathVariable Integer doctorId) {
                try {
                        DoctorResponse doctor = doctorService.getDoctorById(doctorId);
                        if (!Boolean.TRUE.equals(doctor.getIsActive())) {
                                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                                .body(Map.of("message", "Doctor not found"));
                        }

                        Map<String, Object> doctorMap = new LinkedHashMap<>();
                        doctorMap.put("doctorId", doctor.getDoctorId());
                        doctorMap.put("firstName", doctor.getFirstName());
                        doctorMap.put("lastName", doctor.getLastName());
                        doctorMap.put("profileImageUrl", doctor.getProfileImageUrl());
                        doctorMap.put("specialization", doctor.getSpecialization());
                        doctorMap.put("yearOfExperience", doctor.getYearOfExperience());
                        doctorMap.put("location", doctor.getLocation());
                        doctorMap.put("consultationFee", doctor.getConsultationFee());
                        doctorMap.put("about", doctor.getAbout());
                        doctorMap.put("qualifications", doctor.getQualifications());
                        doctorMap.put("languages", doctor.getLanguages());
                        doctorMap.put("hospitalAffiliation", doctor.getHospitalAffiliation());
                        doctorMap.put("averageRating", doctor.getAverageRating() != null ? doctor.getAverageRating() : 0.0);
                        doctorMap.put("totalRatings", doctor.getTotalRatings() != null ? doctor.getTotalRatings() : 0);
                        return ResponseEntity.ok(doctorMap);
                } catch (RuntimeException e) {
                        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                        .body(Map.of("message", e.getMessage()));
                }
        }

        @GetMapping("/public/doctors/{doctorId}/schedule")
        public ResponseEntity<?> getPublicDoctorSchedule(@PathVariable Integer doctorId) {
                try {
                        DoctorResponse doctor = doctorService.getDoctorById(doctorId);
                        if (!Boolean.TRUE.equals(doctor.getIsActive())) {
                                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                                .body(Map.of("message", "Doctor not found"));
                        }

                        ScheduleResponseDTO schedule = scheduleService.getDoctorSchedule(doctorId);
                        return ResponseEntity.ok(schedule);
                } catch (RuntimeException e) {
                        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                        .body(Map.of("message", e.getMessage()));
                }
        }

        @GetMapping("/public/doctors/{doctorId}/reviews")
        public ResponseEntity<?> getPublicDoctorReviews(@PathVariable Integer doctorId) {
                try {
                        Doctor doctor = doctorRepository.findById(doctorId)
                                        .orElseThrow(() -> new RuntimeException("Doctor not found"));

                        if (doctor.getUser() == null || !Boolean.TRUE.equals(doctor.getUser().getIsActive())) {
                                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                                .body(Map.of("message", "Doctor not found"));
                        }

                        List<Map<String, Object>> reviews = appointmentRepository
                                        .findTop20ByDoctorAndRatingIsNotNullOrderByRatedAtDescAppointmentDateDescAppointmentTimeDesc(
                                                        doctor)
                                        .stream()
                                        .map(this::toReviewSummary)
                                        .collect(Collectors.toList());

                        return ResponseEntity.ok(reviews);
                } catch (RuntimeException e) {
                        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                        .body(Map.of("message", e.getMessage()));
                }
        }

        private Map<String, Object> toReviewSummary(Appointment appointment) {
                Map<String, Object> review = new LinkedHashMap<>();
                review.put("appointmentId", appointment.getAppointmentId());
                review.put("rating", appointment.getRating());
                review.put("reviewText", appointment.getReviewText());
                review.put("ratedAt", appointment.getRatedAt());
                review.put("appointmentDate", appointment.getAppointmentDate());
                review.put("appointmentType", appointment.getAppointmentType() != null
                                ? appointment.getAppointmentType().toString()
                                : null);
                review.put("patientName", buildMaskedPatientName(appointment.getPatient().getUser()));
                return review;
        }

        private String buildMaskedPatientName(User user) {
                if (user == null) {
                        return "Anonymous Patient";
                }

                String firstName = user.getFirstName() != null ? user.getFirstName().trim() : "";
                String lastName = user.getLastName() != null ? user.getLastName().trim() : "";

                if (firstName.isEmpty() && lastName.isEmpty()) {
                        return "Anonymous Patient";
                }

                if (lastName.isEmpty()) {
                        return firstName;
                }

                return firstName + " " + lastName.charAt(0) + ".";
        }

        @PostMapping("/contact")
        public ResponseEntity<Map<String, String>> submitContact(@Valid @RequestBody ContactRequest request) {
                logger.info("Contact request received from {} <{}> with subject: {}",
                                request.getName(),
                                request.getEmail(),
                                request.getSubject());

                try {
                        var mimeMessage = mailSender.createMimeMessage();
                        MimeMessageHelper mail = new MimeMessageHelper(mimeMessage, false, "UTF-8");

                        mail.setTo(contactRecipient);
                        if (notificationFrom != null && !notificationFrom.isBlank()) {
                                mail.setFrom(notificationFrom);
                        }
                        if (request.getEmail() != null && !request.getEmail().isBlank()) {
                                mail.setReplyTo(request.getEmail().trim());
                        }

                        String subject = String.format("[VitaBridge Contact] %s", request.getSubject().trim());
                        mail.setSubject(subject);

                        String body = buildContactEmailBody(request);
                        mail.setText(body, true);

                        mailSender.send(mimeMessage);
                } catch (Exception ex) {
                        logger.error("Failed to send contact email for {}: {}", request.getEmail(), ex.getMessage());
                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                        .body(Map.of("message", "Failed to send message. Please try again."));
                }

                return ResponseEntity.ok(Map.of(
                                "message", "Your message has been sent! We'll get back to you shortly."));
        }

                private String buildContactEmailBody(ContactRequest request) {
                                String html = """
                                                                <!doctype html>
                                                                <html>
                                                                <head>
                                                                        <meta charset="UTF-8" />
                                                                        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                                                                </head>
                                                                <body style="margin:0;padding:0;background:#f3f6fb;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
                                                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 12px;">
                                                                                <tr>
                                                                                        <td align="center">
                                                                                                <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
                                                                                                        <tr>
                                                                                                                <td style="background:linear-gradient(135deg,#0f766e,#115e59);padding:16px 24px;color:#ffffff;">
                                                                                                                        <div style="font-size:20px;font-weight:700;letter-spacing:0.2px;">VitaBridge</div>
                                                                                                                        <div style="font-size:13px;opacity:0.95;margin-top:2px;">Contact Form Submission</div>
                                                                                                                </td>
                                                                                                        </tr>
                                                                                                        <tr>
                                                                                                                <td style="padding:24px;">
                                                                                                                        <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#374151;">
                                                                                                                                A new Contact Us request has been submitted.
                                                                                                                        </p>
                                                                                                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dbeafe;background:#f8fbff;border-radius:12px;">
                                                                                                                                <tr>
                                                                                                                                        <td style="padding:16px 18px;line-height:1.7;color:#374151;font-size:14px;">
                                                                                                                                                <div><strong>Name:</strong> __NAME__</div>
                                                                                                                                                <div><strong>Email:</strong> __EMAIL__</div>
                                                                                                                                                <div><strong>Subject:</strong> __SUBJECT__</div>
                                                                                                                                                <div style="margin-top:12px;"><strong>Message:</strong></div>
                                                                                                                                                <div style="margin-top:6px;white-space:pre-wrap;">__MESSAGE__</div>
                                                                                                                                        </td>
                                                                                                                                </tr>
                                                                                                                        </table>
                                                                                                                        <p style="margin:20px 0 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
                                                                                                                                This notification was generated automatically by VitaBridge.
                                                                                                                        </p>
                                                                                                                </td>
                                                                                                        </tr>
                                                                                                </table>
                                                                                        </td>
                                                                                </tr>
                                                                        </table>
                                                                </body>
                                                                </html>
                                                                """;

                                return html
                                                                .replace("__NAME__", escapeHtml(request.getName()))
                                                                .replace("__EMAIL__", escapeHtml(request.getEmail()))
                                                                .replace("__SUBJECT__", escapeHtml(request.getSubject()))
                                                                .replace("__MESSAGE__", escapeHtml(request.getMessage()));
                }

                private String escapeHtml(String value) {
                                if (value == null) {
                                                return "";
                                }

                                return value
                                                                .replace("&", "&amp;")
                                                                .replace("<", "&lt;")
                                                                .replace(">", "&gt;")
                                                                .replace("\"", "&quot;")
                                                                .replace("'", "&#39;");
                }
}
