import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { getAI, GoogleAIBackend, type AI } from "firebase/ai";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey !== "demo",
);

// In development (vite dev server, port 5173) we bypass real authentication
// for convenience, so you never have to log in. Production builds
// (vite build / preview, port 5174) always require a real login.
export const isDevBypass = import.meta.env.DEV;

// Use browser-local persistence whenever we're not backed by a real
// authenticated Firebase session — i.e. the dev bypass is active, or Firebase
// simply isn't configured. This keeps the dev demo user off of Firestore
// (whose rules would reject its unauthenticated, fake uid).
export const useLocalPersistence = isDevBypass || !isFirebaseConfigured;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let ai: AI | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // App Check protects the Gemini quota from abuse. It is optional locally (the
  // tutor still works without it unless enforcement is enabled in the console)
  // but required for safe production use. When no site key is provided we skip
  // it entirely and the AI tutor simply stays available without App Check.
  // App Check relies on reCAPTCHA Enterprise, which needs a browser DOM, so it
  // only runs in the browser. This guard also keeps it out of Node test/SSR
  // contexts where `window` is undefined.
  const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
  if (appCheckSiteKey && typeof window !== "undefined") {
    // A debug token lets App Check pass from localhost during development.
    if (import.meta.env.DEV) {
      (
        globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }
      ).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  // Firebase AI Logic (Gemini Developer API) powers the optional concept tutor.
  // It is only ever created when Firebase is configured, so demo/offline runs
  // (where `app` is null) leave the tutor disabled and the app fully usable.
  ai = getAI(app, { backend: new GoogleAIBackend() });
}

/** True when the Firebase AI Logic client is initialized and usable. */
export const isAiAvailable = ai !== null;

export { auth, db, ai };
