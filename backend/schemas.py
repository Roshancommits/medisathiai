from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import datetime


# ---------- Settings Schemas ----------
class MealTimes(BaseModel):
    breakfast: str = Field(default="08:00", description="HH:MM format")
    lunch: str = Field(default="13:00", description="HH:MM format")
    dinner: str = Field(default="20:00", description="HH:MM format")
    bedtime: str = Field(default="22:00", description="HH:MM format")


class UserSettings(BaseModel):
    name: str = "Ramesh Patel"
    language: str = "en-IN"  # en-IN, hi-IN, gu-IN
    meal_times: MealTimes = Field(default_factory=MealTimes)
    voice_enabled: bool = True


class SettingsUpdate(BaseModel):
    name: Optional[str] = None
    language: Optional[str] = None
    meal_times: Optional[MealTimes] = None
    voice_enabled: Optional[bool] = None


# ---------- Medicine Schemas ----------
class ParsedMedicineItem(BaseModel):
    name: str
    strength: Optional[str] = "500 mg"
    dosage: str = "1 tablet"
    route: str = "Oral"
    frequency: str = "Twice Daily"
    timing: List[str] = Field(default=["morning", "night"], description="e.g. ['morning', 'afternoon', 'evening', 'night']")
    food_instruction: str = Field(default="after_food", description="before_food, after_food, with_food, anytime")
    duration_days: int = 15
    total_qty: float = 30.0
    special_instructions: Optional[str] = None
    confidence: float = 0.95
    confidence_flags: List[str] = Field(default_factory=list)


class PrescriptionParseResponse(BaseModel):
    medicines: List[ParsedMedicineItem]
    doctor_name: Optional[str] = None
    date: Optional[str] = None
    raw_summary: Optional[str] = None
    confidence_score: float = 0.92
    is_demo_mode: bool = False


class MedicineCreate(BaseModel):
    name: str
    strength: Optional[str] = None
    dosage: str = "1 tablet"
    route: str = "Oral"
    frequency: str = "Once Daily"
    timing: List[str] = Field(default=["morning"])
    food_instruction: str = "after_food"
    duration_days: int = 30
    total_qty: float = 30.0
    remaining_qty: Optional[float] = None
    start_date: Optional[str] = None
    special_instructions: Optional[str] = None


class MedicineUpdate(BaseModel):
    name: Optional[str] = None
    strength: Optional[str] = None
    dosage: Optional[str] = None
    route: Optional[str] = None
    frequency: Optional[str] = None
    timing: Optional[List[str]] = None
    food_instruction: Optional[str] = None
    duration_days: Optional[int] = None
    total_qty: Optional[float] = None
    remaining_qty: Optional[float] = None
    start_date: Optional[str] = None
    status: Optional[str] = None
    special_instructions: Optional[str] = None


class MedicineResponse(BaseModel):
    id: int
    name: str
    strength: Optional[str]
    dosage: str
    route: str
    frequency: str
    timing: List[str]
    food_instruction: str
    duration_days: int
    total_qty: float
    remaining_qty: float
    start_date: str
    status: str
    second_alert_sent: bool
    special_instructions: Optional[str]

    class Config:
        from_attributes = True


# ---------- Schedule / Dose Schemas ----------
class DoseItem(BaseModel):
    id: int
    medicine_id: int
    medicine_name: str
    strength: Optional[str]
    dosage: str
    food_instruction: str
    route: str
    scheduled_at: str
    taken_at: Optional[str]
    status: str  # Upcoming, Due, Taken, Missed, Snoozed
    period: str  # Morning, Afternoon, Evening, Night
    is_due: bool
    voice_alert_text: Dict[str, str]  # en, hi, gu


class TodayScheduleResponse(BaseModel):
    current_time: str
    simulated_offset_minutes: int
    morning: List[DoseItem]
    afternoon: List[DoseItem]
    evening: List[DoseItem]
    night: List[DoseItem]
    summary: Dict[str, int]  # total, taken, due, missed, upcoming


class DoseActionResponse(BaseModel):
    success: bool
    message: str
    dose_id: int
    new_status: str
    remaining_qty: Optional[float] = None
    second_course_alert: bool = False


# ---------- Inventory Schemas ----------
class InventoryItem(BaseModel):
    id: int
    name: str
    strength: Optional[str]
    dosage: str
    total_qty: float
    remaining_qty: float
    duration_days: int
    elapsed_days: int
    days_remaining: int
    percent_remaining: float
    status_color: str  # green, amber, red
    is_second_course_alert: bool
    start_date: str
    second_alert_sent: bool


# ---------- Alert Schemas ----------
class AlertItem(BaseModel):
    id: int
    type: str
    medicine_id: Optional[int]
    medicine_name: Optional[str] = None
    title: str
    message: str
    created_at: str
    acknowledged: bool


# ---------- Pill Scanner Schemas ----------
class PillIdentifyResponse(BaseModel):
    probable_drug_name: str
    active_ingredient: Optional[str] = None
    strength: Optional[str] = None
    medical_purpose: str
    general_dosage: str
    expiry_status: str  # Valid, Expired, Not visible
    confidence_score: float
    reliability_level: str  # High, Medium, Low
    imprint_code: Optional[str] = None
    color: Optional[str] = None
    shape: Optional[str] = None
    alternative_possibilities: List[str] = Field(default_factory=list)
    safety_disclaimer: str
    is_demo_mode: bool = False


class ScanHistoryItem(BaseModel):
    id: int
    type: str
    created_at: str
    result: Dict[str, Any]


# ---------- Time Simulation & Utility Schemas ----------
class SimulateTimeRequest(BaseModel):
    minutes_forward: int = Field(default=30, description="Minutes to advance virtual clock")
    reset: bool = Field(default=False, description="Reset to real system clock")


class RefillRequest(BaseModel):
    quantity_to_add: float = Field(default=30.0, gt=0)
