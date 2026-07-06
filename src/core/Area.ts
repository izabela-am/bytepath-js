import type { GameObject } from './GameObject';
import { distance } from '../engine/mathutils';

/**
 * A container of GameObjects, ported from the LÖVE tutorial's Area.
 *
 * A Room owns one or more Areas. Objects register into an Area via `add`; the
 * Area advances them, culls dead ones, draws them, and answers spatial queries.
 * The Area does NOT decide collision *responses* — it only reports overlaps, so
 * game rules stay in the objects/rooms.
 *
 * `Constructor<T>` is the shape of a class value (e.g. `Ship`), used by
 * `getGameObjectsByClass` so callers get back a correctly typed array.
 */
export type Constructor<T> = abstract new (...args: never[]) => T;

export class Area {
  private objects: GameObject[] = [];

  add<T extends GameObject>(object: T): T {
    object.area = this;
    this.objects.push(object);
    return object;
  }

  update(dt: number): void {
    for (const object of this.objects) {
      if (!object.dead) object.update(dt);
    }
    // Cull in one pass after updating so cross-object logic sees a stable set.
    if (this.objects.some((o) => o.dead)) {
      this.objects = this.objects.filter((o) => !o.dead);
    }
  }

  /** Draw all live objects in insertion order (earlier = behind). */
  draw(ctx: CanvasRenderingContext2D): void {
    for (const object of this.objects) {
      if (!object.dead) object.draw(ctx);
    }
  }

  getGameObjectsByClass<T extends GameObject>(cls: Constructor<T>): T[] {
    const result: T[] = [];
    for (const object of this.objects) {
      if (!object.dead && object instanceof cls) result.push(object as T);
    }
    return result;
  }

  /** Returns a copy; safe to iterate while mutating the Area. */
  all(): GameObject[] {
    return this.objects.filter((o) => !o.dead);
  }

  get count(): number {
    let n = 0;
    for (const o of this.objects) if (!o.dead) n += 1;
    return n;
  }

  /**
   * Objects with `radius <= 0` never collide. Touching edges counts as
   * overlap.
   */
  static circlesOverlap(a: GameObject, b: GameObject): boolean {
    if (a.radius <= 0 || b.radius <= 0) return false;
    return distance(a.x, a.y, b.x, b.y) <= a.radius + b.radius;
  }

  /**
   * Live objects of class `cls` whose collision circle overlaps `object`
   * (excluding `object` itself). `object` needs a positive radius to match.
   */
  queryCircleOverlap<T extends GameObject>(object: GameObject, cls: Constructor<T>): T[] {
    const result: T[] = [];
    if (object.radius <= 0) return result;
    for (const other of this.objects) {
      if (other === object || other.dead) continue;
      if (other instanceof cls && Area.circlesOverlap(object, other)) {
        result.push(other as T);
      }
    }
    return result;
  }

  /**
   * Live objects of class `cls` within `range` of the point (px, py), measured
   * center-to-center (the query point has no radius of its own).
   */
  queryRadius<T extends GameObject>(
    px: number,
    py: number,
    range: number,
    cls: Constructor<T>,
  ): T[] {
    const result: T[] = [];
    for (const other of this.objects) {
      if (other.dead) continue;
      if (other instanceof cls && distance(px, py, other.x, other.y) <= range) {
        result.push(other as T);
      }
    }
    return result;
  }

  clear(): void {
    for (const object of this.objects) object.destroy();
    this.objects = [];
  }
}
