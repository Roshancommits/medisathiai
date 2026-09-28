import React from 'react';
import {
  Sun,
  Sunset,
  Moon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Utensils,
  Volume2,
  CalendarCheck
} from 'lucide-react';
import { TodayScheduleResponse, DoseItem, AlertItem, Language } from '../types';
import { translations } from '../i18n';
import { SecondCourseBanner } from '../components/SecondCourseBanner';
import { speakAlert } from '../voice';

interface TodayTabProps {
  schedule: TodayScheduleResponse | null;
  alerts: AlertItem[];
  language: Language;
  voiceEnabled: boolean;
  onTaken: (doseId: number) => void;
  onSnooze: (doseId: number) => void;
  onOpenDueModal: (dose: DoseItem) => void;
}

export const TodayTab: React.FC<TodayTabProps> = ({
  schedule,
  alerts,
  language,
  voiceEnabled,
  onTaken,
  onSnooze,
  onOpenDueModal,
}) => {
  const t = translations[language];

  if (!schedule) {
    return (
      <div className="p-6 text-center text-slate-500">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-base font-semibold">Loading your schedule...</p>
      </div>
    );
  }

  const { morning, afternoon, evening, night, summary } = schedule;

  const periods: { id: string; title: string; icon: React.ReactNode; doses: DoseItem[]; bg: string }[] = [
    {
      id: 'morning',
      title: t.morning,
      icon: <Sun className="w-5 h-5 text-amber-600" />,
      doses: morning,
      bg: 'from-amber-500/10 to-orange-500/5',
    },
    {
      id: 'afternoon',
      title: t.afternoon,
      icon: <Sun className="w-5 h-5 text-yellow-600" />,
      doses: afternoon,
      bg: 'from-yellow-500/10 to-amber-500/5',
    },
    {
      id: 'evening',
      title: t.evening,
      icon: <Sunset className="w-5 h-5 text-orange-600" />,
      doses: evening,
      bg: 'from-orange-500/10 to-rose-500/5',
    },
    {
      id: 'night',
      title: t.night,
      icon: <Moon className="w-5 h-5 text-indigo-600" />,
      doses: night,
      bg: 'from-indigo-500/10 to-purple-500/5',
    },
  ];

  const handleVoicePlay = (dose: DoseItem) => {
    const text =
      language === 'hi-IN'
        ? dose.voice_alert_text.hi
        : language === 'gu-IN'
        ? dose.voice_alert_text.gu
        : dose.voice_alert_text.en;
    speakAlert(text, language);
  };

  return (
    <div className="pb-24">
      {/* High-priority Second Course Alert Banner */}
      <SecondCourseBanner alerts={alerts} language={language} />

      {/* Progress Summary Ribbon */}
      <div className="mx-4 my-2 p-3 bg-slate-100 rounded-2xl flex items-center justify-around border border-slate-200">
        <div className="text-center">
          <span className="block text-2xl font-black text-emerald-600">{summary.taken}</span>
          <span className="text-xs font-bold text-slate-600 uppercase">{t.takenDoses}</span>
        </div>
        <div className="h-8 w-px bg-slate-300" />
        <div className="text-center">
          <span className="block text-2xl font-black text-amber-600">{summary.due}</span>
          <span className="text-xs font-bold text-slate-600 uppercase">{t.dueDoses}</span>
        </div>
        <div className="h-8 w-px bg-slate-300" />
        <div className="text-center">
          <span className="block text-2xl font-black text-rose-600">{summary.missed}</span>
          <span className="text-xs font-bold text-slate-600 uppercase">{t.missedDoses}</span>
        </div>
      </div>

      {/* Timeline Periods */}
      <div className="px-4 space-y-5 mt-4">
        {periods.map((period) => (
          <div key={period.id} className="rounded-2xl border-2 border-slate-200 overflow-hidden bg-white shadow-sm">
            {/* Period Header */}
            <div className={`px-4 py-2.5 flex items-center justify-between bg-gradient-to-r ${period.bg} border-b border-slate-200`}>
              <div className="flex items-center gap-2 font-bold text-slate-900 text-lg">
                {period.icon}
                <span>{period.title}</span>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {period.doses.length} {period.doses.length === 1 ? 'dose' : 'doses'}
              </span>
            </div>

            {/* Doses in this period */}
            <div className="divide-y divide-slate-100">
              {period.doses.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400 font-medium">
                  No medicines scheduled
                </div>
              ) : (
                period.doses.map((dose) => {
                  const isDue = dose.status === 'Due';
                  const isTaken = dose.status === 'Taken';
                  const isMissed = dose.status === 'Missed';
                  const isSnoozed = dose.status === 'Snoozed';

                  const foodText =
                    dose.food_instruction === 'before_food'
                      ? t.beforeFood
                      : dose.food_instruction === 'after_food'
                      ? t.afterFood
                      : dose.food_instruction === 'with_food'
                      ? t.withFood
                      : t.anytime;

                  return (
                    <div
                      key={dose.id}
                      className={`p-4 transition-all ${
                        isDue
                          ? 'bg-amber-50/80 border-l-8 border-amber-500'
                          : isMissed
                          ? 'bg-rose-50/60 border-l-8 border-rose-500'
                          : isTaken
                          ? 'bg-emerald-50/40 border-l-8 border-emerald-500'
                          : 'border-l-8 border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xl font-black text-slate-900 leading-tight">
                              {dose.medicine_name}
                            </h4>
                            {dose.strength && (
                              <span className="text-base font-bold text-teal-700">
                                {dose.strength}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1.5 text-sm font-semibold text-slate-700">
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800">
                              {dose.dosage}
                            </span>
                            <span className="flex items-center gap-1 text-slate-600">
                              <Utensils className="w-3.5 h-3.5 text-amber-600" />
                              {foodText}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="text-right shrink-0">
                          {isDue && (
                            <span className="inline-block px-3 py-1 rounded-full bg-amber-500 text-white font-black text-xs uppercase tracking-wider animate-pulse">
                              {t.statusDue}
                            </span>
                          )}
                          {isTaken && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {t.statusTaken}
                            </span>
                          )}
                          {isMissed && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-600 text-white font-black text-xs uppercase">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {t.statusMissed}
                            </span>
                          )}
                          {isSnoozed && (
                            <span className="inline-block px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-xs">
                              {t.statusSnoozed}
                            </span>
                          )}
                          {dose.status === 'Upcoming' && (
                            <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">
                              {t.statusUpcoming}
                            </span>
                          )}

                          <div className="flex items-center justify-end gap-1 mt-1 text-xs text-slate-500 font-medium">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{dose.scheduled_at.split('T')[1]?.slice(0, 5)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Buttons: Huge Pill Taken for DUE doses */}
                      {isDue && (
                        <div className="mt-4 pt-3 border-t border-amber-200/80 space-y-2">
                          <button
                            onClick={() => onTaken(dose.id)}
                            className="w-full btn-huge bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl flex items-center justify-center gap-3 shadow-md hover:shadow-lg active:scale-95 transition-all text-xl font-black"
                            aria-label={`Mark ${dose.medicine_name} as taken`}
                          >
                            <CheckCircle2 className="w-8 h-8 text-emerald-200" />
                            <span>{t.pillTakenBtn}</span>
                          </button>

                          <div className="flex gap-2">
                            <button
                              onClick={() => onSnooze(dose.id)}
                              className="tap-target flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <Clock className="w-4 h-4 text-slate-500" />
                              <span>{t.snoozeBtn}</span>
                            </button>

                            <button
                              onClick={() => handleVoicePlay(dose)}
                              className="tap-target py-2 px-3 bg-teal-100 hover:bg-teal-200 text-teal-800 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-colors"
                              title="Play voice reminder"
                            >
                              <Volume2 className="w-4 h-4 text-teal-700" />
                              <span>Audio</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* If missed or upcoming, show quick Take Now button */}
                      {!isDue && !isTaken && (
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                          <button
                            onClick={() => handleVoicePlay(dose)}
                            className="text-xs text-teal-700 font-semibold flex items-center gap-1 hover:underline"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Hear instruction</span>
                          </button>

                          <button
                            onClick={() => onTaken(dose.id)}
                            className="tap-target py-2 px-4 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-sm font-bold border border-teal-200 flex items-center gap-1.5 transition-colors active:scale-95"
                          >
                            <CheckCircle2 className="w-4 h-4 text-teal-600" />
                            <span>{t.takeNowBtn}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
