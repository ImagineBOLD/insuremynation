import { Children } from 'react';
import { motion } from 'framer-motion';

/**
 * Scroll-triggered entrance primitives used across the insurance pages.
 *
 * The design's own easing language is `cubic-bezier(0.22, 1, 0.36, 1)` (the
 * hero headline and photo crossfades both use it), so the reveals here reuse it
 * rather than introducing a second motion vocabulary.
 *
 * Everything below is tuned so content is never *waiting* to be read. Two rules:
 *
 *   1. Reveals arm well before their element reaches the viewport (`ROOT_MARGIN`)
 *      and at `amount: 0`, so by the time a block is on screen it has already
 *      finished animating. The previous settings needed a quarter of a block to
 *      be visible first, which left long checklists blank while you looked at
 *      them.
 *   2. Stagger steps are small. They read as a sweep either way, but a 0.08s
 *      step across a ten-cell grid — each cell staggering its own contents on
 *      top — added up to about a second before the last line of copy existed.
 *
 * Anyone who has asked their OS for less motion gets the content with no
 * animation at all.
 */
export const EASE = [0.22, 1, 0.36, 1];

/** Arm the reveal this far below the fold, so it plays before it is looked at. */
const ROOT_MARGIN = '0px 0px 400px 0px';

/**
 * Ceilings, applied inside the primitives rather than at each call site: a
 * stagger that reads as a sweep on four pills turns into a visible wait on a
 * ten-cell grid, and no single element is worth holding copy back for.
 */
export const MAX_SWEEP = 0.3; // total time from the first child to the last
const MAX_DELAY = 0.12;
const MAX_DURATION = 0.45;
export const VIEWPORT = { once: true, amount: 0, margin: ROOT_MARGIN };

/** True when the visitor has asked their OS for reduced motion. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const reduceMotion = prefersReducedMotion();

/** Fade + rise. `delay` staggers siblings that aren't in a variant group. */
export function Reveal({
  as: Tag = 'div',
  children,
  delay = 0,
  y = 16,
  duration = 0.4,
  amount = 0,
  ...rest
}) {
  const M = motion[Tag] ?? motion.div;
  // Still a motion component so framer-only props (whileHover and friends) are
  // consumed rather than leaking onto the DOM node — just no entrance.
  if (reduceMotion) return <M {...rest}>{children}</M>;
  return (
    <M
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ ...VIEWPORT, amount }}
      transition={{
        duration: Math.min(duration, MAX_DURATION),
        ease: EASE,
        delay: Math.min(delay, MAX_DELAY),
      }}
      {...rest}
    >
      {children}
    </M>
  );
}

/** Parent that staggers any `<Stagger.Item>` descendants into view. */
export function Stagger({
  as: Tag = 'div',
  children,
  stagger = 0.03,
  delayChildren = 0,
  amount = 0,
  ...rest
}) {
  const M = motion[Tag] ?? motion.div;
  if (reduceMotion) return <M {...rest}>{children}</M>;
  // Long lists get a proportionally tighter step so the sweep always lands
  // inside MAX_SWEEP, however many children the caller passes.
  const step = Math.min(stagger, MAX_SWEEP / Math.max(Children.count(children), 1));
  return (
    <M
      initial="hidden"
      whileInView="visible"
      viewport={{ ...VIEWPORT, amount }}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: step, delayChildren: Math.min(delayChildren, MAX_DELAY) },
        },
      }}
      {...rest}
    >
      {children}
    </M>
  );
}

export const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

export const staggerItemScale = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: EASE } },
};

/** Fade only — no displacement. */
export const staggerItemFade = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35, ease: EASE } },
};

/**
 * Visually inert, but keeps the variant chain alive so a nested element can be
 * staggered. Used for the cells of the hairline grids: the 1px rules between
 * cells are the parent's blue background showing through, so fading a *cell*
 * would turn the whole block into a blue slab mid-animation. The cell stays
 * solid and its contents animate instead.
 */
export const staggerPassthrough = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.02 } },
};

Stagger.Item = function StaggerItem({ as: Tag = 'div', variants = staggerItem, children, ...rest }) {
  const M = motion[Tag] ?? motion.div;
  if (reduceMotion) return <M {...rest}>{children}</M>;
  return (
    <M variants={variants} {...rest}>
      {children}
    </M>
  );
};
