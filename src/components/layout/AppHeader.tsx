import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { StreakBadge } from "../habit/StreakBadge";
import { XpBadge } from "../habit/XpBadge";
import { UserMenu } from "./UserMenu";
import { ReferenceModal } from "../reference/ReferenceModal";

export function AppHeader() {
  const { user } = useAuth();
  // Reference opens as a popup so it never pulls a learner out of a lesson or
  // practice session — the sticky header keeps it one tap away from anywhere.
  const [referenceOpen, setReferenceOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between gap-1.5 px-3 py-3 border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-10 safe-top sm:gap-2 sm:px-4">
        <Link
          to="/"
          className="shrink-0 whitespace-nowrap font-bold text-indigo-700 text-lg"
        >
          Calculus Lab
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-3">
          {/* On phones these collapse into the account menu (rendered by
              UserMenu) so the header — including the profile button — fits
              without horizontal scrolling. They stay in the row for signed-out
              visitors, who have no account menu to hold them. */}
          <Link
            to="/lessons"
            className={`${user ? "hidden sm:flex" : "flex"} min-h-[44px] items-center text-slate-600 hover:text-indigo-600`}
          >
            Lessons
          </Link>
          <button
            type="button"
            onClick={() => setReferenceOpen(true)}
            className={`${user ? "hidden sm:flex" : "flex"} min-h-[44px] items-center text-slate-600 hover:text-indigo-600`}
          >
            Reference
          </button>
          {user ? (
            <>
              <StreakBadge />
              <XpBadge />
              <UserMenu onOpenReference={() => setReferenceOpen(true)} />
            </>
          ) : (
            <Link to="/login" className="text-indigo-600 font-medium min-h-[44px] flex items-center">
              Log in
            </Link>
          )}
        </nav>
      </header>
      <ReferenceModal open={referenceOpen} onClose={() => setReferenceOpen(false)} />
    </>
  );
}
