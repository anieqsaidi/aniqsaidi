const LEGACY_WORKER_PATH = '/batam-sw.js';
const LEGACY_SCOPE_PATH = '/';
const BATAM_WORKER_PATH = '/batam/sw.js';
const BATAM_SCOPE = '/batam/';
const BATAM_SHELL_CACHE_PREFIX = 'batam-shell-';

export function isLegacyBatamRegistration(registration) {
  const worker = registration.active || registration.waiting || registration.installing;
  if (!worker?.scriptURL || !registration.scope) return false;

  try {
    return new URL(worker.scriptURL).pathname === LEGACY_WORKER_PATH
      && new URL(registration.scope).pathname === LEGACY_SCOPE_PATH;
  } catch {
    return false;
  }
}

export async function cleanupLegacyBatamServiceWorkers(serviceWorker, cacheStorage) {
  const registrations = await serviceWorker.getRegistrations();
  const legacyRegistrations = registrations.filter(isLegacyBatamRegistration);

  if (legacyRegistrations.length === 0) return false;

  await Promise.all(legacyRegistrations.map((registration) => registration.unregister()));

  if (cacheStorage) {
    const cacheKeys = await cacheStorage.keys();
    await Promise.all(
      cacheKeys
        .filter((key) => key.startsWith(BATAM_SHELL_CACHE_PREFIX))
        .map((key) => cacheStorage.delete(key)),
    );
  }

  return true;
}

export async function registerBatamServiceWorker(serviceWorker, cacheStorage) {
  await cleanupLegacyBatamServiceWorkers(serviceWorker, cacheStorage);
  const registration = await serviceWorker.register(BATAM_WORKER_PATH, {
    scope: BATAM_SCOPE,
    updateViaCache: 'none',
  });
  await registration.update();
  return registration;
}
