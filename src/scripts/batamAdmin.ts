import type { User } from 'firebase/auth';
import { initializeAdminGate } from './adminAuth';

type Traveller = Record<string, string> & { id: string; name: string; displayName: string };
type Account = { username: string; role: string; greeting: string; memberIds: string[]; pinConfigured: boolean };
type TripDocument = { id: string; kind: string; title: string; members: string[]; shared: boolean };
type Session = { id: string; username: string; role: string; revoked: boolean; createdAt: string | null; lastSeenAt: string | null; expiresAt: string | null };
type AdminData = { trip: { title: string; dates: string; travellers: number; accounts: number }; travellers: Traveller[]; accounts: Account[]; documents: TripDocument[]; sessions: Session[] };

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
  const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node;
};
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not recorded';

export async function initializeBatamAdmin() {
  const root = el<HTMLElement>('batam-admin'); const authPanel = el<HTMLElement>('batam-admin-auth'); const app = el<HTMLElement>('batam-admin-app');
  const signIn = el<HTMLButtonElement>('batam-admin-sign-in'); const signOut = el<HTMLButtonElement>('batam-admin-sign-out'); const authMessage = el<HTMLElement>('batam-admin-auth-message');
  if (!root || !authPanel || !app || !signIn || !signOut || !authMessage) return;
  let currentUser: User | null = null; let currentData: AdminData | null = null;
  const status = (text: string) => { const node = el<HTMLElement>('batam-admin-message'); if (node) node.textContent = text; };
  const token = async () => currentUser ? currentUser.getIdToken() : '';
  const request = async (method = 'GET', body?: object) => {
    const idToken = await token();
    const response = await fetch('/api/batam/admin', { method, headers: { ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Admin request failed.'); return data;
  };
  const memberNames = (ids: string[]) => ids.map((id) => currentData?.travellers.find((traveller) => traveller.id === id)?.displayName || id).join(' · ');
  const metric = (label: string, value: string, note: string) => { const card = make('article', 'admin-card admin-metric'); card.append(make('span', '', label), make('strong', '', value), make('small', '', note)); return card; };
  const render = (data: AdminData) => {
    currentData = data;
    const subtitle = el<HTMLElement>('batam-admin-subtitle'); if (subtitle) subtitle.textContent = `${data.trip.dates} · deployment-backed configuration`;
    const activeSessions = data.sessions.filter((session) => !session.revoked && (!session.expiresAt || new Date(session.expiresAt) > new Date())).length;
    el<HTMLElement>('batam-admin-metrics')?.replaceChildren(metric('Travellers', String(data.trip.travellers), '9 people in the master list'), metric('Login accounts', String(data.trip.accounts), 'Individual and shared-family access'), metric('Documents', String(data.documents.length), `${data.documents.filter((document) => document.shared).length} shared files`), metric('Active sessions', String(activeSessions), 'Participant devices currently authorized'));

    const travellers = data.travellers.map((traveller) => {
      const card = make('details', 'admin-card admin-details'); const summary = make('summary');
      const identity = make('div'); identity.append(make('strong', '', traveller.name), make('span', '', `${traveller.room} · ${traveller.insurance}`)); summary.append(identity, make('b', '', '+'));
      const grid = make('dl', 'admin-facts'); [['Phone', traveller.phone], ['Passport', traveller.passport], ['Passport expires', traveller.passportExpiry], ['Arrival Card No.', traveller.arrivalCard], ['Visa Exemption No.', traveller.evisa], ['Outbound ticket', traveller.ferryOutbound], ['Return ticket', traveller.ferryReturn], ['eSIM', traveller.esim]].forEach(([label, value]) => { const item = make('div'); item.append(make('dt', '', label), make('dd', '', value)); grid.append(item); });
      card.append(summary, grid); return card;
    });
    el<HTMLElement>('batam-admin-travellers')?.replaceChildren(...travellers);

    const accounts = data.accounts.map((account) => { const card = make('article', 'admin-card admin-account'); const top = make('div', 'admin-card-top'); top.append(make('div', '', `@${account.username}`), make('span', account.role === 'admin' ? 'admin-chip admin-chip--admin' : 'admin-chip', account.role)); card.append(top, make('h3', '', memberNames(account.memberIds)), make('p', '', account.greeting), make('small', '', account.pinConfigured ? '4-digit PIN configured' : 'PIN needs attention')); return card; });
    el<HTMLElement>('batam-admin-accounts')?.replaceChildren(...accounts);

    const documents = data.documents.map((document) => { const card = make('article', 'admin-card admin-document'); const top = make('div', 'admin-card-top'); top.append(make('span', 'admin-chip', document.kind), make('span', '', document.shared ? 'Group file' : 'Individual')); card.append(top, make('h3', '', document.title), make('p', '', `Available to: ${memberNames(document.members)}`), make('code', '', document.id)); return card; });
    el<HTMLElement>('batam-admin-documents')?.replaceChildren(...documents);

    const sessions = data.sessions.length ? data.sessions.map((session) => { const card = make('article', `admin-card admin-session${session.revoked ? ' is-revoked' : ''}`); const top = make('div', 'admin-card-top'); top.append(make('strong', '', `@${session.username}`), make('span', 'admin-chip', session.revoked ? 'Revoked' : 'Active')); card.append(top, make('p', '', `Last seen: ${formatDate(session.lastSeenAt)}`), make('small', '', `Created ${formatDate(session.createdAt)} · expires ${formatDate(session.expiresAt)}`)); if (!session.revoked) { const button = make('button', 'admin-danger', 'Revoke user sessions'); button.addEventListener('click', () => revoke(session.username)); card.append(button); } return card; }) : [make('article', 'admin-card admin-empty', 'No production sessions are available in this environment.')];
    el<HTMLElement>('batam-admin-sessions')?.replaceChildren(...sessions);
  };
  const load = async () => { status('Refreshing admin data…'); const result = await request(); render(result.data); status('Admin data is up to date.'); };
  const revoke = async (username: string) => { if (!window.confirm(username === 'all' ? 'Revoke every participant session?' : `Revoke all sessions for @${username}?`)) return; status('Revoking sessions…'); const result = await request('POST', { action: 'revokeSessions', username }); status(`${result.revoked} session${result.revoked === 1 ? '' : 's'} revoked.`); await load(); };
  el<HTMLButtonElement>('batam-admin-revoke-all')?.addEventListener('click', () => revoke('all'));
  el<HTMLButtonElement>('batam-admin-refresh')?.addEventListener('click', () => load().catch((error) => status(error.message)));
  document.querySelectorAll<HTMLButtonElement>('[data-admin-view]').forEach((button) => button.addEventListener('click', () => { const view = button.dataset.adminView; document.querySelectorAll<HTMLElement>('[data-admin-panel]').forEach((panel) => { panel.hidden = panel.dataset.adminPanel !== view; }); document.querySelectorAll<HTMLButtonElement>('[data-admin-view]').forEach((item) => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); }); document.querySelector('.batam-admin-content')?.scrollTo({ top: 0 }); }));
  await initializeAdminGate({ root, authPanel, signInButton: signIn, signOutButton: signOut, message: authMessage, onAuthorized: async (user) => { currentUser = user; app.hidden = false; await load(); } });
}
