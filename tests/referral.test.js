// tests/referral.test.js
const request = require('supertest');
const app = require('../server/index');
const Simulation = require('../source/Simulation');

describe('API basic', () => {
  test('GET /api/users returns array', async () => {
    const res = await request(app).get('/api/users');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Graph endpoint returns nodes/links', async () => {
    const res = await request(app).get('/api/graph');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('nodes');
    expect(res.body).toHaveProperty('links');
  });
});

describe('Simulation', () => {
  test('simulate monotonic growth', () => {
    const sim = new Simulation(100, 10);
    const arr = sim.simulate(0.1, 10);
    expect(arr.length).toBe(10);
    for (let i = 1; i < arr.length; i++) {
      expect(arr[i]).toBeGreaterThanOrEqual(arr[i-1]);
    }
  });

  test('daysToTarget returns finite or Infinity', () => {
    const sim = new Simulation(100, 10);
    const d = sim.daysToTarget(0.01, 1000);
    expect(d === Infinity || typeof d === 'number').toBeTruthy();
  });
});
