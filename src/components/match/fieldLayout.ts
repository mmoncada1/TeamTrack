/**
 * Shared height used by the field canvas. On `sm+` it fills the full height
 * of its row (LiveMatchPage sizes that row to the available browser height,
 * minus the nav/header chrome). On narrow/mobile layouts the row stacks
 * instead of filling height, so we fall back to a viewport-percentage guess
 * — otherwise the field (which has no intrinsically-sized content, only
 * absolutely-positioned children) would collapse to 0 height.
 */
export const FIELD_HEIGHT_CLASS = 'h-[60vh] sm:h-full';
