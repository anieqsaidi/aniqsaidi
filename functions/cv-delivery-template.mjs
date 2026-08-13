export function renderCvDeliveryEmail({ recipientEmail, cvVersion = 'Current' }) {
  const year = new Date().getUTCFullYear();
  const subject = 'Aniq Saidi — Curriculum Vitae';
  const text = [
    'Hello,', '',
    'Thank you for your interest. Please find my current curriculum vitae attached to this email.', '',
    'For more information about my experience and work:',
    'Portfolio: https://aniqsaidi.my',
    'LinkedIn: https://www.linkedin.com/in/aniqsaidi', '',
    'Kind regards,',
    'Aniq Saidi', '',
    `Document version: ${cvVersion}`,
    `Sent to: ${recipientEmail}`, '',
    'This email was requested through aniqsaidi.my. If you did not make this request, no action is required.',
  ].join('\n');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${subject}</title></head>
  <body style="margin:0;padding:0;background:#f3f3f3;color:#171717;font-family:'Courier New',Courier,monospace;-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">The requested copy of Aniq Saidi's curriculum vitae is attached.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f3f3"><tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #d8d8d8">
  <tr><td style="padding:24px 32px;border-bottom:1px solid #e5e5e5;color:#111111;font-family:'Courier New',Courier,monospace;font-size:18px;line-height:24px;font-weight:700;letter-spacing:2px;text-align:center">&gt;_ ANIQ SAIDI</td></tr>
  <tr><td style="padding:34px 32px 18px;color:#292929;font-size:16px;line-height:26px"><p style="margin:0 0 18px">Hello,</p><p style="margin:0 0 18px">Thank you for your interest. Please find my current curriculum vitae attached to this email.</p><p style="margin:0">For more information about my experience and work, you are welcome to visit the links below.</p></td></tr>
  <tr><td style="padding:8px 32px 30px"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="background:#111111"><a href="https://aniqsaidi.my" style="display:inline-block;padding:12px 17px;color:#ffffff;text-decoration:none;font-size:13px;line-height:16px;font-weight:700">View portfolio</a></td><td width="10"></td><td style="border:1px solid #b8b8b8"><a href="https://www.linkedin.com/in/aniqsaidi" style="display:inline-block;padding:11px 17px;color:#171717;text-decoration:none;font-size:13px;line-height:16px;font-weight:700">LinkedIn</a></td></tr></table></td></tr>
  <tr><td style="padding:0 32px 32px;color:#292929;font-size:15px;line-height:24px">Kind regards,<br><strong style="color:#111111">Aniq Saidi</strong></td></tr>
  <tr><td style="padding:18px 32px;border-top:1px solid #e5e5e5;background:#fafafa;color:#737373;font-family:'Courier New',Courier,monospace;font-size:10px;line-height:17px;text-align:center">This email was requested through aniqsaidi.my.<br>If you did not make this request, no action is required.<br><br>© ${year} Aniq Saidi</td></tr>
  </table></td></tr></table></body></html>`;
  return { subject, html, text };
}
