const localConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  (localConfig.apiKey && localConfig.authDomain && localConfig.projectId && localConfig.appId) || import.meta.env.PROD,
);

type FirebaseWebConfig = typeof localConfig;

let runtimeConfig: Promise<FirebaseWebConfig> | null = null;

async function getFirebaseConfig() {
  if (localConfig.apiKey && localConfig.authDomain && localConfig.projectId && localConfig.appId) return localConfig;
  if (typeof window === 'undefined') throw new Error('Firebase configuration is unavailable outside the browser.');
  runtimeConfig ??= fetch('/__/firebase/init.json', { cache: 'no-store' }).then(async (response) => {
    if (!response.ok) throw new Error(`Firebase runtime configuration failed (${response.status}).`);
    return response.json() as Promise<FirebaseWebConfig>;
  });
  return runtimeConfig;
}

export async function getFirebaseServices() {
  if (!firebaseConfigured) return null;
  const config = await getFirebaseConfig();
  const [{ getApp, getApps, initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ]);
  const app = getApps().length ? getApp() : initializeApp(config);
  return { app, auth: getAuth(app), db: getFirestore(app) };
}

export async function getFirebasePublicServices() {
  if (!firebaseConfigured) return null;
  const config = await getFirebaseConfig();
  const [{ getApp, getApps, initializeApp }, { getFirestore }] = await Promise.all([
    import('firebase/app'),
    import('firebase/firestore/lite'),
  ]);
  const app = getApps().length ? getApp() : initializeApp(config);
  return { app, db: getFirestore(app) };
}

export type FirebaseServices = NonNullable<Awaited<ReturnType<typeof getFirebaseServices>>>;

export async function getFirebaseStorage() {
  const services = await getFirebaseServices();
  if (!services) return null;
  const { getStorage } = await import('firebase/storage');
  return getStorage(services.app);
}
