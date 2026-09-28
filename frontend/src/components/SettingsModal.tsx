import React, { useState } from 'react';
import { X, Volume2, FastForward, RotateCcw, Clock, Check, Globe } from 'lucide-react';
import { Language, UserSettings } from '../types';
import { translations } from '../i18n';
import { updateSettings, simulateTime, reseedData } from '../api';
import { speakAlert } from '../voice';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSettingsUpdated: (newSettings: UserSettings) => void;
  onRefreshData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsUpdated,
  onRefreshData,
}) => {
  if (!isOpen) return null;

  const t = translations[settings.language];
  const [formData, setFormData] = useState<UserSettings>({ ...settings });
  const [simulating, setSimulating] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [voiceTestStatus, setVoiceTestStatus] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      const updated = await updateSettings(formData);
      onSettingsUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onRefreshData();
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const handleTestVoice = async () => {
    setVoiceTestStatus('Speaking...');
    const testText =
      formData.language === 'hi-IN'
        ? 'नमस्ते! मेडीसाथी आवाज अलर्ट ठीक से काम कर रहा है।'
        : formData.language === 'gu-IN'
        ? 'નમસ્તે! મેડીસાથી વોઇસ એલર્ટ બરાબર કામ કરી રહ્યું છે.'
        : 'Hello! MediSathi voice reminders are configured and working properly.';

    await speakAlert(testText, formData.language, (missingMsg) => {
      setVoiceTestStatus(missingMsg);
    });
    setTimeout(() => setVoiceTestStatus(null), 3000);
  };

  const handleSimulate = async (minutes: number, reset: boolean = false) => {
    setSimulating(true);
    try {
      await simulateTime(minutes, reset);
      onRefreshData();
    } catch (e) {
      console.error('Time simulation error:', e);
    } finally {
      setSimulating(false);
    }
  };

  const handleReseed = async () => {
    try {
      await reseedData();
      onRefreshData();
      onClose();
    } catch (e) {
      console.error('Reseed error:', e);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
    >
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto relative">
        <div className="flex items-center justify-between border-b pb-3 mb-4">
          <h2 className="text-xl font-bold text-slate-900">{t.settingsTitle}</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Patient Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{t.patientName}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Language Selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-teal-600" />
              {t.languageLabel}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'en-IN', name: 'English' },
                { id: 'hi-IN', name: 'हिन्दी' },
                { id: 'gu-IN', name: 'ગુજરાતી' },
              ].map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, language: lang.id as Language })}
                  className={`py-2 px-3 rounded-xl border text-sm font-bold transition-colors ${
                    formData.language === lang.id
                      ? 'bg-teal-600 text-white border-teal-600 shadow'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Reminders & Test Button */}
          <div className="p-3.5 bg-teal-50 rounded-2xl border border-teal-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-teal-950 text-sm">
                <Volume2 className="w-5 h-5 text-teal-700" />
                <span>{t.voiceAlertsToggle}</span>
              </div>
              <input
                type="checkbox"
                checked={formData.voice_enabled}
                onChange={(e) => setFormData({ ...formData, voice_enabled: e.target.checked })}
                className="w-6 h-6 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handleTestVoice}
              className="w-full py-2 px-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              <span>{t.testVoiceBtn}</span>
            </button>
            {voiceTestStatus && (
              <p className="text-xs text-amber-800 bg-amber-100 p-2 rounded-lg font-medium">{voiceTestStatus}</p>
            )}
          </div>

          {/* Meal & Sleep Times */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-teal-600" />
              {t.mealTimesTitle}
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs text-slate-600 font-medium">{t.breakfastTime}</label>
                <input
                  type="time"
                  value={formData.meal_times.breakfast}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      meal_times: { ...formData.meal_times, breakfast: e.target.value },
                    })
                  }
                  className="w-full mt-1 p-2 rounded-lg border border-slate-300 text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 font-medium">{t.lunchTime}</label>
                <input
                  type="time"
                  value={formData.meal_times.lunch}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      meal_times: { ...formData.meal_times, lunch: e.target.value },
                    })
                  }
                  className="w-full mt-1 p-2 rounded-lg border border-slate-300 text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 font-medium">{t.dinnerTime}</label>
                <input
                  type="time"
                  value={formData.meal_times.dinner}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      meal_times: { ...formData.meal_times, dinner: e.target.value },
                    })
                  }
                  className="w-full mt-1 p-2 rounded-lg border border-slate-300 text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 font-medium">{t.bedtimeTime}</label>
                <input
                  type="time"
                  value={formData.meal_times.bedtime}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      meal_times: { ...formData.meal_times, bedtime: e.target.value },
                    })
                  }
                  className="w-full mt-1 p-2 rounded-lg border border-slate-300 text-sm font-bold"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-base shadow transition-all flex items-center justify-center gap-2"
          >
            {saveSuccess ? <Check className="w-5 h-5 text-emerald-300" /> : null}
            <span>{saveSuccess ? 'Saved Successfully!' : t.saveSettingsBtn}</span>
          </button>

          {/* Time Simulation Dev Tool */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <FastForward className="w-4 h-4 text-purple-600" />
                {t.simulateTimeTitle}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">{t.simulateSubtitle}</p>

            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                disabled={simulating}
                onClick={() => handleSimulate(10)}
                className="py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg text-xs font-bold border border-purple-200"
              >
                {t.fastForward10}
              </button>
              <button
                type="button"
                disabled={simulating}
                onClick={() => handleSimulate(30)}
                className="py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg text-xs font-bold border border-purple-200"
              >
                {t.fastForward30}
              </button>
              <button
                type="button"
                disabled={simulating}
                onClick={() => handleSimulate(60)}
                className="py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg text-xs font-bold border border-purple-200"
              >
                {t.fastForward60}
              </button>
              <button
                type="button"
                disabled={simulating}
                onClick={() => handleSimulate(0, true)}
                className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 flex items-center justify-center"
                title="Reset to current clock"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Demo Reset */}
          <div className="pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={handleReseed}
              className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              <span>{t.reseedBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
