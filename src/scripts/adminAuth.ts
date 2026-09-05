import {
  GoogleAuthProvider,
  getRedirectResult,
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
  onUnauthorized?: () => void;
}

export async function initializeAdminGate(options: AdminGateOptions) {
  const { root, authPanel, signInButton, signOutButton, message, onAuthorized } = options;
  const services = await getFirebaseServices();
  let unlocked = false;
  const errorCode = (error: unknown) => {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
    return code.replace(/^auth\//, '').toUpperCase() || 'UNKNOWN ERROR';
  };

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
    setMessage('Firebase configuration is unavailable.', true);
    return { services, setMessage };
  }

  onAuthStateChanged(services.auth, async (user) => {
    if (user?.emailVerified && user.uid === ADMIN_UID) return unlock(user, true);
    unlocked = false;
    root.classList.remove('is-authorized');
    options.onUnauthorized?.();
    authPanel.hidden = false;
    signOutButton.hidden = true;
    if (user) {
      setMessage('This Google account is not authorized.', true);
      await signOut(services.auth);
    } else setMessage('Sign in to continue.');
  });

  void getRedirectResult(services.auth).catch((error) => {
    console.error(error);
    setMessage(`Google sign-in failed: ${errorCode(error)}.`, true);
  });

  signInButton.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ login_hint: ADMIN_EMAIL });
    try {
      await signInWithPopup(services.auth, provider);
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(code)) {
        setMessage('The sign-in popup is unavailable. Continuing in this window…');
        await signInWithRedirect(services.auth, provider);
      } else {
        console.error(error);
        setMessage(`Google sign-in failed: ${errorCode(error)}.`, true);
      }
    }
  });
  signOutButton.addEventListener('click', () => signOut(services.auth));
  return { services, setMessage };
}
