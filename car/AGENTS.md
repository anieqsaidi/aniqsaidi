# AGENTS.md — Personal Car Manager (`/car`)

## 0. Mission and scope

This is the complete implementation specification for **My Car**, a private Personal Car Manager at **https://aniqsaidi.my/car/**. When asked to implement `/car`, read the repository's root `AGENTS.md`, then this file in full. Inspect the actual repository, current site, `/batam` integration, Firebase configuration, and the HyperDrive source before editing. Implement a working application, run the production build and applicable checks, and fix failures. **Do not deploy unless the owner explicitly asks.** Do not stop at mockups or placeholder pages.

This file belongs at `aniqsaidi/car/AGENTS.md` and applies to `/car` and the minimum shared configuration needed to integrate it. Preserve the existing site and routes. Follow the parent `AGENTS.md` where applicable; if a requirement conflicts with the real repository or another instruction, use the least invasive safe implementation and explain the deviation in the delivery report. Do not wait for a separate planning approval before doing the implementation requested by the owner.

## 1. Product brief

- Product name: **My Car**.
- Initial vehicle: **Perodua Myvi, 1500cc, automatic**, Malaysia; official service price region defaults to **Peninsular Malaysia**.
- Initial service profile key: `perodua-myvi-1500-auto`.
- The owner must enter unknown personal facts: registration, model year/variant, purchase details, loan terms, current mileage, service history and dates. Do not invent them.
- The app tracks vehicle profile, odometer, flat-rate car loan, optional loan payments, Perodua scheduled servicing, actual service history, repairs and wear items, and actual spending.
- It serves one owner and likely one vehicle now, but all persisted vehicle-related records use `vehicleId` so a later second vehicle needs no data migration. Provide a clear current-vehicle selector only if multiple vehicles exist.
- Keep it a simple personal utility. Do not add dealership, marketplace, fleet, multi-tenant SaaS, server-side accounting, or social features.

## 2. Architecture and integration

### Required stack

- Astro with **static output** and Tailwind CSS; use the versions and integration API compatible with the existing repository.
- Vanilla TypeScript/JavaScript for client-side state, forms, calculations, filtering and Firebase operations. Astro handles static layouts and markup.
- Existing **`aniqsaidi` Firebase project**, Firebase Hosting, Cloud Firestore, and Firebase Authentication. Reuse existing Firebase initialization and authentication if present; centralize the client app, `auth`, and `db` in one module if absent.
- Chart.js only if a small chart materially helps. No state-management framework.
- Do not introduce React, Vue, Svelte, Next.js, Nuxt, SSR, Astro server actions, a Node/Express backend, Firebase Functions, Cloud Run, Docker, Supabase or a second database/project without a later explicit request.

### HyperDrive adaptation

Use [HyperDrive](https://github.com/wpinfusion/astro-hyperdrive) as a **visual source**, after inspecting its current source and license. Adapt suitable automotive typography, cards, imagery, buttons, grids, responsive patterns and Tailwind styles. Remove dealership inventory, car sales/search, featured listings, makes directory, blog, corporate counts, sales CTAs/team and contact-sales flow. Remove or refactor Netlify adapter/configuration, server actions, server form handlers and API routes if they interfere with a static Firebase build. Do not blindly copy the template or replace the existing site. The finished app must look like a personal ownership dashboard.

### `/car` deployment boundary

The production URL is a **path** on `aniqsaidi.my`, not a subdomain. Inspect how the parent site builds and publishes before choosing integration. A separate Astro app under `car/` with `site: "https://aniqsaidi.my"`, `base: "/car"`, and `output: "static"` is acceptable if its build is assembled into the existing Hosting public directory. If the parent Astro site already supports adding pages cleanly, integrate there instead. Follow the project's established `/batam` pattern where useful. Keep Firebase Hosting's current public root and rewrites intact; do not point Hosting at a car-only `dist` folder. Verify deep links and refreshes such as `/car/maintenance/` and all asset URLs, including image, CSS, JS and auth redirect URLs. Use base-aware links; `/maintenance/` is wrong, `/car/maintenance/` is right. Preserve `/`, `/batam`, and every other current route.

### Performance and state

Fetch only the selected vehicle's records. Use indexed, bounded queries for recent lists; load independent dashboard data concurrently. Avoid N+1 reads, full-collection fetches, and page-wide realtime listeners. Use realtime only where it helps. Cache small non-sensitive UI preferences locally; Firestore remains the source of persisted truth. Design loading, empty, error and offline states. A failed save must never appear successful. Do not use runtime scraping of Perodua.

## 3. Navigation, routes and visual behavior

| Route | Required content |
| --- | --- |
| `/car/` | Dashboard: current vehicle, next official service, loan summary, quick actions, recent history and spending |
| `/car/maintenance/` | **Schedule** and **History** tabs; service details and record-service entry point |
| `/car/history/` | Full chronological maintenance/repair history; may share the Maintenance History view |
| `/car/loan/` | Loan setup/edit, calculations, progress and optional payment records |
| `/car/vehicle/` | Profile, edit details, mileage update and odometer history |
| `/car/expenses/` | Optional dedicated expense view if useful; otherwise surface spending within dashboard/history |
| `/car/settings/` | Optional small settings page for sign out and service region |

Primary mobile navigation: **Home, Maintenance, Loan, My Car**. History and expenses may be secondary actions. Use a compact app header, clear page title and persistent bottom navigation on phones; desktop may use a top or side navigation with the same information architecture. Share a layout, auth guard, loading/error treatment and success feedback across private pages. No corporate website header.

Design mobile first at about 360, 390 and 430 px without horizontal scrolling. Use cards or stacked rows instead of wide tables, large touch targets, visible focus states, semantic labels, keyboard-friendly dialogs, strong contrast, and status text in addition to color. Use a restrained premium automotive visual style: dark neutral `#111827`, light background `#F8FAFC`, white cards, a restrained accent such as `#2563EB`, success `#16A34A`, warning `#F59E0B`, danger `#DC2626`. HyperDrive's suitable palette can override these suggestions. Large metrics such as `37,820 km` or `RM 1,250.00` should be prominent. Use `en-MY`, Malaysian ringgit formatting, `km`, and readable dates such as `24 Sep 2026`. No fake customer counts, lorem ipsum, sample registrations or demo transactions in production.

## 4. Authentication and Firestore ownership

Use Firebase Authentication. Reuse the parent site's provider if available; otherwise provide a simple Google sign-in if configured in the existing Firebase project. Show a clean sign-in state until auth resolves; never flash private car data to signed-out users. Provide sign-out. Do not hardcode credentials or commit service account/private secrets. Firebase web config may be public, but keep configuration centralized and environment-aware. If provider or authorized-domain configuration is required, document the exact console step without pretending it is already complete.

Use top-level collections: `users`, `vehicles`, `loans`, `loanPayments`, `maintenance`, `odometer`, `expenses`. Each private vehicle-related document has `ownerId` equal to the signed-in user's UID and `vehicleId` (vehicle document itself has `ownerId`). `users/{uid}` is accessible only to that UID. Check ownership in client queries **and** in Firestore Security Rules. Rules must also prevent a user from creating or updating a child record with another user's vehicle ID; check the referenced `vehicles/{vehicleId}.ownerId` where practical. Do not deploy open rules such as `allow read, write: if true`. Use immutable owner/vehicle references on update unless an explicit secure migration is needed. Provide or update required composite indexes with the queries. Never trust client filters alone as security.

Suggested schema (adapt field names to existing conventions, but keep semantics consistent):

```ts
type Region = "peninsular" | "east-malaysia";

interface Vehicle {
  ownerId: string;
  manufacturer: string;        // default "Perodua"
  model: string;               // default "Myvi"
  variant: string;             // user supplied; do not guess year/trim
  engineCc: number | null;     // default 1500
  transmission: "automatic" | "manual" | "cvt" | string;
  year: number | null;
  registrationNo: string;
  purchaseDate: Timestamp | null;
  purchasePrice: number | null; // MYR
  currentMileage: number;      // integer km
  serviceProfile: string;      // "perodua-myvi-1500-auto"
  serviceRegion: Region;       // default "peninsular"
  imageUrl: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface OdometerReading {
  ownerId: string;
  vehicleId: string;
  mileage: number;
  recordedAt: Timestamp;
  source: "manual" | "maintenance" | "system";
  maintenanceId?: string;
  note?: string;
  createdAt: Timestamp;
}

interface Expense {
  ownerId: string;
  vehicleId: string;
  expenseDate: Timestamp;
  category: "fuel" | "insurance" | "road_tax" | "toll" | "parking" | "other";
  amount: number;
  description: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Store money as integer sen internally if convenient, or numeric MYR rounded to two decimals consistently. Never mix units. Use Firestore `Timestamp` for persisted dates and server timestamps for audit fields; convert date-only form values carefully so local service dates do not shift with timezone. Keep optional fields truly optional/null, not invented defaults.

## 5. First-run vehicle setup and odometer

If the owner has no vehicle, show a short setup flow. Prefill Perodua / Myvi / 1500cc / Automatic / Peninsular / `perodua-myvi-1500-auto`; ask for registration, model year or variant as available, and current odometer. Purchase date, purchase price and image are optional. Do not require loan setup to use the vehicle and maintenance features. If image storage is not already available, allow a placeholder; do not add Storage solely for v1. Edit vehicle details later.

The dashboard vehicle card shows image or tasteful placeholder, make/model/variant, registration, year, current odometer and last update, plus **Update mileage**. Mileage input must be finite, nonnegative and an integer. A lower reading requires a clear warning and an explicit correction path; never silently reduce the vehicle's current mileage. On accepted update, atomically update `vehicles.currentMileage` and append an `odometer` document. Preserve history. When recording maintenance with a greater reading, append a reading and advance current mileage atomically; older service records may have lower mileage without decreasing it. Handle concurrent edits so the current value does not go backwards. Odometer history is newest first and includes source/date.

## 6. Official Perodua scheduled maintenance

### Source and evidence

The owner specified the [Perodua Service Maintenance page](https://www.perodua.com.my/after-sales/service-maintenance) and supplied a screenshot showing **MYVI 1500cc → 40,000KM & 80,000KM → Automatic Transmission**. [Perodua's FAQ](https://www.perodua.com.my/faq) says service timing is **date or mileage, whichever comes first**, and refers owners to the Warranty and Service Booklet for details. The booklet, when the owner supplies it, takes priority for this exact vehicle/year. Next use current official Perodua information, then a previously verified local dataset. If sources disagree, flag the difference. Never guess an interval, replacement item, date or official price.

The live web page's selector may load data dynamically, so the owner's screenshot is the provenance for the table below. **The screenshot does not establish a verification date or guarantee today's price.** Perodua [announced service parts and labour price changes effective 19 June 2026](https://www.perodua.com.my/articles/perodua-reduces-its-price-of-service-maintenance-parts-labour-by-an-overall-average-of-10-effective-19-june); check the current official selector or service centre during implementation before labelling any price current. A reference with an unknown check date should display **“Reference price; date unverified”**, not a fabricated `verifiedAt` value. If reverified, record the actual check date and source. The local app must work even when the official website is unavailable.

### Required local dataset and engine

Create a curated local file such as `src/data/perodua-myvi-1500-service-schedule.ts`. Separate immutable schedule definitions from regional price snapshots. Include `profileId`, exact transmission, target mileage, optional time interval only when verified, source URL, `verifiedAt: string | null`, item IDs/names/quantities/categories, and price snapshot provenance. Model the 40,000 and 80,000 km entries as separate milestones that share the official `40000-80000` item group. Store published **line totals**, not guessed per-unit prices: the ATF row has quantity 3 and a displayed total of RM 138.30 for Peninsular Malaysia. Do not multiply it by 3 again. Use a stable schedule ID, e.g. `perodua-myvi1500-auto-40000` and `perodua-myvi1500-auto-80000`.

The exact screenshot reference is:

| Official item (automatic) | Qty | Peninsular RM, line total | East Malaysia RM, line total |
| --- | ---: | ---: | ---: |
| Perodua Engine Oil Fully Syn 0W-20 3.5L | 1 | 161.10 | 167.80 |
| Drain Plug Gasket - Engine Oil | 1 | 3.80 | 4.20 |
| Engine Oil Filter | 1 | 12.50 | 13.25 |
| Air Cleaner Filter | 1 | 62.90 | 69.20 |
| Auto Transmission Oil ATF D3 SP | 3 | 138.30 | 146.70 |
| Drain Plug Gasket - AT | 1 | 3.80 | 4.20 |
| Brake Fluid 1.0L | 1 | 26.40 | 27.70 |
| Labour Charges | 1 | 165.00 | 165.00 |
| SST (8%) | 1 | 13.20 | 13.20 |
| **Published total** |  | **587.00** | **611.25** |

The totals above are the screenshot's reference figures, not expenses and not guaranteed quotes. Keep Peninsular and East Malaysia values distinct. Do not copy the screenshot's manual-transmission zero columns into this automatic profile. Preserve exact official item names in the detail view; compact labels may be shorter.

Add other Myvi 1500cc automatic mileage milestones, service items, time rules and prices **only after verification** against the owner's booklet or official source. Do not infer the 10k, 20k, 30k, 50k, 60k etc. item lists from the 40k/80k template. If a 10,000 km / six-month oil guideline applies, verify that it applies to this exact vehicle/year before using it as a due rule; do not turn an oil guideline into a full service schedule. Unverified intervals may appear only as clearly marked gaps or generic milestones, never as completed or priced official schedules. Provide a maintainable way to fill them later.

### Due-state calculation

Determine the next **verified** scheduled milestone from the service profile and actual records; never use `currentMileage + 10000` as the schedule. An actual record linked to a schedule ID marks that milestone completed; elapsed mileage alone does not. Earlier intervals with no record show **No record**, not Completed. Compute `remainingKm = targetMileage - currentMileage` and show due at/over target, due soon within a centralized threshold such as 1,000 km, otherwise upcoming. A known verified date deadline can also make a milestone due or due soon, whichever comes first. Derive dates only from a verified interval and trustworthy anchor such as purchase/registration date or prior scheduled service date as the applicable booklet rule specifies. When that information is missing, show the mileage requirement and **“Service date not set”** or ask for the needed date. Do not invent deadlines. The dashboard service card shows next milestone, current mileage, remaining distance, due date if known, region, reference estimate if verified, and **View service**. A simple progress bar may show progress between verified milestone points without false precision.

### Maintenance pages and workflow

On `/car/maintenance/`, default to **Schedule** with a **History** tab. Schedule shows next service prominently and an ordered service timeline. Each milestone detail shows exact official items, quantities, applicable region, reference line/total prices, source link, verification date or unknown-date label, and a **Record Service** action. Visually distinguish official recommendations from actual work.

`Record 40,000 km Service` prefills a form from the 40k official template. The user can mark each item done/not done, change actual quantities and prices, add/remove invoice items, enter service date, actual mileage, workshop/location, labour, parts, tax, discount, actual total and notes. Never silently claim every recommended item was performed. Keep a snapshot of what was recorded so later changes to the official dataset do not alter history. The actual invoice total may be entered directly even if it differs from the sum of itemized amounts; clearly show and allow the discrepancy to be reconciled. Require a nonnegative actual total and a valid date/mileage. Record a completed official milestone only when the user explicitly links the record to that schedule ID. Repairs and wear items never edit official templates or auto-complete a milestone.

Support unscheduled work such as tyres, rotation, alignment, balancing, brakes, battery, wipers, air conditioning, suspension, electrical work, repairs, accessories, inspection and other. Use stable internal category IDs with friendly display labels. History is a digital service book: newest first, grouped or filterable by year/category, with date, mileage, scheduled/unscheduled badge, workshop, work summary and **actual** cost. A small optional search is fine. Allow correcting and deleting records with confirmation and consistent odometer/spending recalculation.

Suggested maintenance document:

```ts
interface MaintenanceRecord {
  ownerId: string;
  vehicleId: string;
  recordType: "scheduled" | "unscheduled" | "repair";
  scheduleId: string | null;         // required for scheduled completion
  serviceDate: Timestamp;
  mileage: number;
  category: string;
  workshop: { name: string; location?: string };
  items: Array<{
    name: string; category: string; quantity: number;
    unitPrice?: number; actualCost: number;
    scheduled: boolean; completed: boolean;
  }>;
  partsCost: number;
  labourCost: number;
  tax: number;
  discount: number;
  totalCost: number;                 // actual invoice amount, MYR
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Official estimates forecast upcoming costs only. Spending summaries and history use actual maintenance `totalCost`, never an official estimate. Avoid duplicating maintenance as `expenses` documents; combine maintenance totals and standalone expense records in read-time summaries, or use a clear single-source link if an expense is generated. Do not double count. Receipt upload can wait until a later release unless storage already exists and is trivial to reuse.

## 7. Loan module

Focus v1 on a Malaysian **flat-rate hire-purchase estimate**. Ask for vehicle price, down payment (or direct principal financed when the contract specifies it), annual flat interest rate, tenure in years/months, loan start date, contracted monthly instalment if available, and installments paid. Do not prefill real financial values. Store the agreement inputs and any bank-provided instalment separately from computed figures. Use numeric calculations with consistent rounding to sen; display the bank figure if entered while explaining any difference from the computed estimate.

```text
principal = vehiclePrice − downPayment
totalInterest = principal × (annualFlatRatePercent / 100) × (tenureMonths / 12)
totalRepayment = principal + totalInterest
estimatedMonthlyInstalment = totalRepayment / tenureMonths
estimatedScheduledPaid = min(installmentsPaid × estimatedMonthlyInstalment, totalRepayment)
estimatedRemaining = max(0, totalRepayment − estimatedScheduledPaid)
progress = clamp(estimatedScheduledPaid / totalRepayment, 0, 1)
remainingMonths = max(0, tenureMonths − installmentsPaid)
```

Use a final-installment adjustment for rounding if showing a payment schedule. Compute expected final payment month from the supplied **first instalment due date**, if known; otherwise label the date estimated from the loan start date and do not pretend it matches the bank's contract. Clamp paid count to `0..tenureMonths`. Show original principal, interest, total repayment, instalment, paid count, estimated amount paid, **Estimated remaining scheduled repayment**, progress, remaining months and expected finish. Explicitly state that the remaining figure is **not a bank early-settlement quote**; statutory rebates, early settlement, arrears, fees and bank-specific rules are outside v1. Do not call it outstanding principal.

Suggested loan records:

```ts
interface Loan {
  ownerId: string; vehicleId: string;
  vehiclePrice: number | null;
  downPayment: number | null;
  principalFinanced: number;
  annualFlatRatePercent: number;
  tenureMonths: number;
  loanStartDate: Timestamp;
  firstDueDate: Timestamp | null;
  contractedMonthlyInstalment: number | null;
  installmentsPaid: number;       // single summary source of truth
  lender?: string;
  notes?: string;
  createdAt: Timestamp; updatedAt: Timestamp;
}

interface LoanPayment {
  ownerId: string; vehicleId: string; loanId: string;
  paymentDate: Timestamp;
  amount: number;
  paymentNumber: number | null;
  notes?: string;
  createdAt: Timestamp;
}
```

The app works without individual `loanPayments`: the user may just update `installmentsPaid`. Optional payment records show actual cash paid. If entering a new payment should advance the count, make that an explicit one-instalment action, enforce a unique payment number for that loan, and update the count atomically; do not silently add both recorded cash and count-based estimates to one total. Show **actual recorded payments** separately from **estimated scheduled payments** when both exist. Editing/deleting a payment must not silently corrupt the count; provide reconciliation or recompute it from the selected source. Keep the default flow simple.

Validation: finite nonnegative money values, down payment no greater than price, positive principal, flat rate `>= 0`, tenure a positive whole number of months, paid count within tenure, and valid dates. Do not save NaN or infinite values. Empty loan state invites setup; dashboard loan card does not show invented metrics.

## 8. Expenses and reports

Keep standalone expenses simple: fuel, insurance, road tax, toll, parking and other. Maintenance/repairs are recorded in maintenance and included in reports once. Show maintenance spending this year and lifetime, and optionally total vehicle spending by year/category. Use actual dated records. Optional charts can show monthly or category spending, but omit charts that do not clarify a decision. Loan principal/repayment must not be silently mixed into maintenance totals. Label each summary's scope.

## 9. Forms, validation and failure handling

- Label every field and use mobile-friendly input modes, date controls and numeric keyboards. Disable repeated submits; show saving, success and useful failure messages.
- Reject invalid dates, negative amounts, impossible loan terms, missing required ownership references and negative/non-integer odometer readings. Warn before a backwards odometer correction.
- Use transactions or batched writes for coupled vehicle/odometer, maintenance/odometer and payment/count updates. Avoid partially saved records.
- Offer explicit empty states for no vehicle, no loan, no maintenance history, unverified service schedule and no expenses. Never fabricate production data to fill the UI.
- Keep a usable read-only view of cached/loaded data during transient errors where possible; mark stale/offline state clearly and never suggest an unsaved edit succeeded.
- Use proper keyboard access, focus management and error text for dialogs/forms. Do not rely only on color or hover.

## 10. Suggested source layout

Adapt this to the existing repository rather than forcing a restructure:

```text
car/
├── AGENTS.md
├── astro.config.mjs                 # if /car is its own Astro app
├── src/
│   ├── pages/                      # index, maintenance, history, loan, vehicle
│   ├── layouts/CarLayout.astro
│   ├── components/                 # header, nav, cards, form, empty/error states
│   ├── data/perodua-myvi-1500-service-schedule.ts
│   ├── lib/firebase.ts
│   ├── lib/auth.ts
│   ├── lib/vehicles.ts
│   ├── lib/maintenance.ts
│   ├── lib/loans.ts
│   ├── lib/expenses.ts
│   ├── lib/odometer.ts
│   ├── lib/service-due.ts
│   ├── lib/format.ts
│   └── styles/
└── public/
```

## 11. Implementation sequence

1. Read root instructions; inspect parent build, `/batam`, Hosting and Firebase configuration, existing auth, and HyperDrive. Identify the least invasive integration path and any version/route constraints.
2. Establish static `/car` routing, base-aware asset paths, shared app shell, responsive style and auth guard. Preserve existing routes.
3. Implement Firebase initialization, ownership-aware data access and security rules/indexes. Build first-run vehicle setup and profile/odometer update.
4. Curate the verified Perodua schedule dataset and price provenance. Implement schedule timeline, due-state logic, source/detail view, and clear missing-data states.
5. Implement actual scheduled and unscheduled maintenance forms/history, odometer updates and spending summaries.
6. Implement the loan setup, calculations, progress, optional payment log and reconciliation behavior.
7. Complete dashboard and remaining navigation, empty/loading/error states, accessibility and mobile polish. Remove HyperDrive dealership content and demo data.
8. Run production build, existing lint/type checks, focused calculation/security tests and manual route/mobile checks. Fix errors. Report what was built and any source/configuration limitations. Do not deploy without explicit instruction.

## 12. Acceptance criteria

- `/car/` and every required deep route load directly and on refresh under the existing `aniqsaidi.my` Hosting structure; the root site, `/batam` and other routes still build and work.
- Astro output is static; no Netlify/server dependency or backend service is required for app behavior.
- Signed-out visitors see sign-in, not private vehicle data. Firestore rules enforce ownership, including linked vehicle documents; rule tests cover permitted owner access and rejected cross-user access.
- First-run setup persists the Myvi defaults while asking the owner for unknown facts; no fake personal or financial records appear.
- Mileage updates create historical readings and never silently lower current mileage. Maintenance entries with higher mileage update it consistently.
- Maintenance has clearly separate **official schedule** and **actual history**. The 40k/80k automatic item group and both reference totals match the screenshot table above, with line totals and unknown verification date handled correctly. Unverified intervals/items/dates/prices are never presented as official facts.
- Next-service status uses verified milestones plus actual linked completions, date-or-mileage when both are known, and honest missing-date states. Prior milestones are not auto-marked complete from odometer alone.
- Recording a scheduled service copies editable recommended items into an actual record, captures invoice amount/date/mileage/workshop, and uses actual cost in spending. Repairs remain separate from the official template.
- The loan form calculates flat-rate estimates correctly, handles zero interest and last-month rounding, labels scheduled remaining as an estimate, and works with only an instalment count. Optional payment records do not double count.
- The dashboard shows useful current data and quick actions; empty, loading, error and offline states are understandable. Mobile screens at 360/390/430 px have no horizontal overflow. Forms and navigation are keyboard usable.
- Production build and existing lint/type checks pass; focused tests cover due-state boundaries, completed/unrecorded services, financial formulas, and coupled write behavior. No template dealership data remains.
- The implementation report lists actual files changed, checks run, current Perodua verification status, required Firebase console setup if any, and confirms deployment was not performed.

## 13. Source notes

- Owner-provided screenshot in the referenced **Car Loan Maintenance System** conversation: MYVI 1500cc, 40,000KM & 80,000KM, automatic transmission, Peninsular RM587.00, East Malaysia RM611.25. Screenshot capture/check date unknown.
- Official [Perodua Service Maintenance](https://www.perodua.com.my/after-sales/service-maintenance): variant and interval selector to verify current service detail.
- Official [Perodua FAQ](https://www.perodua.com.my/faq): servicing follows date or mileage, whichever comes first; booklet holds details.
- Official [Perodua 2026 service price announcement](https://www.perodua.com.my/articles/perodua-reduces-its-price-of-service-maintenance-parts-labour-by-an-overall-average-of-10-effective-19-june): prices can change, so reference prices need provenance and rechecking.
- [HyperDrive repository](https://github.com/wpinfusion/astro-hyperdrive): Astro automotive visual starting point, to be adapted rather than copied wholesale.
