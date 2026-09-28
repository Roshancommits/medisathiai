import os
import json
import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database import engine, Base, get_db
from backend.models import User, Medicine, DoseLog, ScanHistory, Alert
from backend.schemas import (
    PrescriptionParseResponse,
    MedicineCreate,
    MedicineUpdate,
    MedicineResponse,
    TodayScheduleResponse,
    DoseItem,
    DoseActionResponse,
    InventoryItem,
    AlertItem,
    PillIdentifyResponse,
    ScanHistoryItem,
    UserSettings,
    SettingsUpdate,
    SimulateTimeRequest,
    RefillRequest
)
from backend.ai_service import parse_prescription_image, identify_pill_image, is_demo_mode, GEMINI_MODEL, set_gemini_api_key
from backend.schedule_engine import (
    get_current_time,
    get_simulated_offset,
    set_simulated_offset,
    generate_doses_for_medicine,
    compute_dose_status,
    get_voice_alert_texts,
    evaluate_second_course_and_inventory,
    check_and_create_alerts
)
from backend.seed import run_seed

# Initialize Database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MediSathi AI API",
    description="Software-only AI medical companion for elderly patients and caregivers",
    version="1.0.0"
)

# Enable CORS for frontend Vite dev server (and all origins for local demo)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    # If no users exist, run the seed script automatically
    db = next(get_db())
    try:
        user = db.query(User).first()
        if not user:
            print("No existing user found. Running initial database seed...")
            run_seed()
    finally:
        db.close()


# ---------------- HEALTH & STATUS ----------------
@app.get("/api/health")
def health_check():
    now = get_current_time()
    return {
        "status": "healthy",
        "app": "MediSathi AI",
        "current_time": now.isoformat(),
        "simulated_offset_minutes": get_simulated_offset(),
        "is_demo_mode": is_demo_mode(),
        "gemini_model": GEMINI_MODEL
    }


# ---------------- SETTINGS ----------------
@app.get("/api/settings", response_model=UserSettings)
def get_settings(db: Session = Depends(get_db)):
    user = db.query(User).first()
    if not user:
        run_seed()
        user = db.query(User).first()
    meals = json.loads(user.meal_times_json or "{}")
    return UserSettings(
        name=user.name,
        language=user.language,
        meal_times=meals,
        voice_enabled=user.voice_enabled
    )


@app.put("/api/settings", response_model=UserSettings)
def update_settings(update: SettingsUpdate, db: Session = Depends(get_db)):
    user = db.query(User).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if update.name is not None:
        user.name = update.name
    if update.language is not None:
        user.language = update.language
    if update.voice_enabled is not None:
        user.voice_enabled = update.voice_enabled
    if update.meal_times is not None:
        user.meal_times_json = json.dumps(update.meal_times.model_dump())
        # Regenerate dose schedule with new meal times
        medicines = db.query(Medicine).filter(Medicine.status == "active").all()
        for med in medicines:
            generate_doses_for_medicine(db, med, user, start_date=get_current_time().date())

    db.commit()
    db.refresh(user)
    return UserSettings(
        name=user.name,
        language=user.language,
        meal_times=json.loads(user.meal_times_json or "{}"),
        voice_enabled=user.voice_enabled
    )


class ApiKeyRequest(BaseModel):
    api_key: str


@app.post("/api/settings/api-key")
def update_api_key(req: ApiKeyRequest):
    success = set_gemini_api_key(req.api_key)
    return {
        "success": success,
        "is_demo_mode": is_demo_mode(),
        "gemini_model": GEMINI_MODEL,
        "message": "Gemini API key updated successfully." if success else "Failed to configure Gemini API."
    }


# ---------------- TIME SIMULATION DEV TOOL ----------------
@app.post("/api/simulate-time")
def simulate_time(req: SimulateTimeRequest, db: Session = Depends(get_db)):
    """Dev tool to advance virtual time or reset to current system time."""
    new_offset = set_simulated_offset(req.minutes_forward, reset=req.reset)
    now = get_current_time()
    # Re-evaluate missed doses and second course alerts
    check_and_create_alerts(db, now)
    return {
        "success": True,
        "simulated_offset_minutes": new_offset,
        "current_simulated_time": now.isoformat(),
        "formatted_display": now.strftime("%I:%M %p, %d %b %Y")
    }


# ---------------- SEED ACTION ----------------
@app.post("/api/seed")
def trigger_seed():
    """Reset database with realistic demo dataset."""
    run_seed()
    return {"success": True, "message": "Demo data seeded successfully with 3 medicines and active 2nd-course alert."}


# ---------------- FEATURE 1: PRESCRIPTION OCR & PARSING ----------------
@app.post("/api/prescription/parse", response_model=PrescriptionParseResponse)
async def parse_prescription(
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Parses a prescription image via Gemini multimodal or fallback realistic mock engine.
    Logs result to ScanHistory.
    """
    image_bytes = b""
    mime_type = "image/jpeg"
    if file:
        image_bytes = await file.read()
        mime_type = file.content_type or "image/jpeg"

    # Call AI Service
    parsed_result = parse_prescription_image(image_bytes, mime_type)

    # Save to ScanHistory
    history = ScanHistory(
        type="prescription",
        result_json=json.dumps(parsed_result)
    )
    db.add(history)
    db.commit()

    return PrescriptionParseResponse(**parsed_result)


# ---------------- MEDICINES MANAGEMENT ----------------
@app.post("/api/medicines", response_model=MedicineResponse)
def create_medicine(med_in: MedicineCreate, db: Session = Depends(get_db)):
    user = db.query(User).first()
    if not user:
        run_seed()
        user = db.query(User).first()

    now = get_current_time()
    start_date = med_in.start_date or now.date().isoformat()
    remaining_qty = med_in.remaining_qty if med_in.remaining_qty is not None else med_in.total_qty

    med = Medicine(
        name=med_in.name,
        strength=med_in.strength,
        dosage=med_in.dosage,
        route=med_in.route,
        frequency=med_in.frequency,
        timing_json=json.dumps(med_in.timing),
        food_instruction=med_in.food_instruction,
        duration_days=med_in.duration_days,
        total_qty=med_in.total_qty,
        remaining_qty=remaining_qty,
        start_date=start_date,
        status="active",
        second_alert_sent=False,
        special_instructions=med_in.special_instructions
    )
    db.add(med)
    db.commit()
    db.refresh(med)

    # Auto-generate Dose Schedule
    generate_doses_for_medicine(db, med, user, start_date=now.date())

    # Check if stock already qualifies for alert
    check_and_create_alerts(db, now)

    return MedicineResponse(
        id=med.id,
        name=med.name,
        strength=med.strength,
        dosage=med.dosage,
        route=med.route,
        frequency=med.frequency,
        timing=json.loads(med.timing_json or "[]"),
        food_instruction=med.food_instruction,
        duration_days=med.duration_days,
        total_qty=med.total_qty,
        remaining_qty=med.remaining_qty,
        start_date=med.start_date,
        status=med.status,
        second_alert_sent=med.second_alert_sent,
        special_instructions=med.special_instructions
    )


@app.get("/api/medicines", response_model=List[MedicineResponse])
def get_medicines(db: Session = Depends(get_db)):
    meds = db.query(Medicine).order_by(Medicine.id.desc()).all()
    out = []
    for m in meds:
        out.append(MedicineResponse(
            id=m.id,
            name=m.name,
            strength=m.strength,
            dosage=m.dosage,
            route=m.route,
            frequency=m.frequency,
            timing=json.loads(m.timing_json or "[]"),
            food_instruction=m.food_instruction,
            duration_days=m.duration_days,
            total_qty=m.total_qty,
            remaining_qty=m.remaining_qty,
            start_date=m.start_date,
            status=m.status,
            second_alert_sent=m.second_alert_sent,
            special_instructions=m.special_instructions
        ))
    return out


@app.patch("/api/medicines/{medicine_id}", response_model=MedicineResponse)
def update_medicine(medicine_id: int, update: MedicineUpdate, db: Session = Depends(get_db)):
    med = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")

    if update.name is not None:
        med.name = update.name
    if update.strength is not None:
        med.strength = update.strength
    if update.dosage is not None:
        med.dosage = update.dosage
    if update.route is not None:
        med.route = update.route
    if update.frequency is not None:
        med.frequency = update.frequency
    if update.timing is not None:
        med.timing_json = json.dumps(update.timing)
    if update.food_instruction is not None:
        med.food_instruction = update.food_instruction
    if update.duration_days is not None:
        med.duration_days = update.duration_days
    if update.total_qty is not None:
        med.total_qty = update.total_qty
    if update.remaining_qty is not None:
        # If refilled, reset second_alert_sent so future low stock can notify again
        if update.remaining_qty > med.remaining_qty and (update.remaining_qty / med.total_qty) > 0.20:
            med.second_alert_sent = False
        med.remaining_qty = update.remaining_qty
    if update.status is not None:
        med.status = update.status
    if update.special_instructions is not None:
        med.special_instructions = update.special_instructions

    db.commit()
    db.refresh(med)

    now = get_current_time()
    user = db.query(User).first()
    if update.timing is not None and user:
        generate_doses_for_medicine(db, med, user, start_date=now.date())
    check_and_create_alerts(db, now)

    return MedicineResponse(
        id=med.id,
        name=med.name,
        strength=med.strength,
        dosage=med.dosage,
        route=med.route,
        frequency=med.frequency,
        timing=json.loads(med.timing_json or "[]"),
        food_instruction=med.food_instruction,
        duration_days=med.duration_days,
        total_qty=med.total_qty,
        remaining_qty=med.remaining_qty,
        start_date=med.start_date,
        status=med.status,
        second_alert_sent=med.second_alert_sent,
        special_instructions=med.special_instructions
    )


# ---------------- FEATURE 2: SCHEDULE & VOICE ALERTS ----------------
@app.get("/api/schedule/today", response_model=TodayScheduleResponse)
def get_today_schedule(db: Session = Depends(get_db)):
    """
    Returns today's doses grouped by period (Morning, Afternoon, Evening, Night),
    evaluating live status (Upcoming, Due, Taken, Missed, Snoozed) against virtual clock.
    """
    now = get_current_time()
    today_str = now.date().isoformat()

    # Query doses for today
    doses = (
        db.query(DoseLog)
        .join(Medicine, DoseLog.medicine_id == Medicine.id)
        .filter(Medicine.status == "active", DoseLog.scheduled_at.startswith(today_str))
        .order_by(DoseLog.scheduled_at.asc())
        .all()
    )

    morning, afternoon, evening, night = [], [], [], []
    summary = {"total": 0, "taken": 0, "due": 0, "missed": 0, "upcoming": 0}

    for d in doses:
        med = d.medicine
        status, is_due = compute_dose_status(d, now)

        # Update persisted status if changed to Missed
        if status == "Missed" and d.status != "Missed":
            d.status = "Missed"
            db.commit()

        sched_dt = datetime.datetime.fromisoformat(d.scheduled_at)
        hour = sched_dt.hour
        if hour < 12:
            period = "Morning"
        elif hour < 16:
            period = "Afternoon"
        elif hour < 20:
            period = "Evening"
        else:
            period = "Night"

        voice_texts = get_voice_alert_texts(med.name, med.strength, med.food_instruction)

        item = DoseItem(
            id=d.id,
            medicine_id=med.id,
            medicine_name=med.name,
            strength=med.strength,
            dosage=med.dosage,
            food_instruction=med.food_instruction,
            route=med.route,
            scheduled_at=d.scheduled_at,
            taken_at=d.taken_at,
            status=status,
            period=period,
            is_due=is_due,
            voice_alert_text=voice_texts
        )

        summary["total"] += 1
        if status == "Taken":
            summary["taken"] += 1
        elif status == "Due":
            summary["due"] += 1
        elif status == "Missed":
            summary["missed"] += 1
        else:
            summary["upcoming"] += 1

        if period == "Morning":
            morning.append(item)
        elif period == "Afternoon":
            afternoon.append(item)
        elif period == "Evening":
            evening.append(item)
        else:
            night.append(item)

    return TodayScheduleResponse(
        current_time=now.isoformat(),
        simulated_offset_minutes=get_simulated_offset(),
        morning=morning,
        afternoon=afternoon,
        evening=evening,
        night=night,
        summary=summary
    )


@app.post("/api/doses/{dose_id}/taken", response_model=DoseActionResponse)
def mark_dose_taken(dose_id: int, db: Session = Depends(get_db)):
    """Logs dose as Taken, records timestamp, and decrements stock."""
    dose = db.query(DoseLog).filter(DoseLog.id == dose_id).first()
    if not dose:
        raise HTTPException(status_code=404, detail="Dose not found")

    now = get_current_time()
    dose.status = "Taken"
    dose.taken_at = now.isoformat()
    dose.snooze_until = None

    med = dose.medicine
    # Decrement remaining quantity
    if med.remaining_qty > 0:
        med.remaining_qty = max(0.0, med.remaining_qty - 1.0)

    db.commit()
    db.refresh(med)

    # Check for second course alert condition
    check_and_create_alerts(db, now)
    inv = evaluate_second_course_and_inventory(med, now)

    return DoseActionResponse(
        success=True,
        message=f"{med.name} dose logged as Taken.",
        dose_id=dose.id,
        new_status="Taken",
        remaining_qty=med.remaining_qty,
        second_course_alert=inv["is_second_course_alert"]
    )


@app.post("/api/doses/{dose_id}/snooze", response_model=DoseActionResponse)
def snooze_dose(dose_id: int, db: Session = Depends(get_db)):
    """Snoozes dose for 10 minutes and increments repeat counter."""
    dose = db.query(DoseLog).filter(DoseLog.id == dose_id).first()
    if not dose:
        raise HTTPException(status_code=404, detail="Dose not found")

    now = get_current_time()
    snooze_dt = now + datetime.timedelta(minutes=10)
    dose.snooze_until = snooze_dt.isoformat()
    dose.repeat_count = (dose.repeat_count or 0) + 1
    db.commit()

    return DoseActionResponse(
        success=True,
        message=f"Dose snoozed for 10 minutes until {snooze_dt.strftime('%I:%M %p')}.",
        dose_id=dose.id,
        new_status="Snoozed"
    )


# ---------------- FEATURE 3: INVENTORY & 2ND COURSE ALERTS ----------------
@app.get("/api/inventory", response_model=List[InventoryItem])
def get_inventory(db: Session = Depends(get_db)):
    """Returns inventory status with Days Remaining, % Remaining, and 2nd Course Alert flag."""
    now = get_current_time()
    check_and_create_alerts(db, now)

    meds = db.query(Medicine).filter(Medicine.status == "active").order_by(Medicine.name.asc()).all()
    results = []
    for m in meds:
        eval_res = evaluate_second_course_and_inventory(m, now)
        results.append(InventoryItem(
            id=m.id,
            name=m.name,
            strength=m.strength,
            dosage=m.dosage,
            total_qty=m.total_qty,
            remaining_qty=m.remaining_qty,
            duration_days=m.duration_days,
            elapsed_days=eval_res["elapsed_days"],
            days_remaining=eval_res["days_remaining"],
            percent_remaining=eval_res["percent_remaining"],
            status_color=eval_res["status_color"],
            is_second_course_alert=eval_res["is_second_course_alert"],
            start_date=m.start_date,
            second_alert_sent=m.second_alert_sent
        ))
    return results


@app.post("/api/medicines/{medicine_id}/refill", response_model=InventoryItem)
def refill_medicine(medicine_id: int, req: RefillRequest, db: Session = Depends(get_db)):
    """Refills stock for a medicine and resets second alert status."""
    med = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")

    med.remaining_qty += req.quantity_to_add
    med.total_qty = max(med.total_qty, med.remaining_qty)
    med.second_alert_sent = False
    # If there were active unacknowledged second_course alerts, acknowledge them
    alerts = db.query(Alert).filter(Alert.medicine_id == med.id, Alert.acknowledged == False).all()
    for a in alerts:
        a.acknowledged = True

    db.commit()
    db.refresh(med)

    now = get_current_time()
    eval_res = evaluate_second_course_and_inventory(med, now)
    return InventoryItem(
        id=med.id,
        name=med.name,
        strength=med.strength,
        dosage=med.dosage,
        total_qty=med.total_qty,
        remaining_qty=med.remaining_qty,
        duration_days=med.duration_days,
        elapsed_days=eval_res["elapsed_days"],
        days_remaining=eval_res["days_remaining"],
        percent_remaining=eval_res["percent_remaining"],
        status_color=eval_res["status_color"],
        is_second_course_alert=eval_res["is_second_course_alert"],
        start_date=med.start_date,
        second_alert_sent=med.second_alert_sent
    )


@app.get("/api/alerts", response_model=List[AlertItem])
def get_alerts(db: Session = Depends(get_db)):
    """Returns active unacknowledged alerts."""
    now = get_current_time()
    check_and_create_alerts(db, now)

    alerts = db.query(Alert).order_by(Alert.created_at.desc()).all()
    out = []
    for a in alerts:
        out.append(AlertItem(
            id=a.id,
            type=a.type,
            medicine_id=a.medicine_id,
            medicine_name=a.medicine.name if a.medicine else None,
            title=a.title,
            message=a.message,
            created_at=a.created_at.isoformat() if a.created_at else now.isoformat(),
            acknowledged=a.acknowledged
        ))
    return out


@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    db.commit()
    return {"success": True}


@app.get("/api/calendar/followup.ics")
def download_doctor_calendar_event(medicine_name: Optional[str] = "Prescription Refill"):
    """
    Generates standard .ics calendar invite for booking doctor follow-up consultation.
    """
    now = get_current_time()
    appt_start = now + datetime.timedelta(days=2, hours=10 - now.hour)
    appt_end = appt_start + datetime.timedelta(minutes=30)

    start_str = appt_start.strftime("%Y%m%dT%H%M%SZ")
    end_str = appt_end.strftime("%Y%m%dT%H%M%SZ")
    stamp_str = now.strftime("%Y%m%dT%H%M%SZ")

    ics_content = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MediSathi AI//Doctor Appointment//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:medisathi-{now.timestamp()}@medisathi.ai
DTSTAMP:{stamp_str}
DTSTART:{start_str}
DTEND:{end_str}
SUMMARY:Dr. Follow-up: 2nd Course Consultation ({medicine_name})
DESCRIPTION:Follow-up doctor appointment generated by MediSathi AI for second course refill review of {medicine_name}.
LOCATION:Clinic / Teleconsultation
STATUS:CONFIRMED
BEGIN:VALARM
TRIGGER:-PT2H
ACTION:DISPLAY
DESCRIPTION:Reminder: Doctor Follow-up Appointment in 2 hours
END:VALARM
END:VEVENT
END:VCALENDAR
"""
    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={"Content-Disposition": f"attachment; filename=Doctor_Followup_{medicine_name}.ics"}
    )


# ---------------- FEATURE 4: VISUAL PILL & STRIP SCANNER ----------------
@app.post("/api/pill/identify", response_model=PillIdentifyResponse)
async def identify_pill(
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Inspects image of loose pill or blister strip using Gemini Vision AI.
    Returns probable drug name, active ingredient, dosage, expiry status, and safety disclaimer.
    """
    image_bytes = b""
    mime_type = "image/jpeg"
    if file:
        image_bytes = await file.read()
        mime_type = file.content_type or "image/jpeg"

    result = identify_pill_image(image_bytes, mime_type)

    # Save to scan history
    scan = ScanHistory(
        type="pill",
        result_json=json.dumps(result)
    )
    db.add(scan)
    db.commit()

    return PillIdentifyResponse(**result)


@app.get("/api/scans", response_model=List[ScanHistoryItem])
def get_scans(db: Session = Depends(get_db)):
    scans = db.query(ScanHistory).order_by(ScanHistory.created_at.desc()).limit(20).all()
    out = []
    for s in scans:
        try:
            res_dict = json.loads(s.result_json)
        except Exception:
            res_dict = {}
        out.append(ScanHistoryItem(
            id=s.id,
            type=s.type,
            created_at=s.created_at.isoformat() if s.created_at else "",
            result=res_dict
        ))
    return out
