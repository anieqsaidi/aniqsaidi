import { createHmac } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { Resend } from 'resend';
import { renderCvDeliveryEmail } from './cv-delivery-template.mjs';

initializeApp();

const REGION = 'asia-southeast1';
const ALLOWED_ORIGINS = new Set(['https://aniqsaidi.my', 'https://aniqsaidi.web.app']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function requestIp(request) {
  const forwarded = request.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.ip || 'unknown';
}

function privateKey(value, secret) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

async function consumeLimit({ key, limit, now }) {
  const db = getFirestore();
  const reference = db.collection('cvRequestLimits').doc(key);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const data = snapshot.data();
    const windowStartedAt = data?.windowStartedAt?.toMillis?.() ?? 0;
    const withinWindow = now - windowStartedAt < DAY_MS;
    const count = withinWindow ? Number(data?.count ?? 0) : 0;
    if (count >= limit) return false;
    transaction.set(reference, {
      count: count + 1,
      windowStartedAt: withinWindow ? data.windowStartedAt : FieldValue.serverTimestamp(),
      expiresAt: new Date(now + DAY_MS * 2),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

async function currentCv() {
  const db = getFirestore();
  const resumeSnapshot = await db.collection('cmsResume').doc('published').get();
  const resume = resumeSnapshot.data();
  if (!resumeSnapshot.exists || !resume?.mediaId) throw new Error('No published CV is configured.');

  const mediaSnapshot = await db.collection('cmsMedia').doc(resume.mediaId).get();
  const media = mediaSnapshot.data();
  if (!mediaSnapshot.exists || media?.kind !== 'resume' || media?.mimeType !== 'application/pdf' || !media?.storagePath) {
    throw new Error('Published CV media record is invalid.');
  }

  const [content] = await getStorage().bucket().file(media.storagePath).download();
  if (!content.length || content.length > 10 * 1024 * 1024) throw new Error('Published CV file is invalid.');
  return {
    content: content.toString('base64'),
    filename: String(resume.fileName || media.fileName || 'Aniq-Saidi-CV.pdf').replace(/[^a-zA-Z0-9._-]/g, '-'),
    version: String(resume.versionLabel || resume.updatedDate || 'CURRENT RELEASE'),
  };
}

export const requestCv = onRequest({
  region: REGION,
  secrets: ['RESEND_API_KEY'],
  timeoutSeconds: 30,
  memory: '256MiB',
  maxInstances: 5,
  cors: false,
}, async (request, response) => {
  response.set('Cache-Control', 'no-store');
  response.set('X-Content-Type-Options', 'nosniff');

  if (request.method !== 'POST') {
    response.set('Allow', 'POST').status(405).json({ ok: false, message: 'Method not allowed.' });
    return;
  }

  const origin = request.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    response.status(403).json({ ok: false, message: 'Request origin is not allowed.' });
    return;
  }

  const email = normalizeEmail(request.body?.email);
  const honeypot = typeof request.body?.company === 'string' ? request.body.company.trim() : '';
  const consent = request.body?.consent === true;
  if (honeypot) {
    response.status(202).json({ ok: true });
    return;
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254 || !consent) {
    response.status(400).json({ ok: false, message: 'A valid email and consent are required.' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.error('RESEND_API_KEY is not configured.');
    response.status(503).json({ ok: false, message: 'CV delivery is temporarily unavailable.' });
    return;
  }

  try {
    const now = Date.now();
    const emailAllowed = await consumeLimit({ key: `email_${privateKey(email, apiKey)}`, limit: 3, now });
    const ipAllowed = await consumeLimit({ key: `ip_${privateKey(requestIp(request), apiKey)}`, limit: 10, now });
    if (!emailAllowed || !ipAllowed) {
      response.status(429).json({ ok: false, message: 'Request limit reached. Please try again later.' });
      return;
    }

    const cv = await currentCv();
    const message = renderCvDeliveryEmail({ recipientEmail: email, cvVersion: cv.version });
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: 'Aniq Saidi <cv@mail.aniqsaidi.my>',
      replyTo: 'aniqsaidi.official@gmail.com',
      to: [email],
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: [{ content: cv.content, filename: cv.filename }],
      tags: [{ name: 'source', value: 'cv-request' }],
    }, { idempotencyKey: `cv-${privateKey(`${email}:${Math.floor(now / 60000)}`, apiKey)}` });
    if (error) throw new Error(`Resend rejected delivery: ${error.message}`);

    response.status(202).json({ ok: true });
  } catch (error) {
    logger.error('CV delivery failed.', error);
    response.status(500).json({ ok: false, message: 'CV delivery could not be completed.' });
  }
});

