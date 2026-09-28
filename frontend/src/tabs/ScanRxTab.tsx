import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  FileText,
  Clock,
  Utensils,
  CheckCircle2,
  Key,
  Eye,
  RefreshCw
} from 'lucide-react';
import { ParsedMedicineItem, PrescriptionParseResponse, Language } from '../types';
import { translations } from '../i18n';
import { parsePrescription, createMedicine, updateApiKey } from '../api';

interface ScanRxTabProps {
  language: Language;
  onMedicineAdded: () => void;
  onNavigateToToday: () => void;
}

export const ScanRxTab: React.FC<ScanRxTabProps> = ({
  language,
  onMedicineAdded,
  onNavigateToToday,
}) => {
  const t = translations[language];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<PrescriptionParseResponse | null>(null);
  const [editableMeds, setEditableMeds] = useState<ParsedMedicineItem[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Optional live Gemini API Key configuration
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [customKey, setCustomKey] = useState<string>('');
  const [keySavedMsg, setKeySavedMsg] = useState<string | null>(null);

  // Fallback / Sample Prescription loader
  const handleLoadSample = async () => {
    setLoading(true);
    setErrorMsg(null);
    setImagePreview(null);
    try {
      const res = await parsePrescription();
      setParseResult(res);
      setEditableMeds(res.medicines);
    } catch (e: any) {
      setErrorMsg('Could not process prescription image. Please try again or enter manually.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create a local blob URL so the user sees their document immediately
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await parsePrescription(file);
      setParseResult(res);
      setEditableMeds(res.medicines);
    } catch (e: any) {
      setErrorMsg('Failed to read prescription. Please ensure the photo is clear and well-lit.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!customKey.trim()) return;
    try {
      const res = await updateApiKey(customKey.trim());
      setKeySavedMsg(res.message);
      setTimeout(() => setKeySavedMsg(null), 3000);
      setShowKeyInput(false);
    } catch (e) {
      setErrorMsg('Could not update API key.');
    }
  };

  const updateMedField = (index: number, field: keyof ParsedMedicineItem, value: any) => {
    const updated = [...editableMeds];
    updated[index] = { ...updated[index], [field]: value };
    setEditableMeds(updated);
  };

  const toggleTiming = (index: number, slot: string) => {
    const updated = [...editableMeds];
    const current = updated[index].timing || [];
    if (current.includes(slot)) {
      updated[index].timing = current.filter((s) => s !== slot);
    } else {
      updated[index].timing = [...current, slot];
    }
    setEditableMeds(updated);
  };

  const handleRemoveMed = (index: number) => {
    setEditableMeds(editableMeds.filter((_, i) => i !== index));
  };

  const handleAddManualMed = () => {
    const newMed: ParsedMedicineItem = {
      name: '',
      strength: '500 mg',
      dosage: '1 tablet',
      route: 'Oral',
      frequency: 'Twice Daily',
      timing: ['morning', 'night'],
      food_instruction: 'after_food',
      duration_days: 10,
      total_qty: 20,
      confidence: 1.0,
      confidence_flags: [],
    };
    setEditableMeds([...editableMeds, newMed]);
  };

  const handleConfirmAndSave = async () => {
    if (editableMeds.length === 0) return;
    setSaving(true);
    try {
      for (const med of editableMeds) {
        if (!med.name.trim()) continue;
        await createMedicine({
          name: med.name,
          strength: med.strength,
          dosage: med.dosage,
          route: med.route,
          frequency: med.frequency,
          timing: med.timing,
          food_instruction: med.food_instruction,
          duration_days: med.duration_days,
          total_qty: med.total_qty,
          special_instructions: med.special_instructions,
        });
      }
      setSuccessMsg(t.saveSuccess);
      onMedicineAdded();
      setTimeout(() => {
        setParseResult(null);
        setEditableMeds([]);
        setSuccessMsg(null);
        onNavigateToToday();
      }, 1500);
    } catch (e: any) {
      setErrorMsg('Failed to save medicines to schedule.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Title & Guidance */}
      <div className="text-center pt-1">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t.scanRxTitle}</h2>
        <p className="text-sm text-slate-600 mt-1 max-w-xs mx-auto">{t.scanRxSubtitle}</p>
      </div>

      {/* API Key Toggle Banner */}
      <div className="bg-slate-100 p-2.5 rounded-2xl border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-medium">
          <Key className="w-3.5 h-3.5 text-teal-700" />
          <span>Gemini Live Vision AI</span>
        </div>
        <button
          onClick={() => setShowKeyInput(!showKeyInput)}
          className="text-teal-800 font-bold hover:underline"
        >
          {showKeyInput ? 'Hide Key Setup' : 'Enter API Key (Optional)'}
        </button>
      </div>

      {showKeyInput && (
        <div className="p-3 bg-white rounded-2xl border border-teal-300 shadow-sm space-y-2 text-xs">
          <p className="text-slate-600 font-medium">
            Paste your Google Gemini API key below to enable real-time multimodal OCR from the live Gemini API:
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="AIzaSy..."
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              className="flex-1 p-2 rounded-xl border border-slate-300 font-mono text-xs"
            />
            <button
              onClick={handleSaveApiKey}
              className="px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold"
            >
              Save Key
            </button>
          </div>
          {keySavedMsg && <p className="text-emerald-700 font-bold">{keySavedMsg}</p>}
        </div>
      )}

      {/* Hidden File Inputs for Camera and Gallery */}
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

      {/* Upload & Action Card */}
      {!parseResult && !loading && (
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
              <span>{t.takePhoto}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full tap-target py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-base border border-slate-300 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Upload className="w-5 h-5 text-slate-500" />
              <span>{t.uploadImage} (JPG / PNG)</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={handleLoadSample}
              className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>{t.loadSampleRx} (Instant 3-Min Demo)</span>
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-lg font-bold text-slate-800">{t.analyzingRx}</p>
          <p className="text-xs text-slate-500">Extracting medicine names, dosages, timings & food instructions from document...</p>
        </div>
      )}

      {/* Error Toast */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-rose-800 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
          <p className="text-sm font-semibold">{errorMsg}</p>
        </div>
      )}

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-800 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <p className="text-base font-bold">{successMsg}</p>
        </div>
      )}

      {/* Review Screen with Editable Cards & Uploaded Document Preview */}
      {editableMeds.length > 0 && !loading && (
        <div className="space-y-4">
          {/* Document Preview Card if image was uploaded */}
          {imagePreview && (
            <div className="bg-slate-900 text-white rounded-2xl p-3 border border-slate-700 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> Scanned Document Preview
                </span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] text-slate-300 hover:text-white underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Change Photo
                </button>
              </div>
              <div className="max-h-48 overflow-hidden rounded-xl border border-slate-600 flex items-center justify-center bg-black/40">
                <img
                  src={imagePreview}
                  alt="Scanned prescription document"
                  className="max-h-48 object-contain w-full"
                />
              </div>
            </div>
          )}

          <div className="bg-teal-50 p-4 rounded-2xl border border-teal-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-teal-950">{t.reviewPrescription}</h3>
              <p className="text-xs text-teal-800 mt-0.5">{t.reviewSubtitle}</p>
            </div>
            {parseResult && (
              <span className="text-xs font-black px-2.5 py-1 rounded-full bg-teal-200 text-teal-900 border border-teal-300">
                {Math.round(parseResult.confidence_score * 100)}% {t.confidenceScore}
              </span>
            )}
          </div>

          {/* List of Editable Medicine Cards */}
          <div className="space-y-3">
            {editableMeds.map((med, index) => {
              const isLowConfidence = med.confidence < 0.9;
              return (
                <div
                  key={index}
                  className={`bg-white rounded-2xl p-4 border-2 shadow-sm space-y-3 ${
                    isLowConfidence ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-900 font-bold">
                      Medicine #{index + 1}
                    </span>
                    {isLowConfidence && (
                      <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Please Verify
                      </span>
                    )}
                    <button
                      onClick={() => handleRemoveMed(index)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      title="Remove medicine"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Medicine Name & Strength */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-xs font-bold text-slate-700">{t.medicineName}</label>
                      <input
                        type="text"
                        value={med.name}
                        onChange={(e) => updateMedField(index, 'name', e.target.value)}
                        placeholder="e.g. Dexamethasone"
                        className="w-full mt-1 p-2 rounded-xl border border-slate-300 font-bold text-base text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">{t.strength}</label>
                      <input
                        type="text"
                        value={med.strength || ''}
                        onChange={(e) => updateMedField(index, 'strength', e.target.value)}
                        placeholder="50 mg"
                        className="w-full mt-1 p-2 rounded-xl border border-slate-300 font-bold text-sm text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Dosage & Food Instruction */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-700">{t.dosage}</label>
                      <input
                        type="text"
                        value={med.dosage}
                        onChange={(e) => updateMedField(index, 'dosage', e.target.value)}
                        className="w-full mt-1 p-2 rounded-xl border border-slate-300 text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">Food Instruction</label>
                      <select
                        value={med.food_instruction}
                        onChange={(e) => updateMedField(index, 'food_instruction', e.target.value)}
                        className="w-full mt-1 p-2 rounded-xl border border-slate-300 text-sm font-semibold bg-white"
                      >
                        <option value="after_food">{t.afterFood}</option>
                        <option value="before_food">{t.beforeFood}</option>
                        <option value="with_food">{t.withFood}</option>
                        <option value="anytime">{t.anytime}</option>
                      </select>
                    </div>
                  </div>

                  {/* Daily Timing Buttons (Morning, Afternoon, Evening, Night) */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">{t.timings}</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'morning', label: t.morning },
                        { id: 'afternoon', label: t.afternoon },
                        { id: 'evening', label: t.evening },
                        { id: 'night', label: t.night },
                      ].map((slot) => {
                        const active = med.timing?.includes(slot.id);
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => toggleTiming(index, slot.id)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
                              active
                                ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Duration and Total Quantity */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-700">{t.durationDays}</label>
                      <input
                        type="number"
                        value={med.duration_days}
                        onChange={(e) => updateMedField(index, 'duration_days', parseInt(e.target.value) || 1)}
                        className="w-full mt-1 p-2 rounded-xl border border-slate-300 text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700">{t.totalQuantity}</label>
                      <input
                        type="number"
                        value={med.total_qty}
                        onChange={(e) => updateMedField(index, 'total_qty', parseFloat(e.target.value) || 1)}
                        className="w-full mt-1 p-2 rounded-xl border border-slate-300 text-sm font-semibold"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Manual Medicine Button */}
          <button
            onClick={handleAddManualMed}
            className="w-full tap-target py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-bold text-sm border border-slate-300 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t.manualAddBtn}</span>
          </button>

          {/* Huge Confirm & Auto-generate Schedule Button */}
          <button
            onClick={handleConfirmAndSave}
            disabled={saving}
            className="w-full btn-huge bg-teal-700 hover:bg-teal-800 text-white rounded-2xl flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all text-xl font-black mt-4"
          >
            <CheckCircle2 className="w-7 h-7 text-teal-200" />
            <span>{saving ? 'Generating Schedule...' : t.saveAndScheduleBtn}</span>
          </button>
        </div>
      )}
    </div>
  );
};
