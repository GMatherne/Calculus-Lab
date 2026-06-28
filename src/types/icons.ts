/**
 * The vocabulary of icon names the app can render. Kept as a plain string union
 * in the types layer so domain modules — e.g. {@link MilestoneDef} in
 * `content.ts`, which the Node-side lesson validator also compiles — can refer to
 * an icon by name without depending "up" on the UI. The actual name → Lucide
 * glyph registry lives in `components/common/icons.ts` and is checked against this
 * union with `satisfies Record<IconName, LucideIcon>`, so the two can't drift.
 */
export type IconName =
  | "flame"
  | "zap"
  | "sparkle"
  | "celebrate"
  | "thumbsUp"
  | "dumbbell"
  | "lightbulb"
  | "wrench"
  | "target"
  | "sliders"
  | "trophy"
  | "lock"
  | "check"
  | "star"
  | "pieChart"
  | "bookOpen"
  | "medal"
  | "sprout"
  | "calendarCheck"
  | "graduationCap"
  | "penLine"
  | "library"
  | "brain"
  | "crown"
  | "gem";
