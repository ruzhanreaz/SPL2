from enum import Enum


class JobStatus(str, Enum):
    pending = "pending"
    processed = "processed"
    failed = "failed"
    review_required = "review_required"


class MetricCode(str, Enum):
    total_cholesterol = "total_cholesterol"
    ldl = "ldl"
    hdl = "hdl"
    triglycerides = "triglycerides"
    blood_pressure_systolic = "blood_pressure_systolic"
    blood_pressure_diastolic = "blood_pressure_diastolic"
    heart_rate = "heart_rate"
    oxygen_saturation = "oxygen_saturation"
