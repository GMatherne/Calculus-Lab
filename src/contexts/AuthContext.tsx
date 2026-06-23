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
  GoogleAuthProvider,
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
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_USER_KEY = "derivatives_demo_user";

/** Thrown when the user simply closes/cancels the Google popup — not a real error. */
export const GOOGLE_SIGN_IN_CANCELLED = "google-sign-in-cancelled";

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

  const loginWithGoogle = async () => {
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

  return (
    <AuthContext.Provider
      value={{ user, loading, isDemo, login, signup, loginWithGoogle, logout }}
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
