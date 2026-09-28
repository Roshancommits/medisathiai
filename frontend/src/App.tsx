import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { BottomNav, TabType } from './components/BottomNav';
import { TodayTab } from './tabs/TodayTab';
import { ScanRxTab } from './tabs/ScanRxTab';
import { StockTab } from './tabs/StockTab';
import { PillScannerTab } from './tabs/PillScannerTab';
import { DueAlertModal } from './components/DueAlertModal';
import { SettingsModal } from './components/SettingsModal';
import {
  TodayScheduleResponse,
  InventoryItem,
  AlertItem,
  UserSettings,
  DoseItem,
  Language
} from './types';
import {
  getTodaySchedule,
  getInventory,
  getAlerts,
  getSettings,
  markDoseTaken,
  snoozeDose,
  getHealth
} from './api';
import {
  evaluateReminders,
  requestNotificationPermission,
  cacheScheduleLocally,
  clearFiredRecord
} from './scheduler';
import { translations } from './i18n';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [settings, setSettings] = useState<UserSettings>({
    name: 'Ramesh Patel',
    language: 'en-IN',
    meal_times: {
      breakfast: '08:00',
      lunch: '13:00',
      dinner: '20:00',
      bedtime: '22:00',
    },
    voice_enabled: true,
  });

  const [schedule, setSchedule] = useState<TodayScheduleResponse | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [dueModalDose, setDueModalDose] = useState<DoseItem | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [simulatedTimeStr, setSimulatedTimeStr] = useState<string>('');

  const t = translations[settings.language];

  // Refresh all state from backend
  const refreshAllData = useCallback(async () => {
    try {
      const [schedRes, invRes, alertsRes, settingsRes, healthRes] = await Promise.all([
        getTodaySchedule(),
        getInventory(),
        getAlerts(),
        getSettings(),
        getHealth(),
      ]);

      setSchedule(schedRes);
      setInventory(invRes);
      setAlerts(alertsRes);
      setSettings(settingsRes);
      setIsDemoMode(healthRes.is_demo_mode);

      if (schedRes.current_time) {
        const d = new Date(schedRes.current_time);
        setSimulatedTimeStr(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }

      // Cache all doses locally for offline backup
      const allDoses = [
        ...schedRes.morning,
        ...schedRes.afternoon,
        ...schedRes.evening,
        ...schedRes.night,
      ];
      cacheScheduleLocally(allDoses);

      // Check if any due dose needs an alert modal immediately
      const firstDue = allDoses.find((d) => d.is_due && d.status !== 'Taken');
      if (firstDue && !dueModalDose) {
        setDueModalDose(firstDue);
      }
    } catch (e) {
      console.error('Error fetching MediSathi data:', e);
    }
  }, [dueModalDose]);

  // Initial load
  useEffect(() => {
    requestNotificationPermission();
    refreshAllData();
  }, [refreshAllData]);

  // 30-Second In-App Background Scheduler Loop
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const schedRes = await getTodaySchedule();
        setSchedule(schedRes);
        const allDoses = [
          ...schedRes.morning,
          ...schedRes.afternoon,
          ...schedRes.evening,
          ...schedRes.night,
        ];

        // Evaluate reminders (notification + voice)
        evaluateReminders(
          allDoses,
          settings.language,
          settings.voice_enabled,
          (triggeredDose) => {
            setDueModalDose(triggeredDose);
          }
        );
      } catch (e) {
        console.warn('Scheduler interval error:', e);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [settings.language, settings.voice_enabled]);

  // Pill Taken Action Handler
  const handlePillTaken = async (doseId: number) => {
    try {
      await markDoseTaken(doseId);
      clearFiredRecord(doseId);
      setDueModalDose(null);
      await refreshAllData();
    } catch (e) {
      console.error('Error marking pill taken:', e);
    }
  };

  // Snooze Action Handler
  const handlePillSnooze = async (doseId: number) => {
    try {
      await snoozeDose(doseId);
      setDueModalDose(null);
      await refreshAllData();
    } catch (e) {
      console.error('Error snoozing pill:', e);
    }
  };

  const handleLanguageChange = (newLang: Language) => {
    setSettings((prev) => ({ ...prev, language: newLang }));
  };

  const handleToggleVoice = () => {
    setSettings((prev) => ({ ...prev, voice_enabled: !prev.voice_enabled }));
  };

  return (
    <div className="mobile-container flex flex-col min-h-screen bg-slate-50 text-slate-800">
      {/* Top Accessible Header */}
      <Header
        language={settings.language}
        onLanguageChange={handleLanguageChange}
        voiceEnabled={settings.voice_enabled}
        onToggleVoice={handleToggleVoice}
        onOpenSettings={() => setSettingsModalOpen(true)}
        isDemoMode={isDemoMode}
        simulatedTimeStr={simulatedTimeStr}
      />

      {/* Main Tab Viewport */}
      <main className="flex-1">
        {activeTab === 'today' && (
          <TodayTab
            schedule={schedule}
            alerts={alerts}
            language={settings.language}
            voiceEnabled={settings.voice_enabled}
            onTaken={handlePillTaken}
            onSnooze={handlePillSnooze}
            onOpenDueModal={(dose) => setDueModalDose(dose)}
          />
        )}

        {activeTab === 'scan_rx' && (
          <ScanRxTab
            language={settings.language}
            onMedicineAdded={refreshAllData}
            onNavigateToToday={() => setActiveTab('today')}
          />
        )}

        {activeTab === 'stock' && (
          <StockTab
            inventory={inventory}
            language={settings.language}
            onRefreshInventory={refreshAllData}
          />
        )}

        {activeTab === 'pill_scanner' && (
          <PillScannerTab
            language={settings.language}
            onMedicineAdded={refreshAllData}
            onNavigateToToday={() => setActiveTab('today')}
          />
        )}
      </main>

      {/* Mandatory Persistent Disclaimer Footer */}
      <footer className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 text-center text-[11px] text-slate-500 font-medium pb-20">
        <p>{t.disclaimer}</p>
      </footer>

      {/* Bottom Accessible Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        language={settings.language}
        dueCount={schedule?.summary?.due || 0}
        alertCount={alerts.filter((a) => !a.acknowledged).length}
      />

      {/* Full-screen Due Dose Alert Modal */}
      {dueModalDose && (
        <DueAlertModal
          dose={dueModalDose}
          language={settings.language}
          voiceEnabled={settings.voice_enabled}
          onTaken={handlePillTaken}
          onSnooze={handlePillSnooze}
          onClose={() => setDueModalDose(null)}
        />
      )}

      {/* Settings Modal & Dev Tools */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onSettingsUpdated={(newSettings) => setSettings(newSettings)}
        onRefreshData={refreshAllData}
      />
    </div>
  );
};
