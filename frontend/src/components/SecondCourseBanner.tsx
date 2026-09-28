import React, { useState } from 'react';
import { AlertCircle, ShoppingBag, Calendar, Check, X, PhoneCall } from 'lucide-react';
import { AlertItem, Language } from '../types';
import { translations } from '../i18n';

interface SecondCourseBannerProps {
  alerts: AlertItem[];
  language: Language;
  onRefillRequested?: (medicineId: number) => void;
}

export const SecondCourseBanner: React.FC<SecondCourseBannerProps> = ({
  alerts,
  language,
  onRefillRequested,
}) => {
  const t = translations[language];
  const [reorderModalOpen, setReorderModalOpen] = useState<boolean>(false);
  const [doctorModalOpen, setDoctorModalOpen] = useState<boolean>(false);
  const [selectedMedName, setSelectedMedName] = useState<string>('');
  const [reorderConfirmed, setReorderConfirmed] = useState<boolean>(false);

  // Filter unacknowledged second_course alerts
  const courseAlerts = alerts.filter(
    (a) => a.type === 'second_course' && !a.acknowledged
  );

  if (courseAlerts.length === 0) return null;

  const currentAlert = courseAlerts[0];
  const medName = currentAlert.medicine_name || 'Medicine';

  const handleOpenReorder = () => {
    setSelectedMedName(medName);
    setReorderConfirmed(false);
    setReorderModalOpen(true);
  };

  const handleOpenDoctor = () => {
    setSelectedMedName(medName);
    setDoctorModalOpen(true);
  };

  const handleDownloadICS = () => {
    window.location.href = `/api/calendar/followup.ics?medicine_name=${encodeURIComponent(medName)}`;
  };

  return (
    <>
      {/* High-priority red banner on Home screen */}
      <section
        role="alert"
        aria-live="assertive"
        className="mx-4 mt-3 mb-4 p-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-lg border-2 border-red-400 relative overflow-hidden"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm shrink-0">
            <AlertCircle className="w-7 h-7 text-white animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white text-red-700">
                {t.secondCourseTitle}
              </span>
            </div>
            <h3 className="text-lg font-bold mt-1 text-white leading-tight">
              {currentAlert.title}
            </h3>
            <p className="text-sm text-red-100 mt-1 leading-snug">
              {currentAlert.message}
            </p>

            {/* Action buttons */}
            <div className="mt-3.5 flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleOpenReorder}
                className="tap-target flex-1 py-2.5 px-3 bg-white hover:bg-red-50 text-red-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
              >
                <ShoppingBag className="w-4 h-4 text-red-600" />
                <span>{t.reorderBtn}</span>
              </button>

              <button
                onClick={handleOpenDoctor}
                className="tap-target flex-1 py-2.5 px-3 bg-red-950/40 hover:bg-red-950/60 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-white/30 transition-transform active:scale-95"
              >
                <Calendar className="w-4 h-4 text-white" />
                <span>{t.doctorFollowupBtn}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Modal 1: Re-order Medicine Placeholder / Instant Order Flow */}
      {reorderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setReorderModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 mx-auto flex items-center justify-center mb-3">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">{t.reorderModalTitle}</h3>
              <p className="text-sm text-slate-600 mt-1">
                Refill requested for <strong className="text-slate-900">{selectedMedName}</strong> (30-day course).
              </p>
            </div>

            {reorderConfirmed ? (
              <div className="my-5 p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-center text-sm font-semibold">
                <Check className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                {t.reorderSuccess}
                <p className="text-xs text-emerald-700 mt-1 font-normal">
                  Caregiver notified via automated message.
                </p>
              </div>
            ) : (
              <div className="my-5 space-y-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                  <div className="flex justify-between font-semibold text-slate-800 mb-1">
                    <span>Pharmacy:</span>
                    <span>Apollo Pharmacy / Local Med</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Package:</span>
                    <span>1 Strip / Bottle ({selectedMedName})</span>
                  </div>
                  <div className="flex justify-between mt-1 text-slate-500">
                    <span>Delivery Option:</span>
                    <span>Doorstep in 2 hours</span>
                  </div>
                </div>

                <button
                  onClick={() => setReorderConfirmed(true)}
                  className="w-full tap-target py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-base shadow transition-all active:scale-95"
                >
                  Send Pharmacy Re-order
                </button>
              </div>
            )}

            <button
              onClick={() => setReorderModalOpen(false)}
              className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Modal 2: Doctor Follow-up Appointment & .ICS Generation */}
      {doctorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setDoctorModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 mx-auto flex items-center justify-center mb-3">
                <Calendar className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">{t.doctorModalTitle}</h3>
              <p className="text-sm text-slate-600 mt-1">
                Schedule follow-up checkup for <strong className="text-slate-900">{selectedMedName}</strong> refill assessment.
              </p>
            </div>

            <div className="my-5 p-3.5 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-rose-950">
                <PhoneCall className="w-4 h-4 text-rose-700" />
                <span>Dr. Arvind Mehta, MD</span>
              </div>
              <p>Recommended Date: In 2 days (10:00 AM)</p>
              <p>Review: Blood sugar & blood pressure parameters</p>
            </div>

            <div className="space-y-2 mb-3">
              <button
                onClick={handleDownloadICS}
                className="w-full tap-target py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-base shadow transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Calendar className="w-5 h-5" />
                <span>Download .ICS Calendar Invite</span>
              </button>
            </div>

            <button
              onClick={() => setDoctorModalOpen(false)}
              className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
