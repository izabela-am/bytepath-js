/**
 * Retro sound effects synthesized with the WebAudio API — no binary assets. Each
 * effect is a short oscillator or noise burst shaped by a gain envelope, in the
 * spirit of a chiptune arcade shooter. A single master gain sits in front of the
 * destination so everything can be muted at once.
 *
 * Autoplay policy: the AudioContext is created lazily on the first call to
 * `resume()` (wired to the first user keypress in main.ts / Stage), because
 * browsers block audio that starts without a user gesture. All play methods are
 * no-ops until the context exists, so game logic can call them freely.
 *
 * This module is a leaf: it touches only WebAudio, never the canvas or game
 * state, and is excluded from unit tests (no audio in the test environment).
 */

type NoiseKind = 'white';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  /** Master volume when unmuted (kept modest so effects don't clip). */
  private static readonly MASTER_VOLUME = 0.25;

  /** Call from a user-gesture handler (keydown). Safe to call repeatedly. */
  resume(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return; // no WebAudio available — stay silent
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : Sfx.MASTER_VOLUME;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Returns the new muted state. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : Sfx.MASTER_VOLUME;

    return this.muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Short high blip. */
  fire(): void {
    this.tone({ type: 'square', startFreq: 660, endFreq: 440, duration: 0.08, gain: 0.5 });
  }

  /** Tight click. */
  enemyHit(): void {
    this.tone({ type: 'square', startFreq: 320, endFreq: 220, duration: 0.06, gain: 0.4 });
  }

  /** Descending burst plus a noise puff. */
  enemyDeath(): void {
    this.tone({ type: 'sawtooth', startFreq: 300, endFreq: 80, duration: 0.22, gain: 0.5 });
    this.noise({ kind: 'white', duration: 0.18, gain: 0.3 });
  }

  /** Harsh low buzz. */
  shipHit(): void {
    this.tone({ type: 'sawtooth', startFreq: 200, endFreq: 60, duration: 0.2, gain: 0.6 });
  }

  /** Bright rising chime. */
  pickup(): void {
    this.tone({ type: 'triangle', startFreq: 520, endFreq: 880, duration: 0.14, gain: 0.5 });
  }

  /** Long descending noise + tone crash. */
  shipDeath(): void {
    this.tone({ type: 'sawtooth', startFreq: 220, endFreq: 40, duration: 0.6, gain: 0.6 });
    this.noise({ kind: 'white', duration: 0.5, gain: 0.4 });
  }

  private tone(opts: {
    type: OscillatorType;
    startFreq: number;
    endFreq: number;
    duration: number;
    gain: number;
  }): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.endFreq), now + opts.duration);

    env.gain.setValueAtTime(opts.gain, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);

    osc.connect(env);
    env.connect(master);
    osc.start(now);
    osc.stop(now + opts.duration + 0.02);
  }

  private noise(opts: { kind: NoiseKind; duration: number; gain: number }): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const now = ctx.currentTime;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * opts.duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const env = ctx.createGain();
    env.gain.setValueAtTime(opts.gain, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);

    src.connect(env);
    env.connect(master);
    src.start(now);
    src.stop(now + opts.duration + 0.02);
  }
}
