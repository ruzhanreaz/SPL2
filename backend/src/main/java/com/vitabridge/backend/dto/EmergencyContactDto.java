package com.vitabridge.backend.dto;

public class EmergencyContactDto {
    private String name;
    private String phone;
    private String relation;

    public EmergencyContactDto() {
    }

    public EmergencyContactDto(String name, String phone, String relation) {
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