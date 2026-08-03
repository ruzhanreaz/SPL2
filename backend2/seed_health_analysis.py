"""
Health Analysis Data Seeder for backend2
Seeds health measurements for the first 10 patients
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.models.measurement import Measurement
from app.models.report import Report
from app.models.enums import MetricCode


def seed_health_measurements():
    """Seed health analysis measurements for first 10 patients"""
    
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    
    try:
        # Check if data already exists
        existing = db.query(Measurement).count()
        if existing > 0:
            print("✓ Health measurements already seeded, skipping...")
            return
        
        print("Seeding health measurements for first 10 patients...")
        
        # Patient IDs from Java backend (patient00001 - patient00010)
        patient_ids = [f"patient{i:05d}" for i in range(1, 11)]
        
        # Sample health data for different patients
        health_data = [
            # Patient 1: Healthy profile
            {
                "metrics": {
                    MetricCode.total_cholesterol: (180, "mg/dL", 0.95),
                    MetricCode.ldl: (100, "mg/dL", 0.93),
                    MetricCode.hdl: (55, "mg/dL", 0.92),
                    MetricCode.triglycerides: (120, "mg/dL", 0.94),
                    MetricCode.blood_pressure_systolic: (120, "mmHg", 0.98),
                    MetricCode.blood_pressure_diastolic: (80, "mmHg", 0.98),
                    MetricCode.heart_rate: (72, "bpm", 0.96),
                    MetricCode.oxygen_saturation: (98, "%", 0.99),
                }
            },
            # Patient 2: High cholesterol
            {
                "metrics": {
                    MetricCode.total_cholesterol: (245, "mg/dL", 0.91),
                    MetricCode.ldl: (165, "mg/dL", 0.89),
                    MetricCode.hdl: (35, "mg/dL", 0.88),
                    MetricCode.triglycerides: (180, "mg/dL", 0.90),
                    MetricCode.blood_pressure_systolic: (125, "mmHg", 0.97),
                    MetricCode.blood_pressure_diastolic: (82, "mmHg", 0.96),
                    MetricCode.heart_rate: (78, "bpm", 0.94),
                    MetricCode.oxygen_saturation: (97, "%", 0.98),
                }
            },
            # Patient 3: Hypertension
            {
                "metrics": {
                    MetricCode.total_cholesterol: (200, "mg/dL", 0.93),
                    MetricCode.ldl: (120, "mg/dL", 0.91),
                    MetricCode.hdl: (45, "mg/dL", 0.90),
                    MetricCode.triglycerides: (150, "mg/dL", 0.92),
                    MetricCode.blood_pressure_systolic: (145, "mmHg", 0.95),
                    MetricCode.blood_pressure_diastolic: (95, "mmHg", 0.95),
                    MetricCode.heart_rate: (82, "bpm", 0.93),
                    MetricCode.oxygen_saturation: (96, "%", 0.97),
                }
            },
            # Patient 4: Low oxygen saturation
            {
                "metrics": {
                    MetricCode.total_cholesterol: (190, "mg/dL", 0.92),
                    MetricCode.ldl: (110, "mg/dL", 0.90),
                    MetricCode.hdl: (50, "mg/dL", 0.89),
                    MetricCode.triglycerides: (130, "mg/dL", 0.91),
                    MetricCode.blood_pressure_systolic: (128, "mmHg", 0.96),
                    MetricCode.blood_pressure_diastolic: (85, "mmHg", 0.96),
                    MetricCode.heart_rate: (88, "bpm", 0.91),
                    MetricCode.oxygen_saturation: (92, "%", 0.94),
                }
            },
            # Patient 5: Pre-diabetic profile
            {
                "metrics": {
                    MetricCode.total_cholesterol: (220, "mg/dL", 0.90),
                    MetricCode.ldl: (140, "mg/dL", 0.88),
                    MetricCode.hdl: (40, "mg/dL", 0.87),
                    MetricCode.triglycerides: (200, "mg/dL", 0.89),
                    MetricCode.blood_pressure_systolic: (135, "mmHg", 0.94),
                    MetricCode.blood_pressure_diastolic: (88, "mmHg", 0.94),
                    MetricCode.heart_rate: (85, "bpm", 0.92),
                    MetricCode.oxygen_saturation: (97, "%", 0.98),
                }
            },
            # Patient 6: Borderline high
            {
                "metrics": {
                    MetricCode.total_cholesterol: (195, "mg/dL", 0.93),
                    MetricCode.ldl: (115, "mg/dL", 0.91),
                    MetricCode.hdl: (48, "mg/dL", 0.90),
                    MetricCode.triglycerides: (145, "mg/dL", 0.92),
                    MetricCode.blood_pressure_systolic: (130, "mmHg", 0.96),
                    MetricCode.blood_pressure_diastolic: (86, "mmHg", 0.96),
                    MetricCode.heart_rate: (75, "bpm", 0.95),
                    MetricCode.oxygen_saturation: (98, "%", 0.99),
                }
            },
            # Patient 7: Elevated heart rate
            {
                "metrics": {
                    MetricCode.total_cholesterol: (185, "mg/dL", 0.94),
                    MetricCode.ldl: (105, "mg/dL", 0.92),
                    MetricCode.hdl: (52, "mg/dL", 0.91),
                    MetricCode.triglycerides: (125, "mg/dL", 0.93),
                    MetricCode.blood_pressure_systolic: (122, "mmHg", 0.97),
                    MetricCode.blood_pressure_diastolic: (81, "mmHg", 0.97),
                    MetricCode.heart_rate: (95, "bpm", 0.88),
                    MetricCode.oxygen_saturation: (97, "%", 0.98),
                }
            },
            # Patient 8: Optimal health
            {
                "metrics": {
                    MetricCode.total_cholesterol: (170, "mg/dL", 0.96),
                    MetricCode.ldl: (95, "mg/dL", 0.94),
                    MetricCode.hdl: (60, "mg/dL", 0.93),
                    MetricCode.triglycerides: (110, "mg/dL", 0.95),
                    MetricCode.blood_pressure_systolic: (118, "mmHg", 0.98),
                    MetricCode.blood_pressure_diastolic: (78, "mmHg", 0.98),
                    MetricCode.heart_rate: (70, "bpm", 0.97),
                    MetricCode.oxygen_saturation: (99, "%", 0.99),
                }
            },
            # Patient 9: Mild hypertension + high triglycerides
            {
                "metrics": {
                    MetricCode.total_cholesterol: (210, "mg/dL", 0.91),
                    MetricCode.ldl: (130, "mg/dL", 0.89),
                    MetricCode.hdl: (42, "mg/dL", 0.88),
                    MetricCode.triglycerides: (220, "mg/dL", 0.87),
                    MetricCode.blood_pressure_systolic: (138, "mmHg", 0.95),
                    MetricCode.blood_pressure_diastolic: (90, "mmHg", 0.95),
                    MetricCode.heart_rate: (80, "bpm", 0.93),
                    MetricCode.oxygen_saturation: (96, "%", 0.97),
                }
            },
            # Patient 10: Multiple concerns
            {
                "metrics": {
                    MetricCode.total_cholesterol: (250, "mg/dL", 0.89),
                    MetricCode.ldl: (170, "mg/dL", 0.87),
                    MetricCode.hdl: (32, "mg/dL", 0.86),
                    MetricCode.triglycerides: (240, "mg/dL", 0.85),
                    MetricCode.blood_pressure_systolic: (150, "mmHg", 0.93),
                    MetricCode.blood_pressure_diastolic: (98, "mmHg", 0.93),
                    MetricCode.heart_rate: (92, "bpm", 0.90),
                    MetricCode.oxygen_saturation: (94, "%", 0.96),
                }
            },
        ]
        
        # Seed measurements
        base_date = datetime.now() - timedelta(days=7)
        
        for idx, patient_id in enumerate(patient_ids):
            print(f"  Seeding measurements for {patient_id}...")
            patient_data = health_data[idx]
            
            # Create a report for this patient
            report = Report(
                patient_id=patient_id,
                file_name=f"health_report_{patient_id}.pdf",
                mime_type="application/pdf",
                storage_path=f"/reports/{patient_id}/health_report.pdf",
                reported_at=base_date + timedelta(days=idx),
            )
            db.add(report)
            db.flush()  # Get the report ID
            
            # Create measurements for this patient
            for metric_code, (value, unit, confidence) in patient_data["metrics"].items():
                measurement = Measurement(
                    patient_id=patient_id,
                    report_id=report.id,
                    metric_code=metric_code,
                    value=value,
                    unit=unit,
                    measured_at=base_date + timedelta(days=idx, hours=9 + idx % 4),
                    confidence=confidence,
                )
                db.add(measurement)
        
        db.commit()
        print("✓ Successfully seeded health measurements for 10 patients")
        print(f"  - Total measurements created: {len(patient_ids) * 8}")
        
    except Exception as e:
        db.rollback()
        print(f"✗ Error seeding health measurements: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_health_measurements()
