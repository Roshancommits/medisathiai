import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  AlertTriangle,
  CheckCircle,
  Plus,
  History,
  Sparkles,
  Video
} from 'lucide-react';
import { PillIdentifyResponse, ScanHistoryItem, Language } from '../types';
import { translations } from '../i18n';
import { identifyPill, getScans, createMedicine } from '../api';
import { LiveCamera } from '../components/LiveCamera';

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

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pillResult, setPillResult] = useState<PillIdentifyResponse | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [addedSuccess, setAddedSuccess] = useState<boolean>(false);
  const [showLiveCamera, setShowLiveCamera] = useState<boolean>(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

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

  const processBlob = async (blob: Blob, preview?: string) => {
    if (preview) setCapturedPreview(preview);
    setLoading(true);
    setErrorMsg(null);
    setPillResult(null);
    try {
      const res = await identifyPill(blob as File);
      setPillResult(res);
      fetchHistory();
    } catch (e) {
      setErrorMsg('Failed to identify pill. Ensure good lighting and focus on the imprint/packaging.');
    } finally {
      setLoading(false);
    }
  };

  const handleLiveCameraCapture = async (blob: Blob) => {
    setShowLiveCamera(false);
    const previewUrl = URL.createObjectURL(blob);
    await processBlob(blob, previewUrl);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    await processBlob(file, previewUrl);
    e.target.value = '';
  };

  const handleScanSample = async () => {
    setLoading(true);
    setErrorMsg(null);
    setCapturedPreview(null);
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

  const handleRescan = () => {
    setPillResult(null);
    setCapturedPreview(null);
    setErrorMsg(null);
    setAddedSuccess(false);
  };

  return (
    <>
      {showLiveCamera && (
        <LiveCamera
          mode="pill"
          onCapture={handleLiveCameraCapture}
          onClose={() => setShowLiveCamera(false)}
        />
      )}

      <div className="p-4 pb-24 space-y-4">
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

        {/* Action Box — when no result */}
        {!pillResult && !loading && (
          <div className="bg-white rounded-3xl p-6 border-2 border-dashed border-amber-300 shadow-sm text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
              <Camera className="w-9 h-9" />
            </div>

            {/* PRIMARY: Live Camera */}
            <button
              onClick={() => setShowLiveCamera(true)}
              className="w-full tap-target py-4 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold text-base shadow-lg flex items-center justify-center gap-2.5 transition-all active:scale-95"
            >
              <Video className="w-5 h-5" />
              <span>Open Live Camera Scanner</span>
            </button>

            {/* SECONDARY: Gallery upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full tap-target py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-base border border-slate-300 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Upload className="w-5 h-5 text-slate-500" />
              <span>{t.uploadPillPhoto}</span>
            </button>

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={handleScanSample}
                className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>{t.loadSamplePill} (Demo)</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-lg font-bold text-slate-800">{t.analyzingPill}</p>
            <p className="text-xs text-slate-500">
              Evaluating shape, markings, color, and packaging text with Gemini Vision…
            </p>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-rose-800 text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="flex-1">
              <span>{errorMsg}</span>
              <button onClick={handleRescan} className="block mt-1 underline text-xs font-bold">
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Result Card */}
        {pillResult && !loading && (
          <div className="bg-white rounded-3xl p-5 border-2 border-amber-500 shadow-md space-y-4">
            {/* Captured preview thumbnail */}
            {capturedPreview && (
              <div className="rounded-xl overflow-hidden border border-slate-200 max-h-36 flex items-center justify-center bg-black/5">
                <img src={capturedPreview} alt="Scanned pill" className="max-h-36 object-contain" />
              </div>
            )}

            {/* Safety disclaimer */}
            <div className="p-3.5 bg-amber-50 rounded-2xl border-2 border-amber-400 text-amber-950 flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong className="block font-black text-amber-900 uppercase tracking-wide">
                  Medical Safety Disclaimer
                </strong>
                <span>{pillResult.safety_disclaimer}</span>
              </div>
            </div>

            {/* Drug info */}
            <div className="text-center pt-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                {pillResult.reliability_level} Reliability ({Math.round(pillResult.confidence_score * 100)}% match)
              </span>
              <h3 className="text-2xl font-black text-slate-900 mt-2">{pillResult.probable_drug_name}</h3>
              {pillResult.strength && (
                <p className="text-lg font-bold text-amber-700">{pillResult.strength}</p>
              )}
            </div>

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

            <div className="flex gap-2">
              <button
                onClick={handleRescan}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm border border-slate-300"
              >
                Scan Again
              </button>
              <button
                onClick={handleAddToMyMedicines}
                disabled={addedSuccess}
                className="flex-[2] btn-huge bg-teal-700 hover:bg-teal-800 text-white rounded-2xl flex items-center justify-center gap-2.5 shadow-md active:scale-95 transition-all text-lg font-black"
              >
                {addedSuccess ? (
                  <>
                    <CheckCircle className="w-6 h-6 text-emerald-300" />
                    <span>Added!</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-6 h-6" />
                    <span>{t.addToMyMedsBtn}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Scan History */}
        <div className="mt-6 pt-4 border-t border-slate-200">
          <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
            <History className="w-4 h-4 text-amber-600" />
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
                    className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-sm"
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
    </>
  );
};
