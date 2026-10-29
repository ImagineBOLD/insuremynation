import { useState } from 'react';
import { motion } from 'framer-motion';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import Partners from '../components/Partners';
import Testimonials from '../components/Testimonials';
import { Body, Eyebrow, SplitHeading } from '../components/Primitives';
import { EASE, staggerItem } from '../components/Reveal';
import { BLUE } from '../data/site';

const BADGES = [
  { title: '45+ Years', sub: 'Combined team experience' },
  { title: 'Founder Members', sub: 'Niva Bupa Direct Sales' },
  { title: 'HNI Specialists', sub: 'Insurance & wealth advisory' },
  { title: 'IRDAI Registered', sub: 'Direct Broker · IRDAI/DB 1093/2023' },
];

const BLOCKS = [
  { num: '01', title: 'Protection Products', tagline: 'Cover recommended on need, never on commission' },
  { num: '02', title: 'Technology', tagline: 'Digital journeys for quotes, issuance and renewals' },
  { num: '03', title: 'Customer First', tagline: 'Advice before the sale, service long after it' },
  {
    num: '04',
    title: 'Relationship Management',
    tagline: 'One manager who stays with you year after year',
  },
];

const TEAM = [
  {
    name: 'Nehal Kumar',
    role: 'Co-Founder & Chief Executive',
    file: 'team-nehal.webp',
    bio: 'MBA from IMT Ghaziabad and 19+ years as a retail financial professional. A founder member of Niva Bupa (formerly Max Bupa Health Insurance), he has also worked with HDFC Bank, Nippon AMC and Kotak Mahindra Bank. He was instrumental in building a profitable HNI-focused direct sales distribution with customer service at its core. An avid photographer who keeps a learning attitude towards life.',
  },
  {
    name: 'Parvesh Kumar',
    role: 'Co-Founder & Chief Business Officer',
    file: 'team-parvesh-kumar.webp',
    bio: '15+ years of leadership in health and life insurance. As a founder member of direct sales distribution at Niva Bupa, he delivered profitable growth through large team management, P&L ownership and HNI relationship management. Previously with Aviva and MetLife. B.Com from Delhi University and a passionate cricketer.',
  },
  {
    name: 'Deepak Kr Sharma',
    role: 'Business Head - Health Insurance',
    file: 'team-deepak.webp',
    bio: '7+ years in insurance - life cover at HDFC Life, then health insurance expertise at Niva Bupa, where he played a big role in the success of direct sales. He believes recommending solutions based on a person’s actual needs is the key to relationship management. B.Com from Delhi University.',
  },
  {
    name: 'Anubhav Adya',
    role: 'Business Head - Direct Sales',
    file: 'team-anubhav.webp',
    bio: '6+ years in health insurance. A founder member of the Any Time Health initiative at CyberHub for Niva Bupa - an industry-first digital sales and service machine - and helped build point-of-care touchpoints in hospitals. His expertise is HNI relationship management. Graduate of IP University and a massive cricket buff.',
  },
];

const INTRO_COPY = [
  'Our team has spent careers distributing health insurance, life insurance, mutual funds and banking products at HDFC Bank, Niva Bupa, HDFC Life and Nippon Asset Management - more than 45 years of combined experience serving high-net-worth clients across insurance and wealth management, with customer service as the core focus area.',
  'We are founder members of Niva Bupa Direct Sales. Having built profitable businesses in leadership roles across direct-sales distribution, we work customer-first: the right product recommended only after a proper analysis of your needs and requirements.',
  'We came together as a team so we could offer a genuinely differentiated experience for every insurance and wealth requirement you bring us.',
];

export default function About() {
  const [hovered, setHovered] = useState(-1);
  const [openBio, setOpenBio] = useState(-1);

  return (
    <div
      className="p-about"
      data-r="root"
      style={{
        position: 'relative',
        width: 1728,
        background: '#fff',
        fontFamily: 'Poppins,sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* ---------------------------------------------------------- ABOUT HERO */}
      <div
        data-r="abhero"
        style={{
          position: 'relative',
          width: 1728,
          aspectRatio: '16/9',
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        <motion.div
          data-r="abherobg"
          initial={{ scale: 1.06 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.6, ease: EASE }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            background: 'url("/assets/about-hero.webp") center / cover no-repeat',
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

        <Nav variant="white" active="about" />

        <motion.div
          data-r="atitleblock"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
          }}
          style={{
            position: 'absolute',
            left: 96,
            bottom: 88,
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            alignItems: 'flex-start',
            maxWidth: 1000,
          }}
        >
          <motion.div variants={staggerItem}>
            <Eyebrow color="#fff">[ about us ]</Eyebrow>
          </motion.div>
         <motion.div variants={staggerItem}>
  <SplitHeading
    data-r="atitle"
    lines={['A Boutique', 'Insurance Firm']}
    color="#fff"
    className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
  />
</motion.div>
          <motion.span
            data-r="asub"
            variants={staggerItem}
            style={{
              width: 720,
              fontFamily: 'Poppins,sans-serif',
              fontWeight: 300,
              fontSize: 24,
              lineHeight: 1.4,
              color: '#fff',
              textWrap: 'pretty',
            }}
          >
            We help people protect their lives and their lifestyle - with a special focus on the HNI
            segment and end-to-end insurance solutions.
          </motion.span>
        </motion.div>
      </div>

      {/* ------------------------------------------------------------ WHO WE ARE */}
      <div
        data-r="intro"
        style={{
          position: 'relative',
          width: 1728,
          display: 'flex',
          flexDirection: 'column',
          gap: 56,
          padding: '104px 96px',
          alignItems: 'flex-start',
          boxSizing: 'border-box',
          background: '#fff',
        }}
      >
        <Eyebrow>[ who we are ]</Eyebrow>
        <div
          data-r="irow"
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 96,
            alignItems: 'flex-start',
            width: '100%',
          }}
        >
          <SplitHeading
            data-r="ihead"
            lines={['45 Years of', 'Experience']}
            style={{ width: 520, flexShrink: 0 }}
          />
          <div
            data-r="icopy"
            style={{ width: 900, display: 'flex', flexDirection: 'column', gap: 26 }}
          >
            {INTRO_COPY.map((text) => (
              <Body key={text}>{text}</Body>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- CREDENTIALS */}
      <div
        data-r="badges"
        style={{
          position: 'relative',
          width: 1728,
          display: 'flex',
          flexDirection: 'row',
          gap: 25,
          padding: '0 96px 96px',
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
                fontSize: 14,
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

      {/* ------------------------------------------------------- VISION & MISSION */}
      <div
        data-r="vm"
        style={{
          position: 'relative',
          width: 1728,
          display: 'flex',
          flexDirection: 'column',
          gap: 56,
          padding: '0 96px 104px',
          alignItems: 'flex-start',
          boxSizing: 'border-box',
        }}
      >
        <Eyebrow>[ vision &amp; mission ]</Eyebrow>
        <div
          data-r="vmgrid"
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 25,
            alignItems: 'stretch',
            width: '100%',
          }}
        >
          {[
            {
              head: 'Our Vision',
              quote:
                'To become an easily accessible, service-oriented insurance advisory firm in India.',
            },
            {
              head: 'Our Mission',
              quote:
                "To help people protect their lifestyle through education of insurance needs, and facilitation of the right insurance products to the customer's satisfaction.",
            },
          ].map((card) => (
            <div
              key={card.head}
              data-r="vmcard"
              style={{
                flex: '1 1 0',
                minWidth: 0,
                background: BLUE,
                display: 'flex',
                flexDirection: 'column',
                gap: 28,
                padding: '56px 48px',
                boxSizing: 'border-box',
              }}
            >
              <span
                data-r="vmhead"
                style={{
                  fontFamily: 'Poppins,sans-serif',
                  fontWeight: 700,
                  fontSize: 36,
                  lineHeight: 1.15,
                  color: '#fff',
                  textTransform: 'uppercase',
                }}
              >
                {card.head}
              </span>
              <span
                data-r="vmquote"
                style={{
                  fontFamily: 'Poppins,sans-serif',
                  fontWeight: 300,
                  fontSize: 24,
                  lineHeight: 1.5,
                  color: '#fff',
                  textWrap: 'pretty',
                }}
              >
                {card.quote}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* -------------------------------------------------------- BUILDING BLOCKS */}
      <div
        data-r="blocks"
        style={{
          position: 'relative',
          width: 1728,
          display: 'flex',
          flexDirection: 'column',
          gap: 56,
          padding: '0 0 104px',
          alignItems: 'center',
          boxSizing: 'border-box',
          background: '#fff',
        }}
      >
        <Eyebrow>[ our building blocks ]</Eyebrow>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            width: '100%',
          }}
        >
          {BLOCKS.map((b, i) => {
            const on = hovered === i;
            const color = on ? '#fff' : '#004AAD';
            return (
              <div
                key={b.num}
                data-r="srow"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(-1)}
                style={{
                  position: 'relative',
                  boxSizing: 'border-box',
                  width: 1728,
                  height: 173,
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
                  transition: 'background 0.25s ease',
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
                    color,
                  }}
                >
                  {b.num}
                </span>
                <div
                  data-r="scenter"
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%,-50%)',
                    width: 900,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <span
                    data-r="stitle"
                    style={{
                      fontFamily: 'ABeeZee,sans-serif',
                      fontSize: 64,
                      textAlign: 'center',
                      lineHeight: 1,
                      letterSpacing: '-0.04em',
                      color,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {b.title}
                  </span>
                </div>
                <span
                  data-r="stag"
                  style={{
                    position: 'absolute',
                    right: 48,
                    top: 44,
                    maxWidth: 340,
                    fontFamily: 'Poppins,sans-serif',
                    fontWeight: 300,
                    fontSize: 21,
                    lineHeight: 1.35,
                    textAlign: 'right',
                    color,
                  }}
                >
                  {b.tagline}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ TEAM */}
      <div
        data-r="team"
        style={{
          position: 'relative',
          width: 1728,
          display: 'flex',
          flexDirection: 'column',
          gap: 56,
          padding: '0 96px 104px',
          alignItems: 'flex-start',
          boxSizing: 'border-box',
        }}
      >
        <Eyebrow>[ our team ]</Eyebrow>
        <div
          data-r="tgrid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
            gap: 25,
            width: '100%',
            alignItems: 'start',
          }}
        >
          {TEAM.map((m, i) => {
            const bioOpen = openBio === i;
            return (
              <div
                key={m.name}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20,
                  alignItems: 'flex-start',
                  boxShadow: `inset 0 0 0 1px ${BLUE}`,
                  padding: '22px 22px 28px',
                  boxSizing: 'border-box',
                  height: 490,
                }}
              >
                <div
                  data-r="tphoto"
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '1/1',
                    overflow: 'hidden',
                    // Shows through while the portrait decodes, and behind the
                    // ones shot against a pale background.
                    background:
                      'repeating-linear-gradient(135deg, rgba(0,74,173,0.10) 0 10px, rgba(0,74,173,0.04) 10px 20px)',
                  }}
                >
                  <img
                    src={`/assets/${m.file}`}
                    alt={m.name}
                    loading="lazy"
                    decoding="async"
                    style={{
                      width: '100%',
                      height: '100%',
                      // Portraits are framed head-and-shoulders, so bias the
                      // crop upward rather than centring on the chest.
                      objectFit: 'cover',
                      objectPosition: 'center top',
                      display: 'block',
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    data-r="tmname"
                    style={{
                      fontFamily: 'Poppins,sans-serif',
                      fontWeight: 700,
                      fontSize: 27,
                      lineHeight: 1.15,
                      color: BLUE,
                      textTransform: 'uppercase',
                    }}
                  >
                    {m.name}
                  </span>
                  <span
                    data-r="tmmeta"
                    style={{
                      fontFamily: 'Poppins,sans-serif',
                      fontWeight: 300,
                      fontSize: 19,
                      lineHeight: 1.3,
                      color: BLUE,
                    }}
                  >
                    {m.role}
                  </span>
                </div>
                {bioOpen && (
                  <span
                    data-r="tmmeta"
                    style={{
                      fontFamily: 'Poppins,sans-serif',
                      fontWeight: 300,
                      fontSize: 17,
                      lineHeight: 1.55,
                      color: BLUE,
                      textWrap: 'pretty',
                    }}
                  >
                    {m.bio}
                  </span>
                )}
                <span
                  data-r="tmmeta"
                  onClick={() => setOpenBio(bioOpen ? -1 : i)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenBio(bioOpen ? -1 : i);
                    }
                  }}
                  style={{
                    marginTop: 2,
                    fontFamily: 'Poppins,sans-serif',
                    fontWeight: 500,
                    fontSize: 17,
                    lineHeight: 1,
                    color: BLUE,
                    borderBottom: `1px solid ${BLUE}`,
                    paddingBottom: 3,
                    cursor: 'pointer',
                  }}
                >
                  {bioOpen ? 'Close' : 'Read more'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Testimonials />

      <Partners />
      <Footer />
    </div>
  );
}
