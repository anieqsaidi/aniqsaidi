export const LEAD_STAGES = ['new', 'contacted', 'interviewing', 'offer', 'closed'] as const;
export type LeadStage = typeof LEAD_STAGES[number];
export interface LeadFields { company: string; notes: string; stage: LeadStage; followUp: string }
export const emptyLead: LeadFields = { company: '', notes: '', stage: 'new', followUp: '' };

export function validFollowUp(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export function validateLead(value: LeadFields) {
  if (!LEAD_STAGES.includes(value.stage)) throw new Error('Choose a valid status.');
  if (value.company.length > 160 || value.notes.length > 5000) throw new Error('Company or notes exceed the character limit.');
  if (!validFollowUp(value.followUp)) throw new Error('Choose a valid follow-up date.');
  return value;
}
export function malaysiaToday(now = new Date()) {
  return new Date(now.valueOf() + 8 * 3600000).toISOString().slice(0, 10);
}
export function followUpDue(lead: LeadFields, today = malaysiaToday()) {
  return lead.stage !== 'closed' && Boolean(lead.followUp) && lead.followUp <= today;
}
