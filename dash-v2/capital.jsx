/* global React, ReactDOM, DB, useDB, useRouter, currentUser, nextCapitalCode,
   Icon, Btn, Badge, Card, PageHead, SearchField, Field, Input, Textarea, Select,
   Table, EmptyRow, usePaginate, Pager, Modal, useConfirm, toast, money, fmtDate,
   FinanceTabs */
const { useState: useCapS, useMemo: useCapM, useEffect: useCapE } = React;

// ====================================================================
// CAPITAL ENGINE — the cash-based source of truth for Company Capital.
// All Company Capital figures are computed from POSTED transactions in
// db.capitalLedger. Posted transactions are immutable: corrections are
// made with reversals or adjustments, never by editing history.
// Base currency is EGP; foreign amounts carry an exchange rate.
// ====================================================================
const Capital = (function () {
  const meta = () => ({ base_currency: "EGP", usd_rate: 50, ...(DB.get().capitalMeta || {}) });
  const rateFor = (cur, custom) => (custom != null && +custom > 0) ? +custom : (cur === "USD" ? (+meta().usd_rate || 50) : 1);
  const ledger = () => DB.get().capitalLedger || [];
  const nextId = () => ledger().reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;

  // Find an existing posted transaction for a linked source (for UI badges).
  const isPosted = (source_type, source_id, source_part) => ledger().find((t) =>
    t.status === "Posted" && t.source_type === source_type &&
    String(t.source_id) === String(source_id) && (t.source_part || "") === (source_part || ""));

  // Has this linked source EVER been posted (Posted or later Reversed)? Used by
  // the reconciler so a deliberately-reversed event is never silently re-posted.
  const existsForSource = (source_type, source_id, source_part) => ledger().find((t) =>
    t.source_type === source_type && String(t.source_id) === String(source_id) &&
    (t.source_part || "") === (source_part || ""));

  // Convert any amount+currency into the EGP base used by the ledger.
  function toBase(amount, currency, customRate) {
    return (+amount || 0) * rateFor(currency, customRate);
  }
  // Live available balance (Total − reserves) — the spendable cash.
  function available() { return compute().available; }
  // Guard a prospective cash-out: returns { ok, message }. Blocks any spend
  // that has no capital behind it or exceeds the available balance.
  function guardCashOut(baseAmount) {
    const avail = available();
    if (avail <= 0.0001)
      return { ok: false, message: "Insufficient available capital. Please add a capital entry or record a client payment before posting this payment." };
    if (baseAmount > avail + 0.0001)
      return { ok: false, message: `Insufficient available capital. Available balance is ${egp(avail)}, but this payment needs ${egp(baseAmount)}.` };
    return { ok: true };
  }

  // Low-level insert — stamps id, code, rate, base amount, audit fields.
  function insert(t) {
    const cur = t.currency || "EGP";
    const rate = rateFor(cur, t.rate);
    const base = t.base_amount != null ? t.base_amount : (+t.amount || 0) * rate;
    const row = {
      reserve: "", reserve_dir: "", reason: "", notes: "", reference: "", source_part: "",
      ...t,
      id: nextId(), txn_code: nextCapitalCode(ledger()),
      currency: cur, rate, base_amount: base,
      created_by: t.created_by || currentUser(DB.get()).name,
      posted_at: t.posted_at || new Date().toISOString(),
      status: "Posted", locked: true,
    };
    DB.insert("capitalLedger", row);
    return row;
  }

  // Idempotent post for a linked module cash event.
  function post(opts) {
    if (opts.source_type && opts.source_id) {
      const ex = existsForSource(opts.source_type, opts.source_id, opts.source_part);
      if (ex) return ex;
    }
    return insert(opts);
  }

  // Reconcile every module: post any cash event that isn't on the ledger yet.
  // Runs idempotently — re-running never double-counts.
  function syncFromModules() {
    const db = DB.get();
    (db.clientInvoices || []).forEach((inv) => {
      if (+inv.payment_20 > 0 && inv.date_20)
        post({ source_type: "client_invoice", source_id: inv.invoice_code, source_part: "deposit", type: "Income", direction: "In", source: "Client Invoice", reference: inv.invoice_code, description: `Deposit received · ${inv.task_code || ""}`.trim(), amount: +inv.payment_20, currency: inv.currency, date: inv.date_20 });
      if (+inv.payment_80 > 0 && inv.date_80)
        post({ source_type: "client_invoice", source_id: inv.invoice_code, source_part: "remaining", type: "Income", direction: "In", source: "Client Invoice", reference: inv.invoice_code, description: `Remaining received · ${inv.task_code || ""}`.trim(), amount: +inv.payment_80, currency: inv.currency, date: inv.date_80 });
    });
    (db.freelancerInvoices || []).forEach((inv) => {
      if (inv.status === "completed" && +inv.total_price > 0)
        post({ source_type: "freelancer_invoice", source_id: inv.invoice_code, source_part: "full", type: "Expense", direction: "Out", source: "Freelancer Invoice", reference: inv.invoice_code, description: `Freelancer payment · ${inv.task_code || ""}`.trim(), amount: +inv.total_price, currency: inv.currency, date: inv.date_80 || inv.payment_due_date || inv.date_20 });
    });
    (db.payroll || []).forEach((r) => {
      if (r.status === "Paid" && +r.salary > 0)
        post({ source_type: "payroll", source_id: r.payroll_id || r.id, source_part: "", type: "Expense", direction: "Out", source: "Payroll", reference: r.employee_code || "", description: `Payroll · ${r.name}${r.month ? " · " + r.month : ""}`, amount: +r.salary, currency: r.currency, date: r.paid_date || r.generated_at });
    });
    (db.maintenance || []).forEach((m) => {
      if (m.status === "Paid" && +m.amount > 0)
        post({ source_type: "maintenance", source_id: m.maintenance_id, source_part: "", type: "Expense", direction: "Out", source: "Maintenance", reference: m.maintenance_id, description: `${m.service_name}${m.vendor ? " · " + m.vendor : ""}`, amount: +m.amount, currency: m.currency, date: m.payment_date });
    });
  }

  // Reverse a posted transaction: create the mirror entry, mark original Reversed.
  function reverse(id, reason) {
    const orig = ledger().find((t) => t.id === id);
    if (!orig || orig.status !== "Posted") return null;
    const rev = insert({
      date: new Date().toISOString().slice(0, 10),
      type: "Reversal",
      direction: orig.direction === "In" ? "Out" : orig.direction === "Out" ? "In" : "Internal",
      source: orig.source, reference: orig.reference,
      description: `Reversal of ${orig.txn_code} — ${orig.description || ""}`.trim(),
      amount: orig.amount, currency: orig.currency, rate: orig.rate, base_amount: orig.base_amount,
      reserve: orig.reserve, reserve_dir: orig.reserve_dir === "to" ? "from" : orig.reserve_dir === "from" ? "to" : "",
      source_type: "reversal", source_id: orig.txn_code, source_part: "", reason,
    });
    DB.update("capitalLedger", orig.id, { status: "Reversed", reversed_by: rev.id, reversed_reason: reason });
    return rev;
  }

  // Keep a client invoice's posted cash in sync after its amounts are edited.
  // Posted transactions stay immutable; instead we post a small Adjustment for
  // the difference so the ledger total always matches the new invoice amount.
  function syncClientInvoiceEdit(code) {
    const inv = (DB.get().clientInvoices || []).find((x) => x.invoice_code === code);
    if (!inv) return;
    [["deposit", +inv.payment_20, inv.date_20], ["remaining", +inv.payment_80, inv.date_80]].forEach(([part, amt, date]) => {
      const posted = isPosted("client_invoice", code, part);
      if (!posted) return; // not yet posted → normal sync will create it
      const adjId = `${code}:${part}`;
      const priorAdj = ledger().filter((t) => t.source_type === "client_invoice_adjustment" && t.source_id === adjId && t.status === "Posted");
      const effective = posted.base_amount + priorAdj.reduce((s, t) => s + (t.direction === "In" ? t.base_amount : -t.base_amount), 0);
      const target = amt > 0 ? toBase(amt, inv.currency) : 0;
      const diff = target - effective;
      if (Math.abs(diff) < 0.005) return;
      insert({
        date: date || new Date().toISOString().slice(0, 10),
        type: "Adjustment", direction: diff > 0 ? "In" : "Out", source: "Adjustment", reference: code,
        description: `Client invoice ${code} edited — ${part} ${diff > 0 ? "increase" : "decrease"}`,
        amount: Math.abs(diff), currency: "EGP", rate: 1, base_amount: Math.abs(diff),
        source_type: "client_invoice_adjustment", source_id: adjId, source_part: part,
        reason: `Auto-adjustment to match edited invoice ${code} (${part}).`,
      });
    });
  }

  // its mirror reversal both count and cancel out (proper audit trail), so the
  // figures self-correct without ever editing locked history.
  function compute() {
    const L = ledger();
    const byCode = {};
    L.forEach((t) => { if (t.txn_code) byCode[t.txn_code] = t; });
    let opening = 0, emergency = 0, temporary = 0;
    let cashIn = 0, cashOut = 0, netCap = 0;
    const bucket = { client: 0, freelancer: 0, payroll: 0, maintenance: 0, manualIn: 0, manualOut: 0, adjustment: 0 };
    // Real client money received — the ONLY thing that counts as Total Cash In.
    const isClientMoney = (x) => !!x && (x.source === "Client Invoice" || x.source_type === "client_invoice_adjustment");
    const isManualAdjust = (x) => x.type === "Adjustment" || x.source === "Adjustment";

    L.forEach((t) => {
      if (t.type === "Transfer") {
        // Internal reserve movement — never touches Total Capital / Cash In / Out.
        const sign = t.reserve_dir === "to" ? 1 : -1;
        if (t.reserve === "emergency") emergency += sign * t.base_amount;
        else if (t.reserve === "temporary") temporary += sign * t.base_amount;
        return;
      }
      if (t.source_type === "opening") { opening += t.base_amount; return; }

      // Effect on Current Total Capital (opening + inflows − outflows ± adjustments).
      const cap = t.direction === "In" ? t.base_amount : -t.base_amount;
      netCap += cap;

      // Capital Breakdown buckets — signed by their capital effect, so a reversal
      // (mirror entry) cancels the original it offsets and the figures self-correct.
      if (isClientMoney(t)) bucket.client += cap;
      else if (t.source === "Freelancer Invoice") bucket.freelancer += cap;
      else if (t.source === "Payroll") bucket.payroll += cap;
      else if (t.source === "Maintenance") bucket.maintenance += cap;
      else if (isManualAdjust(t) && t.source_type !== "reversal") bucket.adjustment += cap;
      else if (t.direction === "In") bucket.manualIn += t.base_amount;
      else bucket.manualOut += t.base_amount;

      // ---- Total Cash In / Total Cash Out -----------------------------------
      // Cash In  = real client invoice money received only.
      // Cash Out = real outgoing expenses paid, NET of reversals.
      // Reversals offset their original — they never create a fake Cash In.
      if (t.source_type === "reversal") {
        const orig = byCode[t.source_id];
        if (isClientMoney(orig)) cashIn -= t.base_amount;              // undo client income
        else if (orig && orig.direction === "Out") cashOut -= t.base_amount; // expense reversal restores cash
        // reversal of a manual injection / other income only affects Total Capital
        return;
      }
      if (isClientMoney(t)) { cashIn += cap; return; }                 // only client money is Cash In
      if (isManualAdjust(t)) return;                                   // adjustments are ± to capital, not cash in/out
      if (t.direction === "Out") cashOut += t.base_amount;             // real outflow (expense / withdrawal)
      // non-client Cash In (manual injection, refund, other income) is NOT Total Cash In
    });

    const total = opening + netCap;
    const reserves = emergency + temporary;
    const available = total - reserves;

    // Remaining Due / Outstanding Receivables — money still owed by clients,
    // sourced from the Projects Ledger remaining balances. Informational only:
    // NOT part of Total Capital, Available Balance, Cash In, or Net Movement.
    let remainingDue = 0;
    (DB.get().projects || []).forEach((p) => { if ((p.payment_status || "") !== "Paid") remainingDue += (+p.remaining_amount || 0); });
    remainingDue *= rateFor("USD"); // projects are USD → express in the EGP base

    // Kept for backward compatibility (unpaid freelancer orders owed).
    let commitments = 0;
    (DB.get().freelancerInvoices || []).forEach((inv) => { if (inv.status !== "completed" && +inv.total_price > 0) commitments += (+inv.total_price) * rateFor(inv.currency); });

    return { opening, cashIn, cashOut, net: cashIn - cashOut, total, emergency, temporary, reserves, available, remainingDue, commitments, bucket };
  }

  return { meta, rateFor, ledger, isPosted, post, insert, syncFromModules, reverse, compute, toBase, available, guardCashOut, syncClientInvoiceEdit, resetTestData };

  // --------------------------------------------------------------------
  // PROTECTED RESET — clears only demo/manual/unlinked test transactions.
  // Transactions linked to real Client/Freelancer Invoices, Payroll,
  // Maintenance (and their adjustments), plus Opening balances, are NEVER
  // deleted — so the ledger can never desync from real records. A backup
  // snapshot is taken before anything is removed.
  // --------------------------------------------------------------------
  function resetTestData(meta2) {
    const PROTECTED = new Set(["client_invoice", "freelancer_invoice", "payroll", "maintenance", "client_invoice_adjustment", "opening", "opening_reserve"]);
    const db = DB.get();
    const L = db.capitalLedger || [];
    const byCode = {};
    L.forEach((t) => { if (t.txn_code) byCode[t.txn_code] = t; });
    const isTest = (t) => {
      if (PROTECTED.has(t.source_type)) return false;
      if (t.source_type === "reversal") { const o = byCode[t.source_id]; return !(o && PROTECTED.has(o.source_type)); }
      return ["manual", "adjustment", "reserve"].includes(t.source_type) || !t.source_type;
    };
    const removed = L.filter(isTest);
    const kept = L.filter((t) => !isTest(t));
    const snapshot = { at: new Date().toISOString(), by: (meta2 && meta2.by) || "—", scope: "Company Capital test/demo transactions", removed_count: removed.length, ledger: L };
    DB.set((s) => ({
      ...s,
      capitalLedger: kept,
      capitalBackups: [snapshot, ...(s.capitalBackups || [])].slice(0, 20),
      capitalAudit: [{ at: snapshot.at, by: snapshot.by, action: "Reset Company Capital test data", scope: snapshot.scope, removed: removed.length, backup_ref: snapshot.at }, ...(s.capitalAudit || [])],
    }));
    syncFromModules(); // re-post any linked module rows that should exist (idempotent)
    return { removed: removed.length, backup: snapshot };
  }
})();
window.Capital = Capital;

// ====================================================================
// Small shared bits
// ====================================================================
const CAP_USD_RATE = () => Capital.meta().usd_rate || 50;
const egp = (n) => money(n, "EGP");
const usd = (n) => money(n, "USD");
const baseUsd = (egpAmount) => (egpAmount || 0) / (CAP_USD_RATE() || 50);

const DIR_TONE = { In: "ok", Out: "danger", Internal: "info" };
const TYPE_TONE = { Income: "ok", Expense: "danger", Adjustment: "warn", Transfer: "info", Reversal: "warn" };

// Amount + currency + (USD) exchange-rate sub-form, shared by the modals.
function AmountFields({ f, set, showRate = true }) {
  const isUsd = f.currency === "USD";
  const rate = isUsd ? (+f.rate || CAP_USD_RATE()) : 1;
  const base = (+f.amount || 0) * rate;
  return (
    <>
      <Field label="Amount" required><Input type="number" step="0.01" min="0" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" /></Field>
      <Field label="Currency" required><Select value={f.currency} onChange={(e) => set("currency", e.target.value)}><option>EGP</option><option>USD</option></Select></Field>
      {showRate && isUsd ? <>
        <Field label="Exchange Rate" required hint="EGP per 1 USD"><Input type="number" step="0.01" min="0" value={f.rate ?? CAP_USD_RATE()} onChange={(e) => set("rate", e.target.value)} /></Field>
        <Field label="Amount in Base (EGP)" hint="Auto-calculated"><Input value={egp(base)} readOnly className="inp--auto" /></Field>
      </> : null}
    </>
  );
}

// ====================================================================
// COMPANY CAPITAL — cash-based capital ledger
// ====================================================================
function CompanyCapital() {
  const [db] = useDB();
  const me = currentUser(db);
  const canReset = (() => {
    const role = (db.roles || []).find((r) => r.name === me.role);
    return !!(role && (role.permissions || []).includes("Reset Company Capital Test Data"));
  })();
  const { go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const [modal, setModal] = useCapS(null);
  const [q, setQ] = useCapS("");
  const [fType, setFType] = useCapS("all");
  const [fStatus, setFStatus] = useCapS("all");

  // Reconcile module cash events into the ledger on first open (idempotent).
  useCapE(() => { Capital.syncFromModules(); }, []);

  const C = useCapM(() => Capital.compute(), [db]);
  const list = db.capitalLedger || [];

  const sync = () => { Capital.syncFromModules(); toast("Capital ledger reconciled with paid records"); };

  const reverseTxn = (t) => setModal({ kind: "reverse", data: t });
  const doReverse = (t, reason) => { Capital.reverse(t.id, reason); toast(`Reversed ${t.txn_code}`, "del"); };

  const filtered = useCapM(() => {
    const sorted = [...list].sort((a, b) => (b.posted_at || "").localeCompare(a.posted_at || "") || (b.id - a.id));
    return sorted.filter((t) => {
      if (fType !== "all" && t.type !== fType) return false;
      if (fStatus !== "all" && t.status !== fStatus) return false;
      if (!q) return true;
      const hay = `${t.txn_code} ${t.type} ${t.direction} ${t.source} ${t.reference} ${t.description} ${t.amount} ${t.currency} ${t.created_by} ${fmtDate(t.date)}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [list, q, fType, fStatus]);
  const { page, setPage, pages, slice, total } = usePaginate(filtered, 8);

  const exportCsv = () => {
    const cols = ["Txn ID", "Date", "Type", "Direction", "Source", "Reference", "Description", "Amount", "Currency", "Rate", "Base (EGP)", "Created By", "Posted At", "Status"];
    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const rows = [...list].sort((a, b) => (a.id - b.id)).map((t) => [t.txn_code, fmtDate(t.date), t.type, t.direction, t.source, t.reference, t.description, t.amount, t.currency, t.rate, t.base_amount, t.created_by, t.posted_at, t.status].map(esc).join(","));
    const blob = new Blob([cols.map(esc).join(",") + "\n" + rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "capital-ledger.csv"; a.click(); URL.revokeObjectURL(a.href);
    toast("Capital ledger exported");
  };

  const cards = [
    { label: "Current Total Capital", base: C.total, tone: "primary", ic: "bank", big: true },
    { label: "Available Balance", base: C.available, tone: C.available >= 0 ? "ok" : "danger", ic: "wallet" },
    { label: "Emergency Reserve", base: C.emergency, tone: "warn", ic: "shield" },
    { label: "Temporary Reserve", base: C.temporary, tone: "info", ic: "coin" },
    { label: "Total Cash In", base: C.cashIn, tone: "ok", ic: "arrow-down" },
    { label: "Total Cash Out", base: C.cashOut, tone: "danger", ic: "arrow-up" },
    { label: "Net Movement", base: C.net, tone: C.net >= 0 ? "ok" : "danger", ic: "file-dollar" },
    { label: "Remaining Due", base: C.remainingDue, tone: "muted", ic: "clock", sub: "Outstanding client receivables" },
  ];

  const breakdown = [
    { k: "Opening Capital", v: C.opening, sign: 1 },
    { k: "Client Payments Received", v: C.bucket.client, sign: 1, tone: "ok" },
    { k: "Freelancer Payments Paid", v: C.bucket.freelancer, sign: 1, tone: "danger" },
    { k: "Payroll Paid", v: C.bucket.payroll, sign: 1, tone: "danger" },
    { k: "Maintenance Paid", v: C.bucket.maintenance, sign: 1, tone: "danger" },
    { k: "Manual Capital Injections", v: C.bucket.manualIn, sign: 1, tone: "ok" },
    { k: "Manual Withdrawals", v: -C.bucket.manualOut, sign: 1, tone: "danger" },
    { k: "Adjustments", v: C.bucket.adjustment, sign: 1, tone: "warn" },
  ];

  const reserveBalances = { emergency: C.emergency, temporary: C.temporary, available: C.available };
  // Resolve a transaction's Reference / Linked Code to a navigation action.
  const refLink = (t) => {
    if (t.source === "Client Invoice" || t.source_type === "client_invoice_adjustment") { const inv = db.clientInvoices.find((x) => x.invoice_code === t.reference); return inv ? () => go("client-invoice", { id: inv.id }) : null; }
    if (t.source === "Freelancer Invoice") { const inv = db.freelancerInvoices.find((x) => x.invoice_code === t.reference); return inv ? () => go("freelancer-invoice", { id: inv.id }) : null; }
    if (t.source === "Maintenance") { const m = (db.maintenance || []).find((x) => x.maintenance_id === t.reference); return m ? () => go("maintenance-item", { id: m.id }) : null; }
    if (t.source === "Payroll") { const emp = (db.employees || []).find((e) => e.employee_code === t.reference); return emp ? () => go("employee", { id: emp.id }) : () => go("payroll"); }
    return null;
  };
  const sourceLink = (t) => refLink(t);

  return (
    <div className="fade-in">
      {confirmNode}
      <PageHead crumb={<span>Finance · Company Capital</span>} title="Company Capital"
        sub="Cash-based capital ledger — real money available, computed from posted transactions. Base currency EGP."
        actions={canReset ? <button className="cap-reset-btn" onClick={() => setModal({ kind: "reset" })} title="Clear Company Capital test/demo data"><Icon name="trash" size={16} /> Reset Test Data</button> : null} />
      <FinanceTabs active="capital" />

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {cards.map((c) => (
          <div className="stat" key={c.label}>
            <div className="stat__top"><div className={`stat__ic ic-${c.tone}`}><Icon name={c.ic} size={22} /></div></div>
            <div className="stat__label">{c.label}</div>
            <div className="stat__num" style={{ fontSize: c.big ? 27 : 23, marginBottom: 2 }}>{egp(c.base)}</div>
            <div className="t-muted" style={{ fontWeight: 600, fontSize: 13 }}>{c.sub ? c.sub : `≈ ${usd(baseUsd(c.base))}`}</div>
          </div>
        ))}
      </div>

      <div className="cap-actions-row">
        {can(db, "Export Capital Transactions") ? <Btn variant="ghost" icon="download" onClick={exportCsv}>Export</Btn> : <span></span>}
        <div className="cap-actions-row__spacer"></div>
        {can(db, "Transfer Reserve") ? <Btn variant="soft" icon="settings" onClick={() => setModal({ kind: "transfer" })}>Transfer Reserve</Btn> : null}
        {can(db, "Add Capital Adjustment") ? <Btn variant="soft" icon="file-dollar" onClick={() => setModal({ kind: "adjust" })}>Add Adjustment</Btn> : null}
        {can(db, "Add Capital Entry") ? <Btn variant="primary" icon="plus" onClick={() => setModal({ kind: "entry" })}>Add Capital Entry</Btn> : null}
      </div>

      <Card className="cap-txn-card">
        <div className="card__head">
          <h3 className="card__title">Capital Transactions</h3>
          <div className="flex items-center gap-10 wrap">
            <SearchField value={q} onChange={setQ} placeholder="Search code, source, reference…" />
            <Select className="inp" style={{ width: "auto" }} value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="all">All Types</option><option>Income</option><option>Expense</option><option>Adjustment</option><option>Transfer</option>
            </Select>
            <Select className="inp" style={{ width: "auto" }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="all">All Status</option><option>Posted</option><option>Reversed</option>
            </Select>
            <Btn variant="ghost" size="sm" icon="check" onClick={sync} title="Post any paid records not yet on the ledger">Sync</Btn>
          </div>
        </div>
        <Table columns={[{ label: "Txn ID", w: 108 }, { label: "Type", w: 118 }, { label: "Source", w: 150 }, { label: "Linked Code", w: 150 }, { label: "Amount", w: 132 }, { label: "Base (EGP)", w: 140 }, { label: "Status", w: 104 }, { label: "Actions", end: true, w: 92 }]}>
          {slice.length === 0 ? <EmptyRow span={8} icon="bank" text="No capital transactions yet." /> :
            slice.map((t) => {
              const signed = t.direction === "Internal" ? 0 : (t.direction === "In" ? 1 : -1);
              const rLink = refLink(t);
              return (
                <tr key={t.id} className="cap-row" style={t.status === "Reversed" ? { opacity: .6 } : undefined}>
                  <td><button className="code-pill" onClick={() => setModal({ kind: "detail", data: t })} title={`View transaction · ${fmtDate(t.date)}`}>{t.txn_code}</button></td>
                  <td><span className="cap-type"><Badge variant={t.source_type === "reversal" ? "warn" : (TYPE_TONE[t.type] || "muted")}>{t.source_type === "reversal" ? "Reversal" : t.type}</Badge><span className="cap-dir">{t.direction}</span></span></td>
                  <td className="cap-nowrap">{t.source}</td>
                  <td className="cell-mono">{t.reference
                    ? (rLink
                      ? <button className="code-pill" onClick={rLink} title="Open linked record">{t.reference}</button>
                      : <span className="code-pill" style={{ cursor: "default" }}>{t.reference}</span>)
                    : <span className="muted">—</span>}</td>
                  <td className="cell-mono cap-nowrap" style={{ color: signed > 0 ? "var(--ok)" : signed < 0 ? "var(--danger,#e0566b)" : "var(--ink-3)", fontWeight: 600 }}>{signed < 0 ? "−" : signed > 0 ? "+" : ""}{money(t.amount, t.currency)}</td>
                  <td className="cell-mono lead-cell cap-nowrap">{egp(t.base_amount)}</td>
                  <td><Badge variant={t.status === "Reversed" ? "muted" : "ok"}>{t.status}</Badge></td>
                  <td className="text-end"><div className="row-actions">
                    <button className="act act--view" title="View details" onClick={() => setModal({ kind: "detail", data: t })}><Icon name="eye" size={16} /></button>
                    {t.status === "Posted" && t.source_type !== "opening" && t.source_type !== "opening_reserve" && can(db, "Reverse Capital Transaction")
                      ? <button className="act act--del" title="Reverse transaction" onClick={() => reverseTxn(t)}><Icon name="arrow-left" size={16} /></button>
                      : null}
                  </div></td>
                </tr>
              );
            })}
        </Table>
        <div className="card__foot"><Pager page={page} pages={pages} setPage={setPage} total={total} /></div>
      </Card>

      <Card className="calc-summary" style={{ marginTop: 18 }}>
        <div className="card__body">
          <h3 className="card__title" style={{ marginBottom: 18 }}>Capital Breakdown</h3>
          <div className="cap-breakdown-cols">
            <div>
              {breakdown.map((b) => (
                <div className="calc-sum-row" key={b.k}>
                  <span>{b.k}</span>
                  <span style={b.tone === "danger" ? { color: "var(--danger,#e0566b)" } : b.tone === "ok" ? { color: "var(--ok)" } : undefined}>{b.v < 0 ? "−" : b.v > 0 && b.tone !== "warn" ? "+" : ""}{egp(Math.abs(b.v))}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="calc-sum-row strong"><span>Current Total Capital</span><span>{egp(C.total)}</span></div>
              <div className="calc-sum-row"><span>− Emergency Reserve</span><span>{egp(C.emergency)}</span></div>
              <div className="calc-sum-row"><span>− Temporary Reserve</span><span>{egp(C.temporary)}</span></div>
              <div className="calc-grand">
                <div><div className="calc-grand__label">Available Balance</div><div className="calc-grand__eff">free cash, reserves excluded</div></div>
                <div className="calc-grand__num" style={{ color: C.available >= 0 ? undefined : "var(--danger,#e0566b)" }}>{egp(C.available)}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {modal && modal.kind === "entry" ? <CapEntryModal db={db} onClose={() => setModal(null)} /> : null}
      {modal && modal.kind === "adjust" ? <CapAdjustModal db={db} onClose={() => setModal(null)} /> : null}
      {modal && modal.kind === "transfer" ? <CapTransferModal db={db} balances={reserveBalances} onClose={() => setModal(null)} /> : null}
      {modal && modal.kind === "detail" ? <CapDetailModal t={modal.data} db={db} onClose={() => setModal(null)} onReverse={(t) => { setModal(null); reverseTxn(t); }} sourceLink={sourceLink(modal.data)} /> : null}
      {modal && modal.kind === "reverse" ? <CapReverseModal t={modal.data} onClose={() => setModal(null)} onConfirm={(reason) => { doReverse(modal.data, reason); setModal(null); }} /> : null}
      {modal && modal.kind === "reset" ? <CapResetModal me={me} onClose={() => setModal(null)} /> : null}
    </div>
  );
}

// ---- Add Capital Entry (manual cash in / out) ----------------------
// Direction is fixed by the entry type so the user can never pick the wrong sign.
const ENTRY_KINDS = [
  { v: "injection", label: "Capital Injection (owner adds money)", dir: "In", type: "Income", source: "Manual Entry" },
  { v: "withdrawal", label: "Owner Withdrawal", dir: "Out", type: "Expense", source: "Manual Entry" },
  { v: "refund", label: "Refund Received", dir: "In", type: "Income", source: "Manual Entry" },
  { v: "other_income", label: "Other Income", dir: "In", type: "Income", source: "Manual Entry" },
  { v: "other_expense", label: "Other Expense", dir: "Out", type: "Expense", source: "Manual Entry" },
];
function CapEntryModal({ db, onClose }) {
  const [f, setF] = useCapS({ kind: "injection", amount: "", currency: "EGP", rate: CAP_USD_RATE(), date: new Date().toISOString().slice(0, 10), notes: "" });
  const [err, setErr] = useCapS({});
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const kind = ENTRY_KINDS.find((k) => k.v === f.kind);
  const save = () => {
    const e = {};
    if (!(+f.amount > 0)) e.amount = "Amount must be greater than zero.";
    if (!f.currency) e.currency = "Currency is required.";
    if (!f.date) e.date = "Date is required.";
    if (f.currency === "USD" && !(+f.rate > 0)) e.rate = "Exchange rate is required.";
    setErr(e); if (Object.keys(e).length) { toast("Please fix the highlighted fields", "del"); return; }
    // Block any cash-out that exceeds available capital.
    if (kind.dir === "Out") {
      const g = Capital.guardCashOut(Capital.toBase(f.amount, f.currency, f.rate));
      if (!g.ok) { setErr({ amount: g.message }); toast(g.message, "del"); return; }
    }
    Capital.insert({
      date: f.date, type: kind.type, direction: kind.dir, source: kind.source, reference: "Manual Entry",
      description: kind.label, amount: +f.amount, currency: f.currency, rate: f.currency === "USD" ? +f.rate : 1,
      source_type: "manual", source_id: "manual", source_part: "", notes: f.notes,
    });
    toast(`${kind.dir === "In" ? "Cash in" : "Cash out"} posted to Company Capital`);
    onClose();
  };
  return (
    <Modal title="Add Capital Entry" lg onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" icon="check" onClick={save}>Post Transaction</Btn></>}>
      <div className="form-grid">
        <Field label="Entry Type" required span={12}>
          <Select value={f.kind} onChange={(e) => set("kind", e.target.value)}>{ENTRY_KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}</Select>
        </Field>
        <AmountFields f={f} set={set} />
        <Field label="Date" required error={err.date}><DateInput value={f.date} onChange={(v) => set("date", v)} /></Field>
        <Field label="Direction" hint="Determined by entry type"><Input value={kind.dir === "In" ? "Cash In (+)" : "Cash Out (−)"} readOnly className="inp--auto" /></Field>
        <Field label="Notes" span={12}><Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" /></Field>
      </div>
      {err.amount ? <p className="err" style={{ marginTop: 6 }}>{err.amount}</p> : null}
    </Modal>
  );
}

// ---- Add Adjustment ------------------------------------------------
function CapAdjustModal({ db, onClose }) {
  const [f, setF] = useCapS({ direction: "Out", amount: "", currency: "EGP", rate: CAP_USD_RATE(), date: new Date().toISOString().slice(0, 10), description: "", reason: "" });
  const [err, setErr] = useCapS({});
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    const e = {};
    if (!(+f.amount > 0)) e.amount = "Amount must be greater than zero.";
    if (!f.date) e.date = "Date is required.";
    if (f.currency === "USD" && !(+f.rate > 0)) e.rate = "Exchange rate is required.";
    if (!f.reason.trim()) e.reason = "An adjustment reason is required.";
    setErr(e); if (Object.keys(e).length) { toast("Please fix the highlighted fields", "del"); return; }
    if (f.direction === "Out") {
      const g = Capital.guardCashOut(Capital.toBase(f.amount, f.currency, f.rate));
      if (!g.ok) { setErr({ ...e, amount: g.message }); toast(g.message, "del"); return; }
    }
    Capital.insert({
      date: f.date, type: "Adjustment", direction: f.direction, source: "Adjustment", reference: "Adjustment",
      description: f.description || `Capital adjustment (${f.direction === "In" ? "increase" : "decrease"})`,
      amount: +f.amount, currency: f.currency, rate: f.currency === "USD" ? +f.rate : 1,
      source_type: "adjustment", source_id: "adjustment", source_part: "", reason: f.reason,
    });
    toast("Adjustment posted to Company Capital");
    onClose();
  };
  return (
    <Modal title="Add Adjustment" lg onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" icon="check" onClick={save}>Post Adjustment</Btn></>}>
      <p className="muted" style={{ margin: "0 0 14px", fontSize: 13.5 }}>Adjustments correct capital without editing locked history. Use a positive adjustment to add money back, a negative one to take it out.</p>
      <div className="form-grid">
        <Field label="Adjustment Direction" required span={12}>
          <Select value={f.direction} onChange={(e) => set("direction", e.target.value)}>
            <option value="In">Increase Capital (Cash In +)</option>
            <option value="Out">Decrease Capital (Cash Out −)</option>
          </Select>
        </Field>
        <AmountFields f={f} set={set} />
        <Field label="Date" required error={err.date}><DateInput value={f.date} onChange={(v) => set("date", v)} /></Field>
        <Field label="Description" span={6}><Input value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. Payroll correction" /></Field>
        <Field label="Reason" required span={12} error={err.reason}><Textarea rows={2} value={f.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Why is this adjustment needed?" /></Field>
      </div>
      {err.amount ? <p className="err" style={{ marginTop: 6 }}>{err.amount}</p> : null}
    </Modal>
  );
}

// ---- Transfer Reserve (internal, does not change Total Capital) -----
// Money moves between three wallets: Available Balance, Emergency Reserve and
// Temporary Reserve. Each transfer is recorded as internal reserve movements
// so Current Total Capital never changes.
const WALLETS = [
  { v: "available", label: "Available Balance" },
  { v: "emergency", label: "Emergency Reserve" },
  { v: "temporary", label: "Temporary Reserve" },
];
function CapTransferModal({ db, balances, onClose }) {
  const [f, setF] = useCapS({ from: "available", to: "emergency", amount: "", currency: "EGP", rate: CAP_USD_RATE(), date: new Date().toISOString().slice(0, 10), notes: "" });
  const [err, setErr] = useCapS({});
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const rate = f.currency === "USD" ? (+f.rate || CAP_USD_RATE()) : 1;
  const base = (+f.amount || 0) * rate;
  const balOf = (w) => w === "available" ? balances.available : w === "emergency" ? balances.emergency : balances.temporary;
  const label = (w) => (WALLETS.find((x) => x.v === w) || {}).label;
  const save = () => {
    const e = {};
    if (f.from === f.to) e.to = "From and To must be different wallets.";
    if (!(+f.amount > 0)) e.amount = "Amount must be greater than zero.";
    if (!f.date) e.date = "Date is required.";
    if (f.currency === "USD" && !(+f.rate > 0)) e.rate = "Exchange rate is required.";
    if (!e.amount && base > balOf(f.from) + 0.001) e.amount = `Only ${egp(balOf(f.from))} available in ${label(f.from)}.`;
    setErr(e); if (Object.keys(e).length) { toast("Please fix the highlighted fields", "del"); return; }
    // Translate the From → To move into reserve ledger rows. "available" is the
    // implicit pool, so a move only touches the reserve wallet(s) involved.
    const note = f.notes || `Transfer ${label(f.from)} → ${label(f.to)}`;
    const common = { date: f.date, type: "Transfer", direction: "Internal", source: "Reserve Transfer", amount: +f.amount, currency: f.currency, rate, source_type: "reserve", source_id: "reserve", source_part: "", notes: f.notes };
    const rows = [];
    const reserveRow = (reserve, dir) => ({ ...common, reference: reserve === "emergency" ? "Emergency Reserve" : "Temporary Reserve", reserve, reserve_dir: dir, description: note });
    if (f.from === "available") rows.push(reserveRow(f.to, "to"));
    else if (f.to === "available") rows.push(reserveRow(f.from, "from"));
    else { rows.push(reserveRow(f.from, "from")); rows.push(reserveRow(f.to, "to")); }
    rows.forEach((r) => Capital.insert(r));
    toast(`Transferred ${egp(base)} · ${label(f.from)} → ${label(f.to)}`);
    onClose();
  };
  return (
    <Modal title="Transfer Reserve" lg onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" icon="check" onClick={save}>Transfer</Btn></>}>
      <p className="muted" style={{ margin: "0 0 14px", fontSize: 13.5 }}>Internal transfers move money between Available Balance and the reserve wallets. They are not income or expense and never change Current Total Capital.</p>
      <div className="form-grid">
        <Field label="From" required>
          <Select value={f.from} onChange={(e) => set("from", e.target.value)}>{WALLETS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}</Select>
        </Field>
        <Field label="To" required error={err.to}>
          <Select value={f.to} onChange={(e) => set("to", e.target.value)}>{WALLETS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}</Select>
        </Field>
        <AmountFields f={f} set={set} />
        <Field label="Date" required error={err.date}><DateInput value={f.date} onChange={(v) => set("date", v)} /></Field>
        <Field label="Notes" span={12}><Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" /></Field>
      </div>
      <div className="flex gap-16 wrap" style={{ marginTop: 4 }}>
        <span className="muted" style={{ fontSize: 12.5 }}>{label(f.from)}: <b>{egp(balOf(f.from))}</b></span>
        <span className="muted" style={{ fontSize: 12.5 }}>{label(f.to)}: <b>{egp(balOf(f.to))}</b></span>
        <span className="muted" style={{ fontSize: 12.5 }}>This transfer: <b>{egp(base)}</b></span>
      </div>
      {err.amount ? <p className="err" style={{ marginTop: 6 }}>{err.amount}</p> : null}
    </Modal>
  );
}

// ---- Transaction Detail --------------------------------------------
function CapDetailModal({ t, db, onClose, onReverse, sourceLink }) {
  const rev = t.reversed_by ? (db.capitalLedger || []).find((x) => x.id === t.reversed_by) : null;
  const orig = t.source_type === "reversal" ? (db.capitalLedger || []).find((x) => x.txn_code === t.source_id) : null;
  const row = (k, v, mono) => (<div className="info-cell"><span className="info-cell__k">{k}</span><span className={`info-cell__v${mono ? " cell-mono" : ""}`}>{(v === 0 || v) ? v : "—"}</span></div>);
  return (
    <Modal title={`Transaction ${t.txn_code}`} lg onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Close</Btn>
      {sourceLink ? <Btn variant="soft" icon="external-link" onClick={sourceLink}>Open Source</Btn> : null}
      {t.status === "Posted" && t.source_type !== "opening" && t.source_type !== "opening_reserve"
        ? <Btn variant="danger-soft" icon="arrow-left" onClick={() => onReverse(t)}>Reverse</Btn> : null}
    </>}>
      <div className="info-grid">
        {row("Transaction ID", <span className="code-pill">{t.txn_code}</span>)}
        {row("Status", <Badge variant={t.status === "Reversed" ? "muted" : "ok"}>{t.status}</Badge>)}
        {row("Date", fmtDate(t.date), true)}
        {row("Type", <Badge variant={TYPE_TONE[t.type] || "muted"}>{t.type}</Badge>)}
        {row("Direction", <Badge variant={DIR_TONE[t.direction] || "muted"}>{t.direction}</Badge>)}
        {row("Source", t.source)}
        {row("Reference", t.reference || "—", true)}
        {t.reserve ? row("Reserve", `${t.reserve === "emergency" ? "Emergency" : "Temporary"} (${t.reserve_dir})`) : null}
        {row("Amount", money(t.amount, t.currency), true)}
        {row("Currency", t.currency, true)}
        {row("Exchange Rate", t.currency === "USD" ? `${t.rate} EGP / USD` : "1.00", true)}
        {row("Amount in Base (EGP)", egp(t.base_amount), true)}
        {row("Created By", t.created_by)}
        {row("Posted At", t.posted_at ? fmtDate(t.posted_at.slice(0, 10)) : "—", true)}
        <div className="info-cell" style={{ gridColumn: "1 / -1" }}><span className="info-cell__k">Description</span><span className="info-cell__v">{t.description || "—"}</span></div>
        {t.reason ? <div className="info-cell" style={{ gridColumn: "1 / -1" }}><span className="info-cell__k">Reason</span><span className="info-cell__v">{t.reason}</span></div> : null}
        {t.notes ? <div className="info-cell" style={{ gridColumn: "1 / -1" }}><span className="info-cell__k">Notes</span><span className="info-cell__v">{t.notes}</span></div> : null}
        {rev ? <div className="info-cell" style={{ gridColumn: "1 / -1" }}><span className="info-cell__k">Reversed By</span><span className="info-cell__v cell-mono">{rev.txn_code}{t.reversed_reason ? ` — ${t.reversed_reason}` : ""}</span></div> : null}
        {orig ? <div className="info-cell" style={{ gridColumn: "1 / -1" }}><span className="info-cell__k">Reverses</span><span className="info-cell__v cell-mono">{orig.txn_code} — {orig.description}</span></div> : null}
      </div>
    </Modal>
  );
}

// ---- Reverse confirmation ------------------------------------------
function CapReverseModal({ t, onClose, onConfirm }) {
  const [reason, setReason] = useCapS("");
  const [err, setErr] = useCapS("");
  const go = () => { if (!reason.trim()) { setErr("A reversal reason is required."); return; } onConfirm(reason.trim()); };
  return (
    <Modal title={`Reverse ${t.txn_code}`} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="danger" icon="arrow-left" onClick={go}>Reverse Transaction</Btn></>}>
      <p style={{ margin: "0 0 14px", color: "var(--ink-3)", fontSize: 14.5 }}>
        This creates an opposite <b>{money(t.amount, t.currency)}</b> entry and marks <b>{t.txn_code}</b> as Reversed. The original stays in history for audit.
      </p>
      <Field label="Reversal Reason" required error={err}>
        <Textarea rows={3} value={reason} onChange={(e) => { setReason(e.target.value); if (err) setErr(""); }} placeholder="Why is this transaction being reversed?" />
      </Field>
    </Modal>
  );
}

Object.assign(window, { Capital, CompanyCapital });

// ---- Protected Reset of Company Capital test/demo data -------------
// Strong multi-step safeguard: backup → typed phrase → password → reset.
const RESET_PHRASE = "RESET COMPANY CAPITAL";
function CapResetModal({ me, onClose }) {
  const [db] = useDB();
  const canExport = can(db, "Export Company Capital Backup");
  const [backedUp, setBackedUp] = useCapS(false);
  const [phrase, setPhrase] = useCapS("");
  const [pw, setPw] = useCapS("");
  const [done, setDone] = useCapS(null);
  const [busy, setBusy] = useCapS(false);

  // Real ZIP backup (capital_backup.xlsx + raw-data.json) — generated by
  // the shared WTBackup helper from system-reset.jsx. No JSON-only export.
  const exportBackup = async () => {
    if (busy) return;
    if (!canExport) { toast("You do not have permission to perform this action.", "del"); return; }
    setBusy(true);
    try {
      if (!window.WTBackup) throw new Error("Backup module not loaded");
      await window.WTBackup.exportCapital(me);
      setBackedUp(true);
      toast("Backup ZIP exported. You can now continue.");
    } catch (e) {
      setBackedUp(false);
      toast("Backup failed. Nothing was changed.", "del");
    }
    setBusy(false);
  };

  const phraseOk = phrase.trim().toUpperCase() === RESET_PHRASE;
  const pwOk = pw.trim().length > 0 && (!me.password || pw === me.password);
  const canReset = backedUp && phraseOk && pwOk;

  const doReset = () => {
    if (!canReset) return;
    const res = Capital.resetTestData({ by: me.name });
    setDone(res);
    toast("Company Capital test data was reset successfully.");
  };

  if (done) {
    return (
      <Modal title="Reset Complete" onClose={onClose} footer={<Btn variant="primary" icon="check" onClick={onClose}>Done</Btn>}>
        <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--ok-soft, #e6f6ec)", color: "var(--ok)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Icon name="check" size={26} /></div>
          <p style={{ margin: 0, fontSize: 15 }}>Cleared <b>{done.removed}</b> test/demo transaction{done.removed === 1 ? "" : "s"}. Linked invoice, payroll and maintenance records were preserved, and capital totals were recalculated.</p>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>A backup snapshot and audit entry were recorded.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Reset Company Capital Test Data" lg onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="danger" icon="trash" onClick={doReset} disabled={!canReset}>Reset Test Data</Btn>
    </>}>
      <div className="cap-reset-warn">
        <Icon name="alert-triangle" size={20} />
        <div>This clears <b>Company Capital test/demo data only</b> (manual entries, adjustments, reserve transfers and their reversals). Transactions linked to real Client/Freelancer Invoices, Payroll and Maintenance are preserved. This may affect capital balances — please export a backup first.</div>
      </div>

      <div className="cap-reset-step">
        <div className="cap-reset-step__n" data-on={backedUp}>{backedUp ? <Icon name="check" size={14} /> : "1"}</div>
        <div style={{ flex: 1 }}>
          <div className="cap-reset-step__t">Export &amp; Verify Backup (ZIP)</div>
          <Btn variant="soft" size="sm" icon="download" onClick={exportBackup} disabled={!canExport} title={canExport ? "" : "You do not have permission to perform this action."}>{busy ? "Generating ZIP…" : backedUp ? "Backup Exported ✓" : "Export & Verify Backup (ZIP)"}</Btn>
          {!canExport ? <p className="muted" style={{ fontSize: 12, margin: "7px 0 0" }}>You do not have permission to export this backup.</p> : null}
        </div>
      </div>

      <div className="cap-reset-step">
        <div className="cap-reset-step__n" data-on={phraseOk}>{phraseOk ? <Icon name="check" size={14} /> : "2"}</div>
        <div style={{ flex: 1 }}>
          <Field label={<>Type <code>{RESET_PHRASE}</code> to confirm</>}>
            <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder={RESET_PHRASE} disabled={!backedUp} />
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
