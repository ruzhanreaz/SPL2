package com.vitabridge.backend.controller;

import com.vitabridge.backend.model.Appointment;
import com.vitabridge.backend.service.PaymentService;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private static final Logger log = LoggerFactory.getLogger(PaymentController.class);

    @Autowired
    private PaymentService paymentService;

    /**
     * Called by aamarpay after successful payment.
     * Accepts both GET (query params) and POST (form data) since aamarpay may use
     * either.
     * Validates the payment with aamarpay's transaction check API, auto-confirms
     * the
     * appointment, then redirects the browser to the frontend success page.
     */
    @RequestMapping(value = { "/success", "/aamarpay/success" }, method = { RequestMethod.GET, RequestMethod.POST })
    public void handlePaymentSuccess(
            @RequestParam(required = false) Map<String, String> params,
            HttpServletResponse response) throws IOException {

        applyNoStoreHeaders(response);

        String transactionId = resolveTransactionId(params);
        Integer appointmentId = resolveAppointmentId(params);
        log.info("Payment success callback received. mer_txnid={}", transactionId);

        try {
            Appointment current = paymentService.findAppointmentByCallbackIdentifiers(transactionId, appointmentId);
            if (current == null) {
                log.warn("Payment success callback could not be matched to an appointment. Params: {}", params);
                response.sendRedirect("/payment/failed?reason=missing_transaction");
                return;
            }

            // Strict transition guard: SUCCESS cannot be applied on terminal FAILED states.
            if (paymentService.isFailedTerminalAppointmentState(current)) {
                log.warn(
                        "SECURITY WARNING: Rejected SUCCESS callback for failed/finalized transaction. appointmentId={}, status={}, mer_txnid={}",
                        current.getAppointmentId(), current.getStatus(), transactionId);
                response.sendRedirect("/payment/failed?reason=already_finalized");
                return;
            }

            if (paymentService.isSuccessTerminalAppointmentState(current)) {
                log.info(
                        "Idempotent SUCCESS callback replay for already-successful transaction. appointmentId={}, status={}, mer_txnid={}",
                        current.getAppointmentId(), current.getStatus(), transactionId);
                response.sendRedirect(buildInvoiceEntryRedirectPath(current, transactionId));
                return;
            }

            Appointment appointment = null;

            if (transactionId != null && !transactionId.isBlank()) {
                try {
                    appointment = paymentService.confirmAfterPayment(transactionId);
                } catch (Exception ex) {
                    log.warn("Gateway validation failed; attempting sandbox success recovery by transaction id.", ex);
                    appointment = paymentService.confirmSandboxSuccessByTransactionId(transactionId);
                }
            }

            if (appointment == null && appointmentId != null) {
                appointment = paymentService.confirmSandboxSuccessByAppointmentId(appointmentId);
            }

            if (appointment == null) {
                log.warn("Payment success callback could not be matched to an appointment. Params: {}", params);
                response.sendRedirect("/payment/failed?reason=missing_transaction");
                return;
            }

            response.sendRedirect(paymentService.buildSuccessRedirectPath(appointment));
        } catch (Exception e) {
            log.error("Error handling payment success callback", e);

            Appointment latest = paymentService.findAppointmentByCallbackIdentifiers(transactionId, appointmentId);
            if (tryRedirectIfFinalized(latest, response)) {
                return;
            }

            response.sendRedirect("/payment/failed?reason=error");
        }
    }

    /**
     * Called by aamarpay when payment fails.
     */
    @RequestMapping(value = { "/fail", "/aamarpay/fail" }, method = { RequestMethod.GET, RequestMethod.POST })
    public void handlePaymentFailed(
            @RequestParam(required = false) Map<String, String> params,
            HttpServletResponse response) throws IOException {

        applyNoStoreHeaders(response);

        String transactionId = resolveTransactionId(params);
        Integer appointmentId = resolveAppointmentId(params);
        log.info("Payment failed callback received. mer_txnid={}", transactionId);

        try {
            Appointment current = paymentService.findAppointmentByCallbackIdentifiers(transactionId, appointmentId);
            if (current == null) {
                response.sendRedirect("/payment/failed?reason=missing_transaction");
                return;
            }

            // Strict transition guard: FAILED cannot be applied after SUCCESS.
            if (paymentService.isSuccessTerminalAppointmentState(current)) {
                log.warn(
                        "SECURITY WARNING: Rejected FAILED callback for already-successful transaction. appointmentId={}, status={}, mer_txnid={}",
                        current.getAppointmentId(), current.getStatus(), transactionId);
                response.sendRedirect(buildInvoiceEntryRedirectPath(current, transactionId));
                return;
            }

            if (paymentService.isFailedTerminalAppointmentState(current)) {
                response.sendRedirect("/payment/failed?reason=already_finalized");
                return;
            }

            if (!paymentService.isPaymentPendingAppointmentState(current)) {
                log.warn(
                        "SECURITY WARNING: Rejected FAILED callback due to invalid state transition. appointmentId={}, status={}, mer_txnid={}",
                        current.getAppointmentId(), current.getStatus(), transactionId);
                response.sendRedirect("/payment/failed?reason=invalid_state");
                return;
            }

            Appointment latest = paymentService.cancelPendingAppointmentAndGetLatest(
                    transactionId, appointmentId, "Payment failed");

            if (latest == null) {
                response.sendRedirect("/payment/failed?reason=missing_transaction");
                return;
            }

            if (tryRedirectIfFinalized(latest, response)) {
                return;
            }

            response.sendRedirect("/payment/failed?reason=invalid_state");
            return;
        } catch (Exception e) {
            log.error("Error handling payment failure callback", e);
        }

        response.sendRedirect("/payment/failed?reason=payment_failed");
    }

    /**
     * Called by aamarpay when the user cancels the payment.
     */
    @RequestMapping(value = { "/cancel", "/aamarpay/cancel" }, method = { RequestMethod.GET, RequestMethod.POST })
    public void handlePaymentCancelled(
            @RequestParam(required = false) Map<String, String> params,
            HttpServletResponse response) throws IOException {

        applyNoStoreHeaders(response);

        String transactionId = resolveTransactionId(params);
        Integer appointmentId = resolveAppointmentId(params);
        log.info("Payment cancelled callback received. mer_txnid={}", transactionId);

        try {
            Appointment current = paymentService.findAppointmentByCallbackIdentifiers(transactionId, appointmentId);
            if (current == null) {
                response.sendRedirect("/payment/failed?reason=missing_transaction");
                return;
            }

            if (paymentService.isSuccessTerminalAppointmentState(current)) {
                log.warn(
                        "SECURITY WARNING: Rejected CANCEL callback for already-successful transaction. appointmentId={}, status={}, mer_txnid={}",
                        current.getAppointmentId(), current.getStatus(), transactionId);
                response.sendRedirect(buildInvoiceEntryRedirectPath(current, transactionId));
                return;
            }

            if (paymentService.isFailedTerminalAppointmentState(current)) {
                response.sendRedirect("/payment/failed?reason=already_finalized");
                return;
            }

            if (!paymentService.isPaymentPendingAppointmentState(current)) {
                log.warn(
                        "SECURITY WARNING: Rejected CANCEL callback due to invalid state transition. appointmentId={}, status={}, mer_txnid={}",
                        current.getAppointmentId(), current.getStatus(), transactionId);
                response.sendRedirect("/payment/failed?reason=invalid_state");
                return;
            }

            Appointment latest = paymentService.cancelPendingAppointmentAndGetLatest(
                    transactionId, appointmentId, "Payment cancelled by user");

            if (latest == null) {
                response.sendRedirect("/payment/failed?reason=missing_transaction");
                return;
            }

            if (tryRedirectIfFinalized(latest, response)) {
                return;
            }

            response.sendRedirect("/payment/failed?reason=invalid_state");
            return;
        } catch (Exception e) {
            log.error("Error handling payment cancel callback", e);
        }

        response.sendRedirect("/payment/failed?reason=cancelled");
    }

    /**
     * Entry route used by /payment/{invoiceNo} UI gate. Always checks server state
     * first to prevent stale/back-button payment manipulation.
     */
    @GetMapping("/entry/{invoiceNo}")
    public void handlePaymentInvoiceEntry(
            @PathVariable String invoiceNo,
            HttpServletResponse response) throws IOException {

        applyNoStoreHeaders(response);

        String normalizedInvoice = invoiceNo == null ? null : invoiceNo.trim();
        if (normalizedInvoice == null || normalizedInvoice.isBlank()) {
            response.sendRedirect("/payment/failed?reason=missing_transaction");
            return;
        }

        Appointment appointment = paymentService.findAppointmentByCallbackIdentifiers(normalizedInvoice, null);
        if (appointment == null) {
            log.warn("Payment invoice entry could not be matched. invoiceNo={}", normalizedInvoice);
            response.sendRedirect("/payment/failed?reason=missing_transaction&invoice=" + urlEncode(normalizedInvoice));
            return;
        }

        if (paymentService.isSuccessTerminalAppointmentState(appointment)) {
            response.sendRedirect(buildAlreadyConfirmedRedirectPath(appointment, normalizedInvoice));
            return;
        }

        if (paymentService.isFailedTerminalAppointmentState(appointment)) {
            response.sendRedirect("/payment/failed?reason=already_finalized&invoice=" + urlEncode(normalizedInvoice));
            return;
        }

        response.sendRedirect("/payment/failed?reason=payment_pending&invoice=" + urlEncode(normalizedInvoice));
    }

    private String resolveTransactionId(Map<String, String> params) {
        if (params == null || params.isEmpty()) {
            return null;
        }
        String merTxnId = params.get("mer_txnid");
        if (merTxnId != null && !merTxnId.isBlank()) {
            return merTxnId;
        }
        String tranId = params.get("tran_id");
        if (tranId != null && !tranId.isBlank()) {
            return tranId;
        }
        String transactionId = params.get("transaction_id");
        if (transactionId != null && !transactionId.isBlank()) {
            return transactionId;
        }
        String merchantTxn = params.get("merchant_txn_id");
        if (merchantTxn != null && !merchantTxn.isBlank()) {
            return merchantTxn;
        }
        String optA = params.get("opt_a");
        if (optA != null && !optA.isBlank()) {
            return optA;
        }
        return null;
    }

    private Integer resolveAppointmentId(Map<String, String> params) {
        if (params == null || params.isEmpty()) {
            return null;
        }

        String optC = params.get("opt_c");
        if (optC == null || optC.isBlank()) {
            return null;
        }

        try {
            return Integer.valueOf(optC.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private void applyNoStoreHeaders(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
        response.setHeader("Pragma", "no-cache");
        response.setHeader("Surrogate-Control", "no-store");
        response.setDateHeader("Expires", 0);
    }

    private String buildInvoiceEntryRedirectPath(Appointment appointment, String fallbackInvoice) {
        String invoice = resolveInvoiceForUi(appointment, fallbackInvoice);
        if (invoice == null || invoice.isBlank()) {
            return paymentService.buildSuccessRedirectPath(appointment);
        }
        return "/payment/" + urlEncode(invoice);
    }

    private String buildAlreadyConfirmedRedirectPath(Appointment appointment, String fallbackInvoice) {
        String invoice = resolveInvoiceForUi(appointment, fallbackInvoice);

        StringBuilder path = new StringBuilder("/payment/already-confirmed");
        boolean hasQuery = false;

        if (invoice != null && !invoice.isBlank()) {
            path.append("?invoice=").append(urlEncode(invoice));
            hasQuery = true;
        }

        if (appointment != null && appointment.getAppointmentId() != null) {
            path.append(hasQuery ? "&" : "?")
                    .append("appointmentId=")
                    .append(appointment.getAppointmentId());
        }

        return path.toString();
    }

    private String resolveInvoiceForUi(Appointment appointment, String fallbackInvoice) {
        if (appointment != null && appointment.getTransactionId() != null && !appointment.getTransactionId().isBlank()) {
            return appointment.getTransactionId();
        }
        if (fallbackInvoice != null && !fallbackInvoice.isBlank()) {
            return fallbackInvoice;
        }
        return null;
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private boolean tryRedirectIfFinalized(Appointment appointment, HttpServletResponse response) throws IOException {
        if (appointment == null) {
            return false;
        }

        if (paymentService.isSuccessTerminalAppointmentState(appointment)) {
            response.sendRedirect(buildInvoiceEntryRedirectPath(appointment, appointment.getTransactionId()));
            return true;
        }

        if (paymentService.isFailedTerminalAppointmentState(appointment)) {
            response.sendRedirect("/payment/failed?reason=already_finalized");
            return true;
        }

        return false;
    }

}
