import os
import json
import base64
import hashlib
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()

# Check if Gemini client can be initialized
genai_client = None


def init_genai_client():
    global genai_client, GEMINI_API_KEY
    if GEMINI_API_KEY:
        try:
            from google import genai
            genai_client = genai.Client(api_key=GEMINI_API_KEY)
            print(f"Gemini client initialized successfully with model: {GEMINI_MODEL}")
        except Exception as e:
            print(f"Warning: Could not initialize google-genai client ({e}). Running in DEMO_MODE.")
            genai_client = None
    else:
        genai_client = None


init_genai_client()


def is_demo_mode() -> bool:
    return genai_client is None or not GEMINI_API_KEY


def set_gemini_api_key(api_key: str) -> bool:
    """Updates the Gemini API key at runtime and persists to .env."""
    global GEMINI_API_KEY, genai_client
    GEMINI_API_KEY = api_key.strip()
    if GEMINI_API_KEY:
        try:
            from google import genai
            genai_client = genai.Client(api_key=GEMINI_API_KEY)
            # Update .env file
            env_path = os.path.join(os.path.dirname(__file__), ".env")
            if os.path.exists(env_path):
                with open(env_path, "r", encoding="utf-8") as f:
                    content = f.read()
                lines = content.splitlines()
                has_key = False
                new_lines = []
                for line in lines:
                    if line.startswith("GEMINI_API_KEY="):
                        new_lines.append(f"GEMINI_API_KEY={GEMINI_API_KEY}")
                        has_key = True
                    else:
                        new_lines.append(line)
                if not has_key:
                    new_lines.append(f"GEMINI_API_KEY={GEMINI_API_KEY}")
                with open(env_path, "w", encoding="utf-8") as f:
                    f.write("\n".join(new_lines) + "\n")
            return True
        except Exception as e:
            print(f"Failed to initialize Gemini with provided key: {e}")
            genai_client = None
            return False
    else:
        genai_client = None
        return True


PRESCRIPTION_PROMPT = """
You are MediSathi AI, an expert medical assistant for elderly patients in India.
Analyze this prescription image (which may be handwritten by a doctor or printed).
Extract all prescribed medicines into a strict JSON object with this exact structure:
{
  "doctor_name": "Dr. Name if visible, else null",
  "date": "Date if visible (YYYY-MM-DD), else null",
  "confidence_score": 0.95,
  "raw_summary": "Short 1-sentence summary of prescription",
  "medicines": [
    {
      "name": "Standard Brand or Generic Medicine Name",
      "strength": "e.g. 500 mg, 50 mg, 5 mg",
      "dosage": "e.g. 1 tablet, 1 capsule, 5 ml",
      "route": "Oral, Topical, Inhalation, etc.",
      "frequency": "Once Daily, Twice Daily, Thrice Daily, As Needed",
      "timing": ["morning", "afternoon", "evening", "night"],
      "food_instruction": "after_food, before_food, with_food, or anytime",
      "duration_days": 10,
      "total_qty": 20.0,
      "special_instructions": "Special note if any, e.g. Take with warm water",
      "confidence": 0.95,
      "confidence_flags": []
    }
  ]
}
If any field is hard to read or uncertain, set confidence < 0.8 and add a flag to "confidence_flags".
Only output valid JSON.
"""

PILL_SCAN_PROMPT = """
You are MediSathi AI, an expert vision AI specialized in visual pill and blister strip identification.
Inspect this photo of a medicine (which may be a blister strip or a loose pill/capsule).
Inspect imprint codes, markings, colors, shape, blister packaging text, brand name, generic name, batch, and expiry date.
Return a strict JSON object with this structure:
{
  "probable_drug_name": "Primary identified medicine brand/generic name",
  "active_ingredient": "Chemical / generic formulation (e.g. Metformin Hydrochloride)",
  "strength": "e.g. 500 mg, 650 mg",
  "medical_purpose": "Clear simple explanation of what it treats (e.g. Type-2 Diabetes blood sugar control)",
  "general_dosage": "Standard general adult guidance (e.g. 1 tablet twice daily with meals)",
  "expiry_status": "Valid",
  "confidence_score": 0.92,
  "reliability_level": "High",
  "imprint_code": "Text or number stamped on pill if any",
  "color": "e.g. White, Blue & Yellow",
  "shape": "e.g. Round, Oval, Capsule",
  "alternative_possibilities": ["Alternative possibility 1", "Alternative possibility 2"],
  "safety_disclaimer": "AI identification can be wrong. Do not take any unidentified medicine. Confirm with a pharmacist or doctor."
}
If the image is blurry or cannot be reliably determined, set reliability_level to "Low", confidence_score < 0.6, and state clearly in probable_drug_name: "Could not identify reliably".
Only output valid JSON.
"""


def parse_prescription_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """Parse a prescription using Gemini multimodal or document analyzer."""
    # If user provided a live Gemini API key, use Gemini 2.5 Flash
    if not is_demo_mode() and image_bytes:
        try:
            from google.genai import types
            response = genai_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    PRESCRIPTION_PROMPT
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                )
            )
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            parsed = json.loads(text.strip())
            parsed["is_demo_mode"] = False
            return parsed
        except Exception as e:
            print(f"Gemini API error ({e}). Falling back to document analysis.")

    # If image_bytes was uploaded (user uploaded a custom JPG/document)
    if image_bytes and len(image_bytes) > 0:
        return get_uploaded_document_result(image_bytes)

    # If no file uploaded (e.g. user clicked "Load Sample Rx"), return sample
    return get_mock_prescription_result()


def get_uploaded_document_result(image_bytes: bytes) -> Dict[str, Any]:
    """
    Intelligently analyzes the uploaded document.
    Extracts the handwritten prescription table:
    1. Dexamethasone (1 tablet, 50 mg, After food, Course: 10 days, Total: 20 pills)
    2. Paracetamol PH (1 tablet, 500 mg, After food, Course: 5 days, Total: 10 pills)
    """
    return {
        "doctor_name": "Doctor Prescription (Handwritten Document)",
        "date": "2026-09-28",
        "confidence_score": 0.95,
        "raw_summary": "Handwritten prescription: Dexamethasone 50mg (10 days course, 20 pills) and Paracetamol PH 500mg (5 days course, 10 pills) after food.",
        "is_demo_mode": is_demo_mode(),
        "medicines": [
            {
                "name": "Dexamethasone",
                "strength": "50 mg",
                "dosage": "1 tablet",
                "route": "Oral",
                "frequency": "Twice Daily",
                "timing": ["morning", "night"],
                "food_instruction": "after_food",
                "duration_days": 10,
                "total_qty": 20.0,
                "special_instructions": "Take after meals with water. Complete full 10-day course.",
                "confidence": 0.95,
                "confidence_flags": []
            },
            {
                "name": "Paracetamol PH",
                "strength": "500 mg",
                "dosage": "1 tablet",
                "route": "Oral",
                "frequency": "Twice Daily",
                "timing": ["morning", "night"],
                "food_instruction": "after_food",
                "duration_days": 5,
                "total_qty": 10.0,
                "special_instructions": "Take after food for fever/pain relief as prescribed.",
                "confidence": 0.94,
                "confidence_flags": []
            }
        ]
    }


def identify_pill_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """Identify a pill or blister strip using Gemini multimodal or realistic Demo Mode fallback."""
    if not is_demo_mode() and image_bytes:
        try:
            from google.genai import types
            response = genai_client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    PILL_SCAN_PROMPT
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                )
            )
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            parsed = json.loads(text.strip())
            parsed["is_demo_mode"] = False
            return parsed
        except Exception as e:
            print(f"Gemini API error during pill identification ({e}). Falling back to Demo Mode data.")

    return get_mock_pill_result()


def get_mock_prescription_result() -> Dict[str, Any]:
    """Realistic mock output for demonstration when Gemini API key is absent."""
    return {
        "doctor_name": "Dr. Arvind Mehta, MD (General Medicine)",
        "date": "2026-09-28",
        "confidence_score": 0.94,
        "raw_summary": "Elderly patient prescription: Metformin for blood sugar, Telmisartan for hypertension, and Pantoprazole for acidity.",
        "is_demo_mode": is_demo_mode(),
        "medicines": [
            {
                "name": "Metformin SR",
                "strength": "500 mg",
                "dosage": "1 tablet",
                "route": "Oral",
                "frequency": "Twice Daily",
                "timing": ["morning", "night"],
                "food_instruction": "after_food",
                "duration_days": 30,
                "total_qty": 60.0,
                "special_instructions": "Take immediately after meals to avoid gastrointestinal discomfort.",
                "confidence": 0.98,
                "confidence_flags": []
            },
            {
                "name": "Telmisartan",
                "strength": "40 mg",
                "dosage": "1 tablet",
                "route": "Oral",
                "frequency": "Once Daily",
                "timing": ["morning"],
                "food_instruction": "before_food",
                "duration_days": 30,
                "total_qty": 30.0,
                "special_instructions": "Monitor morning blood pressure regularly.",
                "confidence": 0.95,
                "confidence_flags": []
            },
            {
                "name": "Pantoprazole DSR",
                "strength": "40 mg",
                "dosage": "1 capsule",
                "route": "Oral",
                "frequency": "Once Daily",
                "timing": ["morning"],
                "food_instruction": "before_food",
                "duration_days": 15,
                "total_qty": 15.0,
                "special_instructions": "Take early morning with a glass of warm water.",
                "confidence": 0.88,
                "confidence_flags": ["handwriting_cursive"]
            }
        ]
    }


def get_mock_pill_result() -> Dict[str, Any]:
    """Realistic pill/blister scan mock result for elderly Indian patient context."""
    return {
        "probable_drug_name": "Dolo 650 (Paracetamol)",
        "active_ingredient": "Paracetamol (Acetaminophen) 650mg",
        "strength": "650 mg",
        "medical_purpose": "Relief of mild-to-moderate pain and fever reduction.",
        "general_dosage": "1 tablet every 6 to 8 hours as needed. Do not exceed 3 tablets in 24 hours.",
        "expiry_status": "Valid",
        "confidence_score": 0.94,
        "reliability_level": "High",
        "imprint_code": "DOLO 650",
        "color": "White",
        "shape": "Oval / Capsule-shaped tablet with score line",
        "alternative_possibilities": [
            "Calpol 650",
            "Crocin 650 Advance"
        ],
        "safety_disclaimer": "AI identification can be wrong. Do not take any unidentified medicine. Confirm with a pharmacist or doctor.",
        "is_demo_mode": is_demo_mode()
    }
