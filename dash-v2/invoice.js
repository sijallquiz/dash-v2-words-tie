/* global window, document */
// ====================================================================
// WORDS TIE — PO → PDF Purchase Order export
// Faithful reproduction of purchase-order.xlsx ("Purchase Order" sheet).
// Palette / type / layout extracted directly from the workbook styles.
//   primary blue  #1E88E5    dark blue  #0D5DAB
//   ink           #1C1E22    body  #3A3F47    muted  #767E89
//   tints         #D7E9FA  #F0F7FE  #F4F6F8  #FAFBFC
//   font          Overlock
// ====================================================================
(function () {
  const C = {
    blue: "#1E88E5",
    blueDk: "#0D5DAB",
    ink: "#1C1E22",
    body: "#3A3F47",
    muted: "#767E89",
    tint: "#F0F7FE",
    tint2: "#D7E9FA",
    grey: "#F4F6F8",
    off: "#FAFBFC",
    line: "#E3E8EF",
  };

  const STANDARD_TERMS = "After completion of deliverables, please sign and send a copy of this purchase order along with your invoice to finance@words-tie.com for our records. Payment will be released within the agreed payment terms from the submission of a fully executed invoice. Payment will not be made for invoices without a fully executed purchase order. This Purchase Order is issued solely at the terms and conditions stated in Words Tie's Vendor Pricing Agreement.";

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const num = (n) =>
    Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtDate = (s) => {
    if (!s) return "—";
    try {
      const d = new Date(s);
      if (isNaN(d)) return s;
      // numeric day/month/year with leading zeros — e.g. 07/06/2026
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    } catch (e) { return s; }
  };

  // ----------------------------------------------------------------
  // Build the purchase-order document HTML
  // ----------------------------------------------------------------
  function buildHTML(ctx) {
    const cur = ctx.currency || "USD";
    const logo = window.WT_LOGO_DATA_URI || "";

    const itemRows = ctx.items.map((it, i) => `
      <tr class="${i % 2 ? "alt" : ""}">
        <td class="c-svc">${esc(it.service) || "—"}</td>
        <td class="c-desc">${esc(it.description) || "&nbsp;"}</td>
        <td class="c-r">${Number(it.qty || 0).toLocaleString("en-US")}</td>
        <td class="c-r">${num(it.rate)}</td>
        <td class="c-amt">${num(it.amount)}</td>
      </tr>`).join("");

    let padRows = "";
    for (let i = ctx.items.length; i < 4; i++) {
      padRows += `
      <tr class="${i % 2 ? "alt" : ""}">
        <td class="c-svc">&nbsp;</td><td class="c-desc"></td><td class="c-r"></td><td class="c-r"></td><td class="c-amt"></td>
      </tr>`;
    }

    // LEFT card = Supplier (freelancer): code, name, email only — no phone.
    const supplierLines = [ctx.billTo.email]
      .filter(Boolean).map((l) => `<div class="ln">${esc(l)}</div>`).join("");
    // RIGHT card = Ship To (Words Tie).
    const shipToLines = [ctx.shipTo.address]
      .filter(Boolean).map((l) => `<div class="ln">${esc(l)}</div>`).join("");

    const contact = [
      ctx.from.address,
      [ctx.from.phone, ctx.from.email].filter(Boolean).join("  ·  "),
      ctx.from.website,
    ].filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join("");

    const metaRow = (label, value, accent) =>
      `<div class="m-lbl">${esc(label)}</div><div class="m-val${accent ? " accent" : ""}">${esc(value) || "—"}</div>`;

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(ctx.poNo)} — Words Tie Purchase Order</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Overlock:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { background:#e9edf2; }
  body { font-family:"Overlock", system-ui, sans-serif; color:${C.body}; -webkit-print-color-adjust:exact; print-color-adjust:exact; padding:28px 16px 60px; }

  .bar { position:fixed; top:0; left:0; right:0; z-index:9; display:flex; gap:10px; align-items:center; justify-content:center;
    background:rgba(20,24,28,.92); backdrop-filter:blur(6px); padding:11px; }
  .bar button { font-family:"Overlock",sans-serif; font-weight:700; font-size:13px; border:0; border-radius:9px; padding:9px 18px; cursor:pointer; }
  .bar .dl { background:${C.blue}; color:#fff; }
  .bar .cl { background:rgba(255,255,255,.14); color:#fff; }
  .bar .hint { color:rgba(255,255,255,.55); font-size:12px; font-weight:400; }

  .sheet { width:760px; margin:54px auto 0; background:#fff; padding:38px 40px 30px;
    box-shadow:0 18px 50px rgba(20,30,50,.18); border-radius:4px; }

  /* header */
  .head { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; }
  .brand .logo img { height:34px; display:block; margin-bottom:12px; }
  .brand .contact { font-size:10px; color:${C.muted}; line-height:1.7; }
  .head .meta { flex-shrink:0; display:grid; grid-template-columns:auto auto; gap:1px 14px; align-items:center; }
  .meta .m-lbl { font-size:9px; font-weight:700; letter-spacing:.7px; text-transform:uppercase; color:${C.muted}; text-align:right; line-height:1.25; }
  .meta .m-val { font-size:12.5px; font-weight:700; color:${C.ink}; text-align:right; min-width:120px; line-height:1.25; }
  .meta .m-val.accent { color:${C.blueDk}; }

  /* title band */
  .titleband { margin:22px 0 22px; background:${C.blue}; color:#fff; text-align:center;
    font-weight:900; font-size:18px; letter-spacing:5px; text-transform:uppercase; padding:11px 0; border-radius:5px; }

  /* parties */
  .parties { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:24px; }
  .party { border-radius:9px; padding:16px 18px; color:#fff; }
  .party.from { background:${C.ink}; }
  .party.to { background:${C.blueDk}; }
  .party .plbl { font-size:9.5px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; opacity:.62; margin-bottom:8px; }
  .party .pcode { font-size:11px; font-weight:700; letter-spacing:.06em; opacity:.78; margin-bottom:3px; }
  .party .pname { font-size:15px; font-weight:700; margin-bottom:6px; }
  .party .ln { font-size:11px; opacity:.85; line-height:1.6; }

  /* items table */
  table.items { width:100%; border-collapse:collapse; }
  table.items thead th { background:${C.ink}; color:#fff; font-size:9.5px; font-weight:700; letter-spacing:.7px;
    text-transform:uppercase; padding:10px 11px; text-align:left; }
  table.items thead th.r { text-align:right; }
  table.items thead th:first-child { border-top-left-radius:6px; }
  table.items thead th:last-child { border-top-right-radius:6px; }
  table.items tbody td { font-size:11.5px; color:${C.ink}; padding:10px 11px; border-bottom:1px solid ${C.line}; height:30px; vertical-align:middle; }
  table.items tbody tr.alt td { background:${C.tint}; }
  td.c-svc { font-weight:700; white-space:nowrap; }
  td.c-desc { color:${C.body}; }
  td.c-r { text-align:right; white-space:nowrap; }
  td.c-amt { text-align:right; font-weight:700; white-space:nowrap; }

  /* total */
  .total-wrap { display:flex; justify-content:flex-end; margin-top:14px; }
  .total { display:flex; align-items:center; gap:0; border-radius:7px; overflow:hidden; min-width:280px; }
  .total .tl { background:${C.ink}; color:#fff; font-size:13px; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:13px 18px; flex:1; }
  .total .tv { background:${C.blue}; color:#fff; font-size:16px; font-weight:900; padding:13px 18px; text-align:right; white-space:nowrap; }

  /* terms + signatures */
  .lower { display:grid; grid-template-columns:1.35fr 1fr; gap:40px; margin-top:30px; align-items:start; }
  .terms .h { font-size:9.5px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:${C.blueDk}; margin-bottom:7px; }
  .terms p { font-size:10px; color:${C.muted}; line-height:1.65; }
  .signs { display:flex; flex-direction:column; gap:26px; padding-top:4px; }
  .sign .ln { border-bottom:1.5px solid ${C.ink}; height:30px; }
  .sign .lbl { font-size:9.5px; font-weight:700; letter-spacing:.7px; color:${C.muted}; text-transform:uppercase; margin-top:6px; }

  .foot { margin-top:30px; padding-top:14px; border-top:1px solid ${C.line}; text-align:center;
    font-size:10px; font-weight:700; letter-spacing:.5px; color:${C.muted}; }

  @media print {
    @page { size:A4; margin:12mm; }
    html, body { background:#fff; padding:0; }
    .bar { display:none; }
    .sheet { width:auto; margin:0; box-shadow:none; border-radius:0; padding:0; }
  }
</style>
</head>
<body>
  <div class="bar">
    <button class="dl" onclick="window.print()">⤓  Save as PDF</button>
    <button class="cl" onclick="window.close()">Close</button>
    <span class="hint">Choose “Save as PDF” as the destination</span>
  </div>

  <div class="sheet">
    <div class="head">
      <div class="brand">
        <div class="logo">${logo ? `<img src="${logo}" alt="Words Tie">` : `<div style="font-weight:900;font-size:24px;color:${C.ink}">Words Tie</div>`}</div>
        <div class="contact">${contact}</div>
      </div>
      <div class="meta">
        ${metaRow("P.O. No.", ctx.poNo, true)}
        ${metaRow("Ref No.", ctx.refNo)}
        ${metaRow("Date", fmtDate(ctx.date))}
        ${metaRow("Payment Due By", fmtDate(ctx.dueDate))}
      </div>
    </div>

    <div class="titleband">Purchase Order</div>

    <div class="parties">
      <div class="party from">
        <div class="plbl">${esc(ctx.billTo.label)}</div>
        ${ctx.billTo.code ? `<div class="pcode">${esc(ctx.billTo.code)}</div>` : ""}
        <div class="pname">${esc(ctx.billTo.name)}</div>
        ${supplierLines}
      </div>
      <div class="party to">
        <div class="plbl">Ship To</div>
        <div class="pname">${esc(ctx.shipTo.name)}</div>
        ${shipToLines}
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>Service</th>
          <th>Description</th>
          <th class="r">Qty</th>
          <th class="r">Rate</th>
          <th class="r">Amount (${esc(cur)})</th>
        </tr>
      </thead>
      <tbody>${itemRows}${padRows}</tbody>
    </table>

    <div class="total-wrap">
      <div class="total">
        <div class="tl">Total</div>
        <div class="tv">${esc(cur)} ${num(ctx.total)}</div>
      </div>
    </div>

    <div class="lower">
      <div class="terms">
        <div class="h">Terms &amp; Conditions</div>
        <p>${esc(ctx.notes ? ctx.notes + "\n\n" + STANDARD_TERMS : STANDARD_TERMS).replace(/\n/g, "<br>")}</p>
      </div>
      <div class="signs">
        <div class="sign"><div class="ln"></div><div class="lbl">Approved By</div></div>
        <div class="sign"><div class="ln"></div><div class="lbl">Date</div></div>
      </div>
    </div>

    <div class="foot">WORDS TIE${ctx.from.website ? "  ·  " + esc(ctx.from.website) : ""}${ctx.from.email ? "  ·  " + esc(ctx.from.email) : ""}</div>
  </div>
  ${ctx.autoPrint ? `<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},400);});</script>` : ""}
</body>
</html>`;
  }

  // ----------------------------------------------------------------
  // Assemble context from a PO record
  // ----------------------------------------------------------------
  function buildCtx(po, kind, db) {
    const task = db.tasks.find((t) => t.id === po.task_id);
    const cur = po.currency || "USD";

    // Fixed Words Tie company information — shown on every generated PO PDF.
    const from = {
      name: "Words Tie",
      address: "Suez canal st. Mansoura, Egypt",
      phone: "(+20) 102467283",
      email: "info@words-tie.com",
      website: "www.words-tie.com",
    };
    // Ship-To card (right) — always Words Tie.
    const shipTo = {
      name: "Words Tie For Translation & Localization",
      address: "Suez canal st. Mansoura, Egypt",
    };

    let billTo;
    if (kind === "vendor") {
      const f = db.freelancers.find((x) => x.freelancer_code === po.freelancer_code);
      billTo = {
        label: "Supplier",
        name: f ? f.name : (po.freelancer_code || "Freelancer"),
        code: po.freelancer_code || (f ? f.freelancer_code : ""),
        email: f ? f.email : "",
      };
    } else {
      const c = task ? db.clients.find((x) => x.client_code === task.client_code) : null;
      billTo = {
        label: "Bill To · Client",
        name: c ? c.name : (task ? task.client_code : "Client"),
        code: c ? c.client_code : "",
        email: c ? c.email : "",
      };
    }

    // line items: stored items, else synthesize a single line from the task
    let items = Array.isArray(po.items) && po.items.length ? po.items.map((it) => ({
      service: it.service, description: it.description,
      qty: Number(it.qty || 0), rate: Number(it.rate || 0),
      amount: Number(it.qty || 0) * Number(it.rate || 0),
    })) : null;

    if (!items) {
      const svc = task ? (task.service_ids || []).map((id) => (db.services.find((s) => s.id === id) || {}).name).filter(Boolean)[0] : "";
      items = [{
        service: svc || "Translation",
        description: task ? `${task.task_number} — language services` : "Language services",
        qty: 1, rate: Number(po.amount || 0), amount: Number(po.amount || 0),
      }];
    }

    const total = items.reduce((s, it) => s + it.amount, 0);

    return {
      poNo: po.po_number,
      date: po.date,
      refNo: po.ref_no || (task ? task.task_number : ""),
      dueDate: po.due_date || "",
      currency: cur,
      from, billTo, shipTo, items, total,
      notes: po.notes || "",
    };
  }

  function exportPOInvoice(po, kind, db, opts) {
    const ctx = buildCtx(po, kind, db);
    ctx.autoPrint = !!(opts && opts.autoPrint);
    const html = buildHTML(ctx);
    const w = window.open("", "_blank");
    if (!w) {
      window.dispatchEvent(new CustomEvent("wt-toast", { detail: { msg: "Allow pop-ups to export the PDF", kind: "info" } }));
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  window.exportPOInvoice = exportPOInvoice;
  window.buildPOInvoiceHTML = (po, kind, db) => buildHTML(buildCtx(po, kind, db));

  // ================================================================
  // INVOICE → PDF  (Client & Freelancer invoices)
  // Shares the Words Tie PO palette, header, title band and footer.
  // ================================================================
  const STATUS_LABEL = { pending: "Pending", in_progress: "In Progress", completed: "Completed" };

  function buildInvoiceCtx(inv, side, db) {
    const isFl = side === "freelancer";
    const task = db.tasks.find((t) => t.task_number === inv.task_code);
    const from = { name: "Words Tie", address: "Suez canal st. Mansoura, Egypt", phone: "(+20) 102467283", email: "info@words-tie.com", website: "www.words-tie.com" };
    const shipTo = { name: "Words Tie For Translation & Localization", address: "Suez canal st. Mansoura, Egypt" };
    let party;
    if (isFl) {
      const fr = db.freelancers.find((x) => x.freelancer_code === inv.freelancer_code);
      party = { label: "Supplier · Freelancer", code: inv.freelancer_code || "", name: fr ? fr.name : (inv.freelancer_code || "Freelancer"), email: fr ? fr.email : "" };
    } else {
      const c = db.clients.find((x) => x.client_code === inv.client_code);
      party = { label: "Bill To · Client", code: inv.client_code || "", name: c ? c.name : (inv.client_code || "Client"), email: c ? c.email : "" };
    }
    const rows = isFl
      ? [["PO Number", inv.po_number || "—"], ["PO Sent Date", fmtDate(inv.po_sent_date)], ["Payment Due Date", fmtDate(inv.payment_due_date)]]
      : [["Client PO", inv.client_po || "—"], ["Project Name Client", inv.project_name_client || "—"], ["Deposit Payment Date", fmtDate(inv.date_20)], ["Remaining Payment Date", fmtDate(inv.date_80)], ["Deposit Amount", num(inv.payment_20)], ["Remaining Amount", num(inv.payment_80)]];
    return {
      invoiceNo: inv.invoice_code, side, title: isFl ? "Freelancer Invoice" : "Client Invoice",
      date: isFl ? inv.po_sent_date : inv.date_20, refNo: inv.task_code,
      currency: inv.currency || "USD", status: STATUS_LABEL[inv.status] || inv.status,
      from, shipTo, party, rows, total: isFl ? Number(inv.total_price || 0) : (Number(inv.payment_20 || 0) + Number(inv.payment_80 || 0)),
      totalLabel: isFl ? "Price" : "Total Price",
      notes: inv.notes || "", hasAttachment: !!(inv.attachment && inv.attachment.data),
      poNumber: isFl ? (inv.po_number || "") : "",
    };
  }

  function buildInvoiceHTML(ctx) {
    const cur = ctx.currency || "USD";
    const logo = window.WT_LOGO_DATA_URI || "";
    const contact = [ctx.from.address, [ctx.from.phone, ctx.from.email].filter(Boolean).join("  ·  "), ctx.from.website]
      .filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join("");
    const metaRow = (label, value, accent) => `<div class="m-lbl">${esc(label)}</div><div class="m-val${accent ? " accent" : ""}">${esc(value) || "—"}</div>`;
    const detailRows = ctx.rows.map((r) => `<tr><td class="c-svc">${esc(r[0])}</td><td class="c-amt">${esc(r[1])}</td></tr>`).join("");
    const supplierLines = [ctx.party.email].filter(Boolean).map((l) => `<div class="ln">${esc(l)}</div>`).join("");
    const shipToLines = [ctx.shipTo.address].filter(Boolean).map((l) => `<div class="ln">${esc(l)}</div>`).join("");

    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(ctx.invoiceNo)} — Words Tie Invoice</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Overlock:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { background:#e9edf2; }
  body { font-family:"Overlock", system-ui, sans-serif; color:${C.body}; -webkit-print-color-adjust:exact; print-color-adjust:exact; padding:28px 16px 60px; }
  .bar { position:fixed; top:0; left:0; right:0; z-index:9; display:flex; gap:10px; align-items:center; justify-content:center; background:rgba(20,24,28,.92); backdrop-filter:blur(6px); padding:11px; }
  .bar button { font-family:"Overlock",sans-serif; font-weight:700; font-size:13px; border:0; border-radius:9px; padding:9px 18px; cursor:pointer; }
  .bar .dl { background:${C.blue}; color:#fff; } .bar .cl { background:rgba(255,255,255,.14); color:#fff; }
  .bar .hint { color:rgba(255,255,255,.55); font-size:12px; font-weight:400; }
  .sheet { width:760px; margin:54px auto 0; background:#fff; padding:38px 40px 30px; box-shadow:0 18px 50px rgba(20,30,50,.18); border-radius:4px; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; }
  .brand .logo img { height:34px; display:block; margin-bottom:12px; }
  .brand .contact { font-size:10px; color:${C.muted}; line-height:1.7; }
  .head .meta { flex-shrink:0; display:grid; grid-template-columns:auto auto; gap:1px 14px; align-items:center; }
  .meta .m-lbl { font-size:9px; font-weight:700; letter-spacing:.7px; text-transform:uppercase; color:${C.muted}; text-align:right; line-height:1.25; }
  .meta .m-val { font-size:12.5px; font-weight:700; color:${C.ink}; text-align:right; min-width:120px; line-height:1.25; }
  .meta .m-val.accent { color:${C.blueDk}; }
  .titleband { margin:22px 0 22px; background:${C.blue}; color:#fff; text-align:center; font-weight:900; font-size:18px; letter-spacing:5px; text-transform:uppercase; padding:11px 0; border-radius:5px; }
  .parties { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:24px; }
  .party { border-radius:9px; padding:16px 18px; color:#fff; }
  .party.from { background:${C.ink}; } .party.to { background:${C.blueDk}; }
  .party .plbl { font-size:9.5px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; opacity:.62; margin-bottom:8px; }
  .party .pcode { font-size:11px; font-weight:700; letter-spacing:.06em; opacity:.78; margin-bottom:3px; }
  .party .pname { font-size:15px; font-weight:700; margin-bottom:6px; } .party .ln { font-size:11px; opacity:.85; line-height:1.6; }
  table.items { width:100%; border-collapse:collapse; }
  table.items thead th { background:${C.ink}; color:#fff; font-size:9.5px; font-weight:700; letter-spacing:.7px; text-transform:uppercase; padding:10px 11px; text-align:left; }
  table.items thead th.r { text-align:right; }
  table.items thead th:first-child { border-top-left-radius:6px; } table.items thead th:last-child { border-top-right-radius:6px; }
  table.items tbody td { font-size:11.5px; color:${C.ink}; padding:10px 11px; border-bottom:1px solid ${C.line}; height:30px; vertical-align:middle; }
  table.items tbody tr:nth-child(even) td { background:${C.tint}; }
  td.c-svc { font-weight:700; } td.c-amt { text-align:right; font-weight:700; white-space:nowrap; }
  .total-wrap { display:flex; justify-content:flex-end; margin-top:14px; }
  .total { display:flex; align-items:center; border-radius:7px; overflow:hidden; min-width:280px; }
  .total .tl { background:${C.ink}; color:#fff; font-size:13px; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:13px 18px; flex:1; }
  .total .tv { background:${C.blue}; color:#fff; font-size:16px; font-weight:900; padding:13px 18px; text-align:right; white-space:nowrap; }
  .lower { margin-top:28px; } .lower .h { font-size:9.5px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:${C.blueDk}; margin-bottom:7px; }
  .lower p { font-size:10.5px; color:${C.muted}; line-height:1.65; }
  .chips { margin-top:16px; display:flex; gap:10px; flex-wrap:wrap; }
  .chip { font-size:10px; font-weight:700; padding:6px 12px; border-radius:30px; background:${C.tint2}; color:${C.blueDk}; }
  .foot { margin-top:30px; padding-top:14px; border-top:1px solid ${C.line}; text-align:center; font-size:10px; font-weight:700; letter-spacing:.5px; color:${C.muted}; }
  @media print { @page { size:A4; margin:12mm; } html, body { background:#fff; padding:0; } .bar { display:none; } .sheet { width:auto; margin:0; box-shadow:none; border-radius:0; padding:0; } }
</style></head>
<body>
  <div class="bar">
    <button class="dl" onclick="window.print()">⤓  Save as PDF</button>
    <button class="cl" onclick="window.close()">Close</button>
    <span class="hint">Choose “Save as PDF” as the destination</span>
  </div>
  <div class="sheet">
    <div class="head">
      <div class="brand">
        <div class="logo">${logo ? `<img src="${logo}" alt="Words Tie">` : `<div style="font-weight:900;font-size:24px;color:${C.ink}">Words Tie</div>`}</div>
        <div class="contact">${contact}</div>
      </div>
      <div class="meta">
        ${metaRow("Invoice No.", ctx.invoiceNo, true)}
        ${metaRow("Task Code", ctx.refNo)}
        ${ctx.poNumber ? metaRow("PO Number", ctx.poNumber) : ""}
        ${metaRow("Date", fmtDate(ctx.date))}
        ${metaRow("Status", ctx.status)}
      </div>
    </div>
    <div class="titleband">${esc(ctx.title)}</div>
    <div class="parties">
      <div class="party from">
        <div class="plbl">${esc(ctx.party.label)}</div>
        ${ctx.party.code ? `<div class="pcode">${esc(ctx.party.code)}</div>` : ""}
        <div class="pname">${esc(ctx.party.name)}</div>
        ${supplierLines}
      </div>
      <div class="party to">
        <div class="plbl">From</div>
        <div class="pname">${esc(ctx.shipTo.name)}</div>
        ${shipToLines}
      </div>
    </div>
    <table class="items">
      <thead><tr><th>Detail</th><th class="r">Value</th></tr></thead>
      <tbody>${detailRows}<tr><td class="c-svc">Currency</td><td class="c-amt">${esc(cur)}</td></tr></tbody>
    </table>
    <div class="total-wrap"><div class="total"><div class="tl">${esc(ctx.totalLabel)}</div><div class="tv">${esc(cur)} ${num(ctx.total)}</div></div></div>
    ${ctx.notes ? `<div class="lower"><div class="h">Notes</div><p>${esc(ctx.notes).replace(/\n/g, "<br>")}</p></div>` : ""}
    <div class="foot">WORDS TIE${ctx.from.website ? "  ·  " + esc(ctx.from.website) : ""}${ctx.from.email ? "  ·  " + esc(ctx.from.email) : ""}</div>
  </div>
  ${ctx.autoPrint ? `<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},400);});</script>` : ""}
</body></html>`;
  }

  function exportInvoicePDF(inv, side, db, opts) {
    const ctx = buildInvoiceCtx(inv, side, db);
    ctx.autoPrint = !!(opts && opts.autoPrint);
    const html = buildInvoiceHTML(ctx);
    const w = window.open("", "_blank");
    if (!w) { window.dispatchEvent(new CustomEvent("wt-toast", { detail: { msg: "Allow pop-ups to export the PDF", kind: "info" } })); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }
  window.exportInvoicePDF = exportInvoicePDF;
  window.buildInvoicePDFHTML = (inv, side, db) => buildInvoiceHTML(buildInvoiceCtx(inv, side, db));
})();
