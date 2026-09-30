import { addDoc, collection, deleteDoc, doc, getAggregateFromServer, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, startAfter, sum, Timestamp, updateDoc, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getFirebaseServices } from '../lib/firebase';
import { ADMIN_UID } from '../data/admin';
import { localDate, validMileage } from './calc';

export type CarServices = NonNullable<Awaited<ReturnType<typeof getFirebaseServices>>>;
export type RecordData = { id: string; [key: string]: any };
export const OWNER_UID = ADMIN_UID;
export const asDate = (value: any): Date | null => value?.toDate?.() ?? null;
export const formDate = (value: any) => {
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : '';
};
const mapped = (snap: any) => snap.docs.map((item: any) => ({ id: item.id, ...item.data() })) as RecordData[];
export const ownedQuery = (db: Firestore, name: string, uid: string, vehicleId: string, sort: string, max = 100) => query(collection(db, name), where('ownerId', '==', uid), where('vehicleId', '==', vehicleId), orderBy(sort, 'desc'), limit(max));

export async function loadVehicles(db: Firestore, uid: string) {
  return mapped(await getDocs(query(collection(db, 'vehicles'), where('ownerId', '==', uid), limit(20))));
}
export async function loadRecords(db: Firestore, name: string, uid: string, vehicleId: string, sort: string, max = 100) {
  return mapped(await getDocs(ownedQuery(db, name, uid, vehicleId, sort, max)));
}
export async function loadMoreRecords(db: Firestore, name: string, uid: string, vehicleId: string, sort: string, lastId: string, max = 100) {
  const cursor = await getDoc(doc(db, name, lastId));
  if (!cursor.exists()) return [];
  return mapped(await getDocs(query(collection(db, name), where('ownerId', '==', uid), where('vehicleId', '==', vehicleId), orderBy(sort, 'desc'), startAfter(cursor), limit(max))));
}
export async function completedScheduleIds(db: Firestore, uid: string, vehicleId: string, ids: string[]) {
  const rows = mapped(await getDocs(query(collection(db, 'maintenance'), where('ownerId', '==', uid), where('vehicleId', '==', vehicleId), where('recordType', '==', 'scheduled'), where('scheduleId', 'in', ids), limit(20))));
  return rows.map((row) => String(row.scheduleId));
}
export async function loadLoan(db: Firestore, uid: string, vehicleId: string) {
  const rows = mapped(await getDocs(query(collection(db, 'loans'), where('ownerId', '==', uid), where('vehicleId', '==', vehicleId), limit(1))));
  return rows[0] ?? null;
}
export async function maintenanceTotals(db: Firestore, uid: string, vehicleId: string) {
  const base = [where('ownerId', '==', uid), where('vehicleId', '==', vehicleId)];
  const year = new Date().getFullYear();
  const start = Timestamp.fromDate(new Date(`${year}-01-01T00:00:00+08:00`));
  const end = Timestamp.fromDate(new Date(`${year + 1}-01-01T00:00:00+08:00`));
  const [life, current] = await Promise.all([
    getAggregateFromServer(query(collection(db, 'maintenance'), ...base), { total: sum('totalCost') }),
    getAggregateFromServer(query(collection(db, 'maintenance'), ...base, where('serviceDate', '>=', start), where('serviceDate', '<', end)), { total: sum('totalCost') }),
  ]);
  return { lifetime: Number(life.data().total ?? 0), thisYear: Number(current.data().total ?? 0) };
}
export async function createVehicle(db: Firestore, uid: string, values: any) {
  if (!validMileage(values.currentMileage) || !values.registrationNo.trim()) throw new Error('Add a registration and a valid whole-number mileage.');
  const existing = await loadVehicles(db, uid);
  if (existing.length) return existing[0].id;
  const vehicleRef = doc(collection(db, 'vehicles'));
  const readingRef = doc(collection(db, 'odometer'));
  await runTransaction(db, async (tx) => {
    tx.set(vehicleRef, { ownerId: uid, manufacturer: 'Perodua', model: 'Myvi', engineCc: 1500, transmission: 'automatic', serviceProfile: 'perodua-myvi-1500-auto', serviceRegion: values.serviceRegion || 'peninsular', variant: values.variant || '', year: values.year ?? null, registrationNo: values.registrationNo.trim(), purchaseDate: values.purchaseDate ? Timestamp.fromDate(localDate(values.purchaseDate)) : null, purchasePrice: values.purchasePrice ?? null, imageUrl: null, currentMileage: values.currentMileage, mileageUpdatedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    tx.set(readingRef, { ownerId: uid, vehicleId: vehicleRef.id, mileage: values.currentMileage, recordedAt: serverTimestamp(), source: 'system', note: 'First vehicle setup', createdAt: serverTimestamp() });
  });
  return vehicleRef.id;
}
export async function updateVehicle(db: Firestore, vehicleId: string, values: any) {
  await updateDoc(doc(db, 'vehicles', vehicleId), { ...values, updatedAt: serverTimestamp() });
}
export async function updateMileage(db: Firestore, uid: string, vehicleId: string, mileage: number, note: string, correction: boolean) {
  if (!validMileage(mileage)) throw new Error('Mileage must be a nonnegative whole number.');
  const vehicleRef = doc(db, 'vehicles', vehicleId), readingRef = doc(collection(db, 'odometer'));
  await runTransaction(db, async (tx) => {
    const vehicle = await tx.get(vehicleRef);
    if (!vehicle.exists() || vehicle.data().ownerId !== uid) throw new Error('Vehicle is unavailable.');
    if (mileage < vehicle.data().currentMileage && !correction) throw new Error('Confirm the lower reading as a correction.');
    tx.update(vehicleRef, { currentMileage: mileage, mileageUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    tx.set(readingRef, { ownerId: uid, vehicleId, mileage, recordedAt: serverTimestamp(), source: 'manual', note: note.trim(), correction, createdAt: serverTimestamp() });
  });
}
export async function saveMaintenance(db: Firestore, uid: string, vehicleId: string, data: any, id?: string) {
  if (!validMileage(data.mileage) || !Number.isFinite(data.totalCost) || data.totalCost < 0 || !data.serviceDate || !data.workshop?.name?.trim()) throw new Error('Enter a date, mileage, workshop and valid actual total.');
  const recordRef = id ? doc(db, 'maintenance', id) : doc(collection(db, 'maintenance'));
  const vehicleRef = doc(db, 'vehicles', vehicleId);
  const readingRef = doc(db, 'odometer', `maintenance-${recordRef.id}`);
  const priorReadingRef = doc(collection(db, 'odometer'));
  const serviceDate = Timestamp.fromDate(localDate(data.serviceDate));
  await runTransaction(db, async (tx) => {
    const vehicle = await tx.get(vehicleRef);
    const previous = id ? await tx.get(recordRef) : null;
    if (!vehicle.exists() || vehicle.data().ownerId !== uid || (id && (!previous?.exists() || previous.data().ownerId !== uid || previous.data().vehicleId !== vehicleId))) throw new Error('Vehicle or record is unavailable.');
    const payload = { ...data, serviceDate, ownerId: uid, vehicleId, updatedAt: serverTimestamp(), ...(id ? {} : { createdAt: serverTimestamp() }) };
    tx.set(recordRef, payload, { merge: Boolean(id) });
    if (previous?.exists() && data.mileage < previous.data().mileage) tx.set(priorReadingRef, { ownerId: uid, vehicleId, mileage: previous.data().mileage, recordedAt: previous.data().serviceDate, source: 'manual', note: 'Prior service mileage retained after record correction', createdAt: serverTimestamp() });
    tx.set(readingRef, { ownerId: uid, vehicleId, maintenanceId: recordRef.id, mileage: data.mileage, recordedAt: serviceDate, source: 'maintenance', createdAt: serverTimestamp() });
    if (data.mileage > vehicle.data().currentMileage) tx.update(vehicleRef, { currentMileage: data.mileage, mileageUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  return recordRef.id;
}
export async function deleteMaintenance(db: Firestore, uid: string, vehicleId: string, id: string) {
  const recordRef = doc(db, 'maintenance', id), readingRef = doc(db, 'odometer', `maintenance-${id}`);
  await runTransaction(db, async (tx) => {
    const record = await tx.get(recordRef);
    if (!record.exists() || record.data().ownerId !== uid || record.data().vehicleId !== vehicleId) throw new Error('Record is unavailable.');
    tx.delete(recordRef);
    tx.update(readingRef, { source: 'manual', note: 'Odometer reading retained after service record deletion', maintenanceId: null });
  });
  // The observation remains in the odometer book, so current mileage never silently drops.
}
export async function saveLoan(db: Firestore, uid: string, vehicleId: string, data: any, id?: string) {
  const ref = id ? doc(db, 'loans', id) : doc(collection(db, 'loans'));
  if (id) await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  else await runTransaction(db, async (tx) => { tx.set(ref, { ...data, ownerId: uid, vehicleId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); });
  return ref.id;
}
export async function saveExpense(db: Firestore, uid: string, vehicleId: string, data: any, id?: string) {
  const payload = { ...data, expenseDate: Timestamp.fromDate(localDate(data.expenseDate)), updatedAt: serverTimestamp() };
  if (id) await updateDoc(doc(db, 'expenses', id), payload);
  else await addDoc(collection(db, 'expenses'), { ...payload, ownerId: uid, vehicleId, createdAt: serverTimestamp() });
}
export async function deleteExpense(db: Firestore, id: string) { await deleteDoc(doc(db, 'expenses', id)); }
export async function savePayment(db: Firestore, uid: string, vehicleId: string, loanId: string, data: any) {
  await addDoc(collection(db, 'loanPayments'), { ...data, ownerId: uid, vehicleId, loanId, paymentDate: Timestamp.fromDate(localDate(data.paymentDate)), paymentNumber: null, createdAt: serverTimestamp() });
}
export async function deletePayment(db: Firestore, id: string) { await deleteDoc(doc(db, 'loanPayments', id)); }
