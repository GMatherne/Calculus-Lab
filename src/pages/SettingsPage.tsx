import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useProgress } from "../contexts/ProgressContext";
import { useSound } from "../contexts/SoundContext";
import { playSound } from "../lib/sound";
import { AppHeader } from "../components/layout/AppHeader";
import { SafeArea } from "../components/layout/SafeArea";
import { PasswordInput } from "../components/auth/PasswordInput";

const cardClass = "rounded-2xl border border-slate-200 bg-white p-5";
const labelClass = "block text-sm font-medium text-slate-700";
const inputClass =
  "w-full min-h-[48px] rounded-xl border border-slate-300 px-4 text-base";
const primaryBtn =
  "min-h-[48px] rounded-xl bg-indigo-600 px-5 text-white font-semibold disabled:opacity-50 active:scale-[0.99] transition";
const dangerBtn =
  "min-h-[48px] rounded-xl bg-red-600 px-5 text-white font-semibold disabled:opacity-50 active:scale-[0.99] transition";
const secondaryBtn =
  "min-h-[48px] rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 disabled:opacity-50 active:scale-[0.99] transition";

function errorMessage(err: unknown): string {
  return err instanceof Error && err.message
    ? err.message
    : "Something went wrong. Please try again.";
}

function DisplayNameSection({ initialName }: { initialName: string }) {
  const { updateDisplayName } = useAuth();
  const { updateProfileInfo } = useProgress();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const trimmed = name.trim();
  const disabled = saving || trimmed.length === 0 || trimmed === initialName.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await updateDisplayName(trimmed);
      await updateProfileInfo({ displayName: trimmed });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={cardClass}>
      <h2 className="text-sm font-semibold text-slate-800">Display name</h2>
      <p className="mt-1 text-xs text-slate-500">
        The name shown on your account and progress.
      </p>
      <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
        <div>
          <label htmlFor="displayName" className={labelClass}>
            Name
          </label>
          <input
            id="displayName"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
              setError("");
            }}
            className={`mt-1 ${inputClass}`}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">Name updated.</p>}
        <button type="submit" disabled={disabled} className={primaryBtn}>
          {saving ? "Saving…" : "Save name"}
        </button>
      </form>
    </section>
  );
}

function EmailSection({
  initialEmail,
  editable,
  requireCurrentPassword,
  immediate,
  readOnlyNote,
}: {
  initialEmail: string;
  editable: boolean;
  requireCurrentPassword: boolean;
  /** Demo mode applies the change locally; production sends a verify link. */
  immediate: boolean;
  readOnlyNote: string;
}) {
  const { changeEmail } = useAuth();
  const { updateProfileInfo } = useProgress();
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const trimmed = email.trim();
  const unchanged =
    trimmed.toLowerCase() === initialEmail.trim().toLowerCase();
  const disabled =
    saving ||
    unchanged ||
    trimmed.length === 0 ||
    (requireCurrentPassword && currentPassword.length === 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await changeEmail(trimmed, currentPassword);
      if (immediate) {
        await updateProfileInfo({ email: trimmed });
        setSuccess("Email updated.");
      } else {
        setSuccess(
          `Verification sent to ${trimmed}. Click the link in that email to finish the change.`,
        );
      }
      setCurrentPassword("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={cardClass}>
      <h2 className="text-sm font-semibold text-slate-800">Email</h2>
      {!editable ? (
        <>
          <p className="mt-1 text-xs text-slate-500">{readOnlyNote}</p>
          <p className="mt-3 text-base text-slate-700">{initialEmail}</p>
        </>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
          <div>
            <label htmlFor="email" className={labelClass}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSuccess("");
                setError("");
              }}
              className={`mt-1 ${inputClass}`}
            />
          </div>
          {requireCurrentPassword && (
            <div>
              <label htmlFor="emailCurrentPassword" className={labelClass}>
                Current password
              </label>
              <PasswordInput
                id="emailCurrentPassword"
                autoComplete="current-password"
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setError("");
                }}
                className="mt-1"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}
          <button type="submit" disabled={disabled} className={primaryBtn}>
            {saving ? "Saving…" : immediate ? "Save email" : "Send verification"}
          </button>
        </form>
      )}
    </section>
  );
}

function PasswordSection({
  enabled,
  disabledNote,
}: {
  enabled: boolean;
  disabledNote: string;
}) {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const tooShort = newPassword.length > 0 && newPassword.length < 6;
  const mismatch = confirm.length > 0 && newPassword !== confirm;
  const disabled =
    saving ||
    currentPassword.length === 0 ||
    newPassword.length < 6 ||
    newPassword !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={cardClass}>
      <h2 className="text-sm font-semibold text-slate-800">Password</h2>
      {!enabled ? (
        <p className="mt-1 text-xs text-slate-500">{disabledNote}</p>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
          <div>
            <label htmlFor="currentPassword" className={labelClass}>
              Current password
            </label>
            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setError("");
              }}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="newPassword" className={labelClass}>
              New password
            </label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setSaved(false);
                setError("");
              }}
              className="mt-1"
            />
            {tooShort && (
              <p className="mt-1 text-xs text-amber-600">
                Use at least 6 characters.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="confirmPassword" className={labelClass}>
              Confirm new password
            </label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setError("");
              }}
              className="mt-1"
            />
            {mismatch && (
              <p className="mt-1 text-xs text-amber-600">
                Passwords don't match.
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-emerald-600">Password updated.</p>}
          <button type="submit" disabled={disabled} className={primaryBtn}>
            {saving ? "Saving…" : "Update password"}
          </button>
        </form>
      )}
    </section>
  );
}

function DeleteAccountSection({
  requiresPassword,
  isDemo,
}: {
  /** Production password accounts must re-enter their password to re-authenticate. */
  requiresPassword: boolean;
  isDemo: boolean;
}) {
  const { deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const disabled = deleting || (requiresPassword && password.length === 0);

  const cancel = () => {
    setConfirming(false);
    setPassword("");
    setError("");
  };

  const handleDelete = async () => {
    setError("");
    setDeleting(true);
    try {
      await deleteAccount(requiresPassword ? password : undefined);
      // The user is now signed out; leave the protected settings page.
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
      <h2 className="text-sm font-semibold text-red-700">Delete account</h2>
      <p className="mt-1 text-xs text-red-600/90">
        Permanently delete your account along with all of your progress,
        streaks, and XP. This can't be undone.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`mt-4 ${dangerBtn}`}
        >
          Delete account
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          {requiresPassword ? (
            <div>
              <label htmlFor="deletePassword" className={labelClass}>
                Confirm your password
              </label>
              <PasswordInput
                id="deletePassword"
                autoComplete="current-password"
                placeholder="Enter your current password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className="mt-1"
              />
            </div>
          ) : (
            <p className="text-sm text-red-700">
              {isDemo
                ? "This clears your local demo data and signs you out."
                : "You'll be asked to confirm with Google before your account is removed."}
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={cancel}
              disabled={deleting}
              className={secondaryBtn}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={disabled}
              className={dangerBtn}
            >
              {deleting ? "Deleting…" : "Delete account"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SoundSection() {
  const { enabled, setEnabled } = useSound();

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    // Preview the sound the instant it's switched on, so the change is audible.
    if (next) playSound("correct");
  };

  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Sound effects</h2>
          <p className="mt-1 text-xs text-slate-500">
            Play short sounds for answers, rewards, and taps.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Sound effects"
          onClick={toggle}
          // Suppress the global tap sound here so toggling off stays silent and
          // toggling on plays only the preview.
          data-no-sound
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
            enabled ? "bg-indigo-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </section>
  );
}

export function SettingsPage() {
  const { user, isDemo } = useAuth();
  const { profile, loading } = useProgress();

  const providerIds = user?.providerData?.map((p) => p.providerId) ?? [];
  const hasPasswordProvider = providerIds.includes("password");
  const isGoogleOnly =
    !isDemo && !hasPasswordProvider && providerIds.includes("google.com");

  const displayName = profile?.displayName ?? user?.displayName ?? "";
  const email = profile?.email ?? user?.email ?? "";

  const emailEditable = isDemo || hasPasswordProvider;
  const emailRequiresPassword = !isDemo && hasPasswordProvider;

  const passwordEnabled = !isDemo && hasPasswordProvider;
  const passwordDisabledNote = isDemo
    ? "Password changes aren't available in demo mode. Run the production build to manage a real password."
    : isGoogleOnly
      ? "You sign in with Google, so your password is managed there."
      : "Password management isn't available for this account.";

  return (
    <SafeArea>
      <AppHeader />
      <main className="flex-1 px-4 py-8 max-w-md mx-auto w-full">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your account and preferences.
        </p>

        {isDemo && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You're in demo mode. Changes are saved locally in this browser only.
          </div>
        )}

        <div className="mt-6 space-y-5">
          <SoundSection />
          {loading ? (
            <p className="text-slate-500">Loading…</p>
          ) : (
            <>
              <DisplayNameSection initialName={displayName} />
              <EmailSection
                initialEmail={email}
                editable={emailEditable}
                requireCurrentPassword={emailRequiresPassword}
                immediate={isDemo}
                readOnlyNote="Your email is managed by your Google account."
              />
              <PasswordSection
                enabled={passwordEnabled}
                disabledNote={passwordDisabledNote}
              />
              <DeleteAccountSection
                requiresPassword={!isDemo && hasPasswordProvider}
                isDemo={isDemo}
              />
            </>
          )}
        </div>
      </main>
    </SafeArea>
  );
}
