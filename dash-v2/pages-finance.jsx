/* global React, useDB, useRouter, DB, Icon, Btn, Badge, StatusBadge, Card, PageHead, SearchField, Field, Input, Textarea, Select, Table, EmptyRow, usePaginate, Pager, Modal, useConfirm, toast, money, fmtDate */
const { useState: useFS, useMemo: useFM } = React;

const FIN_TABS = [
  { name: "finance-dashboard", label: "Dashboard", icon: "briefcase" },
  { name: "client-invoices", label: "Client Invoices", icon: "file-invoice" },
  { name: "freelancer-invoices", label: "Freelancer Invoices", icon: "file-invoice" },
  { name: "projects", label: "Projects Ledger", icon: "briefcase" },
  { name: "payroll", label: "Payroll", icon: "wallet" },
  { name: "maintenance", label: "Maintenance", icon: "settings" },
  { name: "capital", label: "Company Capital", icon: "bank" },
];

// EGP→USD conversion used to express the all-in dashboard totals in one
// currency. Projects-ledger amounts are already USD; maintenance can be EGP.
const EGP_PER_USD = 50;
const toUSD = (amount, currency) => (currency === "EGP" ? (+amount || 0) / EGP_PER_USD : (+amount || 0));
// month key + numeric label (no month names, per the dd/mm/yyyy standard)
const monthKey = (s) => { const d = new Date(s); return isNaN(d) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const monthLabel = (key) => { const [y, m] = String(key).split("-"); return `${m}/${y}`; };

// invoice collection metadata, keyed by side
const INV_META = {
  client: { coll: "clientInvoices", codeField: "client_code", partyLabel: "Client", route: "client", entity: "clients", entityCode: "client_code" },
  freelancer: { coll: "freelancerInvoices", codeField: "freelancer_code", partyLabel: "Freelancer", route: "freelancer", entity: "freelancers", entityCode: "freelancer_code" },
};

function FinanceTabs({ active }) {
  const { go } = useRouter();
  return (
    <div className="pill-tabs">
      {FIN_TABS.map((t) => (
        <button key={t.name} className={`pill-tab${active === t.name ? " on" : ""}`} onClick={() => go(t.name)}>
          <span className="flex items-center gap-8"><Icon name={t.icon} size={16} /> {t.label}</span>
        </button>
      ))}
    </div>
  );
}

function FinanceStat({ label, value, tone, ic }) {
  return (
    <div className="stat">
      <div className="stat__top"><div className={`stat__ic ic-${tone}`}><Icon name={ic} size={23} /></div></div>
      <div className="stat__label">{label}</div>
      <div className="stat__num" style={{ fontSize: 27 }}>{value}</div>
    </div>
  );
}

// ===================================================================
// INVOICES — view: "all" (overview) | "client" | "freelancer"
// ===================================================================
// Open a generated invoice PDF (preview, or auto-print for download).
function invoicePdf(inv, side, db, autoPrint) {
  if (window.exportInvoicePDF) window.exportInvoicePDF(inv, side, db, { autoPrint });
}

function Invoices({ view = "all" }) {
  const [db] = useDB();
  const { go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const [q, setQ] = useFS("");
  const [status, setStatus] = useFS("");
  const [month, setMonth] = useFS("");
  const [modal, setModal] = useFS(null);
  const [resetOpen, setResetOpen] = useFS(false);
  const isAll = view === "all";
  const isFl = view === "freelancer";
  const viewInv = (i) => go(i._side === "freelancer" ? "freelancer-invoice" : "client-invoice", { id: i.id });

  // build the working list (tag each row with its side)
  const list = useFM(() => {
    if (isAll) return [
      ...db.clientInvoices.map((i) => ({ ...i, _side: "client" })),
      ...db.freelancerInvoices.map((i) => ({ ...i, _side: "freelancer" })),
    ];
    return db[INV_META[view].coll].map((i) => ({ ...i, _side: view }));
  }, [db, view, isAll]);

  // primary date for a row (client: deposit date; freelancer: PO sent date)
  const rowDate = (i) => i._side === "freelancer" ? (i.po_sent_date || i.payment_due_date) : (i.date_20 || i.date_80);
  // Client total is always Deposit + Remaining (derived, robust to legacy data);
  // freelancer price comes from the linked PO amount stored on total_price.
  const invTotal = (i) => i._side === "client" ? ((+i.payment_20 || 0) + (+i.payment_80 || 0)) : (+i.total_price || 0);
  // month options present in the data, newest first → [{ key:'2026-06', label:'June 2026' }]
  const monthOpts = useFM(() => {
    const set = new Map();
    list.forEach((i) => { const d = rowDate(i); if (d && /^\d{4}-\d{2}/.test(d)) { const k = d.slice(0, 7); if (!set.has(k)) set.set(k, new Date(d).toLocaleString("en-US", { month: "long", year: "numeric" })); } });
    return [...set.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, label]) => ({ key, label }));
  }, [list]);

  const filtered = useFM(() => list.filter((i) => {
    if (status && i.status !== status) return false;
    if (month) { const d = rowDate(i); if (!d || d.slice(0, 7) !== month) return false; }
    if (!q) return true;
    const m = INV_META[i._side];
    const dates = [i.date_20, i.date_80, i.po_sent_date, i.payment_due_date].filter(Boolean).map(fmtDate).join(" ");
    return `${i.invoice_code} ${i.po_number || ""} ${i.task_code} ${i[m.codeField]} ${m.partyLabel} ${i.status} ${i.currency} ${i.total_price} ${dates}`.toLowerCase().includes(q.toLowerCase());
  }), [list, q, status, month]);
  const { page, setPage, pages, slice, total } = usePaginate(filtered, 7);

  const totals = useFM(() => {
    const usd = list.filter((i) => i.currency === "USD").reduce((s, i) => s + invTotal(i), 0);
    const egp = list.filter((i) => i.currency === "EGP").reduce((s, i) => s + invTotal(i), 0);
    const paid = list.filter((i) => i.status === "completed").length;
    const clientCount = list.filter((i) => i._side === "client").length;
    const flCount = list.filter((i) => i._side === "freelancer").length;
    return { usd, egp, paid, pending: list.length - paid, clientCount, flCount };
  }, [list]);

  const del = async (i) => {
    const m = INV_META[i._side];
    if (await confirm({ title: "Delete invoice?", message: `Remove invoice for ${i.task_code}?`, danger: true, okLabel: "Delete" })) {
      DB.remove(m.coll, i.id); toast("Invoice deleted", "del");
    }
  };
  const openPO = (poNo) => { const po = (db.vendorPOs || []).find((p) => p.po_number === poNo); if (po && window.exportPOInvoice) window.exportPOInvoice(po, "vendor", db, { autoPrint: false }); };
  // Open a stored invoice attachment (data-URL) in a new tab — kept separate
  // from the generated PDF so it never appears inside the invoice document.
  const openAttachment = (i) => {
    const a = i.attachment; if (!a || !a.data) return;
    const w = window.open(); if (w) w.document.write(`<title>${a.name || "Attachment"}</title><body style="margin:0"><iframe src="${a.data}" style="border:0;width:100vw;height:100vh"></iframe></body>`);
  };

  const newSide = isAll ? "client" : view;
  const sub = isAll ? "All client and freelancer invoices."
    : view === "client" ? "Client invoices with deposit / remaining payment tracking."
    : "Freelancer invoices — PO sent, payment due and price.";
  const title = isAll ? "Invoices" : view === "client" ? "Client Invoices" : "Freelancer Invoices";
  const activeTab = isAll ? "invoices" : `${view === "client" ? "client" : "freelancer"}-invoices`;
  const partyHeader = isAll ? "Party" : INV_META[view].partyLabel;

  // side-aware columns
  const columns = isFl
    ? [{ label: "Invoice Code" }, { label: "PO Number" }, { label: "Task Code" }, { label: "Freelancer" }, { label: "PO Sent Date" }, { label: "Payment Due Date" }, { label: "Price" }, { label: "Currency" }, { label: "Status" }, { label: "Actions", end: true }]
    : isAll
      ? [{ label: "Invoice Code" }, { label: "Task Code" }, { label: partyHeader }, { label: "Date" }, { label: "Total" }, { label: "Status" }, { label: "Actions", end: true }]
      : [{ label: "Invoice Code" }, { label: "Task Code" }, { label: "Client" }, { label: "Deposit Date" }, { label: "Remaining Date" }, { label: "Deposit" }, { label: "Remaining" }, { label: "Total" }, { label: "Status" }, { label: "Actions", end: true }];
  const span = columns.length;

  const actions = (i) => {
    const isFlSide = i._side === "freelancer";
    const canEdit = can(db, isFlSide ? "Update Freelancer Invoice" : "Update Client Invoice");
    const canDel = can(db, isFlSide ? "Delete Freelancer Invoice" : "Delete Client Invoice");
    return (
    <td className="text-end"><div className="row-actions">
      <button className="act act--pdf" title="View PDF" onClick={() => invoicePdf(i, i._side, db, false)}><Icon name="file-invoice" size={16} /></button>
      <button className="act act--view" title="Download PDF" onClick={() => invoicePdf(i, i._side, db, true)}><Icon name="download" size={16} /></button>
      {canEdit ? <button className="act act--edit" title="Edit" onClick={() => setModal({ mode: "edit", data: i, side: i._side })}><Icon name="edit" size={16} /></button> : null}
      {canDel ? <button className="act act--del" title="Delete" onClick={() => del(i)}><Icon name="trash" size={16} /></button> : null}
    </div></td>
  ); };
  const codeCell = (i, m) => (db[m.entity].find((c) => c[m.entityCode] === i[m.codeField])
    ? <button className="code-pill" onClick={() => go(m.route, { id: db[m.entity].find((c) => c[m.entityCode] === i[m.codeField]).id })} title={`Open ${m.partyLabel.toLowerCase()} details`}>{i[m.codeField]}</button>
    : <span className="code-pill" style={{ opacity: .55, cursor: "default" }} title={`This ${m.partyLabel.toLowerCase()} no longer exists`}>{i[m.codeField] || "\u2014"}</span>);
  const taskCell = (i) => { const task = db.tasks.find((t) => t.task_number === i.task_code); return task
    ? <button className="code-pill" onClick={() => go("task", { id: task.id })} title="Open task details">{i.task_code}</button>
    : <span className="code-pill" style={{ opacity: .55, cursor: "default" }} title="This task no longer exists in Tasks">{i.task_code || "\u2014"}</span>; };

  return (
    <div className="fade-in">
      {confirmNode}
      <PageHead crumb={<span>Finance · {title}</span>} title={title} sub={sub}
        actions={<div className="flex items-center gap-10">
          {isFl && can(db, "Reset Freelancer Invoices Test Data") ? <button className="cap-reset-btn" style={{ marginInlineStart: 0 }} onClick={() => setResetOpen(true)} title="Clear Freelancer Invoice test/demo data"><Icon name="trash" size={16} /> Reset Test Data</button> : null}
          {!isFl && window.ModuleResetButton ? <window.ModuleResetButton moduleKey="client-invoices" /> : null}
          {can(db, newSide === "freelancer" ? "Create Freelancer Invoice" : "Create Client Invoice") ? <Btn variant="primary" icon="plus" onClick={() => setModal({ mode: "new", side: newSide })}>New Invoice</Btn> : null}
        </div>} />
      <FinanceTabs active={activeTab} />

      <div className="stat-grid">
        {isAll ? <>
          <FinanceStat label="Client Invoices" value={totals.clientCount} tone="ok" ic="file-invoice" />
          <FinanceStat label="Freelancer Invoices" value={totals.flCount} tone="primary" ic="file-invoice" />
          <FinanceStat label="Paid Invoices" value={totals.paid} tone="info" ic="check" />
          <FinanceStat label="Outstanding" value={totals.pending} tone="warn" ic="clock" />
        </> : <>
          <FinanceStat label="Total (USD)" value={money(totals.usd, "USD")} tone="ok" ic="dollar" />
          <FinanceStat label="Total (EGP)" value={money(totals.egp, "EGP")} tone="primary" ic="coin" />
          <FinanceStat label="Paid Invoices" value={totals.paid} tone="info" ic="check" />
          <FinanceStat label="Outstanding" value={totals.pending} tone="warn" ic="clock" />
        </>}
      </div>

      <Card className="inv-table-card">
        <div className="card__head">
          <h3 className="card__title">{title}</h3>
          <div className="flex items-center gap-10 wrap">
            <SearchField value={q} onChange={setQ} placeholder="Search by code, task, party, date…" />
            <Select className="inp" style={{ width: "auto", height: 42, paddingTop: 0, paddingBottom: 0 }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Status</option><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
            </Select>
            <Select className="inp" style={{ width: "auto", height: 42, paddingTop: 0, paddingBottom: 0 }} value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">All Months</option>
              {monthOpts.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </Select>
            {(q || status || month) ? <Btn variant="ghost" size="sm" onClick={() => { setQ(""); setStatus(""); setMonth(""); }}>Reset</Btn> : null}
          </div>
        </div>
        <Table columns={columns}>
          {slice.length === 0 ? <EmptyRow span={span} icon="file-invoice" text="No invoices found." /> :
            slice.map((i) => {
              const m = INV_META[i._side];
              return (
              <tr key={i._side + "-" + i.id}>
                <td><button className="code-pill" onClick={() => invoicePdf(i, i._side, db, false)} title="Open invoice PDF">{i.invoice_code || "\u2014"}</button></td>
                {isFl ? <td>{i.po_number
                  ? <button className="code-pill" onClick={() => openPO(i.po_number)} title="Open related PO PDF">{i.po_number}</button>
                  : <span className="muted">—</span>}</td> : null}
                <td>{taskCell(i)}</td>
                <td className="cell-mono">{codeCell(i, m)}{isAll ? <span className="muted" style={{ fontSize: 11, marginInlineStart: 8, fontFamily: "var(--mono)" }}>{m.partyLabel}</span> : null}</td>
                {isFl ? <>
                  <td className="cell-mono">{fmtDate(i.po_sent_date)}</td>
                  <td className="cell-mono">{fmtDate(i.payment_due_date)}</td>
                  <td className="lead-cell">{money(i.total_price, i.currency)}</td>
                  <td><Badge variant="muted">{i.currency}</Badge></td>
                </> : isAll ? <>
                  <td className="cell-mono">{fmtDate(i.date_20)}</td>
                  <td className="lead-cell">{money(invTotal(i), i.currency)}</td>
                </> : <>
                  <td className="cell-mono">{fmtDate(i.date_20)}</td>
                  <td className="cell-mono">{fmtDate(i.date_80)}</td>
                  <td>{money(i.payment_20, i.currency)}</td>
                  <td>{money(i.payment_80, i.currency)}</td>
                  <td className="lead-cell">{money(invTotal(i), i.currency)}</td>
                </>}
                <td><StatusBadge status={i.status} /></td>
                {actions(i)}
              </tr>
              );
            })}
        </Table>
        <div className="card__foot"><Pager page={page} pages={pages} setPage={setPage} total={total} /></div>
      </Card>
      {modal ? (() => {
        const side = modal.side;
        const meta = INV_META[side];
        return <InvoiceModal modal={modal} side={side} coll={meta.coll} codeField={meta.codeField} db={db} onClose={() => setModal(null)} />;
      })() : null}
      {resetOpen ? <FlInvoiceResetModal me={currentUser(db)} onClose={() => setResetOpen(false)} /> : null}
    </div>
  );
}

// ---- Safe reset of Freelancer Invoice test/demo data ----------------
// Removes every freelancer invoice (and its stored attachments, which live
// on the invoice record) plus any Company Capital ledger entry linked to
// those invoices — including reversals of them — so no orphan ledger rows
// remain. All Company Capital / Finance Dashboard figures are derived from
// the ledger, so they recalculate automatically. A snapshot is kept.
// Clients, Freelancers, Tasks, Client Invoices, Payroll, Maintenance and
// unrelated capital entries are never touched.
function resetFreelancerInvoiceTestData(by) {
  const db = DB.get();
  if (typeof can === "function" && !can(db, "Reset Freelancer Invoices Test Data")) { const e = new Error("You do not have permission to perform this action."); e.code = "forbidden"; throw e; }
  const invoices = db.freelancerInvoices || [];
  const codes = new Set(invoices.map((i) => i.invoice_code));
  const L = db.capitalLedger || [];
  const byCode = {}; L.forEach((t) => { if (t.txn_code) byCode[t.txn_code] = t; });
  const isLinked = (t) => {
    if (t.source_type === "freelancer_invoice" && codes.has(String(t.source_id))) return true;
    if (t.source_type === "reversal") { const o = byCode[t.source_id]; return !!(o && o.source_type === "freelancer_invoice" && codes.has(String(o.source_id))); }
    return false;
  };
  const removedTxns = L.filter(isLinked);
  const keptLedger = L.filter((t) => !isLinked(t));
  const snapshot = { at: new Date().toISOString(), by: by || "—", scope: "Freelancer Invoice test/demo data", removed_invoices: invoices.length, removed_txns: removedTxns.length, freelancerInvoices: invoices, ledgerRemoved: removedTxns };
  DB.set((s) => ({
    ...s,
    freelancerInvoices: [],
    capitalLedger: keptLedger,
    flInvoiceBackups: [snapshot, ...(s.flInvoiceBackups || [])].slice(0, 20),
    capitalAudit: [{ at: snapshot.at, by: snapshot.by, action: "Reset Freelancer Invoice test data", scope: snapshot.scope, removed: invoices.length, backup_ref: snapshot.at }, ...(s.capitalAudit || [])],
  }));
  if (window.Capital && Capital.syncFromModules) Capital.syncFromModules();
  return { removedInvoices: invoices.length, removedTxns: removedTxns.length };
}

// ---- Danger-Zone reset modal for Finance ▸ Freelancer Invoices ------
// Mirrors the Company Capital reset: verified backup ZIP → typed phrase →
// password → enabled reset. The reset stays disabled until a verified
// backup has been generated and downloaded.
const FL_RESET_PHRASE = "RESET FREELANCER INVOICES";
function FlInvoiceResetModal({ me, onClose }) {
  const [db] = useDB();
  const canExport = can(db, "Export Freelancer Invoices Backup");
  const canDoReset = can(db, "Reset Freelancer Invoices Test Data");
  const [backedUp, setBackedUp] = useFS(false);
  const [report, setReport] = useFS(null);
  const [phrase, setPhrase] = useFS("");
  const [pw, setPw] = useFS("");
  const [done, setDone] = useFS(null);
  const [busy, setBusy] = useFS(false);

  const exportBackup = async () => {
    if (busy) return;
    if (!canExport) { toast("You do not have permission to perform this action.", "del"); return; }
    setBusy(true);
    try {
      if (!window.WTBackup || !window.WTBackup.exportFreelancerInvoices) throw new Error("Backup module not loaded");
      const res = await window.WTBackup.exportFreelancerInvoices(me);
      if (!res || !res.ok) throw new Error("verification");
      setReport(res); setBackedUp(true);
      toast(`Backup ZIP verified & downloaded · ${res.invoices} invoice(s), ${res.attachmentsExported}/${res.attachmentsFound} attachment(s), ${res.generatedPdfsExported}/${res.generatedPdfsFound} generated PDF(s).`);
    } catch (e) {
      setBackedUp(false); setReport(null);
      toast(e && (e.code === "attachments_missing" || e.code === "generated_missing") ? e.message : "Backup failed. Some Freelancer Invoice files were not included in the ZIP. No data was deleted.", "del");
    }
    setBusy(false);
  };

  const phraseOk = phrase.trim().toUpperCase() === FL_RESET_PHRASE;
  const pwOk = pw.trim().length > 0 && (!me.password || pw === me.password);
  const canReset = backedUp && phraseOk && pwOk && canDoReset;

  const doReset = () => {
    if (!canReset) return;
    const res = resetFreelancerInvoiceTestData(me.name);
    setDone(res);
    toast("Backup downloaded. Freelancer Invoice test data was reset safely.");
  };

  if (done) {
    return (
      <Modal title="Reset Complete" onClose={onClose} footer={<Btn variant="primary" icon="check" onClick={onClose}>Done</Btn>}>
        <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--ok-soft, #e6f6ec)", color: "var(--ok)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Icon name="check" size={26} /></div>
          <p style={{ margin: 0, fontSize: 15 }}>Backup ZIP downloaded and verified, then cleared <b>{done.removedInvoices}</b> freelancer invoice{done.removedInvoices === 1 ? "" : "s"}{done.removedTxns ? <> and reversed <b>{done.removedTxns}</b> linked capital transaction{done.removedTxns === 1 ? "" : "s"}</> : null}. Company Capital and the Finance Dashboard have recalculated.</p>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Clients, freelancers, tasks, client invoices, payroll and maintenance were preserved. A backup snapshot and audit entry were recorded.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Reset Freelancer Invoices Test Data" lg onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="danger" icon="trash" onClick={doReset} disabled={!canReset}>Reset Test Data</Btn>
    </>}>
      <div className="cap-reset-warn">
        <Icon name="alert-triangle" size={20} />
        <div>This clears <b>Freelancer Invoice test/demo data only</b> — every freelancer invoice, its attachments, and the Company Capital cash-out transactions linked to them. Clients, freelancers, tasks, client invoices, payroll and maintenance are <b>not</b> touched. A verified backup ZIP is required first.</div>
      </div>

      <div className="cap-reset-step">
        <div className="cap-reset-step__n" data-on={backedUp}>{backedUp ? <Icon name="check" size={14} /> : "1"}</div>
        <div style={{ flex: 1 }}>
          <div className="cap-reset-step__t">Export &amp; Verify Backup (ZIP)</div>
          <Btn variant="soft" size="sm" icon="download" onClick={exportBackup} disabled={!canExport} title={canExport ? "" : "You do not have permission to perform this action."}>{busy ? "Generating & verifying ZIP…" : backedUp ? "Backup Verified ✓" : "Export & Verify Backup (ZIP)"}</Btn>
          {!canExport ? <p className="muted" style={{ fontSize: 12, margin: "7px 0 0" }}>You do not have permission to export this backup.</p> : null}
          {report ? (
            <div style={{ marginTop: 11, border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", fontSize: 12.5 }}>
              {[
                ["Excel backup", "OK", true],
                ["Freelancer invoice records exported", String(report.invoices), null],
                ["Attachments found", String(report.attachmentsFound), null],
                ["Attachments exported", `${report.attachmentsExported}/${report.attachmentsFound}`, report.attachmentsExported === report.attachmentsFound],
                ["Generated invoice PDFs", `${report.generatedPdfsExported}/${report.generatedPdfsFound}`, report.generatedPdfsExported === report.generatedPdfsFound],
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
          <Field label={<>Type <code>{FL_RESET_PHRASE}</code> to confirm</>}>
            <Input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder={FL_RESET_PHRASE} disabled={!backedUp} />
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

function InvoiceModal({ modal, side, coll, codeField, db, onClose }) {
  const editing = modal.mode === "edit";
  const isFl = side === "freelancer";
  const autoCode = useFM(() => editing ? (modal.data.invoice_code || "") : nextInvoiceCode(db[coll], side), [editing, db, coll, side]);
  const [f, setF] = useFS(() => editing ? { attachment: null, notes: "", po_number: "", po_sent_date: "", payment_due_date: "", client_po: "", project_name_client: "", ...modal.data }
    : { invoice_code: autoCode, task_code: "", [codeField]: "", po_number: "", po_sent_date: "", payment_due_date: "", date_20: "", date_80: "", payment_20: "", payment_80: "", total_price: "", status: "pending", currency: "USD", notes: "", attachment: null, client_po: "", project_name_client: "" });
  const [err, setErr] = useFS({});
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setErrKey = (k, v) => setErr((p) => ({ ...p, [k]: v }));
  const autoTotal = (+f.payment_20 || 0) + (+f.payment_80 || 0);
  const partyLabel = isFl ? "Freelancer" : "Client";
  const partyList = isFl ? db.freelancers : db.clients;
  const taskName = (code) => { const t = db.tasks.find((x) => x.task_number === code); const c = t && db.clients.find((cl) => cl.client_code === t.client_code); return c ? c.name : (t ? t.client_code : ""); };
  // Only real Freelancer POs that belong to the currently-selected task may be
  // chosen — no stale / deleted / cross-task POs.
  const selTaskObj = db.tasks.find((t) => t.task_number === (f.task_code || "").trim());
  const taskPOs = useFM(() => (db.vendorPOs || []).filter((p) => selTaskObj && (p.ref_no === selTaskObj.task_number || p.task_id === selTaskObj.id)), [db.vendorPOs, selTaskObj]);

  // picking a task auto-fills the client (client invoices only)
  const pickTask = (t) => {
    setErrKey("task", "");
    setF((p) => {
      const next = { ...p, task_code: t.task_number };
      if (!isFl && t.client_code) next.client_code = t.client_code;
      // Changing the task invalidates any previously-chosen PO (POs are
      // task-specific), so clear it and its auto-filled price.
      if (isFl) { next.po_number = ""; next.total_price = ""; }
      return next;
    });
  };
  // picking a PO auto-fills its task + freelancer
  const pickPO = (po) => {
    setErrKey("po", "");
    // Price comes straight from the selected PO amount (read-only field).
    setF((p) => ({ ...p, po_number: po.po_number, task_code: po.ref_no || p.task_code, freelancer_code: po.freelancer_code || p.freelancer_code, total_price: Number(po.amount || 0) }));
  };

  const save = () => {
    const e = {};
    const code = (f.task_code || "").trim();
    const task = db.tasks.find((t) => t.task_number === code);
    if (!code || !task) e.task = "This task does not exist. Please select an existing task.";
    if (!f[codeField]) e[codeField] = `Please select an existing ${partyLabel.toLowerCase()}.`;
    else if (!partyList.find((c) => c[codeField] === f[codeField])) e[codeField] = `This ${partyLabel.toLowerCase()} does not exist. Please select an existing one.`;
    if (isFl && f.po_number && !taskPOs.find((p) => p.po_number === f.po_number)) e.po = "Select a Purchase Order that belongs to this task.";
    setErr(e);
    if (Object.keys(e).length) { toast("Please fix the highlighted fields", "del"); return; }

    const clean = isFl
      ? { ...f, task_code: code, total_price: +f.total_price || 0, payment_20: 0, payment_80: 0 }
      : { ...f, task_code: code, payment_20: +f.payment_20 || 0, payment_80: +f.payment_80 || 0, total_price: autoTotal };

    // Block marking a freelancer invoice Paid (completed) if Company Capital
    // can't cover it — this is a real cash-out from available balance.
    if (isFl && window.Capital && clean.status === "completed") {
      const code2 = clean.invoice_code || modal.data && modal.data.invoice_code;
      const alreadyPosted = code2 && Capital.isPosted("freelancer_invoice", code2, "full");
      if (!alreadyPosted) {
        const g = Capital.guardCashOut(Capital.toBase(clean.total_price, clean.currency));
        if (!g.ok) { toast(g.message, "del"); return; }
      }
    }

    if (editing) { DB.update(coll, modal.data.id, clean); toast("Invoice updated"); }
    else { clean.invoice_code = nextInvoiceCode(db[coll], side); DB.insert(coll, clean); toast(`Invoice ${clean.invoice_code} created · PDF ready`); }
    // Post real cash events to Company Capital: client deposit/remaining
    // received (Cash In) and freelancer invoices marked paid (Cash Out).
    // Idempotent — re-saving never double-posts.
    if (window.Capital) {
      Capital.syncFromModules();
      // If a client invoice was edited, post an Adjustment for any amount drift
      // so Company Capital always matches the new invoice total (posted rows
      // stay immutable).
      if (!isFl && editing) Capital.syncClientInvoiceEdit(clean.invoice_code || modal.data.invoice_code);
    }
    onClose();
  };

  return (
    <Modal title={editing ? `Edit ${f.invoice_code || "invoice"}` : `New ${partyLabel.toLowerCase()} invoice`} lg onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>{editing ? "Save" : "Create"}</Btn></>}>
      <div className="form-grid">
        <Field label="Invoice Code" hint="Auto-generated"><Input value={f.invoice_code || autoCode} readOnly disabled className="inp--auto" /></Field>
        <Field label="Currency"><Select value={f.currency} onChange={(e) => set("currency", e.target.value)}><option>USD</option><option>EGP</option></Select></Field>

        {isFl ? (
          <Field label="PO Number" span={12} error={err.po} hint={selTaskObj ? "Only purchase orders for the selected task" : "Select a Task Code first"}>
            {!selTaskObj
              ? <Input value="" readOnly disabled className="inp--auto" placeholder="Select a task to load its purchase orders" />
              : taskPOs.length === 0
                ? <Input value="" readOnly disabled className="inp--auto" placeholder="No purchase orders found for this task" />
                : <Combo value={f.po_number} error={!!err.po} placeholder="Type 26 or 0005 → PO-26-0005"
                    options={taskPOs} getValue={(p) => p.po_number}
                    getLabel={(p) => { const fr = db.freelancers.find((x) => x.freelancer_code === p.freelancer_code); return `${money(p.amount, p.currency)}${fr ? " · " + fr.name : ""}`; }}
                    onChange={(v) => { set("po_number", v); if (err.po) setErrKey("po", ""); }} onPick={pickPO} />}
          </Field>
        ) : null}

        <Field label="Task Code" required span={isFl ? 12 : 6} error={err.task} hint="Search existing tasks">
          <Combo value={f.task_code} error={!!err.task} placeholder="Type 0004 or T-26…"
            options={db.tasks} getValue={(t) => t.task_number} getLabel={(t) => taskName(t.task_number) || "Task"}
            onChange={(v) => { set("task_code", v); if (err.task) setErrKey("task", ""); }} onPick={pickTask} />
        </Field>
        <Field label={`${partyLabel} Code`} required span={isFl ? 12 : 6} error={err[codeField]} hint={`Search existing ${partyLabel.toLowerCase()}s`}>
          <Combo value={f[codeField]} error={!!err[codeField]} placeholder={isFl ? "0001 or Layla…" : "0007 or name…"}
            options={partyList} getValue={(c) => c[codeField]} getLabel={(c) => c.name}
            onChange={(v) => { set(codeField, v); if (err[codeField]) setErrKey(codeField, ""); }}
            onPick={(c) => { set(codeField, c[codeField]); setErrKey(codeField, ""); }} />
        </Field>

        {isFl ? <>
          <Field label="PO Sent Date"><DateInput value={f.po_sent_date || ""} onChange={(v) => set("po_sent_date", v)} /></Field>
          <Field label="Payment Due Date"><DateInput value={f.payment_due_date || ""} onChange={(v) => set("payment_due_date", v)} /></Field>
          <Field label="Price" hint={f.po_number ? "Auto-filled from selected PO" : "Select a PO to auto-fill"}><Input type="number" step="0.01" value={f.total_price} readOnly className="inp--auto" /></Field>
          <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></Select></Field>
        </> : <>
          <Field label="Client PO" span={6}><Input value={f.client_po || ""} onChange={(e) => set("client_po", e.target.value)} placeholder="Client PO reference" /></Field>
          <Field label="Project Name (Client)" span={6}><Input value={f.project_name_client || ""} onChange={(e) => set("project_name_client", e.target.value)} placeholder="Client's project name" /></Field>
          <Field label="Deposit Payment Date"><DateInput value={f.date_20 || ""} onChange={(v) => set("date_20", v)} /></Field>
          <Field label="Remaining Payment Date"><DateInput value={f.date_80 || ""} onChange={(v) => set("date_80", v)} /></Field>
          <Field label="Deposit Amount"><Input type="number" value={f.payment_20} onChange={(e) => set("payment_20", e.target.value)} /></Field>
          <Field label="Remaining Amount"><Input type="number" value={f.payment_80} onChange={(e) => set("payment_80", e.target.value)} /></Field>
          <Field label="Total Price" hint="Deposit + Remaining"><Input type="number" value={autoTotal} readOnly className="inp--auto" /></Field>
          <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></Select></Field>
        </>}

        <Field label="Notes" span={12}><Textarea rows={2} value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" /></Field>
        <Field label="Attachment" hint="PDF or image only" span={12}><MediaAttachment value={f.attachment} onChange={(v) => set("attachment", v)} /></Field>
      </div>
    </Modal>
  );
}

// ===================================================================
// INVOICE DETAIL — full page (Projects Ledger style), not a modal
// side derived from route name: client-invoice | freelancer-invoice
// ===================================================================
function InvoiceDetailPage({ side }) {
  const [db] = useDB();
  const { route, go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const meta = INV_META[side];
  const isFl = side === "freelancer";
  const inv = db[meta.coll].find((x) => x.id === route.params.id);
  const backRoute = isFl ? "freelancer-invoices" : "client-invoices";
  const listLabel = isFl ? "Freelancer Invoices" : "Client Invoices";
  const [modal, setModal] = useFS(null);
  if (!inv) return (
    <div className="fade-in">
      <PageHead title="Invoice not found" />
      <Btn icon="arrow-left" onClick={() => go(backRoute)}>Back to {listLabel.toLowerCase()}</Btn>
    </div>
  );
  const task = db.tasks.find((t) => t.task_number === inv.task_code);
  const party = db[meta.entity].find((c) => c[meta.entityCode] === inv[meta.codeField]);
  const po = isFl ? (db.vendorPOs || []).find((p) => p.po_number === inv.po_number) : null;

  const del = async () => {
    if (await confirm({ title: "Delete invoice?", message: `Remove ${inv.invoice_code}?`, danger: true, okLabel: "Delete" })) {
      DB.remove(meta.coll, inv.id); toast("Invoice deleted", "del"); go(backRoute);
    }
  };
  const field = (label, val, mono) => (
    <div className="info-cell"><span className="info-cell__k">{label}</span><span className={`info-cell__v${mono ? " cell-mono" : ""}`}>{(val === 0 || val) ? val : "\u2014"}</span></div>
  );

  return (
    <div className="fade-in">
      {confirmNode}
      <div className="flex items-center justify-between wrap gap-10" style={{ marginBottom: 4 }}>
        <button className="btn btn--ghost btn--sm" onClick={() => go(backRoute)}><Icon name="arrow-left" size={15} /><span>Back to invoices</span></button>
        <div className="flex gap-8 wrap">
          <Btn variant="soft" icon="file-pdf" onClick={() => invoicePdf(inv, side, db, false)}>View PDF</Btn>
          <Btn variant="soft" icon="download" onClick={() => invoicePdf(inv, side, db, true)}>Download PDF</Btn>
          <Btn variant="soft" icon="edit" onClick={() => setModal({ mode: "edit", data: inv, side })}>Edit</Btn>
          <Btn variant="danger-soft" icon="trash" onClick={del}>Delete</Btn>
        </div>
      </div>
      <PageHead crumb={<span>Finance · {listLabel} · {inv.invoice_code}</span>} title={inv.invoice_code}
        sub={`${meta.partyLabel} invoice · ${inv.task_code} · ${inv[meta.codeField]}`}
        actions={<StatusBadge status={inv.status} />} />

      <div className="detail-grid">
        <div className="detail-main">
          <Card>
            <div className="card__head"><h3 className="card__title">Invoice Information</h3></div>
            <div className="card__body info-grid">
              {field("Invoice Code", <span className="code-pill">{inv.invoice_code}</span>)}
              {field("Task Code", task
                ? <button className="code-pill" onClick={() => go("task", { id: task.id })} title="Open task details">{inv.task_code}</button>
                : <span className="code-pill" style={{ opacity: .55 }}>{inv.task_code || "\u2014"}</span>)}
              {field(`${meta.partyLabel} Code`, party
                ? <button className="code-pill" onClick={() => go(meta.route, { id: party.id })} title={`Open ${meta.partyLabel.toLowerCase()} details`}>{inv[meta.codeField]}</button>
                : <span className="code-pill" style={{ opacity: .55 }}>{inv[meta.codeField] || "\u2014"}</span>)}
              {field(`${meta.partyLabel} Name`, party ? party.name : "\u2014")}
              {isFl ? field("PO Number", po
                ? <button className="code-pill" onClick={() => window.exportPOInvoice && window.exportPOInvoice(po, "vendor", db, { autoPrint: false })} title="Open related PO PDF">{inv.po_number}</button>
                : (inv.po_number ? <span className="code-pill" style={{ opacity: .55 }}>{inv.po_number}</span> : "\u2014")) : null}
              {field("Currency", inv.currency, true)}
              {field("Status", <StatusBadge status={inv.status} />)}
              {isFl ? <>
                {field("PO Sent Date", fmtDate(inv.po_sent_date), true)}
                {field("Payment Due Date", fmtDate(inv.payment_due_date), true)}
                {field("Price", money(inv.total_price, inv.currency), true)}
              </> : <>
                {field("Client PO", inv.client_po)}
                {field("Project Name (Client)", inv.project_name_client)}
                {field("Deposit Payment Date", fmtDate(inv.date_20), true)}
                {field("Remaining Payment Date", fmtDate(inv.date_80), true)}
                {field("Deposit Amount", money(inv.payment_20, inv.currency), true)}
                {field("Remaining Amount", money(inv.payment_80, inv.currency), true)}
                {field("Total Price", money((+inv.payment_20 || 0) + (+inv.payment_80 || 0), inv.currency), true)}
              </>}
              {field("Attachment", <MediaViewLink value={inv.attachment} />)}
              {(() => {
                if (!window.Capital) return null;
                const tags = [];
                if (isFl) { const p = Capital.isPosted("freelancer_invoice", inv.invoice_code, "full"); if (p) tags.push(`Paid · ${p.txn_code}`); }
                else {
                  const d = Capital.isPosted("client_invoice", inv.invoice_code, "deposit"); if (d) tags.push(`Deposit · ${d.txn_code}`);
                  const r = Capital.isPosted("client_invoice", inv.invoice_code, "remaining"); if (r) tags.push(`Remaining · ${r.txn_code}`);
                }
                return tags.length ? field("Company Capital", <span className="flex gap-8 wrap">{tags.map((t, i) => <span key={i} className="badge badge--ok"><span className="badge__dot"></span>{t}</span>)}</span>) : null;
              })()}
              {inv.notes ? <div className="info-cell" style={{ gridColumn: "1 / -1" }}><span className="info-cell__k">Notes</span><span className="info-cell__v">{inv.notes}</span></div> : null}
            </div>
          </Card>
        </div>

        <div className="detail-side">
          <Card className="calc-summary">
            <div className="card__body">
              <h3 className="card__title" style={{ marginBottom: 16 }}>Invoice Summary</h3>
              {isFl ? <>
                <div className="calc-sum-row"><span>PO Sent</span><span>{fmtDate(inv.po_sent_date)}</span></div>
                <div className="calc-sum-row"><span>Payment Due</span><span>{fmtDate(inv.payment_due_date)}</span></div>
              </> : <>
                <div className="calc-sum-row"><span>Deposit Amount</span><span>{money(inv.payment_20, inv.currency)}</span></div>
                <div className="calc-sum-row"><span>Remaining Amount</span><span>{money(inv.payment_80, inv.currency)}</span></div>
              </>}
              <div className="calc-sum-row"><span>Currency</span><span>{inv.currency}</span></div>
              <div className="calc-sum-div"></div>
              <div className="calc-sum-row strong"><span>Status</span><span><StatusBadge status={inv.status} /></span></div>
              <div className="calc-grand">
                <div><div className="calc-grand__label">{isFl ? "Price" : "Total Price"}</div><div className="calc-grand__eff">{meta.partyLabel} invoice</div></div>
                <div className="calc-grand__num">{money(inv.total_price, inv.currency)}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
      {modal ? <InvoiceModal modal={modal} side={side} coll={meta.coll} codeField={meta.codeField} db={db} onClose={() => setModal(null)} /> : null}
    </div>
  );
}

// ===================================================================
// FINANCE DASHBOARD — monthly revenue & expenses, computed live from
// Projects Ledger (revenue + project cost) and Maintenance (op-ex).
// All figures normalised to USD for the all-in view (EGP maintenance
// is converted at EGP_PER_USD); per-row currencies still display native.
// ===================================================================
function prjMath(p) {
  const onum = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));
  const vol = onum(p.volume);
  const clientAmount = vol * onum(p.client_rate);
  const flCost = vol * onum(p.fl_rate);
  const profit = clientAmount - flCost;
  const margin = clientAmount ? (profit / clientAmount) * 100 : 0;
  return { clientAmount, flCost, profit, margin };
}
// a project's effective month: Created At (date) → linked task start_date
function prjMonth(p, db) {
  if (p.date) return monthKey(p.date);
  const task = (db.tasks || []).find((t) => t.task_number === p.task_code);
  return task && task.start_date ? monthKey(task.start_date) : "";
}

function FinanceDashboard() {
  const [db] = useDB();
  const { go } = useRouter();

  const { months, totals } = useFM(() => {
    const map = {};
    const row = (k) => (map[k] = map[k] || { key: k, revenue: 0, prjExp: 0, mntExp: 0, pyExp: 0, count: 0, paid: 0, unpaid: 0, partial: 0, marginSum: 0 });
    (db.projects || []).forEach((p) => {
      const k = prjMonth(p, db); if (!k) return;
      const m = prjMath(p); const r = row(k);
      r.revenue += m.clientAmount; r.prjExp += m.flCost; r.count += 1; r.marginSum += m.margin;
      const ps = (p.payment_status || "").toLowerCase();
      if (ps === "paid") r.paid += 1; else if (ps === "partially paid") r.partial += 1; else r.unpaid += 1;
    });
    (db.maintenance || []).forEach((x) => {
      const k = monthKey(x.payment_date); if (!k) return;
      row(k).mntExp += toUSD(x.amount, x.currency);
    });
    (db.payroll || []).forEach((x) => {
      if (x.status !== "Paid") return;
      const k = x.month; if (!k) return;
      row(k).pyExp += toUSD(x.salary, x.currency);
    });
    const months = Object.values(map).map((r) => ({
      ...r, totalExp: r.prjExp + r.mntExp + r.pyExp, net: r.revenue - r.prjExp - r.mntExp - r.pyExp,
      avgMargin: r.count ? r.marginSum / r.count : 0,
    })).sort((a, b) => (a.key < b.key ? 1 : -1));
    const t = months.reduce((s, m) => ({
      revenue: s.revenue + m.revenue, prjExp: s.prjExp + m.prjExp, mntExp: s.mntExp + m.mntExp, pyExp: s.pyExp + m.pyExp,
      totalExp: s.totalExp + m.totalExp, net: s.net + m.net, count: s.count + m.count,
      paid: s.paid + m.paid, unpaid: s.unpaid + m.unpaid, partial: s.partial + m.partial, marginSum: s.marginSum + m.marginSum,
    }), { revenue: 0, prjExp: 0, mntExp: 0, pyExp: 0, totalExp: 0, net: 0, count: 0, paid: 0, unpaid: 0, partial: 0, marginSum: 0 });
    t.avgMargin = t.count ? t.marginSum / t.count : 0;
    return { months, totals: t };
  }, [db]);

  const best = months.reduce((a, b) => (!a || b.net > a.net ? b : a), null);
  const worst = months.reduce((a, b) => (!a || b.totalExp > a.totalExp ? b : a), null);
  const maxBar = Math.max(1, ...months.map((m) => Math.max(m.revenue, m.totalExp)));
  const openMonth = (m) => go("projects", { month: m.key });
  const openPay = (status) => go("projects", { payment: status });

  return (
    <div className="fade-in">
      <PageHead crumb={<span>Finance · Dashboard</span>} title="Finance Dashboard"
        sub="Monthly revenue & expenses — calculated live from Projects Ledger and Maintenance. All-in figures shown in USD." />
      <FinanceTabs active="finance-dashboard" />

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <FinanceStat label="Total Revenue" value={money(totals.revenue, "USD")} tone="ok" ic="arrow-down" />
        <FinanceStat label="Total Expenses" value={money(totals.totalExp, "USD")} tone="danger" ic="arrow-up" />
        <FinanceStat label="Net Profit" value={money(totals.net, "USD")} tone="primary" ic="wallet" />
        <FinanceStat label="Average Margin" value={`${totals.avgMargin.toFixed(1)}%`} tone="info" ic="bank" />
      </div>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: -8 }}>
        <button className="pay-link" onClick={() => go("projects")} style={{ textAlign: "left" }}><FinanceStat label="Total Projects" value={totals.count} tone="info" ic="briefcase" /></button>
        <button className="pay-link" onClick={() => openPay("Paid")} style={{ textAlign: "left" }}><FinanceStat label="Paid Projects" value={totals.paid} tone="ok" ic="check" /></button>
        <button className="pay-link" onClick={() => openPay("Unpaid")} style={{ textAlign: "left" }}><FinanceStat label="Outstanding Projects" value={totals.unpaid} tone="warn" ic="clock" /></button>
        <FinanceStat label="Maintenance Expenses" value={money(totals.mntExp, "USD")} tone="danger" ic="settings" />
      </div>

      <Card style={{ marginTop: 18 }}>
        <div className="card__head"><h3 className="card__title">Monthly Summary</h3>
          <span className="muted" style={{ fontSize: 12.5 }}>Click a month to open its projects</span></div>
        <Table columns={[{ label: "Month" }, { label: "Revenue" }, { label: "Project Exp." }, { label: "Maintenance" }, { label: "Payroll" }, { label: "Total Exp." }, { label: "Net Profit" }, { label: "Projects" }, { label: "Paid" }, { label: "Unpaid" }, { label: "Partial" }]}>
          {months.length === 0 ? <EmptyRow span={11} icon="wallet" text="No project or maintenance activity yet." /> :
            months.map((m) => (
              <tr key={m.key}>
                <td><button className="month-link" onClick={() => openMonth(m)}>{monthLabel(m.key)}</button></td>
                <td className="cell-mono" style={{ color: "var(--ok)" }}>{money(m.revenue, "USD")}</td>
                <td className="cell-mono">{money(m.prjExp, "USD")}</td>
                <td className="cell-mono">{money(m.mntExp, "USD")}</td>
                <td className="cell-mono">{money(m.pyExp, "USD")}</td>
                <td className="cell-mono" style={{ color: "var(--danger,#e0566b)" }}>{money(m.totalExp, "USD")}</td>
                <td className="cell-mono lead-cell" style={{ color: m.net >= 0 ? "var(--ok)" : "var(--danger,#e0566b)" }}>{money(m.net, "USD")}</td>
                <td>{m.count}</td>
                <td><Badge variant="ok">{m.paid}</Badge></td>
                <td><Badge variant="danger">{m.unpaid}</Badge></td>
                <td><Badge variant="warn">{m.partial}</Badge></td>
              </tr>
            ))}
        </Table>
      </Card>

      <div className="detail-grid" style={{ marginTop: 18 }}>
        <Card>
          <div className="card__head"><h3 className="card__title">Revenue vs Expenses by Month</h3></div>
          <div className="card__body">
            {months.length === 0 ? <p className="muted" style={{ margin: 0 }}>No data to chart yet.</p> : (
              <>
                <div className="dash-bars">
                  {months.slice(0, 6).map((m) => (
                    <div className="dash-bar-row" key={m.key}>
                      <div className="dash-bar-row__m">{monthLabel(m.key)}</div>
                      <div className="dash-bar-track">
                        <div className="dash-bar__wrap"><div className="dash-bar dash-bar--rev" style={{ width: `${(m.revenue / maxBar) * 100}%` }}></div><span className="dash-bar__val">{money(m.revenue, "USD")}</span></div>
                        <div className="dash-bar__wrap"><div className="dash-bar dash-bar--exp" style={{ width: `${(m.totalExp / maxBar) * 100}%` }}></div><span className="dash-bar__val">{money(m.totalExp, "USD")}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="dash-legend"><span><i style={{ background: "var(--ok)" }}></i>Revenue</span><span><i style={{ background: "#e0566b" }}></i>Total Expenses</span></div>
              </>
            )}
          </div>
        </Card>
        <Card>
          <div className="card__head"><h3 className="card__title">Highlights</h3></div>
          <div className="card__body dash-highlight">
            <div className="dash-hl"><div className="dash-hl__k">Best Month (Profit)</div><div className="dash-hl__v">{best ? monthLabel(best.key) : "—"}</div><div className="dash-hl__s">{best ? money(best.net, "USD") : ""}</div></div>
            <div className="dash-hl"><div className="dash-hl__k">Highest Expense Month</div><div className="dash-hl__v">{worst ? monthLabel(worst.key) : "—"}</div><div className="dash-hl__s">{worst ? money(worst.totalExp, "USD") : ""}</div></div>
            <div className="dash-hl"><div className="dash-hl__k">Maintenance / Op-Ex</div><div className="dash-hl__v">{money(totals.mntExp, "USD")}</div><div className="dash-hl__s">included in monthly expenses</div></div>
            <div className="dash-hl"><div className="dash-hl__k">Net Margin</div><div className="dash-hl__v">{totals.revenue ? ((totals.net / totals.revenue) * 100).toFixed(1) : "0.0"}%</div><div className="dash-hl__s">profit ÷ revenue</div></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ===================================================================
// MAINTENANCE — operating expenses & recurring business costs
// ===================================================================
const MNT_STATUS = { "Paid": "ok", "Pending": "warn", "Upcoming": "info", "Overdue": "danger" };
const MNT_METHODS = ["Bank Transfer", "InstaPay", "Vodafone Cash", "Wallet", "Cash", "Card", "Other"];

function Maintenance() {
  const [db] = useDB();
  const { go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const [q, setQ] = useFS("");
  const [status, setStatus] = useFS("all");
  const [modal, setModal] = useFS(null);
  const list = db.maintenance || [];

  const filtered = useFM(() => list.filter((m) => {
    if (status !== "all" && m.status !== status) return false;
    if (!q) return true;
    const hay = `${m.maintenance_id} ${m.service_name} ${m.vendor || ""} ${m.payment_method} ${m.status} ${m.billing_cycle || ""} ${m.currency} ${m.amount} ${fmtDate(m.payment_date)} ${m.notes || ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }), [list, q, status]);
  const { page, setPage, pages, slice, total } = usePaginate(filtered, 8);

  const totals = useFM(() => {
    const all = list.reduce((s, m) => s + toUSD(m.amount, m.currency), 0);
    const thisKey = monthKey(new Date().toISOString());
    const thisMonth = list.filter((m) => monthKey(m.payment_date) === thisKey).reduce((s, m) => s + toUSD(m.amount, m.currency), 0);
    const paid = list.filter((m) => m.status === "Paid").reduce((s, m) => s + toUSD(m.amount, m.currency), 0);
    const upcoming = list.filter((m) => m.status === "Upcoming" || m.status === "Pending").length;
    return { all, thisMonth, paid, upcoming };
  }, [list]);

  const del = async (m) => { if (await confirm({ title: "Delete maintenance?", message: `Remove ${m.maintenance_id} — ${m.service_name}?`, danger: true, okLabel: "Delete" })) { DB.remove("maintenance", m.id); toast("Maintenance deleted", "del"); } };

  return (
    <div className="fade-in">
      {confirmNode}
      <PageHead crumb={<span>Finance · Maintenance</span>} title="Maintenance" sub="Operating expenses and recurring business costs."
        actions={<div className="flex items-center gap-10">
          {window.ModuleResetButton ? <window.ModuleResetButton moduleKey="maintenance" /> : null}
          <Btn variant="primary" icon="plus" onClick={() => setModal({ mode: "new" })}>New Maintenance</Btn>
        </div>} />
      <FinanceTabs active="maintenance" />

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <FinanceStat label="Total Maintenance" value={money(totals.all, "USD")} tone="danger" ic="settings" />
        <FinanceStat label="This Month" value={money(totals.thisMonth, "USD")} tone="primary" ic="calendar" />
        <FinanceStat label="Paid Expenses" value={money(totals.paid, "USD")} tone="ok" ic="check" />
        <FinanceStat label="Upcoming / Pending" value={totals.upcoming} tone="warn" ic="clock" />
      </div>

      <Card>
        <div className="card__head">
          <div className="flex items-center gap-10 wrap">
            <SearchField value={q} onChange={setQ} placeholder="Search by item, vendor, date, method…" />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "auto", minWidth: 140 }}>
              <option value="all">All Status</option>
              {Object.keys(MNT_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </div>
        <Table columns={[{ label: "ID" }, { label: "Service / Item" }, { label: "Payment Date" }, { label: "Amount" }, { label: "Method" }, { label: "Cycle" }, { label: "Status" }, { label: "Attach" }, { label: "Actions", end: true }]}>
          {slice.length === 0 ? <EmptyRow span={9} icon="settings" text="No maintenance records yet." /> :
            slice.map((m) => (
              <tr key={m.id}>
                <td><button className="code-pill" onClick={() => go("maintenance-item", { id: m.id })}>{m.maintenance_id}</button></td>
                <td className="lead-cell">{m.service_name}{m.vendor ? <div className="muted" style={{ fontSize: 12 }}>{m.vendor}</div> : null}</td>
                <td className="cell-mono">{fmtDate(m.payment_date)}</td>
                <td className="cell-mono lead-cell">{money(m.amount, m.currency)}</td>
                <td className="muted" style={{ fontSize: 13 }}>{m.payment_method}</td>
                <td>{m.billing_cycle ? <Badge variant="muted">{m.billing_cycle}</Badge> : <span className="muted">—</span>}</td>
                <td><Badge variant={MNT_STATUS[m.status] || "muted"}>{m.status}</Badge></td>
                <td>{m.attachment && m.attachment.data ? <a className="link" href={m.attachment.data} target="_blank" rel="noreferrer" title="View attachment"><Icon name="file" size={16} /></a> : <span className="muted">—</span>}</td>
                <td className="text-end"><div className="row-actions">
                  <button className="act act--view" title="View" onClick={() => go("maintenance-item", { id: m.id })}><Icon name="eye" size={16} /></button>
                  <button className="act act--edit" title="Edit" onClick={() => setModal({ mode: "edit", data: m })}><Icon name="edit" size={16} /></button>
                  <button className="act act--del" title="Delete" onClick={() => del(m)}><Icon name="trash" size={16} /></button>
                </div></td>
              </tr>
            ))}
        </Table>
        <div className="card__foot"><Pager page={page} pages={pages} setPage={setPage} total={total} /></div>
      </Card>
      {modal ? <MaintenanceModal modal={modal} db={db} onClose={() => setModal(null)} /> : null}
    </div>
  );
}

function MaintenanceModal({ modal, db, onClose }) {
  const editing = modal.mode === "edit";
  const autoId = useFM(() => editing ? modal.data.maintenance_id : nextMaintenanceId(db.maintenance), [editing, db, modal]);
  const [f, setF] = useFS(() => editing ? { ...modal.data } : {
    maintenance_id: autoId, service_name: "", payment_date: new Date().toISOString().slice(0, 10), amount: "", currency: "USD",
    payment_method: "Bank Transfer", status: "Pending", billing_cycle: "Monthly", vendor: "", renewal_date: "", notes: "", attachment: null,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.service_name.trim()) { toast("Service / item name is required", "info"); return; }
    const clean = { ...f, amount: +f.amount || 0 };
    // Block marking maintenance Paid if Company Capital can't cover it.
    if (window.Capital && clean.status === "Paid" && clean.amount > 0) {
      const already = editing && Capital.isPosted("maintenance", modal.data.maintenance_id);
      if (!already) {
        const g = Capital.guardCashOut(Capital.toBase(clean.amount, clean.currency));
        if (!g.ok) { toast(g.message, "del"); return; }
      }
    }
    if (editing) { DB.update("maintenance", modal.data.id, clean); toast("Maintenance updated"); }
    else { clean.maintenance_id = nextMaintenanceId(db.maintenance); DB.insert("maintenance", clean); toast(`Maintenance ${clean.maintenance_id} created`); }
    // When a maintenance item is Paid, post a Cash Out to Company Capital
    // (idempotent — never double-posts the same item).
    if (window.Capital) Capital.syncFromModules();
    onClose();
  };
  const capPosted = editing && window.Capital && Capital.isPosted("maintenance", modal.data.maintenance_id);
  return (
    <Modal title={editing ? `Edit ${f.maintenance_id}` : "New maintenance"} lg onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>{editing ? "Save" : "Create"}</Btn></>}>
      {capPosted ? <div className="cap-locked-note"><Icon name="bank" size={16} /><span>Posted to Company Capital as <b>{capPosted.txn_code}</b>. The amount is locked — to change it, create an Adjustment or Reversal in Company Capital.</span></div> : null}
      <div className="form-grid">
        <Field label="Maintenance ID" hint="Auto-generated"><Input value={f.maintenance_id || autoId} readOnly disabled className="inp--auto" /></Field>
        <Field label="Service / Item Name" required><Input value={f.service_name} onChange={(e) => set("service_name", e.target.value)} placeholder="e.g. ChatGPT Plus, Hosting…" /></Field>
        <Field label="Provider / Vendor"><Input value={f.vendor} onChange={(e) => set("vendor", e.target.value)} placeholder="Optional" /></Field>
        <Field label="Payment Date"><DateInput value={f.payment_date || ""} onChange={(v) => set("payment_date", v)} /></Field>
        <Field label="Amount"><Input type="number" step="0.01" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
        <Field label="Currency"><Select value={f.currency} onChange={(e) => set("currency", e.target.value)}><option>USD</option><option>EGP</option></Select></Field>
        <Field label="Payment Method"><Select value={f.payment_method} onChange={(e) => set("payment_method", e.target.value)}>{MNT_METHODS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{Object.keys(MNT_STATUS).map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Billing Cycle"><Select value={f.billing_cycle} onChange={(e) => set("billing_cycle", e.target.value)}><option>Monthly</option><option>Yearly</option><option>One-time</option></Select></Field>
        <Field label="Renewal / Next Payment"><DateInput value={f.renewal_date || ""} onChange={(v) => set("renewal_date", v)} /></Field>
        <Field label="Notes" span={12}><Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" /></Field>
        <Field label="Attachment" hint="PDF or image — invoice or receipt" span={12}><MediaAttachment value={f.attachment} onChange={(v) => set("attachment", v)} /></Field>
      </div>
    </Modal>
  );
}

function MaintenanceDetail() {
  const [db] = useDB();
  const { route, go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const m = (db.maintenance || []).find((x) => x.id === route.params.id);
  const [modal, setModal] = useFS(null);
  if (!m) return <div className="fade-in"><PageHead title="Maintenance not found" /><Btn icon="arrow-left" onClick={() => go("maintenance")}>Back to maintenance</Btn></div>;
  const del = async () => { if (await confirm({ title: "Delete maintenance?", message: `Remove ${m.maintenance_id}?`, danger: true, okLabel: "Delete" })) { DB.remove("maintenance", m.id); toast("Maintenance deleted", "del"); go("maintenance"); } };
  const field = (label, val, mono) => (<div className="info-cell"><span className="info-cell__k">{label}</span><span className={`info-cell__v${mono ? " cell-mono" : ""}`}>{(val === 0 || val) ? val : "—"}</span></div>);
  return (
    <div className="fade-in">
      {confirmNode}
      <div className="flex items-center justify-between wrap gap-10" style={{ marginBottom: 4 }}>
        <button className="btn btn--ghost btn--sm" onClick={() => go("maintenance")}><Icon name="arrow-left" size={15} /><span>Back to maintenance</span></button>
        <div className="flex gap-8 wrap">
          <Btn variant="soft" icon="edit" onClick={() => setModal({ mode: "edit", data: m })}>Edit</Btn>
          <Btn variant="danger-soft" icon="trash" onClick={del}>Delete</Btn>
        </div>
      </div>
      <PageHead crumb={<span>Finance · Maintenance · {m.maintenance_id}</span>} title={m.service_name}
        sub={`${m.maintenance_id}${m.vendor ? " · " + m.vendor : ""}`} actions={<Badge variant={MNT_STATUS[m.status] || "muted"}>{m.status}</Badge>} />
      <div className="detail-grid">
        <div className="detail-main">
          <Card>
            <div className="card__head"><h3 className="card__title">Maintenance Information</h3></div>
            <div className="card__body info-grid">
              {field("Maintenance ID", <span className="code-pill">{m.maintenance_id}</span>)}
              {field("Service / Item", m.service_name)}
              {field("Provider / Vendor", m.vendor)}
              {field("Payment Date", fmtDate(m.payment_date), true)}
              {field("Amount", money(m.amount, m.currency), true)}
              {field("Currency", m.currency, true)}
              {field("Payment Method", m.payment_method)}
              {field("Status", <Badge variant={MNT_STATUS[m.status] || "muted"}>{m.status}</Badge>)}
              {field("Billing Cycle", m.billing_cycle)}
              {field("Renewal / Next Payment", fmtDate(m.renewal_date), true)}
              {field("Attachment", <MediaViewLink value={m.attachment} />)}
              {(() => { const p = window.Capital && m.status === "Paid" && Capital.isPosted("maintenance", m.maintenance_id); return p ? field("Company Capital", <span className="badge badge--ok"><span className="badge__dot"></span>Posted · {p.txn_code}</span>) : null; })()}
              {m.notes ? <div className="info-cell" style={{ gridColumn: "1 / -1" }}><span className="info-cell__k">Notes</span><span className="info-cell__v">{m.notes}</span></div> : null}
            </div>
          </Card>
        </div>
        <div className="detail-side">
          <Card className="calc-summary">
            <div className="card__body">
              <h3 className="card__title" style={{ marginBottom: 16 }}>Expense Summary</h3>
              <div className="calc-sum-row"><span>Amount</span><span>{money(m.amount, m.currency)}</span></div>
              <div className="calc-sum-row"><span>In USD</span><span>{money(toUSD(m.amount, m.currency), "USD")}</span></div>
              <div className="calc-sum-row"><span>Cycle</span><span>{m.billing_cycle || "—"}</span></div>
              <div className="calc-sum-div"></div>
              <div className="calc-sum-row strong"><span>Status</span><span><Badge variant={MNT_STATUS[m.status] || "muted"}>{m.status}</Badge></span></div>
              <div className="calc-grand">
                <div><div className="calc-grand__label">Counted In</div><div className="calc-grand__eff">{monthLabel(monthKey(m.payment_date))} expenses</div></div>
                <div className="calc-grand__num">{money(m.amount, m.currency)}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
      {modal ? <MaintenanceModal modal={modal} db={db} onClose={() => setModal(null)} /> : null}
    </div>
  );
}

// ===================================================================
// COMPANY CAPITAL — the cash-based capital ledger lives in capital.jsx
// (window.CompanyCapital), loaded after this file. Kept out of here so
// the ledger engine and page stay self-contained.
// ===================================================================

Object.assign(window, { Invoices, InvoiceDetailPage, FinanceDashboard, Maintenance, MaintenanceDetail, FinanceTabs, FinanceStat });
