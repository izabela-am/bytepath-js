/**
 * The Console menu state machine — pure and canvas-free (ADR 0001: decision
 * logic stays out of draw code). It models the arrow-key-driven main menu: a
 * highlighted cursor moving over a fixed list of entries, Enter activating the
 * selected entry, the two-step Respec confirm, and the two toggles (scanlines,
 * sound). No typed commands (ADR 0002).
 *
 * The ConsoleRoom owns rendering and the side effects each action triggers
 * (starting a Run, opening the tree, respeccing the save, flipping a pref); this
 * module only says *what* the menu is showing and *which* action a keypress
 * fires. It never touches the save, the tree, or storage.
 */

/** The stable set of menu entries, in display order. */
export type MenuEntry = 'new-run' | 'skill-tree' | 'respec' | 'scanlines' | 'sound';

/** Menu entries in the fixed vertical order the cursor walks. */
export const MENU_ENTRIES: readonly MenuEntry[] = [
  'new-run',
  'skill-tree',
  'respec',
  'scanlines',
  'sound',
];

/**
 * The action a confirmed Enter fires. `none` means the press was consumed
 * internally (e.g. arming the Respec confirm) with no outward effect yet.
 */
export type MenuAction =
  | 'none'
  | 'start-run'
  | 'open-tree'
  | 'respec'
  | 'toggle-scanlines'
  | 'toggle-sound';

export class MenuState {
  private index = 0;
  /** True once Respec has been armed and is awaiting a confirming Enter. */
  private respecArmed = false;

  /** Index of the highlighted entry. */
  get selectedIndex(): number {
    return this.index;
  }

  /** The highlighted entry. */
  get selected(): MenuEntry {
    // MENU_ENTRIES is non-empty and index is always kept in range.
    return MENU_ENTRIES[this.index] as MenuEntry;
  }

  /** Whether the Respec entry is currently armed (showing its "confirm?" state). */
  get isRespecArmed(): boolean {
    return this.respecArmed;
  }

  /** Move the cursor up one entry (wraps). Cancels a pending Respec confirm. */
  moveUp(): void {
    this.respecArmed = false;
    this.index = (this.index - 1 + MENU_ENTRIES.length) % MENU_ENTRIES.length;
  }

  /** Move the cursor down one entry (wraps). Cancels a pending Respec confirm. */
  moveDown(): void {
    this.respecArmed = false;
    this.index = (this.index + 1) % MENU_ENTRIES.length;
  }

  /**
   * Activate the highlighted entry. Respec needs two Enters: the first arms it
   * (returns `none`, `isRespecArmed` becomes true), the second fires `respec`.
   * Moving the cursor between the two presses cancels the arm. Every other entry
   * fires its action on a single Enter.
   */
  confirm(): MenuAction {
    const entry = this.selected;

    if (entry === 'respec') {
      if (!this.respecArmed) {
        this.respecArmed = true;
        return 'none';
      }
      this.respecArmed = false;
      return 'respec';
    }

    // Any other activation clears a stray armed state.
    this.respecArmed = false;
    switch (entry) {
      case 'new-run':
        return 'start-run';
      case 'skill-tree':
        return 'open-tree';
      case 'scanlines':
        return 'toggle-scanlines';
      case 'sound':
        return 'toggle-sound';
    }
  }

  /**
   * Reset transient state when the menu is (re)shown — e.g. returning from the
   * tree or from a finished Run. Keeps the cursor position; only disarms Respec.
   */
  reset(): void {
    this.respecArmed = false;
  }
}
