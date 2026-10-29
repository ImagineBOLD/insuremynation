import { Link } from 'react-router-dom';
import { MailIcon, PhoneIcon, PinIcon } from './Icons';
import { ADDRESS, EMAIL, INSURANCE_LINKS, PHONE } from '../data/site';

const colStyle = (width) => ({
  width,
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.5)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 44,
  alignItems: 'flex-start',
  boxSizing: 'border-box',
  flexShrink: 0,
});

const headingStyle = {
  fontFamily: 'Poppins,sans-serif',
  fontWeight: 500,
  fontSize: 16,
  lineHeight: 1.3,
  color: '#fff',
  textTransform: 'uppercase',
  marginBottom: 12,
};

const linkStyle = {
  fontFamily: 'Poppins,sans-serif',
  fontSize: 16,
  lineHeight: 1.35,
  color: '#fff',
};

const contactRow = { display: 'flex', gap: 10, alignItems: 'center' };

export default function Footer() {
  return (
    <div
      data-r="footer"
      style={{
        position: 'relative',
        width: 1728,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, rgb(0,74,173) -14.71%, rgb(0,30,71) 121.42%)',
        display: 'flex',
        flexDirection: 'column',
        padding: '80px 44px 0',
        alignItems: 'stretch',
        boxSizing: 'border-box',
      }}
    >
      <div
        data-r="ftop"
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 32,
          width: '100%',
        }}
      >
        <div
          data-r="fleft"
          style={{
            position: 'relative',
            zIndex: 1,
            width: 321,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            alignItems: 'flex-start',
            flexShrink: 0,
          }}
        >
          <img
            data-r="flogo"
            decoding="async"
            loading="lazy"
            src="/assets/logo-footer.webp"
            alt="InsureNation"
            style={{ width: 286, height: 'auto', objectFit: 'contain' }}
          />
          <span
            data-r="ftag"
            style={{
              alignSelf: 'stretch',
              fontFamily: 'Poppins,sans-serif',
              fontSize: 16,
              lineHeight: 1.5,
              color: '#fff',
            }}
          >
            Honest advice,
            <br />
            coverage that fits
          </span>
        </div>

        <div
          data-r="fcols"
          style={{
            position: 'relative',
            zIndex: 1,
            width: 1244,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            flexShrink: 0,
          }}
        >
          <div data-r="fcol" style={colStyle(402)}>
            <span style={headingStyle}>Insurance</span>
            {INSURANCE_LINKS.map((item) => (
              <Link key={item.to} to={item.to} style={linkStyle}>
                {item.label}
              </Link>
            ))}
          </div>

          <div data-r="fcol" style={colStyle(402)}>
            <span style={headingStyle}>Our Company</span>
            <Link to="/about" style={linkStyle}>
              About Us
            </Link>
            <Link to="/contact" style={linkStyle}>
              Contact US
            </Link>
            <Link to="/career" style={linkStyle}>
              Career
            </Link>
            <a href="#" onClick={(e) => e.preventDefault()} style={linkStyle}>
              Blog
            </a>
            <Link to="/privacy-policy" style={linkStyle}>
              Privacy Policy
            </Link>
          </div>

          <div data-r="fcol" data-c="contact" style={colStyle(442)}>
            <span style={headingStyle}>Get in touch</span>
            <div style={contactRow}>
              <MailIcon />
              <span data-r="femail" style={{ ...linkStyle, whiteSpace: 'nowrap' }}>
                {EMAIL}
              </span>
            </div>
            <div style={contactRow}>
              <PhoneIcon />
              <span style={linkStyle}>{PHONE}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <PinIcon />
              <span
                style={{
                  fontFamily: 'Poppins,sans-serif',
                  fontSize: 16,
                  color: '#fff',
                  lineHeight: 1.4,
                }}
              >
                {ADDRESS}
              </span>
            </div>
          </div>
        </div>
      </div>

      <span
        data-r="fmark"
        style={{
          position: 'relative',
          zIndex: 0,
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: 56,
          fontFamily: 'Poppins,sans-serif',
          fontWeight: 700,
          fontSize: 132,
          lineHeight: 1,
          color: '#fff',
          mixBlendMode: 'soft-light',
          whiteSpace: 'nowrap',
        }}
      >
        {'INSURENATION'.split('').map((ch, i) => (
          <span key={i}>{ch}</span>
        ))}
      </span>
    </div>
  );
}
