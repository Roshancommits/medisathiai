export type Language = 'en-IN' | 'hi-IN' | 'gu-IN';

export interface MealTimes {
  breakfast: string;
  lunch: string;
  dinner: string;
  bedtime: string;
}

export interface UserSettings {
  name: string;
  language: Language;
  meal_times: MealTimes;
  voice_enabled: boolean;
}

export interface DoseItem {
  id: number;
  medicine_id: number;
  medicine_name: string;
  strength: string | null;
  dosage: string;
  food_instruction: string;
  route: string;
  scheduled_at: string;
  taken_at: string | null;
  status: 'Upcoming' | 'Due' | 'Taken' | 'Missed' | 'Snoozed';
  period: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  is_due: boolean;
  voice_alert_text: {
    en: string;
    hi: string;
    gu: string;
  };
}

export interface TodayScheduleResponse {
  current_time: string;
  simulated_offset_minutes: number;
  morning: DoseItem[];
  afternoon: DoseItem[];
  evening: DoseItem[];
  night: DoseItem[];
  summary: {
    total: number;
    taken: number;
    due: number;
    missed: number;
    upcoming: number;
  };
}

export interface ParsedMedicineItem {
  name: string;
  strength?: string;
  dosage: string;
  route: string;
  frequency: string;
  timing: string[];
  food_instruction: string;
  duration_days: number;
  total_qty: number;
  special_instructions?: string;
  confidence: number;
  confidence_flags: string[];
}

export interface PrescriptionParseResponse {
  medicines: ParsedMedicineItem[];
  doctor_name?: string;
  date?: string;
  raw_summary?: string;
  confidence_score: number;
  is_demo_mode: boolean;
}

export interface Medicine {
  id: number;
  name: string;
  strength: string | null;
  dosage: string;
  route: string;
  frequency: string;
  timing: string[];
  food_instruction: string;
  duration_days: number;
  total_qty: number;
  remaining_qty: number;
  start_date: string;
  status: string;
  second_alert_sent: boolean;
  special_instructions: string | null;
}

export interface InventoryItem {
  id: number;
  name: string;
  strength: string | null;
  dosage: string;
  total_qty: number;
  remaining_qty: number;
  duration_days: number;
  elapsed_days: number;
  days_remaining: number;
  percent_remaining: number;
  status_color: 'green' | 'amber' | 'red';
  is_second_course_alert: boolean;
  start_date: string;
  second_alert_sent: boolean;
}

export interface AlertItem {
  id: number;
  type: string;
  medicine_id: number | null;
  medicine_name?: string | null;
  title: string;
  message: string;
  created_at: string;
  acknowledged: boolean;
}

export interface PillIdentifyResponse {
  probable_drug_name: string;
  active_ingredient?: string;
  strength?: string;
  medical_purpose: string;
  general_dosage: string;
  expiry_status: 'Valid' | 'Expired' | 'Not visible';
  confidence_score: number;
  reliability_level: 'High' | 'Medium' | 'Low';
  imprint_code?: string;
  color?: string;
  shape?: string;
  alternative_possibilities: string[];
  safety_disclaimer: string;
  is_demo_mode: boolean;
}

export interface ScanHistoryItem {
  id: number;
  type: string;
  created_at: string;
  result: any;
}
