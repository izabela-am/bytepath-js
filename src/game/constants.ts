/**
 * Shared, engine-independent constants. The playfield is the fixed internal
 * resolution; main.ts upscales the canvas to fit the window with pixelated
 * rendering, so game code always works in these coordinates.
 */
export const PLAYFIELD_WIDTH = 480;
export const PLAYFIELD_HEIGHT = 270;
