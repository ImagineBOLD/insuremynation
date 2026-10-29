import { BLUE } from '../data/site';

/** The `[ section name ]` label that opens every section. */
export function Eyebrow({ children, color = BLUE, ...rest }) {
  return (
    <span
      data-r="eyebrow"
      {...rest}
      style={{
        fontFamily: 'Poppins,sans-serif',
        fontWeight: 500,
        fontSize: 24,
        lineHeight: 1,
        color,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

/**
 * Two-weight stacked heading: a 700 line followed by 300 lines.
 * `lines[0]` is the bold one, the rest are light.
 */
export function SplitHeading({ lines, fontSize = 64, color = BLUE, style, ...rest }) {
  const [bold, ...light] = lines;
  return (
    <span
      {...rest}
      style={{
        display: 'block',
        fontFamily: 'Poppins,sans-serif',
        fontSize,
        lineHeight: 1.1,
        color,
        textTransform: 'uppercase',
        ...style,
      }}
    >
      <strong style={{ display: 'block', fontWeight: 700 }}>{bold}</strong>
      {light.map((line) => (
        <span key={line} style={{ display: 'block', fontWeight: 300 }}>
          {line}
        </span>
      ))}
    </span>
  );
}

/** Body copy paragraph used throughout the "why it matters" columns. */
export function Body({ children, fontSize = 21, color = BLUE, ...rest }) {
  return (
    <span
      {...rest}
      style={{
        fontFamily: 'Poppins,sans-serif',
        fontWeight: 300,
        fontSize,
        lineHeight: 1.6,
        color,
        textWrap: 'pretty',
      }}
    >
      {children}
    </span>
  );
}

const labelStyle = {
  fontFamily: 'Poppins,sans-serif',
  fontWeight: 500,
  fontSize: 15,
  color: BLUE,
  textTransform: 'uppercase',
  lineHeight: 1.2,
};

const controlStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'transparent',
  border: 0,
  borderBottom: '1px solid rgba(0,74,173,0.35)',
  padding: '10px 2px',
  fontFamily: 'Poppins,sans-serif',
  fontWeight: 300,
  fontSize: 19,
  color: BLUE,
  outline: 'none',
};

/** Underlined text field. */
export function Field({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      <input
        type="text"
        className="dc-input"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={controlStyle}
      />
    </label>
  );
}

/** Underlined multi-line field. */
export function TextField({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      <textarea
        rows={rows}
        className="dc-textarea"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ ...controlStyle, resize: 'vertical' }}
      />
    </label>
  );
}

/** Pill submit button + the note that sits beside it. */
export function SubmitRow({ label, note, sent, onClick }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 24,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        style={{
          background: sent ? 'rgb(0,30,71)' : BLUE,
          borderRadius: 52,
          padding: '18px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'background 0.25s ease',
          flexShrink: 0,
        }}
      >
        <span
          data-r="submitlabel"
          style={{
            fontFamily: 'Poppins,sans-serif',
            fontWeight: 500,
            fontSize: 19,
            color: '#fff',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontFamily: 'Poppins,sans-serif',
          fontWeight: 300,
          fontSize: 16,
          lineHeight: 1.4,
          color: 'rgba(0,74,173,0.7)',
          flex: '1 1 240px',
          minWidth: 0,
          textWrap: 'pretty',
        }}
      >
        {note}
      </span>
    </div>
  );
}

/** Frosted round button behind the carousel arrows. */
export const glassButton = {
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
