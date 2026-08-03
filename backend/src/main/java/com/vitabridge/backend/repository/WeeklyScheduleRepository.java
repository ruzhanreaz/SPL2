package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.Schedule;
import com.vitabridge.backend.model.WeeklySchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WeeklyScheduleRepository extends JpaRepository<WeeklySchedule, Integer> {
    List<WeeklySchedule> findBySchedule(Schedule schedule);

    List<WeeklySchedule> findByScheduleScheduleId(Integer scheduleId);

    List<WeeklySchedule> findByScheduleAndDayOfWeek(Schedule schedule, Integer dayOfWeek);
}
