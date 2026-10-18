// CSV import helpers: templates, parsing, normalising and validating rows.
export const POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Coach', 'Staff'];
export const STATUSES = ['active', 'injured', 'suspended', 'inactive'];
const METHODS = ['Cash', 'Mobile money', 'Bank transfer', 'Other'];
const ACT_TYPES = ['Match', 'Training', 'Tournament', 'Fundraiser', 'Kit & equipment', 'Social event', 'Dues', 'Other'];
const EXP_CATS = ['Kits', 'Equipment', 'Pitch hire', 'Transport', 'Referees', 'Medical', 'Refreshments', 'General'];

export const IMPORTS = {
  members: {
    label: 'Members', required: ['full_name'],
    help: 'One row per player or staff member. Only full_name is required. Dates can be 2025-01-15 or 15/01/2025. People already in the system (same name and phone) are skipped.',
    cols: ['full_name', 'jersey_no', 'position', 'phone', 'email', 'status', 'joined_on', 'notes'],
    sample: [['Kwame Mensah', '1', 'Goalkeeper', '0241234567', 'kwame@example.com', 'active', '2025-01-15', 'Captain'], ['Ama Serwaa', '9', 'Forward', '0201234567', '', 'active', '15/02/2025', '']],
  },
  activities: {
    label: 'Activities', required: ['title'],
    help: 'Club activities such as fundraisers, kit drives or tournaments. target_amount is optional. Activities with the same title and date are skipped.',
    cols: ['title', 'type', 'activity_date', 'target_amount', 'description'],
    sample: [['New season kits', 'Kit & equipment', '2025-09-01', '2000', 'Jerseys for all players'], ['Monthly dues - October', 'Dues', '01/10/2025', '400', '']],
  },
  contributions: {
    label: 'Contributions', required: ['member_name', 'amount'],
    help: 'member_name must match a member already in the system, so import members first. activity is optional: leave it blank for the general fund, or use the exact activity title.',
    cols: ['member_name', 'activity', 'amount', 'method', 'paid_on', 'note'],
    sample: [['Kwame Mensah', 'New season kits', '150', 'Mobile money', '2025-09-05', ''], ['Ama Serwaa', '', '50', 'Cash', '10/09/2025', 'October dues']],
  },
  matches: {
    label: 'Fixtures & results', required: ['opponent', 'match_date'],
    help: 'status is Scheduled, Played or Postponed. Played matches need both goals_for (our goals) and goals_against (their goals).',
    cols: ['opponent', 'match_date', 'venue', 'home_away', 'status', 'goals_for', 'goals_against'],
    sample: [['Hearts Juniors', '2025-09-20', 'Home ground', 'Home', 'Played', '2', '1'], ['Eastern Stars', '05/10/2025', 'Eastern Park', 'Away', 'Scheduled', '', '']],
  },
  expenses: {
    label: 'Expenses', required: ['title', 'amount'],
    help: 'Club spending. Categories: ' + EXP_CATS.join(', ') + '.',
    cols: ['title', 'category', 'amount', 'spent_on', 'note'],
    sample: [['Pitch hire', 'Pitch hire', '120', '2025-09-12', ''], ['Match balls', 'Equipment', '180.50', '14/09/2025', 'Size 5']],
  },
};

export function parseCSV(text) {
  text = text.replace(/^\ufeff/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const d = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === d) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; rows.push(row); row = []; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

const ALIASES = {
  jersey: 'jersey_no', jersey_number: 'jersey_no', number: 'jersey_no', mobile: 'phone', phone_number: 'phone', telephone: 'phone',
  joined: 'joined_on', date_joined: 'joined_on', target: 'target_amount', member: 'member_name', activity_title: 'activity', paid_date: 'paid_on',
  home_or_away: 'home_away', our_goals: 'goals_for', their_goals: 'goals_against', date_spent: 'spent_on', expense: 'title',
};
const DATE_FIELD = { members: 'joined_on', activities: 'activity_date', contributions: 'paid_on', matches: 'match_date', expenses: 'spent_on' };
const NAME_FIELD = { members: 'full_name', activities: 'title', contributions: 'member_name', matches: 'opponent', expenses: 'title' };
export const alias = (type, h) => {
  const k = String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (k === 'name') return NAME_FIELD[type];
  if (k === 'date') return DATE_FIELD[type];
  return ALIASES[k] || k;
};

export function parseDate(v) {
  const s = String(v ?? '').trim(); if (!s) return null;
  let y, m, d, a;
  if ((a = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/))) [y, m, d] = a.slice(1).map(Number);
  else if ((a = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [d, m, y] = a.slice(1).map(Number);
  else return undefined;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
export function parseNum(v) {
  const s = String(v ?? '').replace(/[^0-9.\-]/g, ''); if (!s || s === '-' || s === '.') return null;
  const n = Number(s); return Number.isFinite(n) ? n : null;
}
const pick = (v, list, def) => { const x = String(v ?? '').trim().toLowerCase(); if (!x) return def; return list.find((o) => o.toLowerCase() === x) ?? null; };

export function validate(type, r, data) {
  const e = [], o = {};
  const txt = (k, req) => { const v = String(r[k] ?? '').trim(); if (!v && req) e.push(`${k} is required`); o[k] = v || null; };
  const date = (k, def) => { const d = parseDate(r[k]); if (d === undefined) e.push(`${k} is not a valid date`); else o[k] = d ?? def ?? null; };
  const num = (k, { req, min, int } = {}) => {
    if (String(r[k] ?? '').trim() === '') { if (req) e.push(`${k} is required`); o[k] = null; return; }
    let n = parseNum(r[k]);
    if (n === null || (min !== undefined && n < min)) e.push(`${k} must be a number${min !== undefined ? ` of at least ${min}` : ''}`);
    else o[k] = int ? Math.round(n) : n;
  };
  const opt = (k, list, def) => { const v = pick(r[k], list, def); if (v === null) e.push(`${k} must be one of: ${list.join(', ')}`); else o[k] = v; };
  if (type === 'members') {
    txt('full_name', true); num('jersey_no', { int: true, min: 0 }); txt('phone'); txt('email'); txt('notes');
    o.position = pick(r.position, POSITIONS, null) ?? (String(r.position).trim() || null);
    opt('status', STATUSES, 'active'); date('joined_on', null);
  } else if (type === 'activities') {
    txt('title', true); txt('description'); date('activity_date', null); num('target_amount', { min: 0 });
    o.type = pick(r.type, ACT_TYPES, 'Other') ?? (String(r.type).trim() || 'Other');
    if (o.target_amount == null) o.target_amount = 0;
  } else if (type === 'contributions') {
    num('amount', { req: true, min: 0.01 }); txt('note'); date('paid_on', null); opt('method', METHODS, 'Cash');
    const name = String(r.member_name ?? '').trim().toLowerCase();
    if (!name) e.push('member_name is required');
    else {
      const hits = (data.members || []).filter((m) => m.full_name.trim().toLowerCase() === name);
      if (!hits.length) e.push(`Member "${r.member_name}" not found. Import or add them first`);
      else if (hits.length > 1) e.push(`More than one member named "${r.member_name}"`);
      else o.member_id = hits[0].id;
    }
    const act = String(r.activity ?? '').trim().toLowerCase();
    if (act) {
      const a = (data.activities || []).find((x) => x.title.trim().toLowerCase() === act);
      if (!a) e.push(`Activity "${r.activity}" not found`); else o.activity_id = a.id;
    } else o.activity_id = null;
  } else if (type === 'matches') {
    txt('opponent', true); txt('venue'); date('match_date', null);
    if (!o.match_date && !e.some((x) => x.startsWith('match_date'))) e.push('match_date is required');
    opt('home_away', ['Home', 'Away'], 'Home'); opt('status', ['Scheduled', 'Played', 'Postponed'], 'Scheduled');
    num('goals_for', { int: true, min: 0 }); num('goals_against', { int: true, min: 0 });
    if (o.status === 'Played' && (o.goals_for == null || o.goals_against == null)) e.push('Played matches need both goals_for and goals_against');
  } else if (type === 'expenses') {
    txt('title', true); txt('note'); num('amount', { req: true, min: 0.01 }); date('spent_on', null);
    o.category = pick(r.category, EXP_CATS, 'General') ?? (String(r.category).trim() || 'General');
  }
  return { out: o, errors: e };
}
