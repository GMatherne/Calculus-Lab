import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { StreakBadge } from "../habit/StreakBadge";
import { XpBadge } from "../habit/XpBadge";
import { UserMenu } from "./UserMenu";

export function AppHeader() {
  const { user } = useAuth();

  return (
    <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-10 safe-top">
      <Link
        to="/"
        className="shrink-0 whitespace-nowrap font-bold text-indigo-700 text-lg"
      >
        Calculus Lab
      </Link>
      <nav className="flex items-center gap-1.5 text-sm sm:gap-3">
        <Link
          to="/lessons"
          className="flex min-h-[44px] items-center text-slate-600 hover:text-indigo-600"
        >
          Lessons
        </Link>
        {user ? (
          <>
            <StreakBadge />
            <XpBadge />
            <UserMenu />
          </>
        ) : (
          <Link to="/login" className="text-indigo-600 font-medium min-h-[44px] flex items-center">
            Log in
          </Link>
        )}
      </nav>
    </header>
  );
}
