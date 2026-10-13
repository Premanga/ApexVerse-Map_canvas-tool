/** Class strings shared by the panels, so they cannot drift apart. */

/** The small upper-case caption over a group of controls. */
export const CAPTION =
  'text-[10px] font-medium uppercase tracking-wider text-neutral-500';

/**
 * Enter transitions: an element that arrives rather than just appearing.
 *
 * `starting:` is CSS `@starting-style` — the style an element has on the
 * frame it is first drawn — so the transition runs from there to its normal
 * state when it mounts, with no keyframes and no JavaScript. There is no
 * matching exit: an unmounted element is simply gone, and keeping it around
 * to animate out is not worth the bookkeeping for a panel.
 *
 * `transition` (not `transition-colors`) on purpose: it covers opacity and
 * movement as well as colours, so an element takes ONE of these and no other
 * transition utility — two would fight, and the later would win. All stand
 * down when the system asks for reduced motion.
 */
const ENTER =
  'transition duration-200 ease-out motion-reduce:transition-none starting:opacity-0';

export const ENTER_FADE = ENTER;
/** For what belongs to the right edge: the contextual panels. */
export const ENTER_FROM_RIGHT = `${ENTER} starting:translate-x-3`;
/** For what hangs from the top: the bar, prompts and banners. */
export const ENTER_FROM_TOP = `${ENTER} starting:-translate-y-2`;
/** For what sits at the bottom: notices. */
export const ENTER_FROM_BOTTOM = `${ENTER} starting:translate-y-2`;
/** For what opens in place: a dialog, a lone button. */
export const ENTER_POP = `${ENTER} starting:scale-95`;

/**
 * Shared by everything that moves when a panel opens or closes. Opening
 * decelerates into place; closing eases at both ends so it does not snap
 * away from rest.
 */
export const panelMotion = (open: boolean) =>
  `duration-[220ms] motion-reduce:transition-none ${open ? 'ease-out' : 'ease-in-out'}`;
