import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { FirebaseServices } from '../lib/firebase';
import type { AuditAction, AuditEntry, CmsExportBundle } from '../data/cmsOperations';

export function createAuditId(action: AuditAction) {
  return `${action.replaceAll('.', '-')}-${Date.now()}-${crypto.randomUUID()}`;
}

export function auditPayload(
  services: FirebaseServices,
  action: AuditAction,
  entityType: string,
  entityId: string,
  summary: string,
  revisionId = '',
): AuditEntry {
  const user = services.auth.currentUser;
  return {
    id: createAuditId(action), action, entityType, entityId,
    actorUid: user?.uid ?? '', actorEmail: user?.email ?? '',
    summary: summary.slice(0, 500), revisionId, timestamp: serverTimestamp(),
  };
}

export async function recordAudit(
  services: FirebaseServices,
  action: AuditAction,
  entityType: string,
  entityId: string,
  summary: string,
  revisionId = '',
) {
  const payload = auditPayload(services, action, entityType, entityId, summary, revisionId);
  await setDoc(doc(collection(services.db, 'cmsAudit'), payload.id), payload);
  return payload.id;
}

export function downloadJson(bundle: CmsExportBundle, fileName: string) {
  const blob = new Blob([`${JSON.stringify(bundle, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = fileName; document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
