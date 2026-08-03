package com.vitabridge.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class EmergencyContact {

    @Column(name = "contact_name", length = 100)
    private String name;

    @Column(name = "contact_phone", length = 15)
    private String phone;

    @Column(name = "contact_relation", length = 50)
    private String relation;

    public EmergencyContact() {
    }

    public EmergencyContact(String name, String phone, String relation) {
        this.name = name;
        this.phone = phone;
        this.relation = relation;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getRelation() {
        return relation;
    }

    public void setRelation(String relation) {
        this.relation = relation;
    }
}

