import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, GOOGLE_SIGN_IN_CANCELLED } from "../contexts/AuthContext";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";

export function LoginPage() {
  const { login, loginWithGoogle, isDemo } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/lessons");
    } catch {
      setError("Invalid email or password.");
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await loginWithGoogle();
      navigate("/lessons");
    } catch (err) {
      console.error("Google sign-in (login page) error:", err);
      const message = err instanceof Error ? err.message : "";
      if (message !== GOOGLE_SIGN_IN_CANCELLED) {
        setError(message || "Couldn't sign in with Google. Please try again.");
      }
    }
  };

  if (isDemo) {
    return (
      <SafeArea>
        <AppHeader />
        <main className="flex-1 px-4 py-8 max-w-md mx-auto w-full">
          <h1 className="text-2xl font-bold text-slate-900">Dev mode</h1>
          <p className="mt-2 text-slate-600">
            You're automatically signed in as a demo user. Progress saves
            locally in your browser. Run the production preview to test real
            login.
          </p>
          <Link
            to="/lessons"
            className="mt-6 block w-full min-h-[48px] rounded-xl bg-indigo-600 text-white text-center leading-[48px] font-semibold"
          >
            Continue to lessons
          </Link>
        </main>
      </SafeArea>
    );
  }

  return (
    <SafeArea>
      <AppHeader />
      <main className="flex-1 px-4 py-8 max-w-md mx-auto w-full">
        <h1 className="text-2xl font-bold text-slate-900">Log in</h1>
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border border-slate-300 px-4 text-base"
          />
          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border border-slate-300 px-4 text-base"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full min-h-[48px] rounded-xl bg-indigo-600 text-white font-semibold"
          >
            Log in
          </button>
        </form>
        <button
          type="button"
          onClick={() => void handleGoogle()}
          className="mt-3 w-full min-h-[48px] rounded-xl border border-slate-300 font-medium"
        >
          Continue with Google
        </button>
        <p className="mt-4 text-center text-sm text-slate-500">
          No account?{" "}
          <Link to="/signup" className="text-indigo-600 font-medium">
            Sign up
          </Link>
        </p>
      </main>
    </SafeArea>
  );
}
