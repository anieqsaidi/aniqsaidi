import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { Resend } from 'resend';
import { createOpaqueToken, DOWNLOAD_TTL_MS, hashValue, isValidEmail, MAX_DOWNLOADS, normalizeEmail, parseOpaqueToken, safeFilename, VERIFICATION_TTL_MS } from './cv-security.mjs';
import { renderCvVerificationEmail } from './cv-verification-template.mjs';

initializeApp();
const REGION = 'asia-southeast1';
const SITE_URL = 'https://aniqsaidi.my';
const ALLOWED_ORIGINS = new Set([SITE_URL, 'https://aniqsaidi.web.app']);
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const GENERIC_ACCEPTED = { ok: true, message: 'If the request can be accepted, a verification email will arrive shortly.' };

function securityHeaders(response) {
  response.set('Cache-Control', 'private, no-store, max-age=0');
  response.set('Pragma', 'no-cache');
  response.set('X-Content-Type-Options', 'nosniff');
  response.set('Referrer-Policy', 'no-referrer');
  response.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
}
function requestIp(request) { return request.get('x-forwarded-for')?.split(',')[0]?.trim() || request.ip || 'unknown'; }

async function consumeLimit(transaction, db, key, limit, windowMs, now) {
  const reference = db.collection('cvRequestLimits').doc(key);
  const snapshot = await transaction.get(reference);
  const started = snapshot.data()?.windowStartedAt?.toMillis?.() ?? 0;
  const active = now - started < windowMs;
  const count = active ? Number(snapshot.data()?.count ?? 0) : 0;
  if (count >= limit) return false;
  transaction.set(reference, { count: count + 1, windowStartedAt: active ? snapshot.data().windowStartedAt : new Date(now), expiresAt: new Date(now + Math.max(windowMs * 2, DAY_MS * 2)), updatedAt: FieldValue.serverTimestamp() });
  return true;
}

async function validateTurnstile(token, ip, secret) {
  if (!token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: AbortSignal.timeout(8000) });
  if (!result.ok) return false;
  const data = await result.json();
  return data.success === true && data.action === 'request_cv' && ['aniqsaidi.my', 'aniqsaidi.web.app', 'localhost'].includes(data.hostname);
}

async function currentCv() {
  const db = getFirestore();
  const resumeSnapshot = await db.collection('cmsResume').doc('published').get();
  const resume = resumeSnapshot.data();
  if (!resumeSnapshot.exists || !resume?.mediaId) throw new Error('No published CV configured');
  const mediaSnapshot = await db.collection('cmsMedia').doc(resume.mediaId).get();
  const media = mediaSnapshot.data();
  if (!mediaSnapshot.exists || media?.kind !== 'resume' || media?.mimeType !== 'application/pdf' || !media?.storagePath) throw new Error('Invalid CV media record');
  const [metadata] = await getStorage().bucket().file(media.storagePath).getMetadata();
  if (Number(metadata.size) <= 0 || Number(metadata.size) > 10 * 1024 * 1024 || metadata.contentType !== 'application/pdf') throw new Error('Invalid CV file');
  return { file: getStorage().bucket().file(media.storagePath), filename: safeFilename(resume.fileName || media.fileName) };
}

export const requestCv = onRequest({ region: REGION, secrets: ['RESEND_API_KEY', 'TURNSTILE_SECRET_KEY'], timeoutSeconds: 30, memory: '256MiB', maxInstances: 5, cors: false }, async (request, response) => {
  securityHeaders(response);
  if (request.method !== 'POST') return response.set('Allow', 'POST').status(405).json({ ok: false, message: 'Method not allowed.' });
  const origin = request.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) return response.status(403).json({ ok: false, message: 'Request not accepted.' });
  const email = normalizeEmail(request.body?.email);
  const honeypot = String(request.body?.company ?? '').trim();
  if (honeypot) return response.status(202).json(GENERIC_ACCEPTED);
  if (!isValidEmail(email) || request.body?.consent !== true) return response.status(400).json({ ok: false, message: 'Enter a valid email address and confirm professional use.' });
  const resendKey = process.env.RESEND_API_KEY;
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (!resendKey || !turnstileSecret) { logger.error('CV request secrets are not configured.'); return response.status(503).json({ ok: false, message: 'CV requests are temporarily unavailable.' }); }
  const ip = requestIp(request);
  try {
    if (!await validateTurnstile(String(request.body?.turnstileToken ?? ''), ip, turnstileSecret)) return response.status(400).json({ ok: false, message: 'Security verification failed. Please try again.' });
    const now = Date.now();
    const emailHash = hashValue(email);
    const ipHash = hashValue(`${ip}:${turnstileSecret}`);
    const db = getFirestore();
    const requestId = randomUUID().replaceAll('-', '');
    const verificationToken = createOpaqueToken(requestId);
    const accepted = await db.runTransaction(async (transaction) => {
      const requestRef = db.collection('cvRequests').doc(requestId);
      const cooldownRef = db.collection('cvRequestLimits').doc(`cooldown_${emailHash}`);
      const cooldown = await transaction.get(cooldownRef);
      const last = cooldown.data()?.updatedAt?.toMillis?.() ?? 0;
      const limits = await Promise.all([
        consumeLimit(transaction, db, `email_hour_${emailHash}`, 3, HOUR_MS, now),
        consumeLimit(transaction, db, `ip_hour_${ipHash}`, 5, HOUR_MS, now),
        consumeLimit(transaction, db, `ip_day_${ipHash}`, 20, DAY_MS, now),
      ]);
      if (now - last < 10 * 60 * 1000 || limits.some((value) => !value)) return false;
      transaction.set(cooldownRef, { updatedAt: new Date(now), expiresAt: new Date(now + DAY_MS) });
      transaction.create(requestRef, { email, emailHash, ipHash, source: 'portfolio', status: 'pending', requestedAt: new Date(now), verificationTokenHash: hashValue(verificationToken), verificationExpiresAt: new Date(now + VERIFICATION_TTL_MS), verifiedAt: null, downloadTokenHash: null, downloadExpiresAt: null, downloadedAt: null, downloadCount: 0, expiresAt: new Date(now + DOWNLOAD_TTL_MS + DAY_MS) });
      return true;
    });
    if (!accepted) return response.status(202).json(GENERIC_ACCEPTED);
    const verificationUrl = `${SITE_URL}/api/cv/verify?t=${encodeURIComponent(verificationToken)}`;
    const message = renderCvVerificationEmail({ verificationUrl });
    const { error } = await new Resend(resendKey).emails.send({ from: 'Aniq Saidi <cv@mail.aniqsaidi.my>', replyTo: 'aniqsaidi.official@gmail.com', to: [email], subject: message.subject, html: message.html, text: message.text, tags: [{ name: 'source', value: 'cv-verification' }] }, { idempotencyKey: `cv-verify-${requestId}` });
    if (error) throw new Error('Email provider rejected request');
    return response.status(202).json(GENERIC_ACCEPTED);
  } catch (error) { logger.error('CV verification request failed.', error); return response.status(500).json({ ok: false, message: 'The request could not be completed. Please try again later.' }); }
});

const accessPage = (downloadUrl) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>Email verified // Aniq Saidi</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#071824;color:#9edfff;font-family:'Courier New',monospace}.card{width:min(620px,calc(100% - 40px));padding:32px;border:1px solid #62d2ff;box-sizing:border-box}h1{color:#d8f5ff;font-size:1.4rem}p{line-height:1.6}.button{display:inline-block;margin-top:12px;padding:13px 17px;background:#62d2ff;color:#071824;text-decoration:none;font-weight:700}</style></head><body><main class="card"><p>&gt;_ ANIQ SAIDI</p><h1>EMAIL VERIFIED</h1><p>Your private CV link is ready. It expires in 24 hours and permits up to three downloads.</p><a class="button" href="${downloadUrl}" rel="noreferrer">DOWNLOAD CV ↗</a></main></body></html>`;

export const verifyCv = onRequest({ region: REGION, timeoutSeconds: 15, memory: '256MiB', maxInstances: 5, cors: false }, async (request, response) => {
  securityHeaders(response);
  if (request.method !== 'GET') return response.set('Allow', 'GET').status(405).send('Method not allowed.');
  const parsed = parseOpaqueToken(request.query.t);
  if (!parsed) return response.status(400).send('This verification link is invalid or expired.');
  try {
    const db = getFirestore(); const now = Date.now(); const downloadToken = createOpaqueToken(parsed.requestId);
    const accepted = await db.runTransaction(async (transaction) => {
      const ref = db.collection('cvRequests').doc(parsed.requestId); const snapshot = await transaction.get(ref); const data = snapshot.data();
      if (!snapshot.exists || data?.status !== 'pending' || data.verificationTokenHash !== hashValue(parsed.token) || data.verificationExpiresAt?.toMillis?.() < now) return false;
      transaction.update(ref, { status: 'verified', verifiedAt: new Date(now), verificationTokenHash: FieldValue.delete(), downloadTokenHash: hashValue(downloadToken), downloadExpiresAt: new Date(now + DOWNLOAD_TTL_MS), expiresAt: new Date(now + DOWNLOAD_TTL_MS + DAY_MS) }); return true;
    });
    if (!accepted) return response.status(410).send('This verification link is invalid or expired.');
    response.type('html').status(200).send(accessPage(`/api/cv/download?t=${encodeURIComponent(downloadToken)}`));
  } catch (error) { logger.error('CV verification failed.', error); response.status(500).send('Verification is temporarily unavailable.'); }
});

export const downloadCv = onRequest({ region: REGION, timeoutSeconds: 30, memory: '256MiB', maxInstances: 10, cors: false }, async (request, response) => {
  securityHeaders(response);
  if (request.method !== 'GET') return response.set('Allow', 'GET').status(405).send('Method not allowed.');
  const parsed = parseOpaqueToken(request.query.t);
  if (!parsed) return response.status(400).send('This download link is invalid or expired.');
  try {
    const db = getFirestore(); const now = Date.now();
    const accepted = await db.runTransaction(async (transaction) => {
      const ref = db.collection('cvRequests').doc(parsed.requestId); const snapshot = await transaction.get(ref); const data = snapshot.data(); const count = Number(data?.downloadCount ?? 0);
      if (!snapshot.exists || !['verified', 'downloaded'].includes(data?.status) || data.downloadTokenHash !== hashValue(parsed.token) || data.downloadExpiresAt?.toMillis?.() < now || count >= MAX_DOWNLOADS) return false;
      transaction.update(ref, { status: 'downloaded', downloadedAt: new Date(now), downloadCount: count + 1 }); return true;
    });
    if (!accepted) return response.status(410).send('This download link is invalid, expired, or has reached its download limit.');
    const cv = await currentCv(); response.set('Content-Type', 'application/pdf'); response.set('Content-Disposition', `attachment; filename="${cv.filename}"`); response.set('Content-Security-Policy', "default-src 'none'; sandbox"); cv.file.createReadStream().on('error', (error) => { logger.error('CV stream failed.', error); if (!response.headersSent) response.status(500).end(); else response.destroy(); }).pipe(response);
  } catch (error) { logger.error('CV download failed.', error); if (!response.headersSent) response.status(500).send('The CV is temporarily unavailable.'); }
});
