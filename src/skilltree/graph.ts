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

/** Index a tree's Nodes by id for O(1) lookup. */
function nodeIndex(tree: SkillTree): Map<string, SkillTree['nodes'][number]> {
  const index = new Map<string, SkillTree['nodes'][number]>();
  for (const node of tree.nodes) index.set(node.id, node);
  return index;
}

/**
 * Whether `id` is owned. The root is always owned (implicitly); every other Node
 * is owned iff it appears in `save.ownedNodes`.
 */
export function isOwned(save: SaveData, tree: SkillTree, id: string): boolean {
  if (id === tree.root) return true;
  return save.ownedNodes.includes(id);
}

/**
 * Whether `id` can currently be bought: it exists, is not the root, is not
 * already owned, and is adjacent to at least one owned Node (the root counts,
 * so Nodes touching the root are purchasable from a fresh save). Affordability is
 * NOT checked here — that is `buy`'s job; this answers "is it reachable".
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
 * Buy Node `id`: validates it is purchasable (exists, reachable, unowned) and
 * affordable (`save.sp >= cost`), then returns a NEW save with the Node added and
 * its cost deducted. Returns the save unchanged (a fresh copy) when the purchase
 * is illegal — callers can compare identity or re-query to detect the no-op. The
 * input save is never mutated.
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
 * Respec (CONTEXT.md): all-or-nothing. Returns a NEW save with every owned Node
 * cleared and all spent SP refunded (the summed cost of the currently-owned
 * Nodes added back). The input save is never mutated. Unknown owned ids
 * contribute 0 to the refund.
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

/** A single structural problem found by {@link validateTree}. */
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

  // Unique ids.
  const seen = new Set<string>();
  for (const node of tree.nodes) {
    if (seen.has(node.id)) {
      errors.push({ kind: 'duplicate-id', message: `duplicate Node id "${node.id}"` });
    }
    seen.add(node.id);
  }

  const index = nodeIndex(tree);

  // Root exists.
  if (!index.has(tree.root)) {
    errors.push({ kind: 'unknown-root', message: `root "${tree.root}" is not a Node` });
  }

  // Costs (root may be 0; every other Node must be positive).
  for (const node of tree.nodes) {
    if (node.id === tree.root) continue;
    if (!(node.cost > 0)) {
      errors.push({ kind: 'non-positive-cost', message: `Node "${node.id}" has non-positive cost ${node.cost}` });
    }
  }

  // Edges: exist, no self-edge, symmetric.
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

  // Connectivity: BFS from the root over edges.
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
