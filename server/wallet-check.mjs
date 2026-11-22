import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
test('wallet operations maintain balances and enforce admin access', async () => {
  const server = spawn(process.execPath, ['server/server.mjs'], {
    env: {
      ...process.env,
      PORT: '0',
      CASH_DB: ':memory:',
      CASH_ADMIN_PIN: 'demo-test',
    },
  });
  try {
    const banner = await new Promise((resolve, reject) => {
      server.stdout.once('data', chunk => resolve(chunk.toString()));
      server.once('exit', c => reject(Error('API exit ' + c)));
    });
    const port = banner.match(/port (\d+)/)[1];
    async function call(route, body, key = '') {
      const r = await fetch('http://127.0.0.1:' + port + route, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': key },
        body: body && JSON.stringify(body),
      });
      return [r.status, await r.json()];
    }
    assert.equal((await call('/wallet'))[1].balance, 1245000);
    for (const amount of [50000, 100000, 200000, 300000])
      assert.equal((await call('/deposit', { amount }))[0], 200);
    assert.equal((await call('/admin/rate', { rate: -500 }))[0], 403);
    assert.equal(
      (await call('/trade', { amount: 100000, rate: 625 }))[1].events[0].amount,
      6250,
    );
    await call('/admin/rate', { rate: -500 }, 'demo-test');
    assert.equal((await call('/trade', { amount: 100000, rate: 625 }))[0], 400);
    assert.equal(
      (await call('/trade', { amount: 100000, rate: -500 }))[1].events[0]
        .amount,
      -5000,
    );
    for (const status of ['approved', 'declined']) {
      const before = (await call('/wallet'))[1].balance;
      const w = (await call('/withdraw', { amount: 50000 }))[1];
      assert.equal(w.balance, before - 50000);
      const decision = { id: w.events[0].id, status };
      assert.equal(
        (await call('/admin/review', decision, 'demo-test'))[1].balance,
        before - (status === 'approved' ? 50000 : 0),
      );
      assert.equal(
        (await call('/admin/review', decision, 'demo-test'))[0],
        400,
      );
    }
    assert.equal((await call('/withdraw', { amount: 999999999 }))[0], 400);
    const replay = { amount: 50000, requestId: 'sample-request-001' };
    const first = (await call('/deposit', replay))[1];
    assert.equal((await call('/deposit', replay))[1].balance, first.balance);
    assert.equal(
      (await call('/deposit', { ...replay, amount: 100000 }))[0],
      400,
    );
    assert.equal(
      (
        await call('/withdraw', { amount: -1, requestId: 'sample-invalid-001' })
      )[0],
      400,
    );
    assert.equal(
      (
        await call('/withdraw', { amount: 100, requestId: 'sample-valid-002' })
      )[0],
      200,
    );
  } finally {
    server.kill();
  }
});
