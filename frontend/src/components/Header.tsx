import React from 'react';
import { Pill, Settings as SettingsIcon, Volume2, VolumeX, Sparkles, Clock } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../i18n';

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onOpenSettings: () => void;
  isDemoMode: boolean;
  simulatedTimeStr: string;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  voiceEnabled,
  onToggleVoice,
  onOpenSettings,
  isDemoMode,
  simulatedTimeStr,
}) => {
  const t = translations[language];

  return (
    <header className="sticky top-0 z-40 bg-teal-800 text-white shadow-md">
      {/* Top Banner with App Branding & Quick Actions */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-11 h-11 rounded-xl bg-teal-600 flex items-center justify-center text-teal-100 shadow-inner">
            <Pill className="w-7 h-7 rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight leading-none">{t.appName}</h1>
              {isDemoMode ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-400 text-amber-950 shadow-sm" title="Running in realistic demo mode (no API key configured)">
                  <Sparkles className="w-3 h-3" />
                  {t.demoModeBadge}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-400 text-emerald-950 shadow-sm">
                  {t.liveModeBadge}
                </span>
              )}
            </div>
            <p className="text-xs text-teal-200 mt-0.5 font-medium">{t.tagline}</p>
          </div>
        </div>

        {/* Quick controls: Voice Toggle, Language Switcher, Settings */}
        <div className="flex items-center gap-2">
          {/* Voice button */}
          <button
            onClick={onToggleVoice}
            className={`tap-target w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              voiceEnabled ? 'bg-teal-700 text-teal-100' : 'bg-teal-900/60 text-teal-400 line-through'
            }`}
            title={voiceEnabled ? 'Voice reminders on' : 'Voice reminders muted'}
            aria-label="Toggle voice alerts"
          >
            {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Quick Language Toggle */}
          <div className="flex bg-teal-900/60 p-0.5 rounded-lg border border-teal-700/50">
            {(['en-IN', 'hi-IN', 'gu-IN'] as Language[]).map((l) => {
              const label = l === 'en-IN' ? 'EN' : l === 'hi-IN' ? 'हिं' : 'ગુજ';
              const active = language === l;
              return (
                <button
                  key={l}
                  onClick={() => onLanguageChange(l)}
                  className={`px-2 py-1 text-xs font-bold rounded ${
                    active ? 'bg-white text-teal-900 shadow-sm' : 'text-teal-200 hover:text-white'
                  }`}
                  aria-label={`Switch to ${l}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Settings cog */}
          <button
            onClick={onOpenSettings}
            className="tap-target w-10 h-10 rounded-lg bg-teal-700 hover:bg-teal-600 flex items-center justify-center text-teal-100 transition-colors shadow-sm"
            title="Settings & Dev Tools"
            aria-label="Open settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Simulated Time Sub-bar */}
      {simulatedTimeStr && (
        <div className="bg-teal-900 px-4 py-1.5 flex items-center justify-between text-xs text-teal-200 border-t border-teal-700/50">
          <div className="flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5 text-teal-300" />
            <span>Virtual Time: <strong className="text-white">{simulatedTimeStr}</strong></span>
          </div>
          <span className="text-[11px] text-teal-300 bg-teal-950/60 px-2 py-0.5 rounded">Elderly Mode 60+</span>
        </div>
      )}
    </header>
  );
};
