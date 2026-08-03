package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.Schedule;
import com.vitabridge.backend.model.ScheduleOverride;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ScheduleOverrideRepository extends JpaRepository<ScheduleOverride, Integer> {
    List<ScheduleOverride> findBySchedule(Schedule schedule);

    List<ScheduleOverride> findByScheduleScheduleId(Integer scheduleId);

    Optional<ScheduleOverride> findByScheduleAndOverrideDate(Schedule schedule, LocalDate overrideDate);

    List<ScheduleOverride> findByScheduleAndOverrideDateBetween(Schedule schedule, LocalDate startDate,
            LocalDate endDate);
}
