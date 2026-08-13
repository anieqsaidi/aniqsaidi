# Aniq Saidi Portfolio — Codex Handoff

Use this document as the starting context for future Codex App sessions working on this repository.

## 1. Project and owner

- Owner: Muhammad Amrun Aniq Bin Mohamed Saidi (Aniq Saidi).
- Repository/workspace: `/Users/anieqsaidi/Documents/aniqsaidi`.
- Framework: Astro static site with TypeScript, Firebase Authentication, Firestore, Storage, and Firebase Hosting.
- Production domain: `https://aniqsaidi.my`.
- Firebase project/site: `aniqsaidi`; fallback URL: `https://aniqsaidi.web.app`.
- GitHub account/repository owner: `anieqsaidi`.
- Current package version: `2.0.0`.
- Node requirement: `>=22.12.0`.
- Default theme: BLUE.
- Default sound state: ON.

## 2. Product vision

This is a personal portfolio presented as an attractive retro terminal/CRT operating system. It should feel playful, technically credible, responsive, and unmistakably Aniq's—not a generic portfolio and not a copy of another person's site.

Visual inspiration has included `afiq.my`, especially its terminal language, typing details, and structured content cards. Treat it as inspiration only. Preserve this project's blue phosphor CRT identity, original information architecture, humor, and interaction patterns.

Core tone:

- Concise, confident, human, occasionally funny.
- Technical without being needlessly verbose.
- Avoid cringey self-promotion and filler slogans.
- Do not expose confidential internal systems, employer names where deliberately withheld, internal URLs, or operational secrets.

## 3. Pages and navigation

Public routes:

- `/` — Home
- `/about/` — Profile and education
- `/projects/` — Project case files
- `/experience/` — Work history and toolkit
- `/certifications/`
- `/awards/`
- `/leadership/`
- `/archives/` and archive records
- `/resume/`

Admin routes are private and must remain `noindex`, `nofollow`, `noarchive`:

- `/admin/`
- `/admin/dashboard/`
- `/admin/editorial/`
- `/admin/media/`

Desktop navigation uses text. Mobile navigation uses eight icons in a bottom dock for reachability. An incomplete row/group should be centered; odd groupings must place the final item in the middle rather than left-aligning it.

## 4. Global layout and responsive rules

- Header and footer remain fixed within the full-height system shell; only `<main>` scrolls.
- The footer should remain visible while page content dynamically sizes.
- Pages should center and fit in one viewport when content naturally fits, like the About page; scrolling should activate only when required.
- Mobile content may scroll and should not hide meaningful content merely to force a single viewport.
- No horizontal scrolling anywhere, especially Archives.
- Zoom is intentionally locked through the viewport declaration.
- Desktop and mobile must both be tested after layout changes.
- The logo is a core identity element: responsive, prominent, but never so large that it suppresses page content. Mobile `ANIQ SAIDI` settled around `2em`, not `2.5em`.
- Header time and date are on one line on mobile. Date format: `09-AUG-26`.
- Mobile hides build/version metadata and hides the copyright colophon; the rest of the footer remains.

## 5. Header, boot, and footer behavior

Header:

- Top terminal command is inspired by `afiq@mac ~/afiq.my % claude` and currently uses the Aniq system equivalent with a typing animation.
- The earlier tagline `TALENT HAS NO FACE` was removed/replaced.
- Time uses the same theme font color.
- Clock colon animates like a seconds indicator.

Boot/start screen:

- Appears on web and mobile.
- Shows an animated redirect countdown and then reveals Home.
- The skip button was removed by request.
- Countdown was made faster.
- Transition should feel seamless/matrix-like rather than a generic fade.

Footer:

- Left side has a blinking status dot, rotating typed identity words, and animated cursor.
- Preserve that earlier implementation; do not replace it with a static title.
- Theme and sound controls are on the right.
- Copyright is centered below on desktop.
- `POWERED BY MATCHA` was removed. Current humorous colophon may mention `AYAM GEPUK`; do not restore Matcha wording without a new request.
- Current rotating words include playful identities; maintain a natural, non-cringey tone.

Back-to-top control:

- Square, consistent with the navigation-button sizing—not circular.
- Mobile: positioned immediately above the last mobile navigation button.
- Desktop: anchored to the layout just above the footer divider and aligned with the right content edge. It must not overlap Theme/Sound.
- A scroll-down button implementation exists but is intentionally hidden. Keep it behind the scenes unless explicitly requested.

## 6. Home page decisions

- Home includes a compact welcome/profile presentation and a compact Active Queue/current-work card.
- Removed content that was judged cringey, including the large `ANIQ SAIDI / software engineer` identity section and `$ cat current-focus.log / LIVE RECORD` strip.
- Removed `Always learning. Still debugging.` from the revised Home concept.
- The command line belongs at the top, not as an extra readiness status.
- The `ANIQ.SYS // PROFILE` concept was liked.
- Current progress copy: `brewing software for public healthcare.`
- The old `SUMMARY // CONNECT` card was replaced by a compact current-work/active-queue concept.
- Current work areas (do not disclose employer name unless newly authorized):
  1. Developing a patient management system.
  2. Enhancing an in-house centralized Hospital Information System/Electronic Manual system.
  3. Maintaining a healthcare recruitment/workforce portal.
  4. Developing the company's official website.
- Active Queue descriptions should stay synchronized with the latest Projects information.
- Home previously showed stale bundled content before the latest version. Cache-control headers and structured CMS rendering were added to prevent this.
- `SYNCING LATEST CONTENT...` and the Home-specific loading state are now capped at 180 ms. Bundled content appears quickly, while Firebase continues syncing in the background.
- Important: this 180 ms change passed the complete verification suite but the last automatic deployment attempt timed out during permission approval twice. Confirm production state before assuming it is live; deploy with `npm run deploy:prod` if needed.

## 7. About page and profile portrait

Profile:

- Display name: Muhammad Amrun Aniq Bin Mohamed Saidi.
- Role: Software Engineer.
- Location: Sungai Buloh, Selangor, Malaysia.
- Contact and LinkedIn appear in the Profile card.

Current portrait:

- Source was a professional suit headshot supplied in chat.
- Final asset: `public/images/aniq-suit-pixel-transparent.png`.
- It is a high-detail 32-bit-style pixel portrait with transparent background, natural skin/clothing colors, navy suit, and theme-responsive frame/glow.
- Do not globally recolor the face with the theme image filter. Theme should affect frame, subtle background, and glow.
- Current About reference points to `/images/aniq-suit-pixel-transparent.png`.
- Desktop avatar is approximately 176 × 176; mobile approximately 136 × 136.
- Other portrait versions remain in `public/images/` for recovery. Do not delete user assets without permission.

Education:

- The Final Year Project must be nested directly beneath the Bachelor of Computer Science record, not displayed as a competing right-hand education column.
- Bachelor: Bachelor of Computer Science (Software Engineering) with Honors, Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA), 2015–2020.
- Final Year Project (2019): Naturel Kiss Online Shopping (NKOS).
- Description: Android e-commerce prototype using Java and Rapid Application Development, validated through UAT.
- Include technologies and links to repository record, thesis PDF, and library catalogue.
- Earlier education records follow below: Certificate of Engineering Science (2014–2015) and SPM (2009–2013).
- A CMS client-side replacement once stripped Astro's scoped selectors and revived the old split layout. About page education styles were changed to global-by-class (`<style is:global>`) so the nested layout survives both static and CMS rendering. Preserve this.

## 8. Projects page

- Projects are sorted latest to oldest; Rakan KKM-related/current healthcare projects are `ONGOING` where appropriate.
- Project titles were reduced to fit the design and duplicate headings were removed/standardized.
- Removed terminal filler such as `$ ls ./systems --featured --human-readable` and `$ cat ./systems/...case`.
- Case files expand beneath their respective project card, like Archives. Opening another closes the previous one and scrolls the selected project title into view.
- Do not expose internal portal links, IP addresses, employer-only systems, or confidential organization names.

Key projects and clarified facts:

- Centralized Hospital Information System / Electronic Manual System:
  - In-house HIS and largest system.
  - Modules cover patients, hospitals, doctors, equipment, medication, and operational workflows.
  - Patient-facing booking flows enter through the patient system and continue in the HIS.
  - Stack: PHP.
- Patient Management Platform:
  - Patient-facing appointment and management frontend connected to the HIS.
- Human Resource Management System:
  - In-house HRMS for staff management, clock-in/out, payroll, leave requests, and related workflows.
  - Stack: .NET Core.
  - It is live internally, but never publish its internal URLs.
- Healthcare Workforce/Recruitment Portal:
  - Maintained by Aniq; public description may discuss recruitment/workforce functionality.
  - Do not publicly expose the supplied internal IP/link.
- Healthcare Corporate Website:
  - Responsive bilingual Astro frontend.
- Enterprise Analytics Platform, Sprint Management Platform, Cost Management Automation, E-Aduan Hygiene System, and NKOS are also represented.

Critical regression protection:

- Production once showed no projects because an empty Firestore `cmsPublished/projects` array replaced the complete static catalogue.
- `src/scripts/projectExplorer.ts` now treats an empty published list as invalid and retains the built-in catalogue.
- Regression test exists in `tests/public-cms-rendering.test.mjs`.
- Never remove this fail-safe. Valid non-empty CMS snapshots should still override fallback content.

## 9. Certifications, Awards, Leadership

- These pages are sorted newest to oldest for their full records.
- Each has a curated Highlight section for the most important items, distinct from chronological sorting.
- Mobile highlight counts must be consistent; do not arbitrarily show one certification, two awards, and three leadership items. The established intent is a consistent, responsive policy.
- The literal terminal command `$ select --featured` was removed and must not be reintroduced.
- Effects should be applied to suitable words/content, not entire cards. Avoid making whole certification cards glitch.
- The old signal underline effect was disliked; use a different tasteful effect.

## 10. Archives

- Archives originated from the older `anieqsaidi/anieqsaidi` repository.
- Group archive records into year buttons (currently 2019, 2018, 2017); odd final buttons must center on the next row.
- Clicking a title expands its article beneath the list entry; opening another closes the previous entry.
- Automatically scroll the chosen title into view after opening.
- No horizontal scrolling.
- Article images must fit their container and must not open accidentally during scrolling.
- Full-size images open only through a separate `VIEW FULL IMAGE` button. Preserve spaces in its label.
- Archive title layout (`PRESS ARCHIVES`) was fixed for narrow screens.
- Production once lacked 2019 content; CMS/archive synchronization was added. Script: `scripts/sync-archives-cms.mjs`.

Known/public article and source context includes UMPSA success stories, awards, leadership, electricity-use innovation coverage, thesis/library records, campus leadership news, and Pekan Review mentions. User's searchable names include:

- Muhammad Amrun Aniq Bin Mohamed Saidi
- Muhammad Amrun Aniq Mohamed Saidi
- Muhammad Amrun Aniq

## 11. Experience and content style

- Experience spans healthcare software, cloud analytics, business systems, mobile development, SQL optimization, AWS data/ETL, Qlik Sense, Tableau, and UI improvement.
- Toolkit and certifications were specifically requested and must not be omitted.
- Descriptions should be concise and meaningful. Three catchy points are often preferred over long summaries.
- Do not disclose application names when sensitive. Generalize to functional descriptions where necessary.

## 12. CMS/admin architecture

- Firebase Authentication and database were configured by the user.
- Admin CMS supports Home, About, Projects, Experience, Certifications, Awards, Leadership, and Archives.
- Repeatable content uses page-scoped v2 documents and stable IDs.
- Collections include drafts, published records, archived records, ordered nested repeaters, revision/history concepts, media/resume, SEO, validation, preview, and page/all publishing.
- Public repeatable CMS rendering should be dynamic rather than hardcoded.
- Keep static fallback data so public pages remain useful when Firebase is unavailable or accidentally empty.
- Firestore collections used include `cmsDrafts`, `cmsPublished`, `cmsSeo`, `cmsResume`, and legacy/site-content compatibility records.
- Publishing previously failed, and at another point publishing an empty Active Queue removed prior content. Treat destructive/empty publications carefully and preserve fallbacks.
- Admin pages must remain private and excluded from Google Analytics.

## 13. Analytics

- Google Analytics component: `src/components/GoogleAnalytics.astro`.
- Included by `src/layouts/Layout.astro` on production public pages only.
- Correct GA4 Measurement ID: `G-WJYGYQNWDG`.
- An incorrect ID with an extra zero (`G-WJYGYQNW0DG`) was fixed.
- Production config is in `.env.production` via `PUBLIC_GA_MEASUREMENT_ID`.
- The build was verified to emit:
  - `https://www.googletagmanager.com/gtag/js?id=G-WJYGYQNWDG`
  - `gtag('config', 'G-WJYGYQNWDG')`
- Do not add a duplicate Google tag or track `/admin`.

## 14. Theme, sound, and animations

- Themes: amber, green, blue, black; BLUE is default.
- Sound is ON by default.
- Theme and sound controls stay at the bottom.
- Animations should be creative and applied to meaningful words within content, not only titles and not entire cards.
- Existing effects include glitch/decode/wave/jitter/invert/scan and other subtle terminal treatments.
- Avoid excessive animation, readability loss, and full-card glitch effects.
- Respect `prefers-reduced-motion`.
- The clock colon animation, header command typing, footer identity typing, word effects, boot countdown, and archive/project accordion interactions are established behavior.

## 15. Caching and latest-content expectations

The user expects clicking any navigation tab or logo to show the latest content without briefly flashing an older version.

- Firebase Hosting sends `no-cache, no-store, must-revalidate` for Home and all public content routes.
- Client code uses server reads (`getDocFromServer`) for current CMS data.
- Static fallback content must remain current and must not flash as visibly stale where avoidable.
- Never let empty/malformed CMS data erase valid static fallback content.
- Loading indicators should be brief; content sync continues in the background.

## 16. Build, test, and deployment workflow

AGENTS.md instruction:

- Start dev server in background with `astro dev --background`.
- Manage it using `astro dev stop`, `astro dev status`, and `astro dev logs`.

Common commands:

```bash
npm run dev
npm run build
npm run verify:prod
npm run deploy:prod
```

`npm run verify:prod` runs:

1. Astro production build.
2. CMS schema tests.
3. Editorial/SEO tests.
4. Operations/import-export tests.
5. Accessibility tests.
6. Public CMS rendering tests.

Manual Firebase deployment:

```bash
npx firebase-tools deploy --only hosting --project aniqsaidi
```

or the preferred verified workflow:

```bash
npm run deploy:prod
```

Standing user preference: once an enhancement is completed and verified locally, deploy the latest version to production unless the user explicitly says to keep it local. Earlier in the project the user sometimes requested localhost-only experimentation, but the later standing direction is to keep production current.

## 17. Current repository state and caution

At the time this handoff was compiled, the worktree is dirty with a large set of user-approved, mostly deployed enhancements. Do not discard or reset them.

Modified files include:

- `package.json`
- Header/footer components
- `src/layouts/Layout.astro`
- Home, About, and Projects pages
- Project explorer
- Terminal stylesheet
- Public CMS regression tests

New files include navigation components, portrait assets/processors, and archive sync tooling.

The latest Git commit shown locally is `b54fd8b updated for version 2.0.0`; many later production changes are not committed. Before committing, inspect the full diff and preserve every approved change.

## 18. Immediate next action for a new Codex session

1. Read `AGENTS.md` and this handoff.
2. Run `git status --short` and inspect current diffs without resetting anything.
3. Confirm whether the 180 ms content-sync change is live on production. It passed all tests but its automatic deployment approval timed out twice in the final session.
4. If not live, run `npm run deploy:prod` with user authorization.
5. Continue future enhancements while preserving the rules and regressions documented above.

## 19. Non-negotiable preferences checklist

- Do not expose internal links or sensitive application names.
- Do not let CMS emptiness erase fallback content.
- Do not revive removed terminal filler commands.
- Do not reintroduce `$ select --featured`.
- Do not apply glitch effects to whole cards.
- Do not allow horizontal scrolling.
- Do not make mobile content inaccessible merely to force one viewport.
- Keep incomplete navigation/group rows centered.
- Keep footer fixed and content independently scrollable.
- Keep mobile navigation icon-based and reachable at the bottom.
- Keep BLUE and SOUND ON as defaults.
- Keep the final-year project nested under the bachelor's degree.
- Keep the current professional transparent pixel portrait unless the user requests another change.
- Build and run the full verification suite before production deployment.

