import React, { useState } from 'react';
import { Package, AlertCircle, PlusCircle, Check, Calendar, ShoppingBag, X } from 'lucide-react';
import { InventoryItem, Language } from '../types';
import { translations } from '../i18n';
import { refillMedicine } from '../api';

interface StockTabProps {
  inventory: InventoryItem[];
  language: Language;
  onRefreshInventory: () => void;
}

export const StockTab: React.FC<StockTabProps> = ({
  inventory,
  language,
  onRefreshInventory,
}) => {
  const t = translations[language];
  const [refillModalItem, setRefillModalItem] = useState<InventoryItem | null>(null);
  const [refillQty, setRefillQty] = useState<number>(30);
  const [refillSuccess, setRefillSuccess] = useState<boolean>(false);

  const handleRefillConfirm = async () => {
    if (!refillModalItem) return;
    try {
      await refillMedicine(refillModalItem.id, refillQty);
      setRefillSuccess(true);
      setTimeout(() => {
        setRefillSuccess(false);
        setRefillModalItem(null);
        onRefreshInventory();
      }, 1200);
    } catch (e) {
      console.error('Refill failed:', e);
    }
  };

  const handleDownloadDoctorICS = (medName: string) => {
    window.location.href = `/api/calendar/followup.ics?medicine_name=${encodeURIComponent(medName)}`;
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Title */}
      <div className="text-center pt-1">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t.stockTitle}</h2>
        <p className="text-sm text-slate-600 mt-1 max-w-xs mx-auto">{t.stockSubtitle}</p>
      </div>

      {/* Stock Cards List */}
      <div className="space-y-4">
        {inventory.map((item) => {
          const isCritical = item.percent_remaining <= 20 || item.days_remaining <= 2;
          const isModerate = item.percent_remaining > 20 && item.percent_remaining <= 50;

          // Progress bar color
          const barColor = isCritical
            ? 'bg-rose-500'
            : isModerate
            ? 'bg-amber-500'
            : 'bg-emerald-500';

          const badgeBg = isCritical
            ? 'bg-rose-100 text-rose-800 border-rose-300'
            : isModerate
            ? 'bg-amber-100 text-amber-800 border-amber-300'
            : 'bg-emerald-100 text-emerald-800 border-emerald-300';

          return (
            <div
              key={item.id}
              className={`bg-white rounded-3xl p-5 border-2 shadow-sm transition-all ${
                isCritical ? 'border-rose-400 bg-rose-50/15 ring-2 ring-rose-200' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-900 leading-tight">
                      {item.name}
                    </h3>
                    {item.strength && (
                      <span className="text-sm font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                        {item.strength}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Started on {item.start_date} ({item.elapsed_days} of {item.duration_days} days elapsed)
                  </p>
                </div>

                {/* Stock % badge */}
                <div className={`px-2.5 py-1 rounded-full border text-xs font-black shrink-0 ${badgeBg}`}>
                  {item.percent_remaining}% Stock
                </div>
              </div>

              {/* Visual Progress Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                  <span>{item.remaining_qty} pills remaining</span>
                  <span>{item.days_remaining} {t.daysRemaining}</span>
                </div>
                <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.min(100, Math.max(5, item.percent_remaining))}%` }}
                  />
                </div>
              </div>

              {/* 2nd Course Critical Alert Box */}
              {isCritical && (
                <div className="mt-3.5 p-3 rounded-2xl bg-rose-100 border border-rose-300 text-rose-900 flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="block font-black text-rose-950 uppercase tracking-wide">
                      {t.secondCourseTitle}
                    </strong>
                    <span>Only {item.days_remaining} days of medication left. Replenish now to prevent treatment lapse.</span>
                  </div>
                </div>
              )}

              {/* Actions row */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setRefillModalItem(item);
                    setRefillQty(30);
                  }}
                  className="tap-target py-2 px-3.5 bg-slate-100 hover:bg-teal-50 text-teal-800 rounded-xl font-bold text-sm border border-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  <PlusCircle className="w-4 h-4 text-teal-600" />
                  <span>{t.refillBtn}</span>
                </button>

                {isCritical && (
                  <button
                    onClick={() => handleDownloadDoctorICS(item.name)}
                    className="tap-target py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                    title="Book doctor follow-up appointment"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Doctor .ICS</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Refill Quantity Modal */}
      {refillModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setRefillModalItem(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 mx-auto flex items-center justify-center mb-3">
                <Package className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">{t.refillModalTitle}</h3>
              <p className="text-sm text-slate-600 mt-1">
                Updating stock for <strong className="text-slate-900">{refillModalItem.name}</strong>
              </p>
            </div>

            {refillSuccess ? (
              <div className="my-5 p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-center font-bold text-sm">
                <Check className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                Stock added successfully! Alert status reset.
              </div>
            ) : (
              <div className="my-5 space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {t.addQuantityLabel}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={refillQty}
                      onChange={(e) => setRefillQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-lg text-slate-900 text-center"
                    />
                    <div className="flex gap-1">
                      {[15, 30, 60].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setRefillQty(q)}
                          className="px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
                        >
                          +{q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleRefillConfirm}
                  className="w-full tap-target py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-base shadow transition-all active:scale-95"
                >
                  {t.confirmRefillBtn}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
