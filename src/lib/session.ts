import type { Session } from '../types';

const STORAGE_KEY = 'central_super_admin_session';

let currentSession: Session | null = readStoredSession();
const listeners = new Set<() => void>();

function readStoredSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Session;
    if (!value.accessToken || !value.user?.email) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return value;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export function getSession() {
  return currentSession;
}

export function setSession(session: Session | null) {
  currentSession = session;

  if (typeof window !== 'undefined') {
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  emit();
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isAccessTokenExpired(token: string) {
  try {
    const [, payload] = token.split('.');
    const data = JSON.parse(window.atob(payload)) as { exp?: number };
    if (!data.exp) return false;
    return Date.now() / 1000 >= data.exp - 15;
  } catch {
    return true;
  }
}
