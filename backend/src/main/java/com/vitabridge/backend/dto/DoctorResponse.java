package com.vitabridge.backend.dto;

public class DoctorResponse {
    private Integer doctorId;
    private Integer userId;
    private String firstName;
    private String lastName;
    private String profileImageUrl;
    private String email;
    private String phoneNumber;
    private String specialization;
    private Integer yearOfExperience;
    private String location;
    private Float consultationFee;
    private String about;
    private String qualifications;
    private String languages;
    private String hospitalAffiliation;
    private String registrationNumber;
    private Boolean isActive;
    private Boolean isAvailableForCalls;
    private Double averageRating;
    private Integer totalRatings;

    public DoctorResponse() {
    }

    public DoctorResponse(Integer doctorId, Integer userId, String firstName, String lastName, String profileImageUrl, String email,
            String phoneNumber, String specialization, Integer yearOfExperience, String location,
            Float consultationFee, String about, String qualifications, String languages,
            String hospitalAffiliation, String registrationNumber, Boolean isActive,
            Boolean isAvailableForCalls, Double averageRating, Integer totalRatings) {
        this.doctorId = doctorId;
        this.userId = userId;
        this.firstName = firstName;
        this.lastName = lastName;
        this.profileImageUrl = profileImageUrl;
        this.email = email;
        this.phoneNumber = phoneNumber;
        this.specialization = specialization;
        this.yearOfExperience = yearOfExperience;
        this.location = location;
        this.consultationFee = consultationFee;
        this.about = about;
        this.qualifications = qualifications;
        this.languages = languages;
        this.hospitalAffiliation = hospitalAffiliation;
        this.registrationNumber = registrationNumber;
        this.isActive = isActive;
        this.isAvailableForCalls = isAvailableForCalls;
        this.averageRating = averageRating;
        this.totalRatings = totalRatings;
    }

    public Integer getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(Integer doctorId) {
        this.doctorId = doctorId;
    }

    public Integer getUserId() {
        return userId;
    }

    public void setUserId(Integer userId) {
        this.userId = userId;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getProfileImageUrl() {
        return profileImageUrl;
    }

    public void setProfileImageUrl(String profileImageUrl) {
        this.profileImageUrl = profileImageUrl;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
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

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public Boolean getIsAvailableForCalls() {
        return isAvailableForCalls;
    }

    public void setIsAvailableForCalls(Boolean isAvailableForCalls) {
        this.isAvailableForCalls = isAvailableForCalls;
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
