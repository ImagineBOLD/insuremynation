import { motion } from 'framer-motion';
import { MAX_SWEEP, VIEWPORT, prefersReducedMotion } from './Reveal';
import { BLUE, PARTNERS } from '../data/site';

/**
 * Partner logo wall, laid out as Frame 45 on every page, except the space
 * above the eyebrow is doubled to 96px on request (the frame draws 48), so the
 * section is 503px tall rather than 455. Its three centred rows (9 / 8 / 5)
 * are not markup: a 1600px wall wraps the list at exactly those points. Below
 * the canvas, global.css rescales the wall, gaps and logos as one piece via
 * --u, so the rows keep breaking there.
 */
export default function Partners({ animate = false }) {
  const animated = animate && !prefersReducedMotion();
  const Grid = animated ? motion.div : 'div';
  const Logo = animated ? motion.img : 'img';

  const gridProps = animated
    ? {
        initial: 'hidden',
        whileInView: 'visible',
        viewport: VIEWPORT,
        variants: {
          hidden: {},
          visible: { transition: { staggerChildren: MAX_SWEEP / PARTNERS.length } },
        },
      }
    : {};

  const logoProps = animated
    ? {
        variants: {
          hidden: { opacity: 0, scale: 0.92 },
          visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: 'easeOut' } },
        },
      }
    : {};

  return (
    <div
      data-r="partners"
      style={{
        position: 'relative',
        width: 1728,
        display: 'flex',
        flexDirection: 'column',
        gap: 59,
        padding: '144px 0 48px',
        alignItems: 'center',
        boxSizing: 'border-box',
      }}
    >
      <span
        data-r="peyebrow"
        style={{
          fontFamily: 'Poppins,sans-serif',
          fontWeight: 500,
          fontSize: 24,
          lineHeight: 1,
          color: BLUE,
          textTransform: 'uppercase',
        }}
      >
        [ our insurance partners ]
      </span>
      <Grid
        data-r="pgrid"
        {...gridProps}
        style={{
          width: 1600,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '48px 72px',
        }}
      >
        {PARTNERS.map(({ file, name, w, h }) => (
          <Logo
            key={file}
            data-r="plogo"
            decoding="async"
            loading="lazy"
            src={`/assets/${file}.webp`}
            alt={name}
            {...logoProps}
            style={{ '--w': w, '--h': h, width: w, height: h, objectFit: 'contain' }}
          />
        ))}
      </Grid>
    </div>
  );
}
