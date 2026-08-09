import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { ADMIN_EMAIL, ADMIN_UID } from '../data/admin';
import { firebaseConfigured, getFirebaseServices } from '../lib/firebase';

interface AdminGateOptions {
  root: HTMLElement;
  authPanel: HTMLElement;
  signInButton: HTMLButtonElement;
  signOutButton: HTMLButtonElement;
  message: HTMLElement;
  onAuthorized: (user: User | null, cloud: boolean) => Promise<void> | void;
}

export async function initializeAdminGate(options: AdminGateOptions) {
  const { root, authPanel, signInButton, signOutButton, message, onAuthorized } = options;
  const services = await getFirebaseServices();
  let unlocked = false;

  const setMessage = (text: string, error = false) => {
    message.textContent = text;
    message.classList.toggle('is-error', error);
  };
  const unlock = async (user: User | null, cloud: boolean) => {
    if (unlocked) return;
    unlocked = true;
    root.classList.add('is-authorized');
    authPanel.hidden = true;
    signOutButton.hidden = !cloud;
    await onAuthorized(user, cloud);
  };

  if (import.meta.env.DEV && (!firebaseConfigured || !services)) {
    await unlock(null, false);
    return { services, setMessage };
  }
  if (!services) {
    authPanel.hidden = false;
    setMessage('FIREBASE CONFIGURATION IS UNAVAILABLE.', true);
    return { services, setMessage };
  }

  onAuthStateChanged(services.auth, async (user) => {
    if (user?.emailVerified && user.uid === ADMIN_UID) return unlock(user, true);
    unlocked = false;
    root.classList.remove('is-authorized');
    authPanel.hidden = false;
    signOutButton.hidden = true;
    if (user) {
      setMessage('THIS GOOGLE ACCOUNT IS NOT AUTHORIZED.', true);
      await signOut(services.auth);
    } else setMessage('AUTHENTICATION REQUIRED.');
  });

  signInButton.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ login_hint: ADMIN_EMAIL });
    try {
      await signInWithPopup(services.auth, provider);
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/popup-blocked') await signInWithRedirect(services.auth, provider);
      else {
        console.error(error);
        setMessage('GOOGLE SIGN-IN FAILED.', true);
      }
    }
  });
  signOutButton.addEventListener('click', () => signOut(services.auth));
  return { services, setMessage };
}
