/**
 * Skill Tree cursor navigation — pure geometry, canvas-free (ADR 0001). The
 * Console's tree screen moves a selection cursor between Nodes with the arrow
 * keys, and the cursor only ever travels along edges (CONTEXT.md: the tree is a
 * connected web). Given the current Node and a direction, this picks the
 * best-connected neighbor to hop to, using the abstract tree coordinates in
 * `NodeDef.x/y` (NOT the playfield — the Console pans a camera).
 *
 * "Best" = the adjacent Node whose direction from the current Node is closest to
 * the pressed arrow, among those within a 90° cone of it. Ties break toward the
 * nearer Node. If no neighbor lies in that cone, the cursor stays put.
 */
import type { SkillTree } from '../skilltree/types';

export type CursorDirection = 'up' | 'down' | 'left' | 'right';

/** Unit vector for each direction in tree space (y grows downward, screen-style). */
const DIRECTION_VECTORS: Record<CursorDirection, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function index(tree: SkillTree): Map<string, SkillTree['nodes'][number]> {
  const map = new Map<string, SkillTree['nodes'][number]>();
  for (const node of tree.nodes) map.set(node.id, node);

  return map;
}

/**
 * The neighbor to move to from `fromId` when `direction` is pressed, or `fromId`
 * itself when no adjacent Node lies in that direction. Only edges are followed,
 * so the cursor can never jump across a gap in the web.
 *
 * Selection rule: of the neighbors whose offset from the current Node points
 * within 90° of the arrow (dot product > 0), pick the one whose direction best
 * aligns with the arrow (largest cosine = dot / distance); break ties toward the
 * closer Node.
 */
export function nextCursor(tree: SkillTree, fromId: string, direction: CursorDirection): string {
  const nodes = index(tree);
  const current = nodes.get(fromId);
  if (!current) return fromId;

  const dir = DIRECTION_VECTORS[direction];

  let bestId = fromId;
  let bestAlignment = 0; // cosine of the angle to the arrow; must beat 0 (the 90° cone)
  let bestDistance = Infinity;

  for (const neighborId of current.edges) {
    const neighbor = nodes.get(neighborId);
    if (!neighbor) continue;

    const dx = neighbor.x - current.x;
    const dy = neighbor.y - current.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) continue; // coincident Nodes have no direction

    const dot = dx * dir.x + dy * dir.y;
    if (dot <= 0) continue; // outside the 90° cone toward the arrow

    const alignment = dot / distance;
    if (
      alignment > bestAlignment + 1e-9 ||
      (Math.abs(alignment - bestAlignment) <= 1e-9 && distance < bestDistance)
    ) {
      bestAlignment = alignment;
      bestDistance = distance;
      bestId = neighborId;
    }
  }

  return bestId;
}
