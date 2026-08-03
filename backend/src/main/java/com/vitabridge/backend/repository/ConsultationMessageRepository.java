package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.ConsultationMessage;
import com.vitabridge.backend.model.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConsultationMessageRepository extends JpaRepository<ConsultationMessage, Integer> {
    List<ConsultationMessage> findByAppointmentAppointmentIdOrderByCreatedAtAsc(Integer appointmentId);

    List<ConsultationMessage> findByAppointmentDoctorDoctorIdAndAppointmentPatientPatientIdAndAppointmentAppointmentTypeOrderByCreatedAtAsc(
            Integer doctorId,
            Integer patientId,
            Appointment.AppointmentType appointmentType);
}
