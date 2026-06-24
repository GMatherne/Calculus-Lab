import { createContext, useContext } from "react";
import type { User } from "firebase/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isDemo: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  loginWithGoogle: (mode?: "login" | "signup") => Promise<void>;
  logout: () => Promise<void>;
  /** Update the signed-in user's display name (auth identity + demo store). */
  updateDisplayName: (name: string) => Promise<void>;
  /**
   * Start an email change. In production this re-authenticates and sends a
   * verification link to the new address — the email only changes once the user
   * clicks it. In demo mode the local email is updated immediately.
   */
  changeEmail: (newEmail: string, currentPassword: string) => Promise<void>;
  /** Re-authenticate with the current password and set a new one. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /**
   * Permanently delete the signed-in account and all of its stored data.
   * Password accounts must pass the current password to re-authenticate;
   * Google accounts are re-authenticated with a fresh popup. In demo mode the
   * locally stored demo user and data are cleared.
   */
  deleteAccount: (currentPassword?: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Thrown when the user simply closes/cancels the Google popup — not a real error. */
export const GOOGLE_SIGN_IN_CANCELLED = "google-sign-in-cancelled";

/**
 * Thrown from the sign-up flow when the chosen Google account already has an
 * account, so the UI can steer the user to log in instead of silently
 * signing them in.
 */
export const GOOGLE_ACCOUNT_EXISTS = "google-account-exists";

/**
 * Thrown from the log-in flow when a Google sign-in would have created a brand
 * new account — meaning there is no existing account to log into (e.g. it was
 * deleted, or the user never signed up). The implicitly-created account is
 * removed and the UI steers the user to sign up instead of silently logging
 * them into a fresh, empty account.
 */
export const GOOGLE_ACCOUNT_NOT_FOUND = "google-account-not-found";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
