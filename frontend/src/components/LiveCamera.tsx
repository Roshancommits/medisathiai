import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, X, ZoomIn, SwitchCamera, FlashlightIcon } from 'lucide-react';

interface LiveCameraProps {
  onCapture: (blob: Blob, mimeType: string) => void;
  onClose: () => void;
  mode?: 'rx' | 'pill';
}

export const LiveCamera: React.FC<LiveCameraProps> = ({ onCapture, onClose, mode = 'rx' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    stopStream();
    setIsReady(false);
    setError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsReady(true);
        };
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : 'Could not open camera. Try uploading an image instead.'
      );
    }
  }, [stopStream]);

  useEffect(() => {
    startCamera(facingMode);
    return () => stopStream();
  }, [facingMode, startCamera, stopStream]);

  // Toggle torch if supported
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    const capabilities = track.getCapabilities() as any;
    if (!capabilities.torch) return;
    const newVal = !torchOn;
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: newVal }] });
      setTorchOn(newVal);
    } catch (_) {}
  };

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // Flash effect
    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 300);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          stopStream();
          onCapture(blob, 'image/jpeg');
        }
      },
      'image/jpeg',
      0.92
    );
  }, [isReady, stopStream, onCapture]);

  // Countdown auto-capture (useful for prescription scan)
  const startCountdown = () => {
    setCountdown(3);
    let c = 3;
    const iv = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(iv);
        setCountdown(null);
        handleCapture();
      }
    }, 1000);
  };

  const overlay =
    mode === 'rx'
      ? 'Place prescription flat. Ensure all text is visible and well-lit.'
      : 'Point camera at pill, blister strip, or packaging.';

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 pt-safe py-3 bg-black/80 backdrop-blur-sm">
        <button
          onClick={() => { stopStream(); onClose(); }}
          className="p-2 rounded-full bg-white/10 text-white active:bg-white/20"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="text-white font-bold text-sm">
          {mode === 'rx' ? '📋 Scan Prescription' : '💊 Scan Pill'}
        </span>
        <div className="flex gap-2">
          <button
            onClick={toggleTorch}
            className={`p-2 rounded-full text-white ${torchOn ? 'bg-yellow-400/60' : 'bg-white/10'} active:bg-white/20`}
          >
            <span className="text-base">🔦</span>
          </button>
          <button
            onClick={() => setFacingMode((f) => (f === 'environment' ? 'user' : 'environment'))}
            className="p-2 rounded-full bg-white/10 text-white active:bg-white/20"
          >
            <span className="text-base">🔄</span>
          </button>
        </div>
      </div>

      {/* Camera Viewfinder */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Capture Flash */}
        {captureFlash && (
          <div className="absolute inset-0 bg-white opacity-70 pointer-events-none transition-opacity" />
        )}

        {/* Countdown overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-white font-black text-8xl drop-shadow-2xl animate-pulse">
              {countdown}
            </span>
          </div>
        )}

        {/* Scanning frame overlay */}
        {isReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`border-2 rounded-2xl ${
                mode === 'rx'
                  ? 'border-teal-400 w-4/5 h-3/5'
                  : 'border-amber-400 w-3/5 h-2/5'
              } shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]`}
            >
              {/* Corner marks */}
              {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
                <div
                  key={i}
                  className={`absolute ${pos} w-5 h-5 ${
                    mode === 'rx' ? 'border-teal-300' : 'border-amber-300'
                  } ${i < 2 ? 'border-t-4' : 'border-b-4'} ${
                    i % 2 === 0 ? 'border-l-4' : 'border-r-4'
                  } rounded-sm`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Guide label below frame */}
        {isReady && (
          <div className="absolute bottom-28 left-0 right-0 flex justify-center pointer-events-none">
            <span className="bg-black/60 text-white text-xs font-semibold px-4 py-2 rounded-full backdrop-blur-sm text-center max-w-xs">
              {overlay}
            </span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center gap-4">
            <span className="text-4xl">📵</span>
            <p className="text-white font-semibold text-sm">{error}</p>
            <button
              onClick={() => { stopStream(); onClose(); }}
              className="mt-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl font-bold"
            >
              Use Upload Instead
            </button>
          </div>
        )}

        {/* Loading spinner */}
        {!isReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="w-10 h-10 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Bottom Capture Controls */}
      {isReady && (
        <div className="bg-black/80 backdrop-blur-sm py-6 px-6 flex items-center justify-center gap-8">
          {/* Timer capture button */}
          <button
            onClick={startCountdown}
            disabled={countdown !== null}
            className="p-3 rounded-full bg-white/10 text-white active:bg-white/20 flex flex-col items-center gap-1"
          >
            <span className="text-2xl">⏱️</span>
            <span className="text-[10px] text-white/70 font-medium">Timer</span>
          </button>

          {/* Main shutter */}
          <button
            onClick={handleCapture}
            className="w-20 h-20 rounded-full bg-white border-4 border-teal-400 shadow-xl flex items-center justify-center active:scale-95 transition-all"
          >
            <div className={`w-16 h-16 rounded-full ${mode === 'rx' ? 'bg-teal-500' : 'bg-amber-500'}`} />
          </button>

          {/* Zoom hint */}
          <button className="p-3 rounded-full bg-white/10 text-white flex flex-col items-center gap-1 opacity-50">
            <span className="text-2xl">🔍</span>
            <span className="text-[10px] text-white/70 font-medium">Pinch</span>
          </button>
        </div>
      )}
    </div>
  );
};
