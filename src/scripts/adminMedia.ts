import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { MEDIA_KINDS, type MediaKind, type MediaRecord, sanitizeResumeDocument } from '../data/cmsEditorial';
import { getFirebaseStorage } from '../lib/firebase';
import { initializeAdminGate } from './adminAuth';
import { auditPayload, recordAudit } from './adminOperations';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE = 12 * 1024 * 1024;
const MAX_PDF = 10 * 1024 * 1024;
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);

async function imageDimensions(file: Blob) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { image, width: image.naturalWidth, height: image.naturalHeight };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function resizeImage(file: File, maxDimension: number, quality: number) {
  const { image, width, height } = await imageDimensions(file);
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d', { alpha: true })?.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(image.src);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Image conversion failed.')), 'image/webp', quality));
  return { blob, width, height };
}

async function upload(storage: NonNullable<Awaited<ReturnType<typeof getFirebaseStorage>>>, path: string, blob: Blob, onProgress: (value: number) => void) {
  const task = uploadBytesResumable(ref(storage, path), blob, { contentType: blob.type });
  await new Promise<void>((resolve, reject) => task.on('state_changed', (snapshot) => onProgress(snapshot.bytesTransferred / snapshot.totalBytes), reject, resolve));
  return getDownloadURL(task.snapshot.ref);
}

export async function initializeMediaAdmin() {
  const root = document.querySelector<HTMLElement>('#media-admin');
  const authPanel = document.querySelector<HTMLElement>('#media-auth');
  const signInButton = document.querySelector<HTMLButtonElement>('#media-sign-in');
  const signOutButton = document.querySelector<HTMLButtonElement>('#media-sign-out');
  const message = document.querySelector<HTMLElement>('#media-message');
  const form = document.querySelector<HTMLFormElement>('#media-upload-form');
  const grid = document.querySelector<HTMLElement>('#media-grid');
  const resumeManager = document.querySelector<HTMLElement>('#resume-manager');
  const search = document.querySelector<HTMLInputElement>('#media-search');
  const filter = document.querySelector<HTMLSelectElement>('#media-filter');
  const progress = document.querySelector<HTMLElement>('#media-progress');
  const progressBar = progress?.querySelector<HTMLElement>('span');
  if (!root || !authPanel || !signInButton || !signOutButton || !message || !form || !grid || !resumeManager || !search || !filter) throw new Error('Media admin markup is incomplete.');

  MEDIA_KINDS.forEach((kind) => filter.add(new Option(kind.charAt(0).toUpperCase() + kind.slice(1), kind)));
  let records: MediaRecord[] = [];
  let services: Awaited<ReturnType<typeof import('../lib/firebase').getFirebaseServices>> = null;
  let storage: Awaited<ReturnType<typeof getFirebaseStorage>> = null;
  let resumeDraft = sanitizeResumeDocument(null);
  let resumePublished = sanitizeResumeDocument(null);
  let resumeDraftVersion = 0;
  let resumePublishedVersion = 0;
  const setMessage = (text: string, error = false) => { message.textContent = text; message.classList.toggle('is-error', error); };

  const load = async () => {
    if (!services) return;
    const [mediaSnapshot, draftSnapshot, publishedSnapshot] = await Promise.all([
      getDocs(collection(services.db, 'cmsMedia')),
      getDoc(doc(services.db, 'cmsResume', 'draft')),
      getDoc(doc(services.db, 'cmsResume', 'published')),
    ]);
    records = mediaSnapshot.docs.map((item) => item.data() as MediaRecord).sort((a, b) => a.fileName.localeCompare(b.fileName));
    resumeDraft = sanitizeResumeDocument(draftSnapshot.exists() ? draftSnapshot.data() : null);
    resumePublished = sanitizeResumeDocument(publishedSnapshot.exists() ? publishedSnapshot.data() : null);
    resumeDraftVersion = Number(draftSnapshot.data()?.version ?? 0);
    resumePublishedVersion = Number(publishedSnapshot.data()?.version ?? 0);
    render();
  };

  const renderResume = () => {
    const versions = records.filter((record) => record.kind === 'resume' && record.mimeType === 'application/pdf');
    const current = resumePublished.mediaId ? `<div><strong>${escapeHtml(resumePublished.fileName)}</strong><small>Published · ${escapeHtml(resumePublished.versionLabel || resumePublished.updatedDate)} · ${formatBytes(resumePublished.fileSize)}</small></div>` : '<div><strong>No published résumé</strong><small>Select a version, then publish it.</small></div>';
    resumeManager!.innerHTML = `<div class="resume-current">${current}<span>Résumé request page: /resume/</span></div>${versions.length ? versions.map((record) => `<div class="resume-version"><div><strong>${escapeHtml(record.fileName)}</strong><small>${formatBytes(record.fileSize)}${resumeDraft.mediaId === record.id ? ' · Selected draft' : ''}${resumePublished.mediaId === record.id ? ' · Published' : ''}</small></div><div class="media-actions"><button type="button" class="phase-d-button" data-resume-select="${record.id}">Select</button><button type="button" class="phase-d-button is-primary" data-resume-publish="${record.id}">Publish</button></div></div>`).join('') : '<p>Upload a PDF with the Résumé type to create the first version.</p>'}`;
  };

  const render = () => {
    const term = search!.value.trim().toLowerCase();
    const kind = filter!.value;
    const visible = records.filter((record) => (!kind || record.kind === kind) && (!term || [record.fileName, record.altText, record.caption, record.credit].some((value) => value.toLowerCase().includes(term))));
    grid!.innerHTML = visible.length ? visible.map((record) => `<article class="media-card" data-media-id="${record.id}">
      <div class="media-preview">${record.mimeType.startsWith('image/') ? `<img src="${escapeHtml(record.thumbnailUrl || record.publicUrl)}" alt="" loading="lazy" />` : '<span>PDF document</span>'}</div>
      <div class="media-card-body"><h3>${escapeHtml(record.fileName)}</h3><div class="media-meta"><span>${record.kind.charAt(0).toUpperCase() + record.kind.slice(1)}</span><span>${formatBytes(record.fileSize)}</span>${record.width ? `<span>${record.width}×${record.height}</span>` : ''}</div>
      ${record.mimeType.startsWith('image/') ? `<label>Alt text<textarea rows="2" maxlength="300" data-media-alt>${escapeHtml(record.altText)}</textarea></label>` : ''}
      <label>Caption<input maxlength="1000" value="${escapeHtml(record.caption)}" data-media-caption /></label><label>Credit<input maxlength="500" value="${escapeHtml(record.credit)}" data-media-credit /></label>
      <div class="media-actions"><a class="phase-d-button" href="${escapeHtml(record.publicUrl)}" target="_blank" rel="noopener">Preview ↗</a><button type="button" class="phase-d-button" data-media-copy>Copy reference</button><button type="button" class="phase-d-button" data-media-usage>View usage</button><button type="button" class="phase-d-button" data-media-save>Save details</button><button type="button" class="phase-d-button" data-media-delete>Delete</button></div></div></article>`).join('') : '<p>No assets match your filters.</p>';
    renderResume();
  };

  const saveResumeDraft = async (record: MediaRecord) => {
    if (!services?.auth.currentUser) return false;
    const nextDocument = { schemaVersion: 1 as const, mediaId: record.id, fileName: record.fileName, publicUrl: record.publicUrl, fileSize: record.fileSize, versionLabel: `VERSION ${new Date().toISOString().slice(0, 10)}`, updatedDate: new Date().toISOString().slice(0, 10) };
    const nextVersion = resumeDraftVersion + 1;
    try {
      await runTransaction(services.db, async (transaction) => {
        const resumeRef = doc(services!.db, 'cmsResume', 'draft'); const remote = await transaction.get(resumeRef);
        if (Number(remote.data()?.version ?? 0) !== resumeDraftVersion) throw new Error('CMS_CONFLICT:resume-draft');
        transaction.set(resumeRef, { ...nextDocument, version: nextVersion, updatedAt: serverTimestamp(), updatedBy: services!.auth.currentUser!.uid });
        const audit = auditPayload(services!, 'resume.select', 'resume', record.id, `Selected ${record.fileName} as résumé draft`);
        transaction.set(doc(services!.db, 'cmsAudit', audit.id), audit);
      });
      resumeDraft = nextDocument; resumeDraftVersion = nextVersion;
      setMessage(`${record.fileName} selected as the résumé draft. Publish it when you are ready.`); renderResume(); return true;
    } catch (error) {
      console.error(error); setMessage(error instanceof Error && error.message.startsWith('CMS_CONFLICT:') ? 'This résumé draft changed in another tab or device. Reload before selecting.' : 'The résumé draft could not be saved.', true); return false;
    }
  };

  const publishResume = async (record: MediaRecord) => {
    if (!services?.auth.currentUser || !window.confirm(`Publish ${record.fileName} at /resume/?\n\nThe previous version remains available for rollback.`)) return;
    if (!await saveResumeDraft(record)) return;
    const nextVersion = resumePublishedVersion + 1;
    try {
      await runTransaction(services.db, async (transaction) => {
        const publishedRef = doc(services!.db, 'cmsResume', 'published'); const remote = await transaction.get(publishedRef);
        if (Number(remote.data()?.version ?? 0) !== resumePublishedVersion) throw new Error('CMS_CONFLICT:resume-published');
        transaction.set(publishedRef, { ...resumeDraft, version: nextVersion, updatedAt: serverTimestamp(), publishedAt: serverTimestamp(), updatedBy: services!.auth.currentUser!.uid });
        const audit = auditPayload(services!, 'resume.publish', 'resume', record.id, `Published résumé ${record.fileName}`);
        transaction.set(doc(services!.db, 'cmsAudit', audit.id), audit);
      });
      resumePublished = { ...resumeDraft }; resumePublishedVersion = nextVersion;
      setMessage(`Résumé published. The request page now serves ${record.fileName}.`); renderResume();
    } catch (error) {
      console.error(error); setMessage(error instanceof Error && error.message.startsWith('CMS_CONFLICT:') ? 'The published résumé changed elsewhere. Reload before publishing.' : 'The résumé could not be published.', true);
    }
  };

  const referencedBy = async (record: MediaRecord) => {
    if (!services) return [];
    const paths = ['cmsDrafts', 'cmsPublished', 'cmsSeo', 'cmsResume'];
    const snapshots = await Promise.all(paths.map((path) => getDocs(collection(services!.db, path))));
    const needles = [record.id, record.publicUrl, record.originalUrl, record.storagePath].filter(Boolean);
    return snapshots.flatMap((snapshot, index) => snapshot.docs.filter((item) => needles.some((needle) => JSON.stringify(item.data()).includes(needle))).map((item) => `${paths[index]}/${item.id}`));
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!services?.auth.currentUser || !storage) return setMessage('Upload requires Firebase authentication.', true);
    const file = document.querySelector<HTMLInputElement>('#media-file')?.files?.[0];
    const kind = document.querySelector<HTMLSelectElement>('#media-kind')?.value as MediaKind;
    const altText = document.querySelector<HTMLInputElement>('#media-alt')?.value.trim() ?? '';
    const caption = document.querySelector<HTMLTextAreaElement>('#media-caption')?.value.trim() ?? '';
    const credit = document.querySelector<HTMLInputElement>('#media-credit')?.value.trim() ?? '';
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type) && file.type !== 'application/pdf') return setMessage('Only jpeg, png, WebP, and PDF files are accepted.', true);
    if (file.size > (file.type === 'application/pdf' ? MAX_PDF : MAX_IMAGE)) return setMessage(`File exceeds the ${file.type === 'application/pdf' ? '10' : '12'} MB limit.`, true);
    if (file.type.startsWith('image/') && !altText) return setMessage('Alt text is required for every image.', true);
    if (kind === 'resume' && file.type !== 'application/pdf') return setMessage('Résumé versions must be PDF files.', true);
    const id = crypto.randomUUID();
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>('input,textarea,select,button').forEach((control) => control.disabled = true);
    if (progress) progress.hidden = false;
    try {
      let record: MediaRecord;
      if (file.type.startsWith('image/')) {
        const [display, thumbnail] = await Promise.all([resizeImage(file, 2400, .84), resizeImage(file, 640, .78)]);
        if (display.width < 640 || display.height < 360) setMessage('This image has a low resolution. The upload will continue with a quality warning.', true);
        const originalPath = `public/media/${id}/original`;
        const displayPath = `public/media/${id}/display.webp`;
        const thumbnailPath = `public/media/${id}/thumbnail.webp`;
        let overall = 0;
        const update = (offset: number, fraction: number) => { overall = Math.max(overall, (offset + fraction) / 3); if (progressBar) progressBar.style.width = `${Math.round(overall * 100)}%`; };
        const originalUrl = await upload(storage, originalPath, file, (value) => update(0, value));
        const publicUrl = await upload(storage, displayPath, display.blob, (value) => update(1, value));
        const thumbnailUrl = await upload(storage, thumbnailPath, thumbnail.blob, (value) => update(2, value));
        record = { id, kind, fileName: file.name, storagePath: displayPath, originalStoragePath: originalPath, thumbnailStoragePath: thumbnailPath, publicUrl, originalUrl, thumbnailUrl, mimeType: 'image/webp', originalMimeType: file.type, fileSize: display.blob.size, originalFileSize: file.size, width: display.width, height: display.height, altText, caption, credit, usageReferences: [], uploadedBy: services.auth.currentUser.uid };
      } else {
        const storagePath = kind === 'resume' ? `public/resume/versions/${id}.pdf` : `public/media/${id}/document.pdf`;
        const publicUrl = await upload(storage, storagePath, file, (value) => { if (progressBar) progressBar.style.width = `${Math.round(value * 100)}%`; });
        record = { id, kind, fileName: file.name, storagePath, originalStoragePath: storagePath, thumbnailStoragePath: '', publicUrl, originalUrl: publicUrl, thumbnailUrl: '', mimeType: 'application/pdf', originalMimeType: 'application/pdf', fileSize: file.size, originalFileSize: file.size, width: 0, height: 0, altText: '', caption, credit, usageReferences: [], uploadedBy: services.auth.currentUser.uid };
      }
      const batch = writeBatch(services.db);
      batch.set(doc(services.db, 'cmsMedia', id), { ...record, uploadedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      const audit = auditPayload(services, 'media.upload', 'media', id, `Uploaded ${file.name} as ${kind}`);
      batch.set(doc(services.db, 'cmsAudit', audit.id), audit);
      await batch.commit();
      form.reset();
      setMessage(`${file.name} uploaded to the media library.`);
      await load();
    } catch (error) {
      console.error(error);
      setMessage('Upload failed. No catalogue record was published.', true);
    } finally {
      form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>('input,textarea,select,button').forEach((control) => control.disabled = false);
      if (progress) progress.hidden = true;
      if (progressBar) progressBar.style.width = '0';
    }
  });

  grid.addEventListener('click', async (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    const card = button?.closest<HTMLElement>('[data-media-id]');
    const record = records.find((item) => item.id === card?.dataset.mediaId);
    if (!button || !card || !record || !services?.auth.currentUser) return;
    if (button.hasAttribute('data-media-copy')) {
      await navigator.clipboard.writeText(record.publicUrl);
      return setMessage('Public media reference copied.');
    }
    if (button.hasAttribute('data-media-usage')) {
      const references = await referencedBy(record);
      return setMessage(references.length ? `Used by: ${references.join(', ')}` : 'No draft or live references found.');
    }
    if (button.hasAttribute('data-media-save')) {
      record.altText = card.querySelector<HTMLTextAreaElement>('[data-media-alt]')?.value.trim() ?? record.altText;
      record.caption = card.querySelector<HTMLInputElement>('[data-media-caption]')?.value.trim() ?? '';
      record.credit = card.querySelector<HTMLInputElement>('[data-media-credit]')?.value.trim() ?? '';
      if (record.mimeType.startsWith('image/') && !record.altText) return setMessage('Alt text cannot be empty for an image.', true);
      const batch = writeBatch(services.db);
      batch.set(doc(services.db, 'cmsMedia', record.id), { ...record, updatedAt: serverTimestamp() });
      const audit = auditPayload(services, 'media.update', 'media', record.id, `Updated metadata for ${record.fileName}`);
      batch.set(doc(services.db, 'cmsAudit', audit.id), audit); await batch.commit();
      return setMessage(`${record.fileName} details saved.`);
    }
    if (button.hasAttribute('data-media-delete')) {
      setMessage('Checking live and draft usage before delete…');
      const references = await referencedBy(record);
      if (references.length) return setMessage(`Cannot delete. This asset is used by: ${references.join(', ')}`, true);
      if (!window.confirm(`Permanently delete ${record.fileName} and its stored variants?`)) return setMessage('Delete cancelled.');
      for (const path of new Set([record.storagePath, record.originalStoragePath, record.thumbnailStoragePath].filter(Boolean))) {
        try { await deleteObject(ref(storage!, path)); } catch (error) { if ((error as { code?: string }).code !== 'storage/object-not-found') throw error; }
      }
      const batch = writeBatch(services.db); batch.delete(doc(services.db, 'cmsMedia', record.id));
      const audit = auditPayload(services, 'media.delete', 'media', record.id, `Deleted ${record.fileName}`);
      batch.set(doc(services.db, 'cmsAudit', audit.id), audit); await batch.commit();
      setMessage(`${record.fileName} deleted.`);
      await load();
    }
  });
  resumeManager.addEventListener('click', async (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    const id = button?.dataset.resumeSelect ?? button?.dataset.resumePublish;
    const record = records.find((item) => item.id === id);
    if (!button || !record) return;
    if (button.dataset.resumeSelect) await saveResumeDraft(record);
    else await publishResume(record);
  });
  search.addEventListener('input', render);
  filter.addEventListener('change', render);

  await initializeAdminGate({ root, authPanel, signInButton, signOutButton, message, onAuthorized: async (_user, cloud) => {
    if (!cloud) return setMessage('Local mode requires Firebase configuration for media storage.', true);
    services = await import('../lib/firebase').then(({ getFirebaseServices }) => getFirebaseServices());
    storage = await getFirebaseStorage();
    if (services) try { await recordAudit(services, 'admin.session', 'admin', 'media', 'Authenticated media editor session'); } catch (error) { console.error(error); }
    setMessage('Media library connected.');
    await load();
  } });
}
