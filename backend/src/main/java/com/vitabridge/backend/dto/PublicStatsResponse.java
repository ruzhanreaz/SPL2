package com.vitabridge.backend.dto;

public class PublicStatsResponse {
    private long doctorCount;
    private long patientCount;

    public PublicStatsResponse() {
    }

    public PublicStatsResponse(long doctorCount, long patientCount) {
        this.doctorCount = doctorCount;
        this.patientCount = patientCount;
    }

    public long getDoctorCount() {
        return doctorCount;
    }

    public void setDoctorCount(long doctorCount) {
        this.doctorCount = doctorCount;
    }

    public long getPatientCount() {
        return patientCount;
    }

    public void setPatientCount(long patientCount) {
        this.patientCount = patientCount;
    }
}
