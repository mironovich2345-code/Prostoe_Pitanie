export function normalizeBarcode(value: string): string {
  return value.replace(/\D/g, '');
}

export function isSupportedBarcode(value: string): boolean {
  const b = normalizeBarcode(value);
  return b.length === 8 || b.length === 12 || b.length === 13;
}

export async function detectBarcodeFromImageFile(file: File): Promise<string | null> {
  // Native BarcodeDetector API (Chrome/Edge on Android)
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const detector = new (window as any).BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
      });
      const bitmap = await createImageBitmap(file);
      const results: Array<{ rawValue: string }> = await detector.detect(bitmap);
      bitmap.close();
      if (results.length > 0) return normalizeBarcode(results[0].rawValue);
    } catch {
      // fall through to ZXing
    }
  }

  // ZXing fallback
  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatReader();
    const objectUrl = URL.createObjectURL(file);
    try {
      const result: any = await (reader as any).decodeFromImageUrl(objectUrl);
      return normalizeBarcode(result.getText());
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}
