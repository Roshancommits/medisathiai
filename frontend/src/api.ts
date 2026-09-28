import {
  TodayScheduleResponse,
  InventoryItem,
  AlertItem,
  PrescriptionParseResponse,
  PillIdentifyResponse,
  ScanHistoryItem,
  UserSettings,
  Medicine
} from './types';

const BASE_URL = '/api';

export async function getHealth() {
  const res = await fetch(`${BASE_URL}/health`);
  return res.json();
}

export async function getSettings(): Promise<UserSettings> {
  const res = await fetch(`${BASE_URL}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const res = await fetch(`${BASE_URL}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: jsonStringifySafe(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

export async function getTodaySchedule(): Promise<TodayScheduleResponse> {
  const res = await fetch(`${BASE_URL}/schedule/today`);
  if (!res.ok) throw new Error('Failed to fetch today schedule');
  return res.json();
}

export async function markDoseTaken(doseId: number) {
  const res = await fetch(`${BASE_URL}/doses/${doseId}/taken`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to log dose');
  return res.json();
}

export async function snoozeDose(doseId: number) {
  const res = await fetch(`${BASE_URL}/doses/${doseId}/snooze`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to snooze dose');
  return res.json();
}

export async function getInventory(): Promise<InventoryItem[]> {
  const res = await fetch(`${BASE_URL}/inventory`);
  if (!res.ok) throw new Error('Failed to fetch inventory');
  return res.json();
}

export async function refillMedicine(medicineId: number, quantityToAdd: number): Promise<InventoryItem> {
  const res = await fetch(`${BASE_URL}/medicines/${medicineId}/refill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity_to_add: quantityToAdd }),
  });
  if (!res.ok) throw new Error('Failed to refill medicine');
  return res.json();
}

export async function getAlerts(): Promise<AlertItem[]> {
  const res = await fetch(`${BASE_URL}/alerts`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function acknowledgeAlert(alertId: number) {
  const res = await fetch(`${BASE_URL}/alerts/${alertId}/acknowledge`, { method: 'POST' });
  return res.json();
}

export async function parsePrescription(file?: File): Promise<PrescriptionParseResponse> {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  const res = await fetch(`${BASE_URL}/prescription/parse`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to parse prescription');
  return res.json();
}

export async function createMedicine(data: any): Promise<Medicine> {
  const res = await fetch(`${BASE_URL}/medicines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create medicine');
  return res.json();
}

export async function getMedicines(): Promise<Medicine[]> {
  const res = await fetch(`${BASE_URL}/medicines`);
  if (!res.ok) throw new Error('Failed to fetch medicines');
  return res.json();
}

export async function identifyPill(file?: File): Promise<PillIdentifyResponse> {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  const res = await fetch(`${BASE_URL}/pill/identify`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to identify pill');
  return res.json();
}

export async function getScans(): Promise<ScanHistoryItem[]> {
  const res = await fetch(`${BASE_URL}/scans`);
  if (!res.ok) throw new Error('Failed to fetch scans');
  return res.json();
}

export async function simulateTime(minutesForward: number = 30, reset: boolean = false) {
  const res = await fetch(`${BASE_URL}/simulate-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minutes_forward: minutesForward, reset }),
  });
  if (!res.ok) throw new Error('Failed to simulate time');
  return res.json();
}

export async function reseedData() {
  const res = await fetch(`${BASE_URL}/seed`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reseed data');
  return res.json();
}

export async function updateApiKey(apiKey: string) {
  const res = await fetch(`${BASE_URL}/settings/api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!res.ok) throw new Error('Failed to update API key');
  return res.json();
}

function jsonStringifySafe(data: any) {
  return JSON.stringify(data);
}
