package com.vitabridge.backend.model;

import jakarta.persistence.*;
import java.util.List;

@Entity
@Table(name = "doctors")
public class Doctor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "doctor_id")
    private Integer doctorId;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(length = 100)
    private String specialization;

    @Column(name = "year_of_experience")
    private Integer yearOfExperience;

    @Column(name = "location", length = 255)
    private String location;

    @Column(name = "consultation_fee")
    private Float consultationFee;

    @Column(name = "is_available_for_calls", nullable = false)
    private Boolean isAvailableForCalls = true;

    @Column(name = "about", length = 2000)
    private String about;

    @Column(name = "qualifications", length = 500)
    private String qualifications;

    @Column(name = "languages", length = 255)
    private String languages;

    @Column(name = "hospital_affiliation", length = 255)
    private String hospitalAffiliation;

    @Column(name = "registration_number", length = 100)
    private String registrationNumber;

    @Column(name = "average_rating")
    private Double averageRating = 0.0;

    @Column(name = "total_ratings")
    private Integer totalRatings = 0;

    @OneToMany(mappedBy = "doctor", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Assistant> assistants;

    public Doctor() {
    }

    public Integer getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(Integer doctorId) {
        this.doctorId = doctorId;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getSpecialization() {
        return specialization;
    }

    public void setSpecialization(String specialization) {
        this.specialization = specialization;
    }

    public Integer getYearOfExperience() {
        return yearOfExperience;
    }

    public void setYearOfExperience(Integer yearOfExperience) {
        this.yearOfExperience = yearOfExperience;
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

    public Boolean getIsAvailableForCalls() {
        return isAvailableForCalls;
    }

    public void setIsAvailableForCalls(Boolean isAvailableForCalls) {
        this.isAvailableForCalls = isAvailableForCalls;
    }

    public String getAbout() {
        return about;
    }

    public void setAbout(String about) {
        this.about = about;
    }

    public String getQualifications() {
        return qualifications;
    }

    public void setQualifications(String qualifications) {
        this.qualifications = qualifications;
    }

    public String getLanguages() {
        return languages;
    }

    public void setLanguages(String languages) {
        this.languages = languages;
    }

    public String getHospitalAffiliation() {
        return hospitalAffiliation;
    }

    public void setHospitalAffiliation(String hospitalAffiliation) {
        this.hospitalAffiliation = hospitalAffiliation;
    }

    public String getRegistrationNumber() {
        return registrationNumber;
    }

    public void setRegistrationNumber(String registrationNumber) {
        this.registrationNumber = registrationNumber;
    }

    public List<Assistant> getAssistants() {
        return assistants;
    }

    public void setAssistants(List<Assistant> assistants) {
        this.assistants = assistants;
    }

    public Double getAverageRating() {
        return averageRating;
    }

    public void setAverageRating(Double averageRating) {
        this.averageRating = averageRating;
    }

    public Integer getTotalRatings() {
        return totalRatings;
    }

    public void setTotalRatings(Integer totalRatings) {
        this.totalRatings = totalRatings;
    }
}
