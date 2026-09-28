import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  AlertTriangle,
  CheckCircle,
  Plus,
  History,
  Sparkles,
  Info,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';
import { PillIdentifyResponse, ScanHistoryItem, Language } from '../types';
import { translations } from '../i18n';
import { identifyPill, getScans, createMedicine } from '../api';

interface PillScannerTabProps {
  language: Language;
  onMedicineAdded: () => void;
  onNavigateToToday: () => void;
}

export const PillScannerTab: React.FC<PillScannerTabProps> = ({
  language,
  onMedicineAdded,
  onNavigateToToday,
}) => {
  const t = translations[language];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pillResult, setPillResult] = useState<PillIdentifyResponse | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [addedSuccess, setAddedSuccess] = useState<boolean>(false);

  const fetchHistory = async () => {
    try {
      const scans = await getScans();
      setHistory(scans.filter((s) => s.type === 'pill'));
    } catch (e) {
      console.warn('Could not fetch scan history:', e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleScanSample = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await identifyPill();
      setPillResult(res);
      fetchHistory();
    } catch (e) {
      setErrorMsg('Could not identify pill sample.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await identifyPill(file);
      setPillResult(res);
      fetchHistory();
    } catch (e) {
      setErrorMsg('Failed to process image. Ensure good lighting and focus on pill imprint.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToMyMedicines = async () => {
    if (!pillResult) return;
    try {
      await createMedicine({
        name: pillResult.probable_drug_name,
        strength: pillResult.strength || '650 mg',
        dosage: '1 tablet',
        route: 'Oral',
        frequency: 'As Needed',
        timing: ['morning', 'night'],
        food_instruction: 'after_food',
        duration_days: 10,
        total_qty: 10,
        special_instructions: pillResult.medical_purpose,
      });
      setAddedSuccess(true);
      onMedicineAdded();
      setTimeout(() => {
        setAddedSuccess(false);
        onNavigateToToday();
      }, 1500);
    } catch (e) {
      setErrorMsg('Failed to add medicine to schedule.');
    }
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Title */}
      <div className="text-center pt-1">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t.pillScannerTitle}</h2>
        <p className="text-sm text-slate-600 mt-1 max-w-xs mx-auto">{t.pillScannerSubtitle}</p>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* Camera / Upload Action Box */}
      {!loading && (
        <div className="bg-white rounded-3xl p-6 border-2 border-dashed border-teal-300 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-700 mx-auto flex items-center justify-center">
            <Camera className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full tap-target py-3 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-2xl font-bold text-base shadow flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Camera className="w-5 h-5" />
              <span>{t.pointCamera}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full tap-target py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-base border border-slate-300 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Upload className="w-5 h-5 text-slate-500" />
              <span>{t.uploadPillPhoto}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={handleScanSample}
              className="w-full py-2.5 px-3 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>{t.loadSamplePill} (Instant 3-Min Demo)</span>
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-lg font-bold text-slate-800">{t.analyzingPill}</p>
          <p className="text-xs text-slate-500">Evaluating shape, markings, color, and packaging text with Gemini Vision...</p>
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-rose-800 text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Identification Result Screen */}
      {pillResult && !loading && (
        <div className="bg-white rounded-3xl p-5 border-2 border-teal-500 shadow-md space-y-4 animate-fade-in">
          {/* Prominent Mandatory Safety Disclaimer Banner */}
          <div className="p-3.5 bg-amber-50 rounded-2xl border-2 border-amber-400 text-amber-950 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <strong className="block font-black text-amber-900 uppercase tracking-wide">
                Medical Safety Disclaimer
              </strong>
              <span>{pillResult.safety_disclaimer}</span>
            </div>
          </div>

          {/* Primary Drug Info Card */}
          <div className="text-center pt-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
              {pillResult.reliability_level} Reliability ({Math.round(pillResult.confidence_score * 100)}% match)
            </span>

            <h3 className="text-2xl font-black text-slate-900 mt-2">
              {pillResult.probable_drug_name}
            </h3>
            {pillResult.strength && (
              <p className="text-lg font-bold text-teal-700">{pillResult.strength}</p>
            )}
          </div>

          {/* Details breakdown */}
          <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            {pillResult.active_ingredient && (
              <div>
                <strong className="text-slate-900 block font-bold mb-0.5">{t.activeIngredient}:</strong>
                <span className="text-sm font-medium">{pillResult.active_ingredient}</span>
              </div>
            )}

            <div>
              <strong className="text-slate-900 block font-bold mb-0.5">{t.medicalPurpose}:</strong>
              <span className="text-sm font-medium text-slate-800">{pillResult.medical_purpose}</span>
            </div>

            <div>
              <strong className="text-slate-900 block font-bold mb-0.5">{t.generalDosage}:</strong>
              <span className="text-sm font-medium text-slate-800">{pillResult.general_dosage}</span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="font-bold text-slate-900">{t.expiryStatus}:</span>
              <span className="px-2.5 py-0.5 rounded-full font-bold text-emerald-800 bg-emerald-100">
                {pillResult.expiry_status}
              </span>
            </div>

            {pillResult.alternative_possibilities?.length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">Other possibilities:</span>
                <div className="flex flex-wrap gap-1">
                  {pillResult.alternative_possibilities.map((alt, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-200 rounded text-[11px] text-slate-700">
                      {alt}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Add to my medicines action button */}
          <button
            onClick={handleAddToMyMedicines}
            disabled={addedSuccess}
            className="w-full btn-huge bg-teal-700 hover:bg-teal-800 text-white rounded-2xl flex items-center justify-center gap-2.5 shadow-md active:scale-95 transition-all text-lg font-black"
          >
            {addedSuccess ? (
              <>
                <CheckCircle className="w-6 h-6 text-emerald-300" />
                <span>Added to Schedule!</span>
              </>
            ) : (
              <>
                <Plus className="w-6 h-6" />
                <span>{t.addToMyMedsBtn}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Scan History Section */}
      <div className="mt-6 pt-4 border-t border-slate-200">
        <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
          <History className="w-4 h-4 text-teal-600" />
          <span>{t.scanHistoryTitle}</span>
        </h4>

        {history.length === 0 ? (
          <p className="text-xs text-slate-400 italic p-3 text-center">{t.noScansYet}</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 5).map((scan) => {
              const res = scan.result || {};
              return (
                <div
                  key={scan.id}
                  className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs"
                >
                  <div>
                    <strong className="block text-sm font-bold text-slate-900">
                      {res.probable_drug_name || 'Scanned Pill'}
                    </strong>
                    <span className="text-xs text-slate-500 font-medium">
                      {res.strength || ''} &bull; {res.medical_purpose || 'General medicine'}
                    </span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 shrink-0">
                    {res.reliability_level || 'Identified'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
