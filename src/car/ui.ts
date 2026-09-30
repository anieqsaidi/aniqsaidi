import { GoogleAuthProvider, getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { getFirebaseServices } from '../lib/firebase';
import { calculateLoan, dateLabel, finiteNonnegative, km, localDate, rm, validMileage } from './calc';
import { PRICE_SNAPSHOT, SERVICE_ITEMS, SERVICE_SCHEDULE, SERVICE_SOURCE, dueState, nextService, priceFor, type Region } from './schedule';
import { OWNER_UID, asDate, completedScheduleIds, createVehicle, deleteExpense, deleteMaintenance, deletePayment, formDate, loadLoan, loadMoreRecords, loadRecords, loadVehicles, maintenanceTotals, saveExpense, saveLoan, saveMaintenance, savePayment, updateMileage, updateVehicle, type RecordData } from './store';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const e = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const number = (value: unknown) => Number(value ?? 0);
const optionalNumber = (value: unknown) => value === '' || value == null ? null : Number(value);
const input = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const page = document.body.dataset.carPage ?? 'home';
let cloud: NonNullable<Awaited<ReturnType<typeof getFirebaseServices>>>;
let uid = '';
let vehicles: RecordData[] = [];
let vehicle: RecordData | null = null;
let maintenance: RecordData[] = [];
let odometer: RecordData[] = [];
let expenses: RecordData[] = [];
let loan: RecordData | null = null;
let payments: RecordData[] = [];
let totals = { lifetime: 0, thisYear: 0 };
let completedIds: string[] = [];
let historyHasMore = false;
let historyYear = 'all';
let historyCategory = 'all';
let tab = 'schedule';
let editor = '';
let editingId = '';
let busy = false;
let viewportFrame = 0;

function syncHomeViewport() {
  if (page !== 'home') return;
  const app = $('car-app');
  const main = document.querySelector<HTMLElement>('.car-main');
  const fits = window.innerWidth >= 901 && !app.hidden && !editor && Boolean(main)
    && main!.getBoundingClientRect().bottom <= window.innerHeight + 1
    && document.documentElement.scrollWidth <= window.innerWidth + 1;
  document.documentElement.classList.toggle('car-home-fits', fits);
  if (fits && window.scrollY) window.scrollTo(0, 0);
}
function queueHomeViewport() {
  if (page !== 'home') return;
  cancelAnimationFrame(viewportFrame);
  viewportFrame = requestAnimationFrame(syncHomeViewport);
}

function status(message: string, type: 'error' | 'success' | '' = '') {
  const node = $('car-status'); node.hidden = !message; node.className = `car-status ${type}`; node.textContent = message;
  queueHomeViewport();
}
function content(markup: string) { $('car-page-content').innerHTML = markup; queueHomeViewport(); }
function field(name: string, label: string, value: unknown = '', options: { type?: string; required?: boolean; min?: string; step?: string; placeholder?: string; full?: boolean } = {}) {
  const { type = 'text', required = false, min, step, placeholder = '', full = false } = options;
  return `<div class="field${full ? ' full' : ''}"><label for="f-${e(name)}">${e(label)}</label><input id="f-${e(name)}" name="${e(name)}" type="${e(type)}" value="${e(value)}" ${required ? 'required' : ''} ${min !== undefined ? `min="${e(min)}"` : ''} ${step !== undefined ? `step="${e(step)}"` : ''} placeholder="${e(placeholder)}"></div>`;
}
function selectField(name: string, label: string, choices: [string, string][], selected: unknown) {
  return `<div class="field"><label for="f-${e(name)}">${e(label)}</label><select id="f-${e(name)}" name="${e(name)}">${choices.map(([value, label]) => `<option value="${e(value)}" ${selected === value ? 'selected' : ''}>${e(label)}</option>`).join('')}</select></div>`;
}
function formShell(title: string, body: string, button = 'Save', cancel = true) {
  return `<section class="card"><div class="section-head"><h2>${e(title)}</h2></div><form id="car-form"><div class="fields">${body}</div><p class="form-message" id="form-error" role="alert" hidden></p><div class="form-actions"><button class="button primary" type="submit">${e(button)}</button>${cancel ? '<button class="button" type="button" data-action="cancel">Cancel</button>' : ''}</div></form></section>`;
}
function empty(title: string, description: string, action = '') { return `<div class="empty"><strong>${e(title)}</strong>${e(description)}${action}</div>`; }
function regionLabel(region: Region) { return region === 'east-malaysia' ? 'East Malaysia' : 'Peninsular Malaysia'; }
function serviceSummary() {
  return nextService(number(vehicle?.currentMileage), completedIds);
}
function serviceStatus(entry: typeof SERVICE_SCHEDULE[number]) { return dueState(entry.targetMileage, number(vehicle?.currentMileage), completedIds.includes(entry.id)); }
function dateOf(value: any) { return dateLabel(asDate(value)); }
function serviceCard() {
  const next = serviceSummary();
  if (!next) return `<article class="card"><span class="metric-label">OFFICIAL SCHEDULE</span><h2 style="margin-top:10px">All verified milestones recorded</h2><p class="subtle">Ask your service centre or use your vehicle booklet for the next milestone. No later interval is verified here.</p><a class="button" href="/car/maintenance/">View schedule</a></article>`;
  const state = serviceStatus(next), remaining = next.targetMileage - number(vehicle?.currentMileage);
  return `<article class="card service-card"><div class="row"><span class="metric-label">NEXT VERIFIED SERVICE</span><span class="badge ${state}">${state === 'due' ? 'Due now' : state === 'soon' ? 'Due soon' : 'Upcoming'}</span></div><div class="metric">${km(next.targetMileage)}</div><p class="subtle">${remaining <= 0 ? `${km(-remaining)} past milestone` : `${km(remaining)} remaining`} · Service date not set</p><div class="progress"><span style="width:${Math.min(100, Math.max(0, number(vehicle?.currentMileage) / next.targetMileage * 100))}%"></span></div><p class="subtle">${e(regionLabel(vehicle?.serviceRegion || 'peninsular'))} · Reference estimate ${rm(PRICE_SNAPSHOT.totals[vehicle?.serviceRegion as Region || 'peninsular'])}</p><p class="subtle">Reference price; date unverified. Confirm current pricing with Perodua.</p><a class="button" href="/car/maintenance/#service-${next.targetMileage}">View service →</a></article>`;
}
function hero() {
  if (!vehicle) return '';
  return `<article class="hero-card"><p class="eyebrow">CURRENT VEHICLE</p><h2>${e(vehicle.manufacturer)} ${e(vehicle.model)}${vehicle.variant ? ` · ${e(vehicle.variant)}` : ''}</h2><p class="muted">${e(vehicle.registrationNo)}${vehicle.year ? ` · ${e(vehicle.year)}` : ''}</p><div class="hero-number">${km(number(vehicle.currentMileage))} <small>on the odometer</small></div><p class="muted" style="font-size:11px">Updated ${dateOf(vehicle.mileageUpdatedAt)}</p><div class="hero-actions"><button class="button primary" type="button" data-action="mileage">Update mileage</button><a class="button dark" href="/car/vehicle/">Vehicle details</a></div></article>`;
}
function historyList(rows: RecordData[], max = 20) {
  if (!rows.length) return empty('No service history yet', 'Record your first service or repair to start your digital service book.');
  return `<div class="list">${rows.slice(0, max).map((row) => `<div class="list-item"><div><strong>${e(row.workshop?.name || row.category || 'Service')}</strong> <span class="badge ${row.recordType === 'scheduled' ? 'completed' : ''}">${row.recordType === 'scheduled' ? 'Scheduled' : row.recordType === 'repair' ? 'Repair' : 'Unscheduled'}</span><p>${dateOf(row.serviceDate)} · ${km(number(row.mileage))}</p><p>${e(row.items?.filter((item: any) => item.completed).map((item: any) => item.name).slice(0, 3).join(', ') || row.category || 'Work recorded')}</p><div class="list-actions"><button type="button" data-action="edit-maintenance" data-id="${e(row.id)}">Edit</button><button class="delete" type="button" data-action="delete-maintenance" data-id="${e(row.id)}">Delete</button></div></div><div class="amount">${rm(number(row.totalCost))}</div></div>`).join('')}</div>`;
}
function filteredHistory() {
  const years = [...new Set(maintenance.map((row) => asDate(row.serviceDate)?.getFullYear()).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  const rows = maintenance.filter((row) => (historyYear === 'all' || String(asDate(row.serviceDate)?.getFullYear()) === historyYear) && (historyCategory === 'all' || row.recordType === historyCategory));
  return `<div class="history-filters"><label>Year <select data-filter="year"><option value="all">All years</option>${years.map((year) => `<option value="${year}" ${historyYear === String(year) ? 'selected' : ''}>${year}</option>`).join('')}</select></label><label>Type <select data-filter="category"><option value="all">All work</option>${[['scheduled', 'Scheduled'], ['unscheduled', 'Unscheduled'], ['repair', 'Repair']].map(([value, label]) => `<option value="${value}" ${historyCategory === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>${historyList(rows, rows.length)}${historyHasMore ? '<button class="button" type="button" data-action="more-history">Load more history</button>' : ''}`;
}
function renderHome() {
  const year = new Date().getFullYear();
  const loanSummary = loan ? calculateLoan({ principalFinanced: number(loan.principalFinanced), annualFlatRatePercent: number(loan.annualFlatRatePercent), tenureMonths: number(loan.tenureMonths), installmentsPaid: number(loan.installmentsPaid) }) : null;
  content(`<div class="grid two car-home-dashboard">${hero()}${serviceCard()}<article class="card"><span class="metric-label">HIRE-PURCHASE</span>${loanSummary ? `<div class="metric">${rm(loanSummary.remaining)}</div><p class="subtle">Estimated remaining scheduled repayment · ${loanSummary.remainingMonths} months left</p><div class="progress"><span style="width:${loanSummary.progress * 100}%"></span></div><p class="subtle">Not a bank early-settlement quote.</p>` : `<h2 style="margin-top:10px">No loan details yet</h2><p class="subtle">Add your agreement to see the estimated schedule.</p>`}<a class="button" href="/car/loan/">${loan ? 'View loan' : 'Set up loan'}</a></article><article class="card"><span class="metric-label">ACTUAL MAINTENANCE SPENDING</span><div class="metric">${rm(totals.thisYear)}</div><p class="subtle">${year} · ${rm(totals.lifetime)} lifetime</p><p class="subtle">Official estimates are excluded.</p><a class="button" href="/car/history/">View history</a></article><article class="card span-two"><div class="section-head"><h2>Quick actions</h2></div><div class="form-actions"><button class="button primary" type="button" data-action="new-maintenance">Record service</button><button class="button" type="button" data-action="mileage">Update mileage</button><a class="button" href="/car/expenses/">Add expense</a></div></article><article class="card span-two"><div class="section-head"><h2>Recent history</h2><a href="/car/history/">View all →</a></div>${historyList(maintenance, 4)}</article></div>`);
}
function vehicleForm(firstRun = false) {
  const v = vehicle;
  content(formShell(firstRun ? 'Add your Myvi' : 'Edit vehicle details', `<div class="field"><label for="f-make">Make</label><input id="f-make" value="Perodua" disabled></div><div class="field"><label for="f-model">Model</label><input id="f-model" value="Myvi 1500cc automatic" disabled></div>${field('registrationNo', 'Registration number', v?.registrationNo, { required: true })}${field('variant', 'Variant / trim (optional)', v?.variant)}${field('year', 'Model year (optional)', v?.year ?? '', { type: 'number', min: '1980', step: '1' })}${firstRun ? field('currentMileage', 'Current odometer (km)', '', { type: 'number', min: '0', step: '1', required: true }) : ''}${field('purchaseDate', 'Purchase date (optional)', formDate(v?.purchaseDate), { type: 'date' })}${field('purchasePrice', 'Purchase price (optional, RM)', v?.purchasePrice ?? '', { type: 'number', min: '0', step: '0.01' })}${selectField('serviceRegion', 'Service price region', [['peninsular', 'Peninsular Malaysia'], ['east-malaysia', 'East Malaysia']], v?.serviceRegion || 'peninsular')}`, firstRun ? 'Save vehicle' : 'Save details', !firstRun));
  editor = firstRun ? 'setup' : 'vehicle';
}
function mileageForm() {
  content(`${hero()}<div style="height:18px"></div>${formShell('Update mileage', `${field('mileage', 'New odometer reading (km)', vehicle?.currentMileage ?? '', { type: 'number', min: '0', step: '1', required: true })}${field('note', 'Note (optional)', '', { full: true })}<div class="field full"><label><input type="checkbox" name="correction" value="yes" style="width:auto;min-height:auto"> This is a correction to a lower reading</label><small class="subtle">A lower value needs this explicit confirmation. The previous reading stays in history.</small></div>`, 'Save reading')}</div>`);
  editor = 'mileage';
}
function renderVehicle() {
  if (editor === 'vehicle') return vehicleForm();
  if (editor === 'mileage') return mileageForm();
  content(`${hero()}<div class="grid two" style="margin-top:18px"><article class="card"><div class="section-head"><h2>Vehicle profile</h2><button class="button" type="button" data-action="edit-vehicle">Edit</button></div><div class="detail-grid"><div><small>Registration</small><strong>${e(vehicle?.registrationNo)}</strong></div><div><small>Variant</small><strong>${e(vehicle?.variant || 'Not set')}</strong></div><div><small>Year</small><strong>${e(vehicle?.year || 'Not set')}</strong></div><div><small>Engine</small><strong>1500cc</strong></div><div><small>Transmission</small><strong>Automatic</strong></div><div><small>Service region</small><strong>${e(regionLabel(vehicle?.serviceRegion || 'peninsular'))}</strong></div></div></article><article class="card"><div class="section-head"><h2>Odometer history</h2><button class="button" type="button" data-action="mileage">Add reading</button></div>${odometer.length ? `<div class="list">${odometer.slice(0, 30).map((row) => `<div class="list-item"><div><strong>${km(number(row.mileage))}</strong><p>${dateOf(row.recordedAt)} · ${e(row.source)}${row.correction ? ' correction' : ''}</p>${row.note ? `<p>${e(row.note)}</p>` : ''}</div></div>`).join('')}</div>` : empty('No readings', 'Your first reading will appear here after setup.')}</article></div>`);
}
function serviceDetails(entry: typeof SERVICE_SCHEDULE[number]) {
  const region: Region = vehicle?.serviceRegion || 'peninsular';
  const state = serviceStatus(entry);
  return `<article id="service-${entry.targetMileage}" class="card"><div class="row"><h2>${km(entry.targetMileage)} service</h2><span class="badge ${state}">${state === 'completed' ? 'Recorded' : state === 'due' ? 'Due now' : state === 'soon' ? 'Due soon' : 'No record'}</span></div><p class="subtle">Official item group for Myvi 1500cc automatic · ${e(regionLabel(region))}</p><div class="service-line header"><span>Official item</span><span>Qty</span><span>Ref. total</span></div>${SERVICE_ITEMS.map((item) => `<div class="service-line"><span>${e(item.name)}</span><span>${item.quantity}</span><span>${rm(priceFor(item, region))}</span></div>`).join('')}<div class="service-line"><strong>Published reference total</strong><span></span><span>${rm(PRICE_SNAPSHOT.totals[region])}</span></div><div class="notice">Reference price; date unverified. The screenshot does not establish today's price. Check the current quote with Perodua. Service date not set; your booklet sets the applicable time rule.</div><p class="subtle">Source: <a class="text-link" href="${SERVICE_SOURCE}" target="_blank" rel="noopener noreferrer">Perodua service maintenance ↗</a></p><button class="button primary" type="button" data-action="record-scheduled" data-id="${e(entry.id)}">Record ${new Intl.NumberFormat('en-MY').format(entry.targetMileage)} km service</button></article>`;
}
function renderMaintenance() {
  if (editor === 'maintenance') return maintenanceForm();
  content(`<div class="tabs" role="tablist" aria-label="Maintenance views"><button role="tab" aria-selected="${tab === 'schedule'}" data-action="tab-schedule">Schedule</button><button role="tab" aria-selected="${tab === 'history'}" data-action="tab-history">History</button></div>${tab === 'schedule' ? `<div class="grid"><div class="grid two">${serviceCard()}<article class="card"><h2>About this schedule</h2><p class="subtle">Only the 40,000 and 80,000 km automatic service item group is available from the supplied reference. Earlier and later milestones have not been verified for this vehicle.</p><div class="notice">Your Warranty and Service Booklet takes priority. Perodua says date or mileage, whichever comes first. Dates need a verified interval and an applicable starting date.</div></article></div>${SERVICE_SCHEDULE.map(serviceDetails).join('')}</div>` : `<div class="section-head"><h2>Actual service book</h2><button class="button primary" type="button" data-action="new-maintenance">Record work</button></div>${filteredHistory()}`}`);
}
function renderHistory() {
  if (editor === 'maintenance') return maintenanceForm();
  content(`<div class="section-head"><h2>Actual work</h2><button class="button primary" type="button" data-action="new-maintenance">Record work</button></div>${filteredHistory()}`);
}

const CATEGORIES: [string, string][] = [['tyres', 'Tyres'], ['rotation', 'Tyre rotation'], ['alignment', 'Alignment'], ['balancing', 'Balancing'], ['brakes', 'Brakes'], ['battery', 'Battery'], ['wipers', 'Wipers'], ['air_conditioning', 'Air conditioning'], ['suspension', 'Suspension'], ['electrical', 'Electrical'], ['repair', 'Repair'], ['accessories', 'Accessories'], ['inspection', 'Inspection'], ['other', 'Other']];
function maintenanceForm() {
  const existing = maintenance.find((row) => row.id === editingId);
  const entry = SERVICE_SCHEDULE.find((row) => row.id === (existing?.scheduleId || editingId));
  const scheduled = Boolean(entry && !existing || existing?.recordType === 'scheduled');
  const sourceItems = existing?.items || (scheduled ? SERVICE_ITEMS.map((item) => ({ name: item.name, category: item.category, quantity: item.quantity, actualCost: 0, scheduled: true, completed: false })) : []);
  const itemRows = sourceItems.map((item: any, index: number) => `<div class="item-editor"><input aria-label="Item done" type="checkbox" name="done-${index}" ${item.completed ? 'checked' : ''}><label>${e(item.name)}</label><input aria-label="Quantity for ${e(item.name)}" name="qty-${index}" type="number" min="0" step="0.01" value="${e(item.quantity)}"><input aria-label="Actual cost for ${e(item.name)}" name="cost-${index}" type="number" min="0" step="0.01" value="${e(item.actualCost)}"><input type="hidden" name="item-name-${index}" value="${e(item.name)}"><input type="hidden" name="item-category-${index}" value="${e(item.category)}"><input type="hidden" name="item-scheduled-${index}" value="${item.scheduled ? 'yes' : 'no'}">${item.scheduled ? '' : '<button class="item-remove" type="button" data-action="remove-item" aria-label="Remove invoice item">×</button>'}</div>`).join('');
  const extraRows = `<div id="extra-items"></div><button class="button" type="button" data-action="add-item">+ Add invoice item</button>`;
  content(formShell(existing ? 'Edit actual work' : scheduled ? `Record ${entry?.targetMileage.toLocaleString('en-MY')} km service` : 'Record service or repair', `<input type="hidden" name="itemCount" value="${sourceItems.length}"><div class="field full"><p class="subtle">${scheduled ? 'Official items are suggested below. Tick only work actually done and enter the actual invoice costs.' : 'Record what was actually done. This will not change the official schedule.'}</p></div>${selectField('recordType', 'Type of work', scheduled ? [['scheduled', 'Scheduled service']] : [['unscheduled', 'Unscheduled maintenance'], ['repair', 'Repair']], existing?.recordType || (scheduled ? 'scheduled' : 'unscheduled'))}${scheduled ? `<input type="hidden" name="scheduleId" value="${e(entry?.id || '')}">` : selectField('category', 'Category', CATEGORIES, existing?.category || 'other')}${field('serviceDate', 'Service date', formDate(existing?.serviceDate), { type: 'date', required: true })}${field('mileage', 'Odometer at service (km)', existing?.mileage ?? vehicle?.currentMileage, { type: 'number', min: '0', step: '1', required: true })}${field('workshop', 'Workshop / location', existing?.workshop?.name || '', { required: true, full: true })}<div class="field full"><label>Work and invoice items</label>${itemRows}${extraRows}</div>${field('partsCost', 'Parts subtotal (RM)', existing?.partsCost ?? 0, { type: 'number', min: '0', step: '0.01' })}${field('labourCost', 'Labour (RM)', existing?.labourCost ?? 0, { type: 'number', min: '0', step: '0.01' })}${field('tax', 'Tax (RM)', existing?.tax ?? 0, { type: 'number', min: '0', step: '0.01' })}${field('discount', 'Discount (RM)', existing?.discount ?? 0, { type: 'number', min: '0', step: '0.01' })}${field('totalCost', 'Actual invoice total (RM)', existing?.totalCost ?? '', { type: 'number', min: '0', step: '0.01', required: true })}<div class="field full"><label for="f-notes">Notes</label><textarea id="f-notes" name="notes">${e(existing?.notes || '')}</textarea></div><div class="field full"><small class="subtle">The invoice total is stored as entered, even if it differs from the itemized sum. Check both amounts before saving.</small></div>`, 'Save actual record'));
}
function loanForm() {
  const l = loan;
  content(formShell(l ? 'Edit hire-purchase agreement' : 'Set up hire-purchase agreement', `${field('vehiclePrice', 'Vehicle price (RM, optional)', l?.vehiclePrice ?? '', { type: 'number', min: '0', step: '0.01' })}${field('downPayment', 'Down payment (RM, optional)', l?.downPayment ?? '', { type: 'number', min: '0', step: '0.01' })}${field('principalFinanced', 'Principal financed (RM)', l?.principalFinanced ?? '', { type: 'number', min: '0.01', step: '0.01', required: true })}${field('annualFlatRatePercent', 'Annual flat interest rate (%)', l?.annualFlatRatePercent ?? '', { type: 'number', min: '0', step: '0.001', required: true })}${field('tenureMonths', 'Tenure (months)', l?.tenureMonths ?? '', { type: 'number', min: '1', step: '1', required: true })}${field('installmentsPaid', 'Instalments paid', l?.installmentsPaid ?? 0, { type: 'number', min: '0', step: '1', required: true })}${field('loanStartDate', 'Loan start date', formDate(l?.loanStartDate), { type: 'date', required: true })}${field('firstDueDate', 'First instalment due date (optional)', formDate(l?.firstDueDate), { type: 'date' })}${field('contractedMonthlyInstalment', 'Bank monthly instalment (optional, RM)', l?.contractedMonthlyInstalment ?? '', { type: 'number', min: '0', step: '0.01' })}${field('lender', 'Lender (optional)', l?.lender || '')}${field('notes', 'Notes (optional)', l?.notes || '', { full: true })}`, 'Save agreement', Boolean(l)));
  editor = 'loan';
}
function expectedFinish(l: RecordData) {
  const first = formDate(l.firstDueDate || l.loanStartDate);
  if (!first) return 'Not set';
  const [year, month, day] = first.split('-').map(Number);
  const monthIndex = year * 12 + month - 1 + number(l.tenureMonths) - 1;
  const targetYear = Math.floor(monthIndex / 12), targetMonth = monthIndex % 12 + 1;
  const targetDay = Math.min(day, new Date(targetYear, targetMonth, 0).getDate());
  const date = localDate(`${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`);
  return `${dateLabel(date)}${l.firstDueDate ? '' : ' (estimated from loan start)'}`;
}
function renderLoan() {
  if (editor === 'loan') return loanForm();
  if (editor === 'payment') return paymentForm();
  if (!loan) return content(empty('No loan details yet', 'Maintenance works without a loan. Add your agreement whenever you are ready.', '<br><button class="button primary" type="button" data-action="edit-loan">Set up loan</button>'));
  const calc = calculateLoan({ principalFinanced: number(loan.principalFinanced), annualFlatRatePercent: number(loan.annualFlatRatePercent), tenureMonths: number(loan.tenureMonths), installmentsPaid: number(loan.installmentsPaid) });
  const actualPaid = payments.reduce((sum, row) => sum + number(row.amount), 0);
  content(`<div class="grid two"><article class="hero-card"><p class="eyebrow">ESTIMATED REMAINING SCHEDULED REPAYMENT</p><h2>${rm(calc.remaining)}</h2><p class="muted">${calc.remainingMonths} months remain · ${number(loan.installmentsPaid)} of ${number(loan.tenureMonths)} instalments marked paid</p><div class="progress"><span style="width:${calc.progress * 100}%"></span></div><p class="muted" style="font-size:11px">This is not a bank early-settlement quote. Rebates, arrears and fees are excluded.</p></article><article class="card"><div class="section-head"><h2>Agreement</h2><button class="button" data-action="edit-loan" type="button">Edit</button></div><div class="detail-grid"><div><small>Principal financed</small><strong>${rm(calc.principal)}</strong></div><div><small>Flat interest</small><strong>${rm(calc.interest)}</strong></div><div><small>Total repayment</small><strong>${rm(calc.total)}</strong></div><div><small>Estimated monthly</small><strong>${rm(calc.monthly)}</strong></div><div><small>Bank monthly</small><strong>${loan.contractedMonthlyInstalment == null ? 'Not set' : rm(number(loan.contractedMonthlyInstalment))}</strong></div><div><small>Estimated final</small><strong>${rm(calc.finalInstallment)}</strong></div></div><p class="subtle">Expected finish: ${e(expectedFinish(loan))}</p></article><article class="card"><span class="metric-label">ESTIMATED SCHEDULED PAID</span><div class="metric">${rm(calc.scheduledPaid)}</div><p class="subtle">Calculated from the instalment count. This is separate from actual payment records.</p></article><article class="card"><span class="metric-label">ACTUAL RECORDED PAYMENTS</span><div class="metric">${rm(actualPaid)}</div><p class="subtle">${payments.length} payments loaded. Recording cash here does not advance the instalment count; update that count in the agreement.</p><button class="button" data-action="add-payment" type="button">Add payment</button></article><article class="card span-two"><div class="section-head"><h2>Payment log</h2></div>${payments.length ? `<div class="list">${payments.map((row) => `<div class="list-item"><div><strong>${dateOf(row.paymentDate)}</strong><p>${e(row.notes || 'Payment recorded')}</p><div class="list-actions"><button class="delete" type="button" data-action="delete-payment" data-id="${e(row.id)}">Delete</button></div></div><span class="amount">${rm(number(row.amount))}</span></div>`).join('')}</div>` : empty('No individual payments', 'The instalment count alone is enough for the estimate.')}</article></div>`);
}
function paymentForm() { content(formShell('Record actual payment', `${field('paymentDate', 'Payment date', '', { type: 'date', required: true })}${field('amount', 'Amount paid (RM)', '', { type: 'number', min: '0.01', step: '0.01', required: true })}${field('notes', 'Notes (optional)', '', { full: true })}`, 'Save payment')); }
function expenseForm() {
  const row = expenses.find((item) => item.id === editingId);
  content(formShell(row ? 'Edit expense' : 'Add expense', `${selectField('category', 'Category', [['fuel', 'Fuel'], ['insurance', 'Insurance'], ['road_tax', 'Road tax'], ['toll', 'Toll'], ['parking', 'Parking'], ['other', 'Other']], row?.category || 'fuel')}${field('expenseDate', 'Date', formDate(row?.expenseDate), { type: 'date', required: true })}${field('amount', 'Amount (RM)', row?.amount ?? '', { type: 'number', min: '0', step: '0.01', required: true })}${field('description', 'Description', row?.description || '', { required: true, full: true })}${field('notes', 'Notes (optional)', row?.notes || '', { full: true })}`, 'Save expense'));
  editor = 'expense';
}
function renderExpenses() {
  if (editor === 'expense') return expenseForm();
  const total = expenses.reduce((sum, row) => sum + number(row.amount), 0);
  content(`<div class="grid two"><article class="card"><span class="metric-label">STANDALONE EXPENSES</span><div class="metric">${rm(total)}</div><p class="subtle">Across the most recent ${expenses.length} records loaded. Maintenance is tracked separately and never counted twice here.</p></article><article class="card"><h2>Record everyday costs</h2><p class="subtle">Fuel, insurance, road tax, toll, parking and other costs.</p><button class="button primary" type="button" data-action="add-expense">Add expense</button></article><article class="card span-two"><div class="section-head"><h2>Expense log</h2></div>${expenses.length ? `<div class="list">${expenses.map((row) => `<div class="list-item"><div><strong>${e(row.description)}</strong><p>${dateOf(row.expenseDate)} · ${e(row.category?.replaceAll('_', ' '))}</p><div class="list-actions"><button type="button" data-action="edit-expense" data-id="${e(row.id)}">Edit</button><button class="delete" type="button" data-action="delete-expense" data-id="${e(row.id)}">Delete</button></div></div><span class="amount">${rm(number(row.amount))}</span></div>`).join('')}</div>` : empty('No expenses recorded', 'Your fuel and other everyday costs will appear here.')}</article></div>`);
}

function render() {
  if (!vehicle) return vehicleForm(true);
  if (editor === 'mileage') return mileageForm();
  if (editor === 'maintenance') return maintenanceForm();
  if (editor === 'vehicle') return vehicleForm();
  if (editor === 'loan') return loanForm();
  if (editor === 'payment') return paymentForm();
  if (editor === 'expense') return expenseForm();
  if (page === 'home') renderHome();
  if (page === 'vehicle') renderVehicle();
  if (page === 'maintenance') renderMaintenance();
  if (page === 'history') renderHistory();
  if (page === 'loan') renderLoan();
  if (page === 'expenses') renderExpenses();
}

async function reload() {
  vehicles = await loadVehicles(cloud.db, uid);
  const saved = sessionStorage.getItem('car-vehicle-id');
  vehicle = vehicles.find((item) => item.id === saved) || vehicles[0] || null;
  const switcher = $<HTMLSelectElement>('car-switch');
  switcher.hidden = vehicles.length < 2;
  switcher.innerHTML = vehicles.map((row) => `<option value="${e(row.id)}" ${vehicle?.id === row.id ? 'selected' : ''}>${e(row.registrationNo || row.model)}</option>`).join('');
  if (!vehicle) { maintenance = []; odometer = []; expenses = []; loan = null; payments = []; completedIds = []; render(); return; }
  sessionStorage.setItem('car-vehicle-id', vehicle.id);
  const [m, o, ex, l, p, t, c] = await Promise.all([
    loadRecords(cloud.db, 'maintenance', uid, vehicle.id, 'serviceDate', 100),
    loadRecords(cloud.db, 'odometer', uid, vehicle.id, 'recordedAt', 30),
    loadRecords(cloud.db, 'expenses', uid, vehicle.id, 'expenseDate', 100),
    loadLoan(cloud.db, uid, vehicle.id),
    loadRecords(cloud.db, 'loanPayments', uid, vehicle.id, 'paymentDate', 100),
    maintenanceTotals(cloud.db, uid, vehicle.id),
    completedScheduleIds(cloud.db, uid, vehicle.id, SERVICE_SCHEDULE.map((row) => row.id)),
  ]);
  maintenance = m; odometer = o; expenses = ex; loan = l; payments = p; totals = t; completedIds = c; historyHasMore = m.length === 100;
  render();
}

function errorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as any).code) : '';
  if (code === 'permission-denied') return 'Firestore denied access. The My Car security rules may not be deployed yet.';
  if (code === 'failed-precondition') return 'A Firestore index is building or missing. In Firebase Console, open Firestore Database → Indexes and wait until the new indexes are Enabled.';
  if (!navigator.onLine) return 'You appear to be offline. Your change was not saved.';
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
function numberFrom(form: FormData, key: string, optional = false): number | null {
  const raw = input(form, key);
  if (optional && !raw) return null;
  const value = Number(raw);
  if (!finiteNonnegative(value)) throw new Error(`${key} must be a nonnegative number.`);
  return value;
}
async function submitForm(form: HTMLFormElement) {
  if (busy || !vehicle && editor !== 'setup') return;
  busy = true;
  const button = form.querySelector<HTMLButtonElement>('button[type=submit]');
  if (button) { button.disabled = true; button.textContent = 'Saving…'; }
  $('form-error').hidden = true;
  try {
    const values = new FormData(form);
    if (editor === 'setup') {
      const mileage = numberFrom(values, 'currentMileage')!;
      if (!validMileage(mileage)) throw new Error('Mileage must be a whole number.');
      const year = numberFrom(values, 'year', true);
      if (year !== null && (!Number.isInteger(year) || year < 1980 || year > new Date().getFullYear() + 1)) throw new Error('Enter a valid model year.');
      await createVehicle(cloud.db, uid, { registrationNo: input(values, 'registrationNo'), variant: input(values, 'variant'), year, currentMileage: mileage, purchaseDate: input(values, 'purchaseDate'), purchasePrice: numberFrom(values, 'purchasePrice', true), serviceRegion: input(values, 'serviceRegion') });
    } else if (editor === 'vehicle') {
      const year = numberFrom(values, 'year', true);
      if (year !== null && (!Number.isInteger(year) || year < 1980 || year > new Date().getFullYear() + 1)) throw new Error('Enter a valid model year.');
      if (!input(values, 'registrationNo')) throw new Error('Registration is required.');
      await updateVehicle(cloud.db, vehicle!.id, { registrationNo: input(values, 'registrationNo'), variant: input(values, 'variant'), year, purchaseDate: input(values, 'purchaseDate') ? Timestamp.fromDate(localDate(input(values, 'purchaseDate'))) : null, purchasePrice: numberFrom(values, 'purchasePrice', true), serviceRegion: input(values, 'serviceRegion') });
    } else if (editor === 'mileage') {
      const mileage = numberFrom(values, 'mileage')!;
      const correction = input(values, 'correction') === 'yes';
      if (mileage < number(vehicle!.currentMileage) && !correction) throw new Error('Tick the correction box to save a lower reading.');
      await updateMileage(cloud.db, uid, vehicle!.id, mileage, input(values, 'note'), correction);
    } else if (editor === 'maintenance') {
      const mileage = numberFrom(values, 'mileage')!;
      if (!validMileage(mileage)) throw new Error('Mileage must be a whole number.');
      const totalCost = numberFrom(values, 'totalCost')!;
      const count = number(values.get('itemCount'));
      const items: any[] = [];
      for (let index = 0; index < count; index++) {
        const name = input(values, `item-name-${index}`);
        if (!name) continue;
        const quantity = numberFrom(values, `qty-${index}`)!;
        const actualCost = numberFrom(values, `cost-${index}`)!;
        items.push({ name, category: input(values, `item-category-${index}`) || 'other', quantity, actualCost, scheduled: input(values, `item-scheduled-${index}`) === 'yes', completed: input(values, `done-${index}`) === 'on' });
      }
      const partsCost = numberFrom(values, 'partsCost')!, labourCost = numberFrom(values, 'labourCost')!, tax = numberFrom(values, 'tax')!, discount = numberFrom(values, 'discount')!;
      const itemTotal = items.filter((item) => item.completed).reduce((sum, item) => sum + item.actualCost, 0);
      if (items.length && Math.abs(itemTotal - totalCost) > 0.01 && !window.confirm(`The checked item costs total ${rm(itemTotal)}, while the invoice total is ${rm(totalCost)}. Save the invoice total as entered?`)) throw new Error('Review the item costs or invoice total, then save.');
      const recordType = input(values, 'recordType');
      await saveMaintenance(cloud.db, uid, vehicle!.id, { recordType, scheduleId: recordType === 'scheduled' ? input(values, 'scheduleId') : null, serviceDate: input(values, 'serviceDate'), mileage, category: recordType === 'scheduled' ? 'scheduled_service' : input(values, 'category'), workshop: { name: input(values, 'workshop') }, items, partsCost, labourCost, tax, discount, totalCost, notes: input(values, 'notes') }, maintenance.some((row) => row.id === editingId) ? editingId : undefined);
    } else if (editor === 'loan') {
      const vehiclePrice = numberFrom(values, 'vehiclePrice', true), downPayment = numberFrom(values, 'downPayment', true);
      const principalFinanced = numberFrom(values, 'principalFinanced')!, annualFlatRatePercent = numberFrom(values, 'annualFlatRatePercent')!, tenureMonths = numberFrom(values, 'tenureMonths')!, installmentsPaid = numberFrom(values, 'installmentsPaid')!;
      if (vehiclePrice !== null && downPayment !== null && downPayment > vehiclePrice) throw new Error('Down payment cannot exceed vehicle price.');
      if (vehiclePrice !== null && downPayment !== null && Math.abs(vehiclePrice - downPayment - principalFinanced) > 0.01) throw new Error('Principal must equal vehicle price minus down payment, or leave those optional fields empty.');
      calculateLoan({ principalFinanced, annualFlatRatePercent, tenureMonths, installmentsPaid });
      await saveLoan(cloud.db, uid, vehicle!.id, { vehiclePrice, downPayment, principalFinanced, annualFlatRatePercent, tenureMonths, installmentsPaid, loanStartDate: Timestamp.fromDate(localDate(input(values, 'loanStartDate'))), firstDueDate: input(values, 'firstDueDate') ? Timestamp.fromDate(localDate(input(values, 'firstDueDate'))) : null, contractedMonthlyInstalment: numberFrom(values, 'contractedMonthlyInstalment', true), lender: input(values, 'lender'), notes: input(values, 'notes') }, loan?.id);
    } else if (editor === 'payment') {
      const amount = numberFrom(values, 'amount')!;
      if (amount <= 0) throw new Error('Payment amount must be greater than zero.');
      await savePayment(cloud.db, uid, vehicle!.id, loan!.id, { paymentDate: input(values, 'paymentDate'), amount, notes: input(values, 'notes') });
    } else if (editor === 'expense') {
      const amount = numberFrom(values, 'amount')!;
      if (!input(values, 'description')) throw new Error('Description is required.');
      await saveExpense(cloud.db, uid, vehicle!.id, { category: input(values, 'category'), expenseDate: input(values, 'expenseDate'), amount, description: input(values, 'description'), notes: input(values, 'notes') }, editingId || undefined);
    }
    editor = ''; editingId = '';
    try {
      await reload();
      status('Saved successfully.', 'success');
    } catch (error) {
      status(`Saved, but the page could not refresh: ${errorMessage(error)}`, 'error');
      content(empty('Your change was saved', 'Please wait for the Firestore index to become active, then retry loading your car. Do not submit the form again.', '<br><button class="button" type="button" data-action="retry">Retry loading</button>'));
    }
  } catch (error) {
    const message = errorMessage(error);
    $('form-error').textContent = message; $('form-error').hidden = false;
    status('Your change was not saved.', 'error');
  } finally { busy = false; if (button) { button.disabled = false; button.textContent = 'Save'; } }
}

async function action(name: string, id: string) {
  if (busy) return;
  if (name === 'cancel') { editor = ''; editingId = ''; render(); return; }
  if (name === 'mileage') { editor = 'mileage'; render(); return; }
  if (name === 'edit-vehicle') { editor = 'vehicle'; render(); return; }
  if (name === 'tab-schedule' || name === 'tab-history') { tab = name.replace('tab-', ''); render(); return; }
  if (name === 'new-maintenance' || name === 'record-scheduled' || name === 'edit-maintenance') { editor = 'maintenance'; editingId = name === 'new-maintenance' ? '' : id; render(); return; }
  if (name === 'edit-loan') { editor = 'loan'; render(); return; }
  if (name === 'add-payment') { editor = 'payment'; render(); return; }
  if (name === 'add-expense' || name === 'edit-expense') { editor = 'expense'; editingId = name === 'add-expense' ? '' : id; render(); return; }
  if (name === 'add-item') {
    const countInput = document.querySelector<HTMLInputElement>('input[name=itemCount]')!;
    const index = number(countInput.value); countInput.value = String(index + 1);
    $('extra-items').insertAdjacentHTML('beforeend', `<div class="item-editor"><input aria-label="Item done" type="checkbox" name="done-${index}" checked><input aria-label="Item name" name="item-name-${index}" placeholder="Invoice item name" required><input aria-label="Quantity" name="qty-${index}" type="number" min="0" step="0.01" value="1"><input aria-label="Actual cost" name="cost-${index}" type="number" min="0" step="0.01" value="0"><input type="hidden" name="item-category-${index}" value="other"><input type="hidden" name="item-scheduled-${index}" value="no"><button class="item-remove" type="button" data-action="remove-item" aria-label="Remove invoice item">×</button></div>`); return;
  }
  if (name === 'remove-item') { (document.activeElement as HTMLElement)?.closest('.item-editor')?.remove(); return; }
  if (name === 'more-history' && vehicle && maintenance.length) {
    busy = true;
    try { const next = await loadMoreRecords(cloud.db, 'maintenance', uid, vehicle.id, 'serviceDate', maintenance[maintenance.length - 1].id); maintenance.push(...next); historyHasMore = next.length === 100; render(); }
    catch (error) { status(errorMessage(error), 'error'); }
    finally { busy = false; }
    return;
  }
  if (name === 'retry') { status('Reloading…'); try { await reload(); status(''); } catch (error) { status(errorMessage(error), 'error'); } return; }
  if (name.startsWith('delete-')) {
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    busy = true;
    try {
      if (name === 'delete-maintenance') await deleteMaintenance(cloud.db, uid, vehicle!.id, id);
      if (name === 'delete-expense') await deleteExpense(cloud.db, id);
      if (name === 'delete-payment') await deletePayment(cloud.db, id);
      status('Record deleted.', 'success'); await reload();
    } catch (error) { status(errorMessage(error), 'error'); } finally { busy = false; }
  }
}

export async function initializeCar() {
  const authPanel = $('car-auth'), app = $('car-app'), message = $('car-auth-message');
  if (page === 'home') {
    const main = document.querySelector<HTMLElement>('.car-main');
    if (main) new ResizeObserver(queueHomeViewport).observe(main);
    window.addEventListener('resize', queueHomeViewport);
    void document.fonts.ready.then(queueHomeViewport);
  }
  $('car-page-content').addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (target) void action(target.dataset.action || '', target.dataset.id || '');
  });
  $('car-page-content').addEventListener('submit', (event) => { event.preventDefault(); void submitForm(event.target as HTMLFormElement); });
  $('car-page-content').addEventListener('change', (event) => { const target = event.target as HTMLSelectElement; if (target.dataset.filter === 'year') { historyYear = target.value; render(); } if (target.dataset.filter === 'category') { historyCategory = target.value; render(); } });
  $<HTMLSelectElement>('car-switch').addEventListener('change', (event) => { sessionStorage.setItem('car-vehicle-id', (event.target as HTMLSelectElement).value); editor = ''; void reload(); });
  window.addEventListener('offline', () => status('You are offline. Existing information may be stale; new changes will not save until the connection returns.', 'error'));
  window.addEventListener('online', () => { if (uid) status('Connection restored. Refresh to check for the latest records.'); });
  try {
    const services = await getFirebaseServices();
    if (!services) throw new Error('Firebase configuration is unavailable.');
    cloud = services;
    void getRedirectResult(cloud.auth).catch((error) => { message.textContent = errorMessage(error); });
    $<HTMLButtonElement>('car-sign-in').addEventListener('click', async () => {
      const provider = new GoogleAuthProvider();
      try { await signInWithPopup(cloud.auth, provider); }
      catch (error: any) {
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(error?.code)) await signInWithRedirect(cloud.auth, provider);
        else message.textContent = errorMessage(error);
      }
    });
    $<HTMLButtonElement>('car-sign-out').addEventListener('click', () => void signOut(cloud.auth));
    onAuthStateChanged(cloud.auth, async (user) => {
      if (!user || user.uid !== OWNER_UID || !user.emailVerified) {
        uid = ''; vehicle = null; maintenance = []; odometer = []; expenses = []; loan = null; payments = [];
        app.hidden = true; authPanel.hidden = false; $<HTMLButtonElement>('car-sign-out').hidden = true;
        $<HTMLButtonElement>('car-sign-in').hidden = false;
        message.textContent = user ? 'This Google account is not authorized for My Car.' : 'Sign in with your authorized Google account to continue.';
        if (user) await signOut(cloud.auth);
        return;
      }
      uid = user.uid; authPanel.hidden = true; app.hidden = false; $<HTMLButtonElement>('car-sign-out').hidden = false;
      status('Loading your car…');
      try { await reload(); status(''); }
      catch (error) { status(`Could not load your data: ${errorMessage(error)}`, 'error'); content(empty('Could not load your car', 'Check the message above, then retry once access is available.', '<br><button class="button" type="button" data-action="retry">Retry</button>')); }
    });
  } catch (error) { message.textContent = errorMessage(error); }
}
