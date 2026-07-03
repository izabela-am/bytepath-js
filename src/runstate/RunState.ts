/**
 * Run lifecycle state machine — pure, canvas-free (CONTEXT.md: a Run runs from
 * Ship spawn to death, then a fresh Run begins; there is no win condition). The
 * Stage owns one of these to sequence the death beat and the restart into a
 * fresh Run, and to remember the previous Run's final Score so the HUD can show
 * a "LAST RUN" line for the first seconds of the new Run.
 *
 * States:
 *  - **playing**: normal gameplay; the Ship is alive.
 *  - **dying**: the Ship reached 0 HP. A short beat plays (death explosion +
 *    slow/pause) before the restart. `update` counts this down; when it elapses,
 *    `consumeRestart()` returns true exactly once so the Stage swaps in a fresh
 *    Stage via the RoomManager.
 *
 * After a restart the machine is back to `playing`, with `lastRunScore` holding
 * the Score of the Run that just ended and `sinceRestart` counting up so the HUD
 * can time out the "LAST RUN" line.
 */

/** Seconds the death beat lasts before restarting into a fresh Run. */
export const DEATH_BEAT_DURATION = 1.5;

/** How long the "LAST RUN" line lingers on the HUD after a restart. */
export const LAST_RUN_HUD_DURATION = 5;

export type RunPhase = 'playing' | 'dying';

export class RunState {
  private phase: RunPhase = 'playing';
  /** Seconds remaining in the death beat while `dying`. */
  private deathTimer = 0;
  /** Final Score of the previous Run, or null before the first death. */
  private _lastRunScore: number | null = null;
  /** Seconds since the most recent restart (or Run start). */
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

  /** True while the Ship is alive and gameplay runs normally. */
  get isPlaying(): boolean {
    return this.phase === 'playing';
  }

  /** True during the post-death beat, before the restart. */
  get isDying(): boolean {
    return this.phase === 'dying';
  }

  /** Final Score of the previous Run, or null if none has ended yet. */
  get lastRunScore(): number | null {
    return this._lastRunScore;
  }

  /** Seconds since the most recent restart, for timing the "LAST RUN" HUD line. */
  get sinceRestart(): number {
    return this._sinceRestart;
  }

  /** Whether the "LAST RUN" line should still be shown on the HUD. */
  get showLastRun(): boolean {
    return this._lastRunScore !== null && this._sinceRestart < LAST_RUN_HUD_DURATION;
  }

  /**
   * Report the Ship's death with the Run's final Score. Begins the death beat.
   * Idempotent: a second death report while already dying is ignored.
   */
  die(finalScore: number): void {
    if (this.phase === 'dying') return;
    this.phase = 'dying';
    this.deathTimer = DEATH_BEAT_DURATION;
    this._lastRunScore = finalScore;
    this.restartPending = true;
  }

  /**
   * Advance the state by `dt`. While playing, tracks time since restart. While
   * dying, counts down the death beat.
   */
  update(dt: number): void {
    this._sinceRestart += dt;
    if (this.phase === 'dying') {
      this.deathTimer -= dt;
    }
  }

  /**
   * If the death beat has fully elapsed, consume the pending restart: reset to
   * `playing`, zero the since-restart clock, and return true exactly once so the
   * caller can swap in a fresh Stage. Returns false otherwise.
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
