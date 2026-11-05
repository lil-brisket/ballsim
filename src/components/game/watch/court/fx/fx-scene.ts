/**
 * Pixi renderer for the broadcast effects layer. Everything tied to a play is
 * a function of that play's progress, read each frame from the court's running
 * animations through `getClock`: the ticker only schedules redraws, so pausing
 * or changing speed needs nothing here. Three things outlive a play and use
 * `advance`'s local time instead, all of it frozen unless the replay is moving:
 * an effect finishing after its play ends, run embers, and the final buzzer.
 */
import {
  Application,
  CanvasSource,
  Container,
  Graphics,
  PerspectiveMesh,
  Rectangle,
  Sprite,
  Texture,
} from "pixi.js";
import {
  ballHeightAt,
  ballSampler,
  smoothTrack,
  type BallSample,
} from "@/components/game/watch/court/court-motion";
import {
  RIM_HEIGHT_FT,
  TILT_RAISE,
  TILT_SQUASH,
  tiltPoint,
} from "@/components/game/watch/court/court-tilt";
import type { PlayerId } from "@/domain/ids";
import type { PlayChoreography } from "@/state/watch-court-choreo";
import { COURT_RIM } from "@/state/watch-court-frame";
import {
  toFullCourt,
  type FullCourtFrame,
  type FullCourtPoint,
} from "@/state/watch-full-court";
import { FULL_COURT_FEET } from "@/state/watch-full-court";
import type { WatchSide } from "@/state/watch-game-view";
import { AthleteFigure, type AthleteLook } from "./athlete-figure";
import { FX_BLEED_PX, FX_OVER_BLEED_PX } from "./court-fx-preference";
import { floorFinishCanvas } from "./floor-texture";
import { athletePose, jumpTimeFor, type AthletePose } from "./fx-athlete";
import {
  ballHolderAt,
  cueProgress,
  fxUnit,
  legAt,
  runLevel,
  type CourtFxCelebration,
  type CourtFxCue,
} from "./fx-events";
import { FX_TIERS } from "./fx-intensity";

export type CourtFxSceneInput = {
  frame: FullCourtFrame;
  choreography: PlayChoreography | null;
  cues: CourtFxCue[];
  motionMs: number;
  speed: number;
  playing: boolean;
  run: { side: WatchSide; points: number } | null;
  /** A period break is on screen. */
  dimmed: boolean;
  /** Set once the game is over. */
  celebration: CourtFxCelebration | null;
  colors: readonly [string, string];
  seed: number;
  /** Players drawn as athletes rather than discs. */
  athletes?: (AthleteLook & { playerId: PlayerId })[];
  /** Where the court seats a point (bench seats move with the layout). */
  place?: (point: FullCourtPoint) => FullCourtPoint;
  /** The tilted broadcast camera rather than straight overhead. */
  tilted?: boolean;
};

/** The two canvases: one under the player tokens and one over them. */
export type CourtFxHosts = { under: HTMLElement; over: HTMLElement };

/** Longest a device pixel ratio is honoured, to bound the canvas's memory. */
const MAX_RESOLUTION = 2;
/** Longest step one frame may take, so a stall never jumps the decay. */
const MAX_STEP_MS = 100;
/** Shortest an effect stays on screen, however fast playback runs. */
const MIN_EFFECT_MS = 450;

const SHADOW_POOL = 14;
const TRAIL_POINTS = 18;
const TRAIL_MS = 320;
/** Below this many px between trail samples the ball isn't really travelling. */
const TRAIL_MIN_STEP_PX = 0.6;
const IMPACT_POOL = 220;
const EMBER_COUNT = 40;
const CONFETTI_POOL = 120;

const TOKEN_PX = 32;
const SHOT_LIFT_PX = 18;
const RUN_EASE_MS = 900;
const DIM_EASE_MS = 350;
const DIM_ALPHA = 0.24;
const CELEBRATION_MS = 4600;
const SWEEP_MS = 1500;

const WHITE = 0xffffff;
const BLACK = 0x000000;
const WARM = 0xffd9a0;

type AtlasFrames = {
  dot: Texture;
  ring: Texture;
  streak: Texture;
  chip: Texture;
};

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** One small sheet holds every particle shape, so they all batch together. */
function particleAtlas(): AtlasFrames | null {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  const dot = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  dot.addColorStop(0, "rgb(255 255 255 / 1)");
  dot.addColorStop(0.45, "rgb(255 255 255 / 0.45)");
  dot.addColorStop(1, "rgb(255 255 255 / 0)");
  ctx.fillStyle = dot;
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(160, 32, 28, 0, Math.PI * 2);
  ctx.stroke();

  const streak = ctx.createLinearGradient(128, 0, 192, 0);
  streak.addColorStop(0, "rgb(255 255 255 / 0)");
  streak.addColorStop(0.7, "rgb(255 255 255 / 0.8)");
  streak.addColorStop(1, "rgb(255 255 255 / 1)");
  ctx.fillStyle = streak;
  ctx.fillRect(128, 72, 64, 8);

  ctx.fillStyle = "white";
  ctx.fillRect(200, 72, 16, 16);

  const source = new CanvasSource({ resource: canvas });
  const frame = (x: number, y: number, w: number, h: number) =>
    new Texture({ source, frame: new Rectangle(x, y, w, h) });
  return {
    dot: frame(0, 0, 128, 128),
    ring: frame(128, 0, 64, 64),
    streak: frame(128, 72, 64, 8),
    chip: frame(200, 72, 16, 16),
  };
}

function makePool(parent: Container, size: number, texture: Texture): Sprite[] {
  return Array.from({ length: size }, () => {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.visible = false;
    parent.addChild(sprite);
    return sprite;
  });
}

/** Sprite from a pool, reset for this frame; null once the cap is reached. */
class Pool {
  private used = 0;
  constructor(private readonly sprites: Sprite[]) {}

  get active(): boolean {
    return this.used > 0;
  }

  begin() {
    this.used = 0;
  }

  take(texture?: Texture): Sprite | null {
    const sprite = this.sprites[this.used];
    if (!sprite) {
      return null;
    }
    this.used += 1;
    if (texture) {
      sprite.texture = texture;
    }
    sprite.rotation = 0;
    sprite.visible = true;
    return sprite;
  }

  /** Hides whatever this frame did not use. */
  end() {
    for (let i = this.used; i < this.sprites.length; i += 1) {
      this.sprites[i]!.visible = false;
    }
  }
}

type PlayState = {
  choreography: PlayChoreography;
  cues: CourtFxCue[];
  motionMs: number;
  /** Play time of the current frame; runs past 1 for effects still finishing. */
  p: number;
  ball: (p: number) => BallSample;
  /** The ball's real height in feet, for the tilted camera. */
  ballHeight: (p: number) => number;
  tracks: {
    playerId: PlayerId;
    side: WatchSide;
    at: (p: number) => FullCourtPoint;
  }[];
};

type Carried = { cues: CourtFxCue[]; motionMs: number; p: number };

/** How high off the floor each effect happens, under the tilted camera. */
const AIR_FT: Record<CourtFxCue["kind"], number> = {
  arena_pulse: 0,
  floor_wash: 0,
  rim_flash: RIM_HEIGHT_FT,
  net_ripple: RIM_HEIGHT_FT - 1,
  light_burst: RIM_HEIGHT_FT,
  accent_ring: RIM_HEIGHT_FT,
  rim_spark: RIM_HEIGHT_FT,
  impact_ring: 8,
  steal_flick: 4,
};

/** An app that only draws when told to, on a see-through canvas. */
async function startApp(
  host: HTMLElement,
  size: { width: number; height: number },
  antialias: boolean,
): Promise<Application> {
  const app = new Application();
  await app.init({
    width: size.width,
    height: size.height,
    backgroundAlpha: 0,
    antialias,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION),
    preference: "webgl",
    autoStart: false,
    sharedTicker: false,
  });
  app.canvas.style.position = "absolute";
  app.canvas.style.inset = "0";
  app.canvas.style.width = "100%";
  app.canvas.style.height = "100%";
  host.appendChild(app.canvas);
  return app;
}

export class CourtFxScene {
  private readonly shadows: Pool;
  private readonly trail: Pool;
  private readonly impacts: Pool;
  private readonly embers: Pool;
  private readonly confetti: Pool;
  private readonly glow: Sprite;
  private readonly ballShadow: Sprite;
  private readonly dim: Graphics;
  private readonly wash: Graphics;
  private readonly impactMask: Graphics;
  private readonly floorGlows: Pool;
  private readonly sweep: Sprite;
  private readonly floor: PerspectiveMesh | null;
  private readonly athleteLayer: Container;
  private readonly figures = new Map<PlayerId, AthleteFigure>();
  private figureKey = "";
  private overShowing = false;

  private input: CourtFxSceneInput | null = null;
  private play: PlayState | null = null;
  private carried: Carried[] = [];
  private width: number;
  private height: number;

  private emberMs = 0;
  private emberLevel = 0;
  private emberSide: WatchSide = 0;
  private dimLevel = 0;
  private celebration: CourtFxCelebration | null = null;
  private celebrationMs = 0;
  private destroyed = false;

  private readonly onTick = () => {
    this.advance(Math.min(this.under.ticker.deltaMS, MAX_STEP_MS));
    // The under app renders on this same tick, after this listener.
    this.update();
    this.renderOver();
    if (!this.animating()) {
      this.under.ticker.stop();
    }
  };

  private readonly onVisibility = () => this.schedule();

  /** Null when no renderer can start; the replay simply runs without effects. */
  static async create(
    hosts: CourtFxHosts,
    size: { width: number; height: number },
    getClock: (play: PlayChoreography) => number | null,
  ): Promise<CourtFxScene | null> {
    // The players need smooth edges; the soft particles over them don't.
    const under = await startApp(
      hosts.under,
      { width: size.width, height: size.height + FX_BLEED_PX * 2 },
      true,
    );
    // Floor coordinates stay the same; the extra canvas is just past the lines.
    under.stage.position.y = FX_BLEED_PX;
    let over: Application;
    try {
      over = await startApp(
        hosts.over,
        {
          width: size.width + FX_OVER_BLEED_PX * 2,
          height: size.height + FX_OVER_BLEED_PX * 2,
        },
        false,
      );
      over.stage.position.set(FX_OVER_BLEED_PX, FX_OVER_BLEED_PX);
    } catch (error) {
      under.destroy({ removeView: true });
      throw error;
    }
    // Each canvas has its own GPU context, so each needs its own textures.
    const underAtlas = particleAtlas();
    const overAtlas = particleAtlas();
    if (!underAtlas || !overAtlas) {
      under.destroy({ removeView: true });
      over.destroy({ removeView: true });
      return null;
    }
    return new CourtFxScene(under, over, underAtlas, overAtlas, size, getClock);
  }

  private constructor(
    private readonly under: Application,
    private readonly over: Application,
    underAtlas: AtlasFrames,
    private readonly atlas: AtlasFrames,
    size: { width: number; height: number },
    private readonly getClock: (play: PlayChoreography) => number | null,
  ) {
    this.width = size.width;
    this.height = size.height;

    const underLayer = () => under.stage.addChild(new Container());
    const floorLayer = underLayer();
    const shadowLayer = underLayer();
    this.athleteLayer = underLayer();
    // Nearer players stand in front of farther ones.
    this.athleteLayer.sortableChildren = true;
    const ballShadowLayer = underLayer();
    const dimLayer = underLayer();

    const overLayer = () => over.stage.addChild(new Container());
    const ambientLayer = overLayer();
    const floorImpactLayer = overLayer();
    const impactLayer = overLayer();
    const trailLayer = overLayer();
    const broadcastLayer = overLayer();

    const finish = floorFinishCanvas();
    this.floor = finish
      ? new PerspectiveMesh({
          texture: new Texture({
            source: new CanvasSource({ resource: finish }),
          }),
          verticesX: 16,
          verticesY: 16,
        })
      : null;
    if (this.floor) {
      floorLayer.addChild(this.floor);
    }

    this.shadows = new Pool(makePool(shadowLayer, SHADOW_POOL, underAtlas.dot));
    this.glow = makePool(shadowLayer, 1, underAtlas.dot)[0]!;
    this.ballShadow = makePool(ballShadowLayer, 1, underAtlas.dot)[0]!;
    this.dim = dimLayer.addChild(new Graphics());
    this.dim.tint = BLACK;
    // A dark halo under each bright point keeps them readable on light wood.
    this.trail = new Pool(makePool(trailLayer, TRAIL_POINTS * 2, atlas.dot));
    this.embers = new Pool(makePool(ambientLayer, EMBER_COUNT * 2, atlas.dot));
    // Light on the floor stops at its edge, whatever shape the camera gives it.
    this.impactMask = over.stage.addChild(new Graphics());
    floorImpactLayer.mask = this.impactMask;
    this.wash = floorImpactLayer.addChild(new Graphics());
    this.floorGlows = new Pool(makePool(floorImpactLayer, 8, atlas.dot));
    this.wash.visible = false;
    this.impacts = new Pool(makePool(impactLayer, IMPACT_POOL, atlas.dot));
    this.sweep = makePool(broadcastLayer, 1, atlas.dot)[0]!;
    this.confetti = new Pool(
      makePool(broadcastLayer, CONFETTI_POOL, atlas.chip),
    );

    this.layout();
    under.ticker.add(this.onTick);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  setSize(width: number, height: number) {
    if (this.destroyed || (width === this.width && height === this.height)) {
      return;
    }
    this.width = width;
    this.height = height;
    this.under.renderer.resize(width, height + FX_BLEED_PX * 2);
    this.over.renderer.resize(
      width + FX_OVER_BLEED_PX * 2,
      height + FX_OVER_BLEED_PX * 2,
    );
    this.layout();
    this.draw();
  }

  /** Takes the latest court state; only a new choreography changes the play. */
  sync(input: CourtFxSceneInput) {
    if (this.destroyed) {
      return;
    }
    const previous = this.input;
    this.input = input;
    if (previous?.tilted !== input.tilted) {
      this.layout();
    }
    if (!previous || previous.choreography !== input.choreography) {
      this.startPlay(input);
    }
    // Only a game that ends on screen celebrates, not a skip to the end or
    // turning effects on after it.
    if (
      previous &&
      !previous.celebration &&
      input.celebration &&
      input.choreography
    ) {
      this.celebration = input.celebration;
      this.celebrationMs = 0;
    } else if (!input.celebration) {
      this.celebration = null;
    }
    if (input.run) {
      this.emberSide = input.run.side;
    }
    // No time passes here; it picks up where the court's animations are now,
    // which matters when paused and the ticker isn't running.
    this.advance(0);
    this.draw();
    this.schedule();
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.under.ticker.remove(this.onTick);
    for (const app of [this.under, this.over]) {
      app.destroy(
        { removeView: true },
        { children: true, texture: true, textureSource: true },
      );
    }
  }

  private startPlay(input: CourtFxSceneInput) {
    const prior = this.play;
    const { choreography } = input;
    if (!choreography) {
      // A jump: nothing transient survives it.
      this.carried = [];
      this.play = null;
      this.emberLevel = 0;
      this.dimLevel = 0;
      this.celebration = null;
      return;
    }
    if (prior) {
      // A burst from the last play finishes its fade rather than vanishing.
      const minSpan = this.minSpan(prior.motionMs);
      const showing = prior.cues.filter(
        (cue) => cueProgress(cue, prior.p, minSpan) !== null,
      );
      if (showing.length > 0) {
        this.carried.push({
          cues: showing,
          motionMs: prior.motionMs,
          p: prior.p,
        });
      }
    }
    this.play = {
      choreography,
      cues: input.cues,
      motionMs: input.motionMs,
      p: 0,
      ball: ballSampler(choreography),
      ballHeight: ballHeightAt(
        choreography,
        input.frame.lastPlay?.outcome === "made",
      ),
      tracks: choreography.tracks.map((track) => ({
        playerId: track.playerId,
        side: track.side,
        at: smoothTrack(
          choreography.beats,
          track.points,
          choreography.deadBall,
        ),
      })),
    };
  }

  /** Play time an effect must span to last `MIN_EFFECT_MS` at this speed. */
  private minSpan(motionMs: number): number {
    return motionMs > 0
      ? (MIN_EFFECT_MS * (this.input?.speed ?? 1)) / motionMs
      : 0;
  }

  private moving(): boolean {
    return (
      this.input !== null &&
      (this.input.playing ||
        (this.celebration !== null && this.celebrationMs < CELEBRATION_MS))
    );
  }

  private animating(): boolean {
    return !document.hidden && this.moving();
  }

  private schedule() {
    if (this.animating()) {
      this.under.ticker.start();
    } else {
      this.under.ticker.stop();
    }
  }

  private advance(deltaMs: number) {
    const input = this.input;
    if (!input) {
      return;
    }
    const moving = this.moving();
    const dt = moving ? deltaMs * input.speed : 0;
    const play = this.play;
    if (play) {
      const clock = this.getClock(play.choreography);
      if (this.celebration) {
        // The court's animations stop with playback at the final whistle, so
        // the last play's effects finish on local time.
        play.p = Math.max(play.p, clock ?? 0) + dt / play.motionMs;
      } else if (clock !== null && clock < 1) {
        play.p = clock;
      } else if (clock === 1) {
        play.p = Math.max(play.p, 1) + dt / play.motionMs;
      }
    }
    this.carried = this.carried.filter((group) => {
      group.p += dt / group.motionMs;
      const minSpan = this.minSpan(group.motionMs);
      group.cues = group.cues.filter(
        (cue) => cueProgress(cue, group.p, minSpan) !== null,
      );
      return group.cues.length > 0;
    });
    const target = play && input.run ? runLevel(input.run.points) : 0;
    this.emberMs += dt;
    this.emberLevel +=
      (target - this.emberLevel) * (1 - Math.exp(-dt / RUN_EASE_MS));
    const dimTarget = play && input.dimmed ? 1 : 0;
    this.dimLevel +=
      (dimTarget - this.dimLevel) * (1 - Math.exp(-dt / DIM_EASE_MS));
    if (this.celebration) {
      this.celebrationMs += deltaMs;
    }
  }

  /** A floor point on screen in px, with its size at that depth. */
  private screen(point: FullCourtPoint) {
    const placed = this.input?.tilted
      ? tiltPoint(point)
      : { x: point.x, y: point.y, scale: 1 };
    return {
      x: placed.x * this.width,
      y: placed.y * this.height,
      scale: placed.scale,
    };
  }

  /** Screen px for one foot of height at a depth. */
  private raisePx(scale: number): number {
    return this.input?.tilted
      ? (this.width / FULL_COURT_FEET.length) * TILT_RAISE * scale
      : 0;
  }

  /** How much something lying on the floor flattens under this camera. */
  private squash(): number {
    return this.input?.tilted ? TILT_SQUASH : 1;
  }

  private layout() {
    const corners = [
      this.screen({ x: 0, y: 0 }),
      this.screen({ x: 1, y: 0 }),
      this.screen({ x: 1, y: 1 }),
      this.screen({ x: 0, y: 1 }),
    ] as const;
    const [a, b, c, d] = corners;
    this.floor?.setCorners(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y);
    const outline = corners.flatMap((corner) => [corner.x, corner.y]);
    for (const shape of [this.dim, this.wash, this.impactMask]) {
      shape.clear().poly(outline).fill(WHITE);
    }
  }

  /** Redraws now, for a change that arrives while the ticker may be stopped. */
  private draw() {
    this.update();
    this.under.render();
    this.renderOver();
  }

  /** The canvas over the players is usually empty; it costs nothing then. */
  private renderOver() {
    const showing =
      this.trail.active ||
      this.embers.active ||
      this.impacts.active ||
      this.floorGlows.active ||
      this.confetti.active ||
      this.wash.visible ||
      this.sweep.visible;
    if (showing || this.overShowing) {
      this.over.render();
    }
    this.overShowing = showing;
  }

  private update() {
    const input = this.input;
    if (!input || this.destroyed) {
      return;
    }
    this.drawPlayers(input);
    this.drawAthletes(input);
    this.drawBall(input);
    this.drawImpacts(input);
    this.drawEmbers(input);
    this.dim.visible = this.dimLevel > 0.01;
    this.dim.alpha = this.dimLevel * DIM_ALPHA;
    this.drawCelebration(input);
  }

  private drawPlayers(input: CourtFxSceneInput) {
    const { play } = this;
    const p = play ? Math.min(1, play.p) : 1;
    const holder = play
      ? ballHolderAt(play.choreography, p)
      : {
          holderId: input.frame.ball.holderId,
          shooting: false,
        };
    const placed = play
      ? play.tracks.map((track) => ({
          playerId: track.playerId,
          side: track.side,
          at: track.at(p),
        }))
      : input.frame.players.map((player) => ({
          playerId: player.playerId,
          side: player.side,
          at: player.spot,
        }));

    const athleteIds = new Set(
      (input.athletes ?? []).map((look) => look.playerId),
    );
    const placeOf = input.place ?? ((point: FullCourtPoint) => point);
    this.shadows.begin();
    this.glow.visible = false;
    for (const player of placed) {
      if (player.at.y < 0 && !athleteIds.has(player.playerId)) {
        continue;
      }
      const { x, y, scale } = this.screen(placeOf(player.at));
      const shadow = this.shadows.take();
      if (shadow) {
        shadow.tint = BLACK;
        shadow.alpha = 0.3;
        shadow.position.set(x + 1, y + 5 * scale);
        const isAthlete = athleteIds.has(player.playerId);
        shadow.width = (isAthlete ? 26 : TOKEN_PX * 1.9) * scale;
        shadow.height =
          (isAthlete ? 20 : TOKEN_PX * 1.5) * scale * this.squash();
      }
      if (player.playerId === holder.holderId) {
        this.glow.visible = true;
        this.glow.tint = input.colors[player.side];
        this.glow.alpha = holder.shooting ? 0.9 : 0.6;
        this.glow.position.set(x, y);
        const size = TOKEN_PX * (holder.shooting ? 3.6 : 2.8) * scale;
        this.glow.width = size;
        this.glow.height = size * this.squash();
      }
    }
    this.shadows.end();
  }

  private drawAthletes(input: CourtFxSceneInput) {
    const looks = input.athletes ?? [];
    const key = looks
      .map((look) => [look.playerId, look.jersey, look.number].join("|"))
      .join(";");
    if (key !== this.figureKey) {
      for (const figure of this.figures.values()) {
        figure.destroy();
      }
      this.figures.clear();
      for (const look of looks) {
        const figure = new AthleteFigure(look);
        this.figures.set(look.playerId, figure);
        this.athleteLayer.addChild(figure.root);
      }
      this.figureKey = key;
    }
    const { play } = this;
    const rim = toFullCourt(COURT_RIM, input.frame.attackingEnd);
    const p = play ? Math.min(1, play.p) : 0;
    const placeOf = input.place ?? ((point: FullCourtPoint) => point);
    const lastPlay = input.frame.lastPlay;
    const blockerId =
      lastPlay?.outcome === "blocked" ? lastPlay.player2Id : null;
    for (const look of looks) {
      const figure = this.figures.get(look.playerId);
      if (!figure) {
        continue;
      }
      const track = play?.tracks.find((t) => t.playerId === look.playerId);
      const spot = input.frame.players.find(
        (player) => player.playerId === look.playerId,
      )?.spot;
      let at: (time: number) => FullCourtPoint;
      let pose: AthletePose;
      if (play && track) {
        at = track.at;
        const { choreography } = play;
        pose = athletePose({
          at,
          ball: play.ball,
          holds: (time) =>
            ballHolderAt(choreography, time).holderId === look.playerId,
          rim,
          release: jumpTimeFor(choreography, look.playerId, blockerId),
          p,
          motionMs: play.motionMs,
        });
      } else if (spot) {
        at = () => spot;
        pose = athletePose({
          at,
          ball: () => input.frame.ball.at,
          holds: () => input.frame.ball.holderId === look.playerId,
          rim,
          release: null,
          p: 0,
          motionMs: 1000,
        });
      } else {
        figure.root.visible = false;
        continue;
      }
      figure.root.visible = true;
      const onScreen = this.screen(placeOf(at(p)));
      figure.place(onScreen.x, onScreen.y, pose, {
        scale: onScreen.scale,
        tilted: input.tilted ?? false,
        pxPerFt: this.width / FULL_COURT_FEET.length,
      });
    }
  }

  private drawBall(input: CourtFxSceneInput) {
    const { play } = this;
    this.trail.begin();
    const now = play
      ? play.ball(Math.min(1, play.p))
      : { ...input.frame.ball.at, liftPx: 0 };
    const tilted = input.tilted ?? false;
    const heightFt = play ? play.ballHeight(Math.min(1, play.p)) : 0;
    const height = tilted
      ? Math.min(1, heightFt / RIM_HEIGHT_FT)
      : Math.min(1, Math.max(0, now.liftPx) / SHOT_LIFT_PX);
    this.ballShadow.visible = now.y >= 0;
    this.ballShadow.tint = BLACK;
    this.ballShadow.alpha = 0.42 - 0.26 * height;
    const ballSpot = this.screen(now);
    this.ballShadow.position.set(ballSpot.x, ballSpot.y + 2);
    const shadowSize = (20 - 8 * height) * ballSpot.scale;
    this.ballShadow.width = shadowSize;
    this.ballShadow.height = shadowSize * 0.7 * this.squash();

    if (play && play.p < 1) {
      const step = TRAIL_MS / TRAIL_POINTS / play.motionMs;
      let ahead = ballSpot;
      for (let i = 1; i <= TRAIL_POINTS; i += 1) {
        const t = play.p - i * step;
        if (t < 0) {
          break;
        }
        const leg = legAt(play.choreography, t);
        const sample = play.ball(t);
        const onScreen = this.screen(sample);
        const moved = Math.hypot(onScreen.x - ahead.x, onScreen.y - ahead.y);
        ahead = onScreen;
        if (leg === "carry" || leg === null || moved < TRAIL_MIN_STEP_PX) {
          continue;
        }
        const halo = this.trail.take();
        const sprite = this.trail.take();
        if (!sprite || !halo) {
          break;
        }
        const fade = 1 - i / (TRAIL_POINTS + 1);
        const lift = tilted
          ? play.ballHeight(t) * this.raisePx(onScreen.scale)
          : Math.max(0, sample.liftPx);
        const sx = onScreen.x;
        const sy = onScreen.y - lift;
        const size = tilted
          ? (6 + 7 * fade) * onScreen.scale
          : (10 + 10 * fade) * (1 + lift / 36) * onScreen.scale;
        halo.tint = BLACK;
        halo.alpha = 0.3 * fade;
        halo.position.set(sx, sy);
        halo.width = size * 1.5;
        halo.height = size * 1.5;
        sprite.tint = WARM;
        sprite.alpha = 0.95 * fade;
        sprite.position.set(sx, sy);
        sprite.width = size;
        sprite.height = size;
      }
    }
    this.trail.end();
  }

  private drawImpacts(input: CourtFxSceneInput) {
    this.impacts.begin();
    this.floorGlows.begin();
    this.wash.visible = false;
    const { play, carried } = this;
    for (const group of carried) {
      for (const cue of group.cues) {
        this.drawCue(cue, group.p, group.motionMs, input);
      }
    }
    if (play) {
      for (const cue of play.cues) {
        this.drawCue(cue, play.p, play.motionMs, input);
      }
    }
    this.floorGlows.end();
    this.impacts.end();
  }

  private drawCue(
    cue: CourtFxCue,
    p: number,
    motionMs: number,
    input: CourtFxSceneInput,
  ) {
    const t = cueProgress(cue, p, this.minSpan(motionMs));
    if (t === null) {
      return;
    }
    const { dot, ring, streak } = this.atlas;
    const params = FX_TIERS[cue.tier];
    const color = input.colors[cue.side];
    const { x, y: floorY, scale } = this.screen(cue.point);
    const y = floorY - AIR_FT[cue.kind] * this.raisePx(scale);
    const squash = this.squash();
    const radius = params.burstRadius * this.width * scale;
    const fade = 1 - t;
    const circle = (
      texture: Texture,
      tint: number | string,
      alpha: number,
      size: number,
      at = { x, y },
    ) => {
      const sprite = this.impacts.take(texture);
      if (sprite) {
        sprite.tint = tint;
        sprite.alpha = alpha;
        sprite.position.set(at.x, at.y);
        sprite.width = size;
        sprite.height = size * squash;
      }
    };
    const sparks = (
      count: number,
      tint: number | string,
      reach: number,
      length: number,
    ) => {
      for (let i = 0; i < count; i += 1) {
        const angle = fxUnit(cue.seed, i) * Math.PI * 2;
        const far = reach * (0.55 + 0.45 * fxUnit(cue.seed, i + 100));
        const distance = far * easeOut(t);
        const sprite = this.impacts.take(streak);
        if (!sprite) {
          return;
        }
        sprite.tint = tint;
        sprite.alpha = fade * (0.6 + 0.4 * fxUnit(cue.seed, i + 200));
        sprite.rotation = angle;
        sprite.position.set(
          x + Math.cos(angle) * distance,
          y + Math.sin(angle) * distance,
        );
        sprite.width = length * (0.6 + 0.4 * fade);
        sprite.height = 3.5;
      }
    };

    switch (cue.kind) {
      case "arena_pulse": {
        const glow = this.floorGlows.take();
        if (glow) {
          const size = radius * (5 + 2 * t);
          glow.tint = color;
          glow.alpha = params.pulseAlpha * Math.sin(Math.PI * t);
          glow.position.set(x, floorY);
          glow.width = size;
          glow.height = size * squash;
        }
        break;
      }
      case "floor_wash":
        this.wash.visible = true;
        this.wash.tint = color;
        this.wash.alpha = params.washAlpha * Math.sin(Math.PI * t);
        break;
      case "rim_flash":
        circle(dot, color, 0.6 * fade, radius * (1.4 + 1.8 * easeOut(t)));
        circle(dot, WHITE, 0.9 * fade * fade, radius * (0.7 + easeOut(t)));
        break;
      case "net_ripple":
        for (let i = 0; i < 3; i += 1) {
          const delay = i * 0.2;
          const local = (t - delay) / (1 - delay);
          if (local > 0) {
            circle(
              ring,
              WHITE,
              0.7 * (1 - local),
              radius * (0.35 + 0.75 * local),
            );
          }
        }
        break;
      case "light_burst":
        sparks(params.sparks, color, radius * 2.6, radius * 0.7);
        sparks(Math.ceil(params.sparks / 3), WHITE, radius * 2, radius * 0.45);
        break;
      case "accent_ring":
        circle(ring, color, 0.9 * fade, radius * (1 + 2.4 * easeOut(t)));
        circle(ring, WHITE, 0.5 * fade, radius * (0.8 + 1.8 * easeOut(t)));
        break;
      case "rim_spark":
        sparks(9, WARM, radius * 1.3, radius * 0.5);
        break;
      case "impact_ring":
        circle(ring, WHITE, 0.85 * fade, radius * (0.5 + 1.5 * easeOut(t)));
        circle(dot, WARM, 0.35 * fade, radius * (0.6 + easeOut(t)));
        sparks(params.sparks / 2, WARM, radius * 1.3, radius * 0.4);
        break;
      case "steal_flick":
        circle(ring, color, 0.6 * fade, radius * (0.4 + 0.9 * easeOut(t)));
        sparks(
          cue.tier === "subtle" ? 4 : 8,
          color,
          radius * 0.9,
          radius * 0.35,
        );
        break;
    }
  }

  private drawEmbers(input: CourtFxSceneInput) {
    this.embers.begin();
    const count = Math.round(EMBER_COUNT * this.emberLevel);
    const color = input.colors[this.emberSide];
    for (let i = 0; i < count; i += 1) {
      const halo = this.embers.take();
      const sprite = this.embers.take();
      if (!sprite || !halo) {
        break;
      }
      const period = 7000 + fxUnit(input.seed, i) * 6000;
      const life = (this.emberMs / period + fxUnit(input.seed, i + 40)) % 1;
      const sway = Math.sin(life * Math.PI * 4 + i) * 0.012;
      const alpha = Math.sin(life * Math.PI) * (0.5 + 0.5 * this.emberLevel);
      const x = (fxUnit(input.seed, i + 80) + sway) * this.width;
      const y = (1 - life) * this.height;
      const size = 11 + fxUnit(input.seed, i + 120) * 13;
      halo.tint = BLACK;
      halo.alpha = alpha * 0.28;
      halo.position.set(x, y);
      halo.width = size * 1.6;
      halo.height = size * 1.6;
      sprite.tint = color;
      sprite.alpha = alpha;
      sprite.position.set(x, y);
      sprite.width = size;
      sprite.height = size;
    }
    this.embers.end();
  }

  private drawCelebration(input: CourtFxSceneInput) {
    this.confetti.begin();
    this.sweep.visible = false;
    const party = this.celebration;
    if (party && this.celebrationMs < CELEBRATION_MS) {
      const ms = this.celebrationMs;
      const color = input.colors[party.side];
      if (ms < SWEEP_MS) {
        const t = ms / SWEEP_MS;
        this.sweep.visible = true;
        this.sweep.tint = color;
        this.sweep.alpha = 0.34 * Math.sin(Math.PI * t);
        this.sweep.position.set(
          (-0.25 + 1.5 * t) * this.width,
          this.height / 2,
        );
        this.sweep.width = this.width * 0.6;
        this.sweep.height = this.height * 1.8;
      }
      const pieces = Math.round(
        CONFETTI_POOL * (party.tier === "signature" ? 1 : 0.5),
      );
      for (let i = 0; i < pieces; i += 1) {
        const sprite = this.confetti.take();
        if (!sprite) {
          break;
        }
        const start = fxUnit(party.seed, i) * 1600;
        const fall = 1900 + fxUnit(party.seed, i + 300) * 1100;
        const t = (ms - start) / fall;
        if (t < 0 || t >= 1) {
          sprite.visible = false;
          continue;
        }
        const sway = Math.sin(t * 9 + i) * 0.015;
        sprite.tint = fxUnit(party.seed, i + 600) > 0.3 ? color : WHITE;
        sprite.alpha = t > 0.8 ? (1 - t) / 0.2 : 1;
        sprite.rotation = t * 8 * (fxUnit(party.seed, i + 900) - 0.5);
        sprite.position.set(
          (fxUnit(party.seed, i + 1200) + sway) * this.width,
          (t * 1.1 - 0.05) * this.height,
        );
        sprite.width = 8;
        sprite.height = 4.5 + 4 * Math.abs(Math.sin(t * 14 + i));
      }
    }
    this.confetti.end();
  }
}
