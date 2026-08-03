package com.vitabridge.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "assistants")
public class Assistant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "assistant_id")
    private Integer assistantId;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "doctor_id", nullable = true)
    private Doctor doctor;

    public Assistant() {
    }

    public Integer getAssistantId() {
        return assistantId;
    }

    public void setAssistantId(Integer assistantId) {
        this.assistantId = assistantId;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Doctor getDoctor() {
        return doctor;
    }

    public void setDoctor(Doctor doctor) {
        this.doctor = doctor;
    }
}
