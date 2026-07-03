import { describe, it, expect } from 'vitest';
import { nextCursor } from './treeCursor';
import type { SkillTree } from '../skilltree/types';

/**
 * A purpose-built cross so each direction has an unambiguous neighbor. The center
 * connects to one Node straight along each axis.
 */
const cross: SkillTree = {
  root: 'c',
  nodes: [
    { id: 'c', label: 'C', cost: 0, effects: [], x: 0, y: 0, edges: ['n', 's', 'e', 'w'] },
    { id: 'n', label: 'N', cost: 1, effects: [], x: 0, y: -1, edges: ['c'] },
    { id: 's', label: 'S', cost: 1, effects: [], x: 0, y: 1, edges: ['c'] },
    { id: 'e', label: 'E', cost: 1, effects: [], x: 1, y: 0, edges: ['c'] },
    { id: 'w', label: 'W', cost: 1, effects: [], x: -1, y: 0, edges: ['c'] },
  ],
};

describe('nextCursor', () => {
  describe('axis-aligned neighbors', () => {
    it('moves to the neighbor straight in each direction', () => {
      expect(nextCursor(cross, 'c', 'up')).toBe('n');
      expect(nextCursor(cross, 'c', 'down')).toBe('s');
      expect(nextCursor(cross, 'c', 'right')).toBe('e');
      expect(nextCursor(cross, 'c', 'left')).toBe('w');
    });

    it('stays put when no edge leads that way', () => {
      // From the north leaf, the only edge is back down to center.
      expect(nextCursor(cross, 'n', 'up')).toBe('n');
      expect(nextCursor(cross, 'n', 'left')).toBe('n');
      expect(nextCursor(cross, 'n', 'down')).toBe('c');
    });

    it('only follows edges — never jumps across a gap', () => {
      // n and e are not directly connected; from n, pressing right finds nothing.
      expect(nextCursor(cross, 'n', 'right')).toBe('n');
    });
  });

  describe('picking the best-aligned neighbor within the cone', () => {
    // Two neighbors both to the right of center, one nearly straight, one diagonal.
    const fan: SkillTree = {
      root: 'c',
      nodes: [
        { id: 'c', label: 'C', cost: 0, effects: [], x: 0, y: 0, edges: ['straight', 'diag'] },
        { id: 'straight', label: 'S', cost: 1, effects: [], x: 2, y: 0, edges: ['c'] },
        { id: 'diag', label: 'D', cost: 1, effects: [], x: 1, y: 1, edges: ['c'] },
      ],
    };

    it('prefers the neighbor most aligned with the arrow', () => {
      // Right: straight (0°) beats diag (45°).
      expect(nextCursor(fan, 'c', 'right')).toBe('straight');
      // Down: only diag is below center (straight is level), so diag wins.
      expect(nextCursor(fan, 'c', 'down')).toBe('diag');
    });

    it('ignores neighbors outside the 90-degree cone', () => {
      // Up: nothing is above center; cursor holds.
      expect(nextCursor(fan, 'c', 'up')).toBe('c');
    });
  });

  it('breaks ties toward the nearer Node', () => {
    // Two neighbors at the same angle (straight right) but different distances.
    const colinear: SkillTree = {
      root: 'c',
      nodes: [
        { id: 'c', label: 'C', cost: 0, effects: [], x: 0, y: 0, edges: ['near', 'far'] },
        { id: 'near', label: 'N', cost: 1, effects: [], x: 1, y: 0, edges: ['c'] },
        { id: 'far', label: 'F', cost: 1, effects: [], x: 3, y: 0, edges: ['c'] },
      ],
    };
    expect(nextCursor(colinear, 'c', 'right')).toBe('near');
  });

  it('returns the id unchanged for an unknown starting Node', () => {
    expect(nextCursor(cross, 'nope', 'up')).toBe('nope');
  });
});
