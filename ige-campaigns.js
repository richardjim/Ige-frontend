// ════════════════════════════════════════════════════════════════════════════
// IGE Banking — Live Campaigns table
// Makes the Campaigns screen table render from /api/campaigns, so newly
// launched campaigns appear immediately. Refreshes on screen-open and after
// every launch. Loads LAST (after ige-forms.js).
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var API = window.IGE_API_BASE || '';
  function api(path, opts) {
    return fetch(API + path, Object.assign({ headers: { 'content-type': 'application/json' } }, opts || {}))
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .catch(function () { return null; });
  }
  function money(n) {
    n = Number(n || 0);
    if (n >= 1e9) return '₦' + (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
    if (n >= 1e6) return '₦' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return '₦' + Math.round(n / 1e3) + 'K';
    return '₦' + n.toLocaleString('en-NG');
  }
  function statusBadge(s) {
    var map = { Live: 'b-green', Scheduled: 'b-teal', Draft: 'b-slate', Urgent: 'b-gold', Paused: 'b-amber' };
    return '<span class="badge ' + (map[s] || 'b-slate') + '">' + s + '</span>';
  }
  function segLabel(seg) {
    return ({ dormant: 'Dormant Reactivation', champions: 'Champions VIP', 'kyc-tier1': 'KYC Tier 1', atrisk: 'At Risk', loyal: 'Loyal', promising: 'Promising' }[seg] || seg);
  }

  // Find the Campaigns table tbody (the table under "All campaigns" in #s-campaigns)
  function campaignsTbody() {
    var screen = document.getElementById('s-campaigns');
    if (!screen) return null;
    var tables = screen.querySelectorAll('table.tbl');
    // The main campaigns table is the one with a 'WA Flow' header
    for (var i = 0; i < tables.length; i++) {
      var heads = tables[i].querySelectorAll('th');
      for (var j = 0; j < heads.length; j++) {
        if (/WA Flow/i.test(heads[j].textContent)) return tables[i].querySelector('tbody');
      }
    }
    return tables.length ? tables[0].querySelector('tbody') : null;
  }

  function renderCampaigns() {
    var tb = campaignsTbody();
    if (!tb) return;
    api('/api/campaigns').then(function (list) {
      if (!Array.isArray(list)) return;
      window._igeCampaignList = list;
      tb.innerHTML = list.map(function (c) {
        var leads = c.sent ? Number(c.sent).toLocaleString() : '—';
        var open = c.openRate ? c.openRate + '%' : '—';
        var conv = c.responded && c.sent ? ((c.responded / c.sent) * 100).toFixed(1) + '%' : '—';
        var attributed = c.attributed ? ' · ' + money(c.attributed) : '';
        var draft = (c.status === 'Draft' || c.status === 'Scheduled');
        return '<tr' + (draft ? ' style="background:rgba(241,245,249,.5)"' : '') + '>'
          + '<td><div class="tbl-name">' + c.name + '</div><div class="tbl-sub">' + new Date(c.createdAt).toLocaleDateString() + attributed + '</div></td>'
          + '<td><span class="tag-pill t-comp">' + (c.template || 'Campaign') + '</span></td>'
          + '<td style="font-size:11px;color:var(--text-2)">' + segLabel(c.segment) + '</td>'
          + '<td style="font-size:11px">' + segLabel(c.segment) + '</td>'
          + '<td><b>' + leads + '</b></td>'
          + '<td style="color:var(--green)">' + open + '</td>'
          + '<td style="color:var(--green);font-weight:700">' + conv + '</td>'
          + '<td style="font-size:11px">' + c.channel + '</td>'
          + '<td>' + statusBadge(c.status) + '</td>'
          + '<td><button class="btn btn-ghost btn-sm" onclick="igeCampaignDetail(\'' + c.id + '\')">View</button></td>'
          + '</tr>';
      }).join('');
    });
  }

  window.igeCampaignDetail = function (id) {
    var c = (window._igeCampaignList || []).find(function (x) { return x.id === id; });
    if (!c || !window.openJourneyModal) return;
    var html = (window.alertBox ? window.alertBox('Campaign <strong>' + c.name + '</strong> — saved to the backend and persisted.', 'info') : '')
      + (window.infoRow ? (
        window.infoRow('Campaign ID', c.id) +
        window.infoRow('Segment', segLabel(c.segment)) +
        window.infoRow('Channel', c.channel) +
        window.infoRow('Recipients', Number(c.sent).toLocaleString()) +
        window.infoRow('Status', c.status) +
        window.infoRow('Attributed', money(c.attributed))
      ) : '');
    window.openJourneyModal('Campaign — ' + c.name, html);
  };

  // ── Hook navigation: re-render whenever the Campaigns screen opens ─────────
  function hookNav() {
    if (!window.go) return setTimeout(hookNav, 100);
    var origGo = window.go;
    window.go = function (id) {
      origGo(id);
      if (id === 'campaigns') setTimeout(renderCampaigns, 60);
    };
  }

  // ── Hook launches: re-render after a campaign is created ───────────────────
  function hookLaunch() {
    if (!window.igeLaunchCampaign) return setTimeout(hookLaunch, 100);
    var origLaunch = window.igeLaunchCampaign;
    window.igeLaunchCampaign = function (payload) {
      return origLaunch(payload).then(function (r) {
        setTimeout(renderCampaigns, 200);
        return r;
      });
    };
  }

  function boot() {
    if (!document.getElementById('s-campaigns')) return setTimeout(boot, 150);
    hookNav();
    hookLaunch();
    renderCampaigns(); // initial load
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 350); });
  else setTimeout(boot, 350);
})();