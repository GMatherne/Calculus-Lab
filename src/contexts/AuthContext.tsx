import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, isDevBypass } from "../lib/firebase";
import { createUserProfile, getUserProfile } from "../lib/progressService";

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
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_USER_KEY = "derivatives_demo_user";

/** Thrown when the user simply closes/cancels the Google popup — not a real error. */
export const GOOGLE_SIGN_IN_CANCELLED = "google-sign-in-cancelled";

/**
 * Thrown from the sign-up flow when the chosen Google account already has an
 * account, so the UI can steer the user to log in instead of silently
 * signing them in.
 */
export const GOOGLE_ACCOUNT_EXISTS = "google-account-exists";

function googleAuthErrorMessage(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return GOOGLE_SIGN_IN_CANCELLED;
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow popups for this site and try again.";
    case "auth/operation-not-allowed":
      return "Google sign-in isn't enabled for this app yet. Enable it in the Firebase console.";
    case "auth/unauthorized-domain":
      return "This site's domain isn't authorized for Google sign-in. Add it in Firebase Authentication settings.";
    case "auth/internal-error":
      return "Google sign-in failed. Check that the Google provider is fully configured in Firebase.";
    default:
      return code
        ? `Couldn't sign in with Google (${code}). Please try again.`
        : "Couldn't sign in with Google. Please try again.";
  }
}

/** Friendly messages for the account-management flows (name/email/password). */
function accountErrorMessage(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Current password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/email-already-in-use":
      return "That email is already in use by another account.";
    case "auth/invalid-email":
      return "That email address looks invalid.";
    case "auth/weak-password":
      return "Choose a stronger password (at least 6 characters).";
    case "auth/requires-recent-login":
      return "For security, log out and back in, then try again.";
    case "auth/operation-not-allowed":
      return "This change isn't allowed for your account.";
    default:
      return code
        ? `Couldn't complete that change (${code}). Please try again.`
        : "Couldn't complete that change. Please try again.";
  }
}

function createDemoUser(): User {
  const stored = localStorage.getItem(DEMO_USER_KEY);
  const data = stored
    ? JSON.parse(stored)
    : { uid: `demo_${Date.now()}`, displayName: "Demo Student", email: "demo@local.dev" };
  localStorage.setItem(DEMO_USER_KEY, JSON.stringify(data));
  return data as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Demo auto-login is a local development convenience only. In dev (port 5173)
  // you're always signed in as the demo user with no login required. Production
  // builds (port 5174) always require a real Firebase login.
  const isDemo = isDevBypass;

  useEffect(() => {
    if (isDemo) {
      const demo = createDemoUser();
      void getUserProfile(demo.uid).then((p) => {
        if (!p) {
          void createUserProfile(demo.uid, demo.displayName ?? "Demo Student", demo.email ?? "");
        }
      });
      setUser(demo);
      setLoading(false);
      return;
    }

    if (!auth) {
      // Firebase not configured in a non-dev build: no demo bypass, no user.
      setUser(null);
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const profile = await getUserProfile(u.uid);
        if (!profile) {
          await createUserProfile(
            u.uid,
            u.displayName ?? "Student",
            u.email ?? "",
          );
        }
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    if (!auth) throw new Error("Auth not configured");
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async (email: string, password: string, displayName: string) => {
    if (!auth) throw new Error("Auth not configured");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await createUserProfile(cred.user.uid, displayName, email);
  };

  const loginWithGoogle = async (mode: "login" | "signup" = "login") => {
    if (!auth) throw new Error("Auth not configured");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    let cred;
    try {
      cred = await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Google sign-in failed:", err);
      throw new Error(googleAuthErrorMessage(err));
    }

    // Google sign-in transparently creates an account when none exists, so
    // `isNewUser` is the only signal that distinguishes a brand-new user from a
    // returning one. Only treat it as existing when Firebase positively says so,
    // so an unexpected null never blocks a legitimate new signup.
    const additional = getAdditionalUserInfo(cred);
    const accountAlreadyExisted = additional ? additional.isNewUser === false : false;
    if (mode === "signup" && accountAlreadyExisted) {
      // They picked an already-registered Google account on the sign-up page.
      // Undo the implicit sign-in and surface a warning so they log in instead.
      await signOut(auth);
      throw new Error(GOOGLE_ACCOUNT_EXISTS);
    }

    const profile = await getUserProfile(cred.user.uid);
    if (!profile) {
      await createUserProfile(
        cred.user.uid,
        cred.user.displayName ?? "Student",
        cred.user.email ?? "",
      );
    }
  };

  const logout = async () => {
    if (!auth) {
      localStorage.removeItem(DEMO_USER_KEY);
      setUser(null);
      return;
    }
    await signOut(auth);
  };

  // In demo mode there is no real Firebase user, so identity edits just rewrite
  // the local demo user object (and re-render via a fresh reference).
  const setDemoUser = (fields: { displayName?: string; email?: string }) => {
    const next = {
      uid: user?.uid ?? `demo_${Date.now()}`,
      displayName: fields.displayName ?? user?.displayName ?? "Demo Student",
      email: fields.email ?? user?.email ?? "",
    };
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(next));
    setUser(next as unknown as User);
  };

  const updateDisplayName = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Display name can't be empty.");
    if (isDemo) {
      setDemoUser({ displayName: trimmed });
      return;
    }
    if (!auth?.currentUser) throw new Error("You must be signed in.");
    try {
      await updateProfile(auth.currentUser, { displayName: trimmed });
    } catch (err) {
      throw new Error(accountErrorMessage(err));
    }
  };

  const changeEmail = async (newEmail: string, currentPassword: string) => {
    const trimmed = newEmail.trim();
    if (!trimmed) throw new Error("Email can't be empty.");
    if (isDemo) {
      setDemoUser({ email: trimmed });
      return;
    }
    if (!auth?.currentUser) throw new Error("You must be signed in.");
    const current = auth.currentUser;
    if (!current.email) {
      throw new Error("Your account has no email to re-authenticate with.");
    }
    try {
      const cred = EmailAuthProvider.credential(current.email, currentPassword);
      await reauthenticateWithCredential(current, cred);
      await verifyBeforeUpdateEmail(current, trimmed);
    } catch (err) {
      throw new Error(accountErrorMessage(err));
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    if (isDemo) {
      throw new Error("Password changes aren't available in demo mode.");
    }
    if (!auth?.currentUser) throw new Error("You must be signed in.");
    const current = auth.currentUser;
    if (!current.email) {
      throw new Error("Your account doesn't use an email/password to update.");
    }
    try {
      const cred = EmailAuthProvider.credential(current.email, currentPassword);
      await reauthenticateWithCredential(current, cred);
      await updatePassword(current, newPassword);
    } catch (err) {
      throw new Error(accountErrorMessage(err));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemo,
        login,
        signup,
        loginWithGoogle,
        logout,
        updateDisplayName,
        changeEmail,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
