import urllib.request
import json

def test_api():
    base = "http://127.0.0.1:8000/api"
    
    # 1. Health
    h = json.loads(urllib.request.urlopen(f"{base}/health").read())
    print(f"1. Health Check: {h['status']} | Demo Mode: {h['is_demo_mode']} | Model: {h['gemini_model']}")
    
    # 2. Today Schedule
    s = json.loads(urllib.request.urlopen(f"{base}/schedule/today").read())
    print(f"2. Today Schedule Total Doses: {s['summary']['total']} | Morning: {len(s['morning'])} | Afternoon: {len(s['afternoon'])} | Night: {len(s['night'])}")
    for d in s['morning'] + s['night']:
        print(f"   - {d['medicine_name']} ({d['period']}): Status={d['status']}, IsDue={d['is_due']}")
    
    # 3. Alerts (Second course alert)
    alerts = json.loads(urllib.request.urlopen(f"{base}/alerts").read())
    print(f"3. Alerts count: {len(alerts)}")
    for a in alerts:
        print(f"   Alert: {a['title']} -> {a['message'][:60]}...")
        
    # 4. Inventory
    inv = json.loads(urllib.request.urlopen(f"{base}/inventory").read())
    print(f"4. Inventory count: {len(inv)}")
    for m in inv:
        print(f"   - {m['name']}: {m['remaining_qty']} pills ({m['percent_remaining']} pct) | Status: {m['status_color']} | Alert: {m['is_second_course_alert']}")
        
    # 5. Prescription Parse
    req = urllib.request.Request(f"{base}/prescription/parse", data=b"", headers={"Content-Type": "application/x-www-form-urlencoded"})
    rx = json.loads(urllib.request.urlopen(req).read())
    print(f"5. Prescription Parsed Meds: {len(rx['medicines'])}")
    for pm in rx['medicines']:
        print(f"   - {pm['name']} ({pm['strength']}): {pm['dosage']}, {pm['frequency']}, {pm['timing']}")
    
    # 6. Pill Scanner Identification
    req2 = urllib.request.Request(f"{base}/pill/identify", data=b"", headers={"Content-Type": "application/x-www-form-urlencoded"})
    pill = json.loads(urllib.request.urlopen(req2).read())
    print(f"6. Pill Identified: {pill['probable_drug_name']} | Confidence: {pill['confidence_score']} | Expiry: {pill['expiry_status']}")
    print(f"   Active Ingredient: {pill['active_ingredient']}")
    print(f"   Safety Warning: {pill['safety_disclaimer'][:65]}...")
    
    # 7. Doctor Followup Calendar ICS
    ics = urllib.request.urlopen(f"{base}/calendar/followup.ics?medicine_name=Metformin").read().decode("utf-8")
    print(f"7. Calendar ICS lines: {len(ics.splitlines())} | Contains VCALENDAR: {'BEGIN:VCALENDAR' in ics}")
    
    # 8. Time Simulation: Advance 30 mins
    req_sim = urllib.request.Request(
        f"{base}/simulate-time",
        data=json.dumps({"minutes_forward": 30, "reset": False}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    sim_res = json.loads(urllib.request.urlopen(req_sim).read())
    print(f"8. Time Simulation: Advanced by 30 mins -> Offset: {sim_res['simulated_offset_minutes']} mins | Virtual Time: {sim_res['formatted_display']}")

    # 9. Test Pill Taken
    first_dose = s['morning'][0] if s['morning'] else s['night'][0]
    req_take = urllib.request.Request(f"{base}/doses/{first_dose['id']}/taken", data=b"")
    taken_res = json.loads(urllib.request.urlopen(req_take).read())
    print(f"9. Pill Taken Action: Dose {taken_res['dose_id']} -> Status: {taken_res['new_status']}, Remaining Qty: {taken_res['remaining_qty']}")

    # 10. Refill Medicine
    req_refill = urllib.request.Request(
        f"{base}/medicines/{first_dose['medicine_id']}/refill",
        data=json.dumps({"quantity_to_add": 30.0}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    refill_res = json.loads(urllib.request.urlopen(req_refill).read())
    print(f"10. Refill Action: Added 30 pills -> New Remaining: {refill_res['remaining_qty']} ({refill_res['percent_remaining']} pct), Alert Reset: {not refill_res['is_second_course_alert']}")

if __name__ == "__main__":
    test_api()
