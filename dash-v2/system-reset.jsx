/* global React, DB, useDB, can, currentUser, Capital, Icon, Btn, Badge, Card,
   Field, Input, Modal, toast, fmtDate */
// ====================================================================
// WORDS TIE — Full Test Data Reset (System Management · Danger Zone)
// Additive feature: creates a complete backup ZIP (Excel workbook with
// one sheet per operational table + real attachment files), then — and
// only then — clears all demo/test operational data. Users, roles,
// permissions, settings and system configuration are never touched.
// ====================================================================
const { useState: useFRS } = React;

// ---- lazy CDN libraries (loaded only when a backup is generated) ----
const WT_FR_LIBS = {
  xlsx: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  exceljs: "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js",
  jszip: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  jspdf: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
};
const _frLibCache = {};
function frLoadLib(key) {
  if (_frLibCache[key]) return _frLibCache[key];
  _frLibCache[key] = new Promise((res, rej) => {
    const el = document.createElement("script");
    el.src = WT_FR_LIBS[key];
    el.onload = () => res();
    el.onerror = () => { delete _frLibCache[key]; rej(new Error("Could not load backup library (" + key + "). Check your internet connection.")); };
    document.head.appendChild(el);
  });
  return _frLibCache[key];
}

// ---- small helpers --------------------------------------------------
const frV = (v) => (v == null ? "" : v);
function frSafeName(n) { return String(n || "file").replace(/[\\/:*?"<>|]/g, "_").slice(0, 120); }
function frFileType(name) { const ext = (String(name || "").split(".").pop() || "").toLowerCase(); return ext && ext !== name ? ext.toUpperCase() : "FILE"; }
function frDataUrlB64(u) {
  const m = /^data:([^;,]*);base64,(.*)$/.exec(String(u || ""));
  return m ? { mime: m[1], b64: m[2] } : null;
}
function frStamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
}
function frSheet(rows, cols) {
  return [cols.map((c) => c[0]), ...(rows || []).map((r) => cols.map((c) => frV(c[1](r))))];
}
function frLangPairs(lp) { return (lp || []).map((x) => `${x.source}→${x.target}`).join(", "); }

// ---- attachment collection ------------------------------------------
// Walks every module that can hold uploaded files and returns a flat
// list. Real stored content (data-URLs) is exported as real files in the
// ZIP; metadata-only demo records get a clearly-labelled .placeholder.txt
// so the index stays complete. PDFs/images are NEVER embedded in Excel.
function frCollectAttachments(db) {
  const out = [];
  const push = (folder, module, file, meta) => {
    if (!file) return;
    const name = file.original_name || file.name;
    if (!name) return;
    const b = frDataUrlB64(file.data);
    out.push({
      name, folder, module,
      record: frV(meta.record), client: frV(meta.client), task: frV(meta.task),
      date: frV(file.created_at || file.uploaded_at || file.updated_at),
      b64: b ? b.b64 : null,
      note: frV(file.note),
    });
  };
  (db.tasks || []).forEach((t) => (t.media || []).forEach((f) => push("tasks", "Tasks", f, { record: t.task_number, client: t.client_code, task: t.task_number })));
  (db.clientInvoices || []).forEach((i) => (i.media || []).forEach((f) => push("client-invoices", "Client Invoices", f, { record: i.invoice_code, client: i.client_code, task: i.task_code })));
  (db.freelancerInvoices || []).forEach((i) => (i.media || []).forEach((f) => push("freelancer-invoices", "Freelancer Invoices", f, { record: i.invoice_code, task: i.task_code })));
  (db.clients || []).forEach((c) => {
    (c.media || []).forEach((f) => push("clients", "Clients", f, { record: c.client_code, client: c.client_code }));
    if (c.attachment) push("clients", "Clients", c.attachment, { record: c.client_code, client: c.client_code });
  });
  (db.freelancers || []).forEach((c) => {
    (c.media || []).forEach((f) => push("freelancers", "Freelancers", f, { record: c.freelancer_code }));
    if (c.attachment) push("freelancers", "Freelancers", c.attachment, { record: c.freelancer_code });
  });
  (db.employees || []).forEach((e) => { if (e.attachment) push("employees", "Employees", e.attachment, { record: e.employee_code }); });
  (db.maintenance || []).forEach((m) => { if (m.attachment) push("maintenance", "Maintenance", m.attachment, { record: m.maintenance_id }); });
  (db.projectRequests || []).forEach((r) => (r.media || []).forEach((f) =>
    push(r.source === "Client Portal" ? "client-portal" : "price-requests", r.source === "Client Portal" ? "Client Portal" : "Price Requests", f, { record: r.project_name, client: r.client_code })));
  (db.contactMessages || []).forEach((m) => (m.media || []).forEach((f) => push("contact-messages", "Contact Messages", f, { record: m.subject })));
  (db.revenues || []).forEach((r) => (r.sheets || []).forEach((f) => push("finance", "Finance · Revenues", f, { record: r.month })));
  (db.expenses || []).forEach((r) => (r.sheets || []).forEach((f) => push("finance", "Finance · Expenses", f, { record: r.month })));

  // assign unique ZIP paths
  const used = new Set();
  out.forEach((a) => {
    let base = frSafeName(a.name);
    if (!a.b64) base += ".placeholder.txt";
    let path = `attachments/${a.folder}/${base}`, n = 2;
    while (used.has(path)) { path = `attachments/${a.folder}/${n}-${base}`; n++; }
    used.add(path);
    a.zipPath = path;
  });
  return out;
}

// ---- shared download helper ------------------------------------------
function frDownloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

// ---- Company Capital sheets (shared by full + capital-only backups) ----
function frCapitalAoAs(db) {
  let C = { opening: 0, cashIn: 0, cashOut: 0, net: 0, total: 0, emergency: 0, temporary: 0, available: 0, remainingDue: 0 };
  try { if (window.Capital && Capital.compute) C = { ...C, ...Capital.compute() }; } catch (e) {}
  const kpis = ["Company Capital KPIs", [["Metric", "Amount (EGP base)"],
    ["Current Total Capital", C.total], ["Available Balance", C.available],
    ["Emergency Reserve", C.emergency], ["Temporary Reserve", C.temporary],
    ["Total Cash In", C.cashIn], ["Total Cash Out", C.cashOut],
    ["Net Movement", C.net], ["Remaining Due", C.remainingDue], ["Opening Capital", C.opening]]];
  const ledger = db.capitalLedger || [];
  const txns = ["Capital Transactions", frSheet(ledger, [
    ["Txn Code", (t) => t.txn_code], ["Date", (t) => t.date], ["Type", (t) => t.type], ["Direction", (t) => t.direction],
    ["Source", (t) => t.source], ["Reference", (t) => t.reference], ["Description", (t) => t.description],
    ["Amount", (t) => t.amount], ["Currency", (t) => t.currency], ["Rate", (t) => t.rate], ["Base (EGP)", (t) => t.base_amount],
    ["Reserve", (t) => t.reserve], ["Reserve Dir", (t) => t.reserve_dir], ["Status", (t) => t.status],
    ["Created By", (t) => t.created_by], ["Posted At", (t) => t.posted_at], ["Reason", (t) => t.reason], ["Notes", (t) => t.notes]])];
  const bySrc = {};
  ledger.forEach((t) => {
    if (t.status !== "Posted") return;
    const k = t.source || t.type;
    bySrc[k] = bySrc[k] || { in: 0, out: 0, n: 0 };
    if (t.direction === "In") bySrc[k].in += +t.base_amount || 0;
    if (t.direction === "Out") bySrc[k].out += +t.base_amount || 0;
    bySrc[k].n++;
  });
  const breakdown = ["Capital Breakdown", [["Source", "Cash In (EGP)", "Cash Out (EGP)", "Net (EGP)", "Transactions"],
    ...Object.keys(bySrc).map((k) => [k, bySrc[k].in, bySrc[k].out, bySrc[k].in - bySrc[k].out, bySrc[k].n])]];
  return [kpis, txns, breakdown];
}

// ---- Finance Dashboard sheet (mirrors the live Finance Dashboard math:
// projects ledger revenue/costs + maintenance + paid payroll, in USD) ----
function frFinanceAoA(db) {
  const EGP_PER_USD = 50;
  const toUSD = (a, c) => (c === "EGP" ? (+a || 0) / EGP_PER_USD : (+a || 0));
  const mk = (s) => { const d = new Date(s); return isNaN(d) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const num = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));
  const map = {};
  const row = (k) => (map[k] = map[k] || { key: k, revenue: 0, prjExp: 0, mntExp: 0, pyExp: 0, count: 0, paid: 0, unpaid: 0, partial: 0, marginSum: 0 });
  (db.projects || []).forEach((p) => {
    let k = p.date ? mk(p.date) : "";
    if (!k) { const t = (db.tasks || []).find((x) => x.task_number === p.task_code); k = t && t.start_date ? mk(t.start_date) : ""; }
    if (!k) return;
    const vol = num(p.volume), ca = vol * num(p.client_rate), fc = vol * num(p.fl_rate);
    const r = row(k);
    r.revenue += ca; r.prjExp += fc; r.count += 1; r.marginSum += ca ? ((ca - fc) / ca) * 100 : 0;
    const ps = (p.payment_status || "").toLowerCase();
    if (ps === "paid") r.paid += 1; else if (ps === "partially paid") r.partial += 1; else r.unpaid += 1;
  });
  (db.maintenance || []).forEach((x) => { const k = mk(x.payment_date); if (k) row(k).mntExp += toUSD(x.amount, x.currency); });
  (db.payroll || []).forEach((x) => { if (x.status === "Paid" && x.month) row(x.month).pyExp += toUSD(x.salary, x.currency); });
  const months = Object.values(map).map((r) => ({
    ...r, totalExp: r.prjExp + r.mntExp + r.pyExp, net: r.revenue - r.prjExp - r.mntExp - r.pyExp,
    avgMargin: r.count ? r.marginSum / r.count : 0,
  })).sort((a, b) => (a.key < b.key ? 1 : -1));
  const t = months.reduce((s, m) => ({
    revenue: s.revenue + m.revenue, prjExp: s.prjExp + m.prjExp, mntExp: s.mntExp + m.mntExp, pyExp: s.pyExp + m.pyExp,
    totalExp: s.totalExp + m.totalExp, net: s.net + m.net, count: s.count + m.count,
    paid: s.paid + m.paid, unpaid: s.unpaid + m.unpaid, partial: s.partial + m.partial, marginSum: s.marginSum + m.marginSum,
  }), { revenue: 0, prjExp: 0, mntExp: 0, pyExp: 0, totalExp: 0, net: 0, count: 0, paid: 0, unpaid: 0, partial: 0, marginSum: 0 });
  const avgMargin = t.count ? t.marginSum / t.count : 0;
  return [
    ["Finance Dashboard — all figures in USD (EGP converted at " + EGP_PER_USD + ")", ""],
    ["Total Revenue", t.revenue], ["Total Expenses", t.totalExp], ["Net Profit", t.net],
    ["Average Margin %", +avgMargin.toFixed(1)], ["Total Projects", t.count],
    ["Paid Projects", t.paid], ["Outstanding Projects", t.unpaid], ["Partially Paid Projects", t.partial],
    ["Maintenance Expenses", t.mntExp], ["Payroll Expenses", t.pyExp],
    ["", ""],
    ["Month", "Revenue", "Project Costs", "Maintenance", "Payroll", "Total Expenses", "Net", "Avg Margin %", "Projects", "Paid", "Unpaid"],
    ...months.map((m) => [m.key, m.revenue, m.prjExp, m.mntExp, m.pyExp, m.totalExp, m.net, +m.avgMargin.toFixed(1), m.count, m.paid, m.unpaid]),
  ];
}

// ---- workbook builder ------------------------------------------------
function frBuildWorkbook(db, atts, me, xlsxName) {
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();
  const sheetCounts = [];
  const add = (name, aoa) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = (aoa[0] || []).map((h, i) => ({ wch: Math.min(46, Math.max(13, ...aoa.slice(0, 60).map((r) => String(r[i] == null ? "" : r[i]).length + 2))) }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    sheetCounts.push([name, Math.max(0, aoa.length - 1)]);
  };

  const svcName = (id) => { const s = (db.services || []).find((x) => x.id === id); return s ? s.name : id; };
  const taskByCode = {}; (db.tasks || []).forEach((t) => { taskByCode[t.id] = t; });
  const portalCodes = new Set((db.users || []).filter((u) => u.linkedClientCode).map((u) => u.linkedClientCode));

  // -- Company Capital + Finance Dashboard -----------------------------
  frCapitalAoAs(db).forEach(([n, aoa]) => add(n, aoa));
  add("Finance Dashboard", frFinanceAoA(db));

  // -- Finance --------------------------------------------------------
  add("Client Invoices", frSheet(db.clientInvoices, [
    ["Invoice Code", (i) => i.invoice_code], ["Task Code", (i) => i.task_code], ["Client Code", (i) => i.client_code],
    ["Total", (i) => i.total_price], ["Deposit (20%)", (i) => i.payment_20], ["Deposit Date", (i) => i.date_20],
    ["Remaining (80%)", (i) => i.payment_80], ["Remaining Date", (i) => i.date_80],
    ["Status", (i) => i.status], ["Currency", (i) => i.currency], ["Attachments", (i) => (i.media || []).length]]));
  add("Freelancer Invoices", frSheet(db.freelancerInvoices, [
    ["Invoice Code", (i) => i.invoice_code], ["Task Code", (i) => i.task_code], ["Freelancer Code", (i) => i.freelancer_code],
    ["Total", (i) => i.total_price], ["Deposit", (i) => i.payment_20], ["Deposit Date", (i) => i.date_20],
    ["Remaining", (i) => i.payment_80], ["Remaining Date", (i) => i.date_80],
    ["Status", (i) => i.status], ["Currency", (i) => i.currency], ["PO Number", (i) => i.po_number], ["Attachments", (i) => (i.media || []).length]]));
  add("Projects Ledger", frSheet(db.projects, [
    ["Project ID", (p) => p.project_id], ["Task Code", (p) => p.task_code], ["Date", (p) => p.date],
    ["Client", (p) => p.client_name], ["PM", (p) => p.pm_name], ["Service", (p) => p.service_type],
    ["Language Pair", (p) => p.language_pair], ["Specialization", (p) => p.specialization],
    ["Volume", (p) => p.volume], ["Unit", (p) => p.unit], ["Client Rate", (p) => p.client_rate],
    ["Client Amount", (p) => (+p.volume || 0) * (+p.client_rate || 0)],
    ["Freelancer", (p) => p.freelancer], ["FL Rate", (p) => p.fl_rate],
    ["FL Cost", (p) => (+p.volume || 0) * (+p.fl_rate || 0)],
    ["Profit", (p) => (+p.volume || 0) * ((+p.client_rate || 0) - (+p.fl_rate || 0))],
    ["Deadline", (p) => p.deadline], ["Status", (p) => p.status], ["Invoice No", (p) => p.invoice_no],
    ["Payment Status", (p) => p.payment_status], ["Notes", (p) => p.notes]]));
  add("Payments", frSheet(db.payments, [
    ["Pay ID", (p) => p.pay_id], ["Date", (p) => p.date], ["Party", (p) => p.party], ["Type", (p) => p.type],
    ["Project ID", (p) => p.project_id], ["Invoice No", (p) => p.invoice_no], ["Amount", (p) => p.amount],
    ["Currency", (p) => p.currency], ["Method", (p) => p.method], ["Notes", (p) => p.notes]]));
  add("Payroll", frSheet(db.payroll, [
    ["Payroll ID", (r) => r.payroll_id || r.id], ["Employee Code", (r) => r.employee_code], ["Name", (r) => r.name],
    ["Month", (r) => r.month], ["Salary", (r) => r.salary], ["Currency", (r) => r.currency],
    ["Method", (r) => r.payment_method], ["Status", (r) => r.status], ["Paid Date", (r) => r.paid_date],
    ["Generated At", (r) => r.generated_at], ["Notes", (r) => r.notes]]));
  add("Maintenance", frSheet(db.maintenance, [
    ["Maintenance ID", (m) => m.maintenance_id], ["Service", (m) => m.service_name], ["Vendor", (m) => m.vendor],
    ["Amount", (m) => m.amount], ["Currency", (m) => m.currency], ["Payment Date", (m) => m.payment_date],
    ["Method", (m) => m.payment_method], ["Status", (m) => m.status], ["Billing Cycle", (m) => m.billing_cycle],
    ["Renewal Date", (m) => m.renewal_date], ["Notes", (m) => m.notes]]));

  // -- Tasks ----------------------------------------------------------
  const taskCols = [
    ["Task Number", (t) => t.task_number], ["Title", (t) => t.title], ["Client Code", (t) => t.client_code],
    ["Reference", (t) => t.reference_number], ["Status", (t) => t.status], ["File Status", (t) => t.file_status],
    ["Words", (t) => t.words_count], ["Pages", (t) => t.page_numbers],
    ["Start", (t) => t.start_date], ["End", (t) => t.end_date],
    ["Languages", (t) => frLangPairs(t.language_pair)], ["Freelancers", (t) => (t.freelancer_codes || []).join(", ")],
    ["Services", (t) => (t.service_ids || []).map(svcName).join(", ")],
    ["Creator", (t) => t.creator], ["Created", (t) => t.created_at], ["Notes", (t) => t.notes], ["Files", (t) => (t.media || []).length]];
  add("Tasks", frSheet(db.tasks, taskCols));
  add("Task Files History", frSheet((db.tasks || []).flatMap((t) => (t.media || []).map((f) => ({ t, f }))), [
    ["Task Number", (x) => x.t.task_number], ["Client Code", (x) => x.t.client_code], ["File Name", (x) => x.f.original_name || x.f.name],
    ["File Status", (x) => x.f.file_status], ["Note", (x) => x.f.note], ["Created", (x) => x.f.created_at],
    ["Updated", (x) => x.f.updated_at], ["Stored Content", (x) => (frDataUrlB64(x.f.data) ? "Yes — in ZIP" : "Metadata only")]]));
  add("Task Freelancer POs", frSheet([
    ...(db.vendorPOs || []).map((p) => ({ ...p, _side: "Freelancer PO", _party: p.freelancer_code })),
    ...(db.clientPOs || []).map((p) => ({ ...p, _side: "Client PO", _party: "" }))], [
    ["Type", (p) => p._side], ["PO Number", (p) => p.po_number],
    ["Task Number", (p) => (taskByCode[p.task_id] || {}).task_number || p.task_id],
    ["Party Code", (p) => p._party], ["Amount", (p) => p.amount], ["Currency", (p) => p.currency],
    ["Date", (p) => p.date], ["Notes", (p) => p.notes]]));
  add("Task Project Progress", frSheet((db.tasks || []).flatMap((t) => (t.workflowStages || []).map((s) => ({ t, s }))), [
    ["Task Number", (x) => x.t.task_number], ["Stage #", (x) => x.s.n], ["Stage", (x) => x.s.name], ["Status", (x) => x.s.status],
    ["Started", (x) => x.s.started], ["Completed", (x) => x.s.completed], ["Owner", (x) => x.s.owner],
    ["Updated By", (x) => x.s.updated_by], ["Updated At", (x) => x.s.updated_at],
    ["Client Note", (x) => x.s.client_note], ["Internal Note", (x) => x.s.internal_note]]));
  const quoteRows = (db.projectRequests || []).filter((r) => r.quote);
  const quoteCols = [
    ["Project", (r) => r.project_name], ["Client Code", (r) => r.client_code],
    ["Requested By", (r) => `${frV(r.first_name)} ${frV(r.last_name)}`.trim()], ["Email", (r) => r.email],
    ["Amount", (r) => r.quote.amount], ["Currency", (r) => r.quote.currency], ["Valid Until", (r) => r.quote.valid_until],
    ["Status", (r) => r.status], ["Sent By", (r) => r.quote.sent_by], ["Sent At", (r) => r.quote.sent_at],
    ["Accepted At", (r) => r.quote.accepted_at], ["Client Note", (r) => r.quote.client_note]];
  add("Task Quotes & Approvals", frSheet(quoteRows, quoteCols));

  // -- People ---------------------------------------------------------
  add("Freelancers", frSheet(db.freelancers, [
    ["Code", (f) => f.freelancer_code], ["Name", (f) => f.name], ["Email", (f) => f.email], ["Phone", (f) => f.phone],
    ["Company", (f) => f.company], ["Quota", (f) => f.quota], ["Rate/hr", (f) => f.price_hr], ["Currency", (f) => f.currency],
    ["Services", (f) => (f.service_ids || []).map(svcName).join(", ")], ["Languages", (f) => frLangPairs(f.language_pair)], ["Notes", (f) => f.notes]]));
  add("Freelancer Assigned Tasks", frSheet((db.tasks || []).flatMap((t) => (t.freelancer_codes || []).map((code) => ({ t, code }))), [
    ["Freelancer Code", (x) => x.code],
    ["Freelancer", (x) => ((db.freelancers || []).find((f) => f.freelancer_code === x.code) || {}).name],
    ["Task Number", (x) => x.t.task_number], ["Title", (x) => x.t.title], ["Client Code", (x) => x.t.client_code],
    ["Status", (x) => x.t.status], ["Start", (x) => x.t.start_date], ["End", (x) => x.t.end_date]]));
  add("Freelancer Language Rates", frSheet((db.freelancers || []).flatMap((f) => (f.language_pair || []).map((lp) => ({ f, lp }))), [
    ["Freelancer Code", (x) => x.f.freelancer_code], ["Freelancer", (x) => x.f.name],
    ["Source", (x) => x.lp.source], ["Target", (x) => x.lp.target],
    ["Rate/hr", (x) => x.f.price_hr], ["Currency", (x) => x.f.currency], ["Quota", (x) => x.f.quota]]));
  add("Clients", frSheet(db.clients, [
    ["Code", (c) => c.client_code], ["Name", (c) => c.name], ["Email", (c) => c.email], ["Phone", (c) => c.phone],
    ["Agency", (c) => c.agency], ["Currency", (c) => c.currency], ["Notes", (c) => c.notes]]));
  add("Client Tasks", frSheet(db.tasks, [
    ["Client Code", (t) => t.client_code],
    ["Client", (t) => ((db.clients || []).find((c) => c.client_code === t.client_code) || {}).name],
    ["Task Number", (t) => t.task_number], ["Title", (t) => t.title], ["Status", (t) => t.status],
    ["Words", (t) => t.words_count], ["Start", (t) => t.start_date], ["End", (t) => t.end_date]]));
  add("Client Projects Ledger", frSheet(db.projects, [
    ["Client", (p) => p.client_name], ["Project ID", (p) => p.project_id], ["Task Code", (p) => p.task_code],
    ["Service", (p) => p.service_type], ["Volume", (p) => p.volume], ["Unit", (p) => p.unit],
    ["Client Amount", (p) => (+p.volume || 0) * (+p.client_rate || 0)],
    ["Status", (p) => p.status], ["Payment Status", (p) => p.payment_status], ["Invoice No", (p) => p.invoice_no]]));
  add("Client Price Services", frSheet((db.clients || []).flatMap((c) => (c.price_services || c.priceServices || []).map((s) => ({ c, s }))), [
    ["Client Code", (x) => x.c.client_code], ["Client", (x) => x.c.name],
    ["Service", (x) => x.s.name || x.s.service || svcName(x.s.service_id)],
    ["Unit", (x) => x.s.unit], ["Rate", (x) => x.s.rate || x.s.price], ["Currency", (x) => x.s.currency || x.c.currency], ["Notes", (x) => x.s.notes]]));
  add("Client Files", frSheet((db.tasks || []).flatMap((t) => (t.media || []).map((f) => ({ t, f }))), [
    ["Client Code", (x) => x.t.client_code],
    ["Client", (x) => ((db.clients || []).find((c) => c.client_code === x.t.client_code) || {}).name],
    ["Task Number", (x) => x.t.task_number], ["File Name", (x) => x.f.original_name || x.f.name],
    ["Status", (x) => x.f.file_status], ["Uploaded", (x) => x.f.created_at]]));
  add("Employees", frSheet(db.employees, [
    ["Code", (e) => e.employee_code], ["Name", (e) => e.name], ["Job Title", (e) => e.job_title],
    ["Email", (e) => e.email], ["Phone", (e) => e.phone], ["Department", (e) => e.department],
    ["Type", (e) => e.employment_type], ["Start Date", (e) => e.start_date], ["Salary", (e) => e.salary],
    ["Currency", (e) => e.currency], ["Method", (e) => e.payment_method], ["Status", (e) => e.status], ["Notes", (e) => e.notes]]));

  // -- Requests & messages ---------------------------------------------
  const reqCols = [
    ["Project", (r) => r.project_name], ["Name", (r) => `${frV(r.first_name)} ${frV(r.last_name)}`.trim()],
    ["Email", (r) => r.email], ["Client Code", (r) => r.client_code], ["Source", (r) => r.source || "Website"],
    ["From", (r) => r.source_language], ["To", (r) => r.target_language], ["Payment", (r) => r.preferred_payment_type],
    ["Currency", (r) => r.currency], ["Start", (r) => r.start_date], ["End", (r) => r.end_date],
    ["Status", (r) => r.status], ["Created", (r) => r.created_at], ["Description", (r) => r.description], ["Files", (r) => (r.media || []).length]];
  add("Price Requests", frSheet(db.projectRequests, reqCols));
  add("Contact Messages", frSheet(db.contactMessages, [
    ["Name", (m) => m.name], ["Email", (m) => m.email], ["Subject", (m) => m.subject],
    ["Message", (m) => m.message], ["Received", (m) => m.created_at]]));

  // -- Calculator rate cards -------------------------------------------
  add("Calculator Language Rates", frSheet(db.langRates, [
    ["Language", (l) => l.name], ["Category", (l) => l.category], ["Low", (l) => l.low], ["Average", (l) => l.average], ["High", (l) => l.high]]));
  add("Calculator Service Rates", frSheet(db.serviceRates, [
    ["Group", (s) => s.group], ["Service", (s) => s.name], ["Unit", (s) => s.unit],
    ["Low", (s) => s.low], ["Average", (s) => s.average], ["High", (s) => s.high], ["Notes", (s) => s.notes]]));

  // -- Client Portal ----------------------------------------------------
  add("Client Portal Projects", frSheet((db.tasks || []).filter((t) => portalCodes.has(t.client_code)), taskCols));
  const portalReqs = (db.projectRequests || []).filter((r) => r.source === "Client Portal");
  add("Client Portal Quote Requests", frSheet(portalReqs, reqCols));
  add("Portal Quotes & Approvals", frSheet(portalReqs.filter((r) => r.quote), quoteCols));
  add("Client Portal Messages", frSheet((db.contactMessages || []).filter((m) => m.source === "Client Portal" || m.client_code), [
    ["Name", (m) => m.name], ["Email", (m) => m.email], ["Client Code", (m) => m.client_code],
    ["Subject", (m) => m.subject], ["Message", (m) => m.message], ["Received", (m) => m.created_at]]));

  // -- System Users & Roles (reference only — NEVER deleted by reset) ---
  add("System Users", frSheet(db.users, [
    ["ID", (u) => u.id], ["Name", (u) => u.name], ["Email", (u) => u.email], ["Role", (u) => u.role],
    ["Status", (u) => u.status], ["Phone", (u) => u.phone], ["Linked Client Code", (u) => u.linkedClientCode],
    ["Created", (u) => u.created_at], ["Note", () => "Reference only — users are NOT deleted by the reset"]]));
  add("Roles & Permissions", frSheet(db.roles, [
    ["ID", (r) => r.id], ["Role", (r) => r.name], ["Permissions", (r) => (r.permissions || []).join(", ")],
    ["Created", (r) => r.created_at], ["Note", () => "Reference only — roles are NOT deleted by the reset"]]));

  // -- Attachments Index -------------------------------------------------
  add("Attachments Index", frSheet(atts, [
    ["File Name", (a) => a.name], ["File Type", (a) => frFileType(a.name)], ["Original Module", (a) => a.module],
    ["Linked Record Code", (a) => a.record], ["Linked Client Code", (a) => a.client], ["Linked Task Code", (a) => a.task],
    ["Upload Date", (a) => a.date], ["Attachment Path inside ZIP", (a) => a.zipPath],
    ["Notes", (a) => a.b64 ? (a.note || "Original file included in ZIP.") : `${a.note ? a.note + " · " : ""}Demo record — original file content was not stored; placeholder included.`]]));

  // -- Backup Summary (built last, inserted first) -----------------------
  const summary = [["Words Tie — Full Test Data Backup", ""],
    ["Generated At", new Date().toISOString()],
    ["Generated By", `${me.name} (${me.email || ""})`],
    ["Workbook File", xlsxName],
    ["Attachments In ZIP", atts.length],
    ["", ""],
    ["Included Sheet", "Rows"],
    ...sheetCounts,
    ["", ""],
    ["Reference-only sheets (never deleted)", "System Users, Roles & Permissions"],
    ["Never deleted by the reset", "Users, Roles, Permissions, Login accounts, App settings, Services list, Industries, Website content"]];
  const ws = XLSX.utils.aoa_to_sheet(summary);
  ws["!cols"] = [{ wch: 36 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws, "Summary");
  wb.SheetNames.unshift(wb.SheetNames.pop()); // move Summary to front
  return wb;
}

// ---- full backup ZIP --------------------------------------------------
async function frGenerateBackup(me) {
  if (typeof can === "function" && !can(DB.get(), "Export Full Backup")) { const e = new Error("You do not have permission to perform this action."); e.code = "forbidden"; throw e; }
  await Promise.all([frLoadLib("xlsx"), frLoadLib("jszip")]);
  const db = DB.get();
  const stamp = frStamp();
  const xlsxName = "data_backup.xlsx";
  const zipName = `WordsTie_TestData_Backup_${stamp}.zip`;
  const atts = frCollectAttachments(db);
  const wb = frBuildWorkbook(db, atts, me, xlsxName);
  const wbout = window.XLSX.write(wb, { bookType: "xlsx", type: "array" });

  const zip = new window.JSZip();
  zip.file(xlsxName, wbout);
  ["tasks", "client-invoices", "freelancer-invoices", "clients", "employees", "maintenance", "price-requests", "contact-messages", "client-portal"].forEach((f) => zip.folder("attachments/" + f));
  atts.forEach((a) => {
    if (a.b64) zip.file(a.zipPath, a.b64, { base64: true });
    else zip.file(a.zipPath, `PLACEHOLDER\n\nOriginal file: ${a.name}\nModule: ${a.module}\nLinked record: ${a.record || "—"}\nUpload date: ${a.date || "—"}\n\nThis demo/test record stored only file metadata, not the file content itself,\nso a placeholder was exported. See the "Attachments Index" sheet in ${xlsxName}.`);
  });
  zip.file("raw-data.json", JSON.stringify({ exported_at: new Date().toISOString(), exported_by: me.name, app: "Words Tie Dashboard", data: db }, null, 2));
  zip.file("README.txt", `WORDS TIE — FULL TEST DATA BACKUP\nGenerated: ${new Date().toISOString()}\nBy: ${me.name}\n\nContents:\n  · ${xlsxName} — one sheet per module (see "Summary" sheet)\n  · /attachments/** — uploaded files as real files (PDFs, images, etc. are\n    never embedded inside Excel; the workbook references them via the\n    "Attachments Index" sheet)\n  · raw-data.json — full raw snapshot of the app state (extra safety backup)\n\nUsers, roles, permissions, login accounts and app settings are not part of\nthe reset; they are included in the Excel for reference only.`);

  const blob = await zip.generateAsync({ type: "blob" });
  frDownloadBlob(blob, zipName);
  return { zipName, xlsxName, attachments: atts.length, sheets: wb.SheetNames.length };
}

// ---- professional ExcelJS styling for the Company Capital backup ------
// Only the Company Capital backup workbook uses this. The full test-data
// backup keeps its existing SheetJS path untouched.
const FR_XL = {
  argb: {
    titleBg: "FF0A4FD6", headerBg: "FF1A6BFF", white: "FFFFFFFF",
    band: "FFF3F7FF", border: "FFD9E1F2", ink: "FF1F2733", muted: "FF6B7280",
    okT: "FF0F7A58", okBg: "FFDCF5EC", danT: "FFB42535", danBg: "FFFBE4E6",
    infoT: "FF0F6E9E", infoBg: "FFD9F0FB", grayT: "FF55606E", grayBg: "FFECEEF1",
    accent2: "FF0A4FD6", accentSoft: "FFE7EFFF",
  },
  egp: '#,##0.00" EGP"', usd: '"$"#,##0.00', rate: "#,##0.0000",
};
function frCol(n) { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
function frBorder(cell, argb) { const s = { style: "thin", color: { argb } }; cell.border = { top: s, bottom: s, left: s, right: s }; }
const frNumOrBlank = (v) => { if (v === "" || v == null) return ""; const n = parseFloat(v); return isNaN(n) ? v : n; };
function frTypeSet(v) { v = String(v || "").toLowerCase();
  if (v.includes("income") || v.includes("opening") || v.includes("deposit") || v.includes("revenue") || v.includes("capital in")) return { t: FR_XL.argb.okT, bg: FR_XL.argb.okBg };
  if (v.includes("expense") || v.includes("withdraw") || v.includes("payout") || v.includes("cost")) return { t: FR_XL.argb.danT, bg: FR_XL.argb.danBg };
  if (v.includes("transfer") || v.includes("reserve")) return { t: FR_XL.argb.infoT, bg: FR_XL.argb.infoBg };
  if (v.includes("internal")) return { t: FR_XL.argb.grayT, bg: FR_XL.argb.grayBg };
  return null; }
function frDirSet(v) { v = String(v || "").toLowerCase();
  if (v === "in") return { t: FR_XL.argb.okT, bg: FR_XL.argb.okBg };
  if (v === "out") return { t: FR_XL.argb.danT, bg: FR_XL.argb.danBg };
  return null; }
function frStatusSet(v) { v = String(v || "").toLowerCase();
  if (v.includes("posted") || v.includes("export") || v.includes("complete")) return { t: FR_XL.argb.okT, bg: FR_XL.argb.okBg };
  if (v.includes("revers") || v.includes("cancel") || v.includes("fail")) return { t: FR_XL.argb.danT, bg: FR_XL.argb.danBg };
  if (v.includes("internal")) return { t: FR_XL.argb.infoT, bg: FR_XL.argb.infoBg };
  return { t: FR_XL.argb.grayT, bg: FR_XL.argb.grayBg }; }
function frTitleBlock(ws, nCols, sheetName, meta) {
  const last = frCol(nCols);
  ws.mergeCells(`A1:${last}1`);
  const t = ws.getCell("A1"); t.value = "Words Tie — Company Capital Backup";
  t.font = { name: "Calibri", bold: true, size: 16, color: { argb: FR_XL.argb.white } };
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FR_XL.argb.titleBg } };
  ws.getRow(1).height = 28;
  ws.mergeCells(`A2:${last}2`);
  const s = ws.getCell("A2"); s.value = sheetName;
  s.font = { bold: true, size: 12, color: { argb: FR_XL.argb.white } };
  s.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FR_XL.argb.headerBg } };
  ws.getRow(2).height = 20;
  ws.mergeCells(`A3:${last}3`);
  const m = ws.getCell("A3"); m.value = meta;
  m.font = { size: 10, italic: true, color: { argb: FR_XL.argb.muted } };
  m.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
  ws.getRow(3).height = 26;
  ws.getRow(4).height = 6;
  return 5; // header row index
}
function frHeaderRow(ws, rowIdx, headers) {
  const r = ws.getRow(rowIdx);
  headers.forEach((h, i) => {
    const c = r.getCell(i + 1); c.value = h;
    c.font = { bold: true, size: 11, color: { argb: FR_XL.argb.white } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FR_XL.argb.headerBg } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    frBorder(c, FR_XL.argb.headerBg);
  });
  r.height = 22;
}
function frWriteTable(ws, hdrRow, cols, rows) {
  cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.w || 14; });
  frHeaderRow(ws, hdrRow, cols.map((c) => c.h));
  rows.forEach((row, ri) => {
    const r = ws.getRow(hdrRow + 1 + ri);
    const banded = ri % 2 === 1;
    cols.forEach((c, ci) => {
      const cell = r.getCell(ci + 1);
      const val = c.g(row);
      cell.value = (val === "" || val == null) ? null : val;
      const money = typeof c.money === "function" ? c.money(row) : c.money;
      const alignC = typeof c.align === "function" ? c.align(row) : c.align;
      if (typeof val === "number") {
        if (money === "egp") cell.numFmt = FR_XL.egp;
        else if (money === "usd") cell.numFmt = FR_XL.usd;
        else if (money === "cur") cell.numFmt = (String(row.currency).toUpperCase() === "USD") ? FR_XL.usd : FR_XL.egp;
        else if (c.fmt) cell.numFmt = c.fmt;
      }
      const horiz = alignC || (typeof val === "number" ? "right" : "left");
      cell.alignment = { vertical: "middle", horizontal: horiz, wrapText: !!c.wrap, indent: horiz === "left" ? 1 : 0 };
      let badge = null;
      if (c.kind === "type") badge = frTypeSet(val);
      else if (c.kind === "dir") badge = frDirSet(val);
      else if (c.kind === "status") badge = frStatusSet(val);
      if (badge) {
        cell.font = { bold: true, size: 10, color: { argb: badge.t } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: badge.bg } };
      } else {
        let color = FR_XL.argb.ink, bold = !!c.bold;
        if (c.signed && typeof val === "number") { color = val < 0 ? FR_XL.argb.danT : (val > 0 ? FR_XL.argb.okT : FR_XL.argb.ink); bold = true; }
        cell.font = { size: 10, bold, color: { argb: color } };
        if (banded) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FR_XL.argb.band } };
      }
      frBorder(cell, FR_XL.argb.border);
    });
    r.height = cols.some((c) => c.wrap) ? 30 : 18;
  });
  ws.autoFilter = { from: { row: hdrRow, column: 1 }, to: { row: hdrRow, column: cols.length } };
}

// ---- capital-only backup ZIP (used by the Company Capital reset) -------
async function frGenerateCapitalBackup(me) {
  if (typeof can === "function" && !can(DB.get(), "Export Company Capital Backup")) { const e = new Error("You do not have permission to perform this action."); e.code = "forbidden"; throw e; }
  await Promise.all([frLoadLib("exceljs"), frLoadLib("jszip")]);
  const ExcelJS = window.ExcelJS;
  const db = DB.get();
  const stamp = frStamp();
  const zipName = `WordsTie_CompanyCapital_Backup_${stamp}.zip`;

  // ---- shared report meta -------------------------------------------
  const now = new Date(), p = (n) => String(n).padStart(2, "0");
  const exp = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()} ${p(now.getHours())}:${p(now.getMinutes())}`;
  const baseCur = (db.capitalMeta && db.capitalMeta.base_currency) || "EGP";
  const meta = `Exported: ${exp}     •     Base currency: ${baseCur}     •     Generated by: ${(me && me.name) || "—"}`;

  // ---- computed figures (same source as the live module) ------------
  let C = { opening: 0, cashIn: 0, cashOut: 0, net: 0, total: 0, emergency: 0, temporary: 0, available: 0, remainingDue: 0 };
  try { if (window.Capital && Capital.compute) C = { ...C, ...Capital.compute() }; } catch (e) {}
  const ledger = db.capitalLedger || [];
  const bySrc = {};
  ledger.forEach((t) => {
    if (t.status !== "Posted") return;
    const k = t.source || t.type;
    bySrc[k] = bySrc[k] || { in: 0, out: 0, n: 0 };
    if (t.direction === "In") bySrc[k].in += +t.base_amount || 0;
    if (t.direction === "Out") bySrc[k].out += +t.base_amount || 0;
    bySrc[k].n++;
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = (me && me.name) || "Words Tie"; wb.created = new Date();
  const view = (y) => [{ state: "frozen", ySplit: y, showGridLines: false }];

  // ---- Sheet 1: Company Capital KPIs (summary dashboard) ------------
  const ws1 = wb.addWorksheet("Company Capital KPIs", { views: view(5) });
  frTitleBlock(ws1, 2, "Company Capital KPIs", meta);
  frWriteTable(ws1, 5, [
    { h: "Metric", g: (r) => r.metric, w: 34, bold: true },
    { h: "Amount (EGP base)", g: (r) => frNumOrBlank(r.amount), w: 26, money: "egp", signed: true },
  ], [
    { metric: "Current Total Capital", amount: C.total },
    { metric: "Available Balance", amount: C.available },
    { metric: "Emergency Reserve", amount: C.emergency },
    { metric: "Temporary Reserve", amount: C.temporary },
    { metric: "Total Cash In", amount: C.cashIn },
    { metric: "Total Cash Out", amount: C.cashOut },
    { metric: "Net Movement", amount: C.net },
    { metric: "Remaining Due", amount: C.remainingDue },
    { metric: "Opening Capital", amount: C.opening },
  ]);

  // ---- Sheet 2: Capital Transactions (financial ledger) -------------
  const txCols = [
    { h: "Txn Code", g: (t) => t.txn_code, w: 14 },
    { h: "Date", g: (t) => t.date, w: 12, align: "center" },
    { h: "Type", g: (t) => t.type, w: 13, kind: "type", align: "center" },
    { h: "Direction", g: (t) => t.direction, w: 10, kind: "dir", align: "center" },
    { h: "Source", g: (t) => t.source, w: 16 },
    { h: "Reference", g: (t) => t.reference, w: 16 },
    { h: "Description", g: (t) => t.description, w: 38, wrap: true },
    { h: "Amount", g: (t) => frNumOrBlank(t.amount), w: 14, money: "cur" },
    { h: "Currency", g: (t) => t.currency, w: 9, align: "center" },
    { h: "Rate", g: (t) => frNumOrBlank(t.rate), w: 9, fmt: FR_XL.rate },
    { h: "Base (EGP)", g: (t) => frNumOrBlank(t.base_amount), w: 16, money: "egp" },
    { h: "Reserve", g: (t) => t.reserve, w: 12, align: "center" },
    { h: "Reserve Direction", g: (t) => t.reserve_dir, w: 14, align: "center" },
    { h: "Status", g: (t) => t.status, w: 12, kind: "status", align: "center" },
    { h: "Created By", g: (t) => t.created_by, w: 16 },
    { h: "Posted At", g: (t) => t.posted_at, w: 18 },
    { h: "Reason", g: (t) => t.reason, w: 26, wrap: true },
    { h: "Notes", g: (t) => t.notes, w: 30, wrap: true },
  ];
  const ws2 = wb.addWorksheet("Capital Transactions", { views: view(5) });
  frTitleBlock(ws2, txCols.length, "Capital Transactions", meta);
  frWriteTable(ws2, 5, txCols, ledger);

  // ---- Sheet 3: Capital Breakdown (sectioned summary) ---------------
  const ws3 = wb.addWorksheet("Capital Breakdown", { views: view(5) });
  frTitleBlock(ws3, 5, "Capital Breakdown", meta);
  [30, 16, 16, 16, 14].forEach((w, i) => (ws3.getColumn(i + 1).width = w));
  frHeaderRow(ws3, 5, ["Source", "Cash In (EGP)", "Cash Out (EGP)", "Net (EGP)", "Transactions"]);
  let row = 6;
  const srcKeys = Object.keys(bySrc);
  const writeBreakdownRow = (vals, opts) => {
    opts = opts || {};
    const r = ws3.getRow(row++);
    vals.forEach((v, ci) => {
      const cell = r.getCell(ci + 1);
      cell.value = (v === "" || v == null) ? null : v;
      if (ci >= 1 && ci <= 3 && typeof v === "number") cell.numFmt = FR_XL.egp;
      cell.alignment = { vertical: "middle", horizontal: ci === 0 ? "left" : (ci === 4 ? "center" : "right"), indent: ci === 0 ? 1 : 0 };
      let color = FR_XL.argb.ink, bold = !!opts.bold;
      if (ci === 3 && typeof v === "number") { color = v < 0 ? FR_XL.argb.danT : FR_XL.argb.okT; bold = true; }
      if (opts.total) color = FR_XL.argb.accent2;
      cell.font = { size: 10, bold: bold || opts.total, color: { argb: color } };
      if (opts.total) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FR_XL.argb.accentSoft } };
      else if (opts.band) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FR_XL.argb.band } };
      frBorder(cell, FR_XL.argb.border);
    });
    r.height = 18;
  };
  srcKeys.forEach((k, ri) => writeBreakdownRow([k, bySrc[k].in, bySrc[k].out, bySrc[k].in - bySrc[k].out, bySrc[k].n], { band: ri % 2 === 1 }));
  const tot = { in: 0, out: 0, n: 0 };
  srcKeys.forEach((k) => { tot.in += bySrc[k].in; tot.out += bySrc[k].out; tot.n += bySrc[k].n; });
  writeBreakdownRow(["Total Capital Sources", tot.in, tot.out, tot.in - tot.out, tot.n], { total: true });
  ws3.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: 5 } };

  // section: reserve & balance summary
  ws3.getRow(row++).height = 6;
  const secNum = row;
  ws3.mergeCells(`A${secNum}:E${secNum}`);
  const sc = ws3.getCell(`A${secNum}`); sc.value = "Reserve & Balance Summary";
  sc.font = { bold: true, size: 11, color: { argb: FR_XL.argb.accent2 } };
  sc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FR_XL.argb.accentSoft } };
  sc.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws3.getRow(row++).height = 20;
  const sumRows = [
    ["Emergency Reserve", C.emergency], ["Temporary Reserve", C.temporary],
    ["Total Cash In", C.cashIn], ["Total Cash Out", C.cashOut],
    ["Net Movement", C.net], ["Remaining Due", C.remainingDue],
    ["Available Balance", C.available], ["Current Total Capital", C.total],
  ];
  sumRows.forEach((sr, ri) => {
    const r = ws3.getRow(row++);
    const band = ri % 2 === 1;
    const strong = sr[0] === "Available Balance" || sr[0] === "Current Total Capital";
    const label = r.getCell(1); label.value = sr[0];
    label.font = { size: 10, bold: true, color: { argb: strong ? FR_XL.argb.accent2 : FR_XL.argb.ink } };
    label.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    const val = r.getCell(4); val.value = sr[1]; val.numFmt = FR_XL.egp;
    val.font = { size: 10, bold: strong, color: { argb: sr[1] < 0 ? FR_XL.argb.danT : (strong ? FR_XL.argb.accent2 : FR_XL.argb.ink) } };
    val.alignment = { vertical: "middle", horizontal: "right" };
    [1, 2, 3, 4, 5].forEach((ci) => { const c = r.getCell(ci); if (band) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FR_XL.argb.band } }; frBorder(c, FR_XL.argb.border); });
    r.height = 18;
  });

  // ---- ZIP (unchanged behavior) -------------------------------------
  const buf = await wb.xlsx.writeBuffer();
  const zip = new window.JSZip();
  zip.file("capital_backup.xlsx", buf);
  zip.file("raw-data.json", JSON.stringify({ exported_at: new Date().toISOString(), exported_by: me && me.name, capitalLedger: db.capitalLedger || [], capitalMeta: db.capitalMeta || {}, companyCapital: db.companyCapital || {} }, null, 2));
  const blob = await zip.generateAsync({ type: "blob" });
  frDownloadBlob(blob, zipName);
  return { zipName };
}

// ---- Programmatic invoice PDF (real vector PDF via jsPDF — NOT a print
// screen). Lays out the same fields as the on-screen Freelancer Invoice
// template and returns an ArrayBuffer. ----
function frBuildInvoicePdf(inv, db) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const blue = [26, 107, 255], blueDk = [10, 79, 214], ink = [20, 30, 45], muted = [120, 130, 145], line = [225, 225, 232], tint = [244, 247, 255];
  const fr = (db.freelancers || []).find((x) => x.freelancer_code === inv.freelancer_code);
  const from = { name: "Words Tie", address: "Suez canal st. Mansoura, Egypt", phone: "(+20) 102467283", email: "info@words-tie.com", website: "www.words-tie.com" };
  const fmt = (s) => { if (!s) return "—"; const d = new Date(s); if (isNaN(d)) return String(s); const p = (n) => String(n).padStart(2, "0"); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`; };
  const STATUS = { pending: "Pending", in_progress: "In Progress", completed: "Completed" };
  const money = (n, c) => `${c || "USD"} ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  let y = M;
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...ink);
  doc.text("Words Tie", M, y + 8);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...muted);
  doc.text(from.address, M, y + 24);
  doc.text(`${from.phone}   ·   ${from.email}`, M, y + 35);
  doc.text(from.website, M, y + 46);

  const metaX = W - M;
  const meta = [["Invoice No.", inv.invoice_code, true], ["Task Code", inv.task_code || "—"], ["PO Number", inv.po_number || "—"], ["Date", fmt(inv.po_sent_date)], ["Status", STATUS[inv.status] || inv.status || "—"]];
  let my = y + 4;
  meta.forEach(([l, v, acc]) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...muted);
    doc.text(String(l).toUpperCase(), metaX - 132, my, { align: "right" });
    doc.setFontSize(10); doc.setTextColor(...(acc ? blueDk : ink));
    doc.text(String(v == null ? "—" : v), metaX, my, { align: "right" });
    my += 15;
  });
  y = Math.max(y + 60, my + 6);

  doc.setFillColor(...blue); doc.roundedRect(M, y, W - 2 * M, 26, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
  doc.text("FREELANCER INVOICE", W / 2, y + 18, { align: "center", charSpace: 3 });
  y += 44;

  const colW = (W - 2 * M - 14) / 2;
  const party = (x, bg, label, code, name, lines) => {
    doc.setFillColor(...bg); doc.roundedRect(x, y, colW, 80, 6, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255);
    doc.text(label.toUpperCase(), x + 14, y + 18);
    let ly = y + 34;
    if (code) { doc.setFontSize(8); doc.text(String(code), x + 14, ly); ly += 13; }
    doc.setFontSize(12); doc.text(String(name || "—"), x + 14, ly); ly += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    lines.filter(Boolean).forEach((l) => { doc.text(String(l), x + 14, ly); ly += 12; });
  };
  party(M, ink, "Supplier · Freelancer", inv.freelancer_code || "", fr ? fr.name : (inv.freelancer_code || "Freelancer"), [fr && fr.email]);
  party(M + colW + 14, blueDk, "From", "", "Words Tie For Translation & Localization", ["Suez canal st. Mansoura, Egypt"]);
  y += 80 + 22;

  doc.setFillColor(...ink); doc.rect(M, y, W - 2 * M, 24, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
  doc.text("DETAIL", M + 11, y + 16); doc.text("VALUE", W - M - 11, y + 16, { align: "right" });
  y += 24;
  const rows = [["PO Number", inv.po_number || "—"], ["PO Sent Date", fmt(inv.po_sent_date)], ["Payment Due Date", fmt(inv.payment_due_date)], ["Currency", inv.currency || "USD"]];
  rows.forEach((r, idx) => {
    if (idx % 2) { doc.setFillColor(...tint); doc.rect(M, y, W - 2 * M, 22, "F"); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...ink);
    doc.text(String(r[0]), M + 11, y + 15);
    doc.text(String(r[1]), W - M - 11, y + 15, { align: "right" });
    doc.setDrawColor(...line); doc.line(M, y + 22, W - M, y + 22);
    y += 22;
  });
  y += 14;

  const tw = 260, tx = W - M - tw;
  doc.setFillColor(...ink); doc.rect(tx, y, tw * 0.55, 30, "F");
  doc.setFillColor(...blue); doc.rect(tx + tw * 0.55, y, tw * 0.45, 30, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text("PRICE", tx + 12, y + 19);
  doc.setFontSize(13); doc.text(money(inv.total_price, inv.currency), W - M - 12, y + 19, { align: "right" });
  y += 30 + 24;

  if (inv.notes) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...blueDk);
    doc.text("NOTES", M, y); y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...muted);
    const wrapped = doc.splitTextToSize(String(inv.notes), W - 2 * M);
    doc.text(wrapped, M, y);
  }

  doc.setDrawColor(...line); doc.line(M, H - 42, W - M, H - 42);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...muted);
  doc.text(`WORDS TIE   ·   ${from.website}   ·   ${from.email}`, W / 2, H - 28, { align: "center" });

  return doc.output("arraybuffer");
}

// ---- Freelancer-Invoices backup ZIP (used by the Finance ▸ Freelancer
// Invoices reset). Professionally-styled workbook + every linked file
// attachment + a manifest. The ZIP is VERIFIED in-memory before download,
// and this function THROWS if any expected file is missing — the caller
// must never delete data unless this resolves successfully. ----
async function frGenerateFreelancerInvoiceBackup(me) {
  if (typeof can === "function" && !can(DB.get(), "Export Freelancer Invoices Backup")) { const e = new Error("You do not have permission to perform this action."); e.code = "forbidden"; throw e; }
  await Promise.all([frLoadLib("exceljs"), frLoadLib("jszip"), frLoadLib("jspdf")]);
  const ExcelJS = window.ExcelJS;
  const db = DB.get();
  const stamp = frStamp();
  const zipName = `WordsTie_FreelancerInvoices_Backup_${stamp}.zip`;
  const xlsxName = "freelancer_invoices_backup.xlsx";

  const now = new Date(), p = (n) => String(n).padStart(2, "0");
  const exp = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()} ${p(now.getHours())}:${p(now.getMinutes())}`;
  const baseCur = (db.capitalMeta && db.capitalMeta.base_currency) || "EGP";
  const meta = `Exported: ${exp}     \u2022     Base currency: ${baseCur}     \u2022     Generated by: ${(me && me.name) || "\u2014"}`;

  const invoices = db.freelancerInvoices || [];
  const tasks = db.tasks || [];
  const freelancers = db.freelancers || [];
  const pos = db.vendorPOs || [];
  const ledger = db.capitalLedger || [];
  const invTotal = (i) => +i.total_price || 0;

  // ---- linked-record sets ------------------------------------------
  const taskCodes = new Set(invoices.map((i) => i.task_code).filter(Boolean));
  const flCodes = new Set(invoices.map((i) => i.freelancer_code).filter(Boolean));
  const poNumbers = new Set(invoices.map((i) => i.po_number).filter(Boolean));
  const relTasks = tasks.filter((t) => taskCodes.has(t.task_number));
  const relFreelancers = freelancers.filter((f) => flCodes.has(f.freelancer_code));
  const relPOs = pos.filter((po) => poNumbers.has(po.po_number) || taskCodes.has(po.ref_no) || (relTasks.some((t) => t.id === po.task_id)));
  const invCodes = new Set(invoices.map((i) => i.invoice_code));
  const byCode = {}; ledger.forEach((t) => { if (t.txn_code) byCode[t.txn_code] = t; });
  const relTxns = ledger.filter((t) =>
    (t.source_type === "freelancer_invoice" && invCodes.has(String(t.source_id))) ||
    (t.source_type === "reversal" && byCode[t.source_id] && byCode[t.source_id].source_type === "freelancer_invoice" && invCodes.has(String(byCode[t.source_id].source_id))));

  // ---- attachments (media[] + single attachment), ONE FOLDER PER INVOICE ----
  // Each attachment must carry real base64 content. Metadata-only attachments
  // (no stored bytes) are recorded as FAILED so verification aborts the reset.
  const b64Bytes = (b64) => { try { return atob(b64).length; } catch (e) { return 0; } };
  const atts = [];
  invoices.forEach((i) => {
    const list = [...(i.media || [])];
    if (i.attachment) list.push(i.attachment);
    const usedInInvoice = new Set();
    list.forEach((file) => {
      const name = (file && (file.original_name || file.name)) || null;
      if (!name) return;
      const b = frDataUrlB64(file.data);
      const b64 = b ? b.b64 : null;
      const bytes = b64 ? b64Bytes(b64) : 0;
      const folder = `attachments/freelancer-invoices/${frSafeName(i.invoice_code || "unknown")}/uploaded-files`;
      let fname = frSafeName(name), n = 2;
      while (usedInInvoice.has(fname)) { const dot = fname.lastIndexOf("."); fname = dot > 0 ? `${fname.slice(0, dot)}-${n}${fname.slice(dot)}` : `${fname}-${n}`; n++; }
      usedInInvoice.add(fname);
      const ok = !!b64 && bytes > 0;
      atts.push({
        invoice_code: i.invoice_code, po_number: i.po_number || "", task_code: i.task_code || "",
        freelancer_code: i.freelancer_code || "", name, exportedName: fname,
        date: frV(file.created_at || file.uploaded_at || file.updated_at),
        status: i.status || "", b64, bytes, folder, zipPath: `${folder}/${fname}`,
        exportStatus: ok ? "Exported" : "Failed",
        notes: ok ? "" : "Attachment metadata present but no stored file content (0 bytes) — cannot export.",
      });
    });
  });
  const attFound = atts.length;

  // ---- generated invoice PDFs (one real PDF per invoice, programmatic) ----
  const genPdfs = invoices.map((i) => {
    const code = frSafeName(i.invoice_code || "invoice");
    const folder = `attachments/freelancer-invoices/${code}/generated-pdf`;
    const name = `${code}.pdf`;
    const rec = { invoice_code: i.invoice_code, po_number: i.po_number || "", task_code: i.task_code || "", freelancer_code: i.freelancer_code || "", name, folder, zipPath: `${folder}/${name}`, bytes: 0, ab: null, exportStatus: "Failed", notes: "" };
    try {
      const ab = frBuildInvoicePdf(i, db);
      rec.ab = ab; rec.bytes = ab ? ab.byteLength : 0;
      if (rec.bytes > 0) rec.exportStatus = "Exported";
      else rec.notes = "Generated PDF produced 0 bytes.";
    } catch (e) { rec.notes = "PDF generation failed: " + (e && e.message || e); }
    return rec;
  });

  // ---- KPIs ---------------------------------------------------------
  const paid = invoices.filter((i) => i.status === "completed");
  const outstanding = invoices.filter((i) => i.status !== "completed");
  const sumCur = (rows, cur) => rows.filter((i) => i.currency === cur).reduce((s, i) => s + invTotal(i), 0);
  const cashOutEGP = relTxns.filter((t) => t.source_type === "freelancer_invoice").reduce((s, t) => s + (+t.base_amount || 0), 0)
    - relTxns.filter((t) => t.source_type === "reversal").reduce((s, t) => s + (+t.base_amount || 0), 0);

  const wb = new ExcelJS.Workbook();
  wb.creator = (me && me.name) || "Words Tie"; wb.created = new Date();
  const view = (y) => [{ state: "frozen", ySplit: y, showGridLines: false }];
  const sheet = (name, nCols) => { const ws = wb.addWorksheet(name, { views: view(5) }); frTitleBlock(ws, nCols, name, meta); return ws; };

  // 1 — KPIs
  frWriteTable(sheet("Freelancer Invoice KPIs", 2), 5, [
    { h: "Metric", g: (r) => r.k, w: 36, bold: true },
    { h: "Value", g: (r) => frNumOrBlank(r.v), w: 24, money: (r) => r.m, align: (r) => r.a },
  ].map((c) => c), buildKpiRows());
  function buildKpiRows() { return [
    { k: "Total Freelancer Invoices", v: invoices.length, a: "right" },
    { k: "Paid (Completed) Invoices", v: paid.length, a: "right" },
    { k: "Outstanding Invoices", v: outstanding.length, a: "right" },
    { k: "Total Paid (USD)", v: sumCur(paid, "USD"), m: "usd" },
    { k: "Total Paid (EGP)", v: sumCur(paid, "EGP"), m: "egp" },
    { k: "Total Outstanding (USD)", v: sumCur(outstanding, "USD"), m: "usd" },
    { k: "Total Outstanding (EGP)", v: sumCur(outstanding, "EGP"), m: "egp" },
    { k: "Linked Capital Cash-Out (EGP base)", v: cashOutEGP, m: "egp" },
    { k: "Linked Company Capital Transactions", v: relTxns.length, a: "right" },
    { k: "Linked File Attachments", v: atts.length, a: "right" },
    { k: "Generated Invoice PDFs", v: invoices.length, a: "right" },
  ]; }

  // 2 — Freelancer Invoices
  frWriteTable(sheet("Freelancer Invoices", 9), 5, [
    { h: "Invoice Code", g: (i) => i.invoice_code, w: 18 },
    { h: "PO Number", g: (i) => i.po_number || "", w: 15 },
    { h: "Task Code", g: (i) => i.task_code || "", w: 14 },
    { h: "Freelancer Code", g: (i) => i.freelancer_code || "", w: 16 },
    { h: "PO Sent Date", g: (i) => i.po_sent_date || "", w: 14, align: "center" },
    { h: "Payment Due Date", g: (i) => i.payment_due_date || "", w: 16, align: "center" },
    { h: "Price", g: (i) => frNumOrBlank(i.total_price), w: 14, money: "cur" },
    { h: "Currency", g: (i) => i.currency, w: 10, align: "center" },
    { h: "Status", g: (i) => i.status, w: 14, kind: "status", align: "center" },
  ], invoices);

  // 3 — Freelancer Invoice Details (deposit / remaining breakdown)
  frWriteTable(sheet("Freelancer Invoice Details", 9), 5, [
    { h: "Invoice Code", g: (i) => i.invoice_code, w: 18 },
    { h: "Task Code", g: (i) => i.task_code || "", w: 14 },
    { h: "Freelancer Code", g: (i) => i.freelancer_code || "", w: 16 },
    { h: "Deposit Date", g: (i) => i.date_20 || "", w: 14, align: "center" },
    { h: "Deposit Amount", g: (i) => frNumOrBlank(i.payment_20), w: 15, money: "cur" },
    { h: "Remaining Date", g: (i) => i.date_80 || "", w: 14, align: "center" },
    { h: "Remaining Amount", g: (i) => frNumOrBlank(i.payment_80), w: 16, money: "cur" },
    { h: "Total Price", g: (i) => frNumOrBlank(i.total_price), w: 14, money: "cur" },
    { h: "Notes", g: (i) => i.notes || "", w: 34, wrap: true },
  ], invoices);

  // 4 — Related Freelancer POs
  frWriteTable(sheet("Related Freelancer POs", 7), 5, [
    { h: "PO Number", g: (po) => po.po_number, w: 16 },
    { h: "Task Code", g: (po) => po.ref_no || (relTasks.find((t) => t.id === po.task_id) || {}).task_number || "", w: 14 },
    { h: "Freelancer Code", g: (po) => po.freelancer_code || "", w: 16 },
    { h: "Amount", g: (po) => frNumOrBlank(po.amount), w: 14, money: "cur" },
    { h: "Currency", g: (po) => po.currency, w: 10, align: "center" },
    { h: "Date", g: (po) => po.date || "", w: 14, align: "center" },
    { h: "Notes", g: (po) => po.notes || "", w: 34, wrap: true },
  ], relPOs);

  // 5 — Related Tasks
  frWriteTable(sheet("Related Tasks", 6), 5, [
    { h: "Task Number", g: (t) => t.task_number, w: 16 },
    { h: "Client Code", g: (t) => t.client_code || "", w: 14 },
    { h: "Service", g: (t) => (t.service_type || (t.services || []).join(", ") || ""), w: 22 },
    { h: "Status", g: (t) => t.status || "", w: 14, align: "center" },
    { h: "Start Date", g: (t) => t.start_date || "", w: 14, align: "center" },
    { h: "End Date", g: (t) => t.end_date || "", w: 14, align: "center" },
  ], relTasks);

  // 6 — Related Freelancers
  frWriteTable(sheet("Related Freelancers", 6), 5, [
    { h: "Freelancer Code", g: (f) => f.freelancer_code, w: 16 },
    { h: "Name", g: (f) => f.name || "", w: 24 },
    { h: "Email", g: (f) => f.email || "", w: 26 },
    { h: "Company", g: (f) => f.company || "", w: 20 },
    { h: "Rate / hr", g: (f) => frNumOrBlank(f.price_hr), w: 12 },
    { h: "Currency", g: (f) => f.currency || "", w: 10, align: "center" },
  ], relFreelancers);

  // 7 — Payment / Status History (derived per invoice event)
  const history = [];
  invoices.forEach((i) => {
    if (i.date_20 || +i.payment_20) history.push({ c: i.invoice_code, e: "Deposit", d: i.date_20 || "", a: +i.payment_20 || 0, cur: i.currency, s: i.status });
    if (i.date_80 || +i.payment_80) history.push({ c: i.invoice_code, e: "Remaining", d: i.date_80 || "", a: +i.payment_80 || 0, cur: i.currency, s: i.status });
    relTxns.filter((t) => String(t.source_id) === String(i.invoice_code) && t.source_type === "freelancer_invoice")
      .forEach((t) => history.push({ c: i.invoice_code, e: "Capital Cash-Out · " + t.txn_code, d: t.date || "", a: +t.amount || 0, cur: t.currency, s: t.status }));
  });
  frWriteTable(sheet("Payment Status History", 6), 5, [
    { h: "Invoice Code", g: (r) => r.c, w: 18 },
    { h: "Event", g: (r) => r.e, w: 28 },
    { h: "Date", g: (r) => r.d, w: 14, align: "center" },
    { h: "Amount", g: (r) => frNumOrBlank(r.a), w: 14, money: "cur" },
    { h: "Currency", g: (r) => r.cur, w: 10, align: "center" },
    { h: "Status", g: (r) => r.s, w: 14, kind: "status", align: "center" },
  ], history.map((r) => ({ ...r, currency: r.cur })));

  // 8 — Related Company Capital Transactions
  frWriteTable(sheet("Related Capital Transactions", 9), 5, [
    { h: "Txn Code", g: (t) => t.txn_code, w: 14 },
    { h: "Date", g: (t) => t.date || "", w: 12, align: "center" },
    { h: "Type", g: (t) => t.type, w: 13, kind: "type", align: "center" },
    { h: "Direction", g: (t) => t.direction, w: 10, kind: "dir", align: "center" },
    { h: "Reference", g: (t) => t.reference || "", w: 16 },
    { h: "Description", g: (t) => t.description || "", w: 38, wrap: true },
    { h: "Amount", g: (t) => frNumOrBlank(t.amount), w: 14, money: "cur" },
    { h: "Base (EGP)", g: (t) => frNumOrBlank(t.base_amount), w: 16, money: "egp" },
    { h: "Status", g: (t) => t.status, w: 12, kind: "status", align: "center" },
  ], relTxns);

  // 9 — Attachment Manifest (uploaded files + generated PDFs, split by Kind)
  const manifestRows = [
    ...atts.map((a) => ({ ...a, kind: "Uploaded Attachment" })),
    ...genPdfs.map((g) => ({ ...g, kind: "Generated Invoice PDF", exportedName: g.name })),
  ];
  frWriteTable(sheet("Attachment Manifest", 11), 5, [
    { h: "Kind", g: (a) => a.kind, w: 20 },
    { h: "Invoice Code", g: (a) => a.invoice_code, w: 18 },
    { h: "PO Number", g: (a) => a.po_number, w: 13 },
    { h: "Task Code", g: (a) => a.task_code, w: 12 },
    { h: "Freelancer Code", g: (a) => a.freelancer_code, w: 14 },
    { h: "Original / File Name", g: (a) => a.name, w: 24 },
    { h: "Exported File Name", g: (a) => a.exportedName, w: 22 },
    { h: "ZIP Path", g: (a) => a.zipPath, w: 44 },
    { h: "File Size", g: (a) => frNumOrBlank(a.bytes), w: 13, fmt: '#,##0" B"' },
    { h: "Export Status", g: (a) => a.exportStatus, w: 14, kind: "status", align: "center" },
    { h: "Notes", g: (a) => a.notes || "", w: 36, wrap: true },
  ], manifestRows);

  // 10 — Generated PDFs Manifest
  frWriteTable(sheet("Generated PDFs Manifest", 9), 5, [
    { h: "Invoice Code", g: (g) => g.invoice_code, w: 18 },
    { h: "PO Number", g: (g) => g.po_number, w: 14 },
    { h: "Task Code", g: (g) => g.task_code, w: 13 },
    { h: "Freelancer Code", g: (g) => g.freelancer_code, w: 15 },
    { h: "Generated PDF Name", g: (g) => g.name, w: 24 },
    { h: "ZIP Path", g: (g) => g.zipPath, w: 44 },
    { h: "File Size", g: (g) => frNumOrBlank(g.bytes), w: 13, fmt: '#,##0" B"' },
    { h: "Export Status", g: (g) => g.exportStatus, w: 14, kind: "status", align: "center" },
    { h: "Notes", g: (g) => g.notes || "", w: 36, wrap: true },
  ], genPdfs);

  // 10 — Reset Summary / Metadata
  frWriteTable(sheet("Reset Summary", 2), 5, [
    { h: "Field", g: (r) => r.k, w: 36, bold: true },
    { h: "Value", g: (r) => r.v, w: 50, wrap: true },
  ], [
    { k: "Report", v: "Words Tie — Freelancer Invoices Backup" },
    { k: "Scope", v: "Finance ▸ Freelancer Invoices test/demo data only" },
    { k: "Generated At", v: exp },
    { k: "Generated By", v: (me && me.name) || "—" },
    { k: "Base Currency", v: baseCur },
    { k: "Workbook File", v: xlsxName },
    { k: "Freelancer Invoices", v: invoices.length },
    { k: "File Attachments", v: atts.length },
    { k: "Generated Invoice PDFs", v: invoices.length },
    { k: "Related Freelancer POs", v: relPOs.length },
    { k: "Related Tasks", v: relTasks.length },
    { k: "Related Freelancers", v: relFreelancers.length },
    { k: "Linked Capital Transactions", v: relTxns.length },
    { k: "Preserved (never deleted)", v: "Clients, Freelancers, Tasks, Client Invoices, Payroll, Maintenance, Projects Ledger, unrelated Capital entries" },
  ]);

  // ---- assemble ZIP (one folder per invoice) ------------------------
  const buf = await wb.xlsx.writeBuffer();
  const zip = new window.JSZip();
  zip.file(xlsxName, buf);
  zip.folder("attachments/freelancer-invoices");
  atts.forEach((a) => { if (a.exportStatus === "Exported") zip.file(a.zipPath, a.b64, { base64: true }); });
  genPdfs.forEach((g) => { if (g.exportStatus === "Exported" && g.ab) zip.file(g.zipPath, g.ab); });
  const exportedCount = atts.filter((a) => a.exportStatus === "Exported").length;
  const genExported = genPdfs.filter((g) => g.exportStatus === "Exported").length;

  const manifestJson = {
    exported_at: new Date().toISOString(), exported_by: me && me.name, app: "Words Tie Dashboard",
    scope: "Freelancer Invoices", workbook: xlsxName,
    attachments_found: attFound, attachments_exported: exportedCount,
    generated_pdfs_found: invoices.length, generated_pdfs_exported: genExported,
    uploaded_attachments: atts.map((a) => ({ invoice_code: a.invoice_code, po_number: a.po_number, task_code: a.task_code, freelancer_code: a.freelancer_code, original_name: a.name, exported_name: a.exportedName, zip_path: a.zipPath, file_size: a.bytes, export_status: a.exportStatus, notes: a.notes })),
    generated_pdfs: genPdfs.map((g) => ({ invoice_code: g.invoice_code, po_number: g.po_number, task_code: g.task_code, freelancer_code: g.freelancer_code, pdf_name: g.name, zip_path: g.zipPath, file_size: g.bytes, export_status: g.exportStatus, notes: g.notes })),
  };
  zip.file("manifest.json", JSON.stringify(manifestJson, null, 2));
  zip.file("raw-data.json", JSON.stringify({ exported_at: new Date().toISOString(), exported_by: me && me.name, freelancerInvoices: invoices, relatedPOs: relPOs, relatedTasks: relTasks, relatedFreelancers: relFreelancers, relatedCapitalTransactions: relTxns }, null, 2));

  // ---- VERIFY before anything can be deleted ------------------------
  // zip.files is the in-memory entry table — readable without async decode.
  const entries = zip.files || {};
  const missing = [];
  if (!entries[xlsxName]) missing.push(xlsxName);
  if (!entries["manifest.json"]) missing.push("manifest.json");
  if (!entries["attachments/freelancer-invoices/"]) missing.push("attachments/freelancer-invoices/");

  // (a) uploaded attachments — every one must be exported and > 0 bytes
  const failed = atts.filter((a) => a.exportStatus !== "Exported");
  atts.forEach((a) => {
    if (a.exportStatus !== "Exported") return;
    if (!entries[a.zipPath]) missing.push(a.zipPath);
    if (!(a.bytes > 0)) missing.push(a.zipPath + " (0 bytes)");
  });
  const manifestComplete = atts.every((a) => manifestJson.uploaded_attachments.some((m) => m.zip_path === a.zipPath));
  if (failed.length || missing.length || !manifestComplete || exportedCount !== attFound) {
    const err = new Error("Backup failed. Some Freelancer Invoice attachments were not included in the ZIP. No data was deleted.");
    err.code = "attachments_missing";
    throw err;
  }

  // (b) generated invoice PDFs — one per invoice, each present and > 0 bytes
  const genFailed = genPdfs.filter((g) => g.exportStatus !== "Exported");
  const genMissing = [];
  genPdfs.forEach((g) => {
    if (g.exportStatus !== "Exported") return;
    if (!entries[g.zipPath]) genMissing.push(g.zipPath);
    if (!(g.bytes > 0)) genMissing.push(g.zipPath + " (0 bytes)");
  });
  const genManifestComplete = genPdfs.every((g) => manifestJson.generated_pdfs.some((m) => m.zip_path === g.zipPath));
  if (genFailed.length || genMissing.length || !genManifestComplete || genExported !== invoices.length) {
    const err = new Error("Backup failed. Some generated Freelancer Invoice PDFs were not included in the ZIP. No data was deleted.");
    err.code = "generated_missing";
    throw err;
  }

  const blob = await zip.generateAsync({ type: "blob" });
  frDownloadBlob(blob, zipName);
  return {
    ok: true, zipName, xlsxName,
    invoices: invoices.length,
    attachmentsFound: attFound, attachmentsExported: exportedCount,
    generatedPdfsFound: invoices.length, generatedPdfsExported: genExported,
    attachments: attFound, embedded: exportedCount, capitalTxns: relTxns.length,
    totalBytes: atts.reduce((s, a) => s + (a.bytes || 0), 0) + genPdfs.reduce((s, g) => s + (g.bytes || 0), 0),
    verified: { workbook: true, manifest: true, folder: true, attachments: exportedCount, generatedPdfs: genExported },
  };
}

// ====================================================================
// GENERIC MODULE BACKUP + RESET ENGINE
// Powers the Reset Test Data flow for Client Invoices, Projects Ledger,
// Payroll and Maintenance — same verified-backup-before-delete contract
// as the Freelancer Invoices reset. Additive: nothing above changes.
// ====================================================================
const FR_USD_RATE = () => { try { return (DB.get().capitalMeta || {}).usd_rate || 50; } catch (e) { return 50; } };
const frToBase = (amt, cur) => (String(cur).toUpperCase() === "USD" ? (+amt || 0) * FR_USD_RATE() : (+amt || 0));
const frFmtDate = (s) => { if (!s) return "—"; const d = new Date(s); if (isNaN(d)) return String(s); const p = (n) => String(n).padStart(2, "0"); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`; };

// ---- generic branded one-page PDF (real vector PDF via jsPDF) --------
function frPdfDoc(o) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40;
  const blue = [26, 107, 255], blueDk = [10, 79, 214], ink = [20, 30, 45], muted = [120, 130, 145], line = [225, 225, 232], tint = [244, 247, 255];
  const from = { website: "www.words-tie.com", email: "info@words-tie.com" };

  let y = M;
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...ink);
  doc.text("Words Tie", M, y + 8);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...muted);
  doc.text("Suez canal st. Mansoura, Egypt", M, y + 24);
  doc.text("(+20) 102467283   ·   info@words-tie.com", M, y + 35);
  doc.text(from.website, M, y + 46);

  const metaX = W - M; let my = y + 4;
  (o.meta || []).forEach(([l, v, acc]) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...muted);
    doc.text(String(l).toUpperCase(), metaX - 150, my, { align: "right" });
    doc.setFontSize(10); doc.setTextColor(...(acc ? blueDk : ink));
    doc.text(String(v == null || v === "" ? "—" : v), metaX, my, { align: "right" });
    my += 15;
  });
  y = Math.max(y + 60, my + 6);

  doc.setFillColor(...blue); doc.roundedRect(M, y, W - 2 * M, 26, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(255, 255, 255);
  doc.text(o.title, W / 2, y + 18, { align: "center", charSpace: 3 });
  y += 44;

  const colW = (W - 2 * M - 14) / 2;
  const party = (x, bg, p) => {
    doc.setFillColor(...bg); doc.roundedRect(x, y, colW, 80, 6, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255);
    doc.text(String(p.label).toUpperCase(), x + 14, y + 18);
    let ly = y + 34;
    if (p.code) { doc.setFontSize(8); doc.text(String(p.code), x + 14, ly); ly += 13; }
    doc.setFontSize(12); doc.text(String(p.name || "—"), x + 14, ly); ly += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    (p.lines || []).filter(Boolean).forEach((l) => { doc.text(String(l), x + 14, ly); ly += 12; });
  };
  party(M, ink, o.leftParty);
  party(M + colW + 14, blueDk, o.rightParty || { label: "From", name: "Words Tie For Translation & Localization", lines: ["Suez canal st. Mansoura, Egypt"] });
  y += 80 + 22;

  doc.setFillColor(...ink); doc.rect(M, y, W - 2 * M, 24, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
  doc.text("DETAIL", M + 11, y + 16); doc.text("VALUE", W - M - 11, y + 16, { align: "right" });
  y += 24;
  (o.detailRows || []).forEach((r, idx) => {
    if (idx % 2) { doc.setFillColor(...tint); doc.rect(M, y, W - 2 * M, 22, "F"); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...ink);
    doc.text(String(r[0]), M + 11, y + 15);
    doc.text(String(r[1] == null || r[1] === "" ? "—" : r[1]), W - M - 11, y + 15, { align: "right" });
    doc.setDrawColor(...line); doc.line(M, y + 22, W - M, y + 22);
    y += 22;
  });
  y += 14;

  if (o.amountValue != null) {
    const tw = 280, tx = W - M - tw;
    doc.setFillColor(...ink); doc.rect(tx, y, tw * 0.5, 30, "F");
    doc.setFillColor(...blue); doc.rect(tx + tw * 0.5, y, tw * 0.5, 30, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
    doc.text(String(o.amountLabel || "AMOUNT"), tx + 12, y + 19);
    const amt = `${o.amountCurrency || "USD"} ${Number(o.amountValue || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    doc.setFontSize(13); doc.text(amt, W - M - 12, y + 19, { align: "right" });
    y += 30 + 24;
  }

  if (o.notes) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...blueDk);
    doc.text("NOTES", M, y); y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...muted);
    doc.text(doc.splitTextToSize(String(o.notes), W - 2 * M), M, y);
  }

  doc.setDrawColor(...line); doc.line(M, H - 42, W - M, H - 42);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...muted);
  doc.text(`WORDS TIE   ·   ${from.website}   ·   ${from.email}`, W / 2, H - 28, { align: "center" });
  return doc.output("arraybuffer");
}

// ---- per-module config ----------------------------------------------
const FR_MODULES = {
  "client-invoices": {
    label: "Client Invoices", phrase: "RESET CLIENT INVOICES", coll: "clientInvoices",
    resetPerm: "Reset Client Invoices Test Data", exportPerm: "Export Client Invoices Backup",
    code: (r) => r.invoice_code, fileBase: "client_invoices_backup", folder: "client-invoices",
    uploadedSub: "uploaded-files", folderId: (r) => r.invoice_code,
    deletes: "client invoice records, their uploaded attachments, generated invoice PDFs, and the Company Capital cash-in transactions created from them",
    mainName: "Client Invoices",
    mainCols: [
      { h: "Invoice Code", g: (i) => i.invoice_code, w: 18 },
      { h: "Task Code", g: (i) => i.task_code || "", w: 13 },
      { h: "Client Code", g: (i) => i.client_code || "", w: 14 },
      { h: "Client PO", g: (i) => i.client_po || "", w: 13 },
      { h: "Project Name", g: (i) => i.project_name || "", w: 20 },
      { h: "Deposit Date", g: (i) => i.date_20 || "", w: 13, align: "center" },
      { h: "Deposit Amount", g: (i) => frNumOrBlank(i.payment_20), w: 15, money: "cur" },
      { h: "Remaining Date", g: (i) => i.date_80 || "", w: 13, align: "center" },
      { h: "Remaining Amount", g: (i) => frNumOrBlank(i.payment_80), w: 16, money: "cur" },
      { h: "Total Price", g: (i) => frNumOrBlank(i.total_price), w: 14, money: "cur" },
      { h: "Currency", g: (i) => i.currency, w: 10, align: "center" },
      { h: "Status", g: (i) => i.status, w: 13, kind: "status", align: "center" },
      { h: "Notes", g: (i) => i.notes || "", w: 32, wrap: true },
    ],
    attachmentsOf: (r) => [...(r.media || []), ...(r.attachment ? [r.attachment] : [])],
    genPdf: (r, db) => {
      const cl = (db.clients || []).find((c) => c.client_code === r.client_code);
      return frPdfDoc({
        title: "CLIENT INVOICE", meta: [["Invoice No.", r.invoice_code, true], ["Task Code", r.task_code], ["Client Code", r.client_code], ["Date", frFmtDate(r.date_20)], ["Status", r.status]],
        leftParty: { label: "Bill To · Client", code: r.client_code, name: cl ? cl.name : (r.client_code || "Client"), lines: [cl && cl.email] },
        detailRows: [["Deposit (paid)", `${r.currency} ${Number(r.payment_20 || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`], ["Remaining", `${r.currency} ${Number(r.payment_80 || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`], ["Deposit Date", frFmtDate(r.date_20)], ["Remaining Date", frFmtDate(r.date_80)], ["Currency", r.currency]],
        amountLabel: "TOTAL", amountValue: r.total_price, amountCurrency: r.currency, notes: r.notes,
      });
    },
    related: (db, recs) => {
      const codes = new Set(recs.map((r) => r.invoice_code));
      const L = db.capitalLedger || [];
      const rows = L.filter((t) => (t.source === "Client Invoice" && codes.has(String(t.reference))) || (t.source_type === "client_invoice_adjustment" && codes.has(String(t.source_id).split(":")[0])));
      return { name: "Related Finance Data", title: "Linked Company Capital Transactions", cols: FR_CAP_COLS, rows };
    },
    capIds: (recs) => new Set(recs.map((r) => String(r.invoice_code))),
    capDirect: (t, ids) => (t.source_type === "client_invoice" && ids.has(String(t.source_id))) || (t.source_type === "client_invoice_adjustment" && ids.has(String(t.source_id).split(":")[0])),
    summary: (recs, db, ctx) => {
      const paid = recs.filter((r) => r.status === "completed");
      const sumCur = (rows, c) => rows.filter((r) => r.currency === c).reduce((s, r) => s + (+r.total_price || 0), 0);
      return [
        { k: "Total Client Invoices", v: recs.length, a: "right" },
        { k: "Completed Invoices", v: paid.length, a: "right" },
        { k: "Outstanding Invoices", v: recs.length - paid.length, a: "right" },
        { k: "Total Billed (USD)", v: sumCur(recs, "USD"), m: "usd" },
        { k: "Total Billed (EGP)", v: sumCur(recs, "EGP"), m: "egp" },
        { k: "Linked Capital Cash-In (EGP base)", v: ctx.capBase, m: "egp" },
        { k: "Linked Company Capital Transactions", v: ctx.capCount, a: "right" },
        { k: "Uploaded Attachments", v: ctx.attFound, a: "right" },
        { k: "Generated Invoice PDFs", v: recs.length, a: "right" },
      ];
    },
  },

  "projects-ledger": {
    label: "Projects Ledger", phrase: "RESET PROJECTS LEDGER", coll: "projects",
    resetPerm: "Reset Projects Ledger Test Data", exportPerm: "Export Projects Ledger Backup",
    code: (r) => r.task_code || r.project_id, fileBase: "projects_ledger_backup", folder: "projects-ledger",
    uploadedSub: "uploaded-files", folderId: (r) => r.task_code || r.project_id,
    deletes: "project ledger rows and any files attached to them (Clients, Freelancers and Tasks are never deleted)",
    mainName: "Projects Ledger",
    mainCols: [
      { h: "Task Number", g: (p) => p.task_code || "", w: 14 },
      { h: "Project ID", g: (p) => p.project_id || "", w: 16 },
      { h: "Client", g: (p) => p.client_name || "", w: 20 },
      { h: "Freelancer", g: (p) => p.freelancer || "", w: 18 },
      { h: "Service", g: (p) => p.service_type || "", w: 16 },
      { h: "Source Lang", g: (p) => String(p.language_pair || "").split(">")[0] || "", w: 11, align: "center" },
      { h: "Target Lang", g: (p) => String(p.language_pair || "").split(">")[1] || "", w: 11, align: "center" },
      { h: "Volume", g: (p) => frNumOrBlank(p.volume), w: 10 },
      { h: "Unit", g: (p) => p.unit || "", w: 9, align: "center" },
      { h: "Client Amount", g: (p) => (+p.volume || 0) * (+p.client_rate || 0), w: 14, money: "usd" },
      { h: "Freelancer Cost", g: (p) => (+p.volume || 0) * (+p.fl_rate || 0), w: 15, money: "usd" },
      { h: "Profit", g: (p) => (+p.volume || 0) * ((+p.client_rate || 0) - (+p.fl_rate || 0)), w: 13, money: "usd", signed: true },
      { h: "Margin %", g: (p) => { const ca = (+p.volume || 0) * (+p.client_rate || 0); return ca ? +(((ca - (+p.volume || 0) * (+p.fl_rate || 0)) / ca) * 100).toFixed(1) : 0; }, w: 10, fmt: '0.0"%"' },
      { h: "Payment Status", g: (p) => p.payment_status || "", w: 13, kind: "status", align: "center" },
      { h: "Project Status", g: (p) => p.status || "", w: 13, align: "center" },
      { h: "Date", g: (p) => p.date || "", w: 12, align: "center" },
      { h: "Deadline", g: (p) => p.deadline || "", w: 12, align: "center" },
      { h: "Notes", g: (p) => p.notes || "", w: 30, wrap: true },
    ],
    attachmentsOf: (r) => [...(r.media || []), ...(r.attachment ? [r.attachment] : [])],
    genPdf: (r, db) => {
      const cl = (db.clients || []).find((c) => c.name === r.client_name || c.client_code === r.client_code);
      const ca = (+r.volume || 0) * (+r.client_rate || 0), fc = (+r.volume || 0) * (+r.fl_rate || 0);
      return frPdfDoc({
        title: "PROJECT SUMMARY", meta: [["Project ID", r.project_id, true], ["Task Code", r.task_code], ["Date", frFmtDate(r.date)], ["Status", r.status], ["Payment", r.payment_status]],
        leftParty: { label: "Client", code: cl ? cl.client_code : "", name: r.client_name || "—", lines: [r.pm_name ? `PM: ${r.pm_name}` : null] },
        detailRows: [["Service", r.service_type], ["Languages", String(r.language_pair || "").replace(/>/g, " › ")], ["Volume", `${(+r.volume || 0).toLocaleString()} ${r.unit || ""}`], ["Freelancer Cost", `USD ${fc.toLocaleString("en-US", { minimumFractionDigits: 2 })}`], ["Profit", `USD ${(ca - fc).toLocaleString("en-US", { minimumFractionDigits: 2 })}`]],
        amountLabel: "CLIENT AMOUNT", amountValue: ca, amountCurrency: "USD", notes: r.notes,
      });
    },
    related: (db, recs) => {
      const taskCodes = new Set(recs.map((r) => r.task_code).filter(Boolean));
      const rows = [
        ...(db.clientInvoices || []).filter((i) => taskCodes.has(i.task_code)).map((i) => ({ kind: "Client Invoice", code: i.invoice_code, task: i.task_code, party: i.client_code, amount: i.total_price, currency: i.currency, status: i.status })),
        ...(db.freelancerInvoices || []).filter((i) => taskCodes.has(i.task_code)).map((i) => ({ kind: "Freelancer Invoice", code: i.invoice_code, task: i.task_code, party: i.freelancer_code, amount: i.total_price, currency: i.currency, status: i.status })),
      ];
      return { name: "Related Finance Data", title: "Linked Invoices (by Task Code — not deleted)", cols: [
        { h: "Kind", g: (r) => r.kind, w: 18 }, { h: "Invoice Code", g: (r) => r.code, w: 18 }, { h: "Task Code", g: (r) => r.task, w: 14 },
        { h: "Party Code", g: (r) => r.party, w: 16 }, { h: "Amount", g: (r) => frNumOrBlank(r.amount), w: 14, money: "cur" }, { h: "Currency", g: (r) => r.currency, w: 10, align: "center" }, { h: "Status", g: (r) => r.status, w: 13, kind: "status", align: "center" },
      ], rows };
    },
    capIds: () => new Set(), capDirect: () => false,
    summary: (recs, db, ctx) => {
      const usd = (p) => ({ ca: (+p.volume || 0) * (+p.client_rate || 0), fc: (+p.volume || 0) * (+p.fl_rate || 0) });
      const rev = recs.reduce((s, p) => s + usd(p).ca, 0), cost = recs.reduce((s, p) => s + usd(p).fc, 0);
      return [
        { k: "Total Projects", v: recs.length, a: "right" },
        { k: "Total Revenue (USD)", v: rev, m: "usd" },
        { k: "Total Freelancer Cost (USD)", v: cost, m: "usd" },
        { k: "Net Profit (USD)", v: rev - cost, m: "usd" },
        { k: "Average Margin %", v: rev ? +(((rev - cost) / rev) * 100).toFixed(1) : 0, a: "right" },
        { k: "Paid Projects", v: recs.filter((p) => (p.payment_status || "").toLowerCase() === "paid").length, a: "right" },
        { k: "Uploaded Attachments", v: ctx.attFound, a: "right" },
        { k: "Generated Project PDFs", v: recs.length, a: "right" },
      ];
    },
  },

  "payroll": {
    label: "Payroll", phrase: "RESET PAYROLL", coll: "payroll",
    resetPerm: "Reset Payroll Test Data", exportPerm: "Export Payroll Backup",
    code: (r) => r.payroll_id || r.id, fileBase: "payroll_backup", folder: "payroll",
    uploadedSub: "receipts", folderId: (r) => r.employee_code || r.payroll_id || r.id,
    deletes: "payroll rows, uploaded receipt attachments, generated payroll receipt PDFs, and the Company Capital transactions created from paid payroll (Employees are never deleted)",
    mainName: "Payroll",
    mainCols: [
      { h: "Payroll ID", g: (r) => r.payroll_id || String(r.id), w: 22 },
      { h: "Employee Code", g: (r) => r.employee_code || "", w: 15 },
      { h: "Employee Name", g: (r) => r.name || "", w: 20 },
      { h: "Job Title", g: (r) => r.job_title || "", w: 20 },
      { h: "Salary", g: (r) => frNumOrBlank(r.salary), w: 14, money: "cur" },
      { h: "Currency", g: (r) => r.currency, w: 10, align: "center" },
      { h: "Month", g: (r) => r.month || "", w: 11, align: "center" },
      { h: "Status", g: (r) => r.status, w: 12, kind: "status", align: "center" },
      { h: "Paid Date", g: (r) => r.paid_date || "", w: 13, align: "center" },
      { h: "Payment Method", g: (r) => r.payment_method || "", w: 16 },
      { h: "Receipt", g: (r) => (r.receipt && (r.receipt.data || r.receipt.name)) ? "Yes" : "No", w: 9, align: "center" },
      { h: "Notes", g: (r) => r.notes || "", w: 30, wrap: true },
    ],
    attachmentsOf: (r) => (r.receipt ? [r.receipt] : []),
    genPdf: (r, db) => {
      const emp = (db.employees || []).find((e) => e.employee_code === r.employee_code);
      return frPdfDoc({
        title: "PAYROLL RECEIPT", meta: [["Payroll ID", r.payroll_id || r.id, true], ["Employee", r.employee_code], ["Month", r.month], ["Status", r.status], ["Paid Date", frFmtDate(r.paid_date)]],
        leftParty: { label: "Employee", code: r.employee_code, name: r.name || (emp && emp.name) || "—", lines: [r.job_title || (emp && emp.job_title)] },
        detailRows: [["Job Title", r.job_title || (emp && emp.job_title) || "—"], ["Month", r.month], ["Payment Method", r.payment_method], ["Status", r.status], ["Currency", r.currency]],
        amountLabel: "SALARY", amountValue: r.salary, amountCurrency: r.currency, notes: r.notes,
      });
    },
    related: (db, recs) => {
      const ids = new Set(recs.flatMap((r) => [String(r.payroll_id), String(r.id)]));
      const rows = (db.capitalLedger || []).filter((t) => t.source === "Payroll" && ids.has(String(t.source_id)));
      return { name: "Related Finance Data", title: "Linked Company Capital Transactions", cols: FR_CAP_COLS, rows };
    },
    capIds: (recs) => new Set(recs.flatMap((r) => [String(r.payroll_id), String(r.id)])),
    capDirect: (t, ids) => t.source_type === "payroll" && ids.has(String(t.source_id)),
    summary: (recs, db, ctx) => {
      const paid = recs.filter((r) => r.status === "Paid");
      const sum = (arr) => arr.reduce((s, r) => s + (+r.salary || 0), 0);
      return [
        { k: "Total Payroll Rows", v: recs.length, a: "right" },
        { k: "Paid Rows", v: paid.length, a: "right" },
        { k: "Pending / Approved Rows", v: recs.length - paid.length, a: "right" },
        { k: "Total Payroll (EGP base)", v: recs.reduce((s, r) => s + frToBase(r.salary, r.currency), 0), m: "egp" },
        { k: "Paid Payroll (EGP base)", v: paid.reduce((s, r) => s + frToBase(r.salary, r.currency), 0), m: "egp" },
        { k: "Linked Capital Cash-Out (EGP base)", v: ctx.capBase, m: "egp" },
        { k: "Linked Company Capital Transactions", v: ctx.capCount, a: "right" },
        { k: "Uploaded Receipts", v: ctx.attFound, a: "right" },
        { k: "Generated Receipt PDFs", v: recs.length, a: "right" },
      ];
    },
  },

  "maintenance": {
    label: "Maintenance", phrase: "RESET MAINTENANCE", coll: "maintenance",
    resetPerm: "Reset Maintenance Test Data", exportPerm: "Export Maintenance Backup",
    code: (r) => r.maintenance_id, fileBase: "maintenance_backup", folder: "maintenance",
    uploadedSub: "uploaded-files", folderId: (r) => r.maintenance_id,
    deletes: "maintenance records, uploaded attachments, generated maintenance receipt PDFs, and the Company Capital transactions created from paid maintenance",
    mainName: "Maintenance",
    mainCols: [
      { h: "Maintenance ID", g: (m) => m.maintenance_id, w: 16 },
      { h: "Service / Item", g: (m) => m.service_name || "", w: 24 },
      { h: "Vendor", g: (m) => m.vendor || "", w: 16 },
      { h: "Payment Date", g: (m) => m.payment_date || "", w: 13, align: "center" },
      { h: "Amount", g: (m) => frNumOrBlank(m.amount), w: 13, money: "cur" },
      { h: "Currency", g: (m) => m.currency, w: 10, align: "center" },
      { h: "Payment Method", g: (m) => m.payment_method || "", w: 15 },
      { h: "Billing Cycle", g: (m) => m.billing_cycle || "", w: 12, align: "center" },
      { h: "Status", g: (m) => m.status, w: 12, kind: "status", align: "center" },
      { h: "Renewal Date", g: (m) => m.renewal_date || "", w: 13, align: "center" },
      { h: "Notes", g: (m) => m.notes || "", w: 32, wrap: true },
    ],
    attachmentsOf: (r) => (r.attachment ? [r.attachment] : []),
    genPdf: (r, db) => frPdfDoc({
      title: "MAINTENANCE RECEIPT", meta: [["Maintenance ID", r.maintenance_id, true], ["Vendor", r.vendor], ["Payment Date", frFmtDate(r.payment_date)], ["Status", r.status], ["Cycle", r.billing_cycle]],
      leftParty: { label: "Vendor / Supplier", code: "", name: r.vendor || "—", lines: [r.service_name] },
      detailRows: [["Service / Item", r.service_name], ["Payment Method", r.payment_method], ["Billing Cycle", r.billing_cycle], ["Renewal Date", frFmtDate(r.renewal_date)], ["Currency", r.currency]],
      amountLabel: "AMOUNT", amountValue: r.amount, amountCurrency: r.currency, notes: r.notes,
    }),
    related: (db, recs) => {
      const ids = new Set(recs.map((m) => String(m.maintenance_id)));
      const rows = (db.capitalLedger || []).filter((t) => t.source === "Maintenance" && ids.has(String(t.source_id)));
      return { name: "Related Finance Data", title: "Linked Company Capital Transactions", cols: FR_CAP_COLS, rows };
    },
    capIds: (recs) => new Set(recs.map((m) => String(m.maintenance_id))),
    capDirect: (t, ids) => t.source_type === "maintenance" && ids.has(String(t.source_id)),
    summary: (recs, db, ctx) => {
      const paid = recs.filter((m) => m.status === "Paid");
      const sumCur = (rows, c) => rows.filter((m) => m.currency === c).reduce((s, m) => s + (+m.amount || 0), 0);
      return [
        { k: "Total Maintenance Records", v: recs.length, a: "right" },
        { k: "Paid Records", v: paid.length, a: "right" },
        { k: "Total Paid (USD)", v: sumCur(paid, "USD"), m: "usd" },
        { k: "Total Paid (EGP)", v: sumCur(paid, "EGP"), m: "egp" },
        { k: "Linked Capital Cash-Out (EGP base)", v: ctx.capBase, m: "egp" },
        { k: "Linked Company Capital Transactions", v: ctx.capCount, a: "right" },
        { k: "Uploaded Attachments", v: ctx.attFound, a: "right" },
        { k: "Generated Receipt PDFs", v: recs.length, a: "right" },
      ];
    },
  },
};

const FR_CAP_COLS = [
  { h: "Txn Code", g: (t) => t.txn_code, w: 14 },
  { h: "Date", g: (t) => t.date || "", w: 12, align: "center" },
  { h: "Type", g: (t) => t.type, w: 13, kind: "type", align: "center" },
  { h: "Direction", g: (t) => t.direction, w: 10, kind: "dir", align: "center" },
  { h: "Reference", g: (t) => t.reference || "", w: 16 },
  { h: "Description", g: (t) => t.description || "", w: 38, wrap: true },
  { h: "Amount", g: (t) => frNumOrBlank(t.amount), w: 14, money: "cur" },
  { h: "Base (EGP)", g: (t) => frNumOrBlank(t.base_amount), w: 16, money: "egp" },
  { h: "Status", g: (t) => t.status, w: 12, kind: "status", align: "center" },
];

// linked capital txns = direct module txns + their reversals
function frModuleCapital(spec, recs, ledger) {
  const ids = spec.capIds(recs);
  const direct = ledger.filter((t) => spec.capDirect(t, ids));
  const directCodes = new Set(direct.map((t) => t.txn_code));
  const reversals = ledger.filter((t) => t.source_type === "reversal" && directCodes.has(t.source_id));
  return [...direct, ...reversals];
}

// ---- generic module backup ZIP (verified before any deletion) --------
async function frGenerateModuleBackup(moduleKey, me) {
  const spec = FR_MODULES[moduleKey];
  if (!spec) throw new Error("Unknown module: " + moduleKey);
  if (typeof can === "function" && !can(DB.get(), spec.exportPerm)) { const e = new Error("You do not have permission to perform this action."); e.code = "forbidden"; throw e; }
  await Promise.all([frLoadLib("exceljs"), frLoadLib("jszip"), frLoadLib("jspdf")]);
  const ExcelJS = window.ExcelJS;
  const db = DB.get();
  const stamp = frStamp();
  const xlsxName = `${spec.fileBase}.xlsx`;
  const zipName = `WordsTie_${spec.fileBase.replace(/_/g, "-")}_${stamp}.zip`;
  const attRoot = `attachments/${spec.folder}`;

  const now = new Date(), p = (n) => String(n).padStart(2, "0");
  const exp = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()} ${p(now.getHours())}:${p(now.getMinutes())}`;
  const baseCur = (db.capitalMeta && db.capitalMeta.base_currency) || "EGP";
  const meta = `Exported: ${exp}     \u2022     Base currency: ${baseCur}     \u2022     Generated by: ${(me && me.name) || "\u2014"}`;

  const records = db[spec.coll] || [];
  const ledger = db.capitalLedger || [];
  const capTxns = frModuleCapital(spec, records, ledger);
  const capBase = capTxns.filter((t) => t.source_type !== "reversal").reduce((s, t) => s + (+t.base_amount || 0), 0)
    - capTxns.filter((t) => t.source_type === "reversal").reduce((s, t) => s + (+t.base_amount || 0), 0);

  // uploaded attachments — one folder per record
  const b64Bytes = (b64) => { try { return atob(b64).length; } catch (e) { return 0; } };
  const atts = [];
  records.forEach((r) => {
    const usedNames = new Set();
    spec.attachmentsOf(r).forEach((file) => {
      const name = (file && (file.original_name || file.name)) || null;
      if (!name) return;
      const b = frDataUrlB64(file.data); const b64 = b ? b.b64 : null; const bytes = b64 ? b64Bytes(b64) : 0;
      const folder = `${attRoot}/${frSafeName(spec.folderId(r) || "record")}/${spec.uploadedSub}`;
      let fname = frSafeName(name), n = 2;
      while (usedNames.has(fname)) { const dot = fname.lastIndexOf("."); fname = dot > 0 ? `${fname.slice(0, dot)}-${n}${fname.slice(dot)}` : `${fname}-${n}`; n++; }
      usedNames.add(fname);
      const ok = !!b64 && bytes > 0;
      atts.push({ code: spec.code(r), name, exportedName: fname, bytes, b64, zipPath: `${folder}/${fname}`, exportStatus: ok ? "Exported" : "Failed", notes: ok ? "" : "Attachment metadata present but no stored file content (0 bytes)." });
    });
  });
  const attFound = atts.length;

  // generated PDFs — one per record
  const genPdfs = records.map((r) => {
    const id = frSafeName(spec.folderId(r) || "record");
    const code = frSafeName(String(spec.code(r) || "record"));
    const folder = `${attRoot}/${id}/generated-pdf`;
    const name = `${code}.pdf`;
    const rec = { code: spec.code(r), name, zipPath: `${folder}/${name}`, bytes: 0, ab: null, exportStatus: "Failed", notes: "" };
    try { const ab = spec.genPdf(r, db); rec.ab = ab; rec.bytes = ab ? ab.byteLength : 0; if (rec.bytes > 0) rec.exportStatus = "Exported"; else rec.notes = "Generated PDF produced 0 bytes."; }
    catch (e) { rec.notes = "PDF generation failed: " + (e && e.message || e); }
    return rec;
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = (me && me.name) || "Words Tie"; wb.created = new Date();
  const view = (y) => [{ state: "frozen", ySplit: y, showGridLines: false }];
  const sheet = (name, nCols) => { const ws = wb.addWorksheet(name.slice(0, 31), { views: view(5) }); frTitleBlock(ws, nCols, name, meta); return ws; };

  // pre-compute verification checks (same logic the ZIP is checked against)
  const exportedAtt = atts.filter((a) => a.exportStatus === "Exported").length;
  const genExported = genPdfs.filter((g) => g.exportStatus === "Exported").length;
  const allAttBytes = atts.every((a) => a.exportStatus !== "Exported" || a.bytes > 0);
  const allGenBytes = genPdfs.every((g) => g.exportStatus !== "Exported" || g.bytes > 0);
  const checks = [
    ["Excel workbook present in ZIP", "Pass"],
    [`All ${records.length} record(s) written to “${spec.mainName}” sheet`, "Pass"],
    [`Uploaded attachments exported (${exportedAtt}/${attFound})`, exportedAtt === attFound ? "Pass" : "Fail"],
    [`Generated PDFs exported (${genExported}/${records.length})`, genExported === records.length ? "Pass" : "Fail"],
    ["Every exported file is greater than 0 bytes", allAttBytes && allGenBytes ? "Pass" : "Fail"],
    ["Manifest paths match ZIP folder paths", "Pass"],
    [`Record count equals records before reset (${records.length})`, "Pass"],
    [`Linked finance / capital records included (${capTxns.length})`, "Pass"],
  ];

  // 1 — Backup Summary
  frWriteTable(sheet("Backup Summary", 2), 5, [
    { h: "Metric", g: (r) => r.k, w: 40, bold: true },
    { h: "Value", g: (r) => frNumOrBlank(r.v), w: 24, money: (r) => r.m, align: (r) => r.a },
  ], spec.summary(records, db, { attFound, capBase, capCount: capTxns.length }));

  // 2 — Main Data
  frWriteTable(sheet(spec.mainName, spec.mainCols.length), 5, spec.mainCols, records);

  // 3 — Related Finance Data
  const rel = spec.related(db, records);
  const wsR = sheet(rel.name, rel.cols.length);
  frWriteTable(wsR, 5, rel.cols, rel.rows);

  // 4 — Uploaded Attachments Manifest
  frWriteTable(sheet("Uploaded Attachments Manifest", 6), 5, [
    { h: "Record Code", g: (a) => a.code, w: 20 },
    { h: "Original File Name", g: (a) => a.name, w: 26 },
    { h: "Exported File Name", g: (a) => a.exportedName, w: 24 },
    { h: "ZIP Path", g: (a) => a.zipPath, w: 46 },
    { h: "File Size", g: (a) => frNumOrBlank(a.bytes), w: 13, fmt: '#,##0" B"' },
    { h: "Export Status", g: (a) => a.exportStatus, w: 14, kind: "status", align: "center" },
  ], atts);

  // 5 — Generated PDFs Manifest
  frWriteTable(sheet("Generated PDFs Manifest", 5), 5, [
    { h: "Record Code", g: (g) => g.code, w: 20 },
    { h: "Generated PDF Name", g: (g) => g.name, w: 24 },
    { h: "ZIP Path", g: (g) => g.zipPath, w: 46 },
    { h: "File Size", g: (g) => frNumOrBlank(g.bytes), w: 13, fmt: '#,##0" B"' },
    { h: "Export Status", g: (g) => g.exportStatus, w: 14, kind: "status", align: "center" },
  ], genPdfs);

  // 6 — Verification Report
  frWriteTable(sheet("Verification Report", 2), 5, [
    { h: "Check", g: (r) => r[0], w: 56 },
    { h: "Result", g: (r) => r[1], w: 14, kind: "status", align: "center" },
  ], checks.map((c) => ({ 0: c[0], 1: c[1] })));

  // ---- assemble ZIP -------------------------------------------------
  const buf = await wb.xlsx.writeBuffer();
  const zip = new window.JSZip();
  zip.file(xlsxName, buf);
  zip.folder(attRoot);
  atts.forEach((a) => { if (a.exportStatus === "Exported") zip.file(a.zipPath, a.b64, { base64: true }); });
  genPdfs.forEach((g) => { if (g.exportStatus === "Exported" && g.ab) zip.file(g.zipPath, g.ab); });

  const manifestJson = {
    exported_at: new Date().toISOString(), exported_by: me && me.name, app: "Words Tie Dashboard", module: spec.label, workbook: xlsxName,
    records: records.length, attachments_found: attFound, attachments_exported: exportedAtt,
    generated_pdfs_found: records.length, generated_pdfs_exported: genExported, linked_capital_transactions: capTxns.length,
    uploaded_attachments: atts.map((a) => ({ record: a.code, original_name: a.name, exported_name: a.exportedName, zip_path: a.zipPath, file_size: a.bytes, export_status: a.exportStatus })),
    generated_pdfs: genPdfs.map((g) => ({ record: g.code, pdf_name: g.name, zip_path: g.zipPath, file_size: g.bytes, export_status: g.exportStatus })),
  };
  zip.file("manifest.json", JSON.stringify(manifestJson, null, 2));
  zip.file("raw-data.json", JSON.stringify({ exported_at: new Date().toISOString(), exported_by: me && me.name, module: spec.label, records, linkedCapitalTransactions: capTxns, relatedFinanceData: rel.rows }, null, 2));

  // ---- VERIFY before anything can be deleted ------------------------
  const entries = zip.files || {};
  const missing = [];
  if (!entries[xlsxName]) missing.push(xlsxName);
  if (!entries["manifest.json"]) missing.push("manifest.json");
  if (!entries[attRoot + "/"]) missing.push(attRoot + "/");
  const attFailed = atts.filter((a) => a.exportStatus !== "Exported");
  atts.forEach((a) => { if (a.exportStatus === "Exported") { if (!entries[a.zipPath]) missing.push(a.zipPath); if (!(a.bytes > 0)) missing.push(a.zipPath + " (0 bytes)"); } });
  const attManifestOk = atts.every((a) => manifestJson.uploaded_attachments.some((m) => m.zip_path === a.zipPath));
  if (attFailed.length || missing.length || !attManifestOk || exportedAtt !== attFound) {
    const err = new Error("Backup failed. Some records, attachments, or generated PDFs were not included in the ZIP. No data was deleted."); err.code = "missing"; throw err;
  }
  const genFailed = genPdfs.filter((g) => g.exportStatus !== "Exported");
  const genMissing = [];
  genPdfs.forEach((g) => { if (g.exportStatus === "Exported") { if (!entries[g.zipPath]) genMissing.push(g.zipPath); if (!(g.bytes > 0)) genMissing.push(g.zipPath); } });
  const genManifestOk = genPdfs.every((g) => manifestJson.generated_pdfs.some((m) => m.zip_path === g.zipPath));
  if (genFailed.length || genMissing.length || !genManifestOk || genExported !== records.length) {
    const err = new Error("Backup failed. Some records, attachments, or generated PDFs were not included in the ZIP. No data was deleted."); err.code = "missing"; throw err;
  }

  const blob = await zip.generateAsync({ type: "blob" });
  frDownloadBlob(blob, zipName);
  return {
    ok: true, zipName, xlsxName, module: spec.label,
    records: records.length, attachmentsFound: attFound, attachmentsExported: exportedAtt,
    generatedPdfsFound: records.length, generatedPdfsExported: genExported, capitalTxns: capTxns.length,
    totalBytes: atts.reduce((s, a) => s + (a.bytes || 0), 0) + genPdfs.reduce((s, g) => s + (g.bytes || 0), 0),
  };
}

// ---- generic module reset (after verified backup) --------------------
function resetModuleTestData(moduleKey, by) {
  const spec = FR_MODULES[moduleKey];
  if (typeof can === "function" && !can(DB.get(), spec.resetPerm)) { const e = new Error("You do not have permission to perform this action."); e.code = "forbidden"; throw e; }
  const db = DB.get();
  const records = db[spec.coll] || [];
  const L = db.capitalLedger || [];
  const linked = frModuleCapital(spec, records, L);
  const linkedIds = new Set(linked.map((t) => t.id));
  const keptLedger = L.filter((t) => !linkedIds.has(t.id));
  const snapshot = { at: new Date().toISOString(), by: by || "—", module: spec.label, scope: `${spec.label} test/demo data`, removed_records: records.length, removed_txns: linked.length, records, ledgerRemoved: linked };
  DB.set((s) => ({
    ...s,
    [spec.coll]: [],
    capitalLedger: keptLedger,
    moduleBackups: [snapshot, ...(s.moduleBackups || [])].slice(0, 30),
    capitalAudit: [{ at: snapshot.at, by: snapshot.by, action: `Reset ${spec.label} test data`, scope: snapshot.scope, removed: records.length, backup_ref: snapshot.at }, ...(s.capitalAudit || [])],
  }));
  if (window.Capital && Capital.syncFromModules) Capital.syncFromModules();
  return { removedRecords: records.length, removedTxns: linked.length };
}

// ---- generic Danger-Zone reset modal + trigger button ----------------
function ModuleResetModal({ moduleKey, me, onClose }) {
  const spec = FR_MODULES[moduleKey];
  const [db] = useDB();
  const canExport = can(db, spec.exportPerm);
  const canDoReset = can(db, spec.resetPerm);
  const [backedUp, setBackedUp] = useFRS(false);
  const [report, setReport] = useFRS(null);
  const [phrase, setPhrase] = useFRS("");
  const [pw, setPw] = useFRS("");
  const [done, setDone] = useFRS(null);
  const [busy, setBusy] = useFRS(false);

  const exportBackup = async () => {
    if (busy) return;
    if (!canExport) { toast("You do not have permission to perform this action.", "del"); return; }
    setBusy(true);
    try {
      const res = await frGenerateModuleBackup(moduleKey, me);
      if (!res || !res.ok) throw new Error("verification");
      setReport(res); setBackedUp(true);
      toast(`Backup ZIP verified & downloaded · ${res.records} record(s), ${res.attachmentsExported}/${res.attachmentsFound} attachment(s), ${res.generatedPdfsExported}/${res.generatedPdfsFound} PDF(s).`);
    } catch (e) {
      setBackedUp(false); setReport(null);
      toast(e && e.code === "missing" ? e.message : "Backup failed. Some records, attachments, or generated PDFs were not included in the ZIP. No data was deleted.", "del");
    }
    setBusy(false);
  };

  const phraseOk = phrase.trim().toUpperCase() === spec.phrase;
  const pwOk = pw.trim().length > 0 && (!me.password || pw === me.password);
  const canReset = backedUp && phraseOk && pwOk && canDoReset;

  const doReset = () => {
    if (!canReset) return;
    if (!canDoReset) { toast("You do not have permission to perform this action.", "del"); return; }
    const res = resetModuleTestData(moduleKey, me.name);
    setDone(res);
    toast(`Backup downloaded. ${spec.label} test data was reset safely.`);
  };

  if (done) {
    return (
      <Modal title="Reset Complete" onClose={onClose} footer={<Btn variant="primary" icon="check" onClick={onClose}>Done</Btn>}>
        <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--ok-soft, #e6f6ec)", color: "var(--ok)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Icon name="check" size={26} /></div>
          <p style={{ margin: 0, fontSize: 15 }}>Backup ZIP downloaded and verified, then cleared <b>{done.removedRecords}</b> {spec.label.toLowerCase()} record{done.removedRecords === 1 ? "" : "s"}{done.removedTxns ? <> and removed <b>{done.removedTxns}</b> linked capital transaction{done.removedTxns === 1 ? "" : "s"}</> : null}. Company Capital and the Finance Dashboard have recalculated.</p>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Clients, freelancers, employees, tasks and system users were preserved. A backup snapshot and audit entry were recorded.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Reset ${spec.label} Test Data`} lg onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <button className="btn btn--danger" disabled={!canReset} onClick={doReset}><Icon name="trash" size={17} /><span>Reset Test Data</span></button>
    </>}>
      <div className="cap-reset-warn">
        <Icon name="alert-triangle" size={20} />
        <div>This will permanently delete this module’s test/demo data. A verified backup ZIP must be created first. Uploaded files, generated PDFs, and receipts must be included in the ZIP before anything is deleted. This clears {spec.deletes}.</div>
      </div>

      <div className="cap-reset-step">
        <div className="cap-reset-step__n" data-on={backedUp}>{backedUp ? <Icon name="check" size={14} /> : "1"}</div>
        <div style={{ flex: 1 }}>
          <div className="cap-reset-step__t">Export &amp; Verify Backup (ZIP)</div>
          <Btn variant="soft" size="sm" icon="download" onClick={exportBackup} disabled={!canExport} title={canExport ? "" : "You do not have permission to perform this action."}>{busy ? "Generating & verifying ZIP…" : backedUp ? "Backup Verified ✓ — export again" : "Export & Verify Backup (ZIP)"}</Btn>
          {!canExport ? <p className="muted" style={{ fontSize: 12, margin: "7px 0 0" }}>You do not have permission to export this backup.</p> : null}
          {report ? (
            <div style={{ marginTop: 11, border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", fontSize: 12.5 }}>
              {[
                ["Excel backup", "OK", true],
                [`${spec.label} records exported`, String(report.records), null],
                ["Attachments found", String(report.attachmentsFound), null],
                ["Attachments exported", `${report.attachmentsExported}/${report.attachmentsFound}`, report.attachmentsExported === report.attachmentsFound],
                ["Generated PDFs", `${report.generatedPdfsExported}/${report.generatedPdfsFound}`, report.generatedPdfsExported === report.generatedPdfsFound],
                ["Linked capital transactions", String(report.capitalTxns), null],
                ["Backup status", "Verified", true],
              ].map(([k, v, ok], idx) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", borderTop: idx ? "1px solid var(--line-2)" : "none" }}>
                  <span className="muted">{k}</span>
                  <b style={{ fontFamily: "var(--mono)", color: ok ? "var(--ok)" : "var(--ink)" }}>{v}{ok ? " ✓" : ""}</b>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="cap-reset-step">
        <div className="cap-reset-step__n" data-on={phraseOk}>{phraseOk ? <Icon name="check" size={14} /> : "2"}</div>
        <div style={{ flex: 1 }}>
          <Field label={<>Type <code>{spec.phrase}</code> to confirm</>}>
            <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder={spec.phrase} disabled={!backedUp} />
          </Field>
        </div>
      </div>

      <div className="cap-reset-step">
        <div className="cap-reset-step__n" data-on={pwOk}>{pwOk ? <Icon name="check" size={14} /> : "3"}</div>
        <div style={{ flex: 1 }}>
          <Field label="Confirm your password" hint="Required to authorize this action">
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" disabled={!backedUp} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function ModuleResetButton({ moduleKey, perm }) {
  const [db] = useDB();
  const me = currentUser(db);
  const [open, setOpen] = useFRS(false);
  const spec = FR_MODULES[moduleKey];
  const gate = perm || (spec && spec.resetPerm);
  if (gate && !can(db, gate)) return null;
  return (
    <>
      <button className="cap-reset-btn" style={{ marginInlineStart: 0 }} onClick={() => setOpen(true)} title={`Clear ${spec.label} test/demo data`}>
        <Icon name="trash" size={16} /> Reset Test Data
      </button>
      {open ? <ModuleResetModal moduleKey={moduleKey} me={me} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

// ====================================================================
// ====================================================================
const FR_PHRASE = "RESET ALL TEST DATA";

function FullResetCard() {
  const [db] = useDB();
  const me = currentUser(db);
  const [open, setOpen] = useFRS(false);
  if (!can(db, "View Danger Zone") && !can(db, "Full Test Data Reset")) return null;
  const logs = db.resetLogs || [];
  return (
    <Card className="fr-danger-card" style={{ marginTop: 22 }}>
      <div className="card__head">
        <div>
          <h3 className="card__title flex items-center gap-8"><Icon name="alert-triangle" size={18} /> Danger Zone</h3>
          <p className="card__sub">Administrator-only actions. These are not part of any daily workflow.</p>
        </div>
      </div>
      <div className="card__body">
        <div className="summary-row">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>Full Test Data Reset</div>
            <div className="muted" style={{ fontSize: 13, maxWidth: 560 }}>
              Deletes all demo/test operational data across the dashboard (tasks, clients, freelancers, employees, invoices, projects, payroll, maintenance, capital transactions, requests, messages and portal data) after a full backup ZIP is generated. Users, roles, permissions, login accounts and settings are never deleted.
            </div>
          </div>
          <button className="btn btn--danger-outline" onClick={() => setOpen(true)}>
            <Icon name="alert-triangle" size={16} /><span>Full Test Data Reset</span>
          </button>
        </div>
        {logs.length ? (
          <div className="fr-log">
            <div className="fr-log__title">Reset history</div>
            {logs.slice(0, 4).map((l) => (
              <div key={l.id} className="fr-log__row">
                <Badge variant="danger">{l.type}</Badge>
                <span>{l.by}</span>
                <span className="muted">{fmtDate(l.at)} {String(l.at).slice(11, 16)}</span>
                <span className="cell-mono" style={{ fontSize: 11.5 }}>{l.backup_file}</span>
                <span className="muted">{l.total} records · {l.modules.length} modules</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {open ? <FullResetModal me={me} onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}

function FullResetModal({ me, onClose }) {
  const [backup, setBackup] = useFRS({ state: "idle" }); // idle | working | done | error
  const [phrase, setPhrase] = useFRS("");
  const [pw, setPw] = useFRS("");
  const [resetRates, setResetRates] = useFRS(false);
  const [result, setResult] = useFRS(null);
  const [resetErr, setResetErr] = useFRS("");
  const canExport = can(DB.get(), "Export Full Backup");
  const canRun = can(DB.get(), "Full Test Data Reset");

  const doBackup = async () => {
    if (!canExport) { toast("You do not have permission to perform this action.", "del"); return; }
    setBackup({ state: "working" });
    try {
      const info = await frGenerateBackup(me);
      setBackup({ state: "done", ...info });
      toast("Full backup downloaded. You can now continue.");
    } catch (e) {
      setBackup({ state: "error", message: (e && e.message) || "Unknown error" });
      toast("Backup failed. No data was deleted.", "del");
    }
  };

  const backedUp = backup.state === "done";
  const phraseOk = phrase.trim() === FR_PHRASE;
  const pwOk = pw.trim().length > 0 && (!me.password || pw === me.password);
  const canReset = backedUp && phraseOk && pwOk && canRun;

  const doReset = () => {
    if (!canReset) return;
    try {
      const log = DB.fullTestDataReset({ by: me.name, backup_file: backup.zipName, resetRates });
      setResult(log);
      toast("Full test data reset completed.");
    } catch (e) {
      setResetErr(`Reset failed: ${(e && e.message) || "unknown error"}. Your backup file “${backup.zipName}” has already been downloaded and remains available. No further changes were made.`);
    }
  };

  if (result) {
    const top = Object.entries(result.counts).filter(([, n]) => n > 0);
    return (
      <Modal title="Reset Complete" onClose={onClose} footer={<Btn variant="primary" icon="check" onClick={onClose}>Done</Btn>}>
        <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--ok-soft)", color: "var(--ok)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Icon name="check" size={26} /></div>
          <p style={{ margin: "0 0 4px", fontSize: 15 }}>Deleted <b>{result.total}</b> demo/test records across <b>{result.modules.length}</b> modules.</p>
          <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Backup: <span className="cell-mono">{result.backup_file}</span> · Audit log entry recorded.</p>
        </div>
        {top.length ? (
          <div className="fr-result-grid">
            {top.map(([label, n]) => (
              <div key={label} className="fr-result-cell"><span className="cell-mono">{n}</span><span>{label}</span></div>
            ))}
          </div>
        ) : null}
        <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>Users, roles, permissions, login accounts and settings were not changed. All KPI cards, Company Capital and Finance figures now show a clean zero state.</p>
      </Modal>
    );
  }

  return (
    <Modal title="Full Test Data Reset" lg onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <button className="btn btn--danger" disabled={!canReset} onClick={doReset}>
        <Icon name="trash" size={17} /><span>Reset All Test Data</span>
      </button>
    </>}>
      <div className="cap-reset-warn">
        <Icon name="alert-triangle" size={20} />
        <div>This will delete <b>all demo/test operational data</b> across the dashboard after creating a full backup. <b>Users, roles, permissions, login accounts, and system settings will not be deleted.</b> The Company Capital reset (Finance → Company Capital) remains separate and only affects capital test entries.</div>
      </div>

      {resetErr ? <div className="fr-error"><Icon name="alert-triangle" size={16} /><div>{resetErr}</div></div> : null}
      {backup.state === "error" ? <div className="fr-error"><Icon name="alert-triangle" size={16} /><div><b>Backup failed. No data was deleted.</b><br /><span className="muted" style={{ fontSize: 12.5 }}>{backup.message}</span></div></div> : null}

      <div className="cap-reset-step">
        <div className="cap-reset-step__n" data-on={backedUp}>{backedUp ? <Icon name="check" size={14} /> : "1"}</div>
        <div style={{ flex: 1 }}>
          <div className="cap-reset-step__t">Export Backup (ZIP)</div>
          <div className="muted" style={{ fontSize: 12.5, margin: "2px 0 8px" }}>Downloads a ZIP containing <span className="cell-mono">data_backup.xlsx</span> (one sheet per module), an <span className="cell-mono">/attachments</span> folder with all uploaded files, and a <span className="cell-mono">raw-data.json</span> snapshot. PDFs and images are referenced via the Attachments Index — never embedded in Excel.</div>
          <Btn variant="soft" size="sm" icon="download" onClick={(backup.state === "working" || !canExport) ? undefined : doBackup} disabled={!canExport} title={canExport ? "" : "You do not have permission to perform this action."}>
            {backup.state === "working" ? "Generating ZIP backup…" : backedUp ? "Backup Exported ✓ — export again" : "Export Backup"}
          </Btn>
          {!canExport ? <p className="muted" style={{ fontSize: 12, margin: "7px 0 0" }}>You do not have permission to export the full backup.</p> : null}
          {backedUp ? <div className="muted" style={{ fontSize: 12, marginTop: 6 }}><span className="cell-mono">{backup.zipName}</span> · {backup.sheets} sheets · {backup.attachments} attachment{backup.attachments === 1 ? "" : "s"}</div> : null}
        </div>
      </div>

      <div className="cap-reset-step">
        <div className="cap-reset-step__n" data-on={phraseOk}>{phraseOk ? <Icon name="check" size={14} /> : "2"}</div>
        <div style={{ flex: 1 }}>
          <Field label={<>Type <code>{FR_PHRASE}</code> exactly to confirm</>}>
            <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder={FR_PHRASE} disabled={!backedUp} />
          </Field>
        </div>
      </div>

      <div className="cap-reset-step">
        <div className="cap-reset-step__n" data-on={pwOk}>{pwOk ? <Icon name="check" size={14} /> : "3"}</div>
        <div style={{ flex: 1 }}>
          <Field label="Confirm your password" hint="Required to authorize this destructive action">
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" disabled={!backedUp} />
          </Field>
        </div>
      </div>

      <label className="fr-opt">
        <input type="checkbox" checked={resetRates} onChange={(e) => setResetRates(e.target.checked)} />
        <span>Also reset Calculator rate cards (language & service rates) back to the default benchmarks. Leave unchecked to keep your current rate cards.</span>
      </label>
    </Modal>
  );
}

Object.assign(window, { FullResetCard, FullResetModal, ModuleResetButton, ModuleResetModal, WTBackup: { exportFull: frGenerateBackup, exportCapital: frGenerateCapitalBackup, exportFreelancerInvoices: frGenerateFreelancerInvoiceBackup, exportModule: frGenerateModuleBackup } });
