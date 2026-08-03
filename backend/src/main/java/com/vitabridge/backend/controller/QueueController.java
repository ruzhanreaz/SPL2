package com.vitabridge.backend.controller;

import com.vitabridge.backend.dto.QueueStateDTO;
import com.vitabridge.backend.service.QueueService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/queue")
public class QueueController {

    @Autowired
    private QueueService queueService;

    // -------------------------------------------------------------------------
    // GET – read queue state
    // -------------------------------------------------------------------------

    /** Doctor or assistant: get full queue for a date */
    @GetMapping("/{doctorId}/{date}")
    public ResponseEntity<QueueStateDTO> getQueueState(
            @PathVariable Integer doctorId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(queueService.getQueueState(doctorId, date));
    }

    /** Doctor: get own queue for today */
    @GetMapping("/today")
    public ResponseEntity<QueueStateDTO> getMyQueueToday(Authentication authentication) {
        LocalDate today = LocalDate.now();
        return ResponseEntity.ok(queueService.getQueueStateForDoctor(authentication.getName(), today));
    }

    /** Assistant: get assigned doctor's queue */
    @GetMapping("/assistant/today")
    public ResponseEntity<QueueStateDTO> getAssistantQueueToday(Authentication authentication) {
        LocalDate today = LocalDate.now();
        return ResponseEntity.ok(queueService.getQueueStateForAssistant(authentication.getName(), today));
    }

    /** Assistant: get queue for specific date */
    @GetMapping("/assistant/{date}")
    public ResponseEntity<QueueStateDTO> getAssistantQueueForDate(
            Authentication authentication,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(queueService.getQueueStateForAssistant(authentication.getName(), date));
    }

    // -------------------------------------------------------------------------
    // POST/PUT – queue mutations (doctor & assistant)
    // -------------------------------------------------------------------------

    /** Start the queue for a given day */
    @PostMapping("/{doctorId}/{date}/start")
    public ResponseEntity<QueueStateDTO> startQueue(
            @PathVariable Integer doctorId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(queueService.startQueue(doctorId, date));
    }

    /** Call next patient */
    @PostMapping("/{doctorId}/{date}/next")
    public ResponseEntity<QueueStateDTO> callNext(
            @PathVariable Integer doctorId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(queueService.callNext(doctorId, date));
    }

    /** Set doctor delay */
    @PutMapping("/{doctorId}/{date}/delay")
    public ResponseEntity<QueueStateDTO> setDelay(
            @PathVariable Integer doctorId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestBody Map<String, Integer> body) {
        Integer delay = body.get("delayMinutes");
        return ResponseEntity.ok(queueService.setDelay(doctorId, date, delay));
    }

    /** Skip / mark no-show a specific appointment */
    @PostMapping("/skip/{appointmentId}")
    public ResponseEntity<QueueStateDTO> skipPatient(
            @PathVariable Integer appointmentId,
            Authentication authentication) {
        // Resolve doctor from authentication
        // This works for DOCTOR role; assistant resolves via service
        String email = authentication.getName();
        Integer doctorId = resolveDoctorId(email, authentication);
        return ResponseEntity.ok(queueService.skipPatient(appointmentId, doctorId));
    }

    /** Mark appointment as completed */
    @PostMapping("/complete/{appointmentId}")
    public ResponseEntity<QueueStateDTO> markCompleted(
            @PathVariable Integer appointmentId,
            Authentication authentication) {
        String email = authentication.getName();
        Integer doctorId = resolveDoctorId(email, authentication);
        return ResponseEntity.ok(queueService.markCompleted(appointmentId, doctorId));
    }

    // -------------------------------------------------------------------------
    // Patient-facing: get queue position
    // -------------------------------------------------------------------------

    @GetMapping("/patient/{doctorId}/{date}")
    public ResponseEntity<QueueStateDTO> getPatientQueueView(
            @PathVariable Integer doctorId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            Authentication authentication) {
        return ResponseEntity.ok(queueService.getQueueState(doctorId, date));
    }

    // -------------------------------------------------------------------------
    // Helper
    // -------------------------------------------------------------------------

    @Autowired
    private com.vitabridge.backend.repository.DoctorRepository doctorRepository;

    @Autowired
    private com.vitabridge.backend.repository.UserRepository userRepository;

    @Autowired
    private com.vitabridge.backend.repository.AssistantRepository assistantRepository;

    private Integer resolveDoctorId(String email, Authentication auth) {
        boolean isAssistant = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ASSISTANT"));
        if (isAssistant) {
            var user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            var assistant = assistantRepository.findByUserUserId(user.getUserId())
                    .orElseThrow(() -> new RuntimeException("Assistant not found"));
            if (assistant.getDoctor() == null)
                throw new RuntimeException("Not assigned to doctor");
            return assistant.getDoctor().getDoctorId();
        } else {
            var user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("User not found"));
            var doctor = doctorRepository.findByUser(user)
                    .orElseThrow(() -> new RuntimeException("Doctor not found"));
            return doctor.getDoctorId();
        }
    }
}
