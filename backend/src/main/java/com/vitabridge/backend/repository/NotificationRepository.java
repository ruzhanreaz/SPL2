package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.Notification;
import com.vitabridge.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Integer> {

    List<Notification> findByUserOrderByCreatedAtDesc(User user);

    List<Notification> findByUserAndIsReadFalseOrderByCreatedAtDesc(User user);

    Long countByUserAndIsReadFalse(User user);

    boolean existsByUserAndRelatedEntityTypeAndRelatedEntityIdAndTitleAndMessage(
            User user,
            String relatedEntityType,
            Integer relatedEntityId,
            String title,
            String message);
}
