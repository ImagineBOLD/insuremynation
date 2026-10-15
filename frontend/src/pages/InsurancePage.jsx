import { useState } from 'react';
import { motion } from 'framer-motion';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import Partners from '../components/Partners';
import TalkToExperts from '../components/TalkToExperts';
import { MailIcon, PhoneIcon } from '../components/Icons';
import { Body, Eyebrow, Field, SplitHeading, SubmitRow } from '../components/Primitives';
import {
  EASE,
  Reveal,
  Stagger,
  staggerItem,
  staggerItemFade,
  staggerItemScale,
  staggerPassthrough,
  VIEWPORT,
} from '../components/Reveal';
import { BLUE, EMAIL, EMAIL_HREF, PHONE, PHONE_HREF } from '../data/site';

/**
 * Shared layout for the six insurance product pages. Content comes from
 * `data/products.js`; the visual design is identical across all six.
 *
 * Motion is layered on top of — never in place of — the design: every animated
 * element starts offset and settles at exactly the position, scale and colour
 * the prototype specifies, so the page at rest is pixel-identical.
 */
export default function InsurancePage({ product }) {
  const [form, setForm] = useState({});
  const [sent, setSent] = useState(false);

  const { hero, why, perks, coverArt, cover, fields, eyebrow, navVariant, slug, id } = product;

  const setField = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setSent(false);
  };

  return (
    <div
      className="p-sub"
      data-product={id}
      data-r="root"
      style={{
        position: 'relative',
        width: 1728,
        background: '#fff',
        fontFamily: 'Poppins,sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* ---------------------------------------------------------------- HERO */}
      <div
        data-r="hero"
        style={{
          position: 'relative',
          width: 1728,
          aspectRatio: '16/9',
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        <div
          data-r="herobg"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            isolation: 'isolate',
          }}
        >
          <motion.div
            initial={{ scale: 1.06 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.6, ease: EASE }}
            style={{
              position: 'absolute',
              inset: 0,
              background: `url('${hero.image}') ${hero.position} / cover no-repeat`,
            }}
          />
          {hero.scrim && <div style={{ position: 'absolute', inset: 0, background: hero.scrim }} />}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(0,13,40,0.2) 100%)',
              pointerEvents: 'none',
            }}
          />
        </div>

        <Nav variant={navVariant} active="insurance" activeProduct={slug} />

        <motion.div
          data-r="htitleblock"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } }}
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
            <Eyebrow color="#fff">{eyebrow}</Eyebrow>
          </motion.div>
          <motion.div variants={staggerItem}>
            <SplitHeading data-r="htitle" lines={hero.title} color="#fff" />
          </motion.div>
          <motion.span
            data-r="hsub"
            variants={staggerItem}
            style={{
              width: 760,
              fontFamily: 'Poppins,sans-serif',
              fontWeight: 300,
              fontSize: 24,
              lineHeight: 1.4,
              color: '#fff',
              textWrap: 'pretty',
            }}
          >
            {hero.sub}
          </motion.span>
        </motion.div>
      </div>

      {/* ------------------------------------------------------------- QUOTE FORM */}
      <div
        data-r="quote"
        style={{
          position: 'relative',
          width: 1728,
          display: 'flex',
          flexDirection: 'column',
          gap: 56,
          padding: '104px 96px',
          alignItems: 'flex-start',
          boxSizing: 'border-box',
        }}
      >
        <Reveal as="span" y={20} duration={0.5}>
          <Eyebrow>[ get your best quote ]</Eyebrow>
        </Reveal>
        <div
          data-r="qrow"
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 64,
            alignItems: 'stretch',
            width: '100%',
          }}
        >
          <Reveal
            data-r="qleft"
            style={{
              width: 600,
              flex: '0 0 600px',
              display: 'flex',
              flexDirection: 'column',
              gap: 28,
            }}
          >
            <SplitHeading data-r="qhead" lines={['Tell Us', 'What You Need']} fontSize={52} />
            <Body data-r="qcopy">
              Share a few details and a certified counsellor will come back with quotes from our
              partner insurers - compared side by side, with the trade-offs explained in plain
              language.
            </Body>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                marginTop: 6,
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <PhoneIcon stroke={BLUE} />
                <a
                  href={PHONE_HREF}
                  data-r="qcontact"
                  style={{
                    fontFamily: 'Poppins,sans-serif',
                    fontWeight: 500,
                    fontSize: 21,
                    color: BLUE,
                  }}
                >
                  {PHONE}
                </a>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <MailIcon fill={BLUE} width={19} />
                <a
                  href={EMAIL_HREF}
                  data-r="qcontact"
                  style={{
                    fontFamily: 'Poppins,sans-serif',
                    fontWeight: 500,
                    fontSize: 21,
                    color: BLUE,
                  }}
                >
                  {EMAIL}
                </a>
              </div>
            </div>
          </Reveal>

          <Reveal
            data-r="qform"
            delay={0.12}
            style={{
              width: 872,
              boxShadow: `inset 0 0 0 1px ${BLUE}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 26,
              padding: '48px 44px',
              boxSizing: 'border-box',
            }}
          >
            <Stagger
              data-r="qfields"
              stagger={0.06}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
                gap: '22px 24px',
                width: '100%',
              }}
            >
              {fields.map((field) => (
                <Stagger.Item key={field.key} style={{ minWidth: 0 }}>
                  <Field
                    label={field.label}
                    placeholder={field.placeholder}
                    value={form[field.key] ?? ''}
                    onChange={setField(field.key)}
                  />
                </Stagger.Item>
              ))}
            </Stagger>
            <SubmitRow
              sent={sent}
              onClick={() => setSent(true)}
              label={sent ? 'Request received' : 'Get my quote'}
              note={
                sent
                  ? 'Thanks - a counsellor will call you within one working day.'
                  : 'No spam, no auto-dialers. One counsellor, one call back.'
              }
            />
          </Reveal>
        </div>
      </div>

      {/* --------------------------------------------------------- WHY IT MATTERS */}
      <div
        data-r="why"
        style={{
          position: 'relative',
          width: 1728,
          display: 'flex',
          flexDirection: 'column',
          gap: 56,
          padding: '0 96px 104px',
          alignItems: 'flex-start',
          boxSizing: 'border-box',
          background: '#fff',
        }}
      >
        <Reveal as="span" y={20} duration={0.5}>
          <Eyebrow>[ why it matters ]</Eyebrow>
        </Reveal>
        <div
          data-r="wrow"
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 96,
            alignItems: 'flex-start',
            width: '100%',
          }}
        >
          <Reveal data-r="wheadwrap" style={{ width: 520, flexShrink: 0 }}>
            <SplitHeading data-r="whead" lines={why.heading} style={{ width: '100%' }} />
          </Reveal>
          <Stagger
            data-r="wcopy"
            stagger={0.1}
            style={{ width: 900, display: 'flex', flexDirection: 'column', gap: 26 }}
          >
            {why.paragraphs.map((text) => (
              <Stagger.Item key={text} as="span">
                <Body>{text}</Body>
              </Stagger.Item>
            ))}
          </Stagger>
        </div>
      </div>

      {/* ------------------------------------------------------------------ PERKS */}
      <Stagger
        data-r="perks"
        stagger={0.09}
        style={{
          position: 'relative',
          width: 1728,
          display: 'flex',
          flexDirection: 'row',
          gap: 25,
          padding: '0 96px 104px',
          alignItems: 'stretch',
          flexWrap: 'nowrap',
          boxSizing: 'border-box',
        }}
      >
        {perks.map((perk) => (
          <Stagger.Item
            key={perk.title}
            data-r="perk"
            variants={staggerItemScale}
            whileHover={{ y: -8, transition: { duration: 0.25, ease: 'easeOut' } }}
            style={{
              flex: '1 1 0',
              minWidth: 0,
              height: 280,
              overflow: 'hidden',
              borderRadius: 156,
              boxShadow: `inset 0 0 0 2px ${BLUE}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              padding: '40px 34px',
              justifyContent: 'center',
              alignItems: 'center',
              boxSizing: 'border-box',
            }}
          >
            <span
              data-r="ptitle"
              style={{
                fontFamily: 'Poppins,sans-serif',
                fontWeight: 700,
                fontSize: 30,
                textAlign: 'center',
                lineHeight: 1.2,
                color: BLUE,
              }}
            >
              {perk.title}
            </span>
            <span
              data-r="psub"
              style={{
                fontFamily: 'Poppins,sans-serif',
                fontWeight: 300,
                fontSize: 19,
                textAlign: 'center',
                lineHeight: 1.35,
                color: BLUE,
                textWrap: 'pretty',
              }}
            >
              {perk.sub}
            </span>
          </Stagger.Item>
        ))}
      </Stagger>

      {/* ----------------------------------------------------------- WHAT'S COVERED */}
      <div
        data-r="cover"
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
        <Reveal as="span" y={20} duration={0.5}>
          <Eyebrow>[ what your cover does ]</Eyebrow>
        </Reveal>
        <div
          data-r="crow"
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 64,
            alignItems: 'stretch',
            width: '100%',
          }}
        >
          <motion.div
            data-r="cimg"
            initial={{ opacity: 0, scale: 1.03 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.5, ease: EASE }}
            style={{
              position: 'relative',
              width: coverArt.width,
              flex: '0 0 600px',
              ...(coverArt.aspectRatio ? { aspectRatio: coverArt.aspectRatio } : null),
              alignSelf: coverArt.alignSelf,
              overflow: 'hidden',
              background: `url('${coverArt.image}') ${coverArt.position} / cover no-repeat`,
              height: coverArt.height,
            }}
          />
          <div
            data-r="cright"
            style={{ width: 872, display: 'flex', flexDirection: 'column', gap: 40 }}
          >
            <Reveal style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <SplitHeading data-r="chead" lines={cover.heading} fontSize={52} />
              <Body data-r="cintro">{cover.intro}</Body>
            </Reveal>
            <Stagger
              data-r="cgrid"
              stagger={0.05}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
                gap: 1,
                background: BLUE,
                width: '100%',
              }}
            >
              {cover.items.map((text, i) => (
                <Stagger.Item
                  key={text}
                  variants={staggerPassthrough}
                  style={{
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    padding: '24px 26px',
                    boxSizing: 'border-box',
                  }}
                >
                  <Stagger.Item
                    as="span"
                    variants={staggerItemFade}
                    style={{
                      fontFamily: 'Poppins,sans-serif',
                      fontSize: 17,
                      lineHeight: 1,
                      color: 'rgba(0,74,173,0.6)',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </Stagger.Item>
                  <Stagger.Item
                    as="span"
                    variants={staggerItemFade}
                    style={{
                      fontFamily: 'Poppins,sans-serif',
                      fontWeight: 300,
                      fontSize: 19,
                      lineHeight: 1.45,
                      color: BLUE,
                      textWrap: 'pretty',
                    }}
                  >
                    {text}
                  </Stagger.Item>
                </Stagger.Item>
              ))}
            </Stagger>
          </div>
        </div>
      </div>

      <TalkToExperts padding="0 0 104px" animate />
      <Partners animate />
      <Footer />
    </div>
  );
}
