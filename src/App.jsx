import { useEffect, useRef, useState } from 'react';
import { LANGS, TAG, conversations, seedMessages, glossary } from './data.js';

function useBackend() {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    fetch('/health/ready').then(r => r.json()).then(d => setOk(d.status === 'ok')).catch(() => setOk(false));
  }, []);
  return ok;
}

function Login({ onLogin }) {
  const [lang, setLang] = useState('id');
  return (
    <div className="login">
      <section className="login-brand">
        <div className="logo">Univoxia</div>
        <div>
          <h1>Bicara dalam bahasamu.<br />Dipahami dalam bahasa mereka.</h1>
          <p>Chat tim dengan terjemahan otomatis Indonesia, English, dan 中文, lengkap dengan glosarium istilah perusahaan.</p>
        </div>
        <div className="pills">{Object.values(LANGS).map(l => <span key={l}>{l}</span>)}</div>
      </section>
      <section className="login-form">
        <form onSubmit={e => { e.preventDefault(); onLogin(lang); }}>
          <h2>Masuk</h2>
          <p className="muted">Gunakan akun dari admin workspace-mu.</p>
          <label>Workspace<input defaultValue="PT Maju Bersama" /></label>
          <label>Username<input defaultValue="rina" autoComplete="username" /></label>
          <label>Password<input type="password" autoComplete="current-password" /></label>
          <label>Bahasa tampilan
            <select value={lang} onChange={e => setLang(e.target.value)}>
              {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <button className="primary" type="submit">Masuk ke Univoxia</button>
        </form>
      </section>
    </div>
  );
}

function Bubble({ m, lang }) {
  const shown = m.text[lang] ?? m.text[m.lang];
  const translated = m.lang !== lang;
  if (m.me) {
    return (
      <div className="msg mine">
        <div className="meta">{m.time} · Terkirim dalam {TAG[m.lang]}</div>
        <div className="bubble">{m.text[m.lang]}</div>
        {m.pending && <div className="orig">Menerjemahkan untuk anggota lain…</div>}
      </div>
    );
  }
  return (
    <div className="msg">
      <div className="avatar" style={{ background: m.color }}>{m.initials}</div>
      <div>
        <div className="meta"><b>{m.from}</b> · {m.time} · <span className={'tag' + (translated ? ' tr' : '')}>{translated ? `${TAG[m.lang]} → ${TAG[lang]}` : TAG[m.lang]}</span></div>
        <div className="bubble">{shown}</div>
        {translated && <div className="orig">Asli: {m.text[m.lang]}</div>}
      </div>
    </div>
  );
}

function Chat({ initialLang }) {
  const [lang, setLang] = useState(initialLang);
  const [active, setActive] = useState('gudang');
  const [msgs, setMsgs] = useState(seedMessages);
  const [draft, setDraft] = useState('');
  const [panel, setPanel] = useState(false);
  const backend = useBackend();
  const endRef = useRef(null);
  const conv = conversations.find(c => c.id === active);
  const list = msgs[active] ?? [];
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [list.length, active]);

  const send = e => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    setMsgs(s => ({ ...s, [active]: [...(s[active] ?? []), { id: Date.now(), from: 'Rina', me: true, time: now, lang, pending: true, text: { [lang]: t } }] }));
    setDraft('');
  };

  return (
    <div className="app">
      <aside className="side">
        <div className="ws"><div className="ws-logo">MB</div><div><b>PT Maju Bersama</b><small>Univoxia</small></div></div>
        <input type="search" aria-label="Cari percakapan" placeholder="Cari percakapan" />
        <nav aria-label="Percakapan">
          <small className="label">Percakapan</small>
          {conversations.map(c => (
            <button key={c.id} className={'conv' + (c.id === active ? ' on' : '')} onClick={() => setActive(c.id)}>
              <span className="ci" style={c.type === 'direct' ? { background: c.color, borderRadius: 16 } : undefined}>{c.initials ?? '#'}</span>
              <span className="grow">{c.title}</span>
              {c.unread && c.id !== active ? <span className="badge">{c.unread}</span> : null}
            </button>
          ))}
        </nav>
        <div className="me">
          <div className="avatar" style={{ background: '#F2C9C0' }}>RN</div>
          <div className="grow"><b>Rina</b>
            <select aria-label="Bahasa tampilan" value={lang} onChange={e => setLang(e.target.value)}>
              {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <span className={'dot ' + (backend === null ? '' : backend ? 'ok' : 'bad')} title={backend ? 'Server terhubung' : backend === false ? 'Server tidak terjangkau' : 'Memeriksa server'} />
        </div>
      </aside>

      <main className="main">
        <header>
          <div><h2>{conv.title}</h2><small>{conv.type === 'group' ? `${conv.members} anggota · ID, 中文, EN` : 'Percakapan langsung'}</small></div>
          <button className="ghost" onClick={() => setPanel(p => !p)}>{panel ? 'Tutup panel' : 'Ringkasan & glosarium'}</button>
        </header>
        <div className="stream">
          {list.length === 0 && <p className="empty">Belum ada pesan. Tulis pesan pertamamu di bawah, dan anggota lain akan membacanya dalam bahasa mereka.</p>}
          {list.map(m => <Bubble key={m.id} m={m} lang={lang} />)}
          <div ref={endRef} />
        </div>
        <form className="composer" onSubmit={send}>
          <input aria-label="Pesan" value={draft} onChange={e => setDraft(e.target.value)} placeholder={`Tulis pesan dalam ${LANGS[lang]}…`} />
          <span className="tag">{TAG[lang]}</span>
          <button className="send" aria-label="Kirim" type="submit">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></svg>
          </button>
        </form>
      </main>

      <aside className={'panel' + (panel ? ' open' : '')}>
        <small className="label">Ringkasan</small>
        <p>Kiriman dari Surabaya sudah tiba. 48 pallet diterima, 2 rusak; tim menunggu foto dari Budi.</p>
        <small className="label">Glosarium</small>
        {glossary.map(([a, b, c]) => <div className="term" key={a}><b>{a}</b> → {b} · {c}</div>)}
        <button className="dashed" type="button">+ Tambah istilah</button>
      </aside>
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState(null);
  return lang ? <Chat initialLang={lang} /> : <Login onLogin={setLang} />;
}
