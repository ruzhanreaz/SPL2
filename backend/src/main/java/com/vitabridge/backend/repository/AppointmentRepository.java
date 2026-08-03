package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.Appointment;
import com.vitabridge.backend.model.Doctor;
import com.vitabridge.backend.model.Patient;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, Integer> {

        List<Appointment> findByPatientOrderByAppointmentDateDescAppointmentTimeDesc(Patient patient);

        List<Appointment> findByDoctorOrderByAppointmentDateDescAppointmentTimeDesc(Doctor doctor);

        @Query("SELECT a FROM Appointment a WHERE a.doctor = :doctor AND a.appointmentDate = :date AND a.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'PAYMENT_PENDING')")
        List<Appointment> findScheduledAppointmentsByDoctorAndDate(@Param("doctor") Doctor doctor,
                        @Param("date") LocalDate date);

        @Query("SELECT a FROM Appointment a WHERE a.doctor = :doctor AND a.appointmentDate = :date AND a.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'PAYMENT_PENDING', 'SCHEDULED', 'COMPLETED', 'NO_SHOW')")
        List<Appointment> findOccupiedAppointmentsByDoctorAndDate(@Param("doctor") Doctor doctor,
                        @Param("date") LocalDate date);

        @Query("SELECT a FROM Appointment a WHERE a.doctor = :doctor AND a.appointmentDate = :date AND a.appointmentTime = :time AND a.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')")
        List<Appointment> findByDoctorAndDateAndTimeAndStatus(@Param("doctor") Doctor doctor,
                        @Param("date") LocalDate date,
                        @Param("time") LocalTime time);

        @Query("SELECT a FROM Appointment a WHERE a.patient = :patient AND a.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')")
        List<Appointment> findUpcomingAppointmentsByPatient(@Param("patient") Patient patient);

        @Query("SELECT a FROM Appointment a WHERE a.doctor = :doctor AND a.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')")
        List<Appointment> findUpcomingAppointmentsByDoctor(@Param("doctor") Doctor doctor);

        Optional<Appointment> findByTransactionId(String transactionId);

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("SELECT a FROM Appointment a WHERE a.transactionId = :transactionId")
        Optional<Appointment> findByTransactionIdForUpdate(@Param("transactionId") String transactionId);

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("SELECT a FROM Appointment a WHERE a.appointmentId = :appointmentId")
        Optional<Appointment> findByIdForUpdate(@Param("appointmentId") Integer appointmentId);

        @Query("SELECT COUNT(a) FROM Appointment a WHERE a.doctor = :doctor AND a.appointmentDate = :date AND a.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'PAYMENT_PENDING')")
        long countActiveAppointmentsByDoctorAndDate(@Param("doctor") Doctor doctor,
                        @Param("date") LocalDate date);

        @Query("SELECT a FROM Appointment a WHERE a.doctor = :doctor AND a.appointmentDate = :date AND a.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'PAYMENT_PENDING') ORDER BY a.serialNumber ASC")
        List<Appointment> findQueueByDoctorAndDate(@Param("doctor") Doctor doctor,
                        @Param("date") LocalDate date);

        @Query("SELECT a FROM Appointment a WHERE a.patient = :patient AND a.appointmentDate = :date AND a.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')")
        List<Appointment> findTodayAppointmentsByPatient(@Param("patient") Patient patient,
                        @Param("date") LocalDate date);

        List<Appointment> findByAppointmentDateAndStatusIn(LocalDate appointmentDate,
                        List<Appointment.AppointmentStatus> statuses);

        @Query("SELECT CASE WHEN COUNT(a) > 0 THEN true ELSE false END FROM Appointment a " +
                        "WHERE a.doctor = :doctor AND a.patient = :patient AND a.appointmentDate = :date " +
                        "AND a.status IN ('PAYMENT_PENDING', 'PENDING', 'CONFIRMED', 'IN_PROGRESS')")
        boolean existsActiveByDoctorAndPatientAndDate(@Param("doctor") Doctor doctor,
                        @Param("patient") Patient patient,
                        @Param("date") LocalDate date);

        @Query("SELECT a FROM Appointment a WHERE a.doctor = :doctor AND a.patient = :patient " +
                        "AND a.appointmentDate = :date AND a.serialNumber = :serialNumber " +
                        "AND a.status IN ('PAYMENT_PENDING', 'PENDING', 'CONFIRMED', 'IN_PROGRESS')")
        Optional<Appointment> findActiveByDoctorAndPatientAndDateAndSerialNumber(
                        @Param("doctor") Doctor doctor,
                        @Param("patient") Patient patient,
                        @Param("date") LocalDate date,
                        @Param("serialNumber") Integer serialNumber);

        Optional<Appointment> findFirstByDoctorDoctorIdAndPatientPatientIdAndAppointmentTypeAndStatusInOrderByAppointmentDateDescAppointmentTimeDescAppointmentIdDesc(
                        Integer doctorId,
                        Integer patientId,
                        Appointment.AppointmentType appointmentType,
                        List<Appointment.AppointmentStatus> statuses);

        Optional<Appointment> findFirstByDoctorDoctorIdAndPatientPatientIdAndAppointmentTypeOrderByAppointmentDateDescAppointmentTimeDescAppointmentIdDesc(
                        Integer doctorId,
                        Integer patientId,
                        Appointment.AppointmentType appointmentType);

        @Query("SELECT AVG(a.rating) FROM Appointment a WHERE a.doctor = :doctor AND a.rating IS NOT NULL")
        Double findAverageRatingByDoctor(@Param("doctor") Doctor doctor);

        @Query("SELECT COUNT(a) FROM Appointment a WHERE a.doctor = :doctor AND a.rating IS NOT NULL")
        Long countRatingsByDoctor(@Param("doctor") Doctor doctor);

        List<Appointment> findTop20ByDoctorAndRatingIsNotNullOrderByRatedAtDescAppointmentDateDescAppointmentTimeDesc(
                        Doctor doctor);

        @Modifying(clearAutomatically = true, flushAutomatically = true)
        @Query("UPDATE Appointment a SET a.status = 'CONFIRMED' WHERE a.appointmentId = :appointmentId AND a.status = 'PAYMENT_PENDING'")
        int markConfirmedIfPaymentPending(@Param("appointmentId") Integer appointmentId);

        @Modifying(clearAutomatically = true, flushAutomatically = true)
        @Query("UPDATE Appointment a SET a.status = 'CANCELLED', a.cancellationReason = :reason WHERE a.appointmentId = :appointmentId AND a.status = 'PAYMENT_PENDING'")
        int markCancelledIfPaymentPending(@Param("appointmentId") Integer appointmentId,
                        @Param("reason") String reason);
}
