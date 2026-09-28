import React from 'react';
import { CalendarCheck, FileScan, Package, Camera } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../i18n';

export type TabType = 'today' | 'scan_rx' | 'stock' | 'pill_scanner';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  language: Language;
  dueCount?: number;
  alertCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  language,
  dueCount = 0,
  alertCount = 0,
}) => {
  const t = translations[language];

  const tabs: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'today',
      label: t.tabToday,
      icon: <CalendarCheck className="w-6 h-6" />,
      badge: dueCount > 0 ? dueCount : undefined,
    },
    {
      id: 'scan_rx',
      label: t.tabScanRx,
      icon: <FileScan className="w-6 h-6" />,
    },
    {
      id: 'stock',
      label: t.tabStock,
      icon: <Package className="w-6 h-6" />,
      badge: alertCount > 0 ? alertCount : undefined,
    },
    {
      id: 'pill_scanner',
      label: t.tabPillScanner,
      icon: <Camera className="w-6 h-6" />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-slate-200 shadow-lg">
      <div className="max-w-[440px] mx-auto grid grid-cols-4 px-1 py-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`tap-target flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all relative ${
                isActive
                  ? 'bg-teal-50 text-teal-800 font-bold border-b-4 border-teal-600'
                  : 'text-slate-600 hover:text-teal-700 hover:bg-slate-50 font-medium'
              }`}
              aria-selected={isActive}
              role="tab"
            >
              <div className="relative">
                {tab.icon}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-red-600 text-white text-[11px] font-extrabold rounded-full w-5 h-5 flex items-center justify-center shadow-sm animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-xs mt-1 leading-tight tracking-tight text-center">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
