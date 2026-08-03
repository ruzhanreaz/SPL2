from datetime import UTC, datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile
from minio import Minio
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.models.enums import JobStatus
from app.models.measurement import Measurement
from app.models.report import Report, ReportProcessingJob
from app.schemas.common import ReportUploadResponse
from app.services.ocr_service import OCRService
from app.services.parser_service import ParserService


class IngestionService:
    _SUPPORTED_EXTENSIONS = {
        ".png",
        ".jpg",
        ".jpeg",
        ".bmp",
        ".tif",
        ".tiff",
        ".webp",
        ".pdf",
    }

    def __init__(self, db: Session) -> None:
        self.db = db
        self.settings = get_settings()
        self.ocr = OCRService()
        self.parser = ParserService()
        minio_endpoint = self.settings.minio_endpoint.replace("http://", "")
        if "/" in minio_endpoint:
            minio_endpoint = minio_endpoint.split("/", 1)[0]
        self.minio_client = Minio(
            endpoint=minio_endpoint,
            access_key=self.settings.minio_access_key,
            secret_key=self.settings.minio_secret_key,
            secure=False,
        )

    async def ingest_report(
        self,
        patient_id: str,
        file: UploadFile,
        reported_at: datetime | None,
    ) -> ReportUploadResponse:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        max_bytes = self.settings.max_upload_mb * 1024 * 1024
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=413, detail=f"File exceeds {self.settings.max_upload_mb}MB."
            )

        return self._ingest_content(
            patient_id=patient_id,
            content=content,
            file_name=file.filename or "report",
            mime_type=file.content_type or "application/octet-stream",
            reported_at=reported_at,
            storage_path=f"uploads/{patient_id}/{Path(file.filename or 'report').name}",
        )

    def ingest_reports_from_drive(
        self,
        patient_id: str,
        folder_path: str | None,
        reported_at: datetime | None,
    ) -> list[ReportUploadResponse]:
        base_path = Path(folder_path or self.settings.reports_drive_path or "")
        if not base_path.exists() or not base_path.is_dir():
            raise HTTPException(
                status_code=400,
                detail="Drive folder path is invalid or does not exist.",
            )

        report_files = sorted(
            path
            for path in base_path.rglob("*")
            if path.is_file() and path.suffix.lower() in self._SUPPORTED_EXTENSIONS
        )
        if not report_files:
            raise HTTPException(
                status_code=404,
                detail="No supported report files were found in the drive folder.",
            )

        results: list[ReportUploadResponse] = []
        for path in report_files:
            content = path.read_bytes()
            response = self._ingest_content(
                patient_id=patient_id,
                content=content,
                file_name=path.name,
                mime_type=self._guess_mime_type(path),
                reported_at=reported_at,
                storage_path=str(path),
            )
            results.append(response)

        return results

    def _ingest_content(
        self,
        patient_id: str,
        content: bytes,
        file_name: str,
        mime_type: str,
        reported_at: datetime | None,
        storage_path: str,
    ) -> ReportUploadResponse:
        cached = self._get_cached_processed_result(
            patient_id=patient_id,
            storage_path=storage_path,
            reported_at=reported_at,
        )
        if cached:
            return cached

        report = Report(
            patient_id=patient_id,
            file_name=file_name,
            mime_type=mime_type,
            storage_path=storage_path,
            reported_at=reported_at,
        )
        job = ReportProcessingJob(status=JobStatus.pending)
        report.processing_job = job
        self.db.add(report)
        self.db.flush()

        try:
            text = self.ocr.extract_text(
                file_bytes=content,
                file_name=file_name,
                mime_type=mime_type,
            )
            detected_measured_at = self.parser.extract_measurement_date(text)
            measured_at = reported_at or detected_measured_at or datetime.now(tz=UTC)
            parsed = self.parser.parse(text=text, fallback_date=measured_at)

            for item in parsed:
                self.db.add(
                    Measurement(
                        patient_id=patient_id,
                        report_id=report.id,
                        metric_code=item.metric_code,
                        value=item.value,
                        unit=item.unit,
                        measured_at=item.measured_at,
                        confidence=item.confidence,
                    )
                )

            avg_confidence = (
                sum(item.confidence for item in parsed) / len(parsed)
                if parsed
                else None
            )
            needs_review = avg_confidence is None or avg_confidence < 0.75

            job.status = (
                JobStatus.review_required if needs_review else JobStatus.processed
            )
            job.ocr_text = text[:50000] if text else None
            job.parsed_payload = {
                "extracted_count": len(parsed),
                "metric_codes": sorted({item.metric_code.value for item in parsed}),
                "measured_at": measured_at.isoformat(),
            }
            job.confidence = avg_confidence

            if report.reported_at is None:
                report.reported_at = measured_at

            self.db.commit()

            return ReportUploadResponse(
                report_id=report.id,
                status=job.status.value,
                extracted_count=len(parsed),
                needs_review=needs_review,
            )
        except Exception as exc:  # noqa: BLE001
            job.status = JobStatus.failed
            job.error_message = str(exc)
            self.db.commit()
            raise HTTPException(
                status_code=500, detail=f"Report processing failed for {file_name}."
            ) from exc

    @staticmethod
    def _parse_issued_at(value: object) -> datetime | None:
        if value is None:
            return None

        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=UTC)

        if isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
            except ValueError:
                return None

        return None

    def _get_cached_processed_result(
        self,
        patient_id: str,
        storage_path: str,
        reported_at: datetime | None,
    ) -> ReportUploadResponse | None:
        if not storage_path:
            return None

        existing_report = (
            self.db.execute(
                select(Report)
                .where(
                    Report.patient_id == patient_id, Report.storage_path == storage_path
                )
                .order_by(Report.id.desc())
            )
            .scalars()
            .first()
        )
        if not existing_report or not existing_report.processing_job:
            return None

        job = existing_report.processing_job
        if job.status not in {JobStatus.processed, JobStatus.review_required}:
            return None

        payload = job.parsed_payload or {}
        extracted_count = payload.get("extracted_count")
        if isinstance(extracted_count, int) and extracted_count <= 0:
            return None

        # Keep historical OCR output, but align timeline to issued date if a better date is provided.
        if reported_at and existing_report.reported_at != reported_at:
            existing_report.reported_at = reported_at
            measurements = (
                self.db.execute(
                    select(Measurement).where(
                        Measurement.report_id == existing_report.id
                    )
                )
                .scalars()
                .all()
            )
            for measurement in measurements:
                measurement.measured_at = reported_at

            payload = job.parsed_payload or {}
            payload["measured_at"] = reported_at.isoformat()
            job.parsed_payload = payload
            self.db.commit()

        extracted_count = payload.get("extracted_count")
        if not isinstance(extracted_count, int):
            extracted_count = int(
                self.db.execute(
                    select(func.count(Measurement.id)).where(
                        Measurement.report_id == existing_report.id
                    )
                ).scalar_one()
                or 0
            )

        return ReportUploadResponse(
            report_id=existing_report.id,
            status="already_processed",
            extracted_count=extracted_count,
            needs_review=job.status == JobStatus.review_required,
        )

    @classmethod
    def _guess_mime_type(cls, path: Path) -> str:
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            return "application/pdf"
        if suffix in {".jpg", ".jpeg"}:
            return "image/jpeg"
        if suffix == ".png":
            return "image/png"
        if suffix == ".webp":
            return "image/webp"
        if suffix in {".tif", ".tiff"}:
            return "image/tiff"
        if suffix == ".bmp":
            return "image/bmp"
        return "application/octet-stream"
