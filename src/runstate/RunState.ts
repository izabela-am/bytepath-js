/**
 * Run lifecycle state machine (CONTEXT.md: a Run runs from Ship spawn to death,
 * then a fresh Run begins; there is no win condition). The "death beat" is the
 * short pause (death explosion + slow/pause) between reaching 0 HP and the
 * restart into a fresh Stage.
 */

/** Seconds the death beat lasts before restarting into a fresh Run. */
export const DEATH_BEAT_DURATION = 1.5;

/** How long the "LAST RUN" line lingers on the HUD after a restart. */
export const LAST_RUN_HUD_DURATION = 5;

export type RunPhase = 'playing' | 'dying';

export class RunState {
  private phase: RunPhase = 'playing';
  private deathTimer = 0;
  private _lastRunScore: number | null = null;
  private _sinceRestart = 0;
  /** Latched so `consumeRestart` fires exactly once per death. */
  private restartPending = false;

  /**
   * @param lastRunScore Score of the Run that preceded this one, if any. A fresh
   *   Stage created on restart passes the dead Run's final Score here so the HUD
   *   can show the "LAST RUN" line at the start of the new Run.
   */
  constructor(lastRunScore: number | null = null) {
    this._lastRunScore = lastRunScore;
  }

  get isPlaying(): boolean {
    return this.phase === 'playing';
  }

  get isDying(): boolean {
    return this.phase === 'dying';
  }

  get lastRunScore(): number | null {
    return this._lastRunScore;
  }

  get sinceRestart(): number {
    return this._sinceRestart;
  }

  get showLastRun(): boolean {
    return this._lastRunScore !== null && this._sinceRestart < LAST_RUN_HUD_DURATION;
  }

  /** Idempotent: a second death report while already dying is ignored. */
  die(finalScore: number): void {
    if (this.phase === 'dying') return;
    this.phase = 'dying';
    this.deathTimer = DEATH_BEAT_DURATION;
    this._lastRunScore = finalScore;
    this.restartPending = true;
  }

  update(dt: number): void {
    this._sinceRestart += dt;
    if (this.phase === 'dying') {
      this.deathTimer -= dt;
    }
  }

  /**
   * Returns true exactly once per death, after the death beat has fully
   * elapsed, so the caller can swap in a fresh Stage.
   */
  consumeRestart(): boolean {
    if (this.phase !== 'dying' || !this.restartPending || this.deathTimer > 0) {
      return false;
    }
    this.restartPending = false;
    this.phase = 'playing';
    this._sinceRestart = 0;

    return true;
  }
}
