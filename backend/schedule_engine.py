import json
import datetime
from typing import Dict, List, Tuple, Any
from sqlalchemy.orm import Session
from backend.models import Medicine, DoseLog, User, Alert

# Global simulated offset in minutes for demonstration purposes
SIMULATED_OFFSET_MINUTES = 0


def get_simulated_offset() -> int:
    return SIMULATED_OFFSET_MINUTES


def set_simulated_offset(minutes: int, reset: bool = False) -> int:
    global SIMULATED_OFFSET_MINUTES
    if reset:
        SIMULATED_OFFSET_MINUTES = 0
    else:
        SIMULATED_OFFSET_MINUTES += minutes
    return SIMULATED_OFFSET_MINUTES


def get_current_time() -> datetime.datetime:
    """Returns system now adjusted by simulated offset."""
    return datetime.datetime.now() + datetime.timedelta(minutes=SIMULATED_OFFSET_MINUTES)


def parse_time_str(time_str: str) -> datetime.time:
    """Parses 'HH:MM' string to datetime.time."""
    parts = time_str.strip().split(":")
    hour = int(parts[0])
    minute = int(parts[1]) if len(parts) > 1 else 0
    return datetime.time(hour=hour, minute=minute)


def compute_scheduled_datetime(
    target_date: datetime.date,
    timing_slot: str,
    food_instruction: str,
    meal_times: Dict[str, str]
) -> datetime.datetime:
    """Calculates specific datetime for a timing slot (morning, afternoon, evening, night)."""
    breakfast_time = parse_time_str(meal_times.get("breakfast", "08:00"))
    lunch_time = parse_time_str(meal_times.get("lunch", "13:00"))
    dinner_time = parse_time_str(meal_times.get("dinner", "20:00"))
    bedtime_time = parse_time_str(meal_times.get("bedtime", "22:00"))

    slot = timing_slot.lower().strip()
    if slot == "morning":
        base_dt = datetime.datetime.combine(target_date, breakfast_time)
        if food_instruction == "before_food":
            return base_dt - datetime.timedelta(minutes=30)
        elif food_instruction == "after_food":
            return base_dt + datetime.timedelta(minutes=20)
        return base_dt

    elif slot == "afternoon":
        base_dt = datetime.datetime.combine(target_date, lunch_time)
        if food_instruction == "before_food":
            return base_dt - datetime.timedelta(minutes=30)
        elif food_instruction == "after_food":
            return base_dt + datetime.timedelta(minutes=20)
        return base_dt

    elif slot == "evening":
        # 17:30 default
        return datetime.datetime.combine(target_date, datetime.time(hour=17, minute=30))

    elif slot == "night":
        base_dt = datetime.datetime.combine(target_date, dinner_time)
        if food_instruction == "before_food":
            return base_dt - datetime.timedelta(minutes=30)
        elif food_instruction == "after_food":
            return base_dt + datetime.timedelta(minutes=20)
        elif food_instruction == "bedtime":
            return datetime.datetime.combine(target_date, bedtime_time)
        return base_dt

    # Default fallback
    return datetime.datetime.combine(target_date, datetime.time(hour=9, minute=0))


def generate_doses_for_medicine(
    db: Session,
    medicine: Medicine,
    user: User,
    start_date: datetime.date = None
):
    """Generates DoseLog records for today and upcoming days for this medicine."""
    if not start_date:
        start_date = datetime.date.today()

    meal_times = json.loads(user.meal_times_json or "{}")
    timings = json.loads(medicine.timing_json or "[]")

    # Generate doses for 3 days (yesterday, today, tomorrow) for rich UI demonstration
    for day_offset in range(-1, 3):
        cur_date = start_date + datetime.timedelta(days=day_offset)
        for slot in timings:
            dt = compute_scheduled_datetime(cur_date, slot, medicine.food_instruction, meal_times)
            iso_str = dt.strftime("%Y-%m-%dT%H:%M:%S")

            # Check if already exists
            existing = db.query(DoseLog).filter(
                DoseLog.medicine_id == medicine.id,
                DoseLog.scheduled_at == iso_str
            ).first()

            if not existing:
                # If in the past (yesterday), mark as Taken or Missed
                status = "Upcoming"
                now = get_current_time()
                if dt < now - datetime.timedelta(minutes=30):
                    status = "Taken" if day_offset == -1 else "Missed"
                elif dt <= now:
                    status = "Due"

                dose = DoseLog(
                    medicine_id=medicine.id,
                    scheduled_at=iso_str,
                    status=status
                )
                db.add(dose)
    db.commit()


def get_voice_alert_texts(medicine_name: str, strength: str, food_instruction: str) -> Dict[str, str]:
    """Generates natural, spoken voice alert templates in English, Hindi, and Gujarati."""
    food_en = {
        "before_food": "before food",
        "after_food": "after food",
        "with_food": "with food",
        "anytime": "as prescribed"
    }.get(food_instruction, "after food")

    food_hi = {
        "before_food": "khana khane se aadha ghanta pehle",
        "after_food": "khana khane ke baad",
        "with_food": "khane ke saath",
        "anytime": "samay par"
    }.get(food_instruction, "khana khane ke baad")

    food_gu = {
        "before_food": "jamya pahela",
        "after_food": "jamya pachi",
        "with_food": "jamvani saathe",
        "anytime": "samay sar"
    }.get(food_instruction, "jamya pachi")

    med_display = f"{medicine_name} {strength or ''}".strip()

    return {
        "en": f"It is time to take your {med_display}, {food_en}.",
        "hi": f"Aapki {med_display} lene ka samay ho gaya hai. Kripya {food_hi} lijiye.",
        "gu": f"Tamari {med_display} dava levano samay thai gayo chhe. Krupya {food_gu} lo."
    }


def compute_dose_status(dose: DoseLog, now: datetime.datetime) -> Tuple[str, bool]:
    """Calculates live status: Taken, Snoozed, Due, Missed, or Upcoming."""
    if dose.status == "Taken":
        return "Taken", False

    # Check snooze
    if dose.snooze_until:
        try:
            snooze_dt = datetime.datetime.fromisoformat(dose.snooze_until)
            if now < snooze_dt:
                return "Snoozed", False
        except Exception:
            pass

    sched_dt = datetime.datetime.fromisoformat(dose.scheduled_at)
    diff_minutes = (now - sched_dt).total_seconds() / 60.0

    # Overdue by > 30 minutes -> Missed
    if diff_minutes > 30:
        return "Missed", False
    # Due window: from 15 minutes before scheduled time until 30 minutes after
    elif diff_minutes >= -15:
        return "Due", True
    else:
        return "Upcoming", False


def evaluate_second_course_and_inventory(medicine: Medicine, now: datetime.datetime) -> Dict[str, Any]:
    """Calculates days remaining, elapsed days, percentage remaining and second course trigger."""
    try:
        start = datetime.date.fromisoformat(medicine.start_date)
    except Exception:
        start = now.date()

    elapsed_days = max(0, (now.date() - start).days)
    days_remaining = max(0, medicine.duration_days - elapsed_days)

    total = float(medicine.total_qty) if medicine.total_qty else 1.0
    remaining = float(medicine.remaining_qty) if medicine.remaining_qty is not None else 0.0
    percent = round((remaining / total) * 100.0, 1)

    # Color status
    if percent > 50.0:
        color = "green"
    elif percent >= 20.0:
        color = "amber"
    else:
        color = "red"

    # Second Course Alert condition:
    # stock <= 20% OR days remaining <= 2
    is_second_course = (percent <= 20.0 or days_remaining <= 2) and medicine.status == "active"

    return {
        "elapsed_days": elapsed_days,
        "days_remaining": days_remaining,
        "percent_remaining": percent,
        "status_color": color,
        "is_second_course_alert": is_second_course
    }


def check_and_create_alerts(db: Session, now: datetime.datetime):
    """Scans active medicines and creates 2nd course alert if threshold met and not yet created."""
    medicines = db.query(Medicine).filter(Medicine.status == "active").all()
    for med in medicines:
        inv = evaluate_second_course_and_inventory(med, now)
        if inv["is_second_course_alert"] and not med.second_alert_sent:
            alert = Alert(
                type="second_course",
                medicine_id=med.id,
                title=f"Second Course Required: {med.name}",
                message=f"Only {med.remaining_qty:g} pills ({inv['percent_remaining']}%) remaining. Course ends in {inv['days_remaining']} days. Please re-order or book doctor follow-up.",
                acknowledged=False
            )
            med.second_alert_sent = True
            db.add(alert)
    db.commit()
