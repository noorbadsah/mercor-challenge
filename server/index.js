// server/index.js
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');
const initDb = require('./initDb');
const ReferralNetwork = require('../source/ReferralNetwork');
const Simulation = require('../source/Simulation');

const app = express();
app.use(express.json());
app.use(require('cors')());

// DB
const dbFile = path.resolve(__dirname, '../data/referral.db');
const db = new Database(dbFile);
initDb(db);

// helper functions to feed ReferralNetwork
const getAllUsers = () => db.prepare('SELECT id, name, gender, selected FROM users').all();
const getAllEdges = () => db.prepare('SELECT referrer_id, candidate_id FROM referrals').all();

const network = new ReferralNetwork(getAllUsers, getAllEdges);
const simulator = new Simulation(100, 10);

// static
app.use('/', express.static(path.resolve(__dirname, '../public')));

// Helper: get user name by id
function getUserName(id) {
  const r = db.prepare('SELECT name FROM users WHERE id = ?').get(id);
  return r ? r.name : String(id);
}

// API: stats (male/female/selected/total)
app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const males = db.prepare("SELECT COUNT(*) AS c FROM users WHERE LOWER(gender)='male'").get().c;
  const females = db.prepare("SELECT COUNT(*) AS c FROM users WHERE LOWER(gender)='female'").get().c;
  const other = db.prepare("SELECT COUNT(*) AS c FROM users WHERE gender IS NOT NULL AND LOWER(gender) NOT IN ('male','female')").get().c;
  const selected = db.prepare('SELECT COUNT(*) AS c FROM users WHERE selected = 1').get().c;
  res.json({ total, males, females, other, selected });
});

// users list
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT id, name, email, gender, selected FROM users').all();
  const output = users.map(u => ({ id: u.id, name: u.name, email: u.email, gender: u.gender, selected: !!u.selected, reach: network.getReachCount(u.id) }));
  res.json(output);
});

app.get('/api/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT id, name, email, gender, selected FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'not found' });
  const direct = db.prepare('SELECT u.id, u.name FROM referrals r JOIN users u ON u.id = r.candidate_id WHERE r.referrer_id = ?').all(id);
  const reachSet = Array.from(network.getFullReachSet(id));
  res.json({ user: { ...user, selected: !!user.selected }, direct, reachCount: reachSet.length, reachSet });
});

// create user (accepts gender)
app.post('/api/users', (req, res) => {
  const { name, email, gender } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const info = db.prepare('INSERT INTO users (name, email, gender) VALUES (?, ?, ?)').run(name, email || null, gender || null);
  network.invalidateCache();
  res.json({ id: info.lastInsertRowid });
});

// toggle or set selected
app.post('/api/users/:id/select', (req, res) => {
  const id = Number(req.params.id);
  const { selected } = req.body; // true/false optional
  const current = db.prepare('SELECT selected FROM users WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'not found' });
  const newVal = (typeof selected === 'boolean') ? (selected ? 1 : 0) : (current.selected ? 0 : 1);
  db.prepare('UPDATE users SET selected = ? WHERE id = ?').run(newVal, id);
  res.json({ id, selected: !!newVal });
});

// add referral (enforce constraints)
app.post('/api/referrals', (req, res) => {
  const { referrer_id, candidate_id } = req.body;
  const ref = Number(referrer_id), cand = Number(candidate_id);
  if (isNaN(ref) || isNaN(cand)) return res.status(400).json({ error: 'invalid ids' });
  try {
    if (ReferralNetwork._isSelf(ref, cand)) throw new Error('No self-referrals allowed');
    if (network.candidateHasReferrer(cand)) throw new Error('Candidate already has a referrer');
    network.invalidateCache();
    if (network._pathExists(cand, ref)) throw new Error('Operation would create a cycle');

    db.prepare('INSERT INTO referrals (referrer_id, candidate_id) VALUES (?, ?)').run(ref, cand);
    network.invalidateCache();
    res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// graph
app.get('/api/graph', (req, res) => {
  const users = db.prepare('SELECT id, name, gender FROM users').all();
  const edges = db.prepare('SELECT referrer_id, candidate_id FROM referrals').all();
  const nodes = users.map(u => ({ data: { id: String(u.id), label: u.name, gender: u.gender || null, reach: network.getReachCount(u.id) } }));
  const links = edges.map(e => ({ data: { source: String(e.referrer_id), target: String(e.candidate_id) } }));
  res.json({ nodes, links });
});

// metrics (map ids -> names)
app.get('/api/metrics/:type', (req, res) => {
  const t = req.params.type;
  if (t === 'reach') {
    const k = Number(req.query.k || 10);
    const list = network.getTopReferrersByReach(k); // [{id,reach}]
    const mapped = list.map(it => {
      const name = getUserName(it.id);
      return { id: it.id, name, reach: it.reach };
    });
    return res.json(mapped);
  } else if (t === 'unique_reach') {
    const list = network.uniqueReachGreedy(); // [{id,adds}]
    const mapped = list.map(it => ({ id: it.id, name: getUserName(it.id), adds: it.adds }));
    return res.json(mapped);
  } else if (t === 'flow') {
    const list = network.computeFlowCentrality(); // [{id,score}]
    const mapped = list.map(it => ({ id: it.id, name: getUserName(it.id), score: it.score }));
    return res.json(mapped);
  }
  return res.status(400).json({ error: 'unknown metric' });
});

// simulate
app.get('/api/simulate', (req, res) => {
  const p = parseFloat(req.query.p) || 0.1;
  const days = parseInt(req.query.days || '30', 10);
  const arr = simulator.simulate(p, days);
  res.json({ p, days, cumulative: arr });
});

// min-bonus
app.post('/api/min-bonus', async (req, res) => {
  const { days = 30, target = 1000, eps = 1e-3 } = req.body;
  const adoption_prob = (bonus) => {
    const p = 1 - Math.exp(-bonus / 250);
    return Math.max(0.01, Math.min(0.95, p));
  };
  const ans = await simulator.minBonusForTarget(days, target, adoption_prob, eps);
  res.json({ minBonus: ans });
});

// export users CSV
app.get('/api/export-users', (req, res) => {
  // header line
  const rows = [['id','name','email','gender','selected','reach']];
  const users = db.prepare('SELECT id, name, email, gender, selected FROM users').all();
  for (const u of users) {
    const reach = network.getReachCount(u.id);
    rows.push([u.id, `"${String(u.name).replace(/"/g,'""')}"`, u.email || '', u.gender || '', u.selected ? 1 : 0, reach]);
  }
  const csv = rows.map(r => r.join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="users.csv"`);
  res.send(csv);
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
