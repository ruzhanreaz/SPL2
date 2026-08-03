from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.enums import MetricCode
from app.models.measurement import Measurement
from app.schemas.common import (
    ManualMeasurementCreate,
    ManualMeasurementResponse,
    MeasurementTableItem,
    MeasurementTableResponse,
    MeasurementUpdateRequest,
    MetricTrend,
    PatientTrendResponse,
    TrendPoint,
)


class TrendService:
    _DEFAULT_UNITS: dict[MetricCode, str] = {
        MetricCode.total_cholesterol: "mg/dL",
        MetricCode.ldl: "mg/dL",
        MetricCode.hdl: "mg/dL",
        MetricCode.triglycerides: "mg/dL",
        MetricCode.blood_pressure_systolic: "mmHg",
        MetricCode.blood_pressure_diastolic: "mmHg",
        MetricCode.heart_rate: "bpm",
        MetricCode.oxygen_saturation: "%",
    }

    def __init__(self, db: Session) -> None:
        self.db = db

    def add_manual_measurement(
        self, patient_id: str, payload: ManualMeasurementCreate
    ) -> ManualMeasurementResponse:
        measured_at = payload.measured_at or datetime.now(tz=UTC)
        unit = payload.unit or self._DEFAULT_UNITS[payload.metric_code]

        measurement = Measurement(
            patient_id=patient_id,
            report_id=None,
            metric_code=payload.metric_code,
            value=payload.value,
            unit=unit,
            measured_at=measured_at,
            confidence=1.0,
        )
        self.db.add(measurement)
        self.db.commit()
        self.db.refresh(measurement)

        return ManualMeasurementResponse(
            measurement_id=measurement.id,
            patient_id=measurement.patient_id,
            metric_code=measurement.metric_code,
            value=measurement.value,
            unit=measurement.unit,
            measured_at=measurement.measured_at,
        )

    def get_trends(
        self,
        patient_id: str,
        metric: MetricCode | None,
        from_date: datetime | None,
        to_date: datetime | None,
    ) -> PatientTrendResponse:
        stmt: Select[tuple[Measurement]] = select(Measurement).where(
            Measurement.patient_id == patient_id
        )

        if metric:
            stmt = stmt.where(Measurement.metric_code == metric)
        if from_date:
            stmt = stmt.where(Measurement.measured_at >= from_date)
        if to_date:
            stmt = stmt.where(Measurement.measured_at <= to_date)

        stmt = stmt.order_by(
            Measurement.metric_code.asc(), Measurement.measured_at.asc()
        )
        rows = self.db.execute(stmt).scalars().all()

        grouped: dict[MetricCode, list[Measurement]] = {}
        for row in rows:
            grouped.setdefault(row.metric_code, []).append(row)

        trends = [
            MetricTrend(
                metric_code=metric_code,
                unit=items[0].unit,
                points=[
                    TrendPoint(
                        measured_at=item.measured_at, value=item.value, unit=item.unit
                    )
                    for item in items
                ],
            )
            for metric_code, items in grouped.items()
        ]

        return PatientTrendResponse(patient_id=patient_id, trends=trends)

    def list_measurements(self, patient_id: str) -> MeasurementTableResponse:
        stmt: Select[tuple[Measurement]] = (
            select(Measurement)
            .where(Measurement.patient_id == patient_id)
            .order_by(Measurement.measured_at.desc(), Measurement.id.desc())
        )
        rows = self.db.execute(stmt).scalars().all()

        return MeasurementTableResponse(
            patient_id=patient_id,
            items=[
                MeasurementTableItem(
                    measurement_id=row.id,
                    patient_id=row.patient_id,
                    report_id=row.report_id,
                    metric_code=row.metric_code,
                    value=row.value,
                    unit=row.unit,
                    measured_at=row.measured_at,
                    confidence=row.confidence,
                )
                for row in rows
            ],
        )

    def delete_measurement(self, patient_id: str, measurement_id: int) -> None:
        measurement = self.db.get(Measurement, measurement_id)
        if not measurement or measurement.patient_id != patient_id:
            raise HTTPException(status_code=404, detail="Measurement not found.")

        self.db.delete(measurement)
        self.db.commit()

    def update_measurement(
        self,
        patient_id: str,
        measurement_id: int,
        payload: MeasurementUpdateRequest,
    ) -> MeasurementTableItem:
        measurement = self.db.get(Measurement, measurement_id)
        if not measurement or measurement.patient_id != patient_id:
            raise HTTPException(status_code=404, detail="Measurement not found.")

        if payload.metric_code is not None:
            measurement.metric_code = payload.metric_code
        if payload.value is not None:
            measurement.value = payload.value
        if payload.unit is not None:
            measurement.unit = payload.unit
        if payload.measured_at is not None:
            measurement.measured_at = payload.measured_at
        if payload.confidence is not None:
            measurement.confidence = payload.confidence

        self.db.commit()
        self.db.refresh(measurement)

        return MeasurementTableItem(
            measurement_id=measurement.id,
            patient_id=measurement.patient_id,
            report_id=measurement.report_id,
            metric_code=measurement.metric_code,
            value=measurement.value,
            unit=measurement.unit,
            measured_at=measurement.measured_at,
            confidence=measurement.confidence,
        )
