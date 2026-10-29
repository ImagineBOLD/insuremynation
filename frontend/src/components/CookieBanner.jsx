import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE, prefersReducedMotion } from './Reveal';
import { BLUE, DEEP } from '../data/site';

// The choice is stored and acted on by `window.imnConsent` in index.html, which
// holds the analytics and advertising tags back until the visitor accepts.
const consent = () => (typeof window !== 'undefined' ? window.imnConsent : undefined);

const buttonStyle = {
  height: 48,
  padding: '0 26px',
  borderRadius: 48,
  fontFamily: 'Poppins,sans-serif',
  fontWeight: 500,
  fontSize: 16,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/** Cookie notice: "Accept all" loads the tags, "Essential only" keeps them off. */
export default function CookieBanner() {
  const [open, setOpen] = useState(() => !!consent() && !consent().get());

  const choose = (value) => {
    consent()?.set(value);
    setOpen(false);
  };

  const reduce = prefersReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-r="cookie"
          role="dialog"
          aria-live="polite"
          aria-label="Cookie consent"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.45, ease: EASE }}
          style={{
            position: 'fixed',
            left: 24,
            bottom: 24,
            zIndex: 1000,
            width: 560,
            maxWidth: 'calc(100vw - 48px)',
            boxSizing: 'border-box',
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            background: `linear-gradient(180deg, ${BLUE} -14.71%, ${DEEP} 121.42%)`,
            boxShadow: '0 12px 40px rgba(0,30,71,0.35)',
            color: '#fff',
          }}
        >
          <span
            style={{
              fontFamily: 'Poppins,sans-serif',
              fontWeight: 500,
              fontSize: 18,
              lineHeight: 1.3,
              textTransform: 'uppercase',
            }}
          >
            We use cookies
          </span>
          <span
            style={{
              fontFamily: 'Poppins,sans-serif',
              fontWeight: 300,
              fontSize: 16,
              lineHeight: 1.55,
              textWrap: 'pretty',
            }}
          >
            Essential cookies keep the site and your chat with Asha working. With your consent we
            also use analytics and advertising cookies (Google Analytics, Google Ads, Meta Pixel)
            to measure and improve our website and ads. See our{' '}
            <Link to="/privacy-policy" style={{ color: '#fff', borderBottom: '1px solid #fff' }}>
              Privacy Policy
            </Link>
            .
          </span>
          <div data-r="cookiebtns" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => choose('all')}
              style={{ ...buttonStyle, border: 0, background: '#fff', color: BLUE }}
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={() => choose('essential')}
              style={{
                ...buttonStyle,
                border: '1px solid #fff',
                background: 'transparent',
                color: '#fff',
              }}
            >
              Essential only
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
