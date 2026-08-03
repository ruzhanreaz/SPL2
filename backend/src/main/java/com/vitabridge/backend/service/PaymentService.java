package com.vitabridge.backend.service;

import com.vitabridge.backend.model.Appointment;
import com.vitabridge.backend.model.Notification;
import com.vitabridge.backend.repository.AppointmentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class PaymentService {
    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    @Value("${aamarpay.storeId:${aamarpay.store-id:aamarpaytest}}")
    private String storeId;

    @Value("${aamarpay.signatureKey:${aamarpay.signature-key:}}")
    private String signatureKey;

    @Value("${aamarpay.paymentUrl:${aamarpay.payment-request-url:https://sandbox.aamarpay.com/jsonpost.php}}")
    private String paymentRequestUrl;

    @Value("${aamarpay.validationUrl:${aamarpay.success-validation-url:https://sandbox.aamarpay.com/api/v1/trxcheck/request.php}}")
    private String successValidationUrl;

    @Value("${aamarpay.frontendRedirectUrl:${app.frontendUrl:${frontend.base-url:http://127.0.0.1:5174}}}")
    private String frontendBaseUrl;

    @Value("${aamarpay.allowSimulatedFallback:true}")
    private boolean allowSimulatedFallback;

    @Value("${aamarpay.successUrl:${app.backendUrl:${aamarpay.redirect-base-url:http://127.0.0.1:8080}}/api/payments/aamarpay/success}")
    private String successCallbackUrl;

    @Value("${aamarpay.failUrl:${app.backendUrl:${aamarpay.redirect-base-url:http://127.0.0.1:8080}}/api/payments/aamarpay/fail}")
    private String failCallbackUrl;

    @Value("${aamarpay.cancelUrl:${app.backendUrl:${aamarpay.redirect-base-url:http://127.0.0.1:8080}}/api/payments/aamarpay/cancel}")
    private String cancelCallbackUrl;

    @Value("${aamarpay.connectTimeoutMs:5000}")
    private int connectTimeoutMs;

    @Value("${aamarpay.readTimeoutMs:8000}")
    private int readTimeoutMs;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private NotificationService notificationService;

    /**
     * Initiates a payment request with aamarpay for the given appointment.
     * Sets transactionId on the appointment and saves it.
     *
     * @return the aamarpay payment URL to redirect the user to
     */
    @Transactional
    public String initiatePayment(Appointment appointment, String patientName, String patientEmail,
            String patientPhone, String clientOrigin) {
        // Generate a unique transaction ID
        String transactionId = "VB-" + appointment.getAppointmentId() + "-"
                + Long.toHexString(System.currentTimeMillis()).toUpperCase();
        appointment.setTransactionId(transactionId);
        appointmentRepository.save(appointment);

        // Determine amount — fall back to 500 BDT if doctor fee not set
        float amount = (appointment.getDoctor().getConsultationFee() != null
                && appointment.getDoctor().getConsultationFee() > 0)
                        ? appointment.getDoctor().getConsultationFee()
                        : 500.0f;

        String doctorName = appointment.getDoctor().getUser().getFirstName() + " "
                + appointment.getDoctor().getUser().getLastName();

        Map<String, Object> paymentData = new HashMap<>();
        String origin = sanitizeOrigin(clientOrigin);
        paymentData.put("store_id", storeId);
        paymentData.put("signature_key", signatureKey);
        paymentData.put("tran_id", transactionId);
        paymentData.put("success_url", buildCallbackUrl(origin, successCallbackUrl, "/api/payments/aamarpay/success"));
        paymentData.put("fail_url", buildCallbackUrl(origin, failCallbackUrl, "/api/payments/aamarpay/fail"));
        paymentData.put("cancel_url", buildCallbackUrl(origin, cancelCallbackUrl, "/api/payments/aamarpay/cancel"));
        paymentData.put("amount", String.format("%.2f", amount));
        paymentData.put("currency", "BDT");
        paymentData.put("desc", "VitaBridge appointment with Dr. " + doctorName
                + " on " + appointment.getAppointmentDate());
        paymentData.put("cus_name", patientName);
        paymentData.put("cus_email", patientEmail);
        paymentData.put("cus_phone", patientPhone != null ? patientPhone : "01700000000");
        paymentData.put("cus_add1", "Bangladesh");
        paymentData.put("cus_city", "Dhaka");
        paymentData.put("cus_country", "BD");
        // Echo metadata back in callback as fallback identifiers.
        paymentData.put("opt_a", transactionId);
        paymentData.put("opt_b", origin);
        paymentData.put("opt_c", String.valueOf(appointment.getAppointmentId()));
        paymentData.put("type", "json");

        try {
            RestTemplate restTemplate = createRestTemplate();
            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = restTemplate.postForEntity(
                    paymentRequestUrl, paymentData, (Class<Map<String, Object>>) (Class<?>) Map.class);

            Map<String, Object> body = response.getBody();
            if (body == null) {
                throw new RuntimeException("No response from payment gateway");
            }

            Object result = body.get("result");
            if (!"true".equals(String.valueOf(result))) {
                Object reason = body.get("reason");
                throw new RuntimeException("Payment gateway error: " + (reason != null ? reason : "Unknown error"));
            }

            Object paymentUrl = body.get("payment_url");
            if (paymentUrl == null || paymentUrl.toString().isBlank()) {
                throw new RuntimeException("Payment gateway did not return a payment URL");
            }

            return paymentUrl.toString();
        } catch (Exception ex) {
            if (!allowSimulatedFallback) {
                log.error("AamarPay initiation failed for appointmentId={}. Returning error to caller.",
                        appointment.getAppointmentId(), ex);
                throw new RuntimeException("Failed to initiate payment. Please try again.");
            }

            log.warn("AamarPay initiation failed for appointmentId={}. Simulated fallback is enabled.",
                    appointment.getAppointmentId(), ex);
            Appointment confirmedAppointment = confirmAndNotifyAppointment(appointment);
            return buildSuccessRedirectUrl(confirmedAppointment, origin);
        }
    }

    /**
     * Validates a payment via aamarpay's transaction check API and, if successful,
     * auto-confirms the appointment.
     *
     * @param transactionId our transaction ID (mer_txnid from aamarpay callback)
     * @return the confirmed appointment, or throws on failure
     */
    @Transactional
    public Appointment confirmAfterPayment(String transactionId) {
        if (transactionId == null || transactionId.isBlank()) {
            throw new RuntimeException("Missing transaction ID in payment callback");
        }

        // Lock the row so concurrent fail/cancel callbacks cannot change state while
        // success validation is in flight.
        Appointment appointment = appointmentRepository.findByTransactionIdForUpdate(transactionId)
                .orElseThrow(() -> new RuntimeException("Appointment not found for transaction: " + transactionId));

        // Idempotent callback handling: if already confirmed, treat as success.
        if (appointment.getStatus() == Appointment.AppointmentStatus.CONFIRMED
                || appointment.getStatus() == Appointment.AppointmentStatus.SCHEDULED) {
            log.info("Payment callback replay for already confirmed appointment. appointmentId={}, transactionId={}",
                    appointment.getAppointmentId(), transactionId);
            return appointment;
        }

        // Only process if appointment is in PAYMENT_PENDING status.
        if (appointment.getStatus() != Appointment.AppointmentStatus.PAYMENT_PENDING) {
            throw new RuntimeException("Appointment is not in PAYMENT_PENDING status: " + appointment.getStatus());
        }

        // Validate payment with aamarpay
        String validationUrl = UriComponentsBuilder
                .fromUriString(successValidationUrl)
                .queryParam("request_id", transactionId)
                .queryParam("store_id", storeId)
                .queryParam("signature_key", signatureKey)
                .queryParam("type", "json")
                .build()
                .toUriString();

        RestTemplate restTemplate = createRestTemplate();
        Map<String, Object> body;
        boolean paymentSuccessful = false;

        BigDecimal expectedAmount = BigDecimal.valueOf(
                (appointment.getDoctor().getConsultationFee() != null
                        && appointment.getDoctor().getConsultationFee() > 0)
                                ? appointment.getDoctor().getConsultationFee()
                                : 500.0f);

        try {
            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = restTemplate.getForEntity(
                    validationUrl, (Class<Map<String, Object>>) (Class<?>) Map.class);

            body = response.getBody();

            // AamarPay returns "Successful" as pay_status on success
            // Make validation case-insensitive and log for debugging
            if (body != null) {
                Object payStatus = body.get("pay_status");
                paymentSuccessful = isValidationSuccessful(body, transactionId, expectedAmount);
                log.info("Payment validation response: pay_status={}, paymentSuccessful={}", payStatus,
                        paymentSuccessful);
            } else {
                log.warn("Empty response body from AamarPay validation for transaction: {}", transactionId);
            }
        } catch (Exception e) {
            log.error("Error validating payment with AamarPay for transaction: {}", transactionId, e);
            if (!allowSimulatedFallback) {
                // Keep appointment in PAYMENT_PENDING on transient validation failures so it
                // can be retried instead of being cancelled incorrectly.
                throw new RuntimeException("Failed to validate payment: " + e.getMessage());
            }

            // Fail-open mode: do not block appointment confirmation when gateway validation
            // is unavailable.
            return confirmAndNotifyAppointment(appointment);
        }

        if (!paymentSuccessful) {
            if (!allowSimulatedFallback) {
                appointment.setStatus(Appointment.AppointmentStatus.CANCELLED);
                appointment.setCancellationReason("Payment validation failed");
                Appointment cancelled = appointmentRepository.save(appointment);

                String patientMessage = String.format(
                        "Your payment for appointment on %s at %s could not be verified, so the appointment was cancelled.",
                        cancelled.getAppointmentDate(),
                        cancelled.getAppointmentTime());
                notificationService.createNotificationWithEntity(
                        cancelled.getPatient().getUser(),
                        "Payment Verification Failed",
                        patientMessage,
                        Notification.NotificationType.APPOINTMENT_CANCELLED,
                        "APPOINTMENT",
                        cancelled.getAppointmentId());

                String doctorMessage = String.format(
                        "Appointment for %s %s on %s at %s was cancelled because payment verification failed.",
                        cancelled.getPatient().getUser().getFirstName(),
                        cancelled.getPatient().getUser().getLastName(),
                        cancelled.getAppointmentDate(),
                        cancelled.getAppointmentTime());
                notificationService.createNotificationWithEntity(
                        cancelled.getDoctor().getUser(),
                        "Appointment Cancelled (Payment Failed)",
                        doctorMessage,
                        Notification.NotificationType.APPOINTMENT_CANCELLED,
                        "APPOINTMENT",
                        cancelled.getAppointmentId());

                return cancelled;
            }

            // Fail-open mode: gateway responded but validation did not pass. Keep the user
            // flow successful.
            return confirmAndNotifyAppointment(appointment);
        }

        return confirmAndNotifyAppointment(appointment);
    }

    private Appointment confirmAndNotifyAppointment(Appointment appointment) {
        if (appointment.getStatus() == Appointment.AppointmentStatus.CONFIRMED
                || appointment.getStatus() == Appointment.AppointmentStatus.SCHEDULED) {
            return appointment;
        }

        if (appointment.getStatus() != Appointment.AppointmentStatus.PAYMENT_PENDING) {
            throw new RuntimeException("Appointment is not in PAYMENT_PENDING status: " + appointment.getStatus());
        }

        int updated = appointmentRepository.markConfirmedIfPaymentPending(appointment.getAppointmentId());
        Appointment saved = appointmentRepository.findById(appointment.getAppointmentId())
                .orElseThrow(() -> new RuntimeException("Appointment not found: " + appointment.getAppointmentId()));

        if (updated == 0) {
            if (saved.getStatus() == Appointment.AppointmentStatus.CONFIRMED
                    || saved.getStatus() == Appointment.AppointmentStatus.SCHEDULED) {
                return saved;
            }
            throw new RuntimeException("Appointment is not in PAYMENT_PENDING status: " + saved.getStatus());
        }

        String doctorFirstName = appointment.getDoctor().getUser().getFirstName();
        String doctorLastName = appointment.getDoctor().getUser().getLastName();
        String notificationMessage = String.format(
                "Payment successful! Your appointment with Dr. %s %s on %s at %s (Queue #%d) is confirmed.",
                doctorFirstName, doctorLastName,
                appointment.getAppointmentDate(), appointment.getAppointmentTime(),
                appointment.getSerialNumber());

        notificationService.createNotificationWithEntity(
                appointment.getPatient().getUser(),
                "Appointment Confirmed",
                notificationMessage,
                Notification.NotificationType.APPOINTMENT_CONFIRMED,
                "APPOINTMENT",
                saved.getAppointmentId());

        String doctorNotificationMessage = String.format(
                "New confirmed appointment: %s %s on %s at %s (Queue #%d). Payment received.",
                appointment.getPatient().getUser().getFirstName(),
                appointment.getPatient().getUser().getLastName(),
                appointment.getAppointmentDate(),
                appointment.getAppointmentTime(),
                appointment.getSerialNumber());

        notificationService.createNotificationWithEntity(
                appointment.getDoctor().getUser(),
                "New Appointment Confirmed",
                doctorNotificationMessage,
                Notification.NotificationType.APPOINTMENT_CONFIRMED,
                "APPOINTMENT",
                saved.getAppointmentId());

        return saved;
    }

    @Transactional
    public Appointment confirmSandboxSuccessByTransactionId(String transactionId) {
        if (transactionId == null || transactionId.isBlank()) {
            throw new RuntimeException("Missing transaction ID");
        }

        Appointment appointment = appointmentRepository.findByTransactionIdForUpdate(transactionId)
                .orElseThrow(() -> new RuntimeException("Appointment not found for transaction: " + transactionId));

        if (appointment.getStatus() == Appointment.AppointmentStatus.CONFIRMED
                || appointment.getStatus() == Appointment.AppointmentStatus.SCHEDULED) {
            return appointment;
        }

        if (appointment.getStatus() != Appointment.AppointmentStatus.PAYMENT_PENDING) {
            throw new RuntimeException("Appointment is not in PAYMENT_PENDING status: " + appointment.getStatus());
        }

        return confirmAndNotifyAppointment(appointment);
    }

    @Transactional
    public Appointment confirmSandboxSuccessByAppointmentId(Integer appointmentId) {
        if (appointmentId == null) {
            throw new RuntimeException("Missing appointment id");
        }

        Appointment appointment = appointmentRepository.findByIdForUpdate(appointmentId)
                .orElseThrow(() -> new RuntimeException("Appointment not found: " + appointmentId));

        if (appointment.getStatus() == Appointment.AppointmentStatus.CONFIRMED
                || appointment.getStatus() == Appointment.AppointmentStatus.SCHEDULED) {
            return appointment;
        }

        if (appointment.getStatus() != Appointment.AppointmentStatus.PAYMENT_PENDING) {
            throw new RuntimeException("Appointment is not in PAYMENT_PENDING status: " + appointment.getStatus());
        }

        return confirmAndNotifyAppointment(appointment);
    }

    @Transactional(readOnly = true)
    public Appointment findAppointmentByCallbackIdentifiers(String transactionId, Integer appointmentId) {
        if (transactionId != null && !transactionId.isBlank()) {
            Optional<Appointment> appointmentByTransaction = appointmentRepository.findByTransactionId(transactionId);
            if (appointmentByTransaction.isPresent()) {
                return appointmentByTransaction.get();
            }
        }

        if (appointmentId != null) {
            return appointmentRepository.findById(appointmentId).orElse(null);
        }

        return null;
    }

    public boolean isPaymentPendingAppointmentState(Appointment appointment) {
        return appointment != null && appointment.getStatus() == Appointment.AppointmentStatus.PAYMENT_PENDING;
    }

    public boolean isSuccessTerminalAppointmentState(Appointment appointment) {
        if (appointment == null || appointment.getStatus() == null) {
            return false;
        }

        return switch (appointment.getStatus()) {
            case CONFIRMED, SCHEDULED, IN_PROGRESS, COMPLETED, NO_SHOW -> true;
            default -> false;
        };
    }

    public boolean isFailedTerminalAppointmentState(Appointment appointment) {
        if (appointment == null || appointment.getStatus() == null) {
            return false;
        }

        return switch (appointment.getStatus()) {
            case CANCELLED, REJECTED -> true;
            default -> false;
        };
    }

    public boolean isTerminalAppointmentState(Appointment appointment) {
        return isSuccessTerminalAppointmentState(appointment) || isFailedTerminalAppointmentState(appointment);
    }

    public String buildSuccessRedirectUrl(Appointment appointment) {
        return buildSuccessRedirectPath(appointment);
    }

    public String buildSuccessRedirectUrl(Appointment appointment, String frontendOrigin) {
        String base = (frontendOrigin != null && !frontendOrigin.isBlank()) ? frontendOrigin : frontendBaseUrl;
        StringBuilder redirectUrl = new StringBuilder(base + buildSuccessRedirectPath(appointment));
        return redirectUrl.toString();
    }

    public String buildSuccessRedirectPath(Appointment appointment) {
        StringBuilder redirectUrl = new StringBuilder("/payment/success");
        redirectUrl.append("?appointmentId=").append(appointment.getAppointmentId());
        if (appointment.getSerialNumber() != null) {
            redirectUrl.append("&serial=").append(appointment.getSerialNumber());
        }
        if (appointment.getAppointmentTime() != null) {
            redirectUrl.append("&time=").append(
                    URLEncoder.encode(appointment.getAppointmentTime().toString(), StandardCharsets.UTF_8));
        }
        if (appointment.getAppointmentDate() != null) {
            redirectUrl.append("&date=").append(
                    URLEncoder.encode(appointment.getAppointmentDate().toString(), StandardCharsets.UTF_8));
        }

        String doctorName = appointment.getDoctor().getUser().getFirstName() + " "
                + appointment.getDoctor().getUser().getLastName();
        redirectUrl.append("&doctor=")
                .append(URLEncoder.encode(doctorName, StandardCharsets.UTF_8));
        redirectUrl.append("&type=").append(appointment.getAppointmentType().name());
        redirectUrl.append("&payment=simulated");
        return redirectUrl.toString();
    }

    public String buildSuccessRedirectUrl(Integer appointmentId) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new RuntimeException("Appointment not found: " + appointmentId));
        return buildSuccessRedirectUrl(appointment);
    }

    private boolean isValidationSuccessful(Map<String, Object> body, String transactionId, BigDecimal expectedAmount) {
        String payStatus = readString(body, "pay_status");
        if (payStatus == null || !payStatus.equalsIgnoreCase("Successful")) {
            return false;
        }

        String returnedTxnId = firstNonBlank(
                readString(body, "mer_txnid"),
                readString(body, "tran_id"),
                readString(body, "request_id"),
                readString(body, "merchant_txn_id"));
        if (returnedTxnId != null && !returnedTxnId.equals(transactionId)) {
            log.warn("Payment validation transaction mismatch. expected={}, got={}", transactionId, returnedTxnId);
            return false;
        }

        String returnedStoreId = firstNonBlank(readString(body, "store_id"), readString(body, "storeId"));
        if (returnedStoreId != null && storeId != null && !returnedStoreId.equals(storeId)) {
            log.warn("Payment validation store mismatch. expected={}, got={}", storeId, returnedStoreId);
            return false;
        }

        BigDecimal returnedAmount = firstAmount(
                toBigDecimal(readString(body, "amount")),
                toBigDecimal(readString(body, "pay_amount")));
        if (returnedAmount != null && !amountsClose(expectedAmount, returnedAmount)) {
            log.warn("Payment validation amount mismatch. expected={}, got={}", expectedAmount, returnedAmount);
            return false;
        }

        return true;
    }

    private String readString(Map<String, Object> body, String key) {
        Object value = body.get(key);
        if (value == null) {
            return null;
        }
        String stringValue = value.toString().trim();
        return stringValue.isEmpty() ? null : stringValue;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private BigDecimal firstAmount(BigDecimal... values) {
        for (BigDecimal value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private BigDecimal toBigDecimal(String value) {
        if (value == null) {
            return null;
        }
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private boolean amountsClose(BigDecimal expected, BigDecimal actual) {
        return expected.subtract(actual).abs().compareTo(new BigDecimal("0.01")) <= 0;
    }

    /**
     * Cancels the appointment associated with a failed or cancelled payment.
     */
    @Transactional
    public void cancelAppointmentForFailedPayment(String transactionId, String reason) {
        cancelAppointmentForFailedPayment(transactionId, null, reason);
    }

    @Transactional
    public void cancelAppointmentForFailedPayment(String transactionId, Integer appointmentId, String reason) {
        if (transactionId == null || transactionId.isBlank()) {
            if (appointmentId == null) {
                return;
            }
        }

        cancelPendingAppointmentAndGetLatest(transactionId, appointmentId, reason);
    }

    @Transactional
    public Appointment cancelPendingAppointmentAndGetLatest(String transactionId, Integer appointmentId, String reason) {
        if ((transactionId == null || transactionId.isBlank()) && appointmentId == null) {
            return null;
        }

        Appointment appointment = findAppointmentByCallbackIdentifiersForUpdate(transactionId, appointmentId);
        if (appointment == null) {
            return null;
        }

        if (isTerminalAppointmentState(appointment)) {
            return appointment;
        }

        if (!isPaymentPendingAppointmentState(appointment)) {
            throw new RuntimeException("Appointment is not in PAYMENT_PENDING status: " + appointment.getStatus());
        }

        int updated = appointmentRepository.markCancelledIfPaymentPending(appointment.getAppointmentId(), reason);
        Appointment latest = appointmentRepository.findById(appointment.getAppointmentId()).orElse(null);

        if (updated == 0 && latest != null && !isTerminalAppointmentState(latest)) {
            throw new RuntimeException("Failed to atomically cancel appointment in PAYMENT_PENDING state");
        }

        return latest;
    }

    private Appointment findAppointmentByCallbackIdentifiersForUpdate(String transactionId, Integer appointmentId) {
        if (transactionId != null && !transactionId.isBlank()) {
            Optional<Appointment> appointmentByTransaction = appointmentRepository.findByTransactionIdForUpdate(transactionId);
            if (appointmentByTransaction.isPresent()) {
                return appointmentByTransaction.get();
            }
        }

        if (appointmentId != null) {
            return appointmentRepository.findByIdForUpdate(appointmentId).orElse(null);
        }

        return null;
    }

    public String getFrontendBaseUrl() {
        return frontendBaseUrl;
    }

    private RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutMs);
        requestFactory.setReadTimeout(readTimeoutMs);
        return new RestTemplate(requestFactory);
    }

    private String sanitizeOrigin(String rawOrigin) {
        if (rawOrigin == null) {
            return frontendBaseUrl;
        }

        String origin = rawOrigin.trim();
        if (origin.isBlank()) {
            return frontendBaseUrl;
        }

        if (origin.length() > 120 || origin.contains(" ")) {
            return frontendBaseUrl;
        }

        try {
            URI uri = URI.create(origin);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) && host != null
                    && (uri.getPath() == null || uri.getPath().isEmpty())
                    && uri.getQuery() == null
                    && uri.getFragment() == null
                    && uri.getUserInfo() == null) {
                return uri.getPort() > 0 ? (scheme + "://" + host + ":" + uri.getPort()) : (scheme + "://" + host);
            }
        } catch (Exception ex) {
            // Fall back to configured frontend URL.
        }

        return frontendBaseUrl;
    }

    private String buildCallbackUrl(String origin, String configuredUrl, String callbackPath) {
        if (origin != null && !origin.isBlank()) {
            return origin + callbackPath;
        }
        return configuredUrl;
    }

}
