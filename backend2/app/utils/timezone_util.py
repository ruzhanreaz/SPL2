"""
TIMEZONE STRATEGY FOR VITABRIDGE
================================
All timestamps in the database and API responses are stored/transmitted in UTC (ISO-8601 format).
All internal operations use UTC datetimes.
This ensures consistency across all parts of the system regardless of server timezone.
"""

from datetime import datetime, timezone, timedelta
import pytz

# Dhaka timezone
DHAKA_TZ = pytz.timezone("Asia/Dhaka")
UTC_TZ = pytz.UTC


def now_utc() -> datetime:
    """
    Get current time in UTC.
    Always use this instead of datetime.now().

    Returns:
        datetime: Current time in UTC
    """
    return datetime.now(tz=UTC_TZ)


def now_dhaka() -> datetime:
    """
    Get current time in Dhaka timezone.

    Returns:
        datetime: Current time in Dhaka timezone
    """
    return datetime.now(tz=DHAKA_TZ)


def today_dhaka():
    """
    Get today's date in Dhaka timezone.

    Returns:
        date: Today's date in Dhaka timezone
    """
    return datetime.now(tz=DHAKA_TZ).date()


def to_utc(dt: datetime) -> datetime:
    """
    Convert a datetime to UTC.

    Args:
        dt: datetime object (can be naive or aware)

    Returns:
        datetime: UTC datetime
    """
    if dt is None:
        return None

    if dt.tzinfo is None:
        # Assume naive datetime is in Dhaka timezone
        return DHAKA_TZ.localize(dt).astimezone(UTC_TZ)

    return dt.astimezone(UTC_TZ)


def to_dhaka(dt: datetime) -> datetime:
    """
    Convert a datetime to Dhaka timezone.

    Args:
        dt: datetime object in UTC or naive

    Returns:
        datetime: Dhaka timezone datetime
    """
    if dt is None:
        return None

    if dt.tzinfo is None:
        # Assume naive datetime is in UTC
        return UTC_TZ.localize(dt).astimezone(DHAKA_TZ)

    return dt.astimezone(DHAKA_TZ)


def format_iso8601(dt: datetime) -> str:
    """
    Format datetime as ISO-8601 UTC string for API responses.

    Args:
        dt: datetime object

    Returns:
        str: ISO-8601 formatted UTC timestamp
    """
    if dt is None:
        return None

    utc_dt = to_utc(dt)
    return utc_dt.isoformat()


def parse_iso8601(iso_string: str) -> datetime:
    """
    Parse ISO-8601 timestamp string to UTC datetime.

    Args:
        iso_string: ISO-8601 formatted timestamp

    Returns:
        datetime: UTC datetime
    """
    if not iso_string:
        return None

    try:
        # Parse ISO-8601 string
        dt = datetime.fromisoformat(iso_string.replace("Z", "+00:00"))
        return to_utc(dt)
    except Exception:
        return None


def start_of_day_dhaka() -> datetime:
    """
    Get start of today in Dhaka timezone (00:00:00) as UTC datetime.

    Returns:
        datetime: Start of today in Dhaka as UTC datetime
    """
    today = today_dhaka()
    start = datetime.combine(today, datetime.min.time())
    start = DHAKA_TZ.localize(start)
    return start.astimezone(UTC_TZ)


def end_of_day_dhaka() -> datetime:
    """
    Get end of today in Dhaka timezone (23:59:59) as UTC datetime.

    Returns:
        datetime: End of today in Dhaka as UTC datetime
    """
    today = today_dhaka()
    end = datetime.combine(today, datetime.max.time())
    end = DHAKA_TZ.localize(end)
    return end.astimezone(UTC_TZ)


def start_of_date_dhaka(date_obj) -> datetime:
    """
    Get start of a specific date in Dhaka timezone (00:00:00) as UTC datetime.

    Args:
        date_obj: date object or string in format YYYY-MM-DD

    Returns:
        datetime: Start of date as UTC datetime
    """
    if isinstance(date_obj, str):
        from datetime import datetime as dt_class

        date_obj = dt_class.strptime(date_obj, "%Y-%m-%d").date()

    start = datetime.combine(date_obj, datetime.min.time())
    start = DHAKA_TZ.localize(start)
    return start.astimezone(UTC_TZ)


def end_of_date_dhaka(date_obj) -> datetime:
    """
    Get end of a specific date in Dhaka timezone (23:59:59) as UTC datetime.

    Args:
        date_obj: date object or string in format YYYY-MM-DD

    Returns:
        datetime: End of date as UTC datetime
    """
    if isinstance(date_obj, str):
        from datetime import datetime as dt_class

        date_obj = dt_class.strptime(date_obj, "%Y-%m-%d").date()

    end = datetime.combine(date_obj, datetime.max.time())
    end = DHAKA_TZ.localize(end)
    return end.astimezone(UTC_TZ)


def is_past(dt: datetime) -> bool:
    """
    Check if a datetime is in the past relative to now.

    Args:
        dt: datetime object

    Returns:
        bool: True if datetime is before now
    """
    if dt is None:
        return False
    return dt < now_utc()


def is_future(dt: datetime) -> bool:
    """
    Check if a datetime is in the future relative to now.

    Args:
        dt: datetime object

    Returns:
        bool: True if datetime is after now
    """
    if dt is None:
        return False
    return dt > now_utc()


def add_days(dt: datetime, days: int) -> datetime:
    """
    Add days to a datetime.

    Args:
        dt: datetime object
        days: number of days to add

    Returns:
        datetime: New datetime
    """
    if dt is None:
        return None
    return dt + timedelta(days=days)
