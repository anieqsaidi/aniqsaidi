import { createHash, randomBytes } from 'node:crypto';

export const VERIFICATION_TTL_MS = 30 * 60 * 1000;
export const DOWNLOAD_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_DOWNLOADS = 3;

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/[\r\n]/.test(email);
}

export function hashValue(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function createOpaqueToken(requestId) {
  return `${requestId}.${randomBytes(32).toString('base64url')}`;
}

export function parseOpaqueToken(value) {
  if (typeof value !== 'string' || value.length > 180) return null;
  const match = value.match(/^([A-Za-z0-9_-]{12,80})\.([A-Za-z0-9_-]{43})$/);
  return match ? { requestId: match[1], token: value } : null;
}

export function safeFilename(value) {
  return String(value || 'Aniq-Saidi-CV.pdf').replace(/[^a-zA-Z0-9._-]/g, '-');
}
