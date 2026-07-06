/**
 * Skill Tree graph queries — pure, canvas-free operations over a {@link SkillTree}
 * and a {@link SaveData} (CONTEXT.md: Nodes are adjacency-gated from the root,
 * permanent, undone only by an all-or-nothing Respec). No function mutates its
 * inputs; `buy` and `respec` return a new save.
 *
 * ## Root ownership
 *
 * The root is owned implicitly from the start at zero cost. It is NEVER listed in
 * `save.ownedNodes` — `ownedNodes` holds only bought Nodes. `isOwned` therefore
 * reports the root as owned even though it isn't in the array, and a Node
 * adjacent to the root is purchasable from a fresh save. This keeps "spent SP" =
 * "sum of owned Nodes' costs" clean (the root's 0 cost is never refunded because
 * it was never bought).
 */
import type { SaveData } from '../save/save';
import type { SkillTree } from './types';

function nodeIndex(tree: SkillTree): Map<string, SkillTree['nodes'][number]> {
  const index = new Map<string, SkillTree['nodes'][number]>();
  for (const node of tree.nodes) index.set(node.id, node);
  return index;
}

export function isOwned(save: SaveData, tree: SkillTree, id: string): boolean {
  if (id === tree.root) return true;
  return save.ownedNodes.includes(id);
}

/**
 * Affordability is NOT checked here — that is `buy`'s job; this answers
 * "is it reachable".
 */
export function isPurchasable(save: SaveData, tree: SkillTree, id: string): boolean {
  if (id === tree.root) return false;
  const index = nodeIndex(tree);
  const node = index.get(id);
  if (!node) return false;
  if (isOwned(save, tree, id)) return false;
  return node.edges.some((neighborId) => isOwned(save, tree, neighborId));
}

/**
 * Returns the save unchanged (a fresh copy) when the purchase is illegal —
 * callers can compare identity or re-query to detect the no-op.
 */
export function buy(save: SaveData, tree: SkillTree, id: string): SaveData {
  if (!isPurchasable(save, tree, id)) return { ...save, ownedNodes: [...save.ownedNodes] };

  const node = nodeIndex(tree).get(id)!;
  if (save.sp < node.cost) return { ...save, ownedNodes: [...save.ownedNodes] };

  return {
    ...save,
    sp: save.sp - node.cost,
    ownedNodes: [...save.ownedNodes, id],
  };
}

/**
 * Respec is all-or-nothing (CONTEXT.md): every owned Node is cleared and all
 * spent SP refunded. Unknown owned ids contribute 0 to the refund.
 */
export function respec(save: SaveData, tree: SkillTree): SaveData {
  const index = nodeIndex(tree);
  let refund = 0;
  for (const id of save.ownedNodes) {
    const node = index.get(id);
    if (node) refund += node.cost;
  }
  return { ...save, sp: save.sp + refund, ownedNodes: [] };
}

export interface TreeValidationError {
  kind: 'duplicate-id' | 'unknown-root' | 'asymmetric-edge' | 'unknown-edge' | 'disconnected' | 'non-positive-cost' | 'self-edge';
  message: string;
}

/**
 * Validate a tree's structural invariants, returning every problem found (empty
 * array = valid):
 *  - ids are unique;
 *  - the root id exists;
 *  - every edge references an existing Node and is not a self-edge;
 *  - edges are symmetric (if A lists B, B lists A);
 *  - every Node is reachable from the root (fully connected);
 *  - every non-root Node has a positive cost (the root may be 0).
 *
 * Authoring aid: run this over `data.ts` and any full tree in a test.
 */
export function validateTree(tree: SkillTree): TreeValidationError[] {
  const errors: TreeValidationError[] = [];

  const seen = new Set<string>();
  for (const node of tree.nodes) {
    if (seen.has(node.id)) {
      errors.push({ kind: 'duplicate-id', message: `duplicate Node id "${node.id}"` });
    }
    seen.add(node.id);
  }

  const index = nodeIndex(tree);

  if (!index.has(tree.root)) {
    errors.push({ kind: 'unknown-root', message: `root "${tree.root}" is not a Node` });
  }

  for (const node of tree.nodes) {
    if (node.id === tree.root) continue;
    if (!(node.cost > 0)) {
      errors.push({ kind: 'non-positive-cost', message: `Node "${node.id}" has non-positive cost ${node.cost}` });
    }
  }

  for (const node of tree.nodes) {
    for (const neighborId of node.edges) {
      if (neighborId === node.id) {
        errors.push({ kind: 'self-edge', message: `Node "${node.id}" has a self-edge` });
        continue;
      }
      const neighbor = index.get(neighborId);
      if (!neighbor) {
        errors.push({ kind: 'unknown-edge', message: `Node "${node.id}" edges to unknown "${neighborId}"` });
        continue;
      }
      if (!neighbor.edges.includes(node.id)) {
        errors.push({ kind: 'asymmetric-edge', message: `edge "${node.id}"->"${neighborId}" is not mirrored` });
      }
    }
  }

  if (index.has(tree.root)) {
    const reached = new Set<string>([tree.root]);
    const queue = [tree.root];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = index.get(current);
      if (!node) continue;
      for (const neighborId of node.edges) {
        if (!reached.has(neighborId) && index.has(neighborId)) {
          reached.add(neighborId);
          queue.push(neighborId);
        }
      }
    }
    for (const node of tree.nodes) {
      if (!reached.has(node.id)) {
        errors.push({ kind: 'disconnected', message: `Node "${node.id}" is unreachable from root` });
      }
    }
  }

  return errors;
}
