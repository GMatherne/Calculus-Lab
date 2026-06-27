import { initializeApp } from "firebase-admin/app";

// Initialize the Admin SDK once for the whole codebase. Firestore access in the
// rate limiter relies on the default app being initialized here.
initializeApp();

export { tutor } from "./tutor";
