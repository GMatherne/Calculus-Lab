import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { XpBadge } from "../habit/XpBadge";
import { UserMenu } from "./UserMenu";

export function AppHeader() {
  const { user } = useAuth();

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-10 safe-top">
      <Link to="/" className="font-bold text-indigo-700 text-lg">
        d/dx
      </Link>
      <nav className="flex items-center gap-3 text-sm">
        <Link to="/lessons" className="text-slate-600 hover:text-indigo-600 min-h-[44px] flex items-center">
          Lessons
        </Link>
        {user ? (
          <>
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
