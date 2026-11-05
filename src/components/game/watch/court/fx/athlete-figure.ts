import { Container, Graphics, Text } from "pixi.js";
import {
  TILT_RAISE,
  TILT_SQUASH,
} from "@/components/game/watch/court/court-tilt";
import { readableTextOnBackground } from "@/domain/color-contrast";
import { type HairShape, hairShape } from "./athlete-look";
import { HEAD_RADIUS_FT, athleteRig, type Joint } from "./athlete-rig";
import type { AthletePose } from "./fx-athlete";

export type AthleteLook = {
  jersey: string;
  /** Team colour for the hems. */
  accent: string;
  /** Jersey number or monogram. */
  number: string;
  skin: string;
  skinShadow: string;
  hair: string;
  /** Index into the portrait hair styles. */
  hairStyle: number;
  heightInches: number;
};

const SHOE = 0x17171a;
const SOLE = 0xf4f4f5;
const SOCK = 0xf4f4f5;

/**
 * Drawn a little over true scale so a player reads at broadcast distance, while
 * still standing well under the rim.
 */
const OVER_SCALE = 1.1;
/** The height the skeleton is measured for. */
const RIG_INCHES = 78;
/** How far the body sits behind the ball when they have it, in feet. */
const HOLD_BACK_FT = 1.3;

/** Half widths of the body's cross-section, in feet: across and front to back. */
const SHOULDER_ACROSS = 0.9;
const SHOULDER_DEPTH = 0.46;
const WAIST_ACROSS = 0.56;
const WAIST_DEPTH = 0.38;
/** Thickness at each end of a limb, in feet. */
const THIGH = [0.68, 0.46] as const;
const CALF = [0.44, 0.27] as const;
const UPPER_ARM = [0.44, 0.33] as const;
const FOREARM = [0.31, 0.22] as const;
const SHOE_FT = 0.4;
const SHOE_LENGTH_FT = 0.95;
const NECK_FT = 0.36;
/** How far down a thigh the shorts reach, and a calf the sock starts. */
const SHORTS_REACH = 0.66;
const SOCK_START = 0.74;
const NUMBER_FONT_PX = 8.5;
/** Below this size a face and number would only be noise. */
const DETAIL_MIN_PX_PER_FT = 8;

type Point = { x: number; y: number };

const along = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** A colour darkened, for whatever is turned away from the light. */
function shade(hex: string, amount: number): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((value >> shift) & 0xff) * amount);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** A rounded limb, thicker at one end. */
function taper(
  g: Graphics,
  from: Point,
  to: Point,
  fromWidth: number,
  toWidth: number,
  color: number | string,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  g.poly([
    from.x + (nx * fromWidth) / 2,
    from.y + (ny * fromWidth) / 2,
    to.x + (nx * toWidth) / 2,
    to.y + (ny * toWidth) / 2,
    to.x - (nx * toWidth) / 2,
    to.y - (ny * toWidth) / 2,
    from.x - (nx * fromWidth) / 2,
    from.y - (ny * fromWidth) / 2,
  ])
    .fill(color)
    .circle(from.x, from.y, fromWidth / 2)
    .fill(color)
    .circle(to.x, to.y, toWidth / 2)
    .fill(color);
}

/** A flat band across a limb, with square ends: a hem, not a joint. */
function band(
  g: Graphics,
  from: Point,
  to: Point,
  width: number,
  color: number | string,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * (width / 2);
  const ny = (dx / length) * (width / 2);
  g.poly([
    from.x + nx,
    from.y + ny,
    to.x + nx,
    to.y + ny,
    to.x - nx,
    to.y - ny,
    from.x - nx,
    from.y - ny,
  ]).fill(color);
}

/**
 * A player from a skeleton in feet: legs, shorts, torso, arms and head, drawn
 * again each frame from where the joints are. Nearer limbs go over farther
 * ones, and the body keeps its depth when side-on, so it holds together
 * whichever way they turn.
 */
export class AthleteFigure {
  readonly root = new Container();
  private readonly body = new Graphics();
  private readonly front = new Graphics();
  private readonly number: Text;
  private readonly look: AthleteLook;
  private readonly hair: HairShape;
  private readonly jerseyShade: number;
  private readonly skinFar: number;
  private readonly jerseyFar: number;

  constructor(look: AthleteLook) {
    this.look = look;
    this.hair = hairShape(look.hairStyle);
    this.jerseyShade = shade(look.jersey, 0.72);
    this.skinFar = shade(look.skin, 0.84);
    this.jerseyFar = shade(look.jersey, 0.84);
    this.number = new Text({
      text: look.number,
      style: {
        fontFamily: "Arial, sans-serif",
        fontWeight: "800",
        fontSize: NUMBER_FONT_PX,
        fill: readableTextOnBackground(look.jersey),
      },
      resolution: 3,
    });
    this.number.anchor.set(0.5);
    // The number goes on the jersey, under an arm crossing in front of it.
    this.root.addChild(this.body, this.number, this.front);
  }

  place(
    x: number,
    y: number,
    pose: AthletePose,
    view: { scale: number; tilted: boolean; pxPerFt: number },
  ) {
    const { look } = this;
    const rise = view.tilted ? TILT_RAISE : 0;
    const squash = view.tilted ? TILT_SQUASH : 1;
    const size = view.scale * (look.heightInches / RIG_INCHES);
    const k = view.pxPerFt * OVER_SCALE * size;
    const cos = Math.cos(pose.facing);
    const sin = Math.sin(pose.facing);
    const project = (joint: Joint): Point => ({
      x: (joint.f * cos - joint.s * sin) * k,
      y: (joint.f * sin + joint.s * cos) * k * squash - joint.u * k * rise,
    });

    const back = pose.hold * HOLD_BACK_FT * k;
    this.root.position.set(x - cos * back, y - sin * back * squash);
    this.root.zIndex = y;

    const rig = athleteRig(pose);
    const leftShoulder = project(rig.leftShoulder);
    const rightShoulder = project(rig.rightShoulder);
    const leftHip = project(rig.leftHip);
    const rightHip = project(rig.rightHip);
    const head = project(rig.head);
    const neck = project(rig.neck);

    // Their right side is toward the camera when `cos` is positive.
    const rightNear = cos > 0;
    const g = this.body;
    g.clear();
    this.front.clear();

    const legOn = (right: boolean, near: boolean) => {
      const foot = right ? rig.rightFoot : rig.leftFoot;
      const hip = right ? rightHip : leftHip;
      const knee = project(right ? rig.rightKnee : rig.leftKnee);
      const ankle = project(foot);
      const skin = near ? look.skin : this.skinFar;

      const heel = project({ ...foot, f: foot.f - SHOE_LENGTH_FT * 0.4 });
      const toe = project({ ...foot, f: foot.f + SHOE_LENGTH_FT * 0.6 });
      taper(g, heel, toe, SHOE_FT * k, SHOE_FT * k * 0.85, SHOE);
      taper(
        g,
        along(heel, toe, 0.8),
        toe,
        SHOE_FT * k * 0.5,
        SHOE_FT * k * 0.5,
        SOLE,
      );

      taper(g, knee, ankle, CALF[0] * k, CALF[1] * k, skin);
      taper(
        g,
        along(knee, ankle, SOCK_START),
        ankle,
        CALF[1] * k * 1.25,
        CALF[1] * k,
        SOCK,
      );
      taper(g, hip, knee, THIGH[0] * k, THIGH[1] * k, skin);

      // Shorts down the thigh, with a team-coloured hem.
      const hem = along(hip, knee, SHORTS_REACH);
      const hemWidth =
        (THIGH[0] + (THIGH[1] - THIGH[0]) * SHORTS_REACH) * k * 1.12;
      taper(
        g,
        hip,
        hem,
        THIGH[0] * k * 1.12,
        hemWidth,
        near ? look.jersey : this.jerseyFar,
      );
      band(
        g,
        along(hip, knee, SHORTS_REACH - 0.07),
        hem,
        hemWidth,
        look.accent,
      );
    };
    const armOn = (target: Graphics, right: boolean, near: boolean) => {
      const shoulder = right ? rightShoulder : leftShoulder;
      const elbow = project(right ? rig.rightElbow : rig.leftElbow);
      const hand = project(right ? rig.rightHand : rig.leftHand);
      const skin = near ? look.skin : this.skinFar;
      taper(target, shoulder, elbow, UPPER_ARM[0] * k, UPPER_ARM[1] * k, skin);
      taper(target, elbow, hand, FOREARM[0] * k, FOREARM[1] * k, skin);
    };

    legOn(!rightNear, false);
    legOn(rightNear, true);
    armOn(g, !rightNear, false);

    // Torso: the outline a body of this depth shows from this side, from
    // shoulders to waist, so it stays solid when seen side-on.
    const half = (across: number, depth: number) =>
      Math.hypot(depth * cos, across * sin) * k;
    const chestHalf = half(SHOULDER_ACROSS, SHOULDER_DEPTH);
    const waistHalf = half(WAIST_ACROSS, WAIST_DEPTH);
    const chest = along(leftShoulder, rightShoulder, 0.5);
    const waist = along(leftHip, rightHip, 0.5);
    const run = rightShoulder.x - leftShoulder.x;
    const slope =
      Math.abs(run) > 0.5
        ? Math.max(
            -0.5,
            Math.min(0.5, (rightShoulder.y - leftShoulder.y) / run),
          )
        : 0;
    const outline = [
      chest.x - chestHalf,
      chest.y - chestHalf * slope,
      chest.x + chestHalf,
      chest.y + chestHalf * slope,
      waist.x + waistHalf,
      waist.y,
      waist.x - waistHalf,
      waist.y,
    ];
    g.poly(outline)
      .fill(look.jersey)
      .stroke({ width: 0.2 * k, color: look.jersey, join: "round" });
    // Lit from the upper left: the far edge of the body falls into shade.
    g.poly([
      chest.x + chestHalf * 0.35,
      chest.y + chestHalf * slope * 0.35,
      chest.x + chestHalf,
      chest.y + chestHalf * slope,
      waist.x + waistHalf,
      waist.y,
      waist.x + waistHalf * 0.35,
      waist.y,
    ]).fill({ color: this.jerseyShade, alpha: 0.4 });

    taper(g, neck, head, NECK_FT * k, NECK_FT * k * 0.9, look.skinShadow);
    this.drawHead(g, head, k, cos, sin, squash, rise);

    if (pose.lift > 0.05) {
      // Up for a shot, both arms come in front of the body.
      armOn(this.front, rightNear, true);
      armOn(this.front, !rightNear, false);
    } else {
      armOn(this.front, rightNear, true);
    }

    this.number.visible = k >= DETAIL_MIN_PX_PER_FT;
    const mid = along(chest, waist, 0.42);
    this.number.position.set(mid.x, mid.y);
    this.number.scale.set(size);
  }

  private drawHead(
    g: Graphics,
    head: Point,
    k: number,
    cos: number,
    sin: number,
    squash: number,
    rise: number,
  ) {
    const { look, hair } = this;
    const r = HEAD_RADIUS_FT * k;
    // Hair sits back from the way they face, so a face shows toward them.
    const backX = -cos * r * 0.3;
    const backY = -sin * r * 0.3 * squash - r * 0.28 * rise;

    if (hair === "afro") {
      g.circle(head.x + backX * 0.5, head.y + backY * 0.8, r * 1.42).fill(
        look.hair,
      );
    } else if (hair === "long" || hair === "locs") {
      // Down the back of the neck to the shoulders.
      taper(
        g,
        { x: head.x + backX, y: head.y + backY },
        { x: head.x + backX * 1.7, y: head.y + r * 1.9 },
        r * 1.75,
        r * (hair === "locs" ? 1.6 : 1.2),
        look.hair,
      );
    }

    g.ellipse(head.x, head.y, r * 0.92, r).fill(look.skin);

    switch (hair) {
      case "none":
        break;
      case "buzz":
        g.circle(head.x + backX, head.y + backY, r * 0.8).fill({
          color: look.hair,
          alpha: 0.55,
        });
        break;
      case "high_top":
        taper(
          g,
          { x: head.x + backX, y: head.y + backY },
          { x: head.x + backX, y: head.y + backY - r * 0.75 },
          r * 1.6,
          r * 1.35,
          look.hair,
        );
        break;
      case "top_knot":
        g.circle(head.x + backX, head.y + backY, r * 0.86)
          .fill(look.hair)
          .circle(head.x + backX * 1.2, head.y + backY - r * 1.05, r * 0.45)
          .fill(look.hair);
        break;
      case "mohawk":
        g.circle(head.x + backX, head.y + backY, r * 0.8)
          .fill({ color: look.hair, alpha: 0.35 })
          .moveTo(head.x + backX - cos * r, head.y + backY - r * 0.6)
          .lineTo(head.x + backX + cos * r, head.y + backY - r * 0.75)
          .stroke({ width: r * 0.5, color: look.hair, cap: "round" });
        break;
      default:
        g.circle(head.x + backX, head.y + backY, r * 0.88).fill(look.hair);
    }

    // Eyes only when they look toward the camera and there is room for them.
    if (sin > 0.3 && k >= DETAIL_MIN_PX_PER_FT) {
      const eyeY = head.y + r * 0.22;
      const centre = head.x + cos * r * 0.45;
      const gap = r * 0.34 * sin;
      g.circle(centre - gap, eyeY, Math.max(0.5, r * 0.09))
        .circle(centre + gap, eyeY, Math.max(0.5, r * 0.09))
        .fill(0x1a1210);
    }
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
