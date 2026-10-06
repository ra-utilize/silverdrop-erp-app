// Parsers for ACE (Fast Reports) Excel exports.
//   "Inward Register Location Wise"               -> one row per voucher line
//   "Outward Register Location + Product Group Wise" -> one row per product (sales summary)
// Input: array of rows (XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:null})).
// Output: { kind, from, to, total, rows, problems }
(function (root) {
  const isNum = v => typeof v === 'number' && isFinite(v);
  const txt = v => (v == null ? '' : String(v));
  const clean = v => txt(v).replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
  const onlyFirst = r => r[0] != null && clean(r[0]) !== '' && r.slice(1).every(v => v == null || clean(v) === '');
  const isTotal = s => /^(group total|product total|location total|grand total)/i.test(clean(s));
  const dmy = s => {                       // 30/09/2026 or 30-09-26
    const m = clean(s).match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
    if (!m) return null;
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  };
  function period(rows) {
    for (const r of rows.slice(0, 10)) for (const c of r) {
      const m = clean(c).match(/From\s+(\S+)\s+To\s+(\S+)/i);
      if (m) return { from: dmy(m[1]), to: dmy(m[2]) };
    }
    return { from: null, to: null };
  }
  function grandTotal(rows) {
    const g = rows.find(r => /^grand total/i.test(clean(r[0])));
    if (!g) return null;
    const nums = g.filter(isNum);
    return nums.length ? nums[nums.length - 1] : null;
  }
  function kindOf(rows) {
    const head = rows.slice(0, 6).map(r => r.map(clean).join(' ')).join(' ').toLowerCase();
    if (head.includes('inward register')) return 'ace_inward';
    if (head.includes('outward register')) return 'ace_outward';
    return null;
  }

  function parseInward(rows) {
    const problems = [];
    const hi = rows.findIndex(r => clean(r[0]).toUpperCase() === 'DATE');
    if (hi < 0) return { problems: ['Header row (DATE / DOC. / DETAILS ...) not found'], rows: [] };
    const H = rows[hi].map(c => clean(c).toUpperCase().replace(/\.$/, ''));
    const col = n => H.indexOf(n);
    const C = { doc: col('DOC'), party: col('DETAILS'), qty2: col('QTY2'), qty: col('QTY'), rate: col('RATE'), amount: col('AMOUNT') };
    for (const [k, v] of Object.entries(C)) if (v < 0 && k !== 'qty2') problems.push(`Column ${k.toUpperCase()} not found`);
    let location = null, item = null; const out = [];
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i], c0 = txt(r[0]);
      if (r.every(v => v == null || clean(v) === '')) continue;
      if (/^\d{2}-\d{2}-\d{2}$/.test(clean(c0))) {
        const doc = clean(r[C.doc]);
        out.push({
          line_number: out.length + 1, location, item_name: item,
          voucher_date: dmy(c0), voucher_no: doc, doc_type: doc.split(' ')[0] || null,
          party_name: clean(r[C.party]) || null,
          qty: isNum(r[C.qty]) ? r[C.qty] : null,
          rate: isNum(r[C.rate]) ? r[C.rate] : null,
          value: isNum(r[C.amount]) ? r[C.amount] : null
        });
      } else if (isTotal(c0) || /^(end of|ace |page)/i.test(clean(c0))) {
        continue;
      } else if (onlyFirst(r)) {
        if (/^\s/.test(c0)) location = clean(c0); else item = clean(c0);
      }
    }
    return { rows: out, problems };
  }

  function parseOutward(rows) {
    const problems = [];
    const hi = rows.findIndex(r => clean(r[0]).toUpperCase() === 'PRODUCT');
    if (hi < 0) return { problems: ['Header row (PRODUCT / QTY1 / AMOUNT) not found'], rows: [] };
    let location = null, group = null; const out = [];
    const body = rows.slice(hi + 1);
    for (let i = 0; i < body.length; i++) {
      const r = body[i], c0 = clean(r[0]);
      if (!c0) continue;
      if (isTotal(c0) || /^(end of|ace )/i.test(c0)) continue;
      const nums = r.slice(1).filter(isNum);
      if (nums.length === 0 && onlyFirst(r)) {
        // a section row directly followed by another section row is the location
        const next = body.slice(i + 1).find(x => x.some(v => v != null && clean(v) !== ''));
        if (next && onlyFirst(next) && !isTotal(next[0]) && location === null) location = c0; else group = c0;
        continue;
      }
      out.push({ line_number: out.length + 1, location, product_group: group, item_name: c0,
                 qty: nums.length ? nums[0] : null, value: nums.length > 1 ? nums[nums.length - 1] : null });
    }
    return { rows: out, problems };
  }

  function parseAce(rows) {
    const kind = kindOf(rows);
    if (!kind) return { kind: null, rows: [], problems: ['Not an ACE inward/outward register'] };
    const p = kind === 'ace_inward' ? parseInward(rows) : parseOutward(rows);
    const { from, to } = period(rows);
    const total = grandTotal(rows);
    const sum = Math.round(p.rows.reduce((s, r) => s + (r.value || 0), 0) * 100) / 100;
    if (total != null && Math.abs(sum - total) > 1) p.problems.push(`Lines add up to ${sum} but report Grand Total is ${total}`);
    if (!from || !to) p.problems.push('Report period (From ... To ...) not found');
    return { kind, from, to, total, sum, rows: p.rows, problems: p.problems };
  }

  root.parseAce = parseAce;
  if (typeof module !== 'undefined') module.exports = { parseAce };
})(typeof window !== 'undefined' ? window : globalThis);
