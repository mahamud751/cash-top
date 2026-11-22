import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { timingSafeEqual, randomBytes } from 'node:crypto';

const db = new DatabaseSync(process.env.CASH_DB || 'server/cash.sqlite');
const pin = process.env.CASH_ADMIN_PIN || randomBytes(6).toString('hex');
const port = Number(process.env.PORT || 4100);
db.exec(`CREATE TABLE IF NOT EXISTS events (
 id INTEGER PRIMARY KEY, kind TEXT NOT NULL, amount INTEGER NOT NULL,
 stake INTEGER DEFAULT 0, rate INTEGER DEFAULT 0, status TEXT NOT NULL, time INTEGER NOT NULL
); CREATE TABLE IF NOT EXISTS config (id INTEGER PRIMARY KEY, rate INTEGER NOT NULL);`);
db.exec(
  'CREATE TABLE IF NOT EXISTS receipts (token TEXT PRIMARY KEY, payload TEXT NOT NULL)',
);
const add = db.prepare(
  'INSERT INTO events(kind,amount,stake,rate,status,time) VALUES(?,?,?,?,?,?)',
);
if (!db.prepare('SELECT id FROM config').get()) {
  db.exec('BEGIN');
  db.prepare('INSERT INTO config VALUES(1,625)').run();
  const now = Date.now();
  for (const [i, amount] of [3000, 3000, 2000, 1000, 3000].entries())
    add.run(
      'deposit',
      amount * 100,
      0,
      0,
      'completed',
      now - (10 - i) * 86400000,
    );
  for (const [i, delta] of [120, -60, 240, -30, 180].entries())
    add.run(
      'trade',
      delta * 100,
      300000,
      Math.round((delta / 3000) * 10000),
      'completed',
      now - (4 - i) * 86400000 - 1800000,
    );
  db.exec('COMMIT');
}
function state() {
  const events = db.prepare('SELECT * FROM events ORDER BY id DESC').all();
  const sum = kind =>
    events
      .filter(e => e.kind === kind && e.status !== 'declined')
      .reduce((s, e) => s + e.amount, 0);
  return {
    events,
    balance: sum('deposit') + sum('trade') - sum('withdraw'),
    deposit: sum('deposit'),
    profit: sum('trade'),
    rate: db.prepare('SELECT rate FROM config').get().rate,
  };
}
function requireValue(condition, message) {
  if (!condition) throw Error(message);
}
const server = http.createServer(async (req, res) => {
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      requireValue(body.length < 4096, 'Request too large');
    }
    const data = JSON.parse(body || '{}');
    const route = req.url;
    if (route.startsWith('/admin/')) {
      const actual = Buffer.from(String(req.headers['x-admin-pin'] || '')),
        expected = Buffer.from(pin);
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      ) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Incorrect admin key' }));
        return;
      }
    }
    const token = data.requestId;
    const payload = JSON.stringify([route, data.amount, data.rate]);
    if (token !== undefined)
      requireValue(
        typeof token === 'string' && /^[a-z0-9-]{10,80}$/.test(token),
        'Invalid request identifier',
      );
    const receipt =
      token &&
      db.prepare('SELECT payload FROM receipts WHERE token=?').get(token);
    if (receipt)
      requireValue(
        receipt.payload === payload,
        'Request identifier already used',
      );
    if (req.method === 'POST' && !receipt) {
      if (token) db.exec('BEGIN');
      const s = state(),
        amount = data.amount;
      if (route === '/deposit') {
        requireValue(
          [50000, 100000, 200000, 300000].includes(amount),
          'Choose a deposit preset',
        );
        add.run('deposit', amount, 0, 0, 'completed', Date.now());
      } else if (route === '/trade' || route === '/withdraw') {
        requireValue(
          Number.isSafeInteger(amount) && amount > 0 && amount <= s.balance,
          'Enter an amount within your balance',
        );
        if (route === '/trade') {
          requireValue(
            data.rate === s.rate,
            'Rate changed. Refresh before trading.',
          );
          const delta =
            Math.sign(s.rate) * Math.round((amount * Math.abs(s.rate)) / 10000);
          add.run('trade', delta, amount, s.rate, 'completed', Date.now());
        } else add.run('withdraw', amount, 0, 0, 'pending', Date.now());
      } else if (route === '/admin/rate') {
        requireValue(
          Number.isInteger(data.rate) && Math.abs(data.rate) <= 10000,
          'Use a rate between −100% and 100%',
        );
        db.prepare('UPDATE config SET rate=? WHERE id=1').run(data.rate);
      } else if (route === '/admin/review') {
        requireValue(
          ['approved', 'declined'].includes(data.status),
          'Invalid decision',
        );
        requireValue(
          db
            .prepare(
              "UPDATE events SET status=? WHERE id=? AND kind='withdraw' AND status='pending'",
            )
            .run(data.status, data.id).changes === 1,
          'Request already reviewed',
        );
      } else requireValue(route === '/admin/unlock', 'Unknown action');
      if (token) {
        db.prepare('INSERT INTO receipts VALUES(?,?)').run(token, payload);
        db.exec('COMMIT');
      }
    } else if (!receipt)
      requireValue(
        req.method === 'GET' && route === '/wallet',
        'Unknown request',
      );
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(state()));
  } catch (e) {
    if (db.isTransaction) db.exec('ROLLBACK');
    res.writeHead(400);
    res.end(JSON.stringify({ error: e.message }));
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(
    'Cash demo on port',
    server.address().port,
    process.env.CASH_ADMIN_PIN
      ? '(configured admin key)'
      : '• Admin key: ' + pin,
  ),
);
