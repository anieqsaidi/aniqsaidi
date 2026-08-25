export type TripStatus = 'confirmed' | 'pending' | 'tbc' | 'important';

export interface TripEvent {
  time: string;
  datetime: string;
  timezone: 'MYT' | 'WIB';
  title: string;
  description?: string;
  meta?: string;
  status?: TripStatus;
}

export interface TripDay {
  date: string;
  label: string;
  title: string;
  timezone: 'MYT' | 'WIB';
  events: TripEvent[];
}

export const itinerary: TripDay[] = [
  {
    date: '2026-08-27', label: 'Day 0', title: 'The overnight drive', timezone: 'MYT',
    events: [
      { time: '≈ 10:00 PM', datetime: '2026-08-27T22:00:00+08:00', timezone: 'MYT', title: 'Depart Sungai Buloh', description: '3 cars · 9 travellers · Overnight drive to Pasir Gudang', meta: 'Leaving early for expected long-holiday traffic.', status: 'important' },
    ],
  },
  {
    date: '2026-08-28', label: 'Day 1', title: 'Arrival & Nagoya', timezone: 'WIB',
    events: [
      { time: '≈ 4:00 AM', datetime: '2026-08-28T04:00:00+08:00', timezone: 'MYT', title: 'Arrive near Pasir Gudang terminal', description: 'Rest, prayer and sleep in the cars if needed' },
      { time: '7:15–7:30 AM', datetime: '2026-08-28T07:15:00+08:00', timezone: 'MYT', title: 'Enter ferry terminal', description: 'Ticket check-in · Immigration · Boarding preparation' },
      { time: '8:45 AM', datetime: '2026-08-28T08:45:00+08:00', timezone: 'MYT', title: 'Ferry to Batam Centre', description: 'Pasir Gudang → Batam Centre', status: 'confirmed' },
      { time: '≈ 8:45–9:30 AM', datetime: '2026-08-28T08:45:00+07:00', timezone: 'WIB', title: 'Arrive at Batam Centre', description: 'Immigration · Customs · Arrival procedures', meta: 'Batam is one hour behind Malaysia.' },
      { time: '9:30–9:40 AM', datetime: '2026-08-28T09:30:00+07:00', timezone: 'WIB', title: 'Travel to Muzium Batam', description: '≈ 1 km · 5 min' },
      { time: '9:40–10:40 AM', datetime: '2026-08-28T09:40:00+07:00', timezone: 'WIB', title: 'Muzium & Masjid', description: 'Muzium Batam Raja Ali Haji · Masjid Agung Raja Hamidah' },
      { time: '10:40–11:00 AM', datetime: '2026-08-28T10:40:00+07:00', timezone: 'WIB', title: 'Travel to Sambal Bakaran' },
      { time: '11:00 AM–12:30 PM', datetime: '2026-08-28T11:00:00+07:00', timezone: 'WIB', title: 'Lunch at Sambal Bakaran' },
      { time: '12:30–1:00 PM', datetime: '2026-08-28T12:30:00+07:00', timezone: 'WIB', title: 'Travel to Lovina Inn', description: '≈ 6 km · 20 min' },
      { time: '1:00–3:30 PM', datetime: '2026-08-28T13:00:00+07:00', timezone: 'WIB', title: 'Hotel check-in & rest' },
      { time: '3:30–3:45 PM', datetime: '2026-08-28T15:30:00+07:00', timezone: 'WIB', title: 'Travel to Melt Me', description: '≈ 3 km · 10 min' },
      { time: '3:45–5:00 PM', datetime: '2026-08-28T15:45:00+07:00', timezone: 'WIB', title: 'Melt Me Dessert & Coffee', description: 'OOTD · Chill · Dessert · Coffee' },
      { time: '5:00–5:20 PM', datetime: '2026-08-28T17:00:00+07:00', timezone: 'WIB', title: 'Travel to Harbour Bay', description: '≈ 5 km · 15 min' },
      { time: '5:20–7:00 PM', datetime: '2026-08-28T17:20:00+07:00', timezone: 'WIB', title: 'Harbour Bay Downtown', description: 'Relax · Walk · Sunset view' },
      { time: '7:00–8:30 PM', datetime: '2026-08-28T19:00:00+07:00', timezone: 'WIB', title: 'Dinner', description: 'Love Seafood Nagoya or Angkringan Tepi Danau Bengkong', status: 'tbc' },
      { time: 'From 8:30 PM', datetime: '2026-08-28T20:30:00+07:00', timezone: 'WIB', title: 'Free time & return to hotel' },
    ],
  },
  {
    date: '2026-08-29', label: 'Day 2', title: 'Shop, eat & sunset', timezone: 'WIB',
    events: [
      { time: '8:00–8:15 AM', datetime: '2026-08-29T08:00:00+07:00', timezone: 'WIB', title: 'Breakfast', status: 'tbc' },
      { time: '8:15–9:15 AM', datetime: '2026-08-29T08:15:00+07:00', timezone: 'WIB', title: 'Open / buffer period' },
      { time: '9:15–9:30 AM', datetime: '2026-08-29T09:15:00+07:00', timezone: 'WIB', title: 'Travel to Maru Bakehouse', description: '≈ 4 km · 12 min' },
      { time: '9:30–10:30 AM', datetime: '2026-08-29T09:30:00+07:00', timezone: 'WIB', title: 'Maru Bakehouse', description: 'OOTD · Chill · Pastry' },
      { time: '10:30–10:45 AM', datetime: '2026-08-29T10:30:00+07:00', timezone: 'WIB', title: 'Travel to Grand Batam Mall', description: '≈ 3 km · 10 min' },
      { time: '10:45 AM–1:00 PM', datetime: '2026-08-29T10:45:00+07:00', timezone: 'WIB', title: 'Grand Batam Mall', description: 'Shopping · Walk around' },
      { time: '1:00–1:15 PM', datetime: '2026-08-29T13:00:00+07:00', timezone: 'WIB', title: 'Travel to RM Sederhana', description: '≈ 2 km · 8 min' },
      { time: '1:15–2:00 PM', datetime: '2026-08-29T13:15:00+07:00', timezone: 'WIB', title: 'Nasi Padang lunch', description: 'RM Sederhana' },
      { time: '2:30–3:00 PM', datetime: '2026-08-29T14:30:00+07:00', timezone: 'WIB', title: 'Activity', status: 'tbc' },
      { time: '3:00–4:30 PM', datetime: '2026-08-29T15:00:00+07:00', timezone: 'WIB', title: 'Activity', status: 'tbc' },
      { time: '4:30–5:00 PM', datetime: '2026-08-29T16:30:00+07:00', timezone: 'WIB', title: 'Travel to Blue Fire Beach Club', description: '≈ 12 km · 25 min' },
      { time: '5:00–7:00 PM', datetime: '2026-08-29T17:00:00+07:00', timezone: 'WIB', title: 'Blue Fire Beach Club', description: 'Relax · Sunset · Chill' },
      { time: '7:00–7:20 PM', datetime: '2026-08-29T19:00:00+07:00', timezone: 'WIB', title: 'Travel to dinner', description: '≈ 8 km · 20 min' },
      { time: '7:20–9:00 PM', datetime: '2026-08-29T19:20:00+07:00', timezone: 'WIB', title: 'Seafood dinner', description: 'Golden Prawn 933 or Seafood One Marina', status: 'tbc' },
      { time: 'From 9:00 PM', datetime: '2026-08-29T21:00:00+07:00', timezone: 'WIB', title: 'Return to hotel & rest' },
    ],
  },
  {
    date: '2026-08-30', label: 'Day 3', title: 'Souvenirs & home', timezone: 'WIB',
    events: [
      { time: '7:30–7:45 AM', datetime: '2026-08-30T07:30:00+07:00', timezone: 'WIB', title: 'Travel for breakfast', description: 'Tebing Laut Cafe Tg Uma (proposed) · ≈ 3.5 km · 12 min', status: 'tbc' },
      { time: '7:45–8:30 AM', datetime: '2026-08-30T07:45:00+07:00', timezone: 'WIB', title: 'Breakfast & hotel checkout' },
      { time: '8:30–8:45 AM', datetime: '2026-08-30T08:30:00+07:00', timezone: 'WIB', title: 'Travel to Love Batam Gift', description: '≈ 4 km · 12 min' },
      { time: '8:45–9:30 AM', datetime: '2026-08-30T08:45:00+07:00', timezone: 'WIB', title: 'Souvenir shopping', description: 'Love Batam Gift / Pusat Kek Lapis' },
      { time: '9:30–9:45 AM', datetime: '2026-08-30T09:30:00+07:00', timezone: 'WIB', title: 'Travel to Batam Centre terminal', description: '≈ 5 km · 15 min' },
      { time: '9:45–11:00 AM', datetime: '2026-08-30T09:45:00+07:00', timezone: 'WIB', title: 'Ferry check-in', description: 'Immigration · Customs · Boarding preparation' },
      { time: '11:20 AM', datetime: '2026-08-30T11:20:00+07:00', timezone: 'WIB', title: 'Ferry to Pasir Gudang', description: '11:20 AM WIB = 12:20 PM MYT', status: 'confirmed' },
      { time: '≈ 1:20 PM', datetime: '2026-08-30T13:20:00+08:00', timezone: 'MYT', title: 'Arrive Pasir Gudang', description: 'Estimated only · Drive back to Sungai Buloh', status: 'pending' },
    ],
  },
];

export const allEvents = itinerary.flatMap((day) => day.events);
