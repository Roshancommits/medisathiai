import requests
import json

def test_upload():
    file_path = "WhatsApp Image 2026-09-28 at 7.21.25 PM.jpeg"
    with open(file_path, "rb") as f:
        files = {"file": ("prescription.jpeg", f, "image/jpeg")}
        res = requests.post("http://127.0.0.1:8000/api/prescription/parse", files=files)
        print("HTTP Status:", res.status_code)
        data = res.json()
        print("Summary:", data.get("raw_summary"))
        print(f"Extracted {len(data.get('medicines', []))} medicines:")
        for m in data.get("medicines", []):
            print(f"  * {m['name']} ({m['strength']}) - {m['dosage']} - {m['frequency']} - Timings: {m['timing']} - Food: {m['food_instruction']} - Days: {m['duration_days']} - Total Qty: {m['total_qty']}")

if __name__ == "__main__":
    test_upload()
