/**
 * The Console — the between-Runs hub Room (ADR 0002), styled as a boot-up
 * terminal and driven entirely by the arrow keys and Enter (no typed commands).
 * The game boots into it, every Run launches from it, and death returns to it
 * showing the finished Run's numbers. It hosts the Skill Tree.
 *
 * This is a single Room with three internal SCREENS (boot / menu / tree), NOT
 * three RoomManager rooms — the RoomManager only swaps between the Console and
 * the Stage. Screen state lives here; the decision logic behind each screen is in
 * the pure, tested sibling modules (`bootSequence`, `menuState`, `treeCursor`,
 * `prefs`) so this file stays thin per ADR 0001 and only touches the canvas in
 * `draw`.
 *
 * The Console never runs a Run itself: `new run` calls back to main.ts (via
 * `onStartRun`), which snapshots `RunModifiers` and swaps in a Stage. Tree
 * purchases persist immediately through the injected save callbacks.
 */
import type { Room } from '../core/Room';
import type { Input } from '../engine/input';
import { Timer } from '../engine/timer';
import { Palette } from '../game/palette';
import { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from '../game/constants';
import type { SaveData } from '../save/save';
import type { SkillTree } from '../skilltree/types';
import { buy, isOwned, isPurchasable } from '../skilltree/graph';
import { BootSequence } from './bootSequence';
import { MenuState, type MenuAction } from './menuState';
import { nextCursor, type CursorDirection } from './treeCursor';

/** The Run results the menu displays (all optional until the first Run ends). */
export interface RunResults {
  lastRunScore: number | null;
  bestScore: number;
  spEarnedLastRun: number | null;
}

/** Everything the ConsoleRoom needs to run — all side effects injected. */
export interface ConsoleDeps {
  input: Input;
  tree: SkillTree;
  /** Current save; the Console reads SP + owned Nodes and re-reads after a buy/respec. */
  getSave(): SaveData;
  /** Replace the save (persist immediately). Called after a Node purchase. */
  setSave(save: SaveData): void;
  /** All-or-nothing Respec, persisted; returns the new save. */
  respec(): SaveData;
  /** Launch a Run from the current save (main.ts snapshots RunModifiers + swaps in a Stage). */
  onStartRun(): void;
  /** Read/toggle the scanlines pref (persisted by the owner). */
  getScanlines(): boolean;
  toggleScanlines(): boolean;
  /** Read/toggle sound; wired to the shared Sfx mute (persisted by the owner). */
  getSoundOn(): boolean;
  toggleSound(): boolean;
  /** Run results to show on the menu. */
  results: RunResults;
  /** Skip the boot animation and open straight on the menu (used after a Run). */
  skipBoot?: boolean;
}

type Screen = 'boot' | 'menu' | 'tree';

/** Camera pan duration (seconds) when the tree cursor hops between Nodes. */
const CAMERA_TWEEN = 0.18;

/** Pixels per tree-coordinate unit when laying the tree out on screen. */
const TREE_SCALE = 46;

/** Node circle radius on screen. */
const NODE_RADIUS = 7;

export class ConsoleRoom implements Room {
  private readonly deps: ConsoleDeps;
  private readonly timer = new Timer();

  private screen: Screen;
  private readonly boot = new BootSequence();
  private readonly menu = new MenuState();

  /** Tree screen: the selected Node id and a camera the arrow keys pan. */
  private cursorId: string;
  private readonly camera = { x: 0, y: 0 };

  /** Drives the "pulsing" affordable-Node highlight and cursor blink. */
  private pulse = 0;

  constructor(deps: ConsoleDeps) {
    this.deps = deps;
    this.cursorId = deps.tree.root;
    if (deps.skipBoot) {
      this.boot.skip();
      this.screen = 'menu';
    } else {
      this.screen = 'boot';
    }
    this.centerCameraOn(this.cursorId, true);
  }

  update(dt: number): void {
    this.timer.update(dt);
    this.pulse += dt;

    switch (this.screen) {
      case 'boot':
        this.updateBoot(dt);
        break;
      case 'menu':
        this.updateMenu();
        break;
      case 'tree':
        this.updateTree();
        break;
    }
  }

  // --- Boot screen ---------------------------------------------------------

  private updateBoot(dt: number): void {
    this.boot.update(dt);
    // Any key skips to (or reveals) the menu.
    if (this.anyKeyPressed()) this.boot.skip();
    if (this.boot.done) this.screen = 'menu';
  }

  // --- Menu screen ---------------------------------------------------------

  private updateMenu(): void {
    const input = this.deps.input;
    if (input.pressed('ArrowUp')) this.menu.moveUp();
    if (input.pressed('ArrowDown')) this.menu.moveDown();
    if (input.pressed('Enter') || input.pressed('Space')) {
      this.applyMenuAction(this.menu.confirm());
    }
  }

  private applyMenuAction(action: MenuAction): void {
    switch (action) {
      case 'start-run':
        this.deps.onStartRun();
        break;
      case 'open-tree':
        this.openTree();
        break;
      case 'respec':
        this.deps.respec();
        break;
      case 'toggle-scanlines':
        this.deps.toggleScanlines();
        break;
      case 'toggle-sound':
        this.deps.toggleSound();
        break;
      case 'none':
        break;
    }
  }

  private openTree(): void {
    this.screen = 'tree';
    // Start the cursor on the root each time the tree is opened.
    this.cursorId = this.deps.tree.root;
    this.centerCameraOn(this.cursorId, true);
  }

  // --- Tree screen ---------------------------------------------------------

  private updateTree(): void {
    const input = this.deps.input;
    if (input.pressed('Escape')) {
      this.menu.reset();
      this.screen = 'menu';
      return;
    }

    const dir = this.pressedDirection();
    if (dir) {
      const next = nextCursor(this.deps.tree, this.cursorId, dir);
      if (next !== this.cursorId) {
        this.cursorId = next;
        this.centerCameraOn(next, false);
      }
    }

    if (input.pressed('Enter') || input.pressed('Space')) {
      this.tryBuy(this.cursorId);
    }
  }

  private tryBuy(id: string): void {
    const save = this.deps.getSave();
    if (!isPurchasable(save, this.deps.tree, id)) return;
    const node = this.nodeById(id);
    if (!node || save.sp < node.cost) return;
    // buy() validates again and returns a new save; persist it immediately.
    this.deps.setSave(buy(save, this.deps.tree, id));
  }

  /** The arrow direction pressed this frame, or null. */
  private pressedDirection(): CursorDirection | null {
    const input = this.deps.input;
    if (input.pressed('ArrowUp')) return 'up';
    if (input.pressed('ArrowDown')) return 'down';
    if (input.pressed('ArrowLeft')) return 'left';
    if (input.pressed('ArrowRight')) return 'right';
    return null;
  }

  /** Pan the camera so the given Node sits at the screen center. */
  private centerCameraOn(id: string, snap: boolean): void {
    const node = this.nodeById(id);
    if (!node) return;
    const targetX = node.x * TREE_SCALE;
    const targetY = node.y * TREE_SCALE;
    this.timer.cancelTag('camera');
    if (snap) {
      this.camera.x = targetX;
      this.camera.y = targetY;
    } else {
      this.timer.tween(CAMERA_TWEEN, this.camera, { x: targetX, y: targetY }, undefined, undefined, 'camera');
    }
  }

  private nodeById(id: string): SkillTree['nodes'][number] | undefined {
    return this.deps.tree.nodes.find((n) => n.id === id);
  }

  // --- Input helpers -------------------------------------------------------

  private anyKeyPressed(): boolean {
    const input = this.deps.input;
    return (
      input.pressed('Enter') ||
      input.pressed('Space') ||
      input.pressed('ArrowUp') ||
      input.pressed('ArrowDown') ||
      input.pressed('ArrowLeft') ||
      input.pressed('ArrowRight') ||
      input.pressed('Escape') ||
      input.pressed('KeyM')
    );
  }

  // --- Rendering (the only place this Room touches the canvas) -------------

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = Palette.background;
    ctx.fillRect(0, 0, PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT);
    ctx.save();
    ctx.font = '8px monospace';
    ctx.textBaseline = 'alphabetic';

    switch (this.screen) {
      case 'boot':
        this.drawBoot(ctx);
        break;
      case 'menu':
        this.drawMenu(ctx);
        break;
      case 'tree':
        this.drawTree(ctx);
        break;
    }

    ctx.restore();
  }

  private drawBoot(ctx: CanvasRenderingContext2D): void {
    const view = this.boot.view();
    ctx.fillStyle = Palette.ammo; // green terminal text
    ctx.textAlign = 'left';
    let y = 20;
    for (const line of view.completedLines) {
      ctx.fillText(line, 12, y);
      y += 12;
    }
    if (view.currentLine) {
      // Blinking cursor block trails the line currently typing.
      const blink = Math.floor(this.pulse * 3) % 2 === 0;
      ctx.fillText(view.currentLine + (blink ? '_' : ''), 12, y);
    }
  }

  private drawMenu(ctx: CanvasRenderingContext2D): void {
    const save = this.deps.getSave();

    // Header + SP bank.
    ctx.fillStyle = Palette.default;
    ctx.textAlign = 'left';
    ctx.fillText('BYTEPATH', 12, 22);
    ctx.fillStyle = Palette.sp;
    ctx.textAlign = 'right';
    ctx.fillText(`SP ${save.sp}`, PLAYFIELD_WIDTH - 12, 22);

    // Menu entries.
    const labels = this.menuLabels();
    ctx.textAlign = 'left';
    let y = 90;
    for (let i = 0; i < labels.length; i++) {
      const selected = i === this.menu.selectedIndex;
      ctx.fillStyle = selected ? Palette.ammo : Palette.defaultDim;
      const prefix = selected ? '> ' : '  ';
      ctx.fillText(prefix + (labels[i] ?? ''), 24, y);
      y += 16;
    }

    // Run results block (bottom-left).
    this.drawResults(ctx);
  }

  private menuLabels(): string[] {
    const scan = this.deps.getScanlines() ? 'on' : 'off';
    const sound = this.deps.getSoundOn() ? 'on' : 'off';
    const respec = this.menu.isRespecArmed ? 'respec  confirm?' : 'respec';
    return ['new run', 'skill tree', respec, `scanlines: ${scan}`, `sound: ${sound}`];
  }

  private drawResults(ctx: CanvasRenderingContext2D): void {
    const r = this.deps.results;
    ctx.textAlign = 'left';
    let y = PLAYFIELD_HEIGHT - 42;

    if (r.lastRunScore !== null) {
      ctx.fillStyle = Palette.score;
      ctx.fillText(`LAST RUN ${r.lastRunScore}`, 12, y);
      y += 12;
    }
    ctx.fillStyle = Palette.score;
    ctx.fillText(`BEST ${r.bestScore}`, 12, y);
    y += 12;
    if (r.spEarnedLastRun !== null) {
      ctx.fillStyle = Palette.sp;
      ctx.fillText(`SP EARNED ${r.spEarnedLastRun}`, 12, y);
    }
  }

  private drawTree(ctx: CanvasRenderingContext2D): void {
    const save = this.deps.getSave();
    const tree = this.deps.tree;
    const originX = PLAYFIELD_WIDTH / 2 - this.camera.x;
    const originY = PLAYFIELD_HEIGHT / 2 - this.camera.y;
    const toScreen = (nx: number, ny: number): { sx: number; sy: number } => ({
      sx: originX + nx * TREE_SCALE,
      sy: originY + ny * TREE_SCALE,
    });

    // Edges first (each undirected edge drawn once, from the lower id).
    ctx.strokeStyle = Palette.defaultDim;
    ctx.lineWidth = 1;
    for (const node of tree.nodes) {
      const a = toScreen(node.x, node.y);
      for (const neighborId of node.edges) {
        if (node.id >= neighborId) continue;
        const neighbor = this.nodeById(neighborId);
        if (!neighbor) continue;
        const b = toScreen(neighbor.x, neighbor.y);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
    }

    // Nodes.
    const pulseT = 0.5 + 0.5 * Math.sin(this.pulse * 5);
    for (const node of tree.nodes) {
      const { sx, sy } = toScreen(node.x, node.y);
      const owned = isOwned(save, tree, node.id);
      const purchasable = isPurchasable(save, tree, node.id);
      const affordable = purchasable && save.sp >= node.cost;

      ctx.beginPath();
      ctx.arc(sx, sy, NODE_RADIUS, 0, Math.PI * 2);
      if (owned) {
        // Bright + filled.
        ctx.fillStyle = Palette.sp;
        ctx.fill();
        ctx.strokeStyle = Palette.default;
        ctx.stroke();
      } else if (affordable) {
        // Pulsing outline between dim and bright.
        ctx.strokeStyle = pulseT > 0.5 ? Palette.sp : Palette.defaultDim;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
      } else if (purchasable) {
        // Reachable but unaffordable: normal dim.
        ctx.strokeStyle = Palette.defaultDim;
        ctx.stroke();
      } else {
        // Unreachable: darkest.
        ctx.strokeStyle = '#3a3a3a';
        ctx.stroke();
      }
    }

    // Selection cursor: a blinking ring around the selected Node.
    const sel = this.nodeById(this.cursorId);
    if (sel) {
      const { sx, sy } = toScreen(sel.x, sel.y);
      if (Math.floor(this.pulse * 4) % 2 === 0) {
        ctx.strokeStyle = Palette.negative;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, NODE_RADIUS + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Top strip: SP bank.
    ctx.fillStyle = Palette.sp;
    ctx.textAlign = 'right';
    ctx.fillText(`SP ${save.sp}`, PLAYFIELD_WIDTH - 12, 16);
    ctx.fillStyle = Palette.defaultDim;
    ctx.textAlign = 'left';
    ctx.fillText('SKILL TREE', 12, 16);

    // Bottom info strip for the selected Node.
    this.drawNodeInfo(ctx, save);
  }

  private drawNodeInfo(ctx: CanvasRenderingContext2D, save: SaveData): void {
    const node = this.nodeById(this.cursorId);
    if (!node) return;
    const tree = this.deps.tree;
    const owned = isOwned(save, tree, node.id);
    const purchasable = isPurchasable(save, tree, node.id);
    const affordable = purchasable && save.sp >= node.cost;

    const y = PLAYFIELD_HEIGHT - 26;
    ctx.textAlign = 'left';
    ctx.fillStyle = Palette.default;
    ctx.fillText(node.label.toUpperCase(), 12, y);

    // Effect summary.
    ctx.fillStyle = Palette.defaultDim;
    ctx.fillText(this.effectSummary(node), 12, y + 11);

    // Status / cost, right-aligned.
    ctx.textAlign = 'right';
    let status: string;
    let color: string;
    if (owned) {
      status = 'OWNED';
      color = Palette.sp;
    } else if (affordable) {
      status = `BUY  ${node.cost} SP`;
      color = Palette.ammo;
    } else if (purchasable) {
      status = `NEED ${node.cost} SP`;
      color = Palette.hp;
    } else {
      status = `LOCKED  ${node.cost} SP`;
      color = Palette.defaultDim;
    }
    ctx.fillStyle = color;
    ctx.fillText(status, PLAYFIELD_WIDTH - 12, y);

    ctx.fillStyle = Palette.defaultDim;
    ctx.fillText('ENTER buy   ESC back', PLAYFIELD_WIDTH - 12, y + 11);
  }

  private effectSummary(node: SkillTree['nodes'][number]): string {
    if (node.effects.length === 0) return 'core';
    return node.effects
      .map((e) => {
        const sign = e.amount >= 0 ? '+' : '';
        const value = e.kind === 'percent' ? `${sign}${Math.round(e.amount * 100)}%` : `${sign}${e.amount}`;
        return `${value} ${e.stat}`;
      })
      .join('  ');
  }

  destroy(): void {
    this.timer.clear();
  }
}
