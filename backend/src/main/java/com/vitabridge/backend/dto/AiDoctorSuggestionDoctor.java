package com.vitabridge.backend.dto;

public class AiDoctorSuggestionDoctor {
    private Integer doctorId;
    private String name;
    private String specialization;
    private Integer yearsOfExperience;
    private String location;
    private Float consultationFee;

    public AiDoctorSuggestionDoctor() {
    }

    public AiDoctorSuggestionDoctor(Integer doctorId, String name, String specialization,
            Integer yearsOfExperience, String location, Float consultationFee) {
        this.doctorId = doctorId;
        this.name = name;
        this.specialization = specialization;
        this.yearsOfExperience = yearsOfExperience;
        this.location = location;
        this.consultationFee = consultationFee;
    }

    public Integer getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(Integer doctorId) {
        this.doctorId = doctorId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSpecialization() {
        return specialization;
    }

    public void setSpecialization(String specialization) {
        this.specialization = specialization;
    }

    public Integer getYearsOfExperience() {
        return yearsOfExperience;
    }

    public void setYearsOfExperience(Integer yearsOfExperience) {
        this.yearsOfExperience = yearsOfExperience;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public Float getConsultationFee() {
        return consultationFee;
    }

    public void setConsultationFee(Float consultationFee) {
        this.consultationFee = consultationFee;
    }
}
