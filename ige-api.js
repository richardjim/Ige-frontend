// ════════════════════════════════════════════════════════════════════════════
// IGE Banking — API integration adapter
// Progressive enhancement: the static UI keeps working; this layer fetches live
// data from the backend and overlays it. If the API is down, the UI falls back
// to its built-in seed values (spec rule: no error states in a demo).
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // Point this at your deployed backend (Railway) for production.
  var API = (window.IGE_API_BASE) ||
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://localhost:4000'
      : (location.origin.replace(/\/$/, '')));   // same-origin in prod if proxied

  // ── tiny fetch helper with silent fallback ────────────────────────────────
  function api(path, opts) {
    return fetch(API + path, Object.assign({ headers: { 'content-type': 'application/json' } }, opts || {}))
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .catch(function (err) { console.warn('[IGE API] ' + path + ' →', err.message); return null; });
  }
  window.igeApi = api; // expose for inline handlers

  function fmtN(n) { return '₦' + Number(n || 0).toLocaleString('en-NG'); }
  function fmtCompact(n) {
    n = Number(n || 0);
    if (n >= 1e9) return '₦' + (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1) + 'B';
    if (n >= 1e6) return '₦' + (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M';
    if (n >= 1e3) return '₦' + (n / 1e3).toFixed(0) + 'K';
    return '₦' + n;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }

  // ── 1. health badge ───────────────────────────────────────────────────────
  function showApiBadge(ok, info) {
    var b = document.getElementById('ige-api-badge');
    if (!b) {
      b = document.createElement('div');
      b.id = 'ige-api-badge';
      b.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:9999;font:600 11px/1 Sora,sans-serif;' +
        'padding:7px 12px;border-radius:20px;box-shadow:0 4px 16px rgba(5,25,45,.18);cursor:default;display:flex;align-items:center;gap:6px';
      document.body.appendChild(b);
    }
    if (ok) {
      b.style.background = '#D1FAE5'; b.style.color = '#065F46';
      b.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:#059669;display:inline-block"></span>' +
        'API live · email:' + info.email.provider + ' · sms:' + info.sms.provider;
    } else {
      b.style.background = '#FEE9EB'; b.style.color = '#991B1B';
      b.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:#E11D48;display:inline-block"></span>API offline — using demo seed';
    }
  }

  // ── 2. dashboard KPIs ───────────────────────────────────────────────────────
  function hydrateDashboard() {
    api('/api/dashboard/summary').then(function (d) {
      if (!d) return;
      // The static UI uses platform-level KPIs (₦4.8B etc). We map live values
      // by text-matching the KPI labels so we don't depend on brittle indexes.
      document.querySelectorAll('.kpi').forEach(function (card) {
        var label = (card.querySelector('.kpi-label') || {}).textContent || '';
        var val = card.querySelector('.kpi-val');
        if (!val) return;
        var l = label.toLowerCase();
        if (l.indexOf('lead') > -1)        val.textContent = Number(d.totalLeads).toLocaleString();
        else if (l.indexOf('conversion') > -1) val.textContent = Number(d.conversionsMTD).toLocaleString();
        else if (l.indexOf('revenue') > -1)    val.textContent = fmtCompact(d.revenueRecovered);
        else if (l.indexOf('cac') > -1 || l.indexOf('cost') > -1) val.textContent = fmtN(d.avgCampaignCAC);
      });
    });
  }

  // ── 3. live activity feed (rotates every 5s — spec requirement) ────────────
  function startLiveFeed() {
    api('/api/dashboard/feed').then(function (feed) {
      if (!feed || !feed.length) return;
      var host = document.getElementById('ige-feed') || findFeedHost();
      if (!host) return;
      var idx = 0;
      function render() {
        var e = feed[idx % feed.length];
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid var(--border);animation:igeIn .4s ease';
        row.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;background:var(--' + e.color + ',#0EA5A0);flex-shrink:0"></span>' +
          '<div style="flex:1;min-width:0"><div style="font-size:11.5px;font-weight:600;color:var(--navy)">' + e.title + '</div>' +
          '<div style="font-size:10px;color:var(--text-3)">' + e.sub + '</div></div>' +
          '<div style="font-size:11px;font-weight:700;color:var(--' + e.color + ',#0EA5A0)">' + e.value + '</div>';
        host.insertBefore(row, host.firstChild);
        while (host.children.length > 6) host.removeChild(host.lastChild);
        idx++;
      }
      render();
      setInterval(render, 5000);
    });
  }
  function findFeedHost() {
    // Best-effort: attach a feed container under the first dashboard card if none exists.
    return null;
  }

  // ── 4. campaigns table ──────────────────────────────────────────────────────
  function hydrateCampaigns() {
    api('/api/campaigns').then(function (list) {
      if (!list) return;
      window._igeCampaigns = list; // available to UI handlers
    });
  }

  // ── 5. AI generate hook (used by campaign builder) ─────────────────────────
  window.igeGenerateMessage = function (segment, count) {
    return api('/api/campaigns/generate-message', {
      method: 'POST', body: JSON.stringify({ segment: segment, customerCount: count })
    });
  };

  // ── 6. launch campaign (real send if recipient given) ──────────────────────
  window.igeLaunchCampaign = function (payload) {
    return api('/api/campaigns/launch', { method: 'POST', body: JSON.stringify(payload) });
  };

  // ── 7. wallet fund (live balance update — spec requirement) ────────────────
  window.igeFundWallet = function (amount, method) {
    return api('/api/wallet/fund', { method: 'POST', body: JSON.stringify({ amount: amount, method: method }) })
      .then(function (r) {
        if (r && r.balance != null) {
          document.querySelectorAll('[data-ige-wallet-balance]').forEach(function (el) { el.textContent = fmtN(r.balance); });
        }
        return r;
      });
  };

  // ── 8. send real email/SMS for a lead (wraps existing buttons) ─────────────
  window.igeSendEmail = function (accountId, type, email) {
    return api('/api/accounts/' + encodeURIComponent(accountId) + '/engage', {
      method: 'POST', body: JSON.stringify({ type: type, email: email })
    });
  };
  window.igeSendSms = function (accountId, type, phone) {
    return api('/api/accounts/' + encodeURIComponent(accountId) + '/engage', {
      method: 'POST', body: JSON.stringify({ type: type, phone: phone })
    });
  };

  // ── 9. CSV import ───────────────────────────────────────────────────────────
  window.igeImportCsv = function (file) {
    var fd = new FormData(); fd.append('file', file);
    return fetch(API + '/api/import', { method: 'POST', body: fd })
      .then(function (r) { return r.json(); })
      .catch(function (e) { return { error: e.message }; });
  };

  // ── 10. reset demo ──────────────────────────────────────────────────────────
  window.igeReset = function () { return api('/api/demo/reset', { method: 'POST' }); };

  // ── bootstrap ────────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = '@keyframes igeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}';
  document.head.appendChild(style);

  function boot() {
    api('/api/health').then(function (h) {
      if (h && h.status === 'ok') {
        showApiBadge(true, h.messaging);
        hydrateDashboard();
        hydrateCampaigns();
        startLiveFeed();
      } else {
        showApiBadge(false);
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
