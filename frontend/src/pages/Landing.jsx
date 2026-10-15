import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import Partners from '../components/Partners';
import { ArrowLeft, ArrowRight, BracketLeft, BracketRight } from '../components/Icons';
import { BLUE } from '../data/site';

const PHOTOS = [
  '/assets/landing-slide-health.webp',
  '/assets/landing-slide-travel.webp',
  '/assets/landing-slide-car.webp',
  '/assets/landing-slide-bike.webp',
  '/assets/landing-slide-life.webp',
];

const HEADLINES = [
  'Health cover that starts with your health, not a template',
  'Travel far. Stay covered every mile of the way',
  'The right car cover, compared across every insurer',
  'Ride out knowing every kilometre is protected',
  'Life cover built around the people who depend on you',
];

const SERVICES = [
  {
    num: '01',
    title: 'Health Insurance',
    tagline: 'Cover that fits your life',
    to: '/health-insurance',
    image: '/assets/svc-health.webp',
    desc: "Every plan starts with your actual health needs, lifestyle, and medical history - not a generic template. We match you to the right cover from India's top insurers, then stay on for renewals, portability, and claims support when it matters most.",
  },
  {
    num: '02',
    title: 'Life Insurance',
    tagline: 'Security for those who matter',
    to: '/life-insurance',
    image: '/assets/svc-life.webp',
    desc: 'We look at your income, dependents, and long-term goals before recommending a sum assured - never a one-size number. Straightforward term and whole-life options from trusted insurers, with support at every renewal and claim.',
  },
  {
    num: '03',
    title: 'Car Insurance',
    tagline: 'Drive covered, drive assured',
    to: '/car-insurance',
    image: '/assets/svc-car.webp',
    desc: "From third-party to comprehensive add-ons, we compare live quotes across insurers so you're not overpaying for cover you don't need. Quick, guided claims support when accidents happen.",
  },
  {
    num: '04',
    title: 'Bike Insurance',
    tagline: 'Ride protected, every mile',
    to: '/bike-insurance',
    image: '/assets/svc-bike.webp',
    desc: 'Two-wheeler cover built around how you actually ride - daily commute or weekend trips. Fast policy issuance and a claims team that stays with you after an accident.',
  },
  {
    num: '05',
    title: 'Travel Insurance',
    tagline: 'Explore without worry',
    to: '/travel-insurance',
    image: '/assets/svc-travel.webp',
    desc: 'Trip cancellations, medical emergencies abroad, lost baggage - covered before you board. We match your itinerary to a plan that actually protects it.',
  },
  {
    num: '06',
    title: 'Marine Insurance',
    tagline: 'Cargo and vessels, covered',
    to: '/marine-insurance',
    image: '/assets/svc-marine.webp',
    desc: 'Cargo, vessels, and freight covered against loss or damage in transit. We work with marine underwriters to structure cover that matches your shipping risk.',
  },
];

const BADGES = [
  { title: 'IRDAI Registered Broker', sub: 'IRDAI/DB 1093/2023' },
  { title: 'Certified Advisors', sub: 'Trained insurance counsellors' },
  { title: 'Claim Support', sub: 'Guided, end-to-end assistance' },
  { title: 'Trusted by Thousands', sub: 'Verified customer reviews' },
];

const REVIEWS = [
  {
    name: 'Varun Yaul, Delhi',
    policy: 'Policy: Health Insurance',
    quote:
      'Switched my health cover through InsureNation after a frustrating renewal experience elsewhere. The team helped port my existing plan without losing continuity benefits, and explained every clause before I signed. First time insurance felt less like paperwork and more like actual advice.',
  },
  {
    name: 'Vasantharaj Rajendran, Delhi',
    policy: 'Policy: Health Insurance',
    quote:
      'My relationship manager has stayed with me since day one — not just at purchase, but through every renewal and every question about riders since. That kind of continuity is rare with insurance.',
  },
  {
    name: 'Raman Jain, Delhi',
    policy: 'Policy: Life Insurance',
    quote:
      "What stood out wasn't the sale — it was everything after it. InsureNation built trust with us in a category where most people just expect to be sold to.",
  },
  {
    name: 'Rajesh Gawde, Delhi',
    policy: 'Policy: Health Insurance',
    quote:
      "Yashika walked me through every step of buying my policy with patience I didn't expect from an insurance purchase. Clear answers, no pressure, no jargon I couldn't follow.",
  },
  {
    name: 'Vivek G, Delhi',
    policy: 'Policy: Investment & Wealth',
    quote:
      'Nehal helped me build out a proper investment portfolio, not just sell me one product — genuinely diversified across instruments based on what actually made sense for me.',
  },
  {
    name: 'Suchint Deori, Delhi',
    policy: 'Policy: Claim Support',
    quote:
      "I highly recommend Aman for claim assistance. He recently handled my father's Care Health Insurance claim and made the entire process seamless. His expertise and attention to detail ensured everything was filed correctly and efficiently. Truly a professional you can trust.",
  },
  {
    name: 'Deeksha Srivastava, Delhi',
    policy: 'Policy: Life Insurance',
    quote:
      'I am very happy with the service provided by DK Sharma. He very clearly explained the policy — HDFC Life Click 2 Protect Super term insurance — answered all my questions and was reachable every time. The process was smooth throughout with his help.',
  },
  {
    name: 'Prashant Batra, Delhi',
    policy: 'Policy: Health Insurance',
    quote:
      'Great service. Mr Parvesh and Aman personally visited to understand our requirements, suggested a plan accordingly and helped me port the plan for my mother and father. Excellent service.',
  },
  {
    name: 'Vijay Kumar, Delhi',
    policy: 'Policy: Renewal Support',
    quote:
      'Timely reminders and guidance helped me choose the right policy option without making it cost-heavy. Yashika was extremely helpful throughout the policy renewal process. Unlike others who keep calling repeatedly, she connected only when requested. Thank you, Yashika.',
  },
  {
    name: 'Ankur Aggarwal, Delhi',
    policy: 'Policy: Claim Support',
    quote:
      'Deeply grateful to Mr Deepak Sharma for helping us secure the insurance policy. At the time, it seemed like a prudent step — thanks to his guidance and insistence — but little did we know how crucial it would prove to be. His continued involvement ensured the claim was settled efficiently.',
  },
];

const glassButton = {
  borderRadius: 53,
  cursor: 'pointer',
  background:
    'linear-gradient(140deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 45%, rgba(255,255,255,0.28) 100%)',
  boxShadow:
    'inset 0 1px 1px rgba(255,255,255,0.6),inset 0 -1px 2px rgba(255,255,255,0.25),inset 0 0 0 1px rgba(255,255,255,0.3),0 8px 24px rgba(0,0,0,0.18)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

/**
 * One crossfading photo slot in the hero collage. Each slot shows a different
 * photo from the same set, offset by its index, and every slot's transition is
 * delayed by 90ms per slot so the swap sweeps left to right.
 */
function HeroSlot({ slotIndex, step, ...rest }) {
  const active = (slotIndex + step) % PHOTOS.length;
  return (
    <div {...rest}>
      {PHOTOS.map((src, i) => {
        const on = i === active;
        return (
          <img
            key={src}
            src={src}
            alt=""
            decoding="async"
            // Only the frame on screen competes with the hero background for
            // bandwidth; the other four in each slot are pre-warmed for the
            // crossfade and can wait.
            fetchpriority={on ? 'high' : 'low'}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: on ? 1 : 0,
              transform: `scale(${on ? 1 : 1.08})`,
              transition: `opacity 0.9s ease ${slotIndex * 90}ms,transform 1.4s cubic-bezier(0.22,1,0.36,1) ${slotIndex * 90}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function Landing() {
  // Hero collage + headline rotation
  const [heroStep, setHeroStep] = useState(0);
  const [headlineOn, setHeadlineOn] = useState(true);
  const heroTimer = useRef(null);
  const headlineTimer = useRef(null);

  // Testimonial rail
  const [idx, setIdx] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [step, setStep] = useState(0);
  const trackRef = useRef(null);
  const reviewTimer = useRef(null);
  const snapTimer = useRef(null);

  const [hovered, setHovered] = useState(-1);
  // Touch devices have no hover, so the service rows expand from an explicit
  // +/- toggle instead. The toggle is display:none above the 760px breakpoint.
  const [openRow, setOpenRow] = useState(-1);

  const startHeroTimer = () => {
    clearInterval(heroTimer.current);
    heroTimer.current = setInterval(() => {
      setHeadlineOn(false);
      clearTimeout(headlineTimer.current);
      headlineTimer.current = setTimeout(() => {
        setHeroStep((s) => s + 1);
        setHeadlineOn(true);
      }, 420);
    }, 4500);
  };

  const stepHero = (dir) => {
    clearInterval(heroTimer.current);
    clearTimeout(headlineTimer.current);
    setHeadlineOn(false);
    headlineTimer.current = setTimeout(() => {
      setHeroStep((s) => s + dir + PHOTOS.length);
      setHeadlineOn(true);
    }, 420);
    startHeroTimer();
  };

  useEffect(() => {
    startHeroTimer();
    return () => {
      clearInterval(heroTimer.current);
      clearTimeout(headlineTimer.current);
    };
  }, []);

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

  const headline = HEADLINES[(2 + heroStep) % HEADLINES.length];
  const testimonials = REVIEWS.concat(REVIEWS);

  return (
    <div
      className="p-landing"
      data-r="root"
      style={{
        position: 'relative',
        width: 1728,
        background: '#fff',
        fontFamily: 'Poppins,sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* HERO */}
      <div
        data-r="hero"
        style={{
          position: 'relative',
          width: 1728,
          height: 1117,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        <div
          data-r="herobg"
          style={{
            position: 'absolute',
            left: 0,
            top: -4,
            width: 1920,
            height: 1280,
            background: 'url("/assets/landing-hero.webp") center / cover no-repeat',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(0,13,40,0.2) 100%)',
            pointerEvents: 'none',
          }}
        />

        <Nav variant="blue" logoAsLink={false} />

        <div
          data-r="gal"
          style={{
            position: 'absolute',
            left: 116,
            top: 335,
            width: 1496,
            height: 448,
            display: 'flex',
            flexDirection: 'row',
            gap: 24,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <HeroSlot
            slotIndex={0}
            step={heroStep}
            data-r="slot-side"
            style={{
              position: 'relative',
              width: 145,
              height: 145,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          />
          <HeroSlot
            slotIndex={1}
            step={heroStep}
            data-r="slot-side"
            style={{
              position: 'relative',
              width: 235,
              height: 235,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          />
          <div
            data-r="galmid"
            style={{
              position: 'relative',
              width: 450,
              height: 448,
              display: 'flex',
              gap: 4,
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <BracketLeft style={{ flexShrink: 0 }} />
            <HeroSlot
              slotIndex={2}
              step={heroStep}
              data-r="slotmid"
              style={{
                position: 'relative',
                width: 380,
                height: 380,
                overflow: 'hidden',
                flexShrink: 0,
              }}
            />
            <BracketRight style={{ transform: 'scaleX(-1)', flexShrink: 0 }} />
          </div>
          <HeroSlot
            slotIndex={3}
            step={heroStep}
            data-r="slot-side"
            style={{
              position: 'relative',
              width: 235,
              height: 235,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          />
          <HeroSlot
            slotIndex={4}
            step={heroStep}
            data-r="slot-side"
            style={{
              position: 'relative',
              width: 145,
              height: 145,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          />
        </div>

        <span
          data-r="headline"
          style={{
            position: 'absolute',
            left: 93,
            top: 900,
            width: 760,
            fontFamily: 'Poppins,sans-serif',
            fontWeight: 700,
            fontSize: 46,
            lineHeight: 1,
            color: '#fff',
            opacity: headlineOn ? 1 : 0,
            transform: `translateY(${headlineOn ? '0' : '18px'})`,
            transition: 'opacity 0.42s ease,transform 0.6s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          {headline}
        </span>

        <div
          data-r="heroarrows"
          style={{
            position: 'absolute',
            left: 1506,
            top: 950,
            width: 182,
            height: 84,
            display: 'flex',
            gap: 14,
            alignItems: 'center',
          }}
        >
          <div
            onClick={() => stepHero(-1)}
            role="button"
            aria-label="Previous"
            style={{ ...glassButton, width: 84, height: 84 }}
          >
            <ArrowLeft />
          </div>
          <div
            onClick={() => stepHero(1)}
            role="button"
            aria-label="Next"
            style={{ ...glassButton, width: 84, height: 84 }}
          >
            <ArrowRight />
          </div>
        </div>
      </div>

      <Partners />

      {/* SERVICES */}
      <div
        data-r="services"
        style={{
          position: 'relative',
          width: 1728,
          display: 'flex',
          flexDirection: 'column',
          gap: 56,
          padding: '104px 0',
          alignItems: 'center',
          boxSizing: 'border-box',
          background: '#fff',
        }}
      >
        <span
          data-r="eyebrow"
          style={{
            fontFamily: 'Poppins,sans-serif',
            fontWeight: 500,
            fontSize: 24,
            lineHeight: 1,
            color: BLUE,
          }}
        >
          [ OUR SERVICES ]
        </span>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            width: '100%',
          }}
        >
          {SERVICES.map((row, i) => {
            const on = hovered === i || openRow === i;
            const toggleRow = (e) => {
              // Keep the tap on the toggle from following the row's link, and
              // drop the hover a touch tap leaves latched on this row.
              e.preventDefault();
              e.stopPropagation();
              setHovered(-1);
              setOpenRow(openRow === i ? -1 : i);
            };
            const tone = on ? '#fff' : '#004AAD';
            return (
              <Link
                key={row.num}
                to={row.to}
                data-r="srow"
                aria-label={row.title}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(-1)}
                style={{
                  position: 'relative',
                  boxSizing: 'border-box',
                  width: 1728,
                  height: on ? 257 : 173,
                  overflow: 'hidden',
                  background: on
                    ? 'linear-gradient(180deg, rgb(0,74,173) 0%, rgb(0,30,71) 150.35%)'
                    : '#fff',
                  border: `1px solid ${BLUE}`,
                  display: 'flex',
                  flexDirection: 'row',
                  padding: '44px 48px',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'height 0.25s ease,background 0.25s ease',
                }}
              >
                <span
                  data-r="snum"
                  style={{
                    position: 'absolute',
                    left: 48,
                    top: 44,
                    fontFamily: 'Poppins,sans-serif',
                    fontSize: 21,
                    lineHeight: 1,
                    color: tone,
                  }}
                >
                  {row.num}
                </span>
                <span
                  data-r="stoggle"
                  role="button"
                  tabIndex={0}
                  aria-expanded={openRow === i}
                  aria-label={`${openRow === i ? 'Hide' : 'Show'} ${row.title} details`}
                  onClick={toggleRow}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') toggleRow(e);
                  }}
                  style={{
                    display: 'none',
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    width: 40,
                    height: 40,
                    fontFamily: 'Poppins,sans-serif',
                    fontSize: 30,
                    fontWeight: 400,
                    lineHeight: 1,
                    color: tone,
                  }}
                >
                  {openRow === i ? '−' : '+'}
                </span>
                {on && (
                  <div
                    data-r="simg"
                    style={{
                      position: 'absolute',
                      left: 130,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 306,
                      height: 168,
                      borderRadius: 84,
                      overflow: 'hidden',
                      isolation: 'isolate',
                    }}
                  >
                    <img
                      decoding="async"
                      loading="lazy"
                      src={row.image}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </div>
                )}
                <div
                  data-r="scenter"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%,-50%)',
                    width: 629,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    alignItems: 'center',
                  }}
                >
                  <span
                    data-r="stitle"
                    style={{
                      fontFamily: 'ABeeZee,sans-serif',
                      fontSize: 84,
                      textAlign: 'center',
                      lineHeight: 1,
                      letterSpacing: '-0.05em',
                      color: tone,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.title}
                  </span>
                  {on && (
                    <span
                      data-r="sdesc"
                      style={{
                        fontFamily: 'Poppins,sans-serif',
                        fontSize: 21,
                        textAlign: 'center',
                        lineHeight: 1.25,
                        color: '#fff',
                      }}
                    >
                      {row.desc}
                    </span>
                  )}
                </div>
                <span
                  data-r="stag"
                  style={{
                    position: 'absolute',
                    right: 48,
                    top: 44,
                    fontFamily: 'Poppins,sans-serif',
                    fontSize: 21,
                    lineHeight: 1,
                    color: on ? '#fff' : BLUE,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.tagline}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* TRUST BADGES */}
      <div
        data-r="badges"
        style={{
          position: 'relative',
          width: 1728,
          display: 'flex',
          flexDirection: 'row',
          gap: 25,
          padding: '96px 96px',
          alignItems: 'stretch',
          flexWrap: 'nowrap',
          boxSizing: 'border-box',
        }}
      >
        {BADGES.map((badge) => (
          <div
            key={badge.title}
            data-r="badge"
            style={{
              flex: '1 1 0',
              minWidth: 0,
              height: 270,
              overflow: 'hidden',
              borderRadius: 156,
              boxShadow: `inset 0 0 0 2px ${BLUE}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              padding: '40px 34px',
              justifyContent: 'center',
              alignItems: 'center',
              boxSizing: 'border-box',
            }}
          >
            <span
              data-r="btitle"
              style={{
                fontFamily: 'Poppins,sans-serif',
                fontWeight: 700,
                fontSize: 36,
                textAlign: 'center',
                lineHeight: 1.2,
                color: BLUE,
              }}
            >
              {badge.title}
            </span>
            <span
              data-r="bsub"
              style={{
                fontFamily: 'Poppins,sans-serif',
                fontSize: 21,
                textAlign: 'center',
                lineHeight: 1.2,
                color: BLUE,
              }}
            >
              {badge.sub}
            </span>
          </div>
        ))}
      </div>

      {/* TESTIMONIALS */}
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

      <Footer />
    </div>
  );
}
