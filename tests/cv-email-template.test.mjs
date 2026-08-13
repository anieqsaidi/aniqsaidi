import assert from 'node:assert/strict';
import test from 'node:test';
import { renderCvDeliveryEmail } from '../functions/cv-delivery-template.mjs';

test('CV delivery template renders professional monochrome HTML and a plain-text fallback', () => {
  const email = renderCvDeliveryEmail({
    recipientEmail: 'recruiter@example.com',
    cvVersion: '2026.08',
    year: 2026,
  });

  assert.equal(email.subject, 'Aniq Saidi — Curriculum Vitae');
  assert.match(email.html, /&gt;_ ANIQ SAIDI/);
  assert.match(email.html, /text-align:center/);
  assert.match(email.html, /Thank you for your interest/);
  assert.doesNotMatch(email.html, /TRANSMISSION|BLUE PHOSPHOR|#3878c5/i);
  assert.doesNotMatch(email.html, /recruiter@example\.com/);
  assert.doesNotMatch(email.html, /2026\.08/);
  assert.match(email.text, /curriculum vitae attached/i);
});

test('CV delivery template does not expose recipient or version values in HTML', () => {
  const email = renderCvDeliveryEmail({
    recipientEmail: '<script>alert(1)</script>@example.com',
    cvVersion: '<img src=x onerror=alert(1)>',
  });

  assert.doesNotMatch(email.html, /<script>/);
  assert.doesNotMatch(email.html, /<img src=x/);
  assert.doesNotMatch(email.html, /&lt;script&gt;/);
  assert.doesNotMatch(email.html, /&lt;img src=x/);
});
