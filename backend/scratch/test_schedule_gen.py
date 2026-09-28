import requests
import json

def test_save_and_schedule():
    base = "http://127.0.0.1:8000/api"
    
    # Create Dexamethasone
    dex = {
        "name": "Dexamethasone",
        "strength": "50 mg",
        "dosage": "1 tablet",
        "route": "Oral",
        "frequency": "Twice Daily",
        "timing": ["morning", "night"],
        "food_instruction": "after_food",
        "duration_days": 10,
        "total_qty": 20.0,
        "special_instructions": "Take after meals with water. Complete full 10-day course."
    }
    r1 = requests.post(f"{base}/medicines", json=dex)
    print("Created Dexamethasone:", r1.status_code, r1.json()["id"])
    
    # Create Paracetamol PH
    para = {
        "name": "Paracetamol PH",
        "strength": "500 mg",
        "dosage": "1 tablet",
        "route": "Oral",
        "frequency": "Twice Daily",
        "timing": ["morning", "night"],
        "food_instruction": "after_food",
        "duration_days": 5,
        "total_qty": 10.0,
        "special_instructions": "Take after food for fever/pain relief."
    }
    r2 = requests.post(f"{base}/medicines", json=para)
    print("Created Paracetamol PH:", r2.status_code, r2.json()["id"])
    
    # Check Today schedule
    sched = requests.get(f"{base}/schedule/today").json()
    print("\n--- TODAY'S GENERATED SCHEDULE ---")
    print(f"Total doses today: {sched['summary']['total']}")
    
    all_doses = sched['morning'] + sched['afternoon'] + sched['evening'] + sched['night']
    for d in all_doses:
        if d['medicine_name'] in ['Dexamethasone', 'Paracetamol PH']:
            print(f"  * {d['medicine_name']} ({d['period']} at {d['scheduled_at'].split('T')[1][:5]}): Status={d['status']} | Food={d['food_instruction']} | Voice Alert ({sched.get('current_time', '')[:10]}): {d['voice_alert_text']['en']}")

if __name__ == "__main__":
    test_save_and_schedule()
