import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  sessionMisses,
  tallyAnswer,
  type SessionMiss,
  type SessionTally,
} from "../lib/learnerInsights";
import { conceptLabel } from "../lib/masteryService";
import { SessionInsightsContext } from "./SessionInsightsContext";

export function SessionInsightsProvider({ children }: { children: ReactNode }) {
  const [tally, setTally] = useState<SessionTally>({});

  // Mirror the committed tally in a ref so getSessionMisses can read the latest
  // value imperatively (it's called when the learner opens the tutor) while the
  // context value itself stays referentially stable.
  const tallyRef = useRef<SessionTally>(tally);
  useEffect(() => {
    tallyRef.current = tally;
  }, [tally]);

  const recordAnswer = useCallback(
    (conceptTag: string | undefined, isCorrect: boolean) => {
      if (!conceptTag) return;
      setTally((prev) =>
        tallyAnswer(prev, conceptTag, conceptLabel(conceptTag), isCorrect),
      );
    },
    [],
  );

  const getSessionMisses = useCallback(
    (): SessionMiss[] => sessionMisses(tallyRef.current),
    [],
  );

  const value = useMemo(
    () => ({ recordAnswer, getSessionMisses }),
    [recordAnswer, getSessionMisses],
  );

  return (
    <SessionInsightsContext.Provider value={value}>
      {children}
    </SessionInsightsContext.Provider>
  );
}
