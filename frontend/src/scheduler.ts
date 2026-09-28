import { DoseItem, Language } from './types';
import { speakAlert } from './voice';

const LOCAL_STORAGE_SCHEDULE_KEY = 'medisathi_schedule_cache';
const FIRED_REMINDERS_KEY = 'medisathi_fired_reminders';

interface FiredRecord {
  doseId: number;
  lastFiredAt: number; // timestamp ms
  repeatCount: number;
}

// Request Notification Permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
}

// Cache schedule locally for offline alarms
export function cacheScheduleLocally(doses: DoseItem[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_SCHEDULE_KEY, JSON.stringify(doses));
  } catch (e) {
    console.warn('Could not cache schedule locally:', e);
  }
}

export function getCachedSchedule(): DoseItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SCHEDULE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function getFiredRecords(): Record<number, FiredRecord> {
  try {
    const raw = localStorage.getItem(FIRED_REMINDERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function setFiredRecords(records: Record<number, FiredRecord>) {
  try {
    localStorage.setItem(FIRED_REMINDERS_KEY, JSON.stringify(records));
  } catch (e) {}
}

export function clearFiredRecord(doseId: number) {
  const records = getFiredRecords();
  delete records[doseId];
  setFiredRecords(records);
}

// Post reminder to Service Worker or native notification
export function dispatchNotification(title: string, body: string, doseId: number) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_DOSE_NOTIFICATION',
        title,
        body,
        doseId,
      });
    } else {
      new Notification(title, {
        body,
        icon: '/icon-192.png',
        tag: `dose-${doseId}`,
      });
    }
  }
}

// Check schedule and trigger voice + notification alerts
export async function evaluateReminders(
  doses: DoseItem[],
  language: Language,
  voiceEnabled: boolean,
  onDoseTriggered?: (dose: DoseItem) => void,
  onMissingVoice?: (msg: string) => void
) {
  const nowMs = Date.now();
  const records = getFiredRecords();

  for (const dose of doses) {
    // Only trigger for Due doses that are not yet Taken
    if (dose.is_due && dose.status !== 'Taken') {
      const rec = records[dose.id] || { doseId: dose.id, lastFiredAt: 0, repeatCount: 0 };

      const timeSinceLastFired = nowMs - rec.lastFiredAt;
      const fiveMinutesMs = 5 * 60 * 1000;

      // First trigger OR repeat every 5 minutes up to max 3 times
      const shouldTrigger = rec.lastFiredAt === 0 || (timeSinceLastFired >= fiveMinutesMs && rec.repeatCount < 3);

      if (shouldTrigger) {
        rec.lastFiredAt = nowMs;
        rec.repeatCount += 1;
        records[dose.id] = rec;
        setFiredRecords(records);

        // Pick voice template based on chosen language
        const voiceText =
          language === 'hi-IN'
            ? dose.voice_alert_text.hi
            : language === 'gu-IN'
            ? dose.voice_alert_text.gu
            : dose.voice_alert_text.en;

        const notifTitle = `Medicine Reminder: ${dose.medicine_name}`;
        const notifBody = `${dose.dosage} (${dose.food_instruction}). Please take your dose now.`;

        // 1. Browser Notification
        dispatchNotification(notifTitle, notifBody, dose.id);

        // 2. Spoken Voice Alert (if voice enabled)
        if (voiceEnabled) {
          speakAlert(voiceText, language, onMissingVoice);
        }

        // 3. Callback to show full-screen modal
        if (onDoseTriggered) {
          onDoseTriggered(dose);
        }

        // Trigger only one primary due dose modal at a time to avoid overwhelming elderly user
        break;
      }
    }
  }
}
