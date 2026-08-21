import assert from 'node:assert/strict';
import test from 'node:test';
import { createOpaqueToken, DOWNLOAD_TTL_MS, hashValue, isValidEmail, MAX_DOWNLOADS, parseOpaqueToken, VERIFICATION_TTL_MS } from '../functions/cv-security.mjs';
import { renderCvVerificationEmail } from '../functions/cv-verification-template.mjs';

test('CV tokens are random, parseable, hashed at rest, and purpose-separated by stored hash', () => {
  const requestId = '0123456789abcdef0123456789abcdef';
  const verification = createOpaqueToken(requestId);
  const download = createOpaqueToken(requestId);
  assert.notEqual(verification, download);
  assert.equal(parseOpaqueToken(verification)?.requestId, requestId);
  assert.equal(hashValue(verification).length, 64);
  assert.notEqual(hashValue(verification), hashValue(download));
  assert.equal(parseOpaqueToken(`${verification}modified`), null);
  assert.equal(parseOpaqueToken('not-a-token'), null);
});

test('security lifecycle constants match the documented limits', () => {
  assert.equal(VERIFICATION_TTL_MS, 30 * 60 * 1000);
  assert.equal(DOWNLOAD_TTL_MS, 24 * 60 * 60 * 1000);
  assert.equal(MAX_DOWNLOADS, 3);
});

test('email validation rejects malformed and header-injection values', () => {
  assert.equal(isValidEmail('recruiter@example.com'), true);
  assert.equal(isValidEmail('invalid'), false);
  assert.equal(isValidEmail('victim@example.com\nBcc: attacker@example.com'), false);
});

test('verification email contains only a fixed confirmation action and expiry notice', () => {
  const url = 'https://aniqsaidi.my/api/cv/verify?t=safe-token';
  const message = renderCvVerificationEmail({ verificationUrl: url });
  assert.match(message.subject, /Confirm your request/);
  assert.match(message.html, /Confirm CV request/);
  assert.match(message.text, /expires in 30 minutes/);
  assert.doesNotMatch(message.html, /attachment/i);
});
