package com.vitabridge.backend.repository;

import com.vitabridge.backend.model.Admin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AdminRepository extends JpaRepository<Admin, Integer> {
    Optional<Admin> findByUserEmail(String email);
    Optional<Admin> findByUserUserId(Integer userId);

    long countByUserIsActiveTrue();
}
