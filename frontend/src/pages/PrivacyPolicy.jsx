import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Nav from '../components/Nav';
import Footer from '../components/Footer';
import TalkToExperts from '../components/TalkToExperts';
import { Body, Eyebrow, SplitHeading } from '../components/Primitives';
import { Reveal, staggerItem } from '../components/Reveal';
import { BLUE, DEEP, EMAIL, EMAIL_HREF } from '../data/site';
import { PRIVACY_EFFECTIVE, PRIVACY_SECTIONS, PRIVACY_UPDATED } from '../data/privacy';

const linkStyle = { color: BLUE, borderBottom: `1px solid ${BLUE}` };

const cellStyle = {
  padding: '16px 20px',
  borderBottom: '1px solid rgba(0,74,173,0.2)',
  textAlign: 'left',
  verticalAlign: 'top',
  fontFamily: 'Poppins,sans-serif',
  fontSize: 18,
  lineHeight: 1.5,
  color: BLUE,
};

/** Renders one run of policy text: a string, or parts (see data/privacy.js). */
function Rich({ text }) {
  if (typeof text === 'string') return text;
  return text.map((part, i) => {
    if (typeof part === 'string') return <Fragment key={i}>{part}</Fragment>;
    if (part.b) return <strong key={i} style={{ fontWeight: 600 }}>{part.b}</strong>;
    if (part.email)
      return (
        <a key={i} href={EMAIL_HREF} style={linkStyle}>
          {EMAIL}
        </a>
      );
    return (
      <Link key={i} to={part.to} style={linkStyle}>
        {part.text}
      </Link>
    );
  });
}

function Block({ block }) {
  if (block.h)
    return (
      <span
        data-r="lgsub"
        style={{
          fontFamily: 'Poppins,sans-serif',
          fontWeight: 500,
          fontSize: 24,
          lineHeight: 1.3,
          color: BLUE,
        }}
      >
        {block.h}
      </span>
    );
  if (block.ul)
    return (
      <ul
        style={{
          margin: 0,
          paddingLeft: 26,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          color: BLUE,
        }}
      >
        {block.ul.map((item, i) => (
          <li key={i}>
            <Body data-r="lgtext">
              <Rich text={item} />
            </Body>
          </li>
        ))}
      </ul>
    );
  if (block.table)
    return (
      <div data-r="lgtable" style={{ width: '100%', overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            minWidth: 640,
            borderCollapse: 'collapse',
            borderTop: `2px solid ${BLUE}`,
          }}
        >
          <thead>
            <tr>
              {block.table.head.map((h) => (
                <th
                  key={h}
                  style={{
                    ...cellStyle,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    background: 'rgba(0,74,173,0.06)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.table.rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) => (
                  <td key={i} style={{ ...cellStyle, fontWeight: i === 0 ? 500 : 300 }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return (
    <Body data-r="lgtext">
      <Rich text={block.p} />
    </Body>
  );
}

export default function PrivacyPolicy() {
  return (
    <div
      className="p-legal"
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
        data-r="lghero"
        style={{
          position: 'relative',
          width: 1728,
          background: `linear-gradient(180deg, ${BLUE} -14.71%, ${DEEP} 121.42%)`,
          padding: '232px 96px 88px',
          boxSizing: 'border-box',
        }}
      >
        <Nav variant="white" />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            alignItems: 'flex-start',
          }}
        >
          <motion.div variants={staggerItem}>
            <Eyebrow color="#fff">[ legal ]</Eyebrow>
          </motion.div>
          <motion.div variants={staggerItem}>
            <SplitHeading data-r="lgtitle" lines={['Privacy', 'Policy']} color="#fff" />
          </motion.div>
          <motion.span
            data-r="lgdate"
            variants={staggerItem}
            style={{
              fontFamily: 'Poppins,sans-serif',
              fontWeight: 300,
              fontSize: 21,
              lineHeight: 1.4,
              color: '#fff',
            }}
          >
            Effective {PRIVACY_EFFECTIVE} · Last updated {PRIVACY_UPDATED}
          </motion.span>
        </motion.div>
      </div>

      {/* ---------------------------------------------------------------- BODY */}
      <div
        data-r="lgbody"
        style={{
          position: 'relative',
          width: 1728,
          display: 'flex',
          flexDirection: 'column',
          gap: 72,
          padding: '104px 96px',
          boxSizing: 'border-box',
        }}
      >
        {PRIVACY_SECTIONS.map((section, i) => (
          <Reveal
            key={section.title}
            data-r="lgsec"
            y={20}
            style={{
              maxWidth: 1100,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              alignItems: 'flex-start',
            }}
          >
            <span
              data-r="lghead"
              style={{
                fontFamily: 'Poppins,sans-serif',
                fontWeight: 700,
                fontSize: 34,
                lineHeight: 1.15,
                color: BLUE,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              {i + 1}. {section.title}
            </span>
            {section.blocks.map((block, j) => (
              <Block key={j} block={block} />
            ))}
          </Reveal>
        ))}
      </div>

      <TalkToExperts />
      <Footer />
    </div>
  );
}
