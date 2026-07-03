import { describe, it, expect } from 'vitest';
import { skillTree } from './data';
import { validateTree } from './graph';
import { computeRunModifiers, STATS } from './modifiers';

describe('shipped skillTree', () => {
  it('is structurally valid', () => {
    expect(validateTree(skillTree)).toEqual([]);
  });

  it('has a Node count in the ADR 0003 range (28–34, root included)', () => {
    expect(skillTree.nodes.length).toBeGreaterThanOrEqual(28);
    expect(skillTree.nodes.length).toBeLessThanOrEqual(34);
  });

  it('every Node id is unique', () => {
    const ids = skillTree.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the root exists, costs 0, and carries no effects', () => {
    const root = skillTree.nodes.find((n) => n.id === skillTree.root);
    expect(root).toBeDefined();
    expect(root!.cost).toBe(0);
    expect(root!.effects).toEqual([]);
  });

  it('total SP cost is within the 200–280 pacing budget', () => {
    const total = skillTree.nodes.reduce((sum, n) => sum + n.cost, 0);
    expect(total).toBeGreaterThanOrEqual(200);
    expect(total).toBeLessThanOrEqual(280);
  });

  it('every first-ring Node (adjacent to root) costs ≤ 3 SP', () => {
    const root = skillTree.nodes.find((n) => n.id === skillTree.root)!;
    for (const neighborId of root.edges) {
      const neighbor = skillTree.nodes.find((n) => n.id === neighborId)!;
      expect(neighbor.cost, `${neighborId} first-ring cost`).toBeLessThanOrEqual(3);
      expect(neighbor.cost, `${neighborId} first-ring cost`).toBeGreaterThanOrEqual(2);
    }
  });

  it('every non-root Node costs at least 1 SP', () => {
    for (const node of skillTree.nodes) {
      if (node.id === skillTree.root) continue;
      expect(node.cost, `${node.id} cost`).toBeGreaterThan(0);
    }
  });

  it('every effect targets a stat in the catalogue with a sane magnitude', () => {
    const catalogue = new Set<string>(STATS);
    for (const node of skillTree.nodes) {
      for (const effect of node.effects) {
        expect(catalogue.has(effect.stat), `${node.id} stat ${effect.stat}`).toBe(true);
        expect(Number.isFinite(effect.amount), `${node.id} amount finite`).toBe(true);
        expect(effect.amount, `${node.id} amount positive`).toBeGreaterThan(0);
        if (effect.kind === 'percent') {
          // No single Node grants an absurd percent buff.
          expect(effect.amount, `${node.id} percent bound`).toBeLessThanOrEqual(0.5);
        }
      }
    }
  });

  it('every Node grants at least one effect except the root', () => {
    for (const node of skillTree.nodes) {
      if (node.id === skillTree.root) continue;
      expect(node.effects.length, `${node.id} effect count`).toBeGreaterThan(0);
    }
  });

  it('spreads themes across at least four distinct stats', () => {
    const touched = new Set<string>();
    for (const node of skillTree.nodes) {
      for (const effect of node.effects) touched.add(effect.stat);
    }
    expect(touched.size).toBeGreaterThanOrEqual(4);
  });

  it('computeRunModifiers over ALL Nodes yields finite, sane values', () => {
    const allIds = skillTree.nodes.map((n) => n.id);
    const mods = computeRunModifiers(allIds, skillTree);
    for (const stat of STATS) {
      const { flat, percent } = mods[stat];
      expect(Number.isFinite(flat), `${stat} flat finite`).toBe(true);
      expect(Number.isFinite(percent), `${stat} percent finite`).toBe(true);
      expect(flat, `${stat} flat non-negative`).toBeGreaterThanOrEqual(0);
      expect(percent, `${stat} percent non-negative`).toBeGreaterThanOrEqual(0);
      // Fully invested, no single stat should balloon past a sane cap.
      expect(percent, `${stat} percent capped`).toBeLessThanOrEqual(2);
    }
  });
});
