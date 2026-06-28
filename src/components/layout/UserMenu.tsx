import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useProgress } from "../../contexts/ProgressContext";
import { Icon } from "../common/Icon";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4 text-slate-400"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19a7 7 0 0 1 14 0" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4 text-slate-400"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.36 5.64l-2.12 2.12M7.76 16.24l-2.12 2.12M18.36 18.36l-2.12-2.12M7.76 7.76 5.64 5.64"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        d="M15 12H4M4 12l3.5-3.5M4 12l3.5 3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 7V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const itemClass =
  "flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors focus:outline-none";

/**
 * Account dropdown shown in the header for signed-in users. Replaces the old
 * inline name + "Log out" link. Profile, Settings, and Log out are all wired up.
 *
 * On phones the header's primary nav (Lessons / Reference) collapses in here so
 * the row stays narrow enough to keep the avatar on screen; `onOpenReference`
 * lets the relocated "Reference" item open the modal owned by the header.
 */
export function UserMenu({
  onOpenReference,
}: {
  onOpenReference?: () => void;
}) {
  const { user, logout, isDemo } = useAuth();
  const { profile } = useProgress();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const name = profile?.displayName ?? user.displayName ?? user.email ?? "Account";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 min-h-[44px] text-sm text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-semibold"
          aria-hidden
        >
          {initial}
        </span>
        <span className="hidden sm:inline max-w-[10rem] truncate font-medium">
          {name}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5 z-20"
        >
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {name}
              {isDemo && (
                <span className="ml-1 text-xs font-normal text-slate-400">
                  (demo)
                </span>
              )}
            </p>
            {user.email && (
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            )}
          </div>

          {/* Primary nav lives in the header on larger screens; on phones it
              collapses here so the header row stays narrow enough to fit the
              avatar (hidden from sm: up, where the links sit in the header). */}
          <div className="sm:hidden">
            <Link
              to="/lessons"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`${itemClass} text-slate-700 hover:bg-slate-50 focus:bg-slate-50`}
            >
              <Icon name="graduationCap" className="h-4 w-4 text-slate-400" />
              Lessons
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenReference?.();
              }}
              className={`${itemClass} text-slate-700 hover:bg-slate-50 focus:bg-slate-50`}
            >
              <Icon name="bookOpen" className="h-4 w-4 text-slate-400" />
              Reference
            </button>
            <div className="my-1 border-t border-slate-100" />
          </div>

          <Link
            to="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`${itemClass} text-slate-700 hover:bg-slate-50 focus:bg-slate-50`}
          >
            <ProfileIcon />
            Profile
          </Link>
          <Link
            to="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`${itemClass} text-slate-700 hover:bg-slate-50 focus:bg-slate-50`}
          >
            <SettingsIcon />
            Settings
          </Link>

          <div className="my-1 border-t border-slate-100" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
            className={`${itemClass} text-rose-600 hover:bg-rose-50 focus:bg-rose-50`}
          >
            <LogoutIcon />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
