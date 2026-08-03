package com.vitabridge.backend.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public class AppointmentRequest {

    private Integer doctorId;
    private LocalDate appointmentDate;
    private LocalTime appointmentTime;
    private LocalTime preferredTime;
    private String appointmentType; // ONLINE or IN_PERSON
    private String paymentMode; // PAY_NOW or PAY_LATER
    private String notes;
    private String clientOrigin;

    public AppointmentRequest() {
    }

    public Integer getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(Integer doctorId) {
        this.doctorId = doctorId;
    }

    public LocalDate getAppointmentDate() {
        return appointmentDate;
    }

    public void setAppointmentDate(LocalDate appointmentDate) {
        this.appointmentDate = appointmentDate;
    }

    public LocalTime getAppointmentTime() {
        return appointmentTime;
    }

    public void setAppointmentTime(LocalTime appointmentTime) {
        this.appointmentTime = appointmentTime;
    }

    public String getAppointmentType() {
        return appointmentType;
    }

    public void setAppointmentType(String appointmentType) {
        this.appointmentType = appointmentType;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public LocalTime getPreferredTime() {
        return preferredTime;
    }

    public void setPreferredTime(LocalTime preferredTime) {
        this.preferredTime = preferredTime;
    }

    public String getClientOrigin() {
        return clientOrigin;
    }

    public void setClientOrigin(String clientOrigin) {
        this.clientOrigin = clientOrigin;
    }

    public String getPaymentMode() {
        return paymentMode;
    }

    public void setPaymentMode(String paymentMode) {
        this.paymentMode = paymentMode;
    }
}
