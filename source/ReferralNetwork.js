// source/ReferralNetwork.js
// Implements Parts 1-3: referral graph, reach calculations, unique reach greedy, flow centrality.

const { Queue } = (() => {
  // tiny queue helper (not required but convenient)
  class Q {
    constructor() { this._ = []; }
    push(x) { this._.push(x); }
    shift() { return this._.shift(); }
    isEmpty() { return this._.length === 0; }
  }
  return { Queue: Q };
})();

class ReferralNetwork {
  /**
   * db is optional. If provided, DB-backed methods in server layer can use this (we use DB in server).
   * This class keeps an in-memory adjacency representation (useful for algorithms).
   */
  constructor(getAllUsersFn = null, getAllEdgesFn = null) {
    // if database-backed, these functions should return arrays of users/edges
    this.getAllUsersFn = getAllUsersFn;
    this.getAllEdgesFn = getAllEdgesFn;
    // local caches (filled on demand)
    this._adjCache = null;
    this._usersCache = null;
  }

  // --- helpers to build adjacency from DB or memory ---
  _buildAdjacency() {
    const adj = new Map();
    const users = this.getAllUsersFn ? this.getAllUsersFn() : (this._usersCache ? Array.from(this._usersCache) : []);
    // ensure nodes exist
    users.forEach(u => { adj.set(Number(u.id ?? u), []); });

    const edges = this.getAllEdgesFn ? this.getAllEdgesFn() : [];
    for (const e of edges) {
      const s = Number(e.referrer_id ?? e.source);
      const t = Number(e.candidate_id ?? e.target);
      if (!adj.has(s)) adj.set(s, []);
      adj.get(s).push(t);
      if (!adj.has(t)) adj.set(t, []);
    }
    this._adjCache = adj;
    return adj;
  }

  _adj() {
    if (this._adjCache) return this._adjCache;
    return this._buildAdjacency();
  }

  // invalidate cache when DB changes
  invalidateCache() {
    this._adjCache = null;
    this._usersCache = null;
  }

  // --- Part 1: direct referrals & constraints (logic used by server) ---

  /**
   * isSelfReferral
   */
  static _isSelf(referrer, candidate) {
    return Number(referrer) === Number(candidate);
  }

  /**
   * candidateHasReferrer: checks if candidate already has an incoming referral
   * edges param: array of {referrer_id, candidate_id} if passed; otherwise use getAllEdgesFn.
   */
  candidateHasReferrer(candidateId) {
    const edges = this.getAllEdgesFn ? this.getAllEdgesFn() : [];
    for (const r of edges) {
      if (Number(r.candidate_id) === Number(candidateId)) return true;
    }
    return false;
  }

  /**
   * Path exists from start to target (BFS).
   * Used to test if adding (referrer -> candidate) would create a cycle by checking whether
   * candidate can already reach referrer.
   */
  _pathExists(start, target) {
    start = Number(start); target = Number(target);
    if (start === target) return true;
    const adj = this._adj();
    if (!adj.has(start)) return false;
    const q = [start];
    const seen = new Set([start]);
    while (q.length) {
      const u = q.shift();
      const outs = adj.get(u) || [];
      for (const v of outs) {
        const vn = Number(v);
        if (vn === target) return true;
        if (!seen.has(vn)) { seen.add(vn); q.push(vn); }
      }
    }
    return false;
  }

  /**
   * Get direct referrals from adjacency map (returns array of {id})
   */
  getDirectReferrals(userId) {
    const adj = this._adj();
    const out = adj.get(Number(userId)) || [];
    return out.map(id => ({ id }));
  }

  // --- Part 2: full reach (BFS) and top referrers by reach ---

  /**
   * getFullReachSet(userId) -> Set of user ids reachable downstream (excludes userId)
   */
  getFullReachSet(userId) {
    const adj = this._adj();
    const start = Number(userId);
    const seen = new Set();
    const q = [];
    const outs = adj.get(start) || [];
    for (const v of outs) { q.push(v); }
    while (q.length) {
      const u = Number(q.shift());
      if (!seen.has(u)) {
        seen.add(u);
        const outs2 = adj.get(u) || [];
        for (const w of outs2) q.push(w);
      }
    }
    return seen;
  }

  /**
   * getReachCount
   */
  getReachCount(userId) {
    return this.getFullReachSet(userId).size;
  }

  /**
   * getTopReferrersByReach(k)
   */
  getTopReferrersByReach(k = 10) {
    const adj = this._adj();
    const users = Array.from(adj.keys());
    const arr = users.map(u => ({ id: u, reach: this.getReachCount(u) }));
    arr.sort((a,b)=> b.reach - a.reach);
    return arr.slice(0, k);
  }

  // --- Part 3: Unique reach greedy & Flow centrality ---

  /**
   * uniqueReachGreedy:
   * Precompute full downstream reach set for each user, then greedily pick the user who adds the largest
   * number of new candidates to the covered set, iteratively.
   * Returns array of { id, adds } in selection order.
   */
  uniqueReachGreedy() {
    const adj = this._adj();
    const users = Array.from(adj.keys());
    const reachSets = new Map();
    for (const u of users) reachSets.set(u, this.getFullReachSet(u));

    const covered = new Set();
    const selected = [];
    while (true) {
      let best = null, bestAdds = 0;
      for (const u of users) {
        if (!reachSets.has(u)) continue;
        const set = reachSets.get(u);
        // compute how many new elements this user adds (not yet covered)
        let adds = 0;
        for (const x of set) if (!covered.has(x)) adds++;
        if (adds > bestAdds) { bestAdds = adds; best = u; }
      }
      if (!best || bestAdds === 0) break;
      selected.push({ id: best, adds: bestAdds });
      for (const x of reachSets.get(best)) covered.add(x);
      reachSets.delete(best);
    }
    return selected;
  }

  /**
   * computeFlowCentrality:
   * Runs BFS from every source to compute shortest distances, then for all (s,t,v) increments score for v
   * when dist(s,v)+dist(v,t) == dist(s,t)
   * Returns array of { id, score } sorted descending.
   */
  computeFlowCentrality() {
    const adj = this._adj();
    const users = Array.from(adj.keys());
    // distances[s][v] = distance or Infinity
    const distances = new Map();
    for (const s of users) distances.set(s, this._bfsDistances(s));

    const score = new Map();
    users.forEach(u => score.set(u, 0));

    for (const s of users) {
      const distS = distances.get(s);
      for (const t of users) {
        if (s === t) continue;
        const d_st = distS.get(t);
        if (d_st === Infinity || d_st === undefined) continue;
        for (const v of users) {
          if (v === s || v === t) continue;
          const distSv = distS.get(v);
          const distVt = distances.get(v).get(t);
          if (distSv !== Infinity && distVt !== Infinity && (distSv + distVt === d_st)) {
            score.set(v, score.get(v) + 1);
          }
        }
      }
    }
    const out = Array.from(score.entries()).map(([id, sc]) => ({ id, score: sc }));
    out.sort((a,b) => b.score - a.score);
    return out;
  }

  _bfsDistances(start) {
    const adj = this._adj();
    const dist = new Map();
    for (const k of adj.keys()) dist.set(k, Infinity);
    const s = Number(start);
    if (!adj.has(s)) return dist;
    dist.set(s, 0);
    const q = [s];
    while (q.length) {
      const u = q.shift();
      const d = dist.get(u);
      const outs = adj.get(u) || [];
      for (const v of outs) {
        if (dist.get(v) === Infinity) {
          dist.set(v, d + 1);
          q.push(v);
        }
      }
    }
    return dist;
  }
}

module.exports = ReferralNetwork;
