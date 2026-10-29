import { useState } from 'react';
import { motion } from 'framer-motion';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import TalkToExperts from '../components/TalkToExperts';
import {
  Body,
  Eyebrow,
  Field,
  SplitHeading,
  SubmitRow,
  TextField,
} from '../components/Primitives';
import {
  EASE,
  Reveal,
  Stagger,
  staggerItem,
  staggerItemFade,
  staggerPassthrough,
} from '../components/Reveal';
import { ADDRESS, BLUE, EMAIL, EMAIL_HREF, PHONE, PHONE_HREF, RED, WHATSAPP } from '../data/site';

const DETAILS = [
  {
    label: 'Call us',
    value: PHONE,
    href: PHONE_HREF,
    note: 'Monday to Saturday, 10 am to 7 pm IST',
  },
  {
    label: 'Email us',
    value: EMAIL,
    href: EMAIL_HREF,
    note: 'Policy documents and claim papers welcome',
  },
  {
    label: 'WhatsApp',
    value: 'Chat with a counsellor',
    href: WHATSAPP,
    note: 'Quickest for quotes and quick questions',
  },
];

const HOURS = [
  { day: 'Monday - Friday', time: '10:00 am - 7:00 pm' },
  { day: 'Saturday', time: '10:00 am - 4:00 pm' },
  { day: 'Sunday', time: 'Closed' },
];

const TOPICS = ['New policy', 'Renewal', 'Claim support', 'Careers'];

const FIELDS = [
  { key: 'first', label: 'First name', placeholder: 'Nehal' },
  { key: 'last', label: 'Last name', placeholder: 'Kumar' },
  { key: 'mobile', label: 'Mobile no.', placeholder: '+91 00000 00000' },
  { key: 'email', label: 'Email', placeholder: 'you@example.com' },
];

const REACH_COPY = [
  'Whether you are comparing plans for the first time, adding a family member to an existing policy, or chasing an insurer on a claim - the same team handles it, end to end.',
  'We are a boutique firm, so there is no ticket queue. Reach out on whichever channel suits you and you will hear back the same working day.',
];

const MAP_HREF =
  'https://maps.google.com/?q=Arunachal+Building+Barakhamba+Road+Connaught+Place+New+Delhi';

export default function Contact() {
  const [topic, setTopic] = useState('New policy');
  const [form, setForm] = useState({});
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const setField = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setSent(false);
  };

  return (
    <div
      className="p-sub"
      data-page="contact"
      data-r="root"
      style={{
        position: 'relative',
        width: 1728,
        background: '#fff',
        fontFamily: 'Poppins,sans-serif',
        overflow: 'hidden',
      }}
    >
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
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgb(0,74,173) 0%, rgb(0,30,71) 118%)',
            }}
          />
          <motion.div
            initial={{ scale: 1.06 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.6, ease: EASE }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'url("/assets/contact-hero.webp") center / cover no-repeat',
              pointerEvents: 'none',
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
        </div>

        <Nav variant="white" active="contact" />

        <motion.div
          data-r="htitleblock"
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
            <Eyebrow color="#fff">[ contact us ]</Eyebrow>
          </motion.div>
          <motion.div variants={staggerItem}>
            <SplitHeading data-r="htitle" lines={['Talk To A', 'Real Human']} color="#fff" />
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
            Call, write or walk into our Connaught Place office. An insurance counsellor - not a
            call centre script - takes it from there.
          </motion.span>
        </motion.div>
      </div>

      {/* --------------------------------------------------------------- REACH US */}
      <div
        data-r="why"
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
        <Reveal as="span" y={20} duration={0.5}>
          <Eyebrow>[ how to reach us ]</Eyebrow>
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
            <SplitHeading
              data-r="whead"
              lines={['One Desk', 'For Every', 'Question']}
              style={{ width: '100%' }}
            />
          </Reveal>
          <Stagger
            data-r="wcopy"
            stagger={0.1}
            style={{ width: 900, display: 'flex', flexDirection: 'column', gap: 26 }}
          >
            {REACH_COPY.map((text) => (
              <Stagger.Item key={text} as="span">
                <Body>{text}</Body>
              </Stagger.Item>
            ))}
          </Stagger>
        </div>
      </div>

      {/* -------------------------------------------------------- CONTACT DETAILS */}
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
          <Eyebrow>[ our details ]</Eyebrow>
        </Reveal>
        <Stagger
          data-r="cgrid"
          stagger={0.08}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
            gap: 1,
            background: BLUE,
            width: '100%',
          }}
        >
          {DETAILS.map((d) => (
            <Stagger.Item
              key={d.label}
              variants={staggerPassthrough}
              style={{
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                padding: '44px 34px',
                boxSizing: 'border-box',
              }}
            >
              <Stagger.Item
                as="span"
                variants={staggerItemFade}
                style={{
                  fontFamily: 'Poppins,sans-serif',
                  fontWeight: 500,
                  fontSize: 15,
                  lineHeight: 1,
                  color: 'rgba(0,74,173,0.6)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {d.label}
              </Stagger.Item>
              <Stagger.Item
                as="a"
                variants={staggerItemFade}
                href={d.href}
                {...(d.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : null)}
                style={{
                  fontFamily: 'Poppins,sans-serif',
                  fontWeight: 700,
                  fontSize: 27,
                  lineHeight: 1.25,
                  color: BLUE,
                  textWrap: 'pretty',
                }}
              >
                {d.value}
              </Stagger.Item>
              <Stagger.Item
                as="span"
                variants={staggerItemFade}
                style={{
                  fontFamily: 'Poppins,sans-serif',
                  fontWeight: 300,
                  fontSize: 18,
                  lineHeight: 1.45,
                  color: BLUE,
                  textWrap: 'pretty',
                }}
              >
                {d.note}
              </Stagger.Item>
            </Stagger.Item>
          ))}
        </Stagger>
      </div>

      {/* ---------------------------------------------------------- OFFICE + FORM */}
      <div
        data-r="quote"
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
          <Eyebrow>[ send us a message ]</Eyebrow>
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
            <SplitHeading data-r="qhead" lines={['Visit The', 'Office']} fontSize={52} />
            <Body data-r="qcopy">
              {ADDRESS}. Nearest metro: Barakhamba Road.
            </Body>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {HOURS.map((h) => (
                <div
                  key={h.day}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 20,
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    boxShadow: 'inset 0 -1px 0 rgba(0,74,173,0.25)',
                    paddingBottom: 10,
                  }}
                >
                  <span
                    data-r="qmeta"
                    style={{
                      fontFamily: 'Poppins,sans-serif',
                      fontWeight: 500,
                      fontSize: 19,
                      color: BLUE,
                    }}
                  >
                    {h.day}
                  </span>
                  <span
                    data-r="qmeta"
                    style={{
                      fontFamily: 'Poppins,sans-serif',
                      fontWeight: 300,
                      fontSize: 19,
                      color: BLUE,
                    }}
                  >
                    {h.time}
                  </span>
                </div>
              ))}
            </div>
            <a
              href={MAP_HREF}
              data-r="qmeta"
              className="dc-cta-call"
              target="_blank"
              rel="noreferrer"
              style={{
                alignSelf: 'flex-start',
                background: RED,
                borderRadius: 52,
                padding: '18px 40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Poppins,sans-serif',
                fontWeight: 500,
                fontSize: 19,
                color: '#fff',
                whiteSpace: 'nowrap',
              }}
            >
              Get directions
            </a>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span
                style={{
                  fontFamily: 'Poppins,sans-serif',
                  fontWeight: 500,
                  fontSize: 15,
                  color: BLUE,
                  textTransform: 'uppercase',
                }}
              >
                What is this about
              </span>
              <div style={{ display: 'flex', flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                {TOPICS.map((t) => {
                  const selected = topic === t;
                  return (
                    <motion.div
                      key={t}
                      onClick={() => {
                        setTopic(t);
                        setSent(false);
                      }}
                      whileTap={{ scale: 0.96 }}
                      style={{
                        borderRadius: 52,
                        padding: '12px 22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease,color 0.2s ease',
                        ...(selected
                          ? { background: BLUE, color: '#fff' }
                          : {
                              background: 'transparent',
                              color: BLUE,
                              boxShadow: 'inset 0 0 0 1px rgba(0,74,173,0.45)',
                            }),
                      }}
                    >
                      <span
                        data-r="chip"
style={{
                          fontFamily: 'Poppins,sans-serif',
                          fontWeight: 500,
                          fontSize: 17,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

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
              {FIELDS.map((field) => (
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

            <TextField
              label="Message"
              rows={4}
              value={message}
              placeholder="Tell us what you need help with"
              onChange={(e) => {
                setMessage(e.target.value);
                setSent(false);
              }}
            />

            <SubmitRow
              sent={sent}
              onClick={() => setSent(true)}
              label={sent ? 'Message sent' : 'Send message'}
              note={
                sent
                  ? 'Thanks - a counsellor will get back to you the same working day.'
                  : `About: ${topic}. No marketing calls, ever.`
              }
            />
          </Reveal>
        </div>
      </div>

      <TalkToExperts padding="0" animate />
      <Footer />
    </div>
  );
}
