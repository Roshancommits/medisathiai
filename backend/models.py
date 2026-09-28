import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), default="Ramesh Patel")
    language = Column(String(10), default="en-IN")  # en-IN, hi-IN, gu-IN
    # JSON dict of meal times, e.g. {"breakfast": "08:00", "lunch": "13:00", "dinner": "20:00", "bedtime": "22:00"}
    meal_times_json = Column(Text, default='{"breakfast":"08:00","lunch":"13:00","dinner":"20:00","bedtime":"22:00"}')
    voice_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    strength = Column(String(50), nullable=True)  # e.g., "500 mg"
    dosage = Column(String(50), default="1 tablet")  # e.g., "1 tablet"
    route = Column(String(50), default="Oral")  # Oral, Topical, Inhalation
    frequency = Column(String(50), default="Twice Daily")
    # JSON list of timings: ["morning", "night"]
    timing_json = Column(Text, default='["morning"]')
    # "before_food", "after_food", "with_food", "anytime"
    food_instruction = Column(String(50), default="after_food")
    duration_days = Column(Integer, default=30)
    total_qty = Column(Float, default=30.0)
    remaining_qty = Column(Float, default=30.0)
    start_date = Column(String(20), default=lambda: datetime.date.today().isoformat())
    status = Column(String(20), default="active")  # active, completed, stopped
    second_alert_sent = Column(Boolean, default=False)
    special_instructions = Column(Text, nullable=True)

    # Relationships
    doses = relationship("DoseLog", back_populates="medicine", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="medicine", cascade="all, delete-orphan")


class DoseLog(Base):
    __tablename__ = "dose_logs"

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    # ISO string YYYY-MM-DDTHH:MM:SS
    scheduled_at = Column(String(30), nullable=False, index=True)
    taken_at = Column(String(30), nullable=True)
    # Upcoming, Due, Taken, Missed, Snoozed
    status = Column(String(20), default="Upcoming", index=True)
    snooze_until = Column(String(30), nullable=True)
    repeat_count = Column(Integer, default=0)

    medicine = relationship("Medicine", back_populates="doses")


class ScanHistory(Base):
    __tablename__ = "scan_history"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(30), default="prescription")  # prescription, pill
    image_url = Column(Text, nullable=True)
    # JSON string containing the full parsed structure
    result_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(50), nullable=False)  # second_course, missed_dose, low_stock
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=True)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    acknowledged = Column(Boolean, default=False)

    medicine = relationship("Medicine", back_populates="alerts")
