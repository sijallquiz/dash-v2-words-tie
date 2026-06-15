/* global React, DB, useDB, currentUser, Icon, Btn, Badge, StatusBadge, Card, Field, Input, Textarea, Select, DateInput, LangPair, money, fmtDate, fromNow, toast, useConfirm, wtDefaultWorkflow, WT_STAGE_STATUSES, cpProjName */
// ====================================================================
// ADMIN TASK DETAILS — two added tabs (non-destructive):
//   • Project Progress  → edits task.workflowStages (read by Client Portal)
//   • Quotes & Approvals → creates/sends quotes as projectRequests linked
//     by task_code + client_code (client accepts/rejects in the portal,
//     which writes the response back onto the same record).
// No finance/accounting logic is touched here.
// ====================================================================
const { useState: useTD, useMemo: useTDM, useEffect: useTDE } = React;

function tdNorm(v) { return String(v || "").trim().toUpperCase(); }
const STAGE_TONE = { "Completed": "ok", "In Progress": "info", "Waiting": "warn", "Skipped": "muted", "Not Started": "muted" };

// --------------------------------------------------------------------
// PROJECT PROGRESS (admin editor)
// --------------------------------------------------------------------
function AdminProjectProgress({ task, readOnly }) {
  const [db] = useDB();
  const me = currentUser(db);
  const today = new Date().toISOString().slice(0, 10);

  // Initialise stages safely for legacy tasks without breaking their data.
  useTDE(() => {
    if (readOnly) return;
    if (!task.workflowStages || !task.workflowStages.length) {
      DB.update("tasks", task.id, { workflowStages: wtDefaultWorkflow(task, 0) });
    }
  }, [task.id]);

  const stages = (task.workflowStages && task.workflowStages.length) ? task.workflowStages : wtDefaultWorkflow(task, 0);

  const patchStage = (i, patch) => {
    const next = stages.map((s, idx) => idx === i ? { ...s, ...patch, updated_at: today, updated_by: me.name } : s);
    DB.update("tasks", task.id, { workflowStages: next });
  };
  const setStatus = (i, status) => {
    const s = stages[i];
    const patch = { status };
    if (status === "In Progress" && !s.started) patch.started = today;
    if (status === "Completed") { if (!s.started) patch.started = s.started || today; patch.completed = today; }
    if (status === "Not Started") { patch.started = ""; patch.completed = ""; }
    patchStage(i, patch);
  };

  const active = stages.filter((s) => s.status !== "Skipped");
  const done = active.filter((s) => s.status === "Completed");
  const pct = active.length ? Math.round((done.length / active.length) * 100) : 0;
  const inProg = stages.find((s) => s.status === "In Progress");
  const lastDone = [...stages].reverse().find((s) => s.status === "Completed");
  const current = inProg ? inProg.name : (lastDone ? lastDone.name : stages[0] && stages[0].name);

  return (
    <div className="row-gap">
      {/* summary */}
      <Card>
        <div className="card__head">
          <div>
            <h3 className="card__title">Project Progress</h3>
            <p className="card__sub">Updates here appear live in the client's portal. Internal notes stay private.</p>
          </div>
          <StatusBadge status={task.status} />
        </div>
        <div className="card__body">
          <div className="kv">
            <div><span className="kv__k">Task Code</span><span className="kv__v"><span className="code-pill">{task.task_number}</span></span></div>
            <div><span className="kv__k">Client Code</span><span className="kv__v">{task.client_code || "—"}</span></div>
            <div><span className="kv__k">Project</span><span className="kv__v">{cpProjName(task)}</span></div>
            <div><span className="kv__k">Current Stage</span><span className="kv__v">{current}</span></div>
            <div><span className="kv__k">Delivery Date</span><span className="kv__v">{fmtDate(task.end_date)}</span></div>
            <div><span className="kv__k">Overall Progress</span><span className="kv__v" style={{ color: "var(--accent-2)", fontWeight: 800 }}>{pct}% · {done.length}/{active.length}</span></div>
          </div>
          <div className="cap-progline" style={{ marginTop: 16, height: 8, borderRadius: 99, background: "var(--paper-3)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", borderRadius: 99, transition: "width .3s" }}></div>
          </div>
        </div>
      </Card>

      {/* stage editor */}
      {readOnly ? null : (
      <Card>
        <div className="card__head"><h3 className="card__title">Workflow Stages</h3></div>
        <div className="card__body row-gap">
          {stages.map((s, i) => (
            <div key={i} className="td-stage">
              <div className="td-stage__head">
                <div className="flex items-center gap-12">
                  <span className={`td-stage__n ${String(s.status).toLowerCase().replace(" ", "_")}`}>{s.status === "Completed" ? <Icon name="check" size={15} /> : s.n}</span>
                  <strong>{s.name}</strong>
                  <Badge variant={STAGE_TONE[s.status] || "muted"}>{s.status}</Badge>
                </div>
                <div className="flex gap-8 wrap">
                  {[["In Progress", "Start"], ["Completed", "Complete"], ["Waiting", "Wait"], ["Skipped", "Skip"]].map(([st, lbl]) => (
                    <button key={st} className="td-quick" onClick={() => setStatus(i, st)} disabled={s.status === st}>{lbl}</button>
                  ))}
                </div>
              </div>
              <div className="td-stage__grid">
                <Field label="Status"><Select value={s.status} onChange={(e) => setStatus(i, e.target.value)}>{WT_STAGE_STATUSES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
                <Field label="Started"><DateInput value={s.started} onChange={(v) => patchStage(i, { started: v })} /></Field>
                <Field label="Completed"><DateInput value={s.completed} onChange={(v) => patchStage(i, { completed: v })} /></Field>
              </div>
              <div className="td-stage__grid2">
                <Field label="Client-visible note" hint="Shown to the client">
                  <Textarea rows={2} value={s.client_note || ""} onChange={(e) => patchStage(i, { client_note: e.target.value })} placeholder="e.g. Translation underway, on track for delivery." />
                </Field>
                <Field label="Internal note" hint="Never shown to the client">
                  <Textarea rows={2} value={s.internal_note || ""} onChange={(e) => patchStage(i, { internal_note: e.target.value })} placeholder="Team-only note…" />
                </Field>
              </div>
              <div className="td-stage__meta">Last updated {s.updated_at ? fmtDate(s.updated_at) : "—"}{s.updated_by ? ` · ${s.updated_by}` : ""}</div>
            </div>
          ))}
        </div>
      </Card>
      )}
    </div>
  );
}

// --------------------------------------------------------------------
// QUOTES & APPROVALS (admin)
// --------------------------------------------------------------------
const TD_CURRENCIES = ["USD", "EGP", "EUR", "GBP", "SAR", "AED"];
const QUOTE_TONE = { quoted: "info", accepted: "ok", rejected: "danger", draft: "muted", revised: "warn", expired: "muted", cancelled: "muted" };

function AdminTaskQuotes({ task, readOnly }) {
  const [db] = useDB();
  const me = currentUser(db);
  const client = db.clients.find((c) => c.client_code === task.client_code);
  const quotes = useTDM(
    () => db.projectRequests.filter((r) => tdNorm(r.task_code) === tdNorm(task.task_number))
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")),
    [db.projectRequests, task.task_number]
  );
  const latest = quotes[0];
  const lp0 = (task.language_pair || [])[0] || {};
  const [show, setShow] = useTD(false);
  const [detailId, setDetailId] = useTD(null);

  // Open the read-only client-response detail panel. Opening a quote whose
  // client response is still unread marks it read for the team (audit-safe:
  // appends to activity, never overwrites). Pure UI/notification — no finance.
  const openDetail = (r) => {
    setDetailId(r.id);
    if ((r.status === "accepted" || r.status === "rejected") && !r.responseReadByTeam) {
      const now = new Date().toISOString();
      DB.update("projectRequests", r.id, {
        responseReadByTeam: true,
        responseReadAt: now,
        responseReadBy: me.name,
        activity: [...(r.activity || []), { at: now, by: me.name, text: "Team viewed client response." }],
      });
    }
  };

  const blank = {
    amount: "", currency: (client && client.currency) || "USD",
    valid_until: "", deposit_terms: "", client_note: "", internal_note: "",
  };
  const [form, setForm] = useTD(blank);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (sendIt) => {
    if (!String(form.amount).trim() || !(+form.amount > 0)) { toast("Quote amount is required", "info"); return; }
    if (!form.valid_until) { toast("Valid-until date is required", "info"); return; }
    if (sendIt && !form.client_note.trim()) { toast("Client-visible notes are required to send", "info"); return; }
    const now = new Date().toISOString();
    const nm = (client && client.name) || "";
    const quote = {
      amount: +form.amount, currency: form.currency, valid_until: form.valid_until,
      deposit_terms: form.deposit_terms, client_note: form.client_note, internal_note: form.internal_note,
      services: task.service_ids || [],
      sent_at: sendIt ? now : null, sent_by: me.name,
    };
    const activity = [{ at: now, by: me.name, text: sendIt ? `Quote sent to client — ${money(+form.amount, form.currency)}` : "Quote drafted." }];
    DB.insert("projectRequests", {
      first_name: (nm.split(" ")[0] || "Client"), last_name: nm.split(" ").slice(1).join(" "),
      email: (client && client.email) || "",
      client_code: task.client_code, task_code: task.task_number,
      source: "Task Quote",
      source_language: lp0.source || "", target_language: lp0.target || "",
      preferred_payment_type: "Bank transfer", currency: form.currency,
      project_name: cpProjName(task), project_link: task.link || "",
      time_zone: "", start_date: task.start_date || "", end_date: task.end_date || "",
      description: task.notes || "",
      status: sendIt ? "quoted" : "draft",
      service_ids: task.service_ids || [],
      media: [], quote, activity,
      created_at: new Date().toISOString().slice(0, 10),
    });
    toast(sendIt ? "Quote sent to the client." : "Quote saved as draft.");
    setForm(blank); setShow(false);
  };

  const svcNames = (ids) => (ids || []).map((id) => (db.services.find((s) => s.id === id) || {}).name).filter(Boolean);

  return (
    <div className="row-gap">
      {/* latest quote summary */}
      {latest ? (
        <Card>
          <div className="card__head">
            <div>
              <h3 className="card__title">Current Quote</h3>
              <p className="card__sub">REQ-{String(latest.id).padStart(4, "0")} · {latest.project_name}</p>
            </div>
            <Badge variant={QUOTE_TONE[latest.status] || "muted"}>{latest.status === "quoted" ? "Sent" : latest.status[0].toUpperCase() + latest.status.slice(1)}</Badge>
          </div>
          <div className="card__body">
            <div className="kv">
              <div><span className="kv__k">Quote Amount</span><span className="kv__v" style={{ fontWeight: 800, fontSize: 18 }}>{money((latest.quote || {}).amount, (latest.quote || {}).currency)}</span></div>
              <div><span className="kv__k">Valid Until</span><span className="kv__v">{fmtDate((latest.quote || {}).valid_until)}</span></div>
              <div><span className="kv__k">Sent</span><span className="kv__v">{(latest.quote || {}).sent_at ? fmtDate((latest.quote || {}).sent_at) : "—"}</span></div>
              <div><span className="kv__k">Client Response</span><span className="kv__v">{latest.status === "accepted" ? "Accepted" : latest.status === "rejected" ? "Rejected" : "Awaiting response"}</span></div>
              {(latest.quote || {}).deposit_terms ? <div><span className="kv__k">Deposit Terms</span><span className="kv__v">{latest.quote.deposit_terms}</span></div> : null}
              <div><span className="kv__k">Services</span><span className="kv__v" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{svcNames((latest.quote || {}).services).length ? svcNames(latest.quote.services).map((n) => <Badge key={n} variant="primary">{n}</Badge>) : "—"}</span></div>
            </div>
            {(latest.quote || {}).client_note ? <div style={{ marginTop: 16 }}><span className="kv__k">Client-visible notes</span><p style={{ margin: "5px 0 0" }}>{latest.quote.client_note}</p></div> : null}
            {(latest.quote || {}).internal_note ? <div style={{ marginTop: 14 }}><span className="kv__k">Internal notes</span><p style={{ margin: "5px 0 0", color: "var(--ink-3)" }}>{latest.quote.internal_note}</p></div> : null}
            {latest.status === "rejected" && latest.rejection_reason ? (
              <div style={{ marginTop: 16, background: "var(--danger-soft)", padding: "12px 14px", borderRadius: 12 }}>
                <span className="kv__k" style={{ color: "var(--danger)" }}>Rejection reason{latest.rejection_category ? ` · ${latest.rejection_category}` : ""}</span>
                <p style={{ margin: "4px 0 0", fontSize: 14 }}>{latest.rejection_reason}</p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : (
        <Card><div className="cp-empty" style={{ padding: "40px 20px", textAlign: "center", color: "var(--ink-3)" }}>
          <Icon name="checklist-box" size={30} />
          <div style={{ marginTop: 10, fontWeight: 700 }}>No quotes have been sent for this task yet.</div>
          <div className="muted" style={{ fontSize: 13.5 }}>Create and send a quote to the client when ready.</div>
        </div></Card>
      )}

      {/* create / send */}
      {readOnly ? null : (
      <Card>
        <div className="card__head">
          <h3 className="card__title">{latest ? "Send a Revised Quote" : "Create & Send Quote"}</h3>
          {!show ? <Btn variant="primary" size="sm" icon="plus" onClick={() => setShow(true)}>New Quote</Btn> : null}
        </div>
        {show ? (
          <div className="card__body">
            <div className="form-grid">
              <Field label="Quote Amount" required><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" /></Field>
              <Field label="Currency" required><Select value={form.currency} onChange={(e) => set("currency", e.target.value)}>{TD_CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Valid Until" required><DateInput value={form.valid_until} onChange={(v) => set("valid_until", v)} /></Field>
              <Field label="Deposit Terms"><Input value={form.deposit_terms} onChange={(e) => set("deposit_terms", e.target.value)} placeholder="e.g. 50% deposit to start" /></Field>
              <Field label="Client-visible Quote Notes" required span={12}><Textarea rows={3} value={form.client_note} onChange={(e) => set("client_note", e.target.value)} placeholder="What's included, scope, turnaround…" /></Field>
              <Field label="Internal Notes (admin-only)" span={12}><Textarea rows={2} value={form.internal_note} onChange={(e) => set("internal_note", e.target.value)} placeholder="Margin, risks, notes for the team…" /></Field>
            </div>
            <div className="hint" style={{ marginTop: 6 }}>Linked to <b>{task.task_number}</b> · {task.client_code}{client ? ` · ${client.name}` : ""}. Quote approval does not create an invoice or affect finance.</div>
            <div className="flex gap-8" style={{ justifyContent: "flex-end", marginTop: 18 }}>
              <Btn variant="ghost" onClick={() => { setShow(false); setForm(blank); }}>Cancel</Btn>
              <Btn variant="soft" icon="file" onClick={() => submit(false)}>Save as Draft</Btn>
              <Btn variant="primary" icon="send" onClick={() => submit(true)}>Send Quote to Client</Btn>
            </div>
          </div>
        ) : (
          <div className="card__body"><p className="muted" style={{ margin: 0 }}>Create a quote to send to {client ? client.name : "the client"} for review. They can accept or reject it from their portal.</p></div>
        )}
      </Card>
      )}

      {/* history / audit */}
      {quotes.length ? (
        <Card>
          <div className="card__head"><h3 className="card__title">Quote History &amp; Activity</h3></div>
          <div className="card__body row-gap">
            {quotes.map((r) => {
              const unread = (r.status === "accepted" || r.status === "rejected") && !r.responseReadByTeam;
              return (
              <div key={r.id} className="td-quote-h">
                <div className="flex items-center" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div className="flex items-center gap-12">
                    <button className="code-pill td-req-pill" title="View client response details" onClick={() => openDetail(r)}>
                      REQ-{String(r.id).padStart(4, "0")}
                      {unread ? <span className="td-unread-dot" aria-label="Unread client response"></span> : null}
                    </button>
                    <strong>{money((r.quote || {}).amount, (r.quote || {}).currency)}</strong>
                    <Badge variant={QUOTE_TONE[r.status] || "muted"}>{r.status === "quoted" ? "Sent" : r.status[0].toUpperCase() + r.status.slice(1)}</Badge>
                    {unread ? <Badge variant="danger">New response</Badge> : null}
                  </div>
                  <div className="flex items-center gap-12">
                    <span className="muted" style={{ fontSize: 12.5 }}>{fmtDate(r.created_at)}</span>
                    <Btn variant="ghost" size="sm" icon="eye" onClick={() => openDetail(r)}>View Details</Btn>
                  </div>
                </div>
                {(r.activity || []).length ? (
                  <div style={{ marginTop: 8, display: "grid", gap: 5 }}>
                    {r.activity.map((a, i) => <div key={i} style={{ fontSize: 13, color: "var(--ink-3)" }}>· {a.text} {a.by ? <span className="muted">— {a.by}, {fromNow(a.at)}</span> : null}</div>)}
                  </div>
                ) : null}
              </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {detailId != null ? <QuoteResponseModal id={detailId} onClose={() => setDetailId(null)} /> : null}
    </div>
  );
}

// --------------------------------------------------------------------
// READ-ONLY client-response detail (opened from Quote History)
// --------------------------------------------------------------------
function QuoteResponseModal({ id, onClose }) {
  const [db] = useDB();
  const r = db.projectRequests.find((x) => x.id === id);
  if (!r) return null;
  const q = r.quote || {};
  const client = db.clients.find((c) => c.client_code === r.client_code);
  const clientName = (client && client.name) || [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || "Client";
  const svcNames = (q.services || []).map((sid) => (db.services.find((s) => s.id === sid) || {}).name).filter(Boolean);
  const accepted = r.status === "accepted";
  const rejected = r.status === "rejected";
  const responded = accepted || rejected;
  const responseStatus = accepted ? "Accepted by client" : rejected ? "Rejected by client" : "Awaiting client response";
  const responseAt = q.accepted_at || q.rejected_at || null;
  const reqId = `REQ-${String(r.id).padStart(4, "0")}`;

  const banner = (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 12, marginBottom: 18,
      background: accepted ? "var(--ok-soft)" : rejected ? "var(--danger-soft)" : "var(--paper-3)",
      color: accepted ? "var(--ok)" : rejected ? "var(--danger)" : "var(--ink-3)",
    }}>
      <Icon name={accepted ? "check" : rejected ? "x" : "clock"} size={20} />
      <div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{responseStatus}</div>
        <div style={{ fontSize: 13, marginTop: 2, opacity: .9 }}>
          {responded ? <>{clientName}{responseAt ? ` · ${fmtDate(responseAt)}` : ""}</> : "The client has not responded to this quote yet."}
        </div>
      </div>
    </div>
  );

  return (
    <Modal title={`${reqId} — Client Response`} lg onClose={onClose}
      footer={<Btn variant="primary" onClick={onClose}>Close</Btn>}>
      {banner}
      <div className="kv">
        <div><span className="kv__k">Request ID</span><span className="kv__v"><span className="code-pill">{reqId}</span></span></div>
        <div><span className="kv__k">Task Code</span><span className="kv__v">{r.task_code || "—"}</span></div>
        <div><span className="kv__k">Client Code</span><span className="kv__v">{r.client_code || "—"}</span></div>
        <div><span className="kv__k">Project Name</span><span className="kv__v">{r.project_name || "—"}</span></div>
        <div><span className="kv__k">Quote Amount</span><span className="kv__v" style={{ fontWeight: 800 }}>{money(q.amount, q.currency)}</span></div>
        <div><span className="kv__k">Currency</span><span className="kv__v">{q.currency || "—"}</span></div>
        <div><span className="kv__k">Valid Until</span><span className="kv__v">{q.valid_until ? fmtDate(q.valid_until) : "—"}</span></div>
        <div><span className="kv__k">Quote Status</span><span className="kv__v"><Badge variant={QUOTE_TONE[r.status] || "muted"}>{r.status === "quoted" ? "Sent" : r.status[0].toUpperCase() + r.status.slice(1)}</Badge></span></div>
        <div><span className="kv__k">Sent Date</span><span className="kv__v">{q.sent_at ? fmtDate(q.sent_at) : "—"}</span></div>
        <div><span className="kv__k">Client Response</span><span className="kv__v" style={{ color: accepted ? "var(--ok)" : rejected ? "var(--danger)" : "var(--ink-3)", fontWeight: 700 }}>{accepted ? "Accepted" : rejected ? "Rejected" : "Awaiting response"}</span></div>
        <div><span className="kv__k">Response Date</span><span className="kv__v">{responseAt ? fmtDate(responseAt) : "—"}</span></div>
        <div><span className="kv__k">Services</span><span className="kv__v" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{svcNames.length ? svcNames.map((n) => <Badge key={n} variant="primary">{n}</Badge>) : "—"}</span></div>
      </div>

      {rejected && (r.rejection_reason || r.rejection_category) ? (
        <div style={{ marginTop: 16, background: "var(--danger-soft)", padding: "12px 14px", borderRadius: 12 }}>
          <span className="kv__k" style={{ color: "var(--danger)" }}>Rejection reason{r.rejection_category ? ` · ${r.rejection_category}` : ""}</span>
          {r.rejection_reason ? <p style={{ margin: "4px 0 0", fontSize: 14 }}>{r.rejection_reason}</p> : null}
        </div>
      ) : null}

      {q.client_note ? <div style={{ marginTop: 16 }}><span className="kv__k">Client-visible notes</span><p style={{ margin: "5px 0 0" }}>{q.client_note}</p></div> : null}
      {q.internal_note ? <div style={{ marginTop: 14 }}><span className="kv__k">Internal notes (admin-only)</span><p style={{ margin: "5px 0 0", color: "var(--ink-3)" }}>{q.internal_note}</p></div> : null}

      {r.responseReadByTeam ? (
        <div className="hint" style={{ marginTop: 16 }}>Response read by <b>{r.responseReadBy || "team"}</b>{r.responseReadAt ? ` on ${fmtDate(r.responseReadAt)}` : ""}.</div>
      ) : null}

      {(r.activity || []).length ? (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line-2)" }}>
          <span className="kv__k">Activity log</span>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {r.activity.map((a, i) => <div key={i} style={{ fontSize: 13, color: "var(--ink-3)" }}>· {a.text} {a.by ? <span className="muted">— {a.by}, {fromNow(a.at)}</span> : null}</div>)}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

Object.assign(window, { AdminProjectProgress, AdminTaskQuotes });
