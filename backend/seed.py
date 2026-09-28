import os
import json
import datetime
from backend.database import SessionLocal, engine, Base
from backend.models import User, Medicine, DoseLog, ScanHistory, Alert
from backend.schedule_engine import generate_doses_for_medicine, check_and_create_alerts, get_current_time


def run_seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clear existing data to allow clean re-seed
    db.query(Alert).delete()
    db.query(DoseLog).delete()
    db.query(ScanHistory).delete()
    db.query(Medicine).delete()
    db.query(User).delete()
    db.commit()

    print("Creating primary user Ramesh Patel...")
    user = User(
        id=1,
        name="Ramesh Patel",
        language="en-IN",
        meal_times_json=json.dumps({
            "breakfast": "08:00",
            "lunch": "13:00",
            "dinner": "20:00",
            "bedtime": "22:00"
        }),
        voice_enabled=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    now = get_current_time()
    today = now.date()

    print("Seeding 3 medicines with one at 15% stock...")
    # Medicine 1: Metformin 500mg (At 15% stock -> Second Course Alert immediately triggers!)
    # Started 26 days ago for a 30-day course, 9 pills left out of 60 total
    start_med1 = today - datetime.timedelta(days=26)
    med1 = Medicine(
        name="Metformin SR",
        strength="500 mg",
        dosage="1 tablet",
        route="Oral",
        frequency="Twice Daily",
        timing_json=json.dumps(["morning", "night"]),
        food_instruction="after_food",
        duration_days=30,
        total_qty=60.0,
        remaining_qty=9.0,  # 15% stock!
        start_date=start_med1.isoformat(),
        status="active",
        second_alert_sent=False,
        special_instructions="Take with full glass of water after meals to prevent GI upset."
    )

    # Medicine 2: Amlodipine 5mg (Healthy stock: 80%)
    start_med2 = today - datetime.timedelta(days=6)
    med2 = Medicine(
        name="Amlodipine",
        strength="5 mg",
        dosage="1 tablet",
        route="Oral",
        frequency="Once Daily",
        timing_json=json.dumps(["morning"]),
        food_instruction="before_food",
        duration_days=30,
        total_qty=30.0,
        remaining_qty=24.0,  # 80% stock
        start_date=start_med2.isoformat(),
        status="active",
        second_alert_sent=False,
        special_instructions="Take before breakfast. Check blood pressure twice weekly."
    )

    # Medicine 3: Atorvastatin 10mg (Moderate stock: 40%)
    start_med3 = today - datetime.timedelta(days=18)
    med3 = Medicine(
        name="Atorvastatin",
        strength="10 mg",
        dosage="1 tablet",
        route="Oral",
        frequency="Once Daily",
        timing_json=json.dumps(["night"]),
        food_instruction="after_food",
        duration_days=30,
        total_qty=30.0,
        remaining_qty=12.0,  # 40% stock
        start_date=start_med3.isoformat(),
        status="active",
        second_alert_sent=False,
        special_instructions="Take after dinner."
    )

    db.add_all([med1, med2, med3])
    db.commit()
    db.refresh(med1)
    db.refresh(med2)
    db.refresh(med3)

    print("Generating dose schedules...")
    generate_doses_for_medicine(db, med1, user, start_date=today)
    generate_doses_for_medicine(db, med2, user, start_date=today)
    generate_doses_for_medicine(db, med3, user, start_date=today)

    # Also seed a sample scan history record
    sample_scan = ScanHistory(
        type="pill",
        result_json=json.dumps({
            "probable_drug_name": "Dolo 650 (Paracetamol)",
            "active_ingredient": "Paracetamol 650mg",
            "strength": "650 mg",
            "medical_purpose": "Pain and fever relief",
            "expiry_status": "Valid",
            "confidence_score": 0.94,
            "reliability_level": "High"
        })
    )
    db.add(sample_scan)
    db.commit()

    # Check and trigger initial alerts (Metformin will generate 2nd course alert!)
    check_and_create_alerts(db, now)

    print("Seed complete! Created user, 3 medicines (1 with 15% stock), dose schedules, and 2nd course alert.")
    db.close()


if __name__ == "__main__":
    run_seed()
