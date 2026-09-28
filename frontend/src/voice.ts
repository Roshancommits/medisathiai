import { Language } from './types';

export interface VoiceStatus {
  hasSpeechSynthesis: boolean;
  voiceInstalled: boolean;
  voiceName: string;
  missingVoiceMessage: string | null;
}

// Tone Chime generator using Web Audio API for guaranteed acoustic alerting
export function playAlertChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Two pleasant ascending notes (C5 -> G5)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(783.99, now + 0.15); // G5

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (e) {
    console.warn('AudioContext chime failed:', e);
  }
}

export function getVoiceForLanguage(lang: Language): { voice: SpeechSynthesisVoice | null; status: VoiceStatus } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return {
      voice: null,
      status: {
        hasSpeechSynthesis: false,
        voiceInstalled: false,
        voiceName: '',
        missingVoiceMessage: 'Speech synthesis is not supported on this browser.'
      }
    };
  }

  const voices = window.speechSynthesis.getVoices();
  const langPrefix = lang.split('-')[0]; // 'en', 'hi', 'gu'

  // Exact match (e.g. 'gu-IN' or 'hi-IN')
  let matchedVoice = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase());

  // Prefix match (e.g. 'gu' or 'hi')
  if (!matchedVoice) {
    matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
  }

  // Fallback for Indian voices
  if (!matchedVoice && (lang === 'hi-IN' || lang === 'gu-IN')) {
    matchedVoice = voices.find(v => v.lang.toLowerCase().includes('in') || v.lang.toLowerCase().includes('en-in'));
  }

  // Ultimate fallback to default voice
  if (!matchedVoice && voices.length > 0) {
    matchedVoice = voices.find(v => v.default) || voices[0];
  }

  const exactInstalled = voices.some(v => v.lang.toLowerCase().startsWith(langPrefix));
  let missingMsg: string | null = null;

  if (!exactInstalled && lang === 'gu-IN') {
    missingMsg = 'Gujarati voice not found on your device. MediSathi is using Hindi/English fallback. You can install Gujarati in Windows Settings > Time & Language > Speech.';
  } else if (!exactInstalled && lang === 'hi-IN') {
    missingMsg = 'Hindi voice not found on your device. MediSathi is using English fallback. You can install Hindi voice pack in Windows Settings > Time & Language > Speech.';
  }

  return {
    voice: matchedVoice || null,
    status: {
      hasSpeechSynthesis: true,
      voiceInstalled: exactInstalled,
      voiceName: matchedVoice ? matchedVoice.name : 'System Default',
      missingVoiceMessage: missingMsg
    }
  };
}

export function speakAlert(
  text: string,
  lang: Language = 'en-IN',
  onMissingVoice?: (msg: string) => void
): Promise<void> {
  return new Promise((resolve) => {
    // Play chime sound first
    playAlertChime();

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve();
      return;
    }

    // Cancel any previous speech
    window.speechSynthesis.cancel();

    const { voice, status } = getVoiceForLanguage(lang);

    if (status.missingVoiceMessage && onMissingVoice) {
      onMissingVoice(status.missingVoiceMessage);
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = lang;
    utterance.rate = 0.9; // Slightly slower pace for elderly comprehension
    utterance.pitch = 1.0;

    utterance.onend = () => resolve();
    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}
