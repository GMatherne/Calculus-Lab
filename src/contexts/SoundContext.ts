import { createContext, useContext } from "react";

interface SoundContextValue {
  /** Whether sound effects are currently enabled for this learner. */
  enabled: boolean;
  /** Turn sound effects on or off (persisted to localStorage). */
  setEnabled: (enabled: boolean) => void;
}

export const SoundContext = createContext<SoundContextValue | null>(null);

export function useSound(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error("useSound must be used within SoundProvider");
  return ctx;
}
