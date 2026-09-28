import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Clock, Volume2, Utensils, AlertTriangle } from 'lucide-react';
import { DoseItem, Language } from '../types';
import { translations } from '../i18n';
import { speakAlert } from '../voice';

interface DueAlertModalProps {
  dose: DoseItem;
  language: Language;
  voiceEnabled: boolean;
  onTaken: (doseId: number) => void;
  onSnooze: (doseId: number) => void;
  onClose: () => void;
}

export const DueAlertModal: React.FC<DueAlertModalProps> = ({
  dose,
  language,
  voiceEnabled,
  onTaken,
  onSnooze,
  onClose,
}) => {
  const t = translations[language];
  const [repeats, setRepeats] = useState<number>(0);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Spoken text in chosen language
  const voiceText =
    language === 'hi-IN'
      ? dose.voice_alert_text.hi
      : language === 'gu-IN'
      ? dose.voice_alert_text.gu
      : dose.voice_alert_text.en;

  const triggerVoice = async () => {
    if (!voiceEnabled) return;
    setIsSpeaking(true);
    await speakAlert(voiceText, language);
    setIsSpeaking(false);
  };

  useEffect(() => {
    // Initial spoken alert upon modal open
    triggerVoice();

    // 5-minute repeating reminder timer (max 3 repeats)
    const interval = setInterval(() => {
      setRepeats((prev) => {
        if (prev < 3) {
          triggerVoice();
          return prev + 1;
        }
        return prev;
      });
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [dose.id, language, voiceEnabled]);

  const foodLabel =
    dose.food_instruction === 'before_food'
      ? t.beforeFood
      : dose.food_instruction === 'after_food'
      ? t.afterFood
      : dose.food_instruction === 'with_food'
      ? t.withFood
      : t.anytime;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="due-alert-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border-4 border-amber-400 relative overflow-hidden animate-alert-pulse">
        {/* Urgent header badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-sm tracking-wide uppercase">
            <Bell className="w-4 h-4 text-amber-700 animate-bounce" />
            <span>{t.statusDue}</span>
          </div>

          {/* Voice Replay button */}
          <button
            onClick={triggerVoice}
            disabled={isSpeaking}
            className="tap-target px-3 py-1.5 rounded-full bg-teal-100 text-teal-800 hover:bg-teal-200 text-sm font-semibold flex items-center gap-1.5 transition-colors"
            title="Hear voice reminder again"
            aria-label="Repeat voice alert"
          >
            <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-spin text-teal-600' : ''}`} />
            <span>{isSpeaking ? 'Speaking...' : 'Listen'}</span>
          </button>
        </div>

        {/* Big Medicine Details for Elderly Eyes */}
        <div className="text-center my-4">
          <h2 id="due-alert-title" className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
            {dose.medicine_name}
          </h2>
          {dose.strength && (
            <p className="text-xl font-bold text-teal-700 mt-1">{dose.strength}</p>
          )}

          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-800 text-base font-semibold">
            <Utensils className="w-5 h-5 text-amber-600" />
            <span>{dose.dosage} &bull; <strong className="text-amber-800">{foodLabel}</strong></span>
          </div>
        </div>

        {/* Voice message transcribed preview */}
        <div className="my-4 p-3 bg-teal-50 rounded-xl border border-teal-200 text-teal-900 text-sm italic text-center font-medium leading-relaxed">
          &ldquo;{voiceText}&rdquo;
        </div>

        {/* Scheduled time info */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mb-6 font-medium">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>Scheduled for {dose.scheduled_at.split('T')[1]?.slice(0, 5)}</span>
          {repeats > 0 && <span className="text-amber-700 ml-1">({repeats}/3 repeats)</span>}
        </div>

        {/* Giant "Pill Taken" Action Button (min 72px tall) */}
        <div className="space-y-3">
          <button
            onClick={() => onTaken(dose.id)}
            className="w-full btn-huge bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:shadow-xl active:scale-95 transition-all text-xl font-black"
            aria-label="Confirm pill taken"
          >
            <CheckCircle2 className="w-8 h-8 text-emerald-200" />
            <span>{t.pillTakenBtn}</span>
          </button>

          {/* Snooze 10 min button */}
          <button
            onClick={() => onSnooze(dose.id)}
            className="w-full tap-target py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-colors border border-slate-300"
            aria-label="Snooze 10 minutes"
          >
            <Clock className="w-5 h-5 text-slate-500" />
            <span>{t.snoozeBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
