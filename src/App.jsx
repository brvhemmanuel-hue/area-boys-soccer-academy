import { useEffect, useMemo, useState, useCallback } from 'react';
import { IMPORTS, POSITIONS, STATUSES, parseCSV, alias, validate } from './importer.js';

const CUR = 'GH₵'; // change to your currency
const money = (n) => `${CUR} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const initials = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const hue = (s = '') => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

async function api(path, opts = {}) {
  const token = localStorage.getItem('fc_token');
  const r = await fetch('/api/' + path, {
    method: opts.method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== 'login') { localStorage.removeItem('fc_token'); location.reload(); }
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const pill = (v) => <span className={`pill ${String(v).toLowerCase()}`}>{v}</span>;

const CFG = {
  members: {
    title: 'Members', singular: 'member', view: 'cards', search: ['full_name', 'position', 'phone'],
    filter: { key: 'status', options: STATUSES }, defaults: () => ({ status: 'active', joined_on: today() }),
    fields: () => [
      { name: 'full_name', label: 'Full name', required: true, wide: true },
      { name: 'jersey_no', label: 'Jersey number', type: 'number' },
      { name: 'position', label: 'Position', type: 'select', options: POSITIONS },
      { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email', type: 'email' },
      { name: 'status', label: 'Status', type: 'select', options: STATUSES },
      { name: 'joined_on', label: 'Joined on', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
    ],
  },
  activities: {
    title: 'Activities', singular: 'activity', search: ['title', 'type'],
    filter: { key: 'type', options: ['Match', 'Training', 'Tournament', 'Fundraiser', 'Kit & equipment', 'Social event', 'Dues', 'Other'] },
    defaults: () => ({ type: 'Fundraiser', activity_date: today(), target_amount: 0 }),
    cols: [
      { h: 'Activity', r: (x) => <b>{x.title}</b> }, { h: 'Type', r: (x) => x.type }, { h: 'Date', r: (x) => fmtDate(x.activity_date) },
      { h: 'Progress', r: (x) => {
        const p = x.target_amount > 0 ? Math.min(100, (x.collected / x.target_amount) * 100) : 0;
        return <div className="prog"><div className="bar"><i style={{ width: p + '%' }} /></div><small>{money(x.collected)}{x.target_amount > 0 && ` of ${money(x.target_amount)}`}</small></div>;
      } },
    ],
    fields: () => [
      { name: 'title', label: 'Activity name', required: true, wide: true },
      { name: 'type', label: 'Type', type: 'select', options: ['Match', 'Training', 'Tournament', 'Fundraiser', 'Kit & equipment', 'Social event', 'Dues', 'Other'] },
      { name: 'activity_date', label: 'Date', type: 'date' },
      { name: 'target_amount', label: `Target amount (${CUR})`, type: 'number', step: '0.01' },
      { name: 'description', label: 'Description', type: 'textarea', wide: true },
    ],
  },
  contributions: {
    title: 'Contributions', singular: 'contribution', sum: 'amount', search: ['member_name', 'activity_title', 'note'],
    filter: { key: 'method', options: ['Cash', 'Mobile money', 'Bank transfer', 'Other'] },
    defaults: () => ({ method: 'Mobile money', paid_on: today() }),
    cols: [
      { h: 'Date', r: (x) => fmtDate(x.paid_on) }, { h: 'Member', r: (x) => <b>{x.member_name}</b> },
      { h: 'Activity', r: (x) => x.activity_title || 'General fund' }, { h: 'Method', r: (x) => x.method },
      { h: 'Amount', num: true, r: (x) => money(x.amount) },
    ],
    fields: (d) => [
      { name: 'member_id', label: 'Member', type: 'select', required: true, options: d.members.map((m) => [m.id, m.full_name]), wide: true },
      { name: 'activity_id', label: 'Activity', type: 'select', options: d.activities.map((a) => [a.id, a.title]), blank: 'General fund', wide: true },
      { name: 'amount', label: `Amount (${CUR})`, type: 'number', step: '0.01', required: true },
      { name: 'method', label: 'Payment method', type: 'select', options: ['Cash', 'Mobile money', 'Bank transfer', 'Other'] },
      { name: 'paid_on', label: 'Date paid', type: 'date' }, { name: 'note', label: 'Note' },
    ],
  },
  matches: {
    title: 'Fixtures & results', singular: 'match', search: ['opponent', 'venue'],
    filter: { key: 'status', options: ['Scheduled', 'Played', 'Postponed'] },
    defaults: () => ({ status: 'Scheduled', home_away: 'Home', match_date: today() }),
    cols: [
      { h: 'Date', r: (x) => fmtDate(x.match_date) }, { h: 'Opponent', r: (x) => <b>{x.home_away === 'Away' ? '@ ' : 'vs '}{x.opponent}</b> },
      { h: 'Venue', r: (x) => x.venue || '—' },
      { h: 'Result', r: (x) => {
        if (x.status !== 'Played') return pill(x.status);
        const r = x.goals_for > x.goals_against ? 'Win' : x.goals_for < x.goals_against ? 'Loss' : 'Draw';
        return <span className="score">{x.goals_for} – {x.goals_against} {pill(r)}</span>;
      } },
    ],
    fields: () => [
      { name: 'opponent', label: 'Opponent', required: true, wide: true },
      { name: 'match_date', label: 'Date', type: 'date', required: true }, { name: 'venue', label: 'Venue' },
      { name: 'home_away', label: 'Home / Away', type: 'select', options: ['Home', 'Away'] },
      { name: 'status', label: 'Status', type: 'select', options: ['Scheduled', 'Played', 'Postponed'] },
      { name: 'goals_for', label: 'Our goals', type: 'number' }, { name: 'goals_against', label: 'Their goals', type: 'number' },
    ],
  },
  expenses: {
    title: 'Expenses', singular: 'expense', sum: 'amount', search: ['title', 'category', 'note'],
    filter: { key: 'category', options: ['Kits', 'Equipment', 'Pitch hire', 'Transport', 'Referees', 'Medical', 'Refreshments', 'General'] },
    defaults: () => ({ category: 'General', spent_on: today() }),
    cols: [
      { h: 'Date', r: (x) => fmtDate(x.spent_on) }, { h: 'Expense', r: (x) => <b>{x.title}</b> },
      { h: 'Category', r: (x) => x.category }, { h: 'Amount', num: true, r: (x) => money(x.amount) },
    ],
    fields: () => [
      { name: 'title', label: 'What was it for?', required: true, wide: true },
      { name: 'category', label: 'Category', type: 'select', options: ['Kits', 'Equipment', 'Pitch hire', 'Transport', 'Referees', 'Medical', 'Refreshments', 'General'] },
      { name: 'amount', label: `Amount (${CUR})`, type: 'number', step: '0.01', required: true },
      { name: 'spent_on', label: 'Date', type: 'date' }, { name: 'note', label: 'Note' },
    ],
  },
};
const NAV = ['dashboard', ...Object.keys(CFG), 'import'];

/* ---------- Form modal (create & edit) ---------- */
function FormModal({ k, initial, data, onClose, onSaved, toast }) {
  const cfg = CFG[k];
  const [v, setV] = useState({ ...cfg.defaults(), ...initial });
  const [busy, setBusy] = useState(false);
  const fields = cfg.fields(data);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = {};
      fields.forEach((f) => { body[f.name] = v[f.name] ?? ''; });
      await api(initial?.id ? `${k}?id=${initial.id}` : k, { method: initial?.id ? 'PUT' : 'POST', body });
      toast(`${initial?.id ? 'Changes saved' : cfg.singular[0].toUpperCase() + cfg.singular.slice(1) + ' added'}`);
      onSaved();
    } catch (err) { toast(err.message, 'err'); setBusy(false); }
  };
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>{initial?.id ? `Edit ${cfg.singular}` : `Add ${cfg.singular}`}</h2>
        <div className="grid">
          {fields.map((f) => (
            <label key={f.name} className={f.wide ? 'wide' : ''}>{f.label}
              {f.type === 'select' ? (
                <select value={v[f.name] ?? ''} required={f.required} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}>
                  {(f.blank || !f.required) && <option value="">{f.blank || '—'}</option>}
                  {f.required && !v[f.name] && <option value="" disabled>Choose…</option>}
                  {f.options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea rows="3" value={v[f.name] ?? ''} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
              ) : (
                <input type={f.type || 'text'} step={f.step} required={f.required} autoFocus={f === fields[0]}
                  value={v[f.name] ?? ''} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
              )}
            </label>
          ))}
        </div>
        <div className="row end">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy}>{busy ? 'Saving…' : initial?.id ? 'Save changes' : `Add ${cfg.singular}`}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Generic list page ---------- */
function Resource({ k, data, open, reload, toast }) {
  const cfg = CFG[k]; const rows = data[k] || [];
  const [q, setQ] = useState(''); const [f, setF] = useState('all');
  const shown = useMemo(() => rows.filter((r) =>
    (f === 'all' || String(r[cfg.filter.key]).toLowerCase() === f.toLowerCase()) &&
    (!q || cfg.search.some((s) => String(r[s] ?? '').toLowerCase().includes(q.toLowerCase())))), [rows, q, f, k]);
  const del = async (r) => {
    if (!confirm(`Delete this ${cfg.singular}? This cannot be undone.${k === 'members' ? ' All of their recorded contributions will be deleted too.' : ''}`)) return;
    try { await api(`${k}?id=${r.id}`, { method: 'DELETE' }); toast(`${cfg.singular[0].toUpperCase() + cfg.singular.slice(1)} deleted`); reload(); }
    catch (e) { toast(e.message, 'err'); }
  };
  const csv = () => {
    if (!shown.length) { toast(`Nothing to export yet. Add a ${cfg.singular} first.`, 'err'); return; }
    const keys = Object.keys(shown[0]).filter((x) => x !== 'id');
    const esc = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    const text = [keys.join(','), ...shown.map((r) => keys.map((x) => esc(r[x])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${k}-${today()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${shown.length} ${shown.length === 1 ? cfg.singular : cfg.title.toLowerCase()}`);
  };
  const total = cfg.sum ? shown.reduce((a, r) => a + Number(r[cfg.sum]), 0) : null;
  return (
    <section>
      <header className="page-head">
        <h1>{cfg.title}</h1>
        <div className="tools">
          <input className="search" placeholder={`Search ${cfg.title.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={f} onChange={(e) => setF(e.target.value)}>
            <option value="all">All</option>{cfg.filter.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <button className="ghost" onClick={csv}>Export CSV</button>
          <button className="primary" onClick={() => open(k)}>Add {cfg.singular}</button>
        </div>
      </header>

      {!shown.length ? (
        <div className="empty"><p>{rows.length ? `No ${cfg.title.toLowerCase()} match your search.` : `No ${cfg.title.toLowerCase()} yet.`}</p>
          {!rows.length && <button className="primary" onClick={() => open(k)}>Add the first {cfg.singular}</button>}</div>
      ) : cfg.view === 'cards' ? (
        <div className="cards">
          {shown.map((m) => (
            <article className="player" key={m.id} style={{ '--h': hue(m.full_name) }}>
              <div className="shirt">{m.jersey_no ?? '–'}</div>
              <div className="avatar">{initials(m.full_name)}</div>
              <h3>{m.full_name}</h3>
              <p className="muted">{m.position || 'No position'}{m.phone && ` · ${m.phone}`}</p>
              <div className="row between"><span>{pill(m.status)}</span><b>{money(m.total_paid)}</b></div>
              <div className="row gap">
                <button className="primary sm" onClick={() => open('contributions', { member_id: m.id })}>Record payment</button>
                <button className="ghost sm" onClick={() => open(k, m)}>Edit</button>
                <button className="ghost sm danger" onClick={() => del(m)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr>{cfg.cols.map((c) => <th key={c.h} className={c.num ? 'num' : ''}>{c.h}</th>)}<th /></tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.id}>
                {cfg.cols.map((c) => <td key={c.h} className={c.num ? 'num' : ''}>{c.r(r)}</td>)}
                <td className="acts"><button className="ghost sm" onClick={() => open(k, r)}>Edit</button><button className="ghost sm danger" onClick={() => del(r)}>Delete</button></td>
              </tr>))}
            </tbody>
          </table>
          {total !== null && <div className="foot">{shown.length} records · Total <b>{money(total)}</b></div>}
        </div>
      )}
    </section>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard({ data, open }) {
  const [hi, setHi] = useState(null);
  const s = data.stats;
  if (!s) return <div className="empty">Loading club figures…</div>;
  const balance = s.contributions - s.expenses;
  const max = Math.max(1, ...s.monthly.map((m) => m.total));
  const topMax = Math.max(1, ...s.top.map((t) => t.total));
  const days = s.next ? Math.ceil((new Date(s.next.match_date + 'T00:00:00') - new Date()) / 864e5) : null;
  const rec = s.record; const played = rec.w + rec.d + rec.l;
  return (
    <section>
      <header className="page-head"><h1>Dashboard</h1>
        <div className="tools"><button className="ghost" onClick={() => open('expenses')}>Add expense</button><button className="primary" onClick={() => open('contributions')}>Record contribution</button></div>
      </header>

      <div className="scoreboard">
        <div><small>Raised</small><b>{money(s.contributions)}</b></div>
        <div><small>Spent</small><b>{money(s.expenses)}</b></div>
        <div className="main"><small>Club balance</small><b className={balance < 0 ? 'neg' : ''}>{money(balance)}</b></div>
      </div>

      <div className="tiles">
        <div className="tile"><b>{s.members.active}</b><span>active of {s.members.total} members</span></div>
        <div className="tile"><b>{played}</b><span>played · {rec.w}W {rec.d}D {rec.l}L</span></div>
        <div className="tile"><b>{rec.gf}:{rec.ga}</b><span>goals for : against</span></div>
        <div className="tile">{s.next ? <><b>{days <= 0 ? 'Today' : `${days}d`}</b><span>to {s.next.opponent}</span></> : <><b>–</b><span>no fixture scheduled</span></>}</div>
      </div>

      <div className="two">
        <div className="panel">
          <h2>Contributions, last 6 months</h2>
          {s.monthly.length ? (
            <div className="chart">
              {s.monthly.map((m, i) => (
                <div key={m.label + i} className="col" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
                  <span className={`tip ${hi === i ? 'on' : ''}`}>{money(m.total)}</span>
                  <i style={{ height: Math.max(4, (m.total / max) * 100) + '%' }} className={hi === i ? 'on' : ''} />
                  <small>{m.label}</small>
                </div>))}
            </div>) : <p className="muted">Record a contribution to see the trend.</p>}
        </div>
        <div className="panel">
          <h2>Top contributors</h2>
          {s.top.length ? s.top.map((t, i) => (
            <div className="lead" key={t.full_name}><span>{i + 1}. {t.full_name}</span><div className="bar"><i style={{ width: (t.total / topMax) * 100 + '%' }} /></div><b>{money(t.total)}</b></div>
          )) : <p className="muted">No contributions recorded yet.</p>}
        </div>
      </div>

      <div className="panel">
        <h2>Activity funding</h2>
        {data.activities.filter((a) => a.target_amount > 0).slice(0, 5).map((a) => {
          const p = Math.min(100, (a.collected / a.target_amount) * 100);
          return <div className="lead" key={a.id}><span>{a.title}</span><div className="bar"><i style={{ width: p + '%' }} /></div><b>{Math.round(p)}%</b></div>;
        })}
        {!data.activities.some((a) => a.target_amount > 0) && <p className="muted">Add an activity with a target amount to track funding here.</p>}
      </div>
    </section>
  );
}

/* ---------- Import page (templates + CSV upload) ---------- */
function ImportPage({ data, reload, toast }) {
  const [type, setType] = useState('members');
  const [file, setFile] = useState('');
  const [rows, setRows] = useState(null);
  const [fatal, setFatal] = useState('');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [done, setDone] = useState(null);
  const cfg = IMPORTS[type];
  const reset = () => { setRows(null); setFile(''); setFatal(''); setDone(null); };
  const downloadTemplate = () => {
    const esc = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    const text = [cfg.cols, ...cfg.sample].map((r) => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${type}-template.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const readFile = async (f) => {
    if (!f) return; reset(); setFile(f.name);
    if (/\.xlsx?$/i.test(f.name)) { setFatal('Excel files cannot be read directly. In Excel choose File > Save As > CSV UTF-8, then upload that CSV.'); return; }
    const table = parseCSV(await f.text());
    if (table.length < 2) { setFatal('No data rows found. Download the template and fill in at least one row under the headings.'); return; }
    if (table.length - 1 > 1000) { setFatal('A maximum of 1,000 rows can be imported at once. Please split the file.'); return; }
    const heads = table[0].map((h) => alias(type, h));
    const missing = cfg.required.filter((c) => !heads.includes(c));
    if (missing.length) { setFatal(`Missing column: ${missing.join(', ')}. Download the template to see the expected headings.`); return; }
    setRows(table.slice(1).map((cells) => {
      const raw = {}; heads.forEach((h, i) => { raw[h] = (cells[i] ?? '').trim(); });
      return { raw, ...validate(type, raw, data) };
    }));
  };
  const good = rows ? rows.filter((r) => !r.errors.length) : [];
  const bad = rows ? rows.length - good.length : 0;
  const run = async () => {
    setBusy(true);
    try {
      const res = await api('import', { method: 'POST', body: { type, rows: good.map((r) => r.out) } });
      setDone(res); setRows(null); setFile(''); toast(`Imported ${res.inserted} ${cfg.label.toLowerCase()}`); reload();
    } catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  };
  return (
    <section>
      <header className="page-head"><h1>Import data</h1></header>
      <div className="panel stepbox">
        <h2>1. Choose what to import</h2>
        <div className="seg">{Object.entries(IMPORTS).map(([k, v]) => <button key={k} className={type === k ? 'on' : ''} onClick={() => { setType(k); reset(); }}>{v.label}</button>)}</div>
        <p className="muted">{cfg.help}</p>
      </div>
      <div className="panel stepbox">
        <h2>2. Download the template</h2>
        <p className="muted">Open it in Excel or Google Sheets, delete the two example rows and fill in your own. Keep the headings as they are.</p>
        <button className="ghost" onClick={downloadTemplate}>Download {cfg.label.toLowerCase()} template (CSV)</button>
      </div>
      <div className="panel stepbox">
        <h2>3. Upload your filled file</h2>
        <label className={`drop ${drag ? 'on' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files[0]); }}>
          <input type="file" accept=".csv,.txt,.xls,.xlsx,text/csv" hidden onChange={(e) => { readFile(e.target.files[0]); e.target.value = ''; }} />
          <b>{file || 'Choose a CSV file'}</b><span>or drag and drop it here</span>
        </label>
        {fatal && <p className="error">{fatal}</p>}
        {done && <p className="okmsg">Done. {done.inserted} added{done.skipped ? `, ${done.skipped} skipped (already in the system or incomplete)` : ''}.</p>}
      </div>
      {rows && (
        <div className="panel">
          <h2>4. Check and import</h2>
          <div className="chips"><span className="chip ok">{good.length} ready</span>{bad > 0 && <span className="chip bad">{bad} with problems</span>}</div>
          {bad > 0 && <p className="muted">Rows with problems are left out. Fix them in your file and upload again, or import the ready rows now.</p>}
          <div className="table-wrap preview">
            <table>
              <thead><tr><th>Row</th><th>Check</th>{cfg.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{rows.slice(0, 200).map((r, i) => (
                <tr key={i} className={r.errors.length ? 'badrow' : ''}>
                  <td>{i + 2}</td>
                  <td>{r.errors.length ? <span className="error">{r.errors.join('; ')}</span> : <span className="okmsg">OK</span>}</td>
                  {cfg.cols.map((c) => <td key={c}>{r.raw[c]}</td>)}
                </tr>))}
              </tbody>
            </table>
          </div>
          {rows.length > 200 && <p className="muted">Showing the first 200 of {rows.length} rows. All ready rows will be imported.</p>}
          <div className="row end">
            <button className="ghost" onClick={reset}>Cancel</button>
            <button className="primary" disabled={!good.length || busy} onClick={run}>{busy ? 'Importing…' : `Import ${good.length} ${good.length === 1 ? 'row' : 'rows'}`}</button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- Login ---------- */
function Login({ onDone }) {
  const [pw, setPw] = useState(''); const [show, setShow] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const { token } = await api('login', { method: 'POST', body: { password: pw } }); localStorage.setItem('fc_token', token); onDone(); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="login">
      <div className="login-head"><img src="/icon-192.png" alt="" /><h1>AREA BOYS FC</h1><p>Admin portal</p></div>
      <form className="modal" onSubmit={go}>
        <h2>Welcome back</h2><p className="muted">Sign in to continue</p>
        <label>Password
          <div className="pw">
            <input type={show ? 'text' : 'password'} autoFocus autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <button type="button" className="eye" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow(!show)}>
              <svg viewBox="0 0 24 24" className="ico" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {show ? <><path d="M3 3l18 18" /><path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a14 14 0 0 1-3 3.8M6.5 7.6C4.4 9 3 11 2.5 12c1 2 4.5 6 9.5 6 1.5 0 2.8-.4 4-1" /><path d="M9.9 10a3 3 0 0 0 4.1 4.1" /></> : <><path d="M2.5 12C3.5 10 7 6 12 6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6z" /><circle cx="12" cy="12" r="3" /></>}
              </svg>
            </button>
          </div>
        </label>
        {err && <p className="error">{err}</p>}
        <button className="primary" disabled={busy || !pw}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

/* ---------- App shell ---------- */
const ICONS = {
  dashboard: <path d="M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z" />,
  members: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-4 3-6 7-6s7 2 7 6" /><circle cx="17.5" cy="9" r="2.5" /><path d="M18 14c2.5.3 4 2 4 5" /></>,
  activities: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  contributions: <><circle cx="12" cy="12" r="9" /><path d="M12 6.5v11M9 9.5c0-2.5 6-2.5 6 0s-6 2-6 4.5 6 2.5 6 0" /></>,
  import: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  matches: <><circle cx="12" cy="12" r="9" /><path d="M12 8l4 3-1.5 5h-5L8 11z" /></>,
  expenses: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
};
const Icon = ({ n }) => <svg viewBox="0 0 24 24" className="ico" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">{ICONS[n]}</svg>;

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('fc_token'));
  const [tab, setTab] = useState(() => { const g = new URLSearchParams(location.search).get('go'); return NAV.includes(g) ? g : 'dashboard'; });
  const [data, setData] = useState({ members: [], activities: [], contributions: [], matches: [], expenses: [] });
  const [form, setForm] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [menu, setMenu] = useState(false);
  const [installEvt, setInstallEvt] = useState(null);
  const [dark, setDark] = useState(localStorage.getItem('fc_theme') === 'dark');
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('fc_theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', h); return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  const toast = (msg, type = 'ok') => { const id = Math.random(); setToasts((t) => [...t, { id, msg, type }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500); };
  const reload = useCallback(async () => {
    try {
      const names = ['stats', 'members', 'activities', 'contributions', 'matches', 'expenses'];
      const res = await Promise.all(names.map((n) => api(n)));
      setData(Object.fromEntries(names.map((n, i) => [n, res[i]])));
    } catch (e) { toast(e.message, 'err'); }
  }, []);
  useEffect(() => { if (authed) reload(); }, [authed]);
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  const open = (k, initial) => setForm({ k, initial });
  const go = (n) => { setTab(n); setMenu(false); window.scrollTo(0, 0); };
  const label = (n) => (n === 'dashboard' ? 'Dashboard' : n === 'import' ? 'Import data' : CFG[n].title);
  return (
    <div className="shell">
      <div className="topbar stripes">
        <button aria-label="Open menu" onClick={() => setMenu(true)}><svg viewBox="0 0 24 24" className="ico" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
        <b>{label(tab)}</b>
      </div>
      {menu && <div className="drawer-scrim" onClick={() => setMenu(false)} />}
      <aside className={`side stripes ${menu ? 'open' : ''}`}>
        <div className="brand">AREA BOYS<br />FC</div>
        <nav>{NAV.map((n) => (
          <button key={n} className={tab === n ? 'on' : ''} onClick={() => go(n)}>
            <Icon n={n} /><span>{label(n)}</span>
            {n !== 'dashboard' && n !== 'import' && <em>{data[n]?.length ?? 0}</em>}
          </button>))}
        </nav>
        <div className="side-foot">
          {installEvt && <button onClick={async () => { installEvt.prompt(); await installEvt.userChoice; setInstallEvt(null); }}>Install app</button>}
          <button onClick={() => setDark(!dark)}>{dark ? 'Light mode' : 'Dark mode'}</button>
          <button onClick={() => { localStorage.removeItem('fc_token'); location.reload(); }}>Sign out</button>
        </div>
      </aside>
      <main>
        {tab === 'dashboard' ? <Dashboard data={data} open={open} /> : tab === 'import' ? <ImportPage data={data} reload={reload} toast={toast} /> : <Resource key={tab} k={tab} data={data} open={open} reload={reload} toast={toast} />}
      </main>
      {form && <FormModal {...form} data={data} toast={toast} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />}
      <div className="toasts">{toasts.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>)}</div>
    </div>
  );
}
