export const BATAM_ACCOUNTS = {
  aniq: { pin: '7685', memberIds: ['aniq'], greeting: 'Hi, Aniq. Welcome to Batam!', role: 'admin' },
  faisal: { pin: '2412', memberIds: ['faisal'], greeting: 'Hi, Faisal. Welcome to Batam!', role: 'traveller' },
  khairrin: { pin: '3568', memberIds: ['khairrin', 'intan'], greeting: 'Hi, Khairrin & Intan. Welcome to Batam!', role: 'traveller' },
  intan: { pin: '9739', memberIds: ['khairrin', 'intan'], greeting: 'Hi, Khairrin & Intan. Welcome to Batam!', role: 'traveller' },
  dedi: { pin: '4760', memberIds: ['dedi', 'azilah'], greeting: 'Hi, Dedi & Azilah. Welcome to Batam!', role: 'traveller' },
  azilah: { pin: '1476', memberIds: ['dedi', 'azilah'], greeting: 'Hi, Dedi & Azilah. Welcome to Batam!', role: 'traveller' },
  badiuz: { pin: '3495', memberIds: ['badiuz', 'nasuha', 'nayla'], greeting: 'Hi, Badiuz Family. Welcome to Batam!', role: 'traveller' },
  nasuha: { pin: '2320', memberIds: ['badiuz', 'nasuha', 'nayla'], greeting: 'Hi, Badiuz Family. Welcome to Batam!', role: 'traveller' },
};

export const BATAM_TRAVELLERS = {
  aniq: { name: 'Muhammad Amrun Aniq bin Mohamed Saidi', displayName: 'Aniq', phone: '+60 19-242 7685', dateOfBirth: '2 Aug 1996', gender: 'Male', nationality: 'Malaysia', passport: 'A70047036', passportExpiry: '15 Aug 2028', arrivalCard: '2608260058002', evisa: 'B1A2957887', ferryOutbound: '8347854', ferryReturn: '8347855', insurance: 'Zurich Takaful · PZTIMYGT038514', room: 'Room 1 · Superior Twin · with Faisal', esim: 'Ready' },
  faisal: { name: 'Muhammad Faisal bin Hasan', displayName: 'Faisal', phone: '+60 19-434 2412', dateOfBirth: '17 Jan 1996', gender: 'Male', nationality: 'Malaysia', passport: 'A62774448', passportExpiry: '23 May 2030', arrivalCard: '2608260074287', evisa: 'B1A2959639', ferryOutbound: '8347856', ferryReturn: '8347857', insurance: 'Zurich Takaful · PZTIMYGT038514', room: 'Room 1 · Superior Twin · with Aniq', esim: 'Ready' },
  khairrin: { name: 'Khairrin Naim bin Redzuan', displayName: 'Khairrin', phone: '+60 17-278 3568', dateOfBirth: '23 Jan 1997', gender: 'Male', nationality: 'Malaysia', passport: 'A71352340', passportExpiry: '2 May 2030', arrivalCard: '2608260009345', evisa: 'B1A2953647', ferryOutbound: '8347852', ferryReturn: '8347853', insurance: 'Zurich Takaful · PZTIMYGT038514', room: 'Room 2 · Superior Twin · with Intan', esim: 'Ready' },
  intan: { name: 'Intan Nurshahira binti Razaly', displayName: 'Intan', phone: '+60 17-610 9739', dateOfBirth: '11 Nov 1996', gender: 'Female', nationality: 'Malaysia', passport: 'A56953306', passportExpiry: '3 Oct 2027', arrivalCard: '2608260009345', evisa: 'B1A2953644', ferryOutbound: '8347851', ferryReturn: '8347850', insurance: 'Zurich Takaful · PZTIMYGT038514', room: 'Room 2 · Superior Twin · with Khairrin', esim: 'Ready' },
  dedi: { name: 'Dedi bin Jalinas', displayName: 'Dedi', phone: '+60 19-665 4760', dateOfBirth: '24 Apr 1967', gender: 'Male', nationality: 'Malaysia', passport: 'A56850006', passportExpiry: '12 Nov 2027', arrivalCard: '2608260009345', evisa: 'B1A2953655', ferryOutbound: '8347848', ferryReturn: '8347849', insurance: 'Zurich Takaful · PZTIMYGT038514', room: 'Room 3 · Standard Double · with Azilah', esim: 'Ready' },
  azilah: { name: 'Azilah binti Abd Aziz', displayName: 'Azilah', phone: '+60 12-321 1476', dateOfBirth: '11 Jun 1972', gender: 'Female', nationality: 'Malaysia', passport: 'A57494075', passportExpiry: '14 Nov 2027', arrivalCard: '2608260009345', evisa: 'B1A2953654', ferryOutbound: '8347844', ferryReturn: '8347845', insurance: 'Zurich Takaful · PZTIMYGT038514', room: 'Room 3 · Standard Double · with Dedi', esim: 'Ready' },
  badiuz: { name: 'Badiuz Zaman bin Badrul Idza', displayName: 'Badiuz', phone: '+60 13-359 3495', dateOfBirth: '22 Sep 1996', gender: 'Male', nationality: 'Malaysia', passport: 'A72558179', passportExpiry: '12 Jun 2031', arrivalCard: '2608260062858', evisa: 'B1A2958406', ferryOutbound: '8347846', ferryReturn: '8347847', insurance: 'Takaful Malaysia · TPAF00026645', room: 'Room 4 · Standard Double · with Nasuha & Nayla', esim: 'Own roaming' },
  nasuha: { name: 'Nur Nasuha binti Mazalan', displayName: 'Nasuha', phone: '+60 16-364 2320', dateOfBirth: '19 Dec 1996', gender: 'Female', nationality: 'Malaysia', passport: 'A72558180', passportExpiry: '12 Jun 2031', arrivalCard: '2608260062858', evisa: 'B1A2958427', ferryOutbound: '8347859', ferryReturn: '8347858', insurance: 'Takaful Malaysia · TPAF00026645', room: 'Room 4 · Standard Double · with Badiuz & Nayla', esim: 'Ready' },
  nayla: { name: 'Nur Nayla Bahiyyah binti Badiuz Zaman', displayName: 'Nayla', phone: 'Not applicable', dateOfBirth: '21 Dec 2024', gender: 'Female', nationality: 'Malaysia', passport: 'A72558181', passportExpiry: '12 Jun 2031', arrivalCard: '2608260062858', evisa: 'B1A2958428', ferryOutbound: '8347860', ferryReturn: '8347861', insurance: 'Takaful Malaysia · TPAF00026645', room: 'Room 4 · Standard Double · with Badiuz & Nasuha', esim: 'Not required' },
};

const DOCUMENTS = {
  ferry: { id: 'ferry', kind: 'Ferry', title: 'Return ferry order · all travellers', driveId: '1kulYQeFrmwWwmlAQtTsYEyVK11ecr3yy', members: Object.keys(BATAM_TRAVELLERS) },
  hotelAF: { id: 'hotel-af', kind: 'Hotel', title: 'Hotel confirmation · Aniq & Faisal', driveId: '17o8NH30_0gThnPnYoxZB6_pn_QRmjd1B', members: ['aniq', 'faisal'] },
  hotelFamilies: { id: 'hotel-families', kind: 'Hotel', title: 'Hotel confirmation · family rooms', driveId: '1L9bm4GqkvHpO_9NPMPBXOhfn7Aeyodd5', members: ['khairrin', 'intan', 'dedi', 'azilah', 'badiuz', 'nasuha', 'nayla'] },
  zurich: { id: 'insurance-zurich', kind: 'Insurance', title: 'Zurich Travel Takaful policy', driveId: '1as5AgvBXLsTuftf5TTl3zTlDA5XPUYml', members: ['aniq', 'faisal', 'khairrin', 'intan', 'dedi', 'azilah'] },
  takaful: { id: 'insurance-takaful', kind: 'Insurance', title: 'Takaful Malaysia family policy', driveId: '1mMb3hyjqnfKPc_rp_JkKr_rhfOmOvwQ1', members: ['badiuz', 'nasuha', 'nayla'] },
  arrivalAniq: { id: 'arrival-aniq', kind: 'Immigration', title: 'Arrival card · Aniq', driveId: '1AYKjN60d3ML1ad4Pw9Xzluj57ms9z-u6', mimeType: 'image/jpeg', members: ['aniq'] },
  arrivalFaisal: { id: 'arrival-faisal', kind: 'Immigration', title: 'Arrival card · Faisal', driveId: '1xIvefutjkqJqgc4cKb4JEzMe9zGc1QKq', mimeType: 'image/jpeg', members: ['faisal'] },
  arrivalKhairrinIntanDediAzilah: { id: 'arrival-khairrin-intan-dedi-azilah', kind: 'Immigration', title: 'Arrival card · Khairrin, Intan, Dedi & Azilah', driveId: '1_vxtg-dZ9XCnqwmoFdb9Fk2WPbLM1TBj', mimeType: 'image/jpeg', members: ['khairrin', 'intan', 'dedi', 'azilah'] },
  arrivalBadiuzFamily: { id: 'arrival-badiuz-family', kind: 'Immigration', title: 'Arrival card · Badiuz family', driveId: '1w3igMhfMW8OCti8mdNJfmpR72YwsM1Az', mimeType: 'image/jpeg', members: ['badiuz', 'nasuha', 'nayla'] },
};

const EVISA_IDS = { aniq: '1u5AAmPmRvlPMEibf4ngx2dezhJLtJ8p1', faisal: '1-FpDRlkZLmv1dTLPBpQc9Z0V8ju8bOu4', khairrin: '1Lx5WAYokgEESzSiYbA7uUhVHCEkhf7Gx', intan: '1SB1yJRNvUc9_alrQbY2LUATb1Zdz-0Qx', dedi: '1J-Nbb3rWYDjD23y5MgLSCUmPGgp666nR', azilah: '1E1e57H1o2PYilT1-rHcsvdd0NhtwfB2r', badiuz: '1m2kLBwRFeEgDqVgrtSwaeaYS8vwXEZEs', nasuha: '1sM018l7iDJeOlzNFH2kKYbvERNC7205d', nayla: '1seueW-E6hASoY3V6HsXqrHXChZtAtryE' };
const ESIM_IDS = { aniq: '1TEhA-9-U46O_B63wiu_1hhVon3eHRA-z', faisal: '1XB0uKh1E64da9yig8molmE51Epn1qQ3o', khairrin: '1sXAA_YI8P87hOYBI05TBI58hogu6sQB8', intan: '1n1a-uuj7HMiDPUlZIG1qHwMS3c78Tq_1', dedi: '1twawUejFQlfYcGMz6CopIuxwqN7UUshN', azilah: '1rz-6PjSYtIrbmyPzKyPW5BGdFrMEV2-o', nasuha: '1tb9qf2-9_fcoXj-1hEg1uJeql76FD7Zf' };

export function profileForAccount(username) {
  const account = BATAM_ACCOUNTS[username];
  if (!account) return null;
  const members = account.memberIds.map((id) => ({ id, ...BATAM_TRAVELLERS[id] }));
  const shared = Object.values(DOCUMENTS).filter((document) => document.members.some((id) => account.memberIds.includes(id)));
  const individual = account.memberIds.flatMap((id) => [
    { id: `evisa-${id}`, kind: 'Immigration', title: `Visa Exemption · ${BATAM_TRAVELLERS[id].displayName}`, driveId: EVISA_IDS[id], owner: id, members: [id] },
    ESIM_IDS[id] ? { id: `esim-${id}`, kind: 'eSIM', title: `eSIM · ${BATAM_TRAVELLERS[id].displayName}`, driveId: ESIM_IDS[id], owner: id, members: [id] } : null,
  ].filter(Boolean));
  const documents = [...shared, ...individual];
  return { username, greeting: account.greeting, role: account.role, members, documents: documents.map(({ driveId, members: permitted, ...document }) => ({ ...document, shared: permitted.length > 1 })) };
}

export function documentForAccount(username, documentId) {
  const account = BATAM_ACCOUNTS[username];
  if (!account) return null;
  const shared = Object.values(DOCUMENTS);
  const individual = account.memberIds.flatMap((id) => [
    { id: `evisa-${id}`, kind: 'Immigration', title: `Visa Exemption · ${BATAM_TRAVELLERS[id].displayName}`, driveId: EVISA_IDS[id], members: [id] },
    ESIM_IDS[id] ? { id: `esim-${id}`, kind: 'eSIM', title: `eSIM · ${BATAM_TRAVELLERS[id].displayName}`, driveId: ESIM_IDS[id], members: [id] } : null,
  ].filter(Boolean));
  return [...shared, ...individual].find((document) => document.id === documentId && document.members.some((id) => account.memberIds.includes(id))) || null;
}

export function adminSnapshot() {
  const individualDocuments = Object.keys(BATAM_TRAVELLERS).flatMap((id) => [
    { id: `evisa-${id}`, kind: 'Immigration', title: `Visa Exemption · ${BATAM_TRAVELLERS[id].displayName}`, members: [id] },
    ESIM_IDS[id] ? { id: `esim-${id}`, kind: 'eSIM', title: `eSIM · ${BATAM_TRAVELLERS[id].displayName}`, members: [id] } : null,
  ].filter(Boolean));
  return {
    trip: { title: 'Batam 2026', dates: '28–30 August 2026', travellers: Object.keys(BATAM_TRAVELLERS).length, accounts: Object.keys(BATAM_ACCOUNTS).length },
    accounts: Object.entries(BATAM_ACCOUNTS).map(([username, account]) => ({ username, role: account.role, greeting: account.greeting, memberIds: account.memberIds, pinConfigured: /^\d{4}$/.test(account.pin) })),
    travellers: Object.entries(BATAM_TRAVELLERS).map(([id, traveller]) => ({ id, ...traveller })),
    documents: [...Object.values(DOCUMENTS).map(({ driveId, ...document }) => document), ...individualDocuments].map((document) => ({ ...document, shared: document.members.length > 1 })),
  };
}
