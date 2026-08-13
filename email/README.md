# CV email delivery

`cv-delivery-template.mjs` contains the dependency-free HTML and plain-text
transactional email sent after a valid request at `/resume/`.

## Intended delivery architecture

1. The public form posts only the recipient email address to a Firebase HTTP
   function.
2. The function validates the request, rate-limits abuse, resolves the current
   published CV server-side, and sends it as an attachment through Resend.
3. The Resend API key and CV storage URL/path never enter the browser bundle.

## Required configuration

- Firebase project on the Blaze plan, with Cloud Functions enabled.
- A Resend account with `aniqsaidi.my` (or a sending subdomain) verified.
- A Resend API key restricted to sending access, stored as a Firebase secret.
- Sender: `Aniq Saidi <cv@mail.aniqsaidi.my>`.
- Reply-to: `aniqsaidi.official@gmail.com`.
- Firebase Storage path or CMS document used to resolve the current CV.
- Allowed web origin: `https://aniqsaidi.my`.
- Abuse policy: 3 requests per email and 10 attempts per IP every 24 hours.

Do not put the Resend API key in `.env.production` or any `PUBLIC_` variable.

Store it from the repository root with:

```bash
firebase functions:secrets:set RESEND_API_KEY --project aniqsaidi
```

Paste the sending-only key at the hidden prompt, then deploy Functions and
Hosting together with `npm run deploy:prod`.
