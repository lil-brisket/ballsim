import { getSoundSettings } from "@/components/ui/sound/sound-settings";

export type UiSoundName =
  "move" | "select" | "back" | "simStart" | "simDone" | "sting";

type ContextFactory = () => AudioContext | null;

function defaultFactory(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

let factory: ContextFactory = defaultFactory;
let context: AudioContext | null = null;

/** Test seam: replace how the single AudioContext is created. */
export function setAudioContextFactory(next: ContextFactory | null): void {
  factory = next ?? defaultFactory;
  context = null;
}

type Tone = {
  type: OscillatorType;
  /** Start frequency in Hz. */
  from: number;
  /** End frequency (glide); defaults to `from`. */
  to?: number;
  /** Seconds after the sound starts. */
  at: number;
  /** Seconds. */
  duration: number;
  /** Peak gain before master volume. */
  peak: number;
  /** Attack in seconds. */
  attack?: number;
  /** Optional low-pass cutoff in Hz. */
  lowpass?: number;
};

/** Original synthesised cues; each is a handful of short enveloped tones. */
const SOUNDS: Record<UiSoundName, Tone[]> = {
  // Very short soft high tick.
  move: [{ type: "sine", from: 1800, at: 0, duration: 0.03, peak: 0.12 }],
  // Low thunk.
  select: [
    {
      type: "triangle",
      from: 170,
      to: 90,
      at: 0,
      duration: 0.08,
      peak: 0.5,
      lowpass: 900,
    },
  ],
  // Short descending blip.
  back: [
    {
      type: "square",
      from: 620,
      to: 380,
      at: 0,
      duration: 0.09,
      peak: 0.12,
      lowpass: 2400,
    },
  ],
  // Rising two-note.
  simStart: [
    { type: "triangle", from: 392, at: 0, duration: 0.09, peak: 0.28 },
    { type: "triangle", from: 587, at: 0.08, duration: 0.14, peak: 0.28 },
  ],
  // Resolved two-note (fifth down to the tonic).
  simDone: [
    { type: "triangle", from: 659, at: 0, duration: 0.1, peak: 0.28 },
    { type: "triangle", from: 440, at: 0.1, duration: 0.22, peak: 0.3 },
  ],
  // Brassy three-note chord swell (A major) with a slow attack.
  sting: [220, 277.18, 329.63].flatMap((freq): Tone[] => [
    {
      type: "sawtooth",
      from: freq,
      at: 0,
      duration: 0.6,
      peak: 0.16,
      attack: 0.16,
      lowpass: 1500,
    },
    {
      type: "square",
      from: freq * 2,
      at: 0,
      duration: 0.6,
      peak: 0.04,
      attack: 0.16,
      lowpass: 1500,
    },
  ]),
};

function playTone(ctx: AudioContext, tone: Tone, volume: number): void {
  const start = ctx.currentTime + tone.at;
  const end = start + tone.duration;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = tone.type;
  osc.frequency.setValueAtTime(tone.from, start);
  if (tone.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(tone.to, end);
  }
  const peak = Math.max(0.0001, tone.peak * volume);
  const attack = Math.min(tone.attack ?? 0.005, tone.duration / 2);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  let filter: BiquadFilterNode | null = null;
  osc.connect(gain);
  if (tone.lowpass !== undefined) {
    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(tone.lowpass, start);
    gain.connect(filter);
    filter.connect(ctx.destination);
  } else {
    gain.connect(ctx.destination);
  }
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
    filter?.disconnect();
  };
  osc.start(start);
  osc.stop(end + 0.02);
}

/**
 * Play a short synthesised UI cue. Call only from user-initiated handlers (or
 * effects they cause). No-op while sound is off or Web Audio is missing; the
 * AudioContext is created lazily on the first audible call.
 */
export function playUiSound(name: UiSoundName): void {
  const settings = getSoundSettings();
  if (!settings.enabled || settings.volume <= 0) return;
  // Never on page load: wait until the viewer has interacted with this
  // document (client-side navigations keep the flag; a reload resets it).
  if (
    typeof navigator !== "undefined" &&
    navigator.userActivation &&
    !navigator.userActivation.hasBeenActive
  ) {
    return;
  }
  try {
    context ??= factory();
    const ctx = context;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume?.()?.catch?.(() => {});
    for (const tone of SOUNDS[name]) playTone(ctx, tone, settings.volume);
  } catch {
    // Sound is decoration; never let it break an interaction.
  }
}
