package com.vitabridge.backend.model;

/**
 * Enumeration representing user roles in the VitaBridge system.
 * Provides type safety and consistency for role management.
 */
public enum Role {
    ADMIN("ADMIN"),
    PATIENT("PATIENT"),
    DOCTOR("DOCTOR"),
    ASSISTANT("ASSISTANT");

    private final String value;

    Role(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    /**
     * Convert a string to a Role enum.
     * 
     * @param value the string value
     * @return the corresponding Role
     * @throws IllegalArgumentException if the value is not a valid role
     */
    public static Role fromString(String value) {
        if (value == null) {
            throw new IllegalArgumentException("Role value cannot be null");
        }
        for (Role role : Role.values()) {
            if (role.value.equalsIgnoreCase(value)) {
                return role;
            }
        }
        throw new IllegalArgumentException("Invalid role: " + value);
    }

    @Override
    public String toString() {
        return value;
    }
}
