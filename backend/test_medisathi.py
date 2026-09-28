import datetime
import json
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import User, Medicine, DoseLog, Alert
from backend.schemas import PrescriptionParseResponse, PillIdentifyResponse
from backend.schedule_engine import (
    compute_scheduled_datetime,
    generate_doses_for_medicine,
    evaluate_second_course_and_inventory,
    get_voice_alert_texts,
    check_and_create_alerts
)
from backend.ai_service import get_mock_prescription_result, get_mock_pill_result

# In-memory SQLite for test isolation
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=test_engine)


def test_schedule_generation(db_session):
    """Test dose schedule computation based on meal times."""
    user = User(
        name="Test Patient",
        meal_times_json=json.dumps({"breakfast": "08:30", "lunch": "13:00", "dinner": "20:30", "bedtime": "22:00"})
    )
    db_session.add(user)
    db_session.commit()

    med = Medicine(
        name="Metformin",
        strength="500 mg",
        dosage="1 tablet",
        timing_json=json.dumps(["morning", "night"]),
        food_instruction="after_food",
        duration_days=10,
        total_qty=20.0,
        remaining_qty=20.0,
        status="active"
    )
    db_session.add(med)
    db_session.commit()

    today = datetime.date(2026, 9, 28)
    generate_doses_for_medicine(db_session, med, user, start_date=today)

    doses = db_session.query(DoseLog).filter(DoseLog.medicine_id == med.id).all()
    # Generated across multiple days (yesterday, today, tomorrow, day+2)
    assert len(doses) >= 4

    # Check timing offset: after_food morning should be 08:30 + 20 mins = 08:50
    morning_time = compute_scheduled_datetime(today, "morning", "after_food", {"breakfast": "08:30"})
    assert morning_time.hour == 8
    assert morning_time.minute == 50


def test_days_remaining_calculation():
    """Test days remaining calculation and elapsed days."""
    now = datetime.datetime(2026, 9, 28, 12, 0, 0)
    # Started 10 days ago for a 30 day course
    med = Medicine(
        name="Amlodipine",
        duration_days=30,
        total_qty=30.0,
        remaining_qty=20.0,
        start_date=(now.date() - datetime.timedelta(days=10)).isoformat(),
        status="active"
    )
    inv = evaluate_second_course_and_inventory(med, now)
    assert inv["elapsed_days"] == 10
    assert inv["days_remaining"] == 20
    assert inv["percent_remaining"] == pytest.approx(66.7, 0.1)
    assert inv["status_color"] == "green"
    assert inv["is_second_course_alert"] is False


def test_twenty_percent_threshold_and_alert(db_session):
    """Test second course alert trigger when stock <= 20% or days remaining <= 2."""
    now = datetime.datetime(2026, 9, 28, 12, 0, 0)

    # 15% stock -> should trigger alert immediately!
    med_low_stock = Medicine(
        name="Metformin Low",
        duration_days=30,
        total_qty=60.0,
        remaining_qty=9.0,  # 15%
        start_date=(now.date() - datetime.timedelta(days=20)).isoformat(),
        status="active",
        second_alert_sent=False
    )
    db_session.add(med_low_stock)
    db_session.commit()

    inv = evaluate_second_course_and_inventory(med_low_stock, now)
    assert inv["percent_remaining"] == 15.0
    assert inv["status_color"] == "red"
    assert inv["is_second_course_alert"] is True

    # Run alert creation engine
    check_and_create_alerts(db_session, now)

    alerts = db_session.query(Alert).filter(Alert.medicine_id == med_low_stock.id).all()
    assert len(alerts) == 1
    assert "Second Course Required" in alerts[0].title
    assert med_low_stock.second_alert_sent is True


def test_json_parsing_ai_output():
    """Verify prescription and pill output formats match schema definitions."""
    rx_data = get_mock_prescription_result()
    parsed_rx = PrescriptionParseResponse(**rx_data)
    assert len(parsed_rx.medicines) == 3
    assert parsed_rx.medicines[0].name == "Metformin SR"
    assert parsed_rx.medicines[0].timing == ["morning", "night"]

    pill_data = get_mock_pill_result()
    parsed_pill = PillIdentifyResponse(**pill_data)
    assert "Dolo 650" in parsed_pill.probable_drug_name
    assert "AI identification can be wrong" in parsed_pill.safety_disclaimer
    assert parsed_pill.reliability_level == "High"


def test_regional_voice_templates():
    """Verify voice alerts are produced in English, Hindi, and Gujarati with food guidance."""
    alerts = get_voice_alert_texts("Metformin", "500 mg", "after_food")
    assert "It is time to take your Metformin 500 mg, after food." in alerts["en"]
    assert "Aapki Metformin 500 mg lene ka samay ho gaya hai" in alerts["hi"]
    assert "khana khane ke baad" in alerts["hi"]
    assert "Tamari Metformin 500 mg dava levano samay thai gayo chhe" in alerts["gu"]
    assert "jamya pachi" in alerts["gu"]
