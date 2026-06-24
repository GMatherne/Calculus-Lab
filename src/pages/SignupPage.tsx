import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useAuth,
  GOOGLE_SIGN_IN_CANCELLED,
  GOOGLE_ACCOUNT_EXISTS,
} from "../contexts/AuthContext";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";
import { PasswordInput } from "../components/auth/PasswordInput";

export function SignupPage() {
  const { signup, loginWithGoogle, isDemo } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await signup(email, password, displayName);
      navigate("/lessons");
    } catch {
      setError("Could not create account. Try a different email.");
    }
  };

  const handleGoogle = async () => {
    setError("");
    setNotice("");
    try {
      await loginWithGoogle("signup");
      navigate("/lessons");
    } catch (err) {
      console.error("Google sign-in (signup page) error:", err);
      const message = err instanceof Error ? err.message : "";
      if (message === GOOGLE_ACCOUNT_EXISTS) {
        setNotice(
          "You already have an account with this Google account. Please log in instead.",
        );
      } else if (message !== GOOGLE_SIGN_IN_CANCELLED) {
        setError(message || "Couldn't sign in with Google. Please try again.");
      }
    }
  };

  useEffect(() => {
    if (isDemo) navigate("/lessons");
  }, [isDemo, navigate]);

  if (isDemo) return null;

  return (
    <SafeArea>
      <AppHeader />
      <main className="flex-1 px-4 py-8 max-w-md mx-auto w-full">
        <h1 className="text-2xl font-bold text-slate-900">Sign up</h1>
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          <input
            type="text"
            placeholder="Display name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border border-slate-300 px-4 text-base"
          />
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border border-slate-300 px-4 text-base"
          />
          <PasswordInput
            placeholder="Password (6+ characters)"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full min-h-[48px] rounded-xl bg-indigo-600 text-white font-semibold"
          >
            Create account
          </button>
        </form>
        <button
          type="button"
          onClick={() => void handleGoogle()}
          className="mt-3 w-full min-h-[48px] rounded-xl border border-slate-300 font-medium"
        >
          Continue with Google
        </button>
        {notice && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {notice}{" "}
            <Link to="/login" className="font-semibold text-amber-900 underline">
              Log in
            </Link>
          </div>
        )}
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-600 font-medium">
            Log in
          </Link>
        </p>
      </main>
    </SafeArea>
  );
}
