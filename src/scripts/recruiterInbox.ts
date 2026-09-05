import { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, type QueryDocumentSnapshot } from 'firebase/firestore';
import type { FirebaseServices } from '../lib/firebase';
import { emptyLead, followUpDue, LEAD_STAGES, validateLead, type LeadFields } from '../data/recruiterInbox';
import { auditPayload } from './adminOperations';

type Entry = LeadFields & { id: string; email: string; requestedAt: unknown; version: number; access?: Record<string, unknown> };
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '') => { const node = document.createElement(tag); node.textContent = text; return node; };
const date = (value: unknown) => {
  const time = (value as { toDate?: () => Date })?.toDate?.();
  return time ? new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeZone: 'Asia/Kuala_Lumpur' }).format(time) : 'Not recorded';
};

export function initializeRecruiterInbox(services: FirebaseServices) {
  const list = document.querySelector<HTMLElement>('#recruiter-list')!;
  const summary = document.querySelector<HTMLElement>('#recruiter-summary')!;
  const search = document.querySelector<HTMLInputElement>('#recruiter-search')!;
  const stage = document.querySelector<HTMLSelectElement>('#recruiter-stage')!;
  const due = document.querySelector<HTMLInputElement>('#recruiter-due')!;
  const refresh = document.querySelector<HTMLButtonElement>('#recruiter-refresh')!;
  const moreRequests = document.querySelector<HTMLButtonElement>('#recruiter-more-requests')!;
  const moreLeads = document.querySelector<HTMLButtonElement>('#recruiter-more-leads')!;
  const requests = new Map<string, Record<string, unknown>>();
  const leads = new Map<string, Record<string, unknown>>();
  const dirty = new Set<string>();
  const cards = new Map<string, { card: HTMLDetailsElement; entry: Entry }>();
  const cursors: Partial<Record<'cvRequests' | 'recruiterLeads', QueryDocumentSnapshot>> = {};
  let busy = false;
  let saving = 0;
  let disposed = false;
  const notice = (text: string, error = false) => { summary.textContent = text; summary.dataset.error = String(error); };
  const updateLocks = () => { if (!disposed) [refresh, moreRequests, moreLeads].forEach((button) => { button.disabled = busy || saving > 0 || dirty.size > 0; }); };
  const filter = () => {
    const term = search.value.trim().toLowerCase();
    let count = 0;
    for (const { card, entry } of cards.values()) {
      const matches = `${entry.email} ${entry.company} ${entry.notes}`.toLowerCase().includes(term) && (stage.value === 'all' || entry.stage === stage.value) && (!due.checked || followUpDue(entry));
      // Keep unsaved edits visible when filters change.
      card.hidden = !matches && !dirty.has(entry.id);
      if (!card.hidden) count++;
    }
    notice(`${count} shown / ${cards.size} loaded leads · ${requests.size} CV records and ${leads.size} saved records loaded. Search and due-date filters cover loaded records only.${dirty.size ? ' Save or discard changes before refreshing.' : ''}`);
  };
  const makeCard = (entry: Entry) => {
    const card = el('details'); card.className = 'recruiter-card';
    const heading = el('summary');
    const title = el('strong', entry.email); const status = el('span');
    const updateHeading = () => { status.textContent = `${entry.company || 'Company not set'} · ${entry.stage.charAt(0).toUpperCase() + entry.stage.slice(1)}${followUpDue(entry) ? ' · Follow-up due' : entry.followUp ? ` · ${entry.followUp}` : ''}`; };
    updateHeading(); heading.append(title, status); card.append(heading);
    const form = el('form');
    const context = el('p'); context.className = 'ops-note';
    context.textContent = `Requested ${date(entry.requestedAt)} · ${entry.access ? `Access: ${String(entry.access.status ?? 'pending')} · Verified: ${date(entry.access.verifiedAt)} · Downloaded: ${date(entry.access.downloadedAt)} · ${Number(entry.access.downloadCount ?? 0)} downloads` : 'Original access record is not available.'}`;
    const fields = el('div'); fields.className = 'recruiter-fields';
    const company = el('input'); company.name = 'company'; company.maxLength = 160; company.value = entry.company;
    const select = el('select'); select.name = 'stage'; LEAD_STAGES.forEach((value) => select.add(new Option(value.charAt(0).toUpperCase() + value.slice(1), value))); select.value = entry.stage;
    const followUp = el('input'); followUp.name = 'followUp'; followUp.type = 'date'; followUp.value = entry.followUp;
    const notes = el('textarea'); notes.name = 'notes'; notes.maxLength = 5000; notes.value = entry.notes; notes.rows = 4;
    for (const [name, input] of [['Company', company], ['Status', select], ['Follow up (MYT)', followUp], ['Private notes', notes]] as const) {
      const label = el('label', name); if (input === notes) label.className = 'ops-wide'; label.append(input); fields.append(label);
    }
    const actions = el('div'); actions.className = 'ops-actions';
    const save = el('button', 'Save lead'); save.type = 'submit'; save.className = 'phase-d-button is-primary';
    const discard = el('button', 'Discard changes'); discard.type = 'button'; discard.className = 'phase-d-button';
    const message = el('span'); message.setAttribute('role', 'status');
    actions.append(save, discard, message); form.append(context, fields, actions); card.append(form);
    form.addEventListener('input', () => { dirty.add(entry.id); message.textContent = 'Unsaved changes'; updateLocks(); });
    discard.addEventListener('click', () => {
      company.value = entry.company; select.value = entry.stage; followUp.value = entry.followUp; notes.value = entry.notes;
      dirty.delete(entry.id); message.textContent = 'Changes discarded.'; updateLocks(); filter();
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (!services.auth.currentUser || disposed) return;
      saving++; updateLocks(); save.disabled = true; discard.disabled = true;
      const inputs = [company, select, followUp, notes]; inputs.forEach((input) => { input.disabled = true; });
      message.textContent = 'Saving…';
      try {
        const edited = validateLead({ company: company.value.trim(), stage: select.value as LeadFields['stage'], notes: notes.value, followUp: followUp.value });
        const ref = doc(services.db, 'recruiterLeads', entry.id);
        await runTransaction(services.db, async (transaction) => {
          const remote = await transaction.get(ref);
          if (Number(remote.data()?.version ?? 0) !== entry.version) throw new Error('This lead changed in another tab. Copy your edits, discard changes, then refresh before saving.');
          const audit = auditPayload(services, 'recruiter.update', 'recruiter', entry.id, `Updated recruiter lead to ${edited.stage}`);
          transaction.set(ref, { requestId: entry.id, email: entry.email, requestedAt: entry.requestedAt, ...edited, version: entry.version + 1, updatedAt: serverTimestamp(), updatedBy: services.auth.currentUser!.uid });
          transaction.set(doc(services.db, 'cmsAudit', audit.id), audit);
        });
        if (disposed) return;
        Object.assign(entry, edited, { version: entry.version + 1 }); leads.set(entry.id, { ...entry });
        dirty.delete(entry.id); updateHeading(); message.textContent = 'Saved.'; filter();
      } catch (error) {
        message.textContent = error instanceof Error && !('code' in error) ? error.message : 'Save failed. Check your connection and deployed inbox rules. Your edits are still here.';
      } finally {
        saving--; updateLocks(); save.disabled = false; discard.disabled = false; inputs.forEach((input) => { input.disabled = false; });
      }
    });
    return card;
  };
  const render = () => {
    const ids = new Set([...requests.keys(), ...leads.keys()]);
    for (const id of ids) {
      if (cards.has(id)) continue;
      const source = requests.get(id); const saved = leads.get(id);
      const entry = { ...emptyLead, ...source, ...saved, id, access: source, version: Number(saved?.version ?? 0) } as Entry;
      const card = makeCard(entry); cards.set(id, { card, entry });
    }
    const sorted = [...cards.values()].sort((a, b) => Number((b.entry.requestedAt as { seconds?: number })?.seconds ?? 0) - Number((a.entry.requestedAt as { seconds?: number })?.seconds ?? 0));
    list.replaceChildren(...sorted.map(({ card }) => card));
    filter();
    if (!cards.size) list.append(el('p', 'No CV requests or saved leads yet.'));
  };
  const page = async (name: 'cvRequests' | 'recruiterLeads') => {
    const cursor = cursors[name];
    const result = await getDocs(query(collection(services.db, name), orderBy('requestedAt', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(25)));
    if (disposed) return;
    const target = name === 'cvRequests' ? requests : leads;
    for (const snapshot of result.docs) target.set(snapshot.id, snapshot.data());
    // Resolve matching saved notes even when their request is outside the saved-lead page.
    if (name === 'cvRequests') await Promise.all(result.docs.map(async (snapshot) => {
      if (!leads.has(snapshot.id)) { const saved = await getDoc(doc(services.db, 'recruiterLeads', snapshot.id)); if (!disposed && saved.exists()) leads.set(snapshot.id, saved.data()); }
    }));
    else await Promise.all(result.docs.map(async (snapshot) => {
      if (!requests.has(snapshot.id)) { const original = await getDoc(doc(services.db, 'cvRequests', snapshot.id)); if (!disposed && original.exists()) requests.set(snapshot.id, original.data()); }
    }));
    if (disposed) return;
    cursors[name] = result.docs.at(-1) ?? cursor;
    (name === 'cvRequests' ? moreRequests : moreLeads).hidden = result.size < 25;
  };
  const load = async (name?: 'cvRequests' | 'recruiterLeads') => {
    if (busy || saving || dirty.size || disposed) return;
    busy = true; updateLocks(); notice('Loading inbox…');
    try {
      if (name) await page(name);
      else {
        requests.clear(); leads.clear(); cards.clear(); list.replaceChildren(); delete cursors.cvRequests; delete cursors.recruiterLeads;
        moreRequests.hidden = true; moreLeads.hidden = true;
        // Wait for both sources even if one fails, so a retry cannot race an old load.
        const outcomes = await Promise.allSettled([page('cvRequests'), page('recruiterLeads')]);
        if (outcomes.some((result) => result.status === 'rejected')) throw new Error('Inbox source unavailable.');
      }
      if (!disposed) render();
    } catch { if (!disposed) notice('Inbox could not load. Check your connection and deploy the recruiter inbox Firestore rules, then refresh.', true); }
    finally { busy = false; updateLocks(); }
  };
  search.addEventListener('input', filter); stage.addEventListener('change', filter); due.addEventListener('change', filter);
  const reload = () => void load(); const nextRequests = () => void load('cvRequests'); const nextLeads = () => void load('recruiterLeads');
  refresh.addEventListener('click', reload); moreRequests.addEventListener('click', nextRequests); moreLeads.addEventListener('click', nextLeads);
  const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.size || saving) { event.preventDefault(); event.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  void load();
  return () => {
    disposed = true; requests.clear(); leads.clear(); cards.clear(); dirty.clear(); list.replaceChildren(); notice('Sign in to load your inbox.');
    [refresh, moreRequests, moreLeads].forEach((button) => { button.disabled = false; }); moreRequests.hidden = true; moreLeads.hidden = true;
    search.removeEventListener('input', filter); stage.removeEventListener('change', filter); due.removeEventListener('change', filter);
    refresh.removeEventListener('click', reload); moreRequests.removeEventListener('click', nextRequests); moreLeads.removeEventListener('click', nextLeads);
    window.removeEventListener('beforeunload', beforeUnload);
  };
}
