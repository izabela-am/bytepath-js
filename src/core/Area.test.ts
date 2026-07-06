import { describe, it, expect } from 'vitest';
import { Area } from './Area';
import { GameObject } from './GameObject';

// draw() is a no-op — no canvas in unit tests, matching the "rules-adjacent
// only" test policy.
class Dummy extends GameObject {
  updates = 0;
  update(): void {
    this.updates += 1;
  }
  draw(): void {}
}

class Alpha extends Dummy {}
class Beta extends Dummy {}

describe('Area.add', () => {
  it('registers the object and sets its back-reference', () => {
    const area = new Area();
    const obj = area.add(new Alpha(1, 2));
    expect(obj.area).toBe(area);
    expect(area.count).toBe(1);
  });
});

describe('Area.update', () => {
  it('advances live objects', () => {
    const area = new Area();
    const a = area.add(new Alpha());
    area.update(0.016);
    area.update(0.016);
    expect(a.updates).toBe(2);
  });

  it('culls dead objects after updating', () => {
    const area = new Area();
    const a = area.add(new Alpha());
    const b = area.add(new Alpha());
    b.destroy();

    area.update(0.016);

    expect(area.count).toBe(1);
    expect(area.all()).toEqual([a]);
    // Dead object was not updated the tick it died.
    expect(b.updates).toBe(0);
  });

  it('does not update an object marked dead before the tick', () => {
    const area = new Area();
    const a = area.add(new Alpha());
    a.destroy();
    area.update(0.016);
    expect(a.updates).toBe(0);
  });
});

describe('Area.getGameObjectsByClass', () => {
  it('filters by concrete class and excludes dead objects', () => {
    const area = new Area();
    const a1 = area.add(new Alpha());
    area.add(new Beta());
    const a2 = area.add(new Alpha());
    a2.destroy();
    area.update(0.016);

    const alphas = area.getGameObjectsByClass(Alpha);
    expect(alphas).toEqual([a1]);
    expect(area.getGameObjectsByClass(Beta)).toHaveLength(1);
  });
});

describe('circle overlap', () => {
  it('circlesOverlap: touching edges count, gaps do not', () => {
    const a = new Alpha(0, 0);
    a.radius = 5;
    const b = new Alpha(10, 0);
    b.radius = 5;
    expect(Area.circlesOverlap(a, b)).toBe(true); // edges touch at distance 10

    const c = new Alpha(11, 0);
    c.radius = 5;
    expect(Area.circlesOverlap(a, c)).toBe(false);
  });

  it('circlesOverlap: zero radius never collides', () => {
    const a = new Alpha(0, 0);
    a.radius = 0;
    const b = new Alpha(0, 0);
    b.radius = 5;
    expect(Area.circlesOverlap(a, b)).toBe(false);
  });

  it('queryCircleOverlap returns overlapping objects of the class, excluding self', () => {
    const area = new Area();
    const probe = area.add(new Alpha(0, 0));
    probe.radius = 5;

    const hit = area.add(new Beta(6, 0));
    hit.radius = 5; // distance 6 <= 10
    const miss = area.add(new Beta(100, 0));
    miss.radius = 5;
    const wrongClass = area.add(new Alpha(1, 0));
    wrongClass.radius = 5;

    const results = area.queryCircleOverlap(probe, Beta);
    expect(results).toEqual([hit]);
    expect(results).not.toContain(wrongClass);
  });

  it('queryCircleOverlap returns nothing when the probe has no radius', () => {
    const area = new Area();
    const probe = area.add(new Alpha(0, 0)); // radius 0
    const other = area.add(new Beta(0, 0));
    other.radius = 5;
    expect(area.queryCircleOverlap(probe, Beta)).toEqual([]);
  });
});

describe('Area.queryRadius', () => {
  it('returns objects within range of a point, center to center', () => {
    const area = new Area();
    const near = area.add(new Alpha(3, 4)); // distance 5 from origin
    area.add(new Alpha(30, 40)); // distance 50

    expect(area.queryRadius(0, 0, 5, Alpha)).toEqual([near]);
    expect(area.queryRadius(0, 0, 5, Beta)).toEqual([]);
  });
});

describe('Area.clear', () => {
  it('destroys and removes all objects', () => {
    const area = new Area();
    const a = area.add(new Alpha());
    area.add(new Beta());
    area.clear();
    expect(area.count).toBe(0);
    expect(a.dead).toBe(true);
  });
});
