from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import MetricCode

if TYPE_CHECKING:
    from app.models.report import Report


class Measurement(Base):
    __tablename__ = "measurements"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    patient_id: Mapped[str] = mapped_column(String(64), index=True)
    report_id: Mapped[int] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), index=True, nullable=True
    )
    metric_code: Mapped[MetricCode] = mapped_column(
        Enum(MetricCode, name="metric_code"), index=True
    )
    value: Mapped[float] = mapped_column()
    unit: Mapped[str] = mapped_column(String(32))
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    confidence: Mapped[float | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    report: Mapped[Optional["Report"]] = relationship(back_populates="measurements")
