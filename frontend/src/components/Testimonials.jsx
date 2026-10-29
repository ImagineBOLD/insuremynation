import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from './Icons';
import { glassButton } from './Primitives';
import { BLUE } from '../data/site';
import { REVIEWS } from '../data/reviews';

/** "Trusted By Thousands": the auto-advancing review rail, used on home and About. */
export default function Testimonials() {
  const [idx, setIdx] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [step, setStep] = useState(0);
  const trackRef = useRef(null);
  const reviewTimer = useRef(null);
  const snapTimer = useRef(null);

  // The rail scrolls by one card; measure the real step so it stays correct
  // once the media queries resize the cards.
  useEffect(() => {
    const measure = () => {
      const el = trackRef.current;
      if (el && el.children.length > 1) {
        const next = el.children[1].offsetLeft - el.children[0].offsetLeft;
        if (next > 0) setStep(next);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const advance = () => {
    setIdx((current) => {
      const next = current + 1;
      if (next >= REVIEWS.length) {
        // The list is rendered twice; once the copy scrolls in, snap silently
        // back to the start so the loop is seamless.
        clearTimeout(snapTimer.current);
        snapTimer.current = setTimeout(() => {
          setAnimate(false);
          setIdx(0);
          requestAnimationFrame(() => setAnimate(true));
        }, 620);
      }
      return next;
    });
    setAnimate(true);
  };

  const startReviewTimer = () => {
    clearInterval(reviewTimer.current);
    reviewTimer.current = setInterval(advance, 4000);
  };

  useEffect(() => {
    startReviewTimer();
    return () => {
      clearInterval(reviewTimer.current);
      clearTimeout(snapTimer.current);
    };
  }, []);

  const testimonials = REVIEWS.concat(REVIEWS);

  return (
    <div
      data-r="tsec"
      style={{
        position: 'relative',
        width: 1728,
        height: 706,
        overflow: 'hidden',
        background: '#fff',
        display: 'flex',
        flexDirection: 'row',
        padding: '92px 48px',
        alignItems: 'flex-end',
        boxSizing: 'border-box',
      }}
    >
      <div
        data-r="tleft"
        style={{
          width: 816,
          height: 482,
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          alignItems: 'flex-start',
          flexShrink: 0,
        }}
      >
        <span
          data-r="theading"
          style={{
            fontFamily: 'Poppins,sans-serif',
            fontSize: 64,
            lineHeight: 1.1,
            color: BLUE,
            textTransform: 'uppercase',
          }}
        >
          <strong style={{ display: 'block', fontWeight: 700 }}>Trusted By</strong>
          <span style={{ display: 'block', fontWeight: 300 }}>Thousands</span>
        </span>
        <span
          data-r="tsub"
          style={{
            width: 458,
            fontFamily: 'Poppins,sans-serif',
            fontSize: 24,
            lineHeight: 1.2,
            color: BLUE,
          }}
        >
          Real experiences from clients who trusted us with what matters most - their health,
          their family, their future.
        </span>
      </div>
      <div
        data-r="trail"
        style={{
          position: 'relative',
          width: 864,
          height: 522,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <div
          data-r="ttrack"
          ref={trackRef}
          style={{
            display: 'flex',
            flexDirection: 'row',
            width: 'max-content',
            transform: `translateX(-${idx * (step || 543)}px)`,
            transition: animate ? 'transform 0.6s cubic-bezier(0.4,0,0.2,1)' : 'none',
          }}
        >
          {testimonials.map((t, i) => (
            <div
              key={`${t.name}-${i}`}
              data-r="tcard"
              style={{
                width: 522,
                minHeight: 522,
                flexShrink: 0,
                marginRight: 21,
                overflow: 'visible',
                background: BLUE,
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
                padding: 44,
                alignItems: 'flex-start',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                  alignItems: 'flex-start',
                }}
              >
                <span
                  data-r="tname"
                  style={{
                    fontFamily: 'Poppins,sans-serif',
                    fontWeight: 700,
                    fontSize: 36,
                    lineHeight: 1.15,
                    color: '#fff',
                    textTransform: 'uppercase',
                    whiteSpace: 'normal',
                    alignSelf: 'stretch',
                  }}
                >
                  {t.name}
                </span>
                <span
                  data-r="tpolicy"
                  style={{
                    fontFamily: 'Poppins,sans-serif',
                    fontWeight: 300,
                    fontSize: 27,
                    lineHeight: 1,
                    color: '#fff',
                  }}
                >
                  {t.policy}
                </span>
              </div>
              <span
                data-r="tquote"
                style={{
                  fontFamily: 'Poppins,sans-serif',
                  fontWeight: 300,
                  fontSize: 21,
                  lineHeight: 1.5,
                  color: '#fff',
                }}
              >
                {t.quote}
              </span>
            </div>
          ))}
        </div>
        <div
          data-r="tarrow"
          role="button"
          aria-label="Next review"
          onClick={() => {
            advance();
            startReviewTimer();
          }}
          style={{
            ...glassButton,
            position: 'absolute',
            left: 487,
            top: 427,
            width: 84,
            height: 84,
            overflow: 'hidden',
          }}
        >
          <ArrowRight style={{ mixBlendMode: 'exclusion' }} />
        </div>
      </div>
    </div>
  );
}
