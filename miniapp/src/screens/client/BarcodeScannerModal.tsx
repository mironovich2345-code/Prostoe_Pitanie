import { useEffect, useRef, useState } from 'react';
import { normalizeBarcode } from '../../utils/barcodeScanner';

interface Props {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScannerModal({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let stopped = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (stopped) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;

        const hasBarcodeDetector = 'BarcodeDetector' in window;

        if (hasBarcodeDetector) {
          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            await video.play();
          }
          setStarting(false);

          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          });
          const timer = setInterval(async () => {
            if (detectedRef.current || !videoRef.current || stopped) return;
            try {
              const results: Array<{ rawValue: string }> = await detector.detect(videoRef.current);
              if (results.length > 0 && !detectedRef.current) {
                detectedRef.current = true;
                onDetected(normalizeBarcode(results[0].rawValue));
              }
            } catch {
              // ignore per-frame errors
            }
          }, 300);
          cleanupRef.current = () => clearInterval(timer);
        } else {
          // ZXing fallback — handles srcObject and play() internally
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          if (stopped) return;
          const reader = new BrowserMultiFormatReader();
          const controls = await (reader as any).decodeFromStream(
            stream,
            videoRef.current!,
            (result: any) => {
              if (result && !detectedRef.current) {
                detectedRef.current = true;
                onDetected(normalizeBarcode(result.getText()));
              }
            },
          );
          setStarting(false);
          cleanupRef.current = () => {
            try { controls?.stop(); } catch { /* ignore */ }
          };
        }
      } catch (e: any) {
        if (!stopped) {
          setError(
            e?.name === 'NotAllowedError'
              ? 'Доступ к камере запрещён. Разрешите доступ в настройках браузера.'
              : 'Не удалось открыть камеру. Попробуйте ввести штрихкод вручную.',
          );
          setStarting(false);
        }
      }
    }

    start();

    return () => {
      stopped = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    detectedRef.current = true;
    onClose();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#000', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
      }}>
        <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>Сканировать штрихкод</span>
        <button
          onClick={handleClose}
          style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            borderRadius: '50%', width: 36, height: 36,
            color: '#fff', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
      </div>

      {/* Video */}
      {!error && (
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {/* Targeting overlay */}
      {!error && !starting && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: '72%', maxWidth: 290, aspectRatio: '2.5 / 1',
            border: '2px solid rgba(255,255,255,0.8)',
            borderRadius: 10,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
          }} />
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 20 }}>
            Наведите камеру на штрихкод
          </div>
        </div>
      )}

      {/* Loading */}
      {starting && !error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ color: '#fff', fontSize: 14 }}>Открываем камеру...</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 32, textAlign: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 40 }}>📷</div>
          <div style={{ color: '#fff', fontSize: 15, lineHeight: 1.5 }}>{error}</div>
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 12, padding: '12px 24px',
              color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8,
            }}
          >
            Закрыть
          </button>
        </div>
      )}
    </div>
  );
}
