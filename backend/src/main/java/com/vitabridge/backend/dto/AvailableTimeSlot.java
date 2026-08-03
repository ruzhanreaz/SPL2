package com.vitabridge.backend.dto;

import java.time.LocalTime;

public class AvailableTimeSlot {

    private LocalTime time;
    private boolean available;
    private String reason;
    /** 1-based queue position for this slot */
    private Integer serialNumber;
    /** Duration of this slot in minutes */
    private Integer slotDuration;

    public AvailableTimeSlot() {
    }

    public AvailableTimeSlot(LocalTime time, boolean available) {
        this.time = time;
        this.available = available;
    }

    public AvailableTimeSlot(LocalTime time, boolean available, String reason) {
        this.time = time;
        this.available = available;
        this.reason = reason;
    }

    public AvailableTimeSlot(LocalTime time, boolean available, String reason, Integer serialNumber,
            Integer slotDuration) {
        this.time = time;
        this.available = available;
        this.reason = reason;
        this.serialNumber = serialNumber;
        this.slotDuration = slotDuration;
    }

    public LocalTime getTime() {
        return time;
    }

    public void setTime(LocalTime time) {
        this.time = time;
    }

    public boolean isAvailable() {
        return available;
    }

    public void setAvailable(boolean available) {
        this.available = available;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Integer getSerialNumber() {
        return serialNumber;
    }

    public void setSerialNumber(Integer serialNumber) {
        this.serialNumber = serialNumber;
    }

    public Integer getSlotDuration() {
        return slotDuration;
    }

    public void setSlotDuration(Integer slotDuration) {
        this.slotDuration = slotDuration;
    }
}
