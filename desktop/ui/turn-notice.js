(function (host, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.WhaleTurnNotice = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const T = key => globalThis.WhaleI18n?.t('panels.' + key) ?? key;
  const M = value => globalThis.WhaleI18n?.message(value) ?? String(value ?? '');
  function kind(record) {
    if (record.completionKind === 'failed' || ['failed','interrupted','superseded'].includes(record.outcome)) return 'failed';
    if (record.completionKind === 'cancelled' || ['aborted', 'cancelled'].includes(record.outcome)) return 'cancelled';
    return 'success';
  }
  function shouldNotify(record, { seq = 0, id = '', firstPoll = false, startedAt = 0 } = {}) {
    if (!record?.ok || !Number.isSafeInteger(record.seq) || record.seq <= seq || !record.id || record.id === id ||
        record.turn == null || record.notify === false || record.isSubagent) return false;
    const published = record.notificationAt || record.ts;
    const at = typeof published === 'number' ? published : Date.parse(published);
    return !firstPoll || Number.isFinite(at) && at >= startedAt;
  }
  function snapshot(record, nativeCurrency = 'USD', random = Math.random) {
    const completionKind = kind(record);
    const known = record.source !== 'shared-key-interval' && record.amount !== null && record.amount !== undefined && Number.isFinite(Number(record.amount)) &&
      !['pending', 'unknown'].includes(record.costState);
    const failureKind = completionKind === 'failed' && record.failureKind === 'high-demand' ? 'high-demand' : null;
    const labelKey = known ? (record.source === 'configured-pricing-estimate' ? 'panels.turnEstimated' : 'panels.turnCost') : record.tokens > 0 ? 'panels.turnUsageRecorded' : 'panels.turnEnded';
    return Object.freeze({
      id: String(record.id || ''), completionKind,
      failureKind,
      labelKey,
      label: T(labelKey.slice(7)),
      conversationRef: /^[a-f0-9]{8}$/.test(record.conversationRef || '') ? record.conversationRef : '',
      accountIntervalAmount: record.accountIntervalAmount ?? (record.source === 'shared-key-interval' ? record.amount : null),
      amount: known ? Number(record.amount) : null,
      currency: record.currency || nativeCurrency,
      costState: known ? record.costState || 'observed' : record.costState === 'pending' ? 'pending' : 'unknown',
      tokens: Number.isFinite(record.tokens) && record.tokens >= 0 ? Math.floor(record.tokens) : null,
      note: M(record.note),
    });
  }
  function enabled(notice, settings, turnCostOn) {
    return ['success','cancelled','failed'].includes(notice.completionKind) && !!turnCostOn;
  }
  return Object.freeze({ kind, shouldNotify, snapshot, enabled });
});
