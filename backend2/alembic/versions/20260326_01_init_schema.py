"""init schema

Revision ID: 20260326_01
Revises:
Create Date: 2026-03-26 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260326_01"
down_revision = None
branch_labels = None
depends_on = None


job_status = postgresql.ENUM(
    "pending",
    "processed",
    "failed",
    "review_required",
    name="job_status",
    create_type=False,
)
metric_code = postgresql.ENUM(
    "total_cholesterol",
    "ldl",
    "hdl",
    "triglycerides",
    "blood_pressure_systolic",
    "blood_pressure_diastolic",
    "heart_rate",
    "oxygen_saturation",
    name="metric_code",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    job_status.create(bind, checkfirst=True)
    metric_code.create(bind, checkfirst=True)

    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("patient_id", sa.String(length=64), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=False),
        sa.Column("storage_path", sa.String(length=255), nullable=True),
        sa.Column("reported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_reports_patient_id", "reports", ["patient_id"])

    op.create_table(
        "report_processing_jobs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "report_id",
            sa.Integer(),
            sa.ForeignKey("reports.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", job_status, nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("ocr_text", sa.Text(), nullable=True),
        sa.Column(
            "parsed_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("report_id", name="uq_report_processing_jobs_report_id"),
    )

    op.create_table(
        "measurements",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("patient_id", sa.String(length=64), nullable=False),
        sa.Column(
            "report_id",
            sa.Integer(),
            sa.ForeignKey("reports.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("metric_code", metric_code, nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=False),
        sa.Column("measured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_measurements_patient_id", "measurements", ["patient_id"])
    op.create_index("ix_measurements_report_id", "measurements", ["report_id"])
    op.create_index("ix_measurements_metric_code", "measurements", ["metric_code"])
    op.create_index("ix_measurements_measured_at", "measurements", ["measured_at"])


def downgrade() -> None:
    op.drop_index("ix_measurements_measured_at", table_name="measurements")
    op.drop_index("ix_measurements_metric_code", table_name="measurements")
    op.drop_index("ix_measurements_report_id", table_name="measurements")
    op.drop_index("ix_measurements_patient_id", table_name="measurements")
    op.drop_table("measurements")

    op.drop_table("report_processing_jobs")

    op.drop_index("ix_reports_patient_id", table_name="reports")
    op.drop_table("reports")

    bind = op.get_bind()
    metric_code.drop(bind, checkfirst=True)
    job_status.drop(bind, checkfirst=True)
