import { useRef, useState } from 'react';
import { BLUE, DEEP } from '../../data/site';
import { contactError, formatContact } from './contactAsk';
import { COUNTRIES, DEFAULT_DIAL, flagOf } from './countries';

/**
 * The contact ask, as fields instead of a paragraph.
 *
 * `onSubmit` gets two things: the prose, which renders as the visitor's own bubble and goes out
 * as the turn's question, and the fields themselves, which ride the same request as `name`,
 * `phone` and `email`. The second argument is what actually creates the lead — the RAG service
 * buffers a whole conversation and pushes it to the CRM the moment a phone number arrives, and
 * cannot create one without a number. Sending only the prose is what the previous integration
 * did, and it is why this channel produced no leads at all.
 *
 * No WhatsApp checkbox: consent for that is a separate ask, and one on this form was a second
 * ask of the same question.
 */
export default function ContactForm({ onSubmit, disabled, onDismiss }) {
  const [name, setName] = useState('');
  const [dial, setDial] = useState(DEFAULT_DIAL);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  // Errors appear on submit, not while typing: a message that argues with a half-typed number
  // is noise.
  const [error, setError] = useState(null);
  const nameRef = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    if (disabled) return;
    const fields = { name, dial, phone, email };
    const problem = contactError(fields);
    if (problem) {
      setError(problem);
      return;
    }
    // The phone goes out in E.164 — the CRM parses it and rejects what it cannot.
    onSubmit(formatContact(fields), {
      name: name.trim(),
      phone: `${dial}${phone.replace(/\D/g, '')}`,
      email: email.trim(),
    });
  };

  return (
    <form className="imn-chat-contact" onSubmit={submit} style={wrap}>
      {/* The form is offered by us now, not asked for by the assistant, so it has to say why it
          appeared. Without a heading it reads as a form that interrupted the conversation. */}
      <div style={heading}>Want a specialist to call you?</div>
      <p style={subhead}>
        Leave your number and a counsellor will call within one working day. No documents, no
        payment details — just a conversation.
      </p>

      <Row label="Your name">
        <input
          ref={nameRef}
          className="imn-chat-field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          placeholder="Nehal Kumar"
          style={input}
        />
      </Row>

      <Row label="Mobile number">
        <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
          {/* A native select: the OS picker on a phone, type-to-filter on a desktop, and
              keyboard accessible without any of it being written here. 239 options is
              nothing, and a custom combobox would be worse in every one of those ways. */}
          <select
            className="imn-chat-field"
            value={dial}
            onChange={(e) => setDial(e.target.value)}
            aria-label="Country dialling code"
            style={{ ...input, flex: '0 0 auto', maxWidth: 132 }}
          >
            {COUNTRIES.map(([code, d, country]) => (
              // The dial code is not unique — +1 covers twenty territories — so the ISO code
              // keys the option and the value carries both.
              <option key={code} value={d}>
                {flagOf(code)} {d} {country}
              </option>
            ))}
          </select>
          <input
            className="imn-chat-field"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            // `tel` rather than number: a number input strips leading zeros and offers
            // spinners, neither of which belongs on a phone number.
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="99101 69789"
            style={{ ...input, flex: 1, minWidth: 0 }}
          />
        </div>
      </Row>

      <Row label="Email (optional)">
        <input
          className="imn-chat-field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          style={input}
        />
      </Row>

      {error && (
        <div role="alert" style={{ fontSize: 12, color: 'rgb(150,30,33)' }}>
          {error}
        </div>
      )}

      <button type="submit" className="imn-chat-submit" disabled={disabled} style={button}>
        Send my details
      </button>

      {/* Declining is an answer, and the hook remembers it — the form is not offered again in
          this conversation. Without this the only way out is to ignore a card that stays pinned
          under every reply. */}
      <p style={note}>
        Or keep asking below.{' '}
        {onDismiss && (
          <button type="button" onClick={onDismiss} style={dismiss}>
            No thanks
          </button>
        )}
      </p>
    </form>
  );
}

function Row({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(0,30,71,0.65)' }}>{label}</span>
      {children}
    </label>
  );
}

// It lives inside the scrolling transcript, so it reads as a card in the conversation rather
// than a bar bolted to the bottom of the panel.
const wrap = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  marginTop: 4,
  border: '1px solid rgba(0,74,173,0.14)',
  borderRadius: 14,
  background: '#f8fafc',
  flexShrink: 0,
};

const input = {
  appearance: 'none',
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  border: '1.5px solid rgba(0,74,173,0.22)',
  borderRadius: 10,
  padding: '9px 10px',
  fontFamily: 'inherit',
  fontWeight: 300,
  fontSize: 14,
  lineHeight: 1.3,
  color: BLUE,
  background: '#fff',
};

const button = {
  appearance: 'none',
  border: 0,
  borderRadius: 10,
  padding: '11px 14px',
  marginTop: 2,
  fontFamily: 'inherit',
  fontWeight: 500,
  fontSize: 14,
  color: '#fff',
  background: BLUE,
  cursor: 'pointer',
};

const note = {
  margin: 0,
  fontSize: 11,
  fontWeight: 300,
  lineHeight: 1.4,
  color: 'rgba(0,30,71,0.55)',
  textAlign: 'center',
};

const heading = {
  fontSize: 13,
  fontWeight: 500,
  color: DEEP,
};

const subhead = {
  margin: 0,
  fontSize: 11,
  fontWeight: 300,
  lineHeight: 1.45,
  color: 'rgba(0,30,71,0.65)',
};

// A link, not a second button: declining must not compete with sending.
const dismiss = {
  background: 'none',
  border: 0,
  padding: 0,
  font: 'inherit',
  color: BLUE,
  textDecoration: 'underline',
  cursor: 'pointer',
};
