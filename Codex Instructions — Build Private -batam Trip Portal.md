# Codex Instructions — Build Private `/batam` Trip Portal

## Objective

Create a new private, mobile-first trip portal page at:

`/batam`

This page is for a group trip to Batam, Indonesia.

Do **not** add this page to:

- Main navigation
- Footer navigation
- Homepage
- Portfolio/project sections
- Sitemap
- Internal page links
- Any public navigation structure

The page should only be accessible by directly entering the URL.

Example:

`https://aniqsaidi.my/batam`

The page should feel like a compact **travel companion / trip dashboard**, not a normal portfolio webpage.

---

# 1. Privacy Requirements

The page is intended only for the travellers.

Add:

```html
<meta name="robots" content="noindex, nofollow">
```

Also ensure `/batam` is excluded from the generated sitemap if the website has one.

For now, prepare the UI structure so a PIN/password gate can be added.

If implementing a simple PIN gate now:

- Do not expose the actual PIN visibly in the UI.
- Store successful access temporarily using session storage/local storage.
- Do not repeatedly prompt during the same session.

However, do not treat client-side PIN protection as secure protection for highly sensitive documents.

Sensitive files such as:

- Passport copies
- Insurance certificates
- Ferry QR codes
- Booking documents
- eSIM QR codes

should not be publicly exposed through predictable `/assets/...` URLs.

---

# 2. Design Direction

Build the page **mobile-first**.

Primary use case:

The travellers will open the page from their phones while travelling.

Design goals:

- Fast
- Compact
- Touch-friendly
- Easy to scan
- Minimal scrolling for important information
- Clear visual hierarchy
- Large tap targets
- Avoid unnecessary animations
- Avoid hover-dependent interactions
- Important information must be visible quickly

The page may behave like a mini travel app.

Recommended visual direction:

- White/light background
- Clean cards
- Rounded corners
- Strong typography
- Small travel-related icons
- Indonesian/Batam accent elements may be used subtly
- Avoid excessive decoration
- Prioritise information over aesthetics

---

# 3. Main Trip Information

Display prominently near the top:

**BATAM 2026**

**28–30 August 2026**

**3 Days · 2 Nights**

**9 Travellers**

Journey:

**Sungai Buloh → Pasir Gudang → Batam**

The road journey begins the previous night.

Current plan:

**27 August 2026 — approximately 10:00 PM**

Depart Sungai Buloh by car.

Reason:

Early departure because heavy traffic is expected during the long holiday period.

Note:

The original itinerary sheet currently mentions `12:00 AM`, but the latest intended plan is approximately `10:00 PM on 27 August`.

Treat `10:00 PM` as the current planned departure unless updated later.

---

# 4. Homepage / Dashboard Structure

Recommended order:

1. Trip Header
2. Up Next
3. Quick Access
4. Today's Itinerary
5. Important Notices
6. Full Itinerary
7. Ferry
8. Hotel
9. Crew
10. Supir / Transport
11. eSIM
12. Insurance
13. Trip Essentials
14. Emergency

Do not create unnecessary separate pages unless technically useful.

Prefer expandable sections, cards, tabs, accordions or bottom sheets.

---

# 5. Dynamic "Up Next" Component

Create a prominent card labelled:

**Up Next**

This should display the next relevant itinerary activity according to the current date and time.

Example before the trip:

```text
UP NEXT

Depart Sungai Buloh
27 Aug · 10:00 PM

3 Cars · 9 Travellers
```

Example on the morning of 28 August:

```text
UP NEXT

Ferry to Batam Centre
28 Aug · 8:45 AM MYT

Pasir Gudang → Batam Centre
```

Where possible, determine the next event automatically from the itinerary.

Important:

Malaysia uses:

`Asia/Kuala_Lumpur`
UTC+8

Batam uses:

`Asia/Jakarta`
UTC+7

The ferry schedule crosses between these two time zones.

Clearly display:

- `MYT` for Malaysia time
- `WIB` for Batam/Indonesia time

Do not silently convert times without showing the timezone.

---

# 6. Quick Access

Provide large quick-access buttons/cards for:

- Itinerary
- Ferry
- Hotel
- Crew
- Supir
- eSIM
- Insurance
- Essentials
- Emergency

These may scroll to sections on the same page.

---

# 7. Full Itinerary

## Day 0 — Thursday, 27 August 2026

### Approximately 10:00 PM

Depart from Sungai Buloh.

Transport:

3 cars.

Route:

Sungai Buloh → Pasir Gudang.

Reason for early departure:

Expected long-holiday traffic congestion.

Overnight drive towards Johor.

---

# Day 1 — Friday, 28 August 2026

## Early Morning

### Approximately 4:00 AM

Estimated arrival near Pasir Gudang Ferry Terminal.

Activities:

- Rest
- Prayer
- Sleep/rest inside cars if necessary

---

### 7:15 AM – 7:30 AM

Enter ferry terminal.

Tasks:

- Ticket check-in
- Immigration
- Boarding preparation

---

### 8:45 AM MYT

Ferry departure:

**Pasir Gudang → Batam Centre**

Important:

Malaysia time = UTC+8.

---

### Approximately 8:45 AM WIB – 9:30 AM WIB

Arrive at Batam Centre.

Activities:

- Immigration
- Customs
- Arrival procedures

Batam is one hour behind Malaysia.

---

### 9:30 AM – 9:40 AM

Travel to:

**Muzium Batam Raja Ali Haji**

Approximate distance:

1 km

Approximate drive:

5 minutes.

---

### 9:40 AM – 10:40 AM

Visit:

- Muzium Batam Raja Ali Haji
- Masjid Agung Raja Hamidah

---

### 10:40 AM – 11:00 AM

Travel to:

**Sambal Bakaran**

---

### 11:00 AM – 12:30 PM

Lunch:

**Sambal Bakaran**

---

### 12:30 PM – 1:00 PM

Travel to:

**Lovina Inn Nagoya Batam**

Approximate distance from current itinerary:

6 km

Approximate travel time:

20 minutes.

---

### 1:00 PM – 3:30 PM

Hotel:

- Check-in
- Rest

---

### 3:30 PM – 3:45 PM

Travel to:

**Melt Me Dessert & Coffee Space**

Approximate distance:

3 km

Approximate drive:

10 minutes.

---

### 3:45 PM – 5:00 PM

Activities:

- OOTD
- Chill
- Dessert
- Coffee

Location:

**Melt Me Dessert & Coffee Space**

---

### 5:00 PM – 5:20 PM

Travel to:

**Harbour Bay Downtown**

Approximate distance:

5 km

Approximate drive:

15 minutes.

---

### 5:20 PM – 7:00 PM

Activities:

- Relax
- Walk around
- Sunset view

Location:

**Harbour Bay Downtown**

---

### 7:00 PM – 8:30 PM

Dinner options:

- Love Seafood Nagoya
- Angkringan Tepi Danau Bengkong

---

### From 8:30 PM

Free time.

Return to hotel.

Rest.

---

# Day 2 — Saturday, 29 August 2026

### 8:00 AM – 8:15 AM

Breakfast.

Status:

**TBC**

---

### 8:15 AM – 9:15 AM

Currently open / buffer period.

---

### 9:15 AM – 9:30 AM

Travel to:

**Maru Bakehouse**

Approximate distance:

4 km

Approximate drive:

12 minutes.

---

### 9:30 AM – 10:30 AM

Activities:

- OOTD
- Chill
- Pastry

Location:

**Maru Bakehouse**

---

### 10:30 AM – 10:45 AM

Travel to:

**Grand Batam Mall**

Approximate distance:

3 km

Approximate drive:

10 minutes.

---

### 10:45 AM – 1:00 PM

Activities:

- Shopping
- Walk around

Location:

**Grand Batam Mall**

---

### 1:00 PM – 1:15 PM

Travel to:

**RM Sederhana**

Approximate distance:

2 km

Approximate drive:

8 minutes.

---

### 1:15 PM – 2:00 PM

Lunch:

**RM Sederhana**

Food:

Nasi Padang.

---

### 2:30 PM – 3:00 PM

Activity:

**TBC**

---

### 3:00 PM – 4:30 PM

Activity:

**TBC**

---

### 4:30 PM – 5:00 PM

Travel to:

**Blue Fire Beach Club**

Approximate distance:

12 km

Approximate drive:

25 minutes.

---

### 5:00 PM – 7:00 PM

Activities:

- Relax
- Sunset
- Chill

Location:

**Blue Fire Beach Club**

---

### 7:00 PM – 7:20 PM

Travel to dinner.

Approximate distance:

8 km

Approximate drive:

20 minutes.

---

### 7:20 PM – 9:00 PM

Seafood dinner options:

- Golden Prawn 933
- Seafood One Marina

---

### From 9:00 PM

Return to hotel.

Rest.

---

# Day 3 — Sunday, 30 August 2026

### 7:30 AM – 7:45 AM

Travel for breakfast.

Proposed location:

**Tebing Laut Cafe Tg Uma**

Approximate distance:

3.5 km

Approximate drive:

12 minutes.

---

### 7:45 AM – 8:30 AM

Activities:

- Breakfast
- Hotel checkout

---

### 8:30 AM – 8:45 AM

Travel to:

**Love Batam Gift / Pusat Kek Lapis**

Approximate distance:

4 km

Approximate drive:

12 minutes.

---

### 8:45 AM – 9:30 AM

Shopping:

- Souvenirs
- Local products
- Gifts

Location:

**Love Batam Gift**

---

### 9:30 AM – 9:45 AM

Travel to:

**Batam Centre Ferry Terminal**

Approximate distance:

5 km

Approximate drive:

15 minutes.

---

### 9:45 AM – 11:00 AM

At ferry terminal:

- Immigration
- Customs
- Check-in
- Boarding preparation

---

### 11:20 AM WIB

Return ferry:

**Batam Centre → Pasir Gudang**

Display clearly:

`11:20 AM WIB`

Approximate Malaysia equivalent:

`12:20 PM MYT`

The original itinerary allocates ferry travel until approximately:

`1:20 PM MYT`

Do not hardcode arrival as exact unless ferry ticket confirms it.

---

### Approximately 1:20 PM MYT

Arrive in Pasir Gudang.

Drive back to:

**Sungai Buloh**

---

# 8. Ferry Section

Status:

**Ticket pending receipt from friend**

Current known outbound information:

## Outbound

Date:

**28 August 2026**

Route:

**Pasir Gudang → Batam Centre**

Departure:

**8:45 AM MYT**

Passenger count:

**9**

The ferry operator, booking number, seat details and actual ticket file are still pending.

Show placeholders such as:

```text
Operator: Pending
Booking Reference: Pending
Ticket: Pending
```

Do not invent these values.

---

## Return

Date:

**30 August 2026**

Route:

**Batam Centre → Pasir Gudang**

Known departure according to itinerary:

**11:20 AM WIB**

Ticket confirmation still pending.

---

# 9. Ferry Terminal Fee Important Notice

Add a prominent warning/info card.

Title:

**Terminal Fees**

Known information:

Terminal fees may not be included in online ferry ticket prices.

For the current route:

### Pasir Gudang

Estimated terminal fee:

**RM25–RM30**

Payment may need to be made at the ferry counter.

---

### Batam Centre

Estimated terminal fee:

**IDR 100,000**

---

Possible fuel surcharge:

**RM12–RM17**

This may vary depending on fuel prices/operator.

Clearly label this as:

**Possible additional surcharge**

Do not represent it as guaranteed.

---

For 9 travellers, estimated group total based on standard passenger rate would be:

Pasir Gudang:

**RM225–RM270**

Batam Centre:

**IDR 900,000**

However:

Do not assume the 1-year-old child is charged the full adult terminal fee.

Mark the infant terminal fee as:

**To Confirm**

---

# 10. Hotel Section

Hotel:

**Lovina Inn Nagoya Batam**

Stay:

**28–30 August 2026**

Duration:

**2 nights**

Create a hotel card with:

- Hotel name
- Address placeholder if not yet verified
- Map button placeholder
- Distance from Batam Centre Ferry Terminal placeholder
- Estimated travel time placeholder
- Check-in
- Check-out
- Room allocation

Do not invent the hotel address or ferry-terminal distance.

They can be populated after verification.

---

## Room Allocation

### Room 1

Type:

**Twin Room**

Guests:

- Aniq
- Faisal

---

### Room 2

Type:

**Deluxe Room**

Guests:

- Badiuz
- Nasuha
- Nayla

Nayla is 1 year old.

---

### Room 3

Type:

**Deluxe Room**

Guests:

- Intan
- Khairrin

---

### Room 4

Type:

**Deluxe Room**

Guests:

- Intan's Parents

---

# 11. Crew Section

Total:

**9 travellers**

Group travellers by car.

---

## Car 1 — 4 People

- Intan
- Khairrin
- Intan's father
- Intan's mother

Relationship:

Intan and Khairrin are husband and wife.

---

## Car 2 — 2 People

- Aniq
- Faisal

---

## Car 3 — 3 People

- Badiuz
- Nasuha
- Nayla

Relationships:

Badiuz and Nasuha are husband and wife.

Nayla is their daughter.

Age:

**1 year old**

Nayla may need special consideration for:

- Ferry rules
- Insurance
- Child/infant pricing
- Medical emergencies
- Transport

Do not assume adult pricing applies to her.

---

# 12. Supir / Local Transport Section

Replace the generic "Bookings" section with:

**Supir**

or:

**Local Transport**

Current known booking:

Duration:

**2 days**

Dates:

- 28 August 2026
- 29 August 2026

Daily availability:

**9:00 AM – 10:00 PM**

Total agreed price:

**IDR 3,600,000**

If split equally among all 9 travellers:

**IDR 400,000 per traveller**

Only show per-person calculation as informational.

Do not imply that this is the confirmed payment arrangement.

Create fields/placeholders for:

- Driver name
- Driver WhatsApp
- Driver phone
- Vehicle
- Registration plate
- Company/agency
- Pickup location
- Payment status
- Deposit
- Remaining balance

These details are currently pending.

Also create a small "To Confirm" section:

- Fuel included?
- Parking included?
- Toll included?
- Driver meals included?
- Overtime charge?
- Additional hours?
- Airport/ferry pickup included?

Do not fabricate answers.

Add button placeholders:

- WhatsApp Supir
- Call Supir

Only enable them once a phone number exists.

---

# 13. eSIM Section

Status:

**Ready**

The eSIM files have already been compiled separately.

Create UI that can later display:

- Provider
- Data quota
- Validity
- Installation guide
- Activation instructions
- iPhone instructions
- Android instructions
- QR/setup file

For now, keep the content structure ready for the actual eSIM files.

Important:

Do not publicly expose eSIM QR codes unless access control is sufficient.

---

# 14. Insurance Section

Status:

**Pending**

Policy is expected to arrive by email.

Create placeholders for:

- Insurance company
- Policy number
- Coverage dates
- Insured travellers
- Emergency hotline
- Overseas medical assistance
- Claims contact
- Policy document

Display:

**Insurance policy pending**

Do not invent any details.

Once the policy is available, important emergency numbers should be extracted and surfaced directly instead of requiring travellers to open the whole PDF.

---

# 15. Trip Essentials Section

Create a compact checklist.

Suggested items:

- Passport
- Ferry ticket
- Travel insurance
- eSIM installed/downloaded
- MYR cash
- IDR cash
- Phone charger
- Power bank
- Medication
- Hotel booking
- Supir contact

This can be displayed as static checklist UI.

Do not persist completion state unless easily implemented.

---

# 16. Currency Reminder

Add a small information card:

## Bring Both Currencies

### Malaysia

Use:

**MYR**

Needed especially for:

- Pasir Gudang terminal
- Malaysia-side expenses

---

### Batam / Indonesia

Use:

**IDR**

Needed especially for:

- Batam Centre terminal fees
- Cash-only payments
- Local expenses

Wise / QRIS may be used where supported, but the page should remind travellers to carry physical cash.

Do not claim QRIS/Wise availability at every merchant.

---

# 17. Emergency Section

Create the UI structure now.

Do not hardcode unverified emergency numbers yet.

Use placeholders that can later be populated with verified official information.

Categories:

## Indonesia Emergency

Fields:

- General emergency
- Police
- Ambulance
- Fire & Rescue

---

## Malaysian Consular Assistance

Fields:

- Relevant Malaysian diplomatic/consular mission
- Phone
- Emergency/after-hours number
- Address
- Maps button

---

## Medical

Fields:

- Nearest suitable hospital
- 24-hour emergency department
- Paediatric-capable hospital

This is particularly important because one traveller is a 1-year-old child.

Buttons:

- Call
- Maps

---

## Hotel

Hotel:

**Lovina Inn Nagoya Batam**

Fields:

- Hotel phone
- Hotel address

Buttons:

- Call Hotel
- Open Maps

---

## Supir

Fields:

- Driver name
- WhatsApp
- Phone

Buttons:

- WhatsApp
- Call

---

## Travel Insurance

Fields:

- Insurer
- Emergency assistance number
- Policy number

Button:

- Emergency Assistance

---

# 18. Important Notice Component

Create a reusable notice/warning component.

Examples:

### Ferry

```text
Terminal fee may not be included in your online ferry ticket.
Prepare MYR and IDR cash.
```

### Timezone

```text
Batam is 1 hour behind Malaysia.
MYT = UTC+8
WIB = UTC+7
```

### Pending Information

```text
Ferry ticket pending confirmation.
```

Use clear statuses:

- Confirmed
- Pending
- TBC
- Important

Avoid aggressive red warnings unless information is actually critical.

---

# 19. Timezone Handling

This page crosses two time zones.

Use explicit timezone metadata for itinerary entries.

Examples:

```js
{
  title: "Ferry to Batam",
  datetime: "2026-08-28T08:45:00+08:00",
  timezone: "MYT"
}
```

Arrival example:

```js
{
  title: "Arrive Batam Centre",
  datetime: "2026-08-28T08:45:00+07:00",
  timezone: "WIB"
}
```

Return:

```js
{
  title: "Ferry to Pasir Gudang",
  datetime: "2026-08-30T11:20:00+07:00",
  timezone: "WIB"
}
```

Do not rely only on browser-local timezone because travellers may have roaming/device timezone behaviour that changes automatically.

Always display the intended timezone label.

---

# 20. Suggested Data Structure

Do not hardcode all itinerary HTML repeatedly.

Store the itinerary as structured data.

Example:

```js
const itinerary = [
  {
    date: "2026-08-28",
    label: "Day 1",
    title: "Arrival & Nagoya",
    events: [
      {
        time: "08:45",
        timezone: "MYT",
        title: "Ferry to Batam Centre",
        description: "Pasir Gudang → Batam Centre",
        status: "confirmed"
      }
    ]
  }
];
```

The page UI should render from this data.

This will make later updates easier.

---

# 21. TBC and Pending States

The itinerary contains unfinished information.

Do not remove these.

Display them clearly.

Examples:

Day 2:

- Breakfast — TBC
- 2:30 PM – 3:00 PM — TBC
- 3:00 PM – 4:30 PM — TBC

Pending:

- Ferry tickets
- Ferry operator
- Ferry booking reference
- Insurance
- Supir contact details
- Hotel map/address verification
- Emergency contacts

Use neutral badges such as:

`TBC`

`Pending`

---

# 22. Buttons / Useful Actions

Where relevant, support:

- Open Maps
- Call
- WhatsApp
- View Ticket
- View Policy
- View eSIM Guide
- Copy Address
- Copy Booking Reference

Disable/hide actions when data is unavailable.

Do not create fake links.

---

# 23. Do Not Add Yet

Do not overengineer this initial version.

Do not build:

- User accounts
- Admin dashboard
- Database
- Real-time chat
- Photo gallery
- Social feed
- Live currency API
- Live weather API
- Expense splitting system
- Complex backend
- Push notifications

These may be added later if needed.

---

# 24. Important Development Principle

This page must behave as a **single source of truth for the trip**.

It should answer practical questions quickly:

- What are we doing next?
- What time is the ferry?
- Is that Malaysia time or Batam time?
- Where is the hotel?
- Who is staying in which room?
- Who is travelling in which car?
- What is our supir arrangement?
- Where are the eSIM instructions?
- Where is the insurance?
- How much cash do we need at the ferry terminal?
- Who should we call in an emergency?

Prioritise this over decorative features.

---

# 25. Current Information Status

Use the following development status internally:

| Section | Status |
|---|---|
| Full itinerary | Complete |
| Crew | Complete |
| Hotel name | Complete |
| Hotel room allocation | Complete |
| Hotel map/distance | Pending verification |
| Ferry schedule | Available from itinerary |
| Ferry actual ticket | Pending |
| Ferry operator | Pending |
| Ferry booking reference | Pending |
| Supir price | Complete |
| Supir dates/hours | Complete |
| Supir contact | Pending |
| eSIM | Ready / files available separately |
| Insurance | Pending email |
| Emergency contacts | Pending verification |

---

# 26. Final Development Requirement

Build `/batam` now using the currently available information.

Where information is missing:

**show a clean Pending/TBC state instead of inventing data.**

The initial implementation should already be usable even before the remaining ferry, insurance and emergency information is received.

Keep the code modular enough so those details can be added later without redesigning the page.