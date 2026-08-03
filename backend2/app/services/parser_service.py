import re
from dataclasses import dataclass
from datetime import UTC, datetime

from app.models.enums import MetricCode


@dataclass
class ParsedMeasurement:
    metric_code: MetricCode
    value: float
    unit: str
    measured_at: datetime
    confidence: float


class ParserService:
    _PATTERNS: dict[MetricCode, tuple[re.Pattern[str], str]] = {
        MetricCode.total_cholesterol: (
            re.compile(
                r"(?:total\s+cholesterol|cholesterol\s*total)[^\d]{0,40}(\d{1,3}(?:[\.,]\d+)?)",
                re.I,
            ),
            "mg/dL",
        ),
        MetricCode.ldl: (
            re.compile(
                r"\bldl\b(?:\s*cholesterol)?[^\d]{0,40}(\d{1,3}(?:[\.,]\d+)?)",
                re.I,
            ),
            "mg/dL",
        ),
        MetricCode.hdl: (
            re.compile(
                r"\bhdl\b(?:\s*cholesterol)?[^\d]{0,40}(\d{1,3}(?:[\.,]\d+)?)",
                re.I,
            ),
            "mg/dL",
        ),
        MetricCode.triglycerides: (
            re.compile(r"\btriglycerides?\b[^\d]{0,40}(\d{1,3}(?:[\.,]\d+)?)", re.I),
            "mg/dL",
        ),
        MetricCode.heart_rate: (
            re.compile(
                r"(?:heart\s*rate|pulse|\bhr\b)[^\d]{0,25}(\d{2,3}(?:[\.,]\d+)?)",
                re.I,
            ),
            "bpm",
        ),
        MetricCode.oxygen_saturation: (
            re.compile(
                r"(?:oxygen\s*saturation|spo2|o2\s*sat(?:uration)?)"
                r"[^\d]{0,25}(\d{2,3}(?:[\.,]\d+)?)",
                re.I,
            ),
            "%",
        ),
    }

    _BP_PATTERN = re.compile(
        r"(?:blood\s*pressure|\bbp\b)[^\d]{0,20}(\d{2,3})\s*/\s*(\d{2,3})",
        re.I,
    )
    _DATE_PATTERNS: tuple[re.Pattern[str], ...] = (
        re.compile(r"\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b"),
        re.compile(r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b"),
    )

    def extract_measurement_date(self, text: str) -> datetime | None:
        normalized = " ".join(text.split())

        for pattern in self._DATE_PATTERNS:
            match = pattern.search(normalized)
            if not match:
                continue
            try:
                if pattern is self._DATE_PATTERNS[0]:
                    year, month, day = map(int, match.groups())
                else:
                    day, month, year = map(int, match.groups())
                return datetime(year, month, day, tzinfo=UTC)
            except ValueError:
                continue

        return None

    def parse(
        self, text: str, fallback_date: datetime | None = None
    ) -> list[ParsedMeasurement]:
        measured_at = fallback_date or datetime.now(tz=UTC)
        parsed: list[ParsedMeasurement] = []

        normalized = self._normalize_ocr_text(text)

        for metric_code, (pattern, default_unit) in self._PATTERNS.items():
            match = pattern.search(normalized)
            if not match:
                continue
            value = self._safe_float(match.group(1))
            if value is None:
                continue
            parsed.append(
                ParsedMeasurement(
                    metric_code=metric_code,
                    value=value,
                    unit=default_unit,
                    measured_at=measured_at,
                    confidence=0.82,
                )
            )

        bp_match = self._BP_PATTERN.search(normalized)
        if bp_match:
            systolic = self._safe_float(bp_match.group(1))
            diastolic = self._safe_float(bp_match.group(2))
            if systolic is None or diastolic is None:
                return parsed
            parsed.append(
                ParsedMeasurement(
                    metric_code=MetricCode.blood_pressure_systolic,
                    value=systolic,
                    unit="mmHg",
                    measured_at=measured_at,
                    confidence=0.8,
                )
            )
            parsed.append(
                ParsedMeasurement(
                    metric_code=MetricCode.blood_pressure_diastolic,
                    value=diastolic,
                    unit="mmHg",
                    measured_at=measured_at,
                    confidence=0.8,
                )
            )

        return parsed

    @staticmethod
    def _normalize_ocr_text(text: str) -> str:
        normalized = " ".join(text.split())
        normalized = normalized.replace("|", "/")
        return normalized

    @staticmethod
    def _safe_float(raw_value: str) -> float | None:
        cleaned = raw_value.strip().replace(",", ".")
        cleaned = cleaned.translate(
            str.maketrans({"O": "0", "o": "0", "I": "1", "l": "1"})
        )
        try:
            return float(cleaned)
        except ValueError:
            return None
