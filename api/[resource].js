import { sql, ensureSchema, sign, verify } from './_lib.js';

// One safe, whitelisted CRUD definition per resource.
const T = {
  members: {
    cols: ['full_name', 'phone', 'email', 'position', 'jersey_no', 'status', 'joined_on', 'notes'],
    list: `SELECT m.id, m.full_name, m.phone, m.email, m.position, m.jersey_no, m.status, m.joined_on::text AS joined_on, m.notes,
             COALESCE((SELECT SUM(amount) FROM contributions c WHERE c.member_id = m.id), 0)::float AS total_paid
           FROM members m ORDER BY m.full_name`,
  },
  activities: {
    cols: ['title', 'type', 'activity_date', 'target_amount', 'description'],
    list: `SELECT a.id, a.title, a.type, a.activity_date::text AS activity_date, a.target_amount::float AS target_amount, a.description,
             COALESCE((SELECT SUM(amount) FROM contributions c WHERE c.activity_id = a.id), 0)::float AS collected
           FROM activities a ORDER BY a.activity_date DESC, a.id DESC`,
  },
  contributions: {
    cols: ['member_id', 'activity_id', 'amount', 'method', 'paid_on', 'note'],
    list: `SELECT c.id, c.member_id, c.activity_id, c.amount::float AS amount, c.method, c.paid_on::text AS paid_on, c.note,
             m.full_name AS member_name, a.title AS activity_title
           FROM contributions c JOIN members m ON m.id = c.member_id
           LEFT JOIN activities a ON a.id = c.activity_id ORDER BY c.paid_on DESC, c.id DESC`,
  },
  matches: {
    cols: ['opponent', 'match_date', 'venue', 'home_away', 'goals_for', 'goals_against', 'status'],
    list: `SELECT id, opponent, match_date::text AS match_date, venue, home_away, goals_for, goals_against, status
           FROM matches ORDER BY match_date DESC, id DESC`,
  },
  expenses: {
    cols: ['title', 'category', 'amount', 'spent_on', 'note'],
    list: `SELECT id, title, category, amount::float AS amount, spent_on::text AS spent_on, note
           FROM expenses ORDER BY spent_on DESC, id DESC`,
  },
};

const clean = (v) => (v === '' || v === undefined ? null : v);

async function stats() {
  const [[mem], [con], [exp], [mat], monthly, top, next] = await Promise.all([
    sql`SELECT COUNT(*) FILTER (WHERE status='active')::int AS active, COUNT(*)::int AS total FROM members`,
    sql`SELECT COALESCE(SUM(amount),0)::float AS total FROM contributions`,
    sql`SELECT COALESCE(SUM(amount),0)::float AS total FROM expenses`,
    sql`SELECT
          COUNT(*) FILTER (WHERE status='Played' AND goals_for > goals_against)::int AS w,
          COUNT(*) FILTER (WHERE status='Played' AND goals_for = goals_against)::int AS d,
          COUNT(*) FILTER (WHERE status='Played' AND goals_for < goals_against)::int AS l,
          COALESCE(SUM(goals_for) FILTER (WHERE status='Played'),0)::int AS gf,
          COALESCE(SUM(goals_against) FILTER (WHERE status='Played'),0)::int AS ga
        FROM matches`,
    sql`SELECT to_char(date_trunc('month', paid_on),'Mon') AS label, date_trunc('month', paid_on) AS mth, SUM(amount)::float AS total
        FROM contributions WHERE paid_on >= date_trunc('month', CURRENT_DATE) - interval '5 months'
        GROUP BY mth ORDER BY mth`,
    sql`SELECT m.full_name, SUM(c.amount)::float AS total FROM contributions c JOIN members m ON m.id = c.member_id
        GROUP BY m.id ORDER BY total DESC LIMIT 5`,
    sql`SELECT opponent, match_date::text AS match_date, venue FROM matches
        WHERE status='Scheduled' AND match_date >= CURRENT_DATE ORDER BY match_date LIMIT 1`,
  ]);
  return {
    members: mem, contributions: con.total, expenses: exp.total, record: mat,
    monthly: monthly.map(({ label, total }) => ({ label, total })), top, next: next[0] || null,
  };
}

export default async function handler(req, res) {
  try {
    const { resource, id } = req.query;

    if (resource === 'login') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const pw = req.body?.password;
      if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD)
        return res.status(401).json({ error: 'Wrong password' });
      return res.json({ token: sign() });
    }

    if (!verify((req.headers.authorization || '').replace('Bearer ', '')))
      return res.status(401).json({ error: 'Please sign in again' });

    await ensureSchema();
    if (resource === 'stats') return res.json(await stats());

    const t = T[resource];
    if (!t) return res.status(404).json({ error: 'Unknown resource' });

    if (req.method === 'GET') return res.json(await sql.query(t.list));

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = req.body || {};
      const keys = t.cols.filter((c) => c in body);
      if (!keys.length) return res.status(400).json({ error: 'No data provided' });
      const vals = keys.map((k) => clean(body[k]));
      if (req.method === 'POST') {
        const q = `INSERT INTO ${resource} (${keys.join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING id`;
        return res.status(201).json((await sql.query(q, vals))[0]);
      }
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const q = `UPDATE ${resource} SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')} WHERE id=$${keys.length + 1}`;
      await sql.query(q, [...vals, id]);
      return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await sql.query(`DELETE FROM ${resource} WHERE id=$1`, [id]);
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}
