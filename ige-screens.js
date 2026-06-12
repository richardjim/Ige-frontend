// ════════════════════════════════════════════════════════════════════════════
// IGE Banking — Additional screens (Account Intelligence · Audit Log · Data Import)
// Drop-in: loads AFTER the main script and ige-api.js. Injects 3 new screens,
// adds sidebar links, registers them with the existing go() router.
// Keeps the navy/teal design. Pulls live data from the backend.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var API = window.IGE_API_BASE || '';
  function api(path, opts) {
    return fetch(API + path, Object.assign({ headers: { 'content-type': 'application/json' } }, opts || {}))
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .catch(function () { return null; });
  }
  function money(n) { return '₦' + Number(n || 0).toLocaleString('en-NG'); }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function toast(m) { if (window.showToast) window.showToast(m); }

  // ── Sidebar icons (inline SVG, match existing style) ──────────────────────
  var ICONS = {
    accounts: '<svg viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M1.5 6h13M5 9.5h2M5 11h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    audit:    '<svg viewBox="0 0 16 16" fill="none"><path d="M4 1.5h6l2.5 2.5v10a.5.5 0 01-.5.5H4a.5.5 0 01-.5-.5v-12A.5.5 0 014 1.5z" stroke="currentColor" stroke-width="1.4"/><path d="M6 7h4M6 9.5h4M6 12h2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    import:    '<svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5v8M5 7l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 11v2a1 1 0 001 1h9a1 1 0 001-1v-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
  };

  // ── Build a screen shell (sidebar + main, matching existing markup) ───────
  function screenShell(id, title, sub, bodyHtml) {
    return '<div id="s-' + id + '" class="screen">'
      + '<div class="shell"><aside class="sidebar" data-sb></aside><div class="main">'
      + '<div class="topbar"><div><div class="topbar-title">' + title + '</div><div class="topbar-sub">' + sub + '</div></div>'
      + '<div class="topbar-right" id="tb-' + id + '"></div></div>'
      + '<div class="page" id="page-' + id + '">' + bodyHtml + '</div>'
      + '</div></div></div>';
  }

  // ════════════════════════════════════════════════════════════════════════
  // SCREEN: Account Intelligence (RFM table)
  // ════════════════════════════════════════════════════════════════════════
  function injectAccounts() {
    var body = '<div class="card mb16"><div class="card-head">'
      + '<div><div class="card-title">RFM-scored accounts</div><div class="card-sub">Every account classified — no configuration needed</div></div>'
      + '<div style="display:flex;gap:7px">'
      + '<select id="acc-filter-seg" style="width:140px;font-size:11.5px"><option value="">All segments</option><option>Champion</option><option>Loyal</option><option>Promising</option><option>At Risk</option><option>Dormant</option></select>'
      + '<select id="acc-filter-type" style="width:120px;font-size:11.5px"><option value="">All types</option><option>Savings</option><option>Current</option><option>Salary</option><option>Business</option></select>'
      + '<button class="btn btn-outline btn-sm" onclick="igeExportAccounts()">Export CSV</button>'
      + '</div></div>'
      + '<div style="overflow-x:auto"><table class="tbl"><thead><tr>'
      + '<th>Customer ID</th><th>Type</th><th>KYC</th><th>ARPU</th><th>Last txn</th><th>RFM</th><th>Segment</th><th>Consent</th><th></th>'
      + '</tr></thead><tbody id="acc-tbody"><tr><td colspan="9" style="text-align:center;color:var(--text-3);padding:24px">Loading accounts…</td></tr></tbody></table></div></div>';
    addScreen('accounts', 'Account Intelligence', 'RFM-scored customer accounts · live from your data', body, 'Intelligence');

    var seg = document.getElementById('acc-filter-seg');
    var typ = document.getElementById('acc-filter-type');
    if (seg) seg.addEventListener('change', loadAccounts);
    if (typ) typ.addEventListener('change', loadAccounts);
    loadAccounts();
  }

  function loadAccounts() {
    var seg = (document.getElementById('acc-filter-seg') || {}).value || '';
    var typ = (document.getElementById('acc-filter-type') || {}).value || '';
    var q = [];
    if (seg) q.push('segment=' + encodeURIComponent(seg));
    if (typ) q.push('accountType=' + encodeURIComponent(typ));
    api('/api/accounts' + (q.length ? '?' + q.join('&') : '')).then(function (data) {
      var tb = document.getElementById('acc-tbody');
      if (!tb) return;
      var rows = (data && data.accounts) || [];
      window._igeAccounts = rows;
      if (!rows.length) { tb.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-3);padding:24px">No accounts match.</td></tr>'; return; }
      tb.innerHTML = rows.map(function (a) {
        var kycBadge = a.kycTier === 3 ? 'b-green' : a.kycTier === 2 ? 'b-gold' : 'b-rose';
        var segBadge = a.segment === 'Champion' ? 'b-green' : a.segment === 'Loyal' ? 'b-teal' : a.segment === 'Dormant' ? 'b-rose' : a.segment === 'At Risk' ? 'b-rose' : 'b-slate';
        var rfmColor = a.rfm >= 70 ? 'var(--green)' : a.rfm >= 40 ? 'var(--teal)' : 'var(--rose)';
        var consentBadge = a.consent === 'Given' ? 'b-green' : 'b-gold';
        return '<tr>'
          + '<td><span style="font-family:var(--mono);font-size:11px">' + a.customerId + '</span></td>'
          + '<td>' + a.accountType + '</td>'
          + '<td><span class="badge ' + kycBadge + '">Tier ' + a.kycTier + '</span></td>'
          + '<td style="font-weight:600">' + money(a.arpu) + '</td>'
          + '<td style="color:var(--text-3)">' + a.lastTxn + '</td>'
          + '<td><div style="display:flex;align-items:center;gap:6px"><span style="font-weight:700;color:' + rfmColor + '">' + a.rfm + '</span>'
          + '<div class="prog-track" style="width:46px"><div class="prog-fill" style="width:' + a.rfm + '%;background:' + rfmColor + '"></div></div></div></td>'
          + '<td><span class="badge ' + segBadge + '">' + a.segment + '</span></td>'
          + '<td><span class="badge ' + consentBadge + '">' + a.consent + '</span></td>'
          + '<td><button class="btn btn-ghost btn-sm" onclick="igeEngageAccount(\'' + a.customerId + '\',\'' + a.consent + '\')">Engage</button></td>'
          + '</tr>';
      }).join('');
    });
  }

  window.igeEngageAccount = function (id, consent) {
    if (consent !== 'Given') { toast('Consent pending — cannot send (PR-BANK-003)'); return; }
    if (!window.openJourneyModal) { toast('Engaging ' + id); return; }
    var html = (window.alertBox ? window.alertBox('Send a real email to <strong>' + id + '</strong> via the backend (Brevo).', 'info') : '')
      + '<div class="field-group"><label>Engagement type</label><select id="eng-type"><option value="dormant">Dormant reactivation</option><option value="kyc">KYC upgrade invitation</option><option value="champions">Product upsell</option></select></div>'
      + '<div class="field-group"><label>Recipient email</label><input type="email" id="eng-email" placeholder="name@example.com"></div>';
    window.openJourneyModal('Engage — ' + id, html, function () {
      var type = (document.getElementById('eng-type') || {}).value || 'dormant';
      var email = (document.getElementById('eng-email') || {}).value;
      if (!email) { toast('Enter an email'); return; }
      api('/api/accounts/' + encodeURIComponent(id) + '/engage', { method: 'POST', body: JSON.stringify({ type: type, email: email }) })
        .then(function (r) {
          if (r && r.delivery) toast('✓ Email ' + (r.delivery.status === 'sent' ? 'delivered' : 'queued') + ' to ' + email);
          else if (r && r.error) toast(r.error);
          else toast('✓ Sent to ' + email);
        });
    }, 'Send email', 'btn-primary');
  };

  window.igeExportAccounts = function () {
    var rows = window._igeAccounts || [];
    var csv = 'customer_id,account_type,kyc_tier,arpu,last_txn,rfm,segment,consent\n'
      + rows.map(function (a) { return [a.customerId, a.accountType, a.kycTier, a.arpu, a.lastTxn, a.rfm, a.segment, a.consent].join(','); }).join('\n');
    downloadCsv(csv, 'ige_accounts.csv');
    toast('Accounts exported ✓');
  };

  // ════════════════════════════════════════════════════════════════════════
  // SCREEN: Audit Log
  // ════════════════════════════════════════════════════════════════════════
  function injectAudit() {
    var body = '<div class="card"><div class="card-head">'
      + '<div><div class="card-title">Immutable event trail</div><div class="card-sub">Every action logged — who, what, when, which template</div></div>'
      + '<button class="btn btn-outline btn-sm" onclick="igeExportAudit()">Export for CBN</button></div>'
      + '<div class="card-p" id="audit-list"><div style="text-align:center;color:var(--text-3);padding:24px">Loading audit log…</div></div></div>';
    addScreen('audit', 'Audit Log', 'Financial-grade event trail · CBN compliance', body, 'Intelligence');
    loadAudit();
  }

  function loadAudit() {
    api('/api/audit').then(function (rows) {
      var host = document.getElementById('audit-list');
      if (!host) return;
      rows = Array.isArray(rows) ? rows : [];
      window._igeAudit = rows;
      var dotColor = { send: 'emerald', system: 'teal', approval: 'gold', segment: 'sky', optout: 'rose', consent: 'violet', kyc: 'amber' };
      host.innerHTML = rows.map(function (e) {
        var t = new Date(e.ts);
        var hh = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') + ':' + String(t.getSeconds()).padStart(2, '0');
        var color = dotColor[e.type] || 'teal';
        return '<div class="action-row">'
          + '<div class="action-dot" style="background:var(--' + color + ',#0EA5A0)"></div>'
          + '<div class="action-info"><div class="action-title">' + e.event + '</div>'
          + '<div class="action-sub">' + hh + ' WAT · ' + e.user + '</div></div></div>';
      }).join('');
    });
  }

  window.igeExportAudit = function () {
    var rows = window._igeAudit || [];
    var csv = 'timestamp,type,event,user\n' + rows.map(function (e) { return [e.ts, e.type, '"' + (e.event || '').replace(/"/g, '""') + '"', e.user].join(','); }).join('\n');
    downloadCsv(csv, 'ige_audit_cbn.csv');
    toast('Audit log exported for CBN ✓');
  };

  // ════════════════════════════════════════════════════════════════════════
  // SCREEN: Data Import (CSV → RFM)
  // ════════════════════════════════════════════════════════════════════════
  function injectImport() {
    var body = '<div class="g2">'
      + '<div class="card card-p">'
      + '<div class="card-title mb12">Import customer data</div>'
      + '<div style="border:2px dashed var(--border-2);border-radius:10px;padding:26px;text-align:center;cursor:pointer" id="imp-drop" onclick="document.getElementById(\'imp-file\').click()">'
      + '<div style="font-size:34px;margin-bottom:8px">📁</div>'
      + '<div style="font-size:13px;font-weight:600;color:var(--navy)">Click to choose your CSV</div>'
      + '<div style="font-size:11px;color:var(--text-3);margin-top:4px">RFM scoring runs automatically</div>'
      + '<input type="file" id="imp-file" accept=".csv" style="display:none">'
      + '</div>'
      + '<div style="display:flex;gap:8px;margin-top:12px">'
      + '<button class="btn btn-outline btn-sm" onclick="igeDownloadTemplate()">Download template</button>'
      + '</div>'
      + '<div id="imp-status" style="margin-top:12px"></div>'
      + '</div>'
      + '<div class="card card-p"><div class="card-title mb12">Schema (10 fields)</div>'
      + '<div style="font-size:11.5px;color:var(--text-2);line-height:1.9">'
      + '<div><b>Required:</b> customer_id, account_type, kyc_tier, last_transaction_date, transaction_count_12m, total_value_12m, consent_status</div>'
      + '<div style="margin-top:6px"><b>Optional:</b> average_balance, branch_name, days_since_last_txn</div></div>'
      + '<div class="gap-alert" style="margin-top:12px">No BVN, NIN, or account numbers. Files with BVN patterns are rejected. consent_status column is mandatory.</div>'
      + '</div></div>';
    addScreen('import', 'Data Import', 'CSV → RFM scoring → segments', body, 'Intelligence');

    var fileInput = document.getElementById('imp-file');
    if (fileInput) fileInput.addEventListener('change', function (e) {
      var f = e.target.files[0]; if (f) doImport(f);
    });
  }

  function doImport(file) {
    var status = document.getElementById('imp-status');
    if (status) status.innerHTML = '<div style="color:var(--text-2);font-size:12px">Uploading & scoring…</div>';
    var fd = new FormData(); fd.append('file', file);
    fetch(API + '/api/import', { method: 'POST', body: fd })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!status) return;
        if (res.error) { status.innerHTML = '<div class="gap-alert">' + res.error + '</div>'; return; }
        var s = res.summary || {};
        status.innerHTML = '<div class="ige-sol" style="margin-bottom:10px"><strong>✓ ' + res.total + ' accounts imported & RFM-scored.</strong></div>'
          + '<div class="stat-row"><span class="stat-key">Total accounts</span><span class="stat-val">' + s.total + '</span></div>'
          + '<div class="stat-row"><span class="stat-key">Dormant</span><span class="stat-val" style="color:var(--rose)">' + s.dormant + '</span></div>'
          + '<div class="stat-row"><span class="stat-key">At Risk</span><span class="stat-val" style="color:var(--amber)">' + s.atRisk + '</span></div>'
          + '<div class="stat-row"><span class="stat-key">Tier 1 (KYC needed)</span><span class="stat-val">' + s.tier1 + '</span></div>'
          + ((res.warnings && res.warnings.length) ? '<div class="gap-alert" style="margin-top:8px">' + res.warnings.join(' ') + '</div>' : '');
        toast('Import complete — ' + res.total + ' accounts scored ✓');
        if (typeof loadAccounts === 'function') loadAccounts();
      })
      .catch(function () { if (status) status.innerHTML = '<div class="gap-alert">Upload failed. Check the backend is reachable.</div>'; });
  }

  window.igeDownloadTemplate = function () {
    window.open(API + '/api/import/template', '_blank');
  };

  // ── helpers ────────────────────────────────────────────────────────────────
  function downloadCsv(csv, name) {
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // ── Register a screen: add div, push to SCREENS, add sidebar link ──────────
  function addScreen(id, title, sub, bodyHtml, section) {
    // 1. Add the screen div to the body (before the modals/toast wrap if present)
    var screenEl = el(screenShell(id, title, sub, bodyHtml));
    document.body.appendChild(screenEl);
    // 2. Register with the router
    if (window.SCREENS && window.SCREENS.indexOf(id) === -1) window.SCREENS.push(id);
    // 3. Add sidebar link to the hidden template, then rebuild sidebars
    addSidebarLink(id, title, section);
  }

  function addSidebarLink(id, label, section) {
    var tpl = document.getElementById('sidebar-tpl');
    if (!tpl) return;
    var nav = tpl.querySelector('.sb-nav');
    if (!nav) return;
    // Find or create the section header
    var sections = nav.querySelectorAll('.sb-section');
    var target = null;
    sections.forEach(function (s) { if (s.textContent.trim().toLowerCase() === section.toLowerCase()) target = s; });
    var icon = ICONS[id] || ICONS.accounts;
    var item = el('<div class="sb-item" data-screen="' + id + '">' + icon + label + '</div>');
    if (target) {
      // insert after the last item in that section
      var next = target.nextElementSibling;
      while (next && !next.classList.contains('sb-section')) { target = next; next = next.nextElementSibling; }
      target.parentNode.insertBefore(item, next);
    } else {
      nav.appendChild(el('<div class="sb-section">' + section + '</div>'));
      nav.appendChild(item);
    }
  }

  // ── Boot: wait for main script (SCREENS, go, buildSidebars) to be ready ────
  function boot() {
    if (!window.SCREENS || !window.go || !window.buildSidebars) { return setTimeout(boot, 100); }
    injectAccounts();
    injectAudit();
    injectImport();
    // Rebuild all sidebars so the new links appear and are wired to go()
    window.buildSidebars();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 200); });
  else setTimeout(boot, 200);
})();