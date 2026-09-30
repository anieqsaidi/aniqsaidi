# My Car implementation

The private My Car app is integrated into the existing Astro build at `src/pages/car/`. The Hosting public directory remains `dist`; there is no separate Astro app or deployment target. All car pages are static HTML and use the existing Firebase client initialization for Google Authentication and Firestore.

## First use

Sign in with the site's existing approved admin Google account. The app asks for the vehicle's registration and current odometer. It preselects Perodua Myvi 1500cc automatic and Peninsular Malaysia. Year, variant, purchase details, loan, and history remain empty until entered.

The Firebase Console must have Google sign-in enabled and `aniqsaidi.my` listed under Authentication → Settings → Authorized domains. Add `localhost` there if local sign-in is needed. These are existing-site settings to verify, not changes made by this implementation.

## Service data

`src/car/schedule.ts` has only the supplied 40,000 km and 80,000 km automatic item group. The line totals and regional totals came from the owner-supplied screenshot described in `AGENTS.md`. Its capture/check date is unknown, so the app labels every price as an unverified reference. The public Perodua selector did not expose the selected table in inspectable page content on 30 September 2026. A service centre or the vehicle's Warranty and Service Booklet should confirm applicable dates, items, and current prices before more milestones are added. The booklet takes priority for this specific car.

HyperDrive was inspected as a visual reference. Its current repository has no license file, so no source code, images, fonts, or icons were copied. The app uses its own personal-dashboard layout and Tailwind integration.

## Local checks and release

- `npm run verify:prod` checks the static build and project test suite, including `npm run test:car`.
- `npm run test:rules` runs the Firestore rules suite with the emulator; it requires Java 21 available on `PATH`.
- The build emits `/car/`, `/car/maintenance/`, `/car/history/`, `/car/loan/`, `/car/vehicle/`, and `/car/expenses/` under the existing `dist` root.

The app requires Hosting files, Firestore rules, and Firestore composite indexes to be published together. The existing production deploy script includes those resources, but no deployment was performed during implementation. Newly created indexes may need time to become active. Verify a signed-in production read after they are ready.
