import {
  Flame,
  Zap,
  Sparkle,
  PartyPopper,
  ThumbsUp,
  Dumbbell,
  Lightbulb,
  Wrench,
  Target,
  SlidersHorizontal,
  Trophy,
  Lock,
  Check,
  Star,
  PieChart,
  BookOpen,
  Medal,
  Sprout,
  CalendarCheck,
  GraduationCap,
  PenLine,
  Library,
  Brain,
  Crown,
  Gem,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "../../types/icons";

/**
 * The app's single iconography source. Every UI icon is a Lucide SVG so the
 * look stays consistent and crisp on every platform — unlike emoji, which each
 * OS renders in its own style. Keys are glyph-oriented (a `flame` is a flame)
 * because the same glyph is reused across features; add new icons here and
 * reference them by name through the `Icon` component.
 *
 * This is plain data (no JSX), and the names it maps are typed by {@link IconName}
 * (declared in `types/icons.ts`) so non-UI modules can reference icons by name
 * without depending on this UI module. The `satisfies` below keeps the registry
 * and the name union in lockstep.
 */
export const ICON_REGISTRY = {
  flame: Flame,
  zap: Zap,
  sparkle: Sparkle,
  celebrate: PartyPopper,
  thumbsUp: ThumbsUp,
  dumbbell: Dumbbell,
  lightbulb: Lightbulb,
  wrench: Wrench,
  target: Target,
  sliders: SlidersHorizontal,
  trophy: Trophy,
  lock: Lock,
  check: Check,
  star: Star,
  pieChart: PieChart,
  bookOpen: BookOpen,
  medal: Medal,
  sprout: Sprout,
  calendarCheck: CalendarCheck,
  graduationCap: GraduationCap,
  penLine: PenLine,
  library: Library,
  brain: Brain,
  crown: Crown,
  gem: Gem,
} satisfies Record<IconName, LucideIcon>;

// Re-exported so existing UI importers (`Icon`, `AssistanceToggle`, …) can keep
// importing the type from here; the source of truth is `types/icons.ts`.
export type { IconName };
