import { Enemy } from './Enemy';
import { spawnPointOnEdge, type SpawnEdge } from './Enemy';
import { Palette } from '../game/palette';
import {
  TWO_PI,
  randomRange,
  randomInt,
  randomChoice,
  vectorFromAngle,
  angle as angleBetween,
} from '../engine/mathutils';
import { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from '../game/constants';

export const ROCK_HP = 100;
export const ROCK_SCORE = 100;
export const ROCK_RADIUS = 8;

/** Straight-line drift speed range, in playfield units per second. */
export const ROCK_MIN_SPEED = 20;
export const ROCK_MAX_SPEED = 60;

/** Rotation speed range (radians/second), sign chosen at random. */
const ROCK_MIN_SPIN = 0.4;
const ROCK_MAX_SPIN = 1.4;

const ROCK_VERTICES = 6;

export class Rock extends Enemy {
  private vx: number;
  private vy: number;
  private angle = randomRange(0, TWO_PI);
  private readonly spin: number;

  /** Per-vertex radius jitter that gives each rock its lumpy outline. */
  private readonly shape: number[];

  constructor() {
    // Spawn just off a random edge, aimed roughly at the opposite side so the
    // rock crosses the playfield rather than skimming a corner.
    const edge = randomChoice<SpawnEdge>(['left', 'right', 'top', 'bottom']);
    const { x, y } = spawnPointOnEdge(edge, randomRange);
    super(x, y, ROCK_SCORE, ROCK_HP);
    this.radius = ROCK_RADIUS;

    // Head toward a random point on the far half of the playfield.
    const targetX = randomRange(PLAYFIELD_WIDTH * 0.25, PLAYFIELD_WIDTH * 0.75);
    const targetY = randomRange(PLAYFIELD_HEIGHT * 0.25, PLAYFIELD_HEIGHT * 0.75);
    const heading = angleBetween(x, y, targetX, targetY);
    const speed = randomRange(ROCK_MIN_SPEED, ROCK_MAX_SPEED);
    const v = vectorFromAngle(heading, speed);
    this.vx = v.x;
    this.vy = v.y;

    this.spin = randomRange(ROCK_MIN_SPIN, ROCK_MAX_SPIN) * (randomInt(0, 1) === 0 ? -1 : 1);

    this.shape = Array.from({ length: ROCK_VERTICES }, () => randomRange(0.75, 1.15));
  }

  update(dt: number): void {
    this.tickFlash(dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.spin * dt;
    if (this.isOffPlayfield()) this.destroy();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = this.flashing ? Palette.negative : Palette.hp;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < ROCK_VERTICES; i++) {
      const a = (i / ROCK_VERTICES) * TWO_PI;
      const r = this.radius * (this.shape[i] as number);
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}
