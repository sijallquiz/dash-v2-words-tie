/* global React, useDB, useRouter, DB, nextCode, Icon, Btn, Badge, StatusBadge, Card, PageHead, SearchField, Field, Input, Textarea, Select, CheckCard, Table, EmptyRow, usePaginate, Pager, Modal, useConfirm, toast, LangPair, fmtDate, initials, NotFound */
const { useState: useCS, useMemo: useCM } = React;

// ===================================================================
// CLIENTS
// ===================================================================
function Clients() {
  const [db] = useDB();
  const { route, go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const [q, setQ] = useCS("");
  const [modal, setModal] = useCS(null); // {mode, data}

  // Open the edit modal when arrived here via "Edit" on the Client Overview
  // page (go("clients", { edit: <id> })). Consume the param once so reopening
  // the list later doesn't pop the modal again.
  React.useEffect(() => {
    const editId = route && route.params && route.params.edit;
    if (editId == null) return;
    const target = db.clients.find((x) => x.id === editId);
    if (target) setModal({ mode: "edit", data: target });
    if (route.params) delete route.params.edit;
  }, [route && route.params && route.params.edit]);

  const filtered = useCM(() => db.clients.filter((c) =>
    !q || `${c.client_code} ${c.name} ${c.email} ${c.phone} ${c.agency || ""} ${c.currency || ""}`.toLowerCase().includes(q.toLowerCase())), [db.clients, q]);
  const { page, setPage, pages, slice, total } = usePaginate(filtered, 8);

  const del = async (c) => { if (await confirm({ title: "Delete client?", message: `Permanently remove ${c.name}?`, danger: true, okLabel: "Delete" })) { DB.remove("clients", c.id); toast("Client deleted", "del"); } };

  return (
    <div className="fade-in">
      {confirmNode}
      <PageHead crumb={<span>Workspace · Clients</span>} title="Clients" sub="Companies and contacts you deliver to."
        actions={can(db, "Create Client") ? <Btn variant="primary" icon="plus" onClick={() => setModal({ mode: "new" })}>New Client</Btn> : null} />
      <Card className="tbl-center">
        <div className="card__head"><SearchField value={q} onChange={setQ} placeholder="Search clients" /></div>
        <Table columns={[{ label: "Code" }, { label: "Name" }, { label: "Email" }, { label: "Phone" }, { label: "Company" }, { label: "Currency" }, { label: "Actions", end: true }]}>
          {slice.length === 0 ? <EmptyRow span={7} icon="address-book" text="No clients found." /> :
            slice.map((c) => (
              <tr key={c.id}>
                <td><button className="code-pill" onClick={() => go("client", { id: c.id })}>{c.client_code}</button></td>
                <td className="lead-cell">{c.name}</td>
                <td className="muted" style={{ fontSize: 13.5 }}>{c.email}</td>
                <td className="cell-mono" style={{ fontSize: 12.5 }}>{c.phone}</td>
                <td>{c.agency && c.agency !== "—" ? <Badge variant="primary">{c.agency}</Badge> : <span className="muted">—</span>}</td>
                <td><Badge variant="muted">{c.currency}</Badge></td>
                <td className="text-end"><div className="row-actions">
                  <button className="act act--view" title="View" onClick={() => go("client", { id: c.id })}><Icon name="eye" size={16} /></button>
                  {can(db, "Update Client") ? <button className="act act--edit" title="Edit" onClick={() => setModal({ mode: "edit", data: c })}><Icon name="edit" size={16} /></button> : null}
                  {can(db, "Delete Client") ? <button className="act act--del" title="Delete" onClick={() => del(c)}><Icon name="trash" size={16} /></button> : null}
                </div></td>
              </tr>
            ))}
        </Table>
        <div className="card__foot"><Pager page={page} pages={pages} setPage={setPage} total={total} /></div>
      </Card>
      {modal ? <ClientModal modal={modal} onClose={() => setModal(null)} clients={db.clients} /> : null}
    </div>
  );
}

function ClientModal({ modal, onClose, clients }) {
  const editing = modal.mode === "edit";
  const [f, setF] = useCS(() => editing
    ? { attachment: null, extra_data: [], price_service: [], ...modal.data, extra_data: modal.data.extra_data || [], price_service: modal.data.price_service || [] }
    : { client_code: nextCode(clients, "client_code", "WT-C-"), name: "", email: "", phone: "", agency: "", currency: "USD", notes: "", attachment: null, extra_data: [], price_service: [] });
  const [err, setErr] = useCS({});
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const addExtra = () => setF((p) => ({ ...p, extra_data: [...(p.extra_data || []), { name: "", email: "", notes: "" }] }));
  const setExtra = (i, key, v) => setF((p) => ({ ...p, extra_data: p.extra_data.map((r, x) => x === i ? { ...r, [key]: v } : r) }));
  const delExtra = (i) => setF((p) => ({ ...p, extra_data: p.extra_data.filter((_, x) => x !== i) }));
  const addPrice = () => setF((p) => ({ ...p, price_service: [...(p.price_service || []), { service: "", price: "" }] }));
  const setPrice = (i, key, v) => setF((p) => ({ ...p, price_service: p.price_service.map((r, x) => x === i ? { ...r, [key]: v } : r) }));
  const delPrice = (i) => setF((p) => ({ ...p, price_service: p.price_service.filter((_, x) => x !== i) }));
  const save = () => {
    const e = {};
    if (!f.name.trim()) e.name = "Name is required";
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Invalid email";
    setErr(e); if (Object.keys(e).length) return;
    const clean = { ...f, extra_data: (f.extra_data || []).filter((r) => r.name || r.email || r.notes), price_service: (f.price_service || []).filter((r) => r.service || r.price) };
    if (editing) { DB.update("clients", modal.data.id, clean); toast("Client updated"); }
    else { DB.insert("clients", clean); toast("Client created"); }
    onClose();
  };
  return (
    <Modal title={editing ? "Edit client" : "New client"} lg onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>{editing ? "Save" : "Create"}</Btn></>}>
      <div className="form-grid">
        <Field label="Client Code" required><Input value={f.client_code} onChange={(e) => set("client_code", e.target.value)} /></Field>
        <Field label="Currency"><Select value={f.currency} onChange={(e) => set("currency", e.target.value)}><option>USD</option><option>EGP</option><option>EUR</option><option>GBP</option></Select></Field>
        <Field label="Name" required error={err.name} span={12}><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Company or person" /></Field>
        <Field label="Email" error={err.email}><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Company"><Input value={f.agency} onChange={(e) => set("agency", e.target.value)} placeholder="Optional" /></Field>
        <Field label="Notes" span={12}><Textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
      <div style={{ marginTop: 20 }}>
        <div className="flex items-center" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <div><label style={{ fontWeight: 600, fontSize: 14 }}>Extra Data</label><div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Additional contacts linked to this client.</div></div>
          <Btn variant="soft" size="sm" icon="plus" onClick={addExtra}>Extra Data</Btn>
        </div>
        {(f.extra_data || []).length === 0
          ? <p className="muted" style={{ fontSize: 13, margin: 0 }}>No extra contacts. Click “+ Extra Data” to add one.</p>
          : (f.extra_data || []).map((r, i) => (
            <div className="rep-row rep-row--triple" key={i}>
              <Field label="Name"><Input value={r.name} onChange={(e) => setExtra(i, "name", e.target.value)} placeholder="Contact name" /></Field>
              <Field label="Email"><Input type="email" value={r.email} onChange={(e) => setExtra(i, "email", e.target.value)} placeholder="name@example.com" /></Field>
              <Field label="Notes"><Input value={r.notes} onChange={(e) => setExtra(i, "notes", e.target.value)} placeholder="Optional" /></Field>
              <button className="rep-del" onClick={() => delExtra(i)} title="Remove row"><Icon name="trash" size={16} /></button>
            </div>
          ))}
      </div>
      <div style={{ marginTop: 20 }}>
        <div className="flex items-center" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <div><label style={{ fontWeight: 600, fontSize: 14 }}>Price Service</label><div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Agreed service rates for this client.</div></div>
          <Btn variant="soft" size="sm" icon="plus" onClick={addPrice}>Price Service</Btn>
        </div>
        {(f.price_service || []).length === 0
          ? <p className="muted" style={{ fontSize: 13, margin: 0 }}>No price services. Click “+ Price Service” to add one.</p>
          : (f.price_service || []).map((r, i) => (
            <div className="rep-row rep-row--pair" key={i}>
              <Field label="Type of service"><Input value={r.service} onChange={(e) => setPrice(i, "service", e.target.value)} placeholder="e.g. Translation" /></Field>
              <Field label="Price"><Input value={r.price} onChange={(e) => setPrice(i, "price", e.target.value)} placeholder="e.g. 0.08 or 25 EGP/page" /></Field>
              <button className="rep-del" onClick={() => delPrice(i)} title="Remove row"><Icon name="trash" size={16} /></button>
            </div>
          ))}
      </div>
      <div style={{ marginTop: 20 }}>
        <Field label="Attachment" hint="PDF only"><PdfAttachment value={f.attachment} onChange={(v) => set("attachment", v)} /></Field>
      </div>
    </Modal>
  );
}

// ---- Client Overview helpers (internal only) ----------------------
// Live project ledger math, mirrored from the Operations page so the
// Projects tab shows the same client amount / cost / profit numbers.
const CL_PRJ_STATUS = { "Delivered": "ok", "In Progress": "info", "Pending": "warn", "Cancelled": "danger", "On Hold": "muted" };
const CL_PAY_STATUS = { "Paid": "ok", "Unpaid": "danger", "Partially Paid": "warn" };
const clNum = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));
function clProjectMath(p) {
  const vol = clNum(p.volume);
  const clientAmount = vol * clNum(p.client_rate);
  const flCost = vol * clNum(p.fl_rate);
  const profit = clientAmount - flCost;
  const margin = clientAmount ? (profit / clientAmount) * 100 : 0;
  return { clientAmount, flCost, profit, margin };
}
// Pull leading integer out of free-text counts like "8,420" / "24 pages".
const clCount = (s) => parseInt(String(s == null ? "" : s).replace(/[^\d]/g, ""), 10) || 0;
// Latest ISO date in a list, formatted dd/mm/yyyy (or — if none).
function clLastDate(dates) {
  const valid = dates.filter(Boolean).map((d) => new Date(d)).filter((d) => !isNaN(d));
  if (!valid.length) return "\u2014";
  return fmtDate(new Date(Math.max(...valid.map((d) => d.getTime()))).toISOString().slice(0, 10));
}
// Paid portion of a client invoice: a leg counts as paid once its date is set
// (mirrors the Company Capital posting rule — deposit/remaining received).
const clInvPaid = (i) => ((i.date_20 ? +i.payment_20 || 0 : 0) + (i.date_80 ? +i.payment_80 || 0 : 0));
const clInvTotal = (i) => ((+i.payment_20 || 0) + (+i.payment_80 || 0));
const SERVICE_STATUS = { pending: "Pending", in_progress: "In Progress", completed: "Completed" };

// Compact month <Select> built from a list of ISO dates (newest first).
function ClMonthFilter({ value, onChange, dates }) {
  const opts = useCM(() => {
    const m = new Map();
    dates.forEach((d) => { if (d && /^\d{4}-\d{2}/.test(d)) { const k = d.slice(0, 7); if (!m.has(k)) m.set(k, new Date(d).toLocaleString("en-US", { month: "long", year: "numeric" })); } });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [dates]);
  return (
    <Select className="inp" style={{ width: "auto", height: 42, paddingTop: 0, paddingBottom: 0 }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All Months</option>
      {opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </Select>
  );
}

function ClientDetail() {
  const [db] = useDB();
  const { route, go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const [tab, setTab] = useCS("overview");
  // per-table search / filter state (declared unconditionally — hooks rule)
  const [taskQ, setTaskQ] = useCS(""); const [taskStatus, setTaskStatus] = useCS(""); const [taskMonth, setTaskMonth] = useCS("");
  const [invQ, setInvQ] = useCS(""); const [invStatus, setInvStatus] = useCS(""); const [invMonth, setInvMonth] = useCS("");
  const [prjQ, setPrjQ] = useCS(""); const [prjStatus, setPrjStatus] = useCS(""); const [prjPay, setPrjPay] = useCS("");
  const [fileQ, setFileQ] = useCS("");

  const c = db.clients.find((x) => x.id === route.params.id);

  // ---- linked records (always by Client Code, never by name) ----
  const tasks = useCM(() => c ? db.tasks.filter((t) => t.client_code === c.client_code && !t.isDeleted) : [], [db.tasks, c]);
  const invoices = useCM(() => c ? db.clientInvoices.filter((i) => i.client_code === c.client_code) : [], [db.clientInvoices, c]);
  // Projects ledger links: prefer the task→client_code chain, fall back to the
  // ledger's stored client_name. Either match keeps the client relationship.
  const projects = useCM(() => {
    if (!c) return [];
    return db.projects.filter((p) => {
      const t = p.task_code ? db.tasks.find((x) => x.task_number === p.task_code) : null;
      if (t && t.client_code === c.client_code) return true;
      return p.client_name && c.name && p.client_name.trim().toLowerCase() === c.name.trim().toLowerCase();
    });
  }, [db.projects, db.tasks, c]);

  if (!c) return <NotFound go={go} back="clients" />;

  // ---- KPI roll-ups ----
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const activeTasks = tasks.filter((t) => t.status !== "completed").length;
  const totalInvoiced = invoices.reduce((s, i) => s + clInvTotal(i), 0);
  const paidAmount = invoices.reduce((s, i) => s + clInvPaid(i), 0);
  const outstanding = Math.max(0, totalInvoiced - paidAmount);
  const totalWords = tasks.reduce((s, t) => s + clCount(t.words_count), 0);
  const totalPages = tasks.reduce((s, t) => s + clCount(t.page_numbers), 0);
  const lastActivity = clLastDate([
    ...tasks.flatMap((t) => [t.created_at, t.start_date, t.end_date]),
    ...invoices.flatMap((i) => [i.date_20, i.date_80]),
  ]);
  const svcByName = (id) => (db.services.find((s) => s.id === id) || {}).name;

  const del = async () => { if (await confirm({ title: "Delete client?", message: `Permanently remove ${c.name}? This cannot be undone.`, danger: true, okLabel: "Delete" })) { DB.remove("clients", c.id); toast("Client deleted", "del"); go("clients"); } };
  const invoicePdf = (inv) => { if (window.exportInvoicePDF) window.exportInvoicePDF(inv, "client", db, { autoPrint: false }); else toast("Invoice PDF engine not loaded", "info"); };
  const invoiceDl = (inv) => { if (window.exportInvoicePDF) window.exportInvoicePDF(inv, "client", db, { autoPrint: true }); };

  // ---- filtered task list ----
  const tasksF = useCM(() => tasks.filter((t) => {
    const langs = (t.language_pair || []).map((p) => `${p.source || ""} ${p.target || ""}`).join(" ");
    const svc = (t.service_ids || []).map(svcByName).filter(Boolean).join(" ");
    const statusLabel = (STATUS_MAP[t.status] || {}).label || t.status || "";
    const hay = `${t.task_number} ${c.client_code} ${t.client_task_name || ""} ${svc} ${t.file_status || ""} ${expandLangs(langs)} ${statusLabel} ${fmtDate(t.start_date)} ${fmtDate(t.end_date)} ${t.creator || ""}`.toLowerCase();
    return (!taskQ || hay.includes(taskQ.toLowerCase())) && (!taskStatus || t.status === taskStatus) && (!taskMonth || (t.start_date && t.start_date.slice(0, 7) === taskMonth));
  }), [tasks, taskQ, taskStatus, taskMonth]);

  // ---- filtered invoice list ----
  const invoicesF = useCM(() => invoices.filter((i) => {
    const dates = [i.date_20, i.date_80].filter(Boolean).map(fmtDate).join(" ");
    const hay = `${i.invoice_code || ""} ${i.task_code || ""} ${c.client_code} ${i.status || ""} ${i.currency || ""} ${clInvTotal(i)} ${dates}`.toLowerCase();
    return (!invQ || hay.includes(invQ.toLowerCase())) && (!invStatus || i.status === invStatus) && (!invMonth || (i.date_20 && i.date_20.slice(0, 7) === invMonth) || (i.date_80 && i.date_80.slice(0, 7) === invMonth));
  }), [invoices, invQ, invStatus, invMonth]);

  // ---- filtered projects list ----
  const projectsF = useCM(() => projects.filter((p) => {
    if (prjStatus && p.status !== prjStatus) return false;
    if (prjPay && p.payment_status !== prjPay) return false;
    if (!prjQ) return true;
    const hay = `${p.task_code || ""} ${p.project_id || ""} ${c.client_code} ${p.service_type || ""} ${p.specialization || ""} ${expandLangs(p.language_pair)} ${p.status || ""} ${p.payment_status || ""} ${fmtDate(p.date)} ${fmtDate(p.deadline)}`.toLowerCase();
    return hay.includes(prjQ.toLowerCase());
  }), [projects, prjQ, prjStatus, prjPay]);

  // ---- unified file/attachment list ----
  const files = useCM(() => {
    const out = [];
    if (c.attachment && c.attachment.data) out.push({ key: "client", name: c.attachment.name || "Client attachment.pdf", source: "Client", date: c.attachment.uploaded_at || "", data: c.attachment.data, type: c.attachment.type });
    tasks.forEach((t) => (t.media || []).forEach((m) => out.push({ key: `t${t.id}-${m.id}`, name: m.original_name || "file", source: t.task_number, taskId: t.id, date: m.updated_at || m.created_at || "", data: m.data, type: m.type })));
    invoices.forEach((i) => {
      (i.media || []).forEach((m) => out.push({ key: `i${i.id}-${m.id}`, name: m.original_name || "file", source: i.invoice_code, date: m.updated_at || m.created_at || "", data: m.data, type: m.type }));
      if (i.attachment && i.attachment.data) out.push({ key: `ia${i.id}`, name: i.attachment.name || "invoice attachment", source: i.invoice_code, date: i.attachment.uploaded_at || "", data: i.attachment.data, type: i.attachment.type });
    });
    return out;
  }, [c, tasks, invoices]);
  const filesF = files.filter((f) => !fileQ || `${f.name} ${f.source}`.toLowerCase().includes(fileQ.toLowerCase()));
  const dlFile = (f) => { if (!f.data) { toast("This file has no stored data to download", "info"); return; } const a = document.createElement("a"); a.href = f.data; a.download = f.name || "file"; document.body.appendChild(a); a.click(); a.remove(); };

  const TABS = [
    ["overview", "Overview", null],
    ["tasks", "Tasks", tasks.length],
    ["invoices", "Client Invoices", invoices.length],
    ["projects", "Projects Ledger", projects.length],
    ["prices", "Price Services", (c.price_service || []).length],
    ["files", "Files", files.length],
    ["notes", "Notes", null],
  ];

  return (
    <div className="fade-in">
      {confirmNode}
      {/* top bar — Back left, Edit/Delete right (matches Task Details) */}
      <div className="flex items-center" style={{ justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <button className="btn btn--ghost" onClick={() => go("clients")}><Icon name="arrow-left" size={17} /><span>Back to clients</span></button>
        <div className="flex gap-8">
          <Btn variant="soft" icon="edit" onClick={() => go("clients", { edit: c.id })}>Edit</Btn>
          <Btn variant="danger-soft" icon="trash" onClick={del}>Delete</Btn>
        </div>
      </div>

      {/* header card */}
      <Card style={{ marginBottom: 18 }}>
        <div className="card__body flex items-center gap-16" style={{ flexWrap: "wrap" }}>
          <span className="avatar" style={{ width: 66, height: 66, fontSize: 23, borderRadius: 18 }}>{initials(c.name)}</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="flex items-center gap-12 wrap"><h2 style={{ margin: 0, fontFamily: "var(--display)", fontSize: 26 }}>{c.name}</h2><span className="code-pill">{c.client_code}</span><Badge variant="muted">{c.currency}</Badge></div>
            <div className="flex items-center gap-16 wrap" style={{ marginTop: 8, color: "var(--ink-3)", fontSize: 13.5 }}>
              {c.email ? <span className="flex items-center gap-6"><Icon name="mail" size={15} style={{ opacity: .7 }} />{c.email}</span> : null}
              {c.phone ? <span className="flex items-center gap-6 cell-mono"><Icon name="user" size={15} style={{ opacity: .7 }} />{c.phone}</span> : null}
              {c.agency && c.agency !== "—" ? <span className="flex items-center gap-6"><Icon name="building" size={15} style={{ opacity: .7 }} />{c.agency}</span> : null}
            </div>
          </div>
          {c.attachment && c.attachment.data
            ? <a className="btn btn--soft" href={c.attachment.data} target="_blank" rel="noreferrer" download={c.attachment.name || "attachment.pdf"} style={{ textDecoration: "none" }}><Icon name="file" size={16} /><span>Attachment</span></a>
            : null}
        </div>
      </Card>

      {/* KPI cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <ClKpi ic="tasks" tone="ic-primary" label="Total Tasks" value={tasks.length} />
        <ClKpi ic="clock" tone="ic-info" label="Active Tasks" value={activeTasks} />
        <ClKpi ic="check" tone="ic-ok" label="Completed Tasks" value={completedTasks} />
        <ClKpi ic="file-invoice" tone="ic-primary" label="Total Invoiced" value={money(totalInvoiced, c.currency)} small />
        <ClKpi ic="wallet" tone="ic-ok" label="Paid Amount" value={money(paidAmount, c.currency)} small />
        <ClKpi ic="coin" tone="ic-warn" label="Outstanding" value={money(outstanding, c.currency)} small />
        <ClKpi ic="language" tone="ic-info" label="Total Words / Pages" value={totalWords.toLocaleString()} foot={`${totalPages.toLocaleString()} pages`} small />
        <ClKpi ic="calendar" tone="ic-primary" label="Last Activity" value={lastActivity} small />
      </div>

      {/* tabs */}
      <div className="tabs">
        {TABS.map(([k, l, n]) => (
          <button key={k} className={`tab${tab === k ? " on" : ""}`} onClick={() => setTab(k)}>{l}{n != null ? <span className="badge badge--muted">{n}</span> : null}</button>
        ))}
      </div>

      {/* ---------------- OVERVIEW ---------------- */}
      {tab === "overview" ? (
        <div className="detail-grid">
          <div className="row-gap">
            <Card>
              <div className="card__head"><h3 className="card__title">Client Information</h3></div>
              <div className="card__body">
                <div className="kv">
                  <div><span className="kv__k">Client Code</span><span className="kv__v"><span className="code-pill">{c.client_code}</span></span></div>
                  <div><span className="kv__k">Currency</span><span className="kv__v">{c.currency || "—"}</span></div>
                  <div><span className="kv__k">Name</span><span className="kv__v">{c.name}</span></div>
                  <div><span className="kv__k">Company</span><span className="kv__v">{c.agency && c.agency !== "—" ? c.agency : "—"}</span></div>
                  <div><span className="kv__k">Email</span><span className="kv__v" style={{ wordBreak: "break-all" }}>{c.email || "—"}</span></div>
                  <div><span className="kv__k">Phone</span><span className="kv__v cell-mono">{c.phone || "—"}</span></div>
                </div>
                {c.notes ? <div style={{ marginTop: 20 }}><span className="kv__k">Notes</span><p style={{ margin: "6px 0 0", color: "var(--ink-2)" }}>{c.notes.length > 220 ? c.notes.slice(0, 220) + "…" : c.notes}</p></div> : null}
              </div>
            </Card>
            {(c.extra_data || []).length ? (
              <Card>
                <div className="card__head"><h3 className="card__title">Extra Data</h3><span className="badge badge--muted">{c.extra_data.length}</span></div>
                <div className="card__body row-gap">
                  {c.extra_data.map((r, i) => (
                    <div key={i} style={{ paddingBottom: 12, borderBottom: i < c.extra_data.length - 1 ? "1px solid var(--line-2)" : "none" }}>
                      <div style={{ fontWeight: 700 }}>{r.name || "—"}</div>
                      {r.email ? <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{r.email}</div> : null}
                      {r.notes ? <div style={{ fontSize: 13, marginTop: 4 }}>{r.notes}</div> : null}
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>
          <div className="row-gap">
            <Card>
              <div className="card__head"><h3 className="card__title">Financial Summary</h3></div>
              <div className="card__body">
                <div className="summary-row"><span className="summary-row__k">Total Tasks</span><span className="summary-row__v">{tasks.length}</span></div>
                <div className="summary-row"><span className="summary-row__k">Total Invoices</span><span className="summary-row__v">{invoices.length}</span></div>
                <div className="summary-row"><span className="summary-row__k">Total Billed</span><span className="summary-row__v">{money(totalInvoiced, c.currency)}</span></div>
                <div className="summary-row"><span className="summary-row__k">Paid Amount</span><span className="summary-row__v" style={{ color: "var(--ok)" }}>{money(paidAmount, c.currency)}</span></div>
                <div className="summary-row"><span className="summary-row__k">Outstanding</span><span className="summary-row__v" style={{ color: outstanding > 0 ? "var(--warn)" : "var(--ink)" }}>{money(outstanding, c.currency)}</span></div>
                <div className="summary-row"><span className="summary-row__k">Attachment</span><span className="summary-row__v">{c.attachment && c.attachment.data
                  ? <a className="link" href={c.attachment.data} target="_blank" rel="noreferrer" download={c.attachment.name || "attachment.pdf"}>View PDF</a> : "—"}</span></div>
              </div>
            </Card>
            {(c.price_service || []).length ? (
              <Card>
                <div className="card__head"><h3 className="card__title">Price Services</h3><span className="badge badge--muted">{c.price_service.length}</span></div>
                <div className="card__body">
                  {c.price_service.map((r, i) => (
                    <div className="summary-row" key={i}><span className="summary-row__k">{r.service || "—"}</span><span className="summary-row__v">{r.price || "—"}</span></div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ---------------- TASKS ---------------- */}
      {tab === "tasks" ? (
        <Card className="tbl-center">
          <div className="card__head">
            <div className="toolbar">
              <SearchField value={taskQ} onChange={setTaskQ} placeholder="Search code, service, language, status, date" />
              <Select className="inp" style={{ width: "auto", height: 42, paddingTop: 0, paddingBottom: 0 }} value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)}>
                <option value="">All Status</option><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
              </Select>
              <ClMonthFilter value={taskMonth} onChange={setTaskMonth} dates={tasks.map((t) => t.start_date)} />
              {(taskQ || taskStatus || taskMonth) ? <Btn variant="ghost" size="sm" onClick={() => { setTaskQ(""); setTaskStatus(""); setTaskMonth(""); }}>Reset</Btn> : null}
            </div>
          </div>
          <Table columns={[{ label: "Task Code" }, { label: "Client Task Name", start: true }, { label: "Service / File" }, { label: "Languages" }, { label: "Words / Pages" }, { label: "Status" }, { label: "Start" }, { label: "End" }, { label: "Created By" }, { label: "Actions", end: true }]}>
            {tasksF.length === 0 ? <EmptyRow span={10} icon="tasks" text="No tasks found." /> :
              tasksF.map((t) => {
                const svc = (t.service_ids || []).map(svcByName).filter(Boolean);
                return (
                <tr key={t.id}>
                  <td><button className="code-pill" onClick={() => go("task", { id: t.id })} title="Open task details">{t.task_number}</button></td>
                  <td className="name-left">{t.client_task_name ? <span className="lead-cell">{t.client_task_name}</span> : <span className="muted">—</span>}</td>
                  <td className="name-left"><div className="flex flex-col gap-4" style={{ alignItems: "flex-start" }}>{svc.length ? <Badge variant="primary">{svc[0]}{svc.length > 1 ? ` +${svc.length - 1}` : ""}</Badge> : <span className="muted">—</span>}{t.file_status ? <span className="muted" style={{ fontSize: 11.5 }}>{t.file_status}</span> : null}</div></td>
                  <td>{(t.language_pair || []).slice(0, 2).map((p, i) => <div key={i} style={{ marginBottom: 3 }}><LangPair {...p} /></div>)}</td>
                  <td className="cell-mono">{t.words_count || "—"}{t.page_numbers && t.page_numbers !== "—" ? <span className="muted" style={{ fontSize: 11 }}> · {t.page_numbers}p</span> : null}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td className="cell-mono" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{fmtDate(t.start_date)}</td>
                  <td className="cell-mono" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{fmtDate(t.end_date)}</td>
                  <td style={{ fontSize: 13 }}>{t.creator || "—"}</td>
                  <td className="text-end"><div className="row-actions">
                    <button className="act act--view" title="View task" onClick={() => go("task", { id: t.id })}><Icon name="eye" size={16} /></button>
                    <button className="act act--edit" title="Edit task" onClick={() => go("task-edit", { id: t.id })}><Icon name="edit" size={16} /></button>
                  </div></td>
                </tr>
                );
              })}
          </Table>
          <div className="card__foot"><span className="muted" style={{ fontSize: 13 }}>{tasksF.length} of {tasks.length} tasks</span></div>
        </Card>
      ) : null}

      {/* ---------------- CLIENT INVOICES ---------------- */}
      {tab === "invoices" ? (
        <Card className="tbl-center">
          <div className="card__head">
            <div className="toolbar">
              <SearchField value={invQ} onChange={setInvQ} placeholder="Search invoice code, task code, status, date" />
              <Select className="inp" style={{ width: "auto", height: 42, paddingTop: 0, paddingBottom: 0 }} value={invStatus} onChange={(e) => setInvStatus(e.target.value)}>
                <option value="">All Status</option><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
              </Select>
              <ClMonthFilter value={invMonth} onChange={setInvMonth} dates={invoices.flatMap((i) => [i.date_20, i.date_80])} />
              {(invQ || invStatus || invMonth) ? <Btn variant="ghost" size="sm" onClick={() => { setInvQ(""); setInvStatus(""); setInvMonth(""); }}>Reset</Btn> : null}
            </div>
          </div>
          <Table columns={[{ label: "Invoice Code", start: true }, { label: "Task Code" }, { label: "Deposit Date" }, { label: "Remaining Date" }, { label: "Deposit" }, { label: "Remaining" }, { label: "Total Price" }, { label: "Status" }, { label: "Actions", end: true }]}>
            {invoicesF.length === 0 ? <EmptyRow span={9} icon="file-invoice" text="No invoices found." /> :
              invoicesF.map((i) => {
                const task = db.tasks.find((t) => t.task_number === i.task_code);
                return (
                <tr key={i.id}>
                  <td className="name-left"><button className="link cell-mono" style={{ fontWeight: 700 }} title="Open invoice PDF" onClick={() => invoicePdf(i)}>{i.invoice_code || "—"}</button></td>
                  <td>{task
                    ? <button className="code-pill" onClick={() => go("task", { id: task.id })} title="Open task details">{i.task_code}</button>
                    : <span className="cell-mono muted">{i.task_code || "—"}</span>}</td>
                  <td className="cell-mono" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{fmtDate(i.date_20)}</td>
                  <td className="cell-mono" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{fmtDate(i.date_80)}</td>
                  <td className="cell-mono">{money(i.payment_20, i.currency)}</td>
                  <td className="cell-mono">{money(i.payment_80, i.currency)}</td>
                  <td className="cell-mono lead-cell">{money(clInvTotal(i), i.currency)}</td>
                  <td><StatusBadge status={i.status} /></td>
                  <td className="text-end"><div className="row-actions">
                    <button className="act act--view" title="View invoice PDF" onClick={() => invoicePdf(i)}><Icon name="eye" size={16} /></button>
                    <button className="act act--pdf" title="Download invoice PDF" onClick={() => invoiceDl(i)}><Icon name="download" size={16} /></button>
                  </div></td>
                </tr>
                );
              })}
          </Table>
          <div className="card__foot"><span className="muted" style={{ fontSize: 13 }}>Deposit + Remaining = Total Price · {invoicesF.length} of {invoices.length} invoices</span></div>
        </Card>
      ) : null}

      {/* ---------------- PROJECTS LEDGER ---------------- */}
      {tab === "projects" ? (
        <Card className="tbl-center">
          <div className="card__head">
            <div className="toolbar">
              <SearchField value={prjQ} onChange={setPrjQ} placeholder="Search task #, service, language, date" />
              <Select className="inp" style={{ width: "auto", height: 42, paddingTop: 0, paddingBottom: 0 }} value={prjStatus} onChange={(e) => setPrjStatus(e.target.value)}>
                <option value="">All Status</option>{Object.keys(CL_PRJ_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Select className="inp" style={{ width: "auto", height: 42, paddingTop: 0, paddingBottom: 0 }} value={prjPay} onChange={(e) => setPrjPay(e.target.value)}>
                <option value="">All Payments</option>{Object.keys(CL_PAY_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              {(prjQ || prjStatus || prjPay) ? <Btn variant="ghost" size="sm" onClick={() => { setPrjQ(""); setPrjStatus(""); setPrjPay(""); }}>Reset</Btn> : null}
            </div>
          </div>
          <Table columns={[{ label: "Task Number" }, { label: "Client Code" }, { label: "Service" }, { label: "Source" }, { label: "Target" }, { label: "Volume" }, { label: "Client Amount" }, { label: "Freelancer Cost" }, { label: "Profit" }, { label: "Status" }, { label: "Payment" }, { label: "Actions", end: true }]}>
            {projectsF.length === 0 ? <EmptyRow span={12} icon="briefcase" text="No projects found." /> :
              projectsF.map((p) => {
                const m = clProjectMath(p);
                const task = db.tasks.find((t) => t.task_number === p.task_code);
                const pair = String(p.language_pair || "").split(",")[0] || "";
                const src = (pair.split(">")[0] || "").trim();
                const tgt = (pair.split(">")[1] || "").trim();
                return (
                <tr key={p.id}>
                  <td>{task
                    ? <button className="code-pill" onClick={() => go("task", { id: task.id })} title="Open task details">{p.task_code}</button>
                    : <span className="code-pill" style={{ opacity: .55, cursor: "default" }} title="No linked task">{p.task_code || p.project_id || "—"}</span>}</td>
                  <td><span className="code-pill" style={{ cursor: "default" }}>{c.client_code}</span></td>
                  <td className="name-left"><div className="lead-cell">{p.service_type}</div>{p.specialization ? <span className="muted" style={{ fontSize: 12 }}>{p.specialization}</span> : null}</td>
                  <td><span className="lang-pill">{src ? src.toUpperCase() : "—"}</span></td>
                  <td><span className="lang-pill">{tgt ? tgt.toUpperCase() : "—"}</span></td>
                  <td className="cell-mono">{clNum(p.volume).toLocaleString()} <span className="muted" style={{ fontSize: 11 }}>{p.unit}</span></td>
                  <td className="cell-mono">{money(m.clientAmount, "USD")}</td>
                  <td className="cell-mono" style={{ color: "var(--danger, #e0566b)" }}>{money(m.flCost, "USD")}</td>
                  <td className="cell-mono lead-cell" style={{ color: m.profit >= 0 ? "var(--ok)" : "var(--danger, #e0566b)" }}>{money(m.profit, "USD")}<span className="muted" style={{ fontSize: 11, fontWeight: 500 }}> · {m.margin.toFixed(0)}%</span></td>
                  <td><Badge variant={CL_PRJ_STATUS[p.status] || "muted"}>{p.status}</Badge></td>
                  <td><Badge variant={CL_PAY_STATUS[p.payment_status] || "muted"}>{p.payment_status}</Badge></td>
                  <td className="text-end"><div className="row-actions">
                    <button className="act act--view" title="View project" onClick={() => go("project", { id: p.id })}><Icon name="eye" size={16} /></button>
                  </div></td>
                </tr>
                );
              })}
          </Table>
          <div className="card__foot"><span className="muted" style={{ fontSize: 13 }}>Internal view — profit shown for dashboard users only · {projectsF.length} of {projects.length} projects</span></div>
        </Card>
      ) : null}

      {/* ---------------- PRICE SERVICES ---------------- */}
      {tab === "prices" ? (
        <Card className="tbl-center">
          <div className="card__head"><h3 className="card__title">Price Services</h3><Btn variant="soft" size="sm" icon="edit" onClick={() => go("clients", { edit: c.id })}>Edit in client form</Btn></div>
          <Table columns={[{ label: "Type of Service", start: true }, { label: "Price", end: true }]}>
            {(c.price_service || []).length === 0 ? <EmptyRow span={2} icon="file-dollar" text="No price services. Add them from the client Edit form." /> :
              c.price_service.map((r, i) => (
                <tr key={i}>
                  <td className="name-left lead-cell">{r.service || "—"}</td>
                  <td className="text-end cell-mono">{r.price || "—"}</td>
                </tr>
              ))}
          </Table>
        </Card>
      ) : null}

      {/* ---------------- FILES / ATTACHMENTS ---------------- */}
      {tab === "files" ? (
        <Card className="tbl-center">
          <div className="card__head"><div className="toolbar"><SearchField value={fileQ} onChange={setFileQ} placeholder="Search files by name or source" /></div></div>
          <Table columns={[{ label: "File", start: true }, { label: "Source" }, { label: "Date" }, { label: "Action", end: true }]}>
            {filesF.length === 0 ? <EmptyRow span={4} icon="files" text="No files or attachments linked to this client." /> :
              filesF.map((f) => {
                const isImg = /^image\//.test(f.type || "") || /\.(jpe?g|png|webp)$/i.test(f.name || "");
                return (
                <tr key={f.key}>
                  <td className="name-left"><span className="flex items-center gap-8"><Icon name={isImg ? "photo" : "file"} size={16} style={{ color: "var(--accent)" }} /><span className="lead-cell" style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.name}>{f.name}</span></span></td>
                  <td>{f.source && String(f.source).startsWith("T-") ? <button className="code-pill" onClick={() => f.taskId && go("task", { id: f.taskId })}>{f.source}</button> : <Badge variant="muted">{f.source}</Badge>}</td>
                  <td className="cell-mono" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{f.date ? fmtDate(f.date) : "—"}</td>
                  <td className="text-end"><div className="row-actions">
                    {f.data ? <a className="act act--view" href={f.data} target="_blank" rel="noreferrer" title="View"><Icon name="eye" size={16} /></a> : <span className="muted" style={{ fontSize: 12 }}>no file</span>}
                    {f.data ? <button className="act act--pdf" title="Download" onClick={() => dlFile(f)}><Icon name="download" size={16} /></button> : null}
                  </div></td>
                </tr>
                );
              })}
          </Table>
          <div className="card__foot"><span className="muted" style={{ fontSize: 13 }}>Client attachment, task files and invoice attachments · {filesF.length} files</span></div>
        </Card>
      ) : null}

      {/* ---------------- NOTES ---------------- */}
      {tab === "notes" ? (
        <Card>
          <div className="card__head"><h3 className="card__title">Notes</h3><Badge variant="muted">Internal</Badge></div>
          <div className="card__body">
            {c.notes ? <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6, color: "var(--ink-2)" }}>{c.notes}</p>
              : <p className="muted" style={{ margin: 0 }}>No notes for this client. Add them from the client Edit form.</p>}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

// KPI stat tile for the Client Overview header.
function ClKpi({ ic, tone, label, value, foot, small }) {
  return (
    <div className="stat">
      <div className="stat__top"><div className={`stat__ic ${tone}`}><Icon name={ic} size={23} /></div></div>
      <div className="stat__label">{label}</div>
      <div className="stat__num" style={{ fontSize: small ? 24 : 30, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      {foot ? <div className="stat__foot t-muted">{foot}</div> : null}
    </div>
  );
}

// ===================================================================
// FREELANCERS
// ===================================================================
function Freelancers() {
  const [db] = useDB();
  const { go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const [q, setQ] = useCS("");
  const [modal, setModal] = useCS(null);

  const filtered = useCM(() => db.freelancers.filter((c) => {
    const langs = (c.language_pair || []).map((p) => `${p.source || ""} ${p.target || ""}`).join(" ");
    return !q || `${c.freelancer_code} ${c.name} ${c.email} ${c.company || ""} ${expandLangs(langs)}`.toLowerCase().includes(q.toLowerCase());
  }), [db.freelancers, q]);
  const { page, setPage, pages, slice, total } = usePaginate(filtered, 8);
  const del = async (c) => { if (await confirm({ title: "Delete freelancer?", message: `Permanently remove ${c.name}?`, danger: true, okLabel: "Delete" })) { DB.remove("freelancers", c.id); toast("Freelancer deleted", "del"); } };

  return (
    <div className="fade-in">
      {confirmNode}
      <PageHead crumb={<span>Workspace · Freelancers</span>} title="Freelancers" sub="Your network of translators and specialists."
        actions={can(db, "Create Freelancer") ? <Btn variant="primary" icon="plus" onClick={() => setModal({ mode: "new" })}>New Freelancer</Btn> : null} />
      <Card className="tbl-center">
        <div className="card__head"><SearchField value={q} onChange={setQ} placeholder="Search by name, code, email or company" /></div>
        <Table columns={[{ label: "Code" }, { label: "Name" }, { label: "Company" }, { label: "Languages" }, { label: "Services" }, { label: "Rate" }, { label: "Quota" }, { label: "Actions", end: true }]}>
          {slice.length === 0 ? <EmptyRow span={8} icon="users" text="No freelancers found." /> :
            slice.map((c) => (
              <tr key={c.id}>
                <td><button className="code-pill" onClick={() => go("freelancer", { id: c.id })}>{c.freelancer_code}</button></td>
                <td className="name-left"><div className="flex items-center gap-12"><span className="mini-avatar">{initials(c.name)}</span><span className="lead-cell">{c.name}</span></div></td>
                <td>{c.company ? <span className="lead-cell">{c.company}</span> : <span className="muted">—</span>}</td>
                <td>{(c.language_pair || []).slice(0, 2).map((p, i) => <div key={i} style={{ marginBottom: 3 }}><LangPair {...p} /></div>)}</td>
                <td><div className="svc-stack">{(c.service_ids || []).map((id) => db.services.find((s) => s.id === id)).filter(Boolean).map((s) => <Badge key={s.id} variant="primary">{s.name}</Badge>)}</div></td>
                <td className="lead-cell">{c.price_hr} {c.currency}</td>
                <td className="muted" style={{ fontSize: 13 }}>{c.quota}</td>
                <td className="text-end"><div className="row-actions">
                  <button className="act act--view" onClick={() => go("freelancer", { id: c.id })}><Icon name="eye" size={16} /></button>
                  {can(db, "Update Freelancer") ? <button className="act act--edit" onClick={() => setModal({ mode: "edit", data: c })}><Icon name="edit" size={16} /></button> : null}
                  {can(db, "Delete Freelancer") ? <button className="act act--del" onClick={() => del(c)}><Icon name="trash" size={16} /></button> : null}
                </div></td>
              </tr>
            ))}
        </Table>
        <div className="card__foot"><Pager page={page} pages={pages} setPage={setPage} total={total} /></div>
      </Card>
      {modal ? <FreelancerModal modal={modal} onClose={() => setModal(null)} freelancers={db.freelancers} services={db.services} industries={db.industries} /> : null}
    </div>
  );
}

function FreelancerModal({ modal, onClose, freelancers, services, industries }) {
  const editing = modal.mode === "edit";
  // Auto-generated code: smallest unused sequence number, so deleting a
  // freelancer frees its number to be re-used and the run stays contiguous.
  const nextFreelancerCode = () => {
    const used = new Set(freelancers.map((x) => parseInt(String(x.freelancer_code || "").replace(/\D/g, ""), 10)).filter((n) => n > 0));
    let n = 1; while (used.has(n)) n++;
    return `WT-F-${String(n).padStart(4, "0")}`;
  };
  const [f, setF] = useCS(() => editing ? { attachment: null, ...modal.data, language_pair: modal.data.language_pair || [{ source: "", target: "" }], service_ids: modal.data.service_ids || [], industry_ids: modal.data.industry_ids || [] }
    : { freelancer_code: nextFreelancerCode(), name: "", email: "", phone: "", company: "", quota: "", price_hr: "", price_page: "", currency: "USD", notes: "", attachment: null, service_ids: [], industry_ids: [], language_pair: [{ source: "", target: "", rate_translation: "", rate_editing: "", rate_mtpe: "" }] });
  const [err, setErr] = useCS({});
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setLang = (i, key, v) => setF((p) => ({ ...p, language_pair: p.language_pair.map((r, x) => x === i ? { ...r, [key]: v } : r) }));
  const addLang = () => setF((p) => ({ ...p, language_pair: [...p.language_pair, { source: "", target: "", rate_translation: "", rate_editing: "", rate_mtpe: "" }] }));
  const delLang = (i) => setF((p) => ({ ...p, language_pair: p.language_pair.length > 1 ? p.language_pair.filter((_, x) => x !== i) : p.language_pair }));
  const toggleSvc = (id) => setF((p) => ({ ...p, service_ids: p.service_ids.includes(id) ? p.service_ids.filter((x) => x !== id) : [...p.service_ids, id] }));
  const toggleInd = (id) => setF((p) => ({ ...p, industry_ids: (p.industry_ids || []).includes(id) ? p.industry_ids.filter((x) => x !== id) : [...(p.industry_ids || []), id] }));
  const save = () => {
    const e = {}; if (!f.name.trim()) e.name = "Name is required";
    setErr(e); if (Object.keys(e).length) return;
    const clean = { ...f, language_pair: f.language_pair.filter((p) => p.source || p.target) };
    if (editing) { DB.update("freelancers", modal.data.id, clean); toast("Freelancer updated"); }
    else { DB.insert("freelancers", clean); toast("Freelancer created"); }
    onClose();
  };
  return (
    <Modal title={editing ? "Edit freelancer" : "New freelancer"} lg onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>{editing ? "Save" : "Create"}</Btn></>}>
      <div className="form-grid">
        <Field label="Freelancer Code" required hint="Generated automatically"><Input value={f.freelancer_code} readOnly style={{ background: "var(--paper-3)", cursor: "not-allowed" }} /></Field>
        <Field label="Name" required error={err.name}><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Company" span={12}><Input value={f.company || ""} onChange={(e) => set("company", e.target.value)} placeholder="Agency or company this freelancer belongs to" /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Daily Quota"><Input value={f.quota} onChange={(e) => set("quota", e.target.value)} placeholder="2500 w/day" /></Field>
        <Field label="Rate / hour" hint="Free text — e.g. $10/hr, ~100 pages/hour"><div className="inp-group"><Input value={f.price_hr} onChange={(e) => set("price_hr", e.target.value)} placeholder="$10/hr · ~100 pages/hour" /><span className="inp-group__btn" style={{ pointerEvents: "none" }}>{f.currency}</span></div></Field>
        <Field label="Per Page" hint="Rate per page"><div className="inp-group"><Input value={f.price_page || ""} onChange={(e) => set("price_page", e.target.value)} placeholder="e.g. 5" /><span className="inp-group__btn" style={{ pointerEvents: "none" }}>{f.currency}</span></div></Field>
        <Field label="Currency"><Select value={f.currency} onChange={(e) => set("currency", e.target.value)}><option>USD</option><option>EGP</option><option>EUR</option></Select></Field>
      </div>
      <div style={{ marginTop: 20 }}>
        <div className="flex items-center" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <div><label style={{ fontWeight: 600, fontSize: 14 }}>Language Pairs &amp; Rates</label><div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Each language pair has its own per-word rates.</div></div>
          <Btn variant="soft" size="sm" icon="plus" onClick={addLang}>Add Language</Btn>
        </div>
        {f.language_pair.map((p, i) => (
          <div key={i} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 12 }}>
            <div className="rep-row" style={{ marginBottom: 0 }}>
              <Field label="Source"><Input value={p.source} onChange={(e) => setLang(i, "source", e.target.value)} placeholder="en" /></Field>
              <Field label="Target"><Input value={p.target} onChange={(e) => setLang(i, "target", e.target.value)} placeholder="ar" /></Field>
              <button className="rep-del" onClick={() => delLang(i)} title="Remove language"><Icon name="trash" size={16} /></button>
            </div>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <Field label="Translation" hint="per word"><div className="inp-group"><Input value={p.rate_translation || ""} onChange={(e) => setLang(i, "rate_translation", e.target.value)} placeholder="0.08" /><span className="inp-group__btn" style={{ pointerEvents: "none" }}>{f.currency}/word</span></div></Field>
              <Field label="Editing / Proofreading" hint="per word"><div className="inp-group"><Input value={p.rate_editing || ""} onChange={(e) => setLang(i, "rate_editing", e.target.value)} placeholder="0.04" /><span className="inp-group__btn" style={{ pointerEvents: "none" }}>{f.currency}/word</span></div></Field>
              <Field label="MTPE" hint="per word"><div className="inp-group"><Input value={p.rate_mtpe || ""} onChange={(e) => setLang(i, "rate_mtpe", e.target.value)} placeholder="0.03" /><span className="inp-group__btn" style={{ pointerEvents: "none" }}>{f.currency}/word</span></div></Field>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18 }}>
        <label style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 10 }}>Services</label>
        <div className="check-grid">{services.map((s) => <CheckCard key={s.id} checked={f.service_ids.includes(s.id)} onChange={() => toggleSvc(s.id)} label={s.name} />)}</div>
      </div>
      <div style={{ marginTop: 18 }}>
        <label style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 10 }}>Industries</label>
        <div className="check-grid">{(industries || []).map((s) => <CheckCard key={s.id} checked={(f.industry_ids || []).includes(s.id)} onChange={() => toggleInd(s.id)} label={s.name} />)}</div>
      </div>
      <div style={{ marginTop: 18 }}><Field label="Notes"><Textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field></div>
      <div style={{ marginTop: 18 }}><Field label="Attachment" hint="PDF only — e.g. CV, NDA or rate card"><PdfAttachment value={f.attachment} onChange={(v) => set("attachment", v)} /></Field></div>
    </Modal>
  );
}

function FreelancerDetail() {
  const [db] = useDB();
  const { route, go } = useRouter();
  const [taskMonth, setTaskMonth] = useCS("");
  const c = db.freelancers.find((x) => x.id === route.params.id);
  if (!c) return <NotFound go={go} back="freelancers" />;
  const tasks = db.tasks.filter((t) => (t.freelancer_codes || []).includes(c.freelancer_code) && !t.isDeleted);
  const tasksF = taskMonth ? tasks.filter((t) => { const d = t.start_date || t.end_date; return d && d.slice(0, 7) === taskMonth; }) : tasks;
  const services = (c.service_ids || []).map((id) => db.services.find((s) => s.id === id)).filter(Boolean);
  const industries = (c.industry_ids || []).map((id) => db.industries.find((s) => s.id === id)).filter(Boolean);
  const langs = (c.language_pair || []);
  const hasRates = langs.some((p) => p.rate_translation || p.rate_editing || p.rate_mtpe);

  return (
    <div className="fade-in">
      <div className="flex items-center" style={{ marginBottom: 18 }}><button className="btn btn--ghost" onClick={() => go("freelancers")}><Icon name="arrow-left" size={17} /><span>Back to freelancers</span></button></div>
      <div className="detail-grid">
        <div className="row-gap">
          <Card>
            <div className="card__body flex items-center gap-16" style={{ flexWrap: "wrap" }}>
              <span className="avatar" style={{ width: 64, height: 64, fontSize: 22, borderRadius: 18 }}>{initials(c.name)}</span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div className="flex items-center gap-12"><h2 style={{ margin: 0, fontFamily: "var(--display)", fontSize: 26 }}>{c.name}</h2><span className="code-pill">{c.freelancer_code}</span></div>
                <p className="muted" style={{ margin: "6px 0 0" }}>{c.email} · {c.phone}</p>
                {c.company ? <p className="muted" style={{ margin: "4px 0 0" }}><Icon name="building" size={14} style={{ verticalAlign: "-2px", marginRight: 5, opacity: .7 }} />{c.company}</p> : null}
              </div>
            </div>
          </Card>
          <Card>
            <div className="card__head">
              <h3 className="card__title">Assigned Tasks ({tasksF.length})</h3>
              <ClMonthFilter value={taskMonth} onChange={setTaskMonth} dates={tasks.map((t) => t.start_date || t.end_date)} />
            </div>
            <Table columns={[{ label: "Task" }, { label: "Client" }, { label: "Status" }, { label: "Start" }, { label: "End" }]}>
              {tasksF.length === 0 ? <EmptyRow span={5} icon="tasks" text={taskMonth ? "No tasks in this month." : "No tasks assigned yet."} /> :
                tasksF.map((t) => (
                  <tr key={t.id} onClick={() => go("task", { id: t.id })} style={{ cursor: "pointer" }}>
                    <td><span className="code-pill">{t.task_number}</span></td>
                    <td className="cell-mono">{t.client_code}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td className="muted" style={{ fontSize: 13 }}>{fmtDate(t.start_date)}</td>
                    <td className="muted" style={{ fontSize: 13 }}>{fmtDate(t.end_date)}</td>
                  </tr>
                ))}
            </Table>
            {taskMonth ? <div className="card__body" style={{ paddingTop: 14, paddingBottom: 14 }}><p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Showing {tasksF.length} of {tasks.length} assigned tasks</p></div> : null}
          </Card>
        </div>
        <div className="row-gap">
          <Card>
            <div className="card__head"><h3 className="card__title">Profile</h3></div>
            <div className="card__body">
              <div className="summary-row"><span className="summary-row__k">Rate / hour</span><span className="summary-row__v">{c.price_hr || "—"}{c.price_hr && !String(c.price_hr).match(/[a-z/]/i) ? " " + c.currency : ""}</span></div>
              <div className="summary-row"><span className="summary-row__k">Per Page</span><span className="summary-row__v">{c.price_page ? `${c.price_page}${!String(c.price_page).match(/[a-z/]/i) ? " " + c.currency : ""}` : "—"}</span></div>
              <div className="summary-row"><span className="summary-row__k">Company</span><span className="summary-row__v">{c.company || "—"}</span></div>
              <div className="summary-row"><span className="summary-row__k">Quota</span><span className="summary-row__v">{c.quota || "—"}</span></div>
              <div className="summary-row"><span className="summary-row__k">Tasks</span><span className="summary-row__v">{tasks.length}</span></div>
              <div className="summary-row"><span className="summary-row__k">Attachment</span><span className="summary-row__v">{c.attachment && c.attachment.data
                ? <a className="link" href={c.attachment.data} target="_blank" rel="noreferrer" download={c.attachment.name || "attachment.pdf"}>View / Download PDF</a>
                : "—"}</span></div>
              <div style={{ paddingTop: 14 }}>
                <span className="kv__k">Languages &amp; Per-Word Rates</span>
                {langs.length === 0 ? <p className="muted" style={{ margin: "6px 0 0" }}>—</p> : (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                    {langs.map((p, i) => {
                      const rates = [["Translation", p.rate_translation], ["Editing / Proofreading", p.rate_editing], ["MTPE", p.rate_mtpe]].filter(([, v]) => v);
                      return (
                        <div key={i} style={{ border: "1px solid var(--line-2)", borderRadius: "var(--radius)", padding: 12 }}>
                          <LangPair {...p} />
                          {rates.length ? (
                            <div style={{ marginTop: 8 }}>{rates.map(([k, v]) => <div key={k} className="summary-row" style={{ padding: "4px 0" }}><span className="summary-row__k">{k}</span><span className="summary-row__v">{v} {c.currency}/word</span></div>)}</div>
                          ) : <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>No per-word rates set.</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {services.length ? <div style={{ paddingTop: 14 }}><span className="kv__k">Services</span><div className="flex gap-8 wrap" style={{ marginTop: 6 }}>{services.map((s) => <Badge key={s.id} variant="primary">{s.name}</Badge>)}</div></div> : null}
              {industries.length ? <div style={{ paddingTop: 14 }}><span className="kv__k">Industries</span><div className="flex gap-8 wrap" style={{ marginTop: 6 }}>{industries.map((s) => <Badge key={s.id} variant="primary">{s.name}</Badge>)}</div></div> : null}
            </div>
          </Card>
          {c.notes ? <Card><div className="card__head"><h3 className="card__title">Notes</h3></div><div className="card__body"><p style={{ margin: 0 }}>{c.notes}</p></div></Card> : null}
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// EMPLOYEES — internal team & staff records
// ===================================================================
const EMP_STATUS = { "Active": "ok", "Inactive": "muted", "On Leave": "warn", "Terminated": "danger" };
const EMP_METHODS = ["Bank Transfer", "InstaPay", "Vodafone Cash", "Wallet", "Cash", "Other"];
const PAYROLL_STATUS = { "Pending": "warn", "Approved": "info", "Paid": "ok", "On Hold": "muted" };
const monthName = (key) => { const [y, m] = String(key).split("-"); return `${m}/${y}`; };

// Employees page — internal team & staff records only. Payroll now lives
// under Finance (Finance ▸ Payroll), not here.
function Employees() {
  return (
    <div className="fade-in">
      <PageHead crumb={<span>Workspace · Employees</span>} title="Employees" sub="Your internal team and staff records." />
      <EmployeesTeam />
    </div>
  );
}

function EmployeesTeam() {
  const [db] = useDB();
  const { go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const [q, setQ] = useCS("");
  const [modal, setModal] = useCS(null);
  const list = db.employees || [];

  const filtered = useCM(() => list.filter((c) =>
    !q || `${c.employee_code} ${c.name} ${c.job_title || ""} ${c.email || ""} ${c.phone || ""} ${c.payment_method || ""} ${c.status} ${c.department || ""} ${fmtDate(c.start_date)}`.toLowerCase().includes(q.toLowerCase())), [list, q]);
  const { page, setPage, pages, slice, total } = usePaginate(filtered, 8);
  const del = async (c) => { if (await confirm({ title: "Delete employee?", message: `Permanently remove ${c.name}?`, danger: true, okLabel: "Delete" })) { DB.remove("employees", c.id); toast("Employee deleted", "del"); } };

  return (
    <>
      {confirmNode}
      <Card className="emp-table-card">
        <div className="card__head">
          <SearchField value={q} onChange={setQ} placeholder="Search by name, code, role, email, phone" />
          {can(db, "Create Employee") ? <Btn variant="primary" icon="plus" onClick={() => setModal({ mode: "new" })}>New Employee</Btn> : null}
        </div>
        <Table columns={[{ label: "Code" }, { label: "Name" }, { label: "Job Title" }, { label: "Email" }, { label: "Phone" }, { label: "Payment Method" }, { label: "Salary / Rate" }, { label: "Status" }, { label: "Actions", end: true }]}>
          {slice.length === 0 ? <EmptyRow span={9} icon="id" text="No employees yet." /> :
            slice.map((c) => (
              <tr key={c.id}>
                <td><button className="code-pill" onClick={() => go("employee", { id: c.id })}>{c.employee_code}</button></td>
                <td><div className="flex items-center gap-12"><span className="mini-avatar">{initials(c.name)}</span><span className="lead-cell">{c.name}</span></div></td>
                <td className="emp-role" title={c.job_title || ""}>{c.job_title || <span className="muted">—</span>}</td>
                <td className="muted emp-email" title={c.email || ""}>{c.email || "—"}</td>
                <td className="cell-mono" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{c.phone || "—"}</td>
                <td>{c.payment_method ? <Badge variant="muted">{c.payment_method}</Badge> : <span className="muted">—</span>}</td>
                <td className="lead-cell">{c.salary ? money(c.salary, c.currency) : "—"}</td>
                <td><Badge variant={EMP_STATUS[c.status] || "muted"}>{c.status}</Badge></td>
                <td className="text-end"><div className="row-actions">
                  <button className="act act--view" title="View" onClick={() => go("employee", { id: c.id })}><Icon name="eye" size={16} /></button>
                  {can(db, "Update Employee") ? <button className="act act--edit" title="Edit" onClick={() => setModal({ mode: "edit", data: c })}><Icon name="edit" size={16} /></button> : null}
                  {can(db, "Delete Employee") ? <button className="act act--del" title="Delete" onClick={() => del(c)}><Icon name="trash" size={16} /></button> : null}
                </div></td>
              </tr>
            ))}
        </Table>
        <div className="card__foot"><Pager page={page} pages={pages} setPage={setPage} total={total} /></div>
      </Card>
      {modal ? <EmployeeModal modal={modal} onClose={() => setModal(null)} employees={list} /> : null}
    </>
  );
}

function EmployeeModal({ modal, onClose, employees }) {
  const editing = modal.mode === "edit";
  const [f, setF] = useCS(() => editing ? { attachment: null, ...modal.data }
    : { employee_code: nextEmployeeCode(employees), name: "", job_title: "", email: "", phone: "", start_date: "", salary: "", currency: "EGP", payment_method: "Bank Transfer", bank_details: "", department: "", employment_type: "Full-time", national_id: "", emergency_contact: "", end_date: "", notes: "", status: "Active", attachment: null });
  const [err, setErr] = useCS({});
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    const e = {};
    if (!f.name.trim()) e.name = "Name is required";
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Invalid email";
    setErr(e); if (Object.keys(e).length) return;
    const clean = { ...f, salary: +f.salary || 0 };
    if (editing) { DB.update("employees", modal.data.id, clean); toast("Employee updated"); }
    else { clean.employee_code = nextEmployeeCode(employees); DB.insert("employees", clean); toast(`Employee ${clean.employee_code} created`); }
    onClose();
  };
  return (
    <Modal title={editing ? "Edit employee" : "New employee"} lg onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>{editing ? "Save" : "Create"}</Btn></>}>
      <div className="form-grid">
        <Field label="Employee Code" required hint="Generated automatically"><Input value={f.employee_code} readOnly style={{ background: "var(--paper-3)", cursor: "not-allowed" }} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{Object.keys(EMP_STATUS).map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Full Name" required error={err.name} span={12}><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Job Title / Role"><Input value={f.job_title} onChange={(e) => set("job_title", e.target.value)} placeholder="e.g. Project Manager" /></Field>
        <Field label="Department"><Input value={f.department} onChange={(e) => set("department", e.target.value)} placeholder="Optional" /></Field>
        <Field label="Email" error={err.email}><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Start Date"><DateInput value={f.start_date || ""} onChange={(v) => set("start_date", v)} /></Field>
        <Field label="End Date"><DateInput value={f.end_date || ""} onChange={(v) => set("end_date", v)} /></Field>
        <Field label="Salary / Rate"><Input type="number" step="0.01" value={f.salary} onChange={(e) => set("salary", e.target.value)} /></Field>
        <Field label="Currency"><Select value={f.currency} onChange={(e) => set("currency", e.target.value)}><option>EGP</option><option>USD</option><option>EUR</option></Select></Field>
        <Field label="Payment Method"><Select value={f.payment_method} onChange={(e) => set("payment_method", e.target.value)}>{EMP_METHODS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
        <Field label="Employment Type"><Select value={f.employment_type} onChange={(e) => set("employment_type", e.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option></Select></Field>
        <Field label="Bank / Wallet Details" span={12}><Input value={f.bank_details} onChange={(e) => set("bank_details", e.target.value)} placeholder="Account / wallet number" /></Field>
        <Field label="National ID / Tax ID"><Input value={f.national_id} onChange={(e) => set("national_id", e.target.value)} placeholder="Optional" /></Field>
        <Field label="Emergency Contact"><Input value={f.emergency_contact} onChange={(e) => set("emergency_contact", e.target.value)} placeholder="Optional" /></Field>
        <Field label="Notes" span={12}><Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <Field label="Attachment" hint="PDF or image only — e.g. contract, ID" span={12}><MediaAttachment value={f.attachment} onChange={(v) => set("attachment", v)} /></Field>
      </div>
    </Modal>
  );
}

// ===================================================================
// PAYROLL — monthly salary run, connected to Employees
// ===================================================================
function Payroll() {
  const [db] = useDB();
  const [confirm, confirmNode] = useConfirm();
  const [month, setMonth] = useCS(() => new Date().toISOString().slice(0, 7));
  const [modal, setModal] = useCS(null);
  const employees = db.employees || [];
  const payroll = db.payroll || [];
  const rows = useCM(() => payroll.filter((p) => p.month === month), [payroll, month]);

  const generate = () => {
    const active = employees.filter((e) => e.status === "Active");
    const existing = new Set(rows.map((r) => r.employee_code));
    const fresh = active.filter((e) => !existing.has(e.employee_code));
    if (!fresh.length) { toast(fresh.length === 0 && active.length ? "Payroll already generated for this month" : "No active employees to generate", "info"); return; }
    const today = new Date().toISOString().slice(0, 10);
    const items = fresh.map((e) => ({
      id: Date.now() + Math.random(), payroll_id: `PR-${month}-${e.employee_code}`, month,
      employee_code: e.employee_code, name: e.name, job_title: e.job_title || "", salary: +e.salary || 0,
      currency: e.currency || "EGP", status: "Pending", paid_date: "", payment_method: e.payment_method || "",
      receipt: null, notes: "", generated_at: today,
    }));
    DB.setKey("payroll", [...items, ...payroll]);
    toast(`Generated ${items.length} payroll row${items.length === 1 ? "" : "s"} for ${monthName(month)}`);
  };

  const setStatus = (r, status) => {
    if (status === "Paid" && window.Capital && !Capital.isPosted("payroll", r.payroll_id || r.id) && +r.salary > 0) {
      const g = Capital.guardCashOut(Capital.toBase(r.salary, r.currency));
      if (!g.ok) { toast(g.message, "del"); return; }
    }
    DB.update("payroll", r.id, { status, ...(status === "Paid" && !r.paid_date ? { paid_date: new Date().toISOString().slice(0, 10) } : {}) }); if (status === "Paid" && window.Capital) Capital.syncFromModules();
  };
  const del = async (r) => { if (await confirm({ title: "Remove payroll row?", message: `Remove ${r.name}'s payroll for ${monthName(month)}?`, danger: true, okLabel: "Remove" })) { DB.remove("payroll", r.id); toast("Payroll row removed", "del"); } };

  const totals = useCM(() => {
    const sum = (arr) => arr.reduce((s, r) => s + (+r.salary || 0), 0);
    return {
      count: rows.length, total: sum(rows),
      paid: sum(rows.filter((r) => r.status === "Paid")),
      pending: rows.filter((r) => r.status === "Pending").length,
      approved: rows.filter((r) => r.status === "Approved").length,
    };
  }, [rows]);

  return (
    <div className="fade-in">
      {confirmNode}
      <PageHead crumb={<span>Finance · Payroll</span>} title="Payroll"
        sub="Monthly salary run — generated from active employees. Paid payroll feeds the Finance Dashboard expenses."
        actions={window.ModuleResetButton ? <window.ModuleResetButton moduleKey="payroll" /> : null} />
      <FinanceTabs active="payroll" />
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat"><div className="stat__top"><div className="stat__ic ic-primary"><Icon name="id" size={23} /></div></div><div className="stat__label">Payroll Rows</div><div className="stat__num" style={{ fontSize: 27 }}>{totals.count}</div></div>
        <div className="stat"><div className="stat__top"><div className="stat__ic ic-danger"><Icon name="wallet" size={23} /></div></div><div className="stat__label">Total This Month</div><div className="stat__num" style={{ fontSize: 27 }}>{money(totals.total, "EGP")}</div></div>
        <div className="stat"><div className="stat__top"><div className="stat__ic ic-ok"><Icon name="check" size={23} /></div></div><div className="stat__label">Paid</div><div className="stat__num" style={{ fontSize: 27 }}>{money(totals.paid, "EGP")}</div></div>
        <div className="stat"><div className="stat__top"><div className="stat__ic ic-warn"><Icon name="clock" size={23} /></div></div><div className="stat__label">Pending / Approved</div><div className="stat__num" style={{ fontSize: 27 }}>{totals.pending + totals.approved}</div></div>
      </div>

      <Card>
        <div className="card__head">
          <div className="flex items-center gap-10 wrap">
            <label className="flex items-center gap-8" style={{ fontSize: 13, fontWeight: 600 }}>
              <span className="muted">Month</span>
              <input type="month" className="inp" style={{ width: "auto" }} value={month} onChange={(e) => setMonth(e.target.value)} />
            </label>
          </div>
          <Btn variant="primary" icon="plus" onClick={generate}>Generate Payroll</Btn>
        </div>
        <Table columns={[{ label: "Employee" }, { label: "Job Title" }, { label: "Salary" }, { label: "Status" }, { label: "Paid Date" }, { label: "Method" }, { label: "Receipt" }, { label: "Actions", end: true }]}>
          {rows.length === 0 ? <EmptyRow span={8} icon="wallet" text={`No payroll for ${monthName(month)}. Click “Generate Payroll”.`} /> :
            rows.map((r) => (
              <tr key={r.id}>
                <td><div className="flex items-center gap-12"><span className="mini-avatar">{initials(r.name)}</span><div><span className="lead-cell">{r.name}</span><div className="cell-mono muted" style={{ fontSize: 11 }}>{r.employee_code}</div></div></div></td>
                <td style={{ whiteSpace: "nowrap" }} title={r.job_title}>{r.job_title || <span className="muted">—</span>}</td>
                <td className="cell-mono lead-cell">{money(r.salary, r.currency)}</td>
                <td><Badge variant={PAYROLL_STATUS[r.status] || "muted"}>{r.status}</Badge></td>
                <td className="cell-mono">{r.paid_date ? fmtDate(r.paid_date) : "—"}</td>
                <td className="muted" style={{ fontSize: 13 }}>{r.payment_method || "—"}</td>
                <td>{r.receipt && r.receipt.data ? <a className="link" href={r.receipt.data} target="_blank" rel="noreferrer" title="View receipt"><Icon name="file" size={16} /></a> : <span className="muted">—</span>}</td>
                <td className="text-end"><div className="row-actions">
                  {r.status === "Pending" ? <button className="act act--view" title="Approve" onClick={() => setStatus(r, "Approved")}><Icon name="check" size={16} /></button> : null}
                  {r.status !== "Paid" ? <button className="act act--edit" title="Mark as Paid" onClick={() => setModal({ data: r })}><Icon name="wallet" size={16} /></button> : null}
                  <button className="act act--edit" title="Edit details" onClick={() => setModal({ data: r })}><Icon name="edit" size={16} /></button>
                  <button className="act act--del" title="Remove" onClick={() => del(r)}><Icon name="trash" size={16} /></button>
                </div></td>
              </tr>
            ))}
        </Table>
        <div className="card__foot"><span className="muted" style={{ fontSize: 13 }}>Paid payroll feeds into the Finance Dashboard monthly expenses.</span></div>
      </Card>
      {modal ? <PayrollModal row={modal.data} onClose={() => setModal(null)} /> : null}
    </div>
  );
}

function PayrollModal({ row, onClose }) {
  const [f, setF] = useCS(() => ({ status: row.status === "Pending" ? "Paid" : row.status, paid_date: row.paid_date || new Date().toISOString().slice(0, 10), payment_method: row.payment_method || "Bank Transfer", receipt: row.receipt || null, notes: row.notes || "" }));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    // Block marking payroll Paid if Company Capital can't cover the salary.
    if (f.status === "Paid" && window.Capital) {
      const already = Capital.isPosted("payroll", row.payroll_id || row.id);
      if (!already && +row.salary > 0) {
        const g = Capital.guardCashOut(Capital.toBase(row.salary, row.currency));
        if (!g.ok) { toast(g.message, "del"); return; }
      }
    }
    DB.update("payroll", row.id, f); if (f.status === "Paid" && window.Capital) Capital.syncFromModules(); toast(`Payroll updated — ${row.name}`); onClose();
  };
  return (
    <Modal title={`Payroll · ${row.name}`} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>Save</Btn></>}>
      <div className="form-grid">
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{Object.keys(PAYROLL_STATUS).map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Salary"><Input value={money(row.salary, row.currency)} readOnly className="inp--auto" /></Field>
        <Field label="Paid Date"><DateInput value={f.paid_date} onChange={(v) => set("paid_date", v)} /></Field>
        <Field label="Payment Method"><Select value={f.payment_method} onChange={(e) => set("payment_method", e.target.value)}>{EMP_METHODS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
        <Field label="Notes" span={12}><Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" /></Field>
        <Field label="Receipt Attachment" hint="PDF or image only" span={12}><MediaAttachment value={f.receipt} onChange={(v) => set("receipt", v)} /></Field>
      </div>
    </Modal>
  );
}

function EmployeeDetail() {
  const [db] = useDB();
  const { route, go } = useRouter();
  const c = (db.employees || []).find((x) => x.id === route.params.id);
  if (!c) return <NotFound go={go} back="employees" />;
  const field = (label, val) => (<div className="summary-row"><span className="summary-row__k">{label}</span><span className="summary-row__v">{(val === 0 || val) ? val : "—"}</span></div>);
  return (
    <div className="fade-in">
      <div className="flex items-center" style={{ marginBottom: 18 }}><button className="btn btn--ghost" onClick={() => go("employees")}><Icon name="arrow-left" size={17} /><span>Back to employees</span></button></div>
      <div className="detail-grid">
        <div className="row-gap">
          <Card>
            <div className="card__body flex items-center gap-16" style={{ flexWrap: "wrap" }}>
              <span className="avatar" style={{ width: 64, height: 64, fontSize: 22, borderRadius: 18 }}>{initials(c.name)}</span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div className="flex items-center gap-12"><h2 style={{ margin: 0, fontFamily: "var(--display)", fontSize: 26 }}>{c.name}</h2><span className="code-pill">{c.employee_code}</span></div>
                <p className="muted" style={{ margin: "6px 0 0" }}>{c.job_title || "—"}{c.email ? " · " + c.email : ""}{c.phone ? " · " + c.phone : ""}</p>
              </div>
              <Badge variant={EMP_STATUS[c.status] || "muted"}>{c.status}</Badge>
            </div>
          </Card>
          <Card>
            <div className="card__head"><h3 className="card__title">Employment</h3></div>
            <div className="card__body">
              {field("Job Title / Role", c.job_title)}
              {field("Department", c.department)}
              {field("Employment Type", c.employment_type)}
              {field("Start Date", fmtDate(c.start_date))}
              {field("End Date", fmtDate(c.end_date))}
              {field("Salary / Rate", c.salary ? money(c.salary, c.currency) : "—")}
            </div>
          </Card>
          {c.notes ? <Card><div className="card__head"><h3 className="card__title">Notes</h3></div><div className="card__body"><p style={{ margin: 0 }}>{c.notes}</p></div></Card> : null}
        </div>
        <div className="row-gap">
          <Card>
            <div className="card__head"><h3 className="card__title">Payment & Contact</h3></div>
            <div className="card__body">
              {field("Payment Method", c.payment_method)}
              {field("Currency", c.currency)}
              {field("Bank / Wallet", c.bank_details)}
              {field("National / Tax ID", c.national_id)}
              {field("Emergency Contact", c.emergency_contact)}
              <div className="summary-row"><span className="summary-row__k">Attachment</span><span className="summary-row__v"><MediaViewLink value={c.attachment} /></span></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Clients, ClientDetail, Freelancers, FreelancerDetail, Employees, EmployeeDetail, Payroll });
