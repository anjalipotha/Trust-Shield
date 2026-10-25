// TrustShield Cryptography & Forensics Utility Library

export async function computeSHA256(file: File | Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/json',
  'message/rfc822',
];

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export function validateEvidenceFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 20MB maximum limit (${formatBytes(file.size)}).`,
    };
  }

  // Allow standard extensions even if mime is text/plain or binary
  const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.txt', '.log', '.json', '.eml', '.msg'];
  const name = file.name.toLowerCase();
  const hasValidExt = validExts.some((ext) => name.endsWith(ext));

  if (!hasValidExt && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Unsupported file type. Permitted formats: Screenshots (PNG, JPG, WebP), PDF, TXT, JSON, EML/MSG email exports.',
    };
  }

  return { valid: true };
}
