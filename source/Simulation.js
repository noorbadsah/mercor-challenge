// source/Simulation.js
// Implements Parts 4 & 5: expected-value simulation and min-bonus search.

class Simulation {
  constructor(initialReferrers = 100, capacity = 10) {
    this.initialReferrers = initialReferrers;
    this.capacity = capacity;
  }

  /**
   * simulate(p, days) -> returns array length = days where index i is cumulative total at end of day i (1-based)
   * Model: expected-value cohort approach. Each cohort born on day d has a size (expected number of referrers)
   * Each active referrer has probability p per day to produce a successful referral. Each referrer can produce up to 'capacity' successes.
   */
  simulate(p, days) {
    p = Number(p);
    days = Number(days);
    if (days <= 0) return [];

    // cohorts: array of { birth: dayIndex (0-based), size: expected referrers }
    const cohorts = [{ birth: 0, size: this.initialReferrers }];
    const cumulativeArr = [];
    let cumulative = 0;

    // We'll track expected number of successes per cohort per day via binomial CDF approximations:
    // For expected active fraction after t days, an active referrer is still active if their #successes so far < capacity.
    // We use expected active fraction ~= P[Bin(t, p) <= capacity-1] -- approximate with iterative pmf sum.
    const binomActiveProb = (t, p, cap) => {
      // returns P[Bin(t, p) <= cap-1]
      if (t <= 0) return 1; // no trials yet, all active
      // compute pmf iteratively
      let q = 1 - p;
      // pmf(0) = q^t
      let pmf = Math.pow(q, t);
      let sum = pmf;
      for (let k = 1; k <= Math.min(t, cap - 1); k++) {
        pmf = pmf * (t - (k - 1)) / k * (p / q);
        sum += pmf;
      }
      return Math.min(1, Math.max(0, sum));
    };

    for (let day = 1; day <= days; day++) {
      let newRefs = 0;
      for (const c of cohorts) {
        const prevDays = day - c.birth - 1; // number of days the cohort has been active before today
        if (prevDays < 0) continue; // cohort not born yet
        // expected fraction of cohort members still active at start of day:
        const activeFrac = binomActiveProb(prevDays, p, this.capacity);
        // expected successes produced on this day by this cohort:
        const expectedNew = c.size * activeFrac * p;
        newRefs += expectedNew;
      }
      cumulative += newRefs;
      cumulativeArr.push(Number(cumulative.toFixed(9)));
      // create next cohort from today's referrals
      if (newRefs > 1e-12) cohorts.push({ birth: day, size: newRefs });
      // early stop if growth negligible
      if (newRefs < 1e-12) {
        // fill remaining days with the same cumulative
        for (let d = day + 1; d <= days; d++) cumulativeArr.push(Number(cumulative.toFixed(9)));
        break;
      }
    }
    return cumulativeArr;
  }

  /**
   * daysToTarget(p, targetTotal)
   * returns smallest day number (1-based) such that cumulative >= targetTotal, or Infinity if never
   */
  daysToTarget(p, targetTotal, maxDays = 10000) {
    p = Number(p);
    targetTotal = Number(targetTotal);
    let cohorts = [{ birth: 0, size: this.initialReferrers }];
    let cumulative = 0;

    const binomActiveProb = (t, p, cap) => {
      if (t <= 0) return 1;
      let q = 1 - p;
      let pmf = Math.pow(q, t); let sum = pmf;
      for (let k = 1; k <= Math.min(t, cap - 1); k++) {
        pmf = pmf * (t - (k - 1)) / k * (p / q);
        sum += pmf;
      }
      return Math.min(1, Math.max(0, sum));
    };

    for (let day = 1; day <= maxDays; day++) {
      let newRefs = 0;
      for (const c of cohorts) {
        const prevDays = day - c.birth - 1;
        if (prevDays < 0) continue;
        const activeFrac = binomActiveProb(prevDays, p, this.capacity);
        newRefs += c.size * activeFrac * p;
      }
      cumulative += newRefs;
      if (cumulative >= targetTotal - 1e-9) return day;
      if (newRefs < 1e-12) return Infinity;
      cohorts.push({ birth: day, size: newRefs });
    }
    return Infinity;
  }

  /**
   * minBonusForTarget(days, targetHires, adoptionProb(bonus), eps)
   * Bonus is in dollars; adoptionProb is monotonic in bonus.
   * Returns minimum bonus rounded **up** to nearest 10, or null if unachievable within limit.
   */
  async minBonusForTarget(days, targetHires, adoptionProb, eps = 1e-3) {
    // search over bonus in dollars, increments of 10.
    const MAX_BONUS = 1_000_000; // safety cap

    // expand high until achievable or cap
    let low = 0;
    let high = 10;
    while (high <= MAX_BONUS) {
      const p = adoptionProb(high);
      const daysNeeded = this.daysToTarget(p, targetHires);
      if (daysNeeded <= days) break;
      low = high;
      high *= 2;
    }
    if (high > MAX_BONUS) return null;

    // binary search over multiples of 10
    let ans = null;
    while (low <= high) {
      const mid = Math.floor((low + high) / 20) * 10; // ensure multiple of 10
      const p = adoptionProb(mid);
      const dNeeded = this.daysToTarget(p, targetHires);
      if (dNeeded <= days) { ans = mid; high = mid - 10; }
      else low = mid + 10;
    }
    if (ans === null) return null;
    return Math.ceil(ans / 10) * 10;
  }
}

module.exports = Simulation;
