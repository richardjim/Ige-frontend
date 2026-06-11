// IGE Banking — Real send wiring + campaign persistence
// WhatsApp chat stays a simulation; action buttons fire real email/SMS via backend.
(function () {
  'use strict';

  function toast(msg) { if (window.showToast) window.showToast(msg); }

  function askRecipient(opts) {
    var label = opts.channel === 'sms' ? 'Phone number' : 'Email address';
    var ph = opts.channel === 'sms' ? '08012345678' : 'name@example.com';
    if (window.openJourneyModal) {
      var html = '<div style="font-size:12.5px;color:#475569;margin-bottom:12px;line-height:1.6">'
        + 'This sends a <strong>real ' + (opts.channel === 'sms' ? 'SMS' : 'email') + '</strong> through the backend.</div>'
        + '<div class="field-group"><label>' + label + '</label>'
        + '<input type="' + (opts.channel === 'sms' ? 'tel' : 'email') + '" id="ige-recip" placeholder="' + ph + '"></div>'
        + '<div style="font-size:11px;color:#94A3B8">Template: ' + (opts.type || 'dormant') + '</div>';
      window.openJourneyModal(opts.title || 'Send message', html, function () {
        var v = (document.getElementById('ige-recip') || {}).value;
        if (!v) { toast('No recipient entered'); return; }
        opts.onResult(v.trim());
      }, 'Send now', 'btn-primary');
    } else {
      var v = window.prompt(label + ':', '');
      if (v) opts.onResult(v.trim());
    }
  }

  function realEngage(channel, type, recipient) {
    var fn = channel === 'sms' ? window.igeSendSms : window.igeSendEmail;
    if (!fn) { toast('API not ready'); return; }
    fn('ACC-00012345', type, recipient).then(function (r) {
      if (r && r.delivery) {
        var status = r.delivery.status === 'sent' ? 'delivered' : 'queued (simulated)';
        toast('✓ Real ' + (channel === 'sms' ? 'SMS' : 'email') + ' ' + status + ' to ' + recipient);
      } else if (r && r.error) {
        toast('Send blocked: ' + r.error);
      } else {
        toast('✓ Sent to ' + recipient);
      }
    });
  }

  function wrapWithRealSend(fnName, type, channel) {
    var orig = window[fnName];
    if (typeof orig !== 'function') return;
    window[fnName] = function () {
      orig.apply(this, arguments);
      setTimeout(function () { injectRealSendButton(type, channel); }, 50);
    };
  }

  function injectRealSendButton(type, channel) {
    var foot = document.getElementById('mj-foot');
    if (!foot || document.getElementById('ige-real-send')) return;
    var btn = document.createElement('button');
    btn.id = 'ige-real-send';
    btn.className = 'btn btn-green';
    btn.textContent = channel === 'sms' ? '📱 Send real SMS' : '📧 Send real email';
    btn.onclick = function () {
      if (window.closeJourney) window.closeJourney();
      askRecipient({
        title: 'Send real ' + (channel === 'sms' ? 'SMS' : 'email'),
        channel: channel, type: type,
        onResult: function (recipient) { realEngage(channel, type, recipient); }
      });
    };
    foot.appendChild(btn);
  }

  function wireAll() {
    wrapWithRealSend('dormantYes',       'dormant',   'email');
    wrapWithRealSend('sendWinBack',      'dormant',   'email');
    wrapWithRealSend('sendKYCLink',      'kyc',       'email');
    wrapWithRealSend('sendKYCReminder',  'kyc',       'email');
    wrapWithRealSend('sendReminder',     'dormant',   'email');
    wrapWithRealSend('waBookAppointment','debit',     'email');
    wrapWithRealSend('issueReward',      'champions', 'sms');
    wrapWithRealSend('creditReward',     'champions', 'sms');
    wireCampaignLaunch();
  }

  // Make campaign launches actually persist to the backend
  function wireCampaignLaunch() {
    var origNew = window.launchNewCampaign;
    window.launchNewCampaign = function () {
      var nameInput = document.querySelector('#modal-campaign input[type=text]');
      var name = (nameInput && nameInput.value) ? nameInput.value : 'New Campaign';
      var segSelect = document.querySelector('#modal-campaign select');
      var segText = segSelect ? segSelect.value.toLowerCase() : '';
      var segmentId = segText.indexOf('dormant') > -1 ? 'dormant'
        : segText.indexOf('card') > -1 ? 'champions'
        : segText.indexOf('kyc') > -1 ? 'kyc-tier1'
        : segText.indexOf('salary') > -1 ? 'loyal'
        : 'dormant';
      var m = document.getElementById('modal-campaign');
      if (m) m.style.display = 'none';
      if (window.igeLaunchCampaign) {
        window.igeLaunchCampaign({ segmentId: segmentId, name: name, channel: 'Email' })
          .then(function (r) {
            if (r && r.campaignId) toast('✓ "' + name + '" launched & saved (id ' + r.campaignId + ', ' + r.sent + ' recipients)');
            else toast('"' + name + '" launched');
          });
      } else if (origNew) { origNew(); }
    };

    var origDraft = window.launchDraftCampaign;
    window.launchDraftCampaign = function (btn) {
      if (origDraft) origDraft(btn);
      var row = btn ? btn.closest('tr') : null;
      var name = row ? row.querySelector('.tbl-name').textContent : 'Draft Campaign';
      if (window.igeLaunchCampaign) {
        window.igeLaunchCampaign({ segmentId: 'dormant', name: name, channel: 'Email' });
      }
    };
  }

  window.igeRealSend = function (channel, type) {
    askRecipient({
      title: 'Send real ' + (channel === 'sms' ? 'SMS' : 'email'),
      channel: channel || 'email', type: type || 'dormant',
      onResult: function (recipient) { realEngage(channel || 'email', type || 'dormant', recipient); }
    });
  };

  function boot() { setTimeout(wireAll, 300); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();