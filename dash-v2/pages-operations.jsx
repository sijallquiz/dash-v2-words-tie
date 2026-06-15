/* global React, useDB, useRouter, DB, Icon, Btn, Badge, Card, PageHead, SearchField, Field, Input, Textarea, Select, Table, EmptyRow, usePaginate, Pager, Modal, useConfirm, toast, money, fmtDate, FinanceTabs, FinanceStat */
const { useState: useOS, useMemo: useOM } = React;

// status → badge variant
const PRJ_STATUS = { "Delivered": "ok", "In Progress": "info", "Pending": "warn", "Cancelled": "danger", "On Hold": "muted" };
const PAY_STATUS = { "Paid": "ok", "Unpaid": "danger", "Partially Paid": "warn" };
const onum = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));

// Live row math (mirrors System v2.xlsx · Projects sheet formulas)
function projectMath(p) {
  const vol = onum(p.volume);
  const clientAmount = vol * onum(p.client_rate);
  const flCost = vol * onum(p.fl_rate);
  const profit = clientAmount - flCost;
  const margin = clientAmount ? (profit / clientAmount) * 100 : 0;
  return { clientAmount, flCost, profit, margin };
}

// ===================================================================
// PROJECTS LEDGER
// ===================================================================
function ProjectsLedger() {
  const [db] = useDB();
  const { route, go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const [q, setQ] = useOS("");
  const [status, setStatus] = useOS("all");
  const [pay, setPay] = useOS(route.params.payment || "all");
  const [month, setMonth] = useOS(route.params.month || "all");
  const [modal, setModal] = useOS(null);

  const mKey = (s) => { const d = new Date(s); return isNaN(d) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const list = db.projects;
  const filtered = useOM(() => list.filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    if (pay !== "all" && p.payment_status !== pay) return false;
    if (month !== "all" && mKey(p.date) !== month) return false;
    if (!q) return true;
    const client = db.clients.find((c) => c.name === p.client_name);
    const code = client ? client.client_code : "";
    const flCode = p.freelancer_code || (db.freelancers.find((c) => c.name === p.freelancer) || {}).freelancer_code || "";
    const hay = `${p.task_code} ${p.project_id} ${code} ${flCode} ${p.client_name} ${p.freelancer} ${p.service_type} ${p.specialization} ${expandLangs(p.language_pair)} ${p.status} ${p.payment_status} ${p.invoice_no || ""} ${fmtDate(p.date)} ${fmtDate(p.deadline)}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }), [list, q, status, pay, month, db.clients]);
  const { page, setPage, pages, slice, total } = usePaginate(filtered, 8);

  const totals = useOM(() => {
    let rev = 0, cost = 0, receivables = 0;
    list.forEach((p) => {
      const m = projectMath(p); rev += m.clientAmount; cost += m.flCost;
      // Money still owed by clients: remaining balance on projects not fully paid.
      if (p.payment_status !== "Paid") receivables += onum(p.remaining_amount);
    });
    const profit = rev - cost;
    const margin = rev ? (profit / rev) * 100 : 0;
    return { rev, cost, profit, margin, receivables };
  }, [list]);

  const del = async (p) => { if (await confirm({ title: "Delete project?", message: `Permanently remove ${p.project_id}?`, danger: true, okLabel: "Delete" })) { DB.remove("projects", p.id); toast("Project deleted", "del"); } };

  return (
    <div className="fade-in">
      {confirmNode}
      <PageHead crumb={<span>Finance · Projects Ledger</span>} title="Projects Ledger"
        sub="Operations & profitability — client amount, freelancer cost and profit calculated live."
        actions={<div className="flex items-center gap-10">
          {window.ModuleResetButton ? <window.ModuleResetButton moduleKey="projects-ledger" /> : null}
          <Btn variant="primary" icon="plus" onClick={() => setModal({ mode: "new" })}>New Project</Btn>
        </div>} />
      <FinanceTabs active="projects" />

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <FinanceStat label="Total Revenue" value={money(totals.rev, "USD")} tone="ok" ic="arrow-down" />
        <FinanceStat label="Freelancer Cost" value={money(totals.cost, "USD")} tone="danger" ic="arrow-up" />
        <FinanceStat label="Net Profit" value={money(totals.profit, "USD")} tone="primary" ic="briefcase" />
        <FinanceStat label="Outstanding Receivables" value={money(totals.receivables, "USD")} tone="warn" ic="clock" />
      </div>

      <Card>
        <div className="card__head">
          <div className="flex items-center gap-10 wrap">
            <SearchField value={q} onChange={setQ} placeholder="Search by task #, client code, service, date…" />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "auto", minWidth: 150 }}>
              <option value="all">All Status</option>
              {Object.keys(PRJ_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Select value={pay} onChange={(e) => setPay(e.target.value)} style={{ width: "auto", minWidth: 150 }}>
              <option value="all">All Payments</option>
              {Object.keys(PAY_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            {month !== "all" ? <button className="btn btn--soft btn--sm" onClick={() => setMonth("all")}><Icon name="x" size={14} /><span>Month: {month.split("-").reverse().join("/")}</span></button> : null}
          </div>
        </div>
        <div className="tbl-center">
        <Table columns={[{ label: "Task Number" }, { label: "Client" }, { label: "Service" }, { label: "Languages" }, { label: "Volume" }, { label: "Client $" }, { label: "Cost" }, { label: "Profit" }, { label: "Status" }, { label: "Payment" }, { label: "Actions", end: true }]}>
          {slice.length === 0 ? <EmptyRow span={11} icon="briefcase" text="No projects found." /> :
            slice.map((p) => {
              const m = projectMath(p);
              const client = db.clients.find((c) => c.name === p.client_name);
              const task = db.tasks.find((t) => t.task_number === p.task_code);
              const langs = String(p.language_pair || "").split(",").map((s) => s.trim()).filter(Boolean);
              return (
                <tr key={p.id}>
                  <td>{task
                    ? <button className="code-pill" onClick={() => go("task", { id: task.id })} title="Open task details">{p.task_code}</button>
                    : <span className="code-pill" style={{ opacity: .55, cursor: "default" }} title="No linked task found">{p.task_code || p.project_id || "—"}</span>}</td>
                  <td>{client
                    ? <button className="code-pill" onClick={() => go("client", { id: client.id })} title={`${p.client_name} — open client details`}>{client.client_code}</button>
                    : <span className="code-pill" style={{ opacity: .55, cursor: "default" }} title={p.client_name}>{p.client_name || "—"}</span>}</td>
                  <td><div className="lead-cell">{p.service_type}</div>{p.specialization ? <span className="muted" style={{ fontSize: 12 }}>{p.specialization}</span> : null}</td>
                  <td><div className="flex items-center gap-6 wrap">{langs.length
                    ? langs.map((l, k) => <span key={k} className="lang-pill">{l.replace(/>/g, " › ")}</span>)
                    : <span className="muted">—</span>}</div></td>
                  <td className="cell-mono">{onum(p.volume).toLocaleString()} <span className="muted" style={{ fontSize: 11 }}>{p.unit}</span></td>
                  <td className="cell-mono">{money(m.clientAmount, "USD")}</td>
                  <td className="cell-mono" style={{ color: "var(--danger, #e0566b)" }}>{money(m.flCost, "USD")}</td>
                  <td className="cell-mono lead-cell" style={{ color: m.profit >= 0 ? "var(--ok)" : "var(--danger, #e0566b)" }}>{money(m.profit, "USD")}<span className="muted" style={{ fontSize: 11, fontWeight: 500 }}> · {m.margin.toFixed(0)}%</span></td>
                  <td><Badge variant={PRJ_STATUS[p.status] || "muted"}>{p.status}</Badge></td>
                  <td><Badge variant={PAY_STATUS[p.payment_status] || "muted"}>{p.payment_status}</Badge></td>
                  <td className="text-end"><div className="row-actions">
                    <button className="act act--view" title="View" onClick={() => go("project", { id: p.id })}><Icon name="eye" size={16} /></button>
                    <button className="act act--edit" title="Edit" onClick={() => setModal({ mode: "edit", data: p })}><Icon name="edit" size={16} /></button>
                    <button className="act act--del" title="Delete" onClick={() => del(p)}><Icon name="trash" size={16} /></button>
                  </div></td>
                </tr>
              );
            })}
        </Table>
        </div>
        <div className="card__foot"><Pager page={page} pages={pages} setPage={setPage} total={total} /></div>
      </Card>
      {modal ? <ProjectModal modal={modal} db={db} onClose={() => setModal(null)} /> : null}
    </div>
  );
}

// ---- Project add / edit modal ----
function ProjectModal({ modal, db, onClose }) {
  const editing = modal.mode === "edit";
  const clientByCode = (code) => db.clients.find((c) => c.client_code === code);
  const flByCode = (code) => db.freelancers.find((c) => c.freelancer_code === code);
  const firstPair = String((editing && modal.data.language_pair) || "").split(",")[0] || "";
  const [f, setF] = useOS(() => editing ? {
    ...modal.data,
    client_code: modal.data.client_code || (db.clients.find((c) => c.name === modal.data.client_name) || {}).client_code || "",
    freelancer_code: modal.data.freelancer_code || (db.freelancers.find((c) => c.name === modal.data.freelancer) || {}).freelancer_code || "",
    source_lang: (firstPair.split(">")[0] || "").trim(),
    target_lang: (firstPair.split(">")[1] || "").trim(),
    deposit_amount: modal.data.deposit_amount != null ? modal.data.deposit_amount : "",
    remaining_amount: modal.data.remaining_amount != null ? modal.data.remaining_amount : "",
  } : {
    project_id: nextProjectId(db.projects), task_code: "", date: new Date().toISOString().slice(0, 10), client_code: "", client_name: "", pm_name: "",
    service_type: "Translation", source_lang: "EN", target_lang: "AR", language_pair: "EN>AR", specialization: "", volume: "", unit: "Words",
    client_rate: "", freelancer_code: "", freelancer: "", fl_rate: "", deadline: "", status: "In Progress", invoice_no: "", payment_status: "Unpaid",
    deposit_amount: "", remaining_amount: "", notes: "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const m = projectMath(f);
  const selClient = clientByCode(f.client_code);
  const selFl = flByCode(f.freelancer_code);

  const save = () => {
    const client = clientByCode(f.client_code);
    if (!f.client_code || !client) { toast("Select an existing client code", "info"); return; }
    const fl = flByCode(f.freelancer_code);
    const language_pair = (f.source_lang && f.target_lang) ? `${f.source_lang}>${f.target_lang}` : (f.source_lang || f.target_lang || f.language_pair || "");
    const clean = {
      ...f, client_name: client.name, freelancer: fl ? fl.name : (f.freelancer || ""), language_pair,
      volume: onum(f.volume), client_rate: onum(f.client_rate), fl_rate: onum(f.fl_rate),
      deposit_amount: onum(f.deposit_amount), remaining_amount: onum(f.remaining_amount),
    };
    if (editing) { DB.update("projects", modal.data.id, clean); toast("Project updated"); }
    else { DB.insert("projects", clean); toast("Project created"); }
    onClose();
  };

  return (
    <Modal title={editing ? `Edit ${f.task_code || f.project_id}` : "New Project"} onClose={onClose} lg footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>{editing ? "Save" : "Create"}</Btn></>}>
      <div className="form-grid">
        <Field label="Task Number" hint="Links to Tasks"><Input value={f.task_code || ""} onChange={(e) => set("task_code", e.target.value)} list="prj-tasks" placeholder="T-26-0001" />
          <datalist id="prj-tasks">{db.tasks.map((t) => <option key={t.id} value={t.task_number} />)}</datalist></Field>
        <Field label="Date"><DateInput value={f.date} onChange={(v) => set("date", v)} /></Field>
        <Field label="Client Code" required hint={selClient ? selClient.name : "Search by client code"}>
          <Combo value={f.client_code} placeholder="WT-C-0001 or name…"
            options={db.clients} getValue={(c) => c.client_code} getLabel={(c) => c.name}
            onChange={(v) => set("client_code", v)}
            onPick={(c) => setF((p) => ({ ...p, client_code: c.client_code, client_name: c.name }))} />
        </Field>
        <Field label="Project Manager"><Input value={f.pm_name} onChange={(e) => set("pm_name", e.target.value)} placeholder="PM name" /></Field>
        <Field label="Service Type">
          <Select value={f.service_type} onChange={(e) => set("service_type", e.target.value)}>
            {db.services.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Specialization"><Input value={f.specialization} onChange={(e) => set("specialization", e.target.value)} placeholder="Legal / Medical…" /></Field>
        <Field label="Source Language" hint="e.g. EN"><Input value={f.source_lang} onChange={(e) => set("source_lang", e.target.value.toUpperCase())} placeholder="EN" /></Field>
        <Field label="Target Language" hint="e.g. AR"><Input value={f.target_lang} onChange={(e) => set("target_lang", e.target.value.toUpperCase())} placeholder="AR" /></Field>
        <Field label="Unit"><Select value={f.unit} onChange={(e) => set("unit", e.target.value)}><option>Words</option><option>Pages</option><option>Hours</option><option>Minutes</option></Select></Field>
        <Field label="Volume"><Input type="number" value={f.volume} onChange={(e) => set("volume", e.target.value)} /></Field>
        <Field label="Client Rate / unit"><Input type="number" step="0.01" value={f.client_rate} onChange={(e) => set("client_rate", e.target.value)} /></Field>
        <Field label="Freelancer Code" hint={selFl ? selFl.name : "Search by freelancer code"}>
          <Combo value={f.freelancer_code} placeholder="WT-F-0001 or name…"
            options={db.freelancers} getValue={(c) => c.freelancer_code} getLabel={(c) => c.name}
            onChange={(v) => set("freelancer_code", v)}
            onPick={(c) => setF((p) => ({ ...p, freelancer_code: c.freelancer_code, freelancer: c.name }))} />
        </Field>
        <Field label="Freelancer Rate / unit"><Input type="number" step="0.01" value={f.fl_rate} onChange={(e) => set("fl_rate", e.target.value)} /></Field>
        <Field label="Deadline"><DateInput value={f.deadline} onChange={(v) => set("deadline", v)} /></Field>
        <Field label="Deposit Amount" hint="Client paid up-front"><Input type="number" step="0.01" value={f.deposit_amount} onChange={(e) => set("deposit_amount", e.target.value)} placeholder="0.00" /></Field>
        <Field label="Remaining Amount" hint="Still owed by client"><Input type="number" step="0.01" value={f.remaining_amount} onChange={(e) => set("remaining_amount", e.target.value)} placeholder="0.00" /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{Object.keys(PRJ_STATUS).map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Payment Status"><Select value={f.payment_status} onChange={(e) => set("payment_status", e.target.value)}>{Object.keys(PAY_STATUS).map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Notes" span={12}><Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes" /></Field>
      </div>
      <div className="calc-summary-row">
        <div><span className="muted">Client Amount</span><b>{money(m.clientAmount, "USD")}</b></div>
        <div><span className="muted">Freelancer Cost</span><b style={{ color: "var(--danger,#e0566b)" }}>{money(m.flCost, "USD")}</b></div>
        <div><span className="muted">Profit</span><b style={{ color: "var(--ok)" }}>{money(m.profit, "USD")} · {m.margin.toFixed(0)}%</b></div>
      </div>
    </Modal>
  );
}

// ===================================================================
// PROJECT DETAIL
// ===================================================================
function ProjectDetail() {
  const [db] = useDB();
  const { route, go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const [modal, setModal] = useOS(null);
  const p = db.projects.find((x) => x.id === route.params.id);
  if (!p) return <div className="fade-in"><PageHead title="Project not found" /><Btn icon="arrow-left" onClick={() => go("projects")}>Back to ledger</Btn></div>;
  const m = projectMath(p);
  const client = db.clients.find((c) => c.name === p.client_name);
  const task = db.tasks.find((t) => t.task_number === p.task_code);
  const fl = db.freelancers.find((c) => c.name === p.freelancer);
  const pays = db.payments.filter((x) => x.project_id === p.project_id);
  const del = async () => { if (await confirm({ title: "Delete project?", message: `Permanently remove ${p.project_id}?`, danger: true, okLabel: "Delete" })) { DB.remove("projects", p.id); toast("Project deleted", "del"); go("projects"); } };

  const field = (label, val, mono) => (
    <div className="info-cell"><span className="info-cell__k">{label}</span><span className={`info-cell__v${mono ? " cell-mono" : ""}`}>{val || "—"}</span></div>
  );

  return (
    <div className="fade-in">
      {confirmNode}
      <div className="flex items-center justify-between wrap gap-10" style={{ marginBottom: 4 }}>
        <button className="btn btn--ghost btn--sm" onClick={() => go("projects")}><Icon name="arrow-left" size={15} /><span>Back to ledger</span></button>
        <div className="flex gap-8 wrap">
          <Btn variant="soft" icon="edit" onClick={() => setModal({ mode: "edit", data: p })}>Edit</Btn>
          <Btn variant="danger-soft" icon="trash" onClick={del}>Delete</Btn>
        </div>
      </div>
      <PageHead crumb={<span>Finance · Projects · {p.task_code || p.project_id}</span>} title={p.task_code || p.project_id}
        sub={`${p.service_type} · ${p.language_pair} · ${p.specialization}`}
        actions={<><Badge variant={PRJ_STATUS[p.status] || "muted"}>{p.status}</Badge><Badge variant={PAY_STATUS[p.payment_status] || "muted"}>{p.payment_status}</Badge></>} />

      <div className="detail-grid">
        <div className="detail-main">
          <Card>
            <div className="card__head"><h3 className="card__title">Project Information</h3></div>
            <div className="card__body info-grid">
              {field("Task Number", task ? <button className="link" onClick={() => go("task", { id: task.id })}>{p.task_code}</button> : (p.task_code || "—"))}
              {field("Client", client ? <button className="code-pill" onClick={() => go("client", { id: client.id })} title={`${p.client_name} — open client details`}>{client.client_code}</button> : (p.client_name || "—"))}
              {field("Date", fmtDate(p.date), true)}
              {field("Deadline", fmtDate(p.deadline), true)}
              {field("Project Manager", p.pm_name)}
              {field("Freelancer", fl ? <button className="code-pill" onClick={() => go("freelancer", { id: fl.id })} title={`${p.freelancer} — open freelancer details`}>{fl.freelancer_code}</button> : (p.freelancer || "—"))}
              {field("Invoice #", p.invoice_no, true)}
              {field("Service", p.service_type)}
              {field("Languages", p.language_pair)}
              {field("Specialization", p.specialization)}
              {p.notes ? <div className="info-cell" style={{ gridColumn: "1 / -1" }}><span className="info-cell__k">Notes</span><span className="info-cell__v">{p.notes}</span></div> : null}
            </div>
          </Card>

          <Card style={{ marginTop: 18 }}>
            <div className="card__head"><h3 className="card__title">Linked Payments</h3></div>
            <Table columns={[{ label: "Payment ID" }, { label: "Date" }, { label: "Party" }, { label: "Type" }, { label: "Amount" }, { label: "Method" }]}>
              {pays.length === 0 ? <EmptyRow span={6} icon="wallet" text="No payments linked to this project yet." /> :
                pays.map((pay) => (
                  <tr key={pay.id}>
                    <td className="cell-mono">{pay.pay_id}</td>
                    <td className="cell-mono">{fmtDate(pay.date)}</td>
                    <td>{pay.party}</td>
                    <td><Badge variant={pay.type === "Incoming" ? "ok" : "danger"}>{pay.type}</Badge></td>
                    <td className="cell-mono">{money(pay.amount, pay.currency)}</td>
                    <td className="muted" style={{ fontSize: 13 }}>{pay.method}</td>
                  </tr>
                ))}
            </Table>
          </Card>
        </div>

        <div className="detail-side">
          <Card className="calc-summary">
            <div className="card__body">
              <h3 className="card__title" style={{ marginBottom: 16 }}>Profitability</h3>
              <div className="calc-sum-row"><span>Volume</span><span>{onum(p.volume).toLocaleString()} {p.unit}</span></div>
              <div className="calc-sum-row"><span>Client Rate</span><span>${onum(p.client_rate).toFixed(3)}</span></div>
              <div className="calc-sum-row"><span>Freelancer Rate</span><span>${onum(p.fl_rate).toFixed(3)}</span></div>
              <div className="calc-sum-div"></div>
              <div className="calc-sum-row strong"><span>Client Amount</span><span>{money(m.clientAmount, "USD")}</span></div>
              {onum(p.deposit_amount) > 0 || onum(p.remaining_amount) > 0 ? <>
                <div className="calc-sum-row"><span>Deposit Paid</span><span style={{ color: "var(--ok)" }}>{money(onum(p.deposit_amount), "USD")}</span></div>
                <div className="calc-sum-row"><span>Remaining Due</span><span style={{ color: onum(p.remaining_amount) > 0 ? "var(--warn)" : undefined }}>{money(onum(p.remaining_amount), "USD")}</span></div>
              </> : null}
              <div className="calc-sum-row"><span>Freelancer Cost</span><span style={{ color: "var(--danger,#e0566b)" }}>−{money(m.flCost, "USD")}</span></div>
              <div className="calc-grand">
                <div><div className="calc-grand__label">Net Profit</div><div className="calc-grand__eff">Margin {m.margin.toFixed(1)}%</div></div>
                <div className="calc-grand__num">{money(m.profit, "USD")}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
      {modal ? <ProjectModal modal={modal} db={db} onClose={() => setModal(null)} /> : null}
    </div>
  );
}
// ===================================================================
// PAYMENTS TRACKER
// ===================================================================
function Payments() {
  const [db] = useDB();
  const { go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const [q, setQ] = useOS("");
  const [type, setType] = useOS("all");
  const [modal, setModal] = useOS(null);

  const list = db.payments;
  const filtered = useOM(() => list.filter((p) =>
    (type === "all" || p.type === type) &&
    (!q || `${p.pay_id} ${p.party} ${p.project_id} ${p.invoice_no} ${p.method}`.toLowerCase().includes(q.toLowerCase()))
  ), [list, q, type]);
  const { page, setPage, pages, slice, total } = usePaginate(filtered, 8);

  const totals = useOM(() => {
    let inc = 0, out = 0;
    list.forEach((p) => { if (p.type === "Incoming") inc += onum(p.amount); else out += onum(p.amount); });
    return { inc, out, net: inc - out };
  }, [list]);

  const del = async (p) => { if (await confirm({ title: "Delete payment?", message: `Remove ${p.pay_id}?`, danger: true, okLabel: "Delete" })) { DB.remove("payments", p.id); toast("Payment deleted", "del"); } };

  return (
    <div className="fade-in">
      {confirmNode}
      <PageHead crumb={<span>Finance · Payments</span>} title="Payments"
        sub="Track incoming client payments and outgoing freelancer fees — net balance is live."
        actions={<Btn variant="primary" icon="plus" onClick={() => setModal({ mode: "new" })}>New Payment</Btn>} />
      <FinanceTabs active="payments" />

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <FinanceStat label="Total Incoming" value={money(totals.inc, "USD")} tone="ok" ic="arrow-down" />
        <FinanceStat label="Total Outgoing" value={money(totals.out, "USD")} tone="danger" ic="arrow-up" />
        <FinanceStat label="Net Balance" value={money(totals.net, "USD")} tone="primary" ic="wallet" />
      </div>

      <Card>
        <div className="card__head">
          <div className="flex items-center gap-10 wrap">
            <SearchField value={q} onChange={setQ} placeholder="Search payments" />
            <Select value={type} onChange={(e) => setType(e.target.value)} style={{ width: "auto", minWidth: 140 }}>
              <option value="all">All Types</option><option value="Incoming">Incoming</option><option value="Outgoing">Outgoing</option>
            </Select>
          </div>
        </div>
        <Table columns={[{ label: "Payment ID" }, { label: "Date" }, { label: "Party" }, { label: "Type" }, { label: "Project" }, { label: "Amount" }, { label: "Method" }, { label: "Actions", end: true }]}>
          {slice.length === 0 ? <EmptyRow span={8} icon="wallet" text="No payments found." /> :
            slice.map((p) => {
              const prj = db.projects.find((x) => x.project_id === p.project_id);
              return (
                <tr key={p.id}>
                  <td className="cell-mono lead-cell">{p.pay_id}</td>
                  <td className="cell-mono">{fmtDate(p.date)}</td>
                  <td>{p.party}</td>
                  <td><Badge variant={p.type === "Incoming" ? "ok" : "danger"}>{p.type}</Badge></td>
                  <td>{prj
                    ? <button className="code-pill" onClick={() => go("project", { id: prj.id })}>{p.project_id}</button>
                    : <span className="muted">{p.project_id || "—"}</span>}</td>
                  <td className="cell-mono lead-cell" style={{ color: p.type === "Incoming" ? "var(--ok)" : "var(--danger,#e0566b)" }}>{p.type === "Incoming" ? "+" : "−"}{money(p.amount, p.currency)}</td>
                  <td className="muted" style={{ fontSize: 13 }}>{p.method}</td>
                  <td className="text-end"><div className="row-actions">
                    <button className="act act--edit" title="Edit" onClick={() => setModal({ mode: "edit", data: p })}><Icon name="edit" size={16} /></button>
                    <button className="act act--del" title="Delete" onClick={() => del(p)}><Icon name="trash" size={16} /></button>
                  </div></td>
                </tr>
              );
            })}
        </Table>
        <div className="card__foot"><Pager page={page} pages={pages} setPage={setPage} total={total} /></div>
      </Card>
      {modal ? <PaymentModal modal={modal} db={db} onClose={() => setModal(null)} /> : null}
    </div>
  );
}

function PaymentModal({ modal, db, onClose }) {
  const editing = modal.mode === "edit";
  const [f, setF] = useOS(() => editing ? { ...modal.data } : {
    pay_id: nextPaymentId(db.payments), date: new Date().toISOString().slice(0, 10), party: "", type: "Incoming",
    project_id: "", invoice_no: "", amount: "", currency: "USD", method: "Bank Transfer", notes: "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.party.trim()) { toast("Party name is required", "info"); return; }
    const clean = { ...f, amount: onum(f.amount) };
    if (editing) { DB.update("payments", modal.data.id, clean); toast("Payment updated"); }
    else { DB.insert("payments", clean); toast("Payment created"); }
    onClose();
  };
  return (
    <Modal title={editing ? `Edit ${f.pay_id}` : "New Payment"} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>{editing ? "Save" : "Create"}</Btn></>}>
      <div className="form-grid">
        <Field label="Payment ID" hint="Auto"><Input value={f.pay_id} readOnly className="inp--auto" /></Field>
        <Field label="Date"><DateInput value={f.date} onChange={(v) => set("date", v)} /></Field>
        <Field label="Type"><Select value={f.type} onChange={(e) => set("type", e.target.value)}><option>Incoming</option><option>Outgoing</option></Select></Field>
        <Field label={f.type === "Incoming" ? "From (Client)" : "To (Freelancer)"} required>
          <Input value={f.party} onChange={(e) => set("party", e.target.value)} list="pay-parties" placeholder="Name" />
          <datalist id="pay-parties">{[...db.clients, ...db.freelancers].map((c) => <option key={c.id + c.name} value={c.name} />)}</datalist>
        </Field>
        <Field label="Project ID"><Input value={f.project_id} onChange={(e) => set("project_id", e.target.value)} list="pay-prj" placeholder="PRJ-…" />
          <datalist id="pay-prj">{db.projects.map((p) => <option key={p.id} value={p.project_id} />)}</datalist></Field>
        <Field label="Invoice #"><Input value={f.invoice_no} onChange={(e) => set("invoice_no", e.target.value)} placeholder="INV-…" /></Field>
        <Field label="Amount"><Input type="number" step="0.01" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
        <Field label="Currency"><Select value={f.currency} onChange={(e) => set("currency", e.target.value)}><option>USD</option><option>EGP</option><option>EUR</option><option>SAR</option><option>AED</option></Select></Field>
        <Field label="Method"><Select value={f.method} onChange={(e) => set("method", e.target.value)}><option>Bank Transfer</option><option>Wire Transfer</option><option>PayPal</option><option>Wise</option><option>Cash</option><option>Cheque</option></Select></Field>
        <Field label="Notes" span={12}><Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" /></Field>
      </div>
    </Modal>
  );
}

// ---- auto-id helpers ----
function nextProjectId(projects) {
  const yr = new Date().getFullYear();
  const max = projects.reduce((m, p) => Math.max(m, parseInt(String(p.project_id).split("-").pop()) || 0), 0);
  return `PRJ-${yr}-${String(max + 1).padStart(4, "0")}`;
}
function nextPaymentId(payments) {
  const max = payments.reduce((m, p) => Math.max(m, parseInt(String(p.pay_id).replace(/\D/g, "")) || 0), 0);
  return `PAY-${String(max + 1).padStart(3, "0")}`;
}

Object.assign(window, { ProjectsLedger, ProjectDetail, Payments });
