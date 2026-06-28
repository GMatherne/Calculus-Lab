/**
 * A tiny Web Audio sound engine. Every effect is synthesized from oscillators at
 * call time, so the app ships no audio assets and the sounds stay tunable. The
 * single shared {@link AudioContext} is created lazily (never at module load) so
 * importing this file is safe in tests and any non-browser environment.
 *
 * Playback is gated by a module-level `enabled` flag kept in sync with the
 * learner's persisted preference by the SoundProvider; `playSound` is a no-op
 * when sound is off or the Web Audio API is unavailable.
 */

export type SoundName =
  | "tap"
  | "correct"
  | "incorrect"
  | "hint"
  | "complete"
  | "perfect"
  | "pass"
  | "fail"
  | "xp"
  | "streak"
  | "milestone";

// Note frequencies (Hz) used to compose the little melodies below.
const A4 = 440.0;
const F4 = 349.23;
const G4 = 392.0;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;
const B5 = 987.77;
const C6 = 1046.5;
const E6 = 1318.51;
const G6 = 1567.98;

/** Overall output level. A peak limiter (see {@link getCtx}) keeps stacked
 *  notes from distorting, so this can sit high enough to be clearly audible. */
const MASTER_VOLUME = 0.75;

let enabled = true;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
// Timestamp (in AudioContext time) of the last tap, to throttle rapid clicks.
let lastTapAt = -1;

function supported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return typeof (w.AudioContext ?? w.webkitAudioContext) === "function";
}

/** The shared context + master gain, created on first use. Null if unsupported. */
function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  if (!supported()) return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    // A gentle limiter on the output: lets the master sit loud while taming the
    // brief peaks when fanfare notes overlap, so nothing clips into distortion.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    master.connect(limiter);
    limiter.connect(ctx.destination);
  } catch {
    ctx = null;
    master = null;
  }
  return ctx;
}

interface NoteOpts {
  freq: number;
  type?: OscillatorType;
  /** Delay before the note starts, in seconds. */
  at?: number;
  /** How long the note rings, in seconds. */
  duration?: number;
  /** Peak gain (0..1) applied on top of the master volume. */
  gain?: number;
  /** When set, the pitch glides from `freq` to this frequency over `duration`. */
  glideTo?: number;
}

/** Schedule one oscillator note with a quick attack and smooth decay. */
function note(c: AudioContext, dest: AudioNode, o: NoteOpts): void {
  const start = c.currentTime + (o.at ?? 0);
  const dur = o.duration ?? 0.15;
  const peak = o.gain ?? 0.6;

  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, start);
  if (o.glideTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.glideTo), start + dur);
  }

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.connect(g);
  g.connect(dest);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

/** Play an ascending run of notes, holding (and optionally lengthening) the last. */
function arpeggio(
  c: AudioContext,
  dest: AudioNode,
  freqs: number[],
  step: number,
  gain: number,
  tailDuration: number,
): void {
  freqs.forEach((f, i) =>
    note(c, dest, {
      freq: f,
      type: "triangle",
      at: i * step,
      duration: i === freqs.length - 1 ? tailDuration : step + 0.05,
      gain,
    }),
  );
}

type Effect = (c: AudioContext, dest: AudioNode) => void;

const EFFECTS: Record<SoundName, Effect> = {
  // A soft, short blip for UI taps.
  tap: (c, d) => note(c, d, { freq: 520, type: "triangle", duration: 0.05, gain: 0.26 }),

  // A bright two-note rise that reads as "yes".
  correct: (c, d) => {
    note(c, d, { freq: E5, type: "triangle", duration: 0.12, gain: 0.5 });
    note(c, d, { freq: A5, type: "triangle", at: 0.09, duration: 0.16, gain: 0.55 });
  },

  // A gentle low two-note dip — discouraging but not punishing, matching the
  // app's encouraging "not quite" tone rather than a harsh error buzz.
  incorrect: (c, d) => {
    note(c, d, { freq: 311.13, type: "sine", duration: 0.16, gain: 0.45 });
    note(c, d, { freq: 233.08, type: "sine", at: 0.12, duration: 0.22, gain: 0.4 });
  },

  // A single bell-like ding with a quiet octave shimmer.
  hint: (c, d) => {
    note(c, d, { freq: C6, type: "sine", duration: 0.3, gain: 0.4 });
    note(c, d, { freq: G6, type: "sine", duration: 0.3, gain: 0.14 });
  },

  // A four-note major arpeggio: the lesson-finished fanfare.
  complete: (c, d) => {
    arpeggio(c, d, [C5, E5, G5, C6], 0.11, 0.5, 0.42);
    note(c, d, { freq: E6, type: "sine", at: 0.33, duration: 0.42, gain: 0.18 });
  },

  // A longer, brighter run for a flawless result.
  perfect: (c, d) => {
    arpeggio(c, d, [C5, E5, G5, C6, E6, G6], 0.08, 0.5, 0.5);
    note(c, d, { freq: C6, type: "sine", at: 0.4, duration: 0.5, gain: 0.2 });
  },

  // A short positive cadence for a passing (but not perfect) result.
  pass: (c, d) => arpeggio(c, d, [C5, E5, G5], 0.1, 0.48, 0.3),

  // Two soft, neutral notes — reassuring, never a "wrong answer" sting.
  fail: (c, d) => {
    note(c, d, { freq: A4, type: "sine", duration: 0.18, gain: 0.34 });
    note(c, d, { freq: F4, type: "sine", at: 0.14, duration: 0.26, gain: 0.3 });
  },

  // A quick coin-style blip for earning XP.
  xp: (c, d) => {
    note(c, d, { freq: B5, type: "square", duration: 0.06, gain: 0.2 });
    note(c, d, { freq: E6, type: "square", at: 0.07, duration: 0.14, gain: 0.22 });
  },

  // A warm rising whoosh for extending the daily streak.
  streak: (c, d) => {
    note(c, d, { freq: G4, type: "triangle", duration: 0.12, gain: 0.4, glideTo: C5 });
    note(c, d, { freq: C5, type: "triangle", at: 0.1, duration: 0.18, gain: 0.42, glideTo: E5 });
    note(c, d, { freq: E5, type: "triangle", at: 0.22, duration: 0.24, gain: 0.4, glideTo: G5 });
  },

  // The most celebratory cue, played when a new achievement unlocks.
  milestone: (c, d) => {
    arpeggio(c, d, [C5, E5, G5, C6, E6], 0.09, 0.5, 0.55);
    note(c, d, { freq: G6, type: "sine", at: 0.36, duration: 0.55, gain: 0.22 });
  },
};

/** Toggle whether sounds play. Kept in sync with the learner's preference. */
export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

/**
 * Resume the shared AudioContext, creating it if needed. Browsers start audio
 * suspended until a user gesture, so the SoundProvider calls this on the first
 * pointer/key interaction.
 */
export function resumeAudio(): void {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
}

/**
 * Play a named effect. No-ops when sound is disabled or unsupported. Taps are
 * throttled so a flurry of clicks can't stack into a buzz.
 */
export function playSound(name: SoundName): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c || !master) return;
  if (c.state === "suspended") void c.resume();

  if (name === "tap") {
    if (c.currentTime - lastTapAt < 0.06) return;
    lastTapAt = c.currentTime;
  }

  EFFECTS[name](c, master);
}
