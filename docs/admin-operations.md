# Admin operations

The existing `/admin/dashboard/` now contains the recruiter inbox, traffic reports, and on-demand site checks. The CMS remains at `/admin/`.

## Recruiter inbox

- Source: `cvRequests`, joined by document ID to private `recruiterLeads`.
- Each source is paged by request date, 25 records at a time. Matching records from the other source are fetched by ID. “Load older” controls continue each source independently. Search, status, and follow-up filters apply only to loaded records; counts are not all-time totals.
- A CV request is not evidence that the sender is a recruiter. Company, notes, and workflow status are entered by the administrator.
- Saving creates a durable lead with the request email/date and editable company, notes, stage, and follow-up date. It does not change CV verification, expiry, tokens, or download permissions. Closed leads are excluded from due reminders; dates use Malaysia time.
- Saved leads survive expiry/deletion of the underlying CV access record. The original access record may therefore be unavailable. Leads are not currently included in CMS exports; Firestore backups should cover `recruiterLeads`.
- Version-checked transactions prevent stale overwrites. Each save creates an immutable `recruiter.update` audit event without copying email or notes into the event summary.
- Firestore rules restrict access to the existing administrator UID, reject unknown fields, validate limits, and disallow client deletes. Sign-out clears the inbox UI. No messages or follow-up emails are sent automatically.

## Google Analytics setup

The production web measurement ID is already configured as `G-WJYGYQNWDG`. It collects traffic; it cannot be used as the reporting property ID.

1. In GA4, open **Admin → Property settings → Property details** and copy the numeric **Property ID**.
2. Put `GA4_PROPERTY_ID=<numeric ID>` in `functions/.env.aniqsaidi` (ignored by Git), preserving existing entries. An example is in `functions/.env.example`.
3. Enable the **Google Analytics Data API** in the Firebase/Google Cloud project used by the `adminInsights` function.
4. Grant the verified Firebase Functions runtime service account `670496817353-compute@developer.gserviceaccount.com` **Viewer** access to the GA4 property through Property access management. This account was confirmed from the deployed generation 2 functions in project `aniqsaidi` on 5 September 2026.
5. After deployment, sign in and refresh Traffic. No service-account key file is needed; the function uses Application Default Credentials with the analytics read-only scope.

Reference: [Google Analytics API quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart).

Traffic reports cover 7, 30, or 90 complete days ending yesterday in the GA4 property's timezone, filtered to `aniqsaidi.my` and `aniqsaidi.web.app`. Reports are fetched through the admin-only `/api/admin/insights?action=analytics&days=30` endpoint and cached for five minutes per function instance. The panel distinguishes missing setup, unavailable reports, and successful reports with no events. It does not generate sample traffic or backfill custom events.

| Metric | Definition |
| --- | --- |
| Sessions | GA4 `sessions` after excluding private routes |
| Users | GA4 `totalUsers` for the reporting window; not the sum of daily users |
| Page views / top pages | GA4 `screenPageViews` grouped by `pagePath` where applicable |
| CV submissions | `eventCount` for `cv_request_submitted` |
| CV submission rate | Sessions containing `cv_request_submitted` divided by reported sessions; blank for a zero denominator |
| Outbound clicks | `eventCount` for `portfolio_outbound` (external HTTP/S links) |
| Top project case files | `project_open` count grouped by standard `pagePathPlusQueryString`, with only the public project slug in the query |

Custom events start with this release; older traffic cannot be assumed to have those events. A CV submission means the form received a successful response, which can include a generic anti-abuse response. It does **not** mean email delivery, verification, or download. No cross-source conversion percentage is calculated from inbox records. GA4 may delay, threshold, or sample reports; the panel surfaces API data-quality flags.

Tracking is limited to public production portfolio routes. Admin, Batam, confirmation pages, localhost development, and CMS previews are excluded. Opening an admin page sets `aniq.analytics.exclude=true` in that browser's local storage; future public-page loads skip the tag. This cannot remove previous visits or exclude another device automatically. Do Not Track / Global Privacy Control also suppress the tag. Page-location/referrer query strings are stripped; project-open events use only a validated public slug. Recruiter emails, notes, and CV tokens are not supplied to custom analytics events.

## Site health

Click **Run checks** to check the fixed production origin `https://aniqsaidi.my`:

- Nine public entry routes, using GET to discover internal links.
- Up to 40 additional internal resources linked from the initial HTML, checked with HEAD in batches of ten. The panel shows checked/discovered counts. This is a bounded scan, not a recursive crawler or JavaScript rendering check.
- The published résumé metadata, media entry, and private PDF metadata in Storage, using the same validation as the existing CV service.
- A verified TLS connection and certificate expiry, with a warning inside 14 days.

Same-origin public redirects are followed for up to three hops, and results show the HTTP chain. External/private redirects, loops, or longer chains remain warnings; external destinations are never fetched. Private, API, and Firebase-reserved paths are excluded, and query strings are discarded. Checks time out after eight seconds per HTTP/TLS request; the function has a 60-second limit. Results are cached for one minute per function instance.

The check does not send email, exercise verification/download tokens, monitor continuous uptime, validate externally linked websites, or obtain registrar renewal dates. Email delivery and domain renewal explicitly remain **unverified**. TLS renewal and domain registration renewal are different things.

## Validation and deployment

Local checks:

```sh
npm run verify:prod
npm run test:rules
```

Firestore emulator tests require Java 21+. On this machine the runtime is `/opt/homebrew/opt/openjdk@21/bin/java`; prepend that directory to PATH if needed. `test:admin` is included in `verify:prod` and covers reporting math, missing setup, authorization, bounded health probes, follow-ups, and tracking exclusions.

Required release resources: Hosting, the new `adminInsights` function, and Firestore rules. Existing CV/Batam functions and Storage rules do not need deployment for this change. After explicit deployment authorization, use a targeted release:

```sh
firebase deploy --only hosting,functions:adminInsights,firestore:rules --project aniqsaidi
```

Do not deploy automatically. Analytics can remain in its setup state until the property ID and service-account access are configured; recruiter inbox and site checks do not depend on GA4. Astro's local development server previews the layout but does not emulate the new reporting API or supply private data automatically.

Post-deployment verification: sign in with the approved Google account, save a lead and reload, try a stale edit in another tab, run site checks, and refresh a GA4 period. Verify anonymous API requests fail and the admin browser no longer sends future public-page tracking requests.
