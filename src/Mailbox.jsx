import { useState } from 'react';
import { CharacterPortrait } from './CharacterPortrait.jsx';
import { CONTACT_DETAILS, sendLetter } from './config/contactConfig.js';
export function Mailbox() {
  const [tab, setTab] = useState('letter');
  const [draft, setDraft] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [sending, setSending] = useState(false);
  const change = event => setDraft({ ...draft, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault();
    if (sending) return;
    if (!draft.name.trim() || !draft.message.trim()) { setStatus('이름과 편지 내용을 입력해주세요.'); return; }
    setSending(true); setStatus('');
    try {
      await sendLetter(draft);
      setDraft({ name: '', email: '', message: '' });
      setStatus('편지가 전달되었어요. 고마워요!');
    }
    catch (error) { setStatus(error.message || '편지를 보내지 못했어요. 잠시 후 다시 시도해주세요.'); }
    finally { setSending(false); }
  }
  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(CONTACT_DETAILS.email);
      setCopyStatus('이메일 주소를 복사했어요.');
    } catch {
      setCopyStatus('복사하지 못했어요. 이메일 주소를 직접 선택해주세요.');
    }
  }
  return <div className="mailbox-panel">
    <header className="mailbox-panel__header"><div><p className="panel-kicker">TAKE A LITTLE BREAK</p><h2 id="travel-menu-title">Mailbox</h2><p>구따지에게 편지를 남겨보세요.</p></div><CharacterPortrait variant="letter" /></header>
    <div className="mailbox-paper">
      <div className="mailbox-tabs" role="group" aria-label="우체통 보기 선택"><button aria-pressed={tab === 'letter'} onClick={() => setTab('letter')}>편지 보내기</button><button aria-pressed={tab === 'contact'} onClick={() => setTab('contact')}>연락처 보기</button></div>
      <div hidden={tab !== 'letter'}><form onSubmit={submit}>
        <label>이름<input name="name" autoComplete="name" maxLength={60} required value={draft.name} onChange={change} placeholder="이름을 입력해주세요." /></label>
        <label>이메일<input name="email" type="email" autoComplete="email" maxLength={254} required value={draft.email} onChange={change} placeholder="답장 받을 이메일 주소" /></label>
        <label>편지<textarea name="message" maxLength={500} required value={draft.message} onChange={change} placeholder="편지 내용을 입력해주세요." /></label>
        <p className="letter-count">{draft.message.length} / 500</p>
        <button className="letter-send" type="submit" disabled={sending}>{sending ? '보내는 중…' : '편지 보내기'}</button>
        <p className="mailbox-footnote">보낸 편지는 구따지의 이메일로 전달돼요.</p>
        <p className="letter-status" role="status">{status}</p>
      </form></div>
      {tab === 'contact' && <section className="mailbox-contact"><span>HELLO, LITTLE TRAVELER</span><h3>문의하기</h3><p>구따지에게 연락하고 싶으면</p>{CONTACT_DETAILS.email ? <><button className="mailbox-contact__email" type="button" onClick={copyEmail} aria-label={`${CONTACT_DETAILS.email} 복사`}>{CONTACT_DETAILS.email}<small>복사</small></button><p className="mailbox-contact__copy-status" role="status">{copyStatus}</p></> : <p className="contact-pending">연락처를 준비하고 있어요.</p>}</section>}
    </div>
  </div>;
}
