import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase/config';

const AuthContext = createContext(null);

async function readRole(user) {
  if (!user) return null;
  const { claims } = await user.getIdTokenResult();
  return ['admin', 'staff'].includes(claims.role) ? claims.role : null;
}

/**
 * Firebase Auth session for attendees (Google) and organisers (email/password).
 * `role` comes from the custom claim set by server/scripts/create-admin.js; the UI only
 * hides routes, every API call is authorised by the backend.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, role: null, loading: isFirebaseConfigured });

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, async (user) => {
      const role = await readRole(user).catch(() => null);
      setState({ user, role, loading: false });
    });
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!auth) throw new Error('Sign-in is not configured. Add the Firebase web config to client/.env.');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(err?.code)) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw err;
    }
  }, []);

  /** Organiser login (email/password accounts created by the create-admin script). */
  const loginAsOrganiser = useCallback(async (email, password) => {
    if (!auth) throw new Error('Admin login is not configured. Add the Firebase web config to client/.env.');
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    // Force refresh so a newly assigned role claim is included.
    await user.getIdToken(true);
    const role = await readRole(user);
    if (!role) {
      await signOut(auth);
      throw new Error('This account does not have admin or staff access.');
    }
    setState({ user, role, loading: false });
    return role;
  }, []);

  const logout = useCallback(async () => {
    if (auth) await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({ ...state, loginWithGoogle, loginAsOrganiser, logout, configured: isFirebaseConfigured }),
    [state, loginWithGoogle, loginAsOrganiser, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function authErrorMessage(err) {
  const map = {
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/unauthorized-domain': 'This website address is not authorised for sign-in yet (Firebase → Authentication → Settings → Authorized domains).',
    'auth/operation-not-allowed': 'Google sign-in is not enabled yet (Firebase → Authentication → Sign-in method → Google).',
  };
  return map[err?.code] || err?.message || 'Sign in failed.';
}
