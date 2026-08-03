package com.vitabridge.backend.util;

import java.time.*;
import java.time.format.DateTimeFormatter;

/**
 * TIMEZONE STRATEGY FOR VITABRIDGE
 * ================================
 * All timestamps in the database and API responses are stored/transmitted in UTC (ISO-8601 format).
 * All internal operations use Instant (always UTC) or ZonedDateTime with explicit UTC zone.
 * This ensures consistency across all parts of the system regardless of server timezone.
 */
public class TimezoneUtil {
    
    // Dhaka timezone for business logic purposes
    private static final ZoneId DHAKA_ZONE = ZoneId.of("Asia/Dhaka");
    private static final ZoneId UTC_ZONE = ZoneId.of("UTC");
    
    /**
     * Get current time as UTC Instant (always use this instead of System.currentTimeMillis()).
     * @return Current time as Instant in UTC
     */
    public static Instant now() {
        return Instant.now();
    }
    
    /**
     * Get current time as UTC ZonedDateTime.
     * @return Current time as ZonedDateTime in UTC
     */
    public static ZonedDateTime nowUTC() {
        return ZonedDateTime.now(UTC_ZONE);
    }
    
    /**
     * Get current local date in Dhaka timezone.
     * @return Current date in Dhaka timezone
     */
    public static LocalDate todayInDhaka() {
        return LocalDate.now(DHAKA_ZONE);
    }
    
    /**
     * Get current local time in Dhaka timezone.
     * @return Current time in Dhaka timezone
     */
    public static LocalTime nowInDhaka() {
        return LocalTime.now(DHAKA_ZONE);
    }
    
    /**
     * Get current local date-time in Dhaka timezone.
     * @return Current date-time in Dhaka timezone
     */
    public static LocalDateTime nowLocalInDhaka() {
        return LocalDateTime.now(DHAKA_ZONE);
    }
    
    /**
     * Convert Instant to Dhaka LocalDateTime for display/business logic.
     * @param instant UTC instant
     * @return LocalDateTime in Dhaka timezone
     */
    public static LocalDateTime instantToDhakaLocalDateTime(Instant instant) {
        if (instant == null) return null;
        return LocalDateTime.ofInstant(instant, DHAKA_ZONE);
    }
    
    /**
     * Convert Instant to ISO-8601 UTC string for API responses.
     * @param instant UTC instant
     * @return ISO-8601 formatted UTC timestamp string
     */
    public static String instantToISO8601(Instant instant) {
        if (instant == null) return null;
        return DateTimeFormatter.ISO_INSTANT.format(instant);
    }
    
    /**
     * Parse ISO-8601 timestamp string to Instant.
     * @param isoString ISO-8601 formatted timestamp
     * @return Instant in UTC
     */
    public static Instant parseISO8601(String isoString) {
        if (isoString == null || isoString.isEmpty()) return null;
        try {
            return Instant.parse(isoString);
        } catch (Exception e) {
            return null;
        }
    }
    
    /**
     * Get start of today in Dhaka timezone as UTC Instant.
     * @return Start of today (00:00:00) in Dhaka as UTC Instant
     */
    public static Instant startOfTodayInDhaka() {
        return LocalDate.now(DHAKA_ZONE)
            .atStartOfDay(DHAKA_ZONE)
            .toInstant();
    }
    
    /**
     * Get end of today in Dhaka timezone as UTC Instant.
     * @return End of today (23:59:59) in Dhaka as UTC Instant
     */
    public static Instant endOfTodayInDhaka() {
        return LocalDate.now(DHAKA_ZONE)
            .plusDays(1)
            .atStartOfDay(DHAKA_ZONE)
            .minusSeconds(1)
            .toInstant();
    }
    
    /**
     * Get start of a specific date in Dhaka timezone as UTC Instant.
     * @param date LocalDate in Dhaka timezone
     * @return Start of date (00:00:00) as UTC Instant
     */
    public static Instant startOfDateInDhaka(LocalDate date) {
        if (date == null) return null;
        return date.atStartOfDay(DHAKA_ZONE).toInstant();
    }
    
    /**
     * Get end of a specific date in Dhaka timezone as UTC Instant.
     * @param date LocalDate in Dhaka timezone
     * @return End of date (23:59:59) as UTC Instant
     */
    public static Instant endOfDateInDhaka(LocalDate date) {
        if (date == null) return null;
        return date.plusDays(1)
            .atStartOfDay(DHAKA_ZONE)
            .minusSeconds(1)
            .toInstant();
    }
    
    /**
     * Get a LocalDateTime in Dhaka timezone and convert to UTC Instant.
     * @param localDateTime LocalDateTime in Dhaka timezone
     * @return UTC Instant
     */
    public static Instant dhakaLocalDateTimeToInstant(LocalDateTime localDateTime) {
        if (localDateTime == null) return null;
        return localDateTime.atZone(DHAKA_ZONE).toInstant();
    }
    
    /**
     * Check if an instant is in the past relative to now.
     * @param instant Instant to check
     * @return true if instant is before now
     */
    public static boolean isPast(Instant instant) {
        if (instant == null) return false;
        return instant.isBefore(now());
    }
    
    /**
     * Check if an instant is in the future relative to now.
     * @param instant Instant to check
     * @return true if instant is after now
     */
    public static boolean isFuture(Instant instant) {
        if (instant == null) return false;
        return instant.isAfter(now());
    }
}
