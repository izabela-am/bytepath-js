import { Loop } from './engine/loop';
import { Input } from './engine/input';
import { RoomManager } from './core/Room';
import { Stage } from './rooms/Stage';
import { Sfx } from './audio/Sfx';
import { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from './game/constants';
import { drawScanlines } from './game/scanlines';
import { ConsoleRoom, type RunResults } from './console/ConsoleRoom';
import { browserStorage, load, store, type SaveData, type SaveStorage } from './save/save';
import { computeRunModifiers } from './skilltree/modifiers';
import { respec as respecSave } from './skilltree/graph';
import { loadPrefs, storePrefs, type Prefs } from './console/prefs';
import * as treeData from './skilltree/data';
import type { SkillTree } from './skilltree/types';

/**
 * Entry point: wires the canvas, input, loop, and the Console <-> Stage flow.
 *
 * v2 boots into the Console (ADR 0002), not a Stage. `new run` snapshots a
 * `RunModifiers` value from the owned Skill Tree Nodes and swaps in a Stage;
 * death banks the Run's SP + best Score into the save and returns to the Console
 * (menu screen, showing the finished Run). Scanlines are a global overlay drawn
 * last over whatever Room is active, toggled from the Console and persisted under
 * a separate prefs key.
 *
 * Rendering strategy: the canvas backing store is the fixed 480x270 internal
 * resolution; we upscale it to fill the window via CSS `width/height` with
 * `image-rendering: pixelated`, preferring integer scale factors and only
 * falling back to fractional when the window is too small for a whole multiple.
 */

function isTouchOnly(): boolean {
  // Coarse pointer + no fine pointer ~= phone/tablet with no physical keyboard.
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const fine = window.matchMedia('(pointer: fine)').matches;
  return coarse && !fine;
}

function showKeyboardRequired(): void {
  const notice = document.getElementById('no-keyboard');
  const app = document.getElementById('app');
  if (notice) notice.style.display = 'flex';
  if (app) app.style.display = 'none';
}

function fitCanvas(canvas: HTMLCanvasElement): void {
  const scaleX = window.innerWidth / PLAYFIELD_WIDTH;
  const scaleY = window.innerHeight / PLAYFIELD_HEIGHT;
  let scale = Math.min(scaleX, scaleY);
  // Prefer a whole-number scale for crisp pixels; only go fractional if the
  // window can't fit even a 1x playfield.
  if (scale >= 1) scale = Math.floor(scale);
  const cssWidth = Math.round(PLAYFIELD_WIDTH * scale);
  const cssHeight = Math.round(PLAYFIELD_HEIGHT * scale);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
}

/**
 * The shipped Skill Tree. A parallel agent authors the full ~25–35 Node tree as
 * `skillTree` in `src/skilltree/data.ts`; until it lands we fall back to the
 * illustrative `sampleTree`. Resolved at runtime so either export works.
 */
function resolveSkillTree(): SkillTree {
  const full = (treeData as { skillTree?: SkillTree }).skillTree;
  return full ?? treeData.sampleTree;
}

/** In-memory storage fallback so persistence silently no-ops off-browser. */
function memoryStorage(): SaveStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function main(): void {
  if (isTouchOnly()) {
    showKeyboardRequired();
    return;
  }

  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('main: #game canvas not found');

  canvas.width = PLAYFIELD_WIDTH;
  canvas.height = PLAYFIELD_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('main: 2D canvas context unavailable');
  ctx.imageSmoothingEnabled = false;

  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));

  const input = new Input(window);
  const rooms = new RoomManager();
  const sfx = new Sfx();
  const tree = resolveSkillTree();
  const storage: SaveStorage = browserStorage() ?? memoryStorage();

  // The mutable save lives here; the Console reads and re-stores it.
  let save: SaveData = load(storage);

  // Cosmetic prefs live under their own key, never touching the save schema.
  const prefs: Prefs = loadPrefs(storage);
  // The prefs sound flag is the source of truth on load; sync the shared Sfx to it.
  if (!prefs.sound !== sfx.isMuted) sfx.toggleMute();

  const results: RunResults = {
    lastRunScore: null,
    bestScore: save.bestScore,
    spEarnedLastRun: null,
  };

  const persistPrefs = (): void => storePrefs(storage, prefs);

  const enterConsole = (skipBoot: boolean): void => {
    rooms.gotoRoom(
      new ConsoleRoom({
        input,
        tree,
        getSave: () => save,
        setSave: (next) => {
          save = next;
          store(storage, save);
        },
        respec: () => {
          save = respecSave(save, tree);
          store(storage, save);
          return save;
        },
        onStartRun: () => enterStage(),
        getScanlines: () => prefs.scanlines,
        toggleScanlines: () => {
          prefs.scanlines = !prefs.scanlines;
          persistPrefs();
          return prefs.scanlines;
        },
        getSoundOn: () => !sfx.isMuted,
        toggleSound: () => {
          const muted = sfx.toggleMute();
          prefs.sound = !muted;
          persistPrefs();
          return !muted;
        },
        results,
        skipBoot,
      }),
    );
  };

  // Launch a Run from the current save: snapshot RunModifiers, hand the Stage the
  // last Run's Score for its "LAST RUN" HUD line, and route its restart callback
  // back through the Console (banking SP + best Score first).
  const enterStage = (): void => {
    const runModifiers = computeRunModifiers(save.ownedNodes, tree);
    rooms.gotoRoom(
      new Stage(input, {
        sfx,
        runModifiers,
        lastRunScore: results.lastRunScore,
        onRestart: (finalScore: number, spEarned: number) => {
          save = { ...save, sp: save.sp + spEarned, bestScore: Math.max(save.bestScore, finalScore) };
          store(storage, save);
          results.lastRunScore = finalScore;
          results.bestScore = save.bestScore;
          results.spEarnedLastRun = spEarned;
          // Return to the Console's menu (no re-boot) showing the finished Run.
          enterConsole(true);
        },
      }),
    );
  };

  enterConsole(false);

  // Audio can't start without a user gesture; resume on the first key and toggle
  // mute on 'M' (keeping v1's global shortcut). Handled at the window level so it
  // works in any Room. When muted via KeyM, mirror the pref so it persists.
  window.addEventListener('keydown', (e) => {
    sfx.resume();
    if (e.code === 'KeyM') {
      const muted = sfx.toggleMute();
      prefs.sound = !muted;
      persistPrefs();
    }
  });

  // Accumulated render time drives the scanline flicker.
  let renderTime = 0;

  const loop = new Loop({
    update(dt) {
      renderTime += dt;
      rooms.update(dt);
      input.endFrame();
    },
    render() {
      rooms.draw(ctx);
      // Global overlay, drawn LAST over the active Room (Console or Stage).
      if (prefs.scanlines) drawScanlines(ctx, renderTime);
    },
  });
  loop.start();
}

main();
