/**
 * TIMEZONE STRATEGY FOR VITABRIDGE
 * ================================
 * All timestamps in the database and API responses are stored/transmitted in UTC (ISO-8601 format).
 * The frontend converts UTC timestamps to Dhaka timezone (UTC+6) for display.
 * This ensures consistency across all parts of the system regardless of server or user timezone.
 */

// Dhaka timezone: UTC+6 (or Asia/Dhaka)
const DHAKA_TIMEZONE = "Asia/Dhaka";

/**
 * Convert a UTC timestamp to Dhaka local time for display.
 * @param {string|Date|number} utcTimestamp - UTC timestamp (ISO string, Date object, or milliseconds)
 * @returns {Date} Date object in Dhaka timezone (note: Date objects are always UTC internally,
 *                  but formatting happens in local timezone via toLocaleString)
 */
export const toLocalTime = (utcTimestamp) => {
  if (!utcTimestamp) return null;

  try {
    const date = new Date(utcTimestamp);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
};

/**
 * Format a UTC timestamp as a readable local string (Dhaka time).
 * @param {string|Date|number} utcTimestamp - UTC timestamp
 * @param {string} format - 'full' | 'date' | 'time' | 'short' (default: 'full')
 * @returns {string} Formatted timestamp in Dhaka timezone
 */
export const formatLocalTime = (utcTimestamp, format = "full") => {
  const date = toLocalTime(utcTimestamp);
  if (!date) return "";

  const options = {
    timeZone: DHAKA_TIMEZONE,
  };

  switch (format) {
    case "date":
      return date.toLocaleDateString("en-US", {
        ...options,
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    case "time":
      return date.toLocaleTimeString("en-US", {
        ...options,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    case "short":
      return date.toLocaleDateString("en-US", {
        ...options,
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    case "full":
    default:
      return date.toLocaleDateString("en-US", {
        ...options,
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
  }
};

/**
 * Convert a local date string (YYYY-MM-DD) to a UTC Date object.
 * Treats the input as a date in Dhaka timezone and converts to UTC.
 * @param {string} dateStr - Local date string in format YYYY-MM-DD
 * @returns {Date} UTC Date object
 */
export const localDateStringToUTC = (dateStr) => {
  if (!dateStr) return null;

  try {
    // Parse YYYY-MM-DD as a date in Dhaka timezone
    const [year, month, day] = dateStr.split("-").map(Number);

    // Create a formatter for Dhaka timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: DHAKA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    // We need to find the UTC date that corresponds to midnight in Dhaka
    // Start with a guess and adjust
    let testDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // Format the test date in Dhaka timezone and check if it matches
    const parts = formatter.formatToParts(testDate);
    const partsObj = {};
    parts.forEach((part) => {
      if (part.type !== "literal") {
        partsObj[part.type] = part.value;
      }
    });

    const testYear = parseInt(partsObj.year);
    const testMonth = parseInt(partsObj.month);
    const testDay = parseInt(partsObj.day);

    // Adjust by the difference
    const diffDay = day - testDay;
    const diffMonth = month - testMonth;
    const diffYear = year - testYear;

    testDate.setUTCDate(testDate.getUTCDate() + diffDay);
    testDate.setUTCMonth(testDate.getUTCMonth() + diffMonth);
    testDate.setUTCFullYear(testDate.getUTCFullYear() + diffYear);

    return testDate;
  } catch {
    return null;
  }
};

/**
 * Get current time in UTC (for backend requests).
 * @returns {string} ISO-8601 UTC timestamp
 */
export const getCurrentUTCTimestamp = () => {
  return new Date().toISOString();
};

/**
 * Format relative time (e.g., "5 minutes ago", "2 days ago").
 * @param {string|Date|number} utcTimestamp - UTC timestamp
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (utcTimestamp) => {
  const date = toLocalTime(utcTimestamp);
  if (!date) return "";

  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return formatLocalTime(utcTimestamp, "date");
};

/**
 * Get today's date in Dhaka timezone (midnight in Dhaka as UTC).
 * @returns {string} Date string in format YYYY-MM-DD
 */
export const getTodayInDhaka = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: DHAKA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
};

/**
 * Get tomorrow's date in Dhaka timezone.
 * @returns {string} Date string in format YYYY-MM-DD
 */
export const getTomorrowInDhaka = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: DHAKA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatter.format(tomorrow);
};

/**
 * Add days to a Dhaka date string.
 * @param {string} dateStr - Date string in format YYYY-MM-DD
 * @param {number} days - Number of days to add
 * @returns {string} New date string in format YYYY-MM-DD
 */
export const addDaysToDate = (dateStr, days) => {
  try {
    const utcDate = localDateStringToUTC(dateStr);
    utcDate.setUTCDate(utcDate.getUTCDate() + days);

    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: DHAKA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(utcDate);
  } catch {
    return null;
  }
};
