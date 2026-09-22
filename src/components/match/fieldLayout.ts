/**
 * Shared height used by the field canvas. In `wide` (a landscape viewport with
 * room to spare) it fills the full height of its row (LiveMatchPage sizes that
 * row to the available browser height, minus the nav/header chrome). Otherwise
 * — mobile, or a laptop/tablet turned to portrait — the row stacks instead of
 * filling height, so we fall back to a viewport-percentage guess, otherwise
 * the field (which has no intrinsically-sized content, only absolutely-
 * positioned children) would collapse to 0 height. A portrait viewport is
 * usually tall, so this is also capped in px to keep the pitch from getting
 * comically tall and pushing the bench/sidebar content far below the fold.
 */
export const FIELD_HEIGHT_CLASS = 'h-[min(60vh,620px)] wide:h-full';
