import { Loop } from './engine/loop';
import { Input } from './engine/input';
import { RoomManager } from './core/Room';
import { Stage } from './rooms/Stage';
import { Sfx } from './audio/Sfx';
import { PLAYFIELD_WIDTH, PLAYFIELD_HEIGHT } from './game/constants';

/**
 * Entry point: wires the canvas, input, loop, and the initial Stage room.
 *
 * Rendering strategy: the canvas backing store is the fixed 480x270 internal
 * resolution; we upscale it to fill the window via CSS `width/height` with
 * `image-rendering: pixelated`, preferring integer scale factors for crisp
 * pixels and only falling back to fractional when the window is too small for a
 * whole multiple. All game code works in playfield coordinates.
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
  // Keep upscaled geometry crisp end-to-end.
  ctx.imageSmoothingEnabled = false;

  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));

  const input = new Input(window);
  const rooms = new RoomManager();
  const sfx = new Sfx();

  // Enter a fresh Stage. The death beat calls back here with the finished Run's
  // final Score so the new Stage can show a "LAST RUN" line (BYTEPATH has no win
  // condition — a Run always ends in death and a new one begins).
  const enterStage = (lastRunScore: number | null): void => {
    rooms.gotoRoom(new Stage(input, { sfx, lastRunScore, onRestart: enterStage }));
  };
  enterStage(null);

  // Audio can't start without a user gesture; resume the context on the first key
  // and toggle mute on 'M'. Handled at the window level so it works regardless of
  // which Stage is active.
  window.addEventListener('keydown', (e) => {
    sfx.resume();
    if (e.code === 'KeyM') sfx.toggleMute();
  });

  const loop = new Loop({
    update(dt) {
      rooms.update(dt);
      input.endFrame();
    },
    render() {
      rooms.draw(ctx);
    },
  });
  loop.start();
}

main();
