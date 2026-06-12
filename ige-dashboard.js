// ════════════════════════════════════════════════════════════════════════════
// IGE Banking — Dashboard spec alignment
// Fixes the NaN/₦0 KPI cards by reading the v2 backend's field names, updates
// the 4 Command Centre cards to spec (Total accounts · Dormant · ₦84.2M · KYC),
// and switches branding to FirstBank. Loads after ige-api.js.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var API = window.IGE_API_BASE || '';
  function api(path) {
    return fetch(API + path).then(function (r) { return r.json().catch(function () { return null; }); }).catch(function () { return null; });
  }
  function moneyCompact(n) {
    n = Number(n || 0);
    if (n >= 1e9) return '₦' + (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 2).replace(/\.?0+$/, '') + 'B';
    if (n >= 1e6) return '₦' + (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return '₦' + Math.round(n / 1e3) + 'K';
    return '₦' + n.toLocaleString('en-NG');
  }
  function num(n) { return Number(n || 0).toLocaleString('en-NG'); }

  // The 4 spec KPI cards in order: [label, value, delta]
  function specCards(d) {
    return [
      { label: 'Total accounts',        value: num(d.totalAccounts),              delta: '↑ +' + num(d.accountsThisMonth) + ' this month', cls: 'up' },
      { label: 'Dormant accounts',      value: num(d.dormantCount),               delta: d.dormantPct + '% of base · 90+ days',           cls: 'down' },
      { label: 'Revenue recovered',     value: moneyCompact(d.revenueRecovered30d), delta: '↑ +' + d.revenueDeltaPct + '% vs last month',  cls: 'up' },
      { label: 'KYC upgrades needed',   value: num(d.kycUpgradeNeeded),           delta: 'Tier 1 → Tier 2 eligible',                      cls: 'warn' }
    ];
  }

  function applyDashboard() {
    api('/api/dashboard/summary').then(function (d) {
      if (!d) return;

      // Only touch the KPI grid inside the Command Centre screen
      var screen = document.getElementById('s-dashboard');
      if (!screen) return;
      var cards = screen.querySelectorAll('.kpi');
      var spec = specCards(d);
      cards.forEach(function (card, i) {
        if (!spec[i]) return;
        var lab = card.querySelector('.kpi-label');
        var val = card.querySelector('.kpi-val');
        var del = card.querySelector('.kpi-delta');
        if (lab) lab.textContent = spec[i].label;
        if (val) val.textContent = spec[i].value;
        if (del) { del.textContent = spec[i].delta; del.className = 'kpi-delta ' + spec[i].cls; }
      });

      // Command Centre subtitle → FirstBank
      var sub = screen.querySelector('.topbar-sub');
      if (sub) sub.textContent = 'FirstBank Nigeria · Live · Updated just now';
    });

    // Bank pill (all sidebars) → FirstBank, from the active institution
    api('/api/config').then(function (c) {
      var inst = c && c.institution;
      var name = (inst && inst.name) || 'FirstBank Nigeria';
      var sub = inst ? ('Enterprise+ · ' + (inst.customers / 1e6) + 'M customers') : 'Enterprise+ · 31M customers';
      document.querySelectorAll('.sb-bank-name').forEach(function (el) { el.textContent = name; });
      document.querySelectorAll('.sb-bank-sub').forEach(function (el) { el.textContent = sub; });
    });
  }

  function boot() {
    // wait until sidebars + dashboard exist
    if (!document.getElementById('s-dashboard')) return setTimeout(boot, 150);
    applyDashboard();
    // Re-apply shortly after, in case ige-api.js hydrate runs and overwrites
    setTimeout(applyDashboard, 800);
    setTimeout(applyDashboard, 1800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  else setTimeout(boot, 300);
})();