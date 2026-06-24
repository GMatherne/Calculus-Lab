import { useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  verifyBeforeUpdateEmail,
  deleteUser,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, isDevBypass } from "../lib/firebase";
import {
  createUserProfile,
  getUserProfile,
  deleteUserData,
} from "../lib/progressService";
import {
  AuthContext,
  GOOGLE_ACCOUNT_EXISTS,
  GOOGLE_ACCOUNT_NOT_FOUND,
  GOOGLE_SIGN_IN_CANCELLED,
} from "./AuthContext";

const DEMO_USER_KEY = "derivatives_demo_user";

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
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return "Re-authentication was cancelled. Please try again.";
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
  }, [isDemo]);

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
    // returning one. Only trust it when Firebase positively says so, so an
    // unexpected null never blocks a legitimate flow.
    const additional = getAdditionalUserInfo(cred);
    const accountAlreadyExisted = additional ? additional.isNewUser === false : false;
    const isBrandNewAccount = additional ? additional.isNewUser === true : false;

    if (mode === "signup" && accountAlreadyExisted) {
      // They picked an already-registered Google account on the sign-up page.
      // Undo the implicit sign-in and surface a warning so they log in instead.
      await signOut(auth);
      throw new Error(GOOGLE_ACCOUNT_EXISTS);
    }

    if (mode === "login" && isBrandNewAccount) {
      // Logging in must never create an account. Since Google sign-in registers
      // a new user implicitly, a brand-new account here means there was no
      // existing account to log into — e.g. the user deleted their account and
      // is signing back in. Delete the just-created (empty) user so it can't
      // linger or silently "reappear" with reset progress, then steer the user
      // to sign up.
      try {
        await deleteUser(cred.user);
      } catch {
        // If the implicit user can't be deleted, at least don't leave a session.
        await signOut(auth);
      }
      throw new Error(GOOGLE_ACCOUNT_NOT_FOUND);
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

  const deleteAccount = async (currentPassword?: string) => {
    // Demo mode has no real auth user — just drop the locally stored demo user
    // and their data, then sign out.
    if (isDemo) {
      if (user?.uid) await deleteUserData(user.uid);
      localStorage.removeItem(DEMO_USER_KEY);
      setUser(null);
      return;
    }
    if (!auth?.currentUser) throw new Error("You must be signed in.");
    const current = auth.currentUser;
    const usesPassword = current.providerData.some(
      (p) => p.providerId === "password",
    );

    // Build the password credential up front so its validation errors surface
    // with a clear message instead of being swallowed by the catch below.
    let passwordCred: ReturnType<typeof EmailAuthProvider.credential> | null =
      null;
    if (usesPassword) {
      if (!current.email) {
        throw new Error("Your account has no email to re-authenticate with.");
      }
      if (!currentPassword) {
        throw new Error("Enter your current password to delete your account.");
      }
      passwordCred = EmailAuthProvider.credential(current.email, currentPassword);
    }

    try {
      // Deleting a user requires a recent login, so re-authenticate first.
      if (passwordCred) {
        await reauthenticateWithCredential(current, passwordCred);
      } else {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await reauthenticateWithPopup(current, provider);
      }
      // Remove stored data while still authenticated (security rules require
      // it), then delete the auth account itself.
      await deleteUserData(current.uid);
      await deleteUser(current);
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
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
