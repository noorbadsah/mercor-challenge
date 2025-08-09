// public/js/app.js
document.addEventListener('DOMContentLoaded', async () => {
  // DOM refs
  const pSlider = document.getElementById('pSlider');
  const pVal = document.getElementById('pVal');
  const daysInput = document.getElementById('daysInput');
  const runSimBtn = document.getElementById('runSim');
  const refreshGraphTop = document.getElementById('refreshGraphTop');
  const openAddUserTop = document.getElementById('openAddUserTop');
  const exportUsersCsv = document.getElementById('exportUsersCsv');
  const exportSimCsv = document.getElementById('exportCSV');
  const replayBtn = document.getElementById('replayBtn');
  const topStats = document.getElementById('topStats');

  pVal.textContent = Number(pSlider.value).toFixed(2);
  pSlider.addEventListener('input', () => pVal.textContent = Number(pSlider.value).toFixed(2));

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // charts
  const dailyCtx = document.getElementById('dailyChart')?.getContext('2d');
  const simCtx = document.getElementById('simChart')?.getContext('2d');

  const dailyChart = new Chart(dailyCtx, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Daily new referrals', data: [], barPercentage: 0.6 }] },
    options: { responsive: true, plugins:{legend:{display:true}}, scales:{y:{beginAtZero:true}}}
  });

  const simChart = new Chart(simCtx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Cumulative referrals', data: [], tension: .3, borderWidth: 3, pointRadius:4 }] },
    options: { responsive: true, plugins:{legend:{display:true}}, scales:{y:{beginAtZero:true}} }
  });

  // state
  let cy = null, selectedId = null, lastSimulation = null, flowScores = {};

  // helpers
  function setTopStats(obj) {
    topStats.innerHTML = `
      <div class="px-3 py-2 rounded bg-slate-800">Male: <strong>${obj.males}</strong></div>
      <div class="px-3 py-2 rounded bg-slate-800">Female: <strong>${obj.females}</strong></div>
      <div class="px-3 py-2 rounded bg-slate-800">Selected: <strong>${obj.selected}</strong></div>
    `;
  }

  async function loadStats() {
    try {
      const r = await fetch('/api/stats').then(x => x.json());
      setTopStats(r);
    } catch (e) { console.error(e); }
  }

  async function loadLeaderboard() {
    try {
      const reach = await fetch('/api/metrics/reach?k=10').then(r => r.json());
      const target = $('#leaderboard');
      target.innerHTML = '';
      reach.forEach((it, i) => {
        const badge = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i+1}`));
        const name = it.name || (`#${it.id}`);
        const el = document.createElement('div');
        el.className = 'flex justify-between items-center px-2 py-2 rounded bg-slate-800';
        el.innerHTML = `<div>${badge} <strong>${name}</strong></div><div class="text-slate-400">${it.reach}</div>`;
        target.appendChild(el);
      });
    } catch (e) { console.error(e); }
  }

  async function loadGraphAndRender() {
    try {
      const graph = await fetch('/api/graph').then(r=>r.json());
      const reaches = graph.nodes.map(n => n.data.reach || 0);
      const maxR = Math.max(...reaches, 1);

      const colorByReach = (r) => {
        const t = Math.min(1, r / Math.max(1, maxR));
        const rc = Math.floor(255 * t), gc = Math.floor(110 * (1 - t)), bc = Math.floor(220 * (1 - t));
        return `rgb(${rc},${gc},${bc})`;
      };

      const nodes = graph.nodes.map(n => ({
        data: { id: n.data.id, label: n.data.label, gender: n.data.gender, reach: n.data.reach || 0 },
        style: { 'background-color': colorByReach(n.data.reach || 0) }
      }));
      const edges = graph.links.map(l => ({ data: { source: l.data.source, target: l.data.target } }));

      if (cy) { cy.destroy(); cy = null; document.getElementById('cy').innerHTML = ''; }

      cy = cytoscape({
        container: document.getElementById('cy'),
        elements: { nodes, edges },
        style: [
          { selector: 'node', style: { width: 46, height: 46, 'label': 'data(label)', 'text-valign': 'bottom', 'text-margin-y': 6, 'font-size': 11 } },
          { selector: 'edge', style: { width: 2, 'line-color': '#1f6feb', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#1f6feb', 'curve-style': 'bezier' } }
        ],
        layout: { name: 'cose', animate: true, animationDuration: 900 }
      });

      // tooltip element
      const tip = document.createElement('div');
      tip.style.cssText = 'position:fixed;padding:8px;border-radius:8px;background:rgba(2,6,23,0.92);color:#eaf0ff;font-size:13px;pointer-events:none;display:none;z-index:9999';
      document.body.appendChild(tip);

      // fetch flow scores for tooltips
      try {
        const flow = await fetch('/api/metrics/flow').then(x=>x.json());
        flowScores = {};
        flow.forEach(it => flowScores[String(it.id)] = it.score || 0);
      } catch(e) { flowScores = {}; }

      cy.on('mouseover', 'node', (e) => {
        const node = e.target; const id = node.id(); const lbl = node.data('label'); const reach = node.data('reach')||0; const flow = flowScores[id] || 0;
        tip.innerText = `${lbl} (#${id}) — reach ${reach} — flow ${flow}`;
        tip.style.display = 'block';
      });
      cy.on('mousemove', 'node', (e) => { const ev = e.originalEvent; tip.style.left = (ev.clientX + 12) + 'px'; tip.style.top = (ev.clientY + 12) + 'px'; });
      cy.on('mouseout', 'node', () => { tip.style.display = 'none'; });

      cy.on('tap', 'node', async (evt) => {
        const id = evt.target.id();
        selectedId = id;
        await openProfile(id);
      });
    } catch (e) {
      console.error('graph load error', e);
    }
  }

  async function openProfile(id) {
    try {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) return;
      const js = await res.json();
      const u = js.user; const direct = js.direct || []; const reach = js.reachCount || 0;
      $('#selectedTitle').textContent = `${u.name} (#${u.id})`;
      $('#selectedMeta').textContent = `${direct.length} direct referrals • reach ${reach} • gender: ${u.gender || 'n/a'}`;
      $('#directList').innerHTML = direct.map(d => `<li class="px-3 py-2 bg-slate-800 rounded">${d.name} <span class="text-slate-400">#${d.id}</span></li>`).join('');
      $('#reachCount').textContent = reach;
    } catch(e){ console.error(e); }
  }

  // run simulation and update charts
  async function runSimulation() {
    const p = Number(pSlider.value);
    const days = Number(daysInput.value);
    try {
      const r = await fetch(`/api/simulate?p=${p}&days=${days}`).then(x=>x.json());
      lastSimulation = r.cumulative.slice();
      const daily = lastSimulation.map((v,i)=> i===0? v : (v - lastSimulation[i-1]));
      dailyChart.data.labels = daily.map((_,i)=>i+1);
      dailyChart.data.datasets[0].data = daily;
      dailyChart.update();
      simChart.data.labels = lastSimulation.map((_,i)=>i+1);
      simChart.data.datasets[0].data = lastSimulation;
      simChart.update();
      $('#liveCounter').textContent = `Total: ${Math.round(lastSimulation[lastSimulation.length-1] || 0)}`;
    } catch(e) { console.error(e); }
  }

  // replay simulation day-by-day
  async function replaySimulation() {
    if (!lastSimulation) { await runSimulation(); }
    const seq = lastSimulation.slice();
    for (let i=0;i<seq.length;i++){
      $('#liveCounter').textContent = `Total: ${Math.round(seq[i])}`;
      simChart.data.datasets[0].pointRadius = seq.map((_,idx)=> idx===i ? 6 : 3);
      simChart.update();
      await new Promise(res => setTimeout(res, 220));
    }
    simChart.data.datasets[0].pointRadius = 4;
    simChart.update();
  }

  // export simulation CSV (client-side)
  function exportSimulationCSV() {
    if (!lastSimulation) { alert('Run simulation first'); return; }
    const rows = [['day','cumulative','daily']];
    for (let i=0;i<lastSimulation.length;i++){
      const cum = lastSimulation[i];
      const daily = i===0? cum : cum - lastSimulation[i-1];
      rows.push([i+1, cum, daily]);
    }
    const csv = rows.map(r=> r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'simulation.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // add referral
  $('#addReferralForm').addEventListener('submit', async (ev)=> {
    ev.preventDefault();
    const candidateId = Number($('#candidateId').value);
    const msg = $('#addRefMsg');
    if (!selectedId) { msg.textContent = 'Select a referrer first (click a node)'; return; }
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ referrer_id: Number(selectedId), candidate_id: candidateId })
      });
      const j = await res.json();
      if (res.ok) {
        msg.textContent = 'Referral added ✓ — refreshing...';
        await loadGraphAndRender(); await loadLeaderboard(); await loadStats();
      } else msg.textContent = 'Error: ' + (j.error || 'unknown');
    } catch (e) { msg.textContent = 'Network error'; }
    setTimeout(()=> msg.textContent = '', 3500);
  });

  // mark selected toggle
  $('#markSelected').addEventListener('click', async ()=> {
    if (!selectedId) return alert('Select a user first');
    try {
      const res = await fetch(`/api/users/${selectedId}`);
      const js = await res.json();
      const cur = js.user.selected;
      const r2 = await fetch(`/api/users/${selectedId}/select`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ selected: !cur })});
      const j = await r2.json();
      if (r2.ok) {
        alert(`User ${j.id} marked selected = ${j.selected}`);
        await loadStats(); await loadLeaderboard();
      } else alert('Error');
    } catch(e){ alert('Error'); }
  });

  // Add user modal and creation
  $('#openAddUserTop').addEventListener('click', ()=> {
    const modal = $('#addUserModal'); modal.style.display = 'flex'; modal.classList.remove('hidden');
  });
  $('#closeAddUser').addEventListener('click', ()=> {
    const modal = $('#addUserModal'); modal.style.display = 'none'; modal.classList.add('hidden');
  });
  $('#addUserForm').addEventListener('submit', async (ev)=> {
    ev.preventDefault();
    const name = $('#newName').value.trim(), email = $('#newEmail').value.trim(), gender = $('#newGender').value;
    if (!name) return alert('Name required');
    const res = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, email, gender })});
    const j = await res.json();
    if (res.ok) {
      alert('User added #' + j.id);
      $('#addUserModal').style.display='none'; $('#addUserModal').classList.add('hidden');
      $('#newName').value = ''; $('#newEmail').value = ''; $('#newGender').value = '';
      await loadGraphAndRender(); await loadLeaderboard(); await loadStats();
    } else alert('Error creating user');
  });

  // top quick refresh
  refreshGraphTop.addEventListener('click', async ()=> { await loadGraphAndRender(); await loadLeaderboard(); await loadStats(); });

  // run sim & replay & export bindings
  runSimBtn.addEventListener('click', runSimulation);
  replayBtn.addEventListener('click', replaySimulation);
  exportSimCsv.addEventListener('click', exportSimulationCSV);

  // export users csv (server endpoint)
  exportUsersCsv.addEventListener('click', async () => {
    try {
      const resp = await fetch('/api/export-users');
      if (!resp.ok) { alert('Export failed'); return; }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'users.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Error exporting'); }
  });

  // tabs in aside
  $$('.tab-btn').forEach(b => b.addEventListener('click', async (ev) => {
    $$('.tab-btn').forEach(x => x.classList.remove('active'));
    ev.target.classList.add('active');
    const key = ev.target.dataset.tab;
    $('#tabReach').classList.toggle('hidden', key !== 'reach');
    $('#tabUnique').classList.toggle('hidden', key !== 'unique');
    $('#tabFlow').classList.toggle('hidden', key !== 'flow');

    if (key === 'unique') {
      const r = await fetch('/api/metrics/unique_reach').then(x=>x.json());
      $('#uniqueList').innerHTML = r.slice(0,12).map(it => `<div class="px-2 py-2 rounded bg-slate-800">${it.name} — +${it.adds}</div>`).join('');
    }
    if (key === 'flow') {
      const r = await fetch('/api/metrics/flow').then(x=>x.json());
      $('#flowList').innerHTML = r.slice(0,12).map(it => `<div class="px-2 py-2 rounded bg-slate-800">${it.name} — ${it.score}</div>`).join('');
    }
  }));

  // initial load
  await loadStats();
  await loadLeaderboard();
  await loadGraphAndRender();
  await runSimulation();
});
