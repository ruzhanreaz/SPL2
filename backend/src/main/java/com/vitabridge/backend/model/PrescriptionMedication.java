package com.vitabridge.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class PrescriptionMedication {

    @Column(name = "name", length = 200)
    private String name;

    @Column(name = "dosage", length = 120)
    private String dosage;

    @Column(name = "quantity", length = 120)
    private String quantity;

    @Column(name = "frequency", length = 120)
    private String frequency;

    @Column(name = "duration", length = 120)
    private String duration;

    @Column(name = "instructions", length = 500)
    private String instructions;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDosage() {
        return dosage;
    }

    public void setDosage(String dosage) {
        this.dosage = dosage;
    }

    public String getQuantity() {
        return quantity;
    }

    public void setQuantity(String quantity) {
        this.quantity = quantity;
    }

    public String getFrequency() {
        return frequency;
    }

    public void setFrequency(String frequency) {
        this.frequency = frequency;
    }

    public String getDuration() {
        return duration;
    }

    public void setDuration(String duration) {
        this.duration = duration;
    }

    public String getInstructions() {
        return instructions;
    }

    public void setInstructions(String instructions) {
        this.instructions = instructions;
    }
}
