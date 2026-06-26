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

/**
 * The app's single iconography source. Every UI icon is a Lucide SVG so the
 * look stays consistent and crisp on every platform — unlike emoji, which each
 * OS renders in its own style. Keys are glyph-oriented (a `flame` is a flame)
 * because the same glyph is reused across features; add new icons here and
 * reference them by name through the `Icon` component.
 *
 * This is plain data (no JSX) so non-UI modules — e.g. `types/content.ts`, which
 * the Node-side lesson validator also compiles — can import {@link IconName}
 * without pulling in a `.tsx` file.
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
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICON_REGISTRY;
