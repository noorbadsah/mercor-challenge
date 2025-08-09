// tests/referral.test.js
const request = require('supertest');
const app = require('../server/index');
const Simulation = require('../source/Simulation');
const ReferralNetwork = require('../source/ReferralNetwork');

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

describe('Referral Network Logic', () => {
  let rn;
  beforeEach(() => {
    rn = new ReferralNetwork();
  });

  test('should add a valid referral', () => {
    rn.addReferral('A', 'B');
    expect(rn.getDirectReferrals('A')).toContain('B');
  });

  test('should reject self-referrals', () => {
    expect(() => rn.addReferral('A', 'A')).toThrow();
  });

  test('should reject multiple referrers for the same candidate', () => {
    rn.addReferral('A', 'B');
    expect(() => rn.addReferral('C', 'B')).toThrow();
  });

  test('should reject cycles', () => {
    rn.addReferral('A', 'B');
    rn.addReferral('B', 'C');
    expect(() => rn.addReferral('C', 'A')).toThrow();
  });

  test('should calculate total reach', () => {
    rn.addReferral('A', 'B');
    rn.addReferral('B', 'C');
    expect(rn.getTotalReach('A')).toBe(2);
  });
});

describe('Bonus Optimization', () => {
  const { min_bonus_for_target } = require('../source/Simulation');

  test('should return correct bonus for achievable target', () => {
    const adoption_prob = bonus => Math.min(1, bonus / 100); // mock
    const bonus = min_bonus_for_target(5, 20, adoption_prob, 1e-3);
    expect(bonus).toBeGreaterThan(0);
    expect(bonus % 10).toBe(0);
  });

  test('should return null if target is impossible', () => {
    const adoption_prob = () => 0; // nobody refers
    const bonus = min_bonus_for_target(5, 1000, adoption_prob, 1e-3);
    expect(bonus).toBeNull();
  });
});
