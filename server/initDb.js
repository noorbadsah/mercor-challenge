// server/initDb.js
module.exports = function initDb(db) {
  db.exec(`PRAGMA foreign_keys = ON;`);

  // Create users table if missing
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      gender TEXT,
      selected INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
  `);

  // Create referrals table if missing
  db.exec(`
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL UNIQUE,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      FOREIGN KEY(referrer_id) REFERENCES users(id),
      FOREIGN KEY(candidate_id) REFERENCES users(id)
    );
  `);

  // Ensure columns exist (for older DBs); check pragma info
  const cols = db.prepare("PRAGMA table_info(users)").all().map(r => r.name);
  if (!cols.includes('gender')) {
    try { db.exec(`ALTER TABLE users ADD COLUMN gender TEXT;`); } catch(e) {}
  }
  if (!cols.includes('selected')) {
    try { db.exec(`ALTER TABLE users ADD COLUMN selected INTEGER DEFAULT 0;`); } catch(e) {}
  }

  // Seed sample data if empty
  const row = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (row.c === 0) {
    const insert = db.prepare('INSERT INTO users (name, email, gender, selected) VALUES (?, ?, ?, ?)');
    // sample names with genders
    const seeds = [
      ['Alice','alice@example.com','female',0],
      ['Bob','bob@example.com','male',0],
      ['Carol','carol@example.com','female',0],
      ['David','david@example.com','male',0],
      ['Eva','eva@example.com','female',0],
      ['Frank','frank@example.com','male',0],
      ['Grace','grace@example.com','female',0],
      ['Hector','hector@example.com','male',0],
      ['Ivy','ivy@example.com','female',0],
      ['Jason','jason@example.com','male',0],
    ];
    const ids = [];
    for (const s of seeds) {
      const info = insert.run(s[0], s[1], s[2], s[3]);
      ids.push(info.lastInsertRowid);
    }
    const ref = db.prepare('INSERT OR IGNORE INTO referrals (referrer_id, candidate_id) VALUES (?, ?)');
    try {
      ref.run(ids[0], ids[1]); // Alice -> Bob
      ref.run(ids[0], ids[2]); // Alice -> Carol
      ref.run(ids[1], ids[3]); // Bob -> David
    } catch (e) {}
  }
};
