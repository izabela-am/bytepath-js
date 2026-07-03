import { describe, it, expect } from 'vitest';
import { isOwned, isPurchasable, buy, respec, validateTree } from './graph';
import { sampleTree } from './data';
import { defaultSave, type SaveData } from '../save/save';
import type { SkillTree } from './types';

function saveWith(partial: Partial<SaveData>): SaveData {
  return { ...defaultSave(), ...partial };
}

describe('skill tree graph', () => {
  describe('isOwned', () => {
    it('reports the root as owned implicitly (never in ownedNodes)', () => {
      expect(isOwned(defaultSave(), sampleTree, 'root')).toBe(true);
    });

    it('reports listed Nodes as owned', () => {
      const save = saveWith({ ownedNodes: ['rapid'] });
      expect(isOwned(save, sampleTree, 'rapid')).toBe(true);
      expect(isOwned(save, sampleTree, 'damage')).toBe(false);
    });
  });

  describe('isPurchasable', () => {
    it('Nodes adjacent to the root are purchasable from a fresh save', () => {
      const save = defaultSave();
      expect(isPurchasable(save, sampleTree, 'rapid')).toBe(true);
      expect(isPurchasable(save, sampleTree, 'plating')).toBe(true);
      expect(isPurchasable(save, sampleTree, 'thruster')).toBe(true);
    });

    it('Nodes not adjacent to anything owned are not purchasable', () => {
      // damage is adjacent only to rapid, which is not yet owned
      expect(isPurchasable(defaultSave(), sampleTree, 'damage')).toBe(false);
    });

    it('becomes purchasable once an adjacent Node is owned', () => {
      const save = saveWith({ ownedNodes: ['rapid'] });
      expect(isPurchasable(save, sampleTree, 'damage')).toBe(true);
      expect(isPurchasable(save, sampleTree, 'scavenger')).toBe(true);
    });

    it('the root itself is never purchasable', () => {
      expect(isPurchasable(defaultSave(), sampleTree, 'root')).toBe(false);
    });

    it('an already-owned Node is not purchasable', () => {
      const save = saveWith({ ownedNodes: ['rapid'] });
      expect(isPurchasable(save, sampleTree, 'rapid')).toBe(false);
    });

    it('an unknown id is not purchasable', () => {
      expect(isPurchasable(defaultSave(), sampleTree, 'nope')).toBe(false);
    });
  });

  describe('buy', () => {
    it('adds the Node and deducts its cost, returning a new save', () => {
      const save = saveWith({ sp: 5 });
      const next = buy(save, sampleTree, 'rapid'); // cost 1
      expect(next.ownedNodes).toEqual(['rapid']);
      expect(next.sp).toBe(4);
      // input untouched (pure)
      expect(save.ownedNodes).toEqual([]);
      expect(save.sp).toBe(5);
    });

    it('does not buy an unreachable Node', () => {
      const save = saveWith({ sp: 99 });
      const next = buy(save, sampleTree, 'damage'); // not adjacent to owned
      expect(next.ownedNodes).toEqual([]);
      expect(next.sp).toBe(99);
    });

    it('does not buy when SP is insufficient', () => {
      const save = saveWith({ sp: 1 });
      const next = buy(save, sampleTree, 'plating'); // cost 2
      expect(next.ownedNodes).toEqual([]);
      expect(next.sp).toBe(1);
    });

    it('does not re-buy an owned Node', () => {
      const save = saveWith({ sp: 10, ownedNodes: ['rapid'] });
      const next = buy(save, sampleTree, 'rapid');
      expect(next.ownedNodes).toEqual(['rapid']);
      expect(next.sp).toBe(10);
    });

    it('does not buy the root', () => {
      const save = saveWith({ sp: 10 });
      const next = buy(save, sampleTree, 'root');
      expect(next.ownedNodes).toEqual([]);
      expect(next.sp).toBe(10);
    });

    it('supports buying a chain along adjacency', () => {
      let save = saveWith({ sp: 10 });
      save = buy(save, sampleTree, 'rapid'); // cost 1 -> sp 9
      save = buy(save, sampleTree, 'damage'); // cost 2 -> sp 7
      expect(save.ownedNodes).toEqual(['rapid', 'damage']);
      expect(save.sp).toBe(7);
    });
  });

  describe('respec', () => {
    it('refunds all spent SP and clears owned Nodes (all-or-nothing)', () => {
      const save = saveWith({ sp: 3, ownedNodes: ['rapid', 'damage'] }); // spent 1 + 2
      const next = respec(save, sampleTree);
      expect(next.ownedNodes).toEqual([]);
      expect(next.sp).toBe(3 + 1 + 2);
    });

    it('is a no-op refund when nothing is owned', () => {
      const save = saveWith({ sp: 5 });
      const next = respec(save, sampleTree);
      expect(next).toEqual(save);
    });

    it('does not mutate the input save', () => {
      const save = saveWith({ sp: 0, ownedNodes: ['plating'] });
      respec(save, sampleTree);
      expect(save.ownedNodes).toEqual(['plating']);
      expect(save.sp).toBe(0);
    });

    it('round-trips: buy then respec restores the original SP', () => {
      const start = saveWith({ sp: 6 });
      let save = buy(start, sampleTree, 'plating'); // cost 2
      save = buy(save, sampleTree, 'hull'); // cost 3
      const restored = respec(save, sampleTree);
      expect(restored.sp).toBe(start.sp);
      expect(restored.ownedNodes).toEqual([]);
    });
  });

  describe('validateTree', () => {
    it('accepts the sample tree', () => {
      expect(validateTree(sampleTree)).toEqual([]);
    });

    it('flags duplicate ids', () => {
      const tree: SkillTree = {
        root: 'a',
        nodes: [
          { id: 'a', label: 'A', cost: 0, effects: [], x: 0, y: 0, edges: ['b'] },
          { id: 'b', label: 'B', cost: 1, effects: [], x: 1, y: 0, edges: ['a'] },
          { id: 'b', label: 'B2', cost: 1, effects: [], x: 2, y: 0, edges: [] },
        ],
      };
      expect(validateTree(tree).some((e) => e.kind === 'duplicate-id')).toBe(true);
    });

    it('flags an unknown root', () => {
      const tree: SkillTree = {
        root: 'missing',
        nodes: [{ id: 'a', label: 'A', cost: 0, effects: [], x: 0, y: 0, edges: [] }],
      };
      expect(validateTree(tree).some((e) => e.kind === 'unknown-root')).toBe(true);
    });

    it('flags asymmetric edges', () => {
      const tree: SkillTree = {
        root: 'a',
        nodes: [
          { id: 'a', label: 'A', cost: 0, effects: [], x: 0, y: 0, edges: ['b'] },
          { id: 'b', label: 'B', cost: 1, effects: [], x: 1, y: 0, edges: [] }, // does not mirror a
        ],
      };
      expect(validateTree(tree).some((e) => e.kind === 'asymmetric-edge')).toBe(true);
    });

    it('flags an edge to an unknown Node', () => {
      const tree: SkillTree = {
        root: 'a',
        nodes: [{ id: 'a', label: 'A', cost: 0, effects: [], x: 0, y: 0, edges: ['ghost'] }],
      };
      expect(validateTree(tree).some((e) => e.kind === 'unknown-edge')).toBe(true);
    });

    it('flags a self-edge', () => {
      const tree: SkillTree = {
        root: 'a',
        nodes: [{ id: 'a', label: 'A', cost: 0, effects: [], x: 0, y: 0, edges: ['a'] }],
      };
      expect(validateTree(tree).some((e) => e.kind === 'self-edge')).toBe(true);
    });

    it('flags a disconnected Node', () => {
      const tree: SkillTree = {
        root: 'a',
        nodes: [
          { id: 'a', label: 'A', cost: 0, effects: [], x: 0, y: 0, edges: ['b'] },
          { id: 'b', label: 'B', cost: 1, effects: [], x: 1, y: 0, edges: ['a'] },
          { id: 'island', label: 'Island', cost: 1, effects: [], x: 5, y: 5, edges: [] },
        ],
      };
      expect(validateTree(tree).some((e) => e.kind === 'disconnected')).toBe(true);
    });

    it('flags a non-positive cost on a non-root Node', () => {
      const tree: SkillTree = {
        root: 'a',
        nodes: [
          { id: 'a', label: 'A', cost: 0, effects: [], x: 0, y: 0, edges: ['b'] },
          { id: 'b', label: 'B', cost: 0, effects: [], x: 1, y: 0, edges: ['a'] },
        ],
      };
      expect(validateTree(tree).some((e) => e.kind === 'non-positive-cost')).toBe(true);
    });
  });
});
