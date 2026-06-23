import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { SafeArea } from "../layout/SafeArea";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <SafeArea>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-slate-500">Loading…</p>
        </main>
      </SafeArea>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
