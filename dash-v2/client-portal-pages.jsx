/* global React, DB, Icon, Btn, Badge, StatusBadge, Card, Field, Input, Textarea, Select, DateInput, LangPair, Modal, money, fmtDate, fromNow, toast, useCP_, CPContext, Journey, ProductionProgress, ProjectCard, cpJourneyIndex, cpProgress, cpCurrentStage, cpProjName, StageBadge, WT_JOURNEY_STAGES */
// ====================================================================
// CLIENT PORTAL — pages: My Projects, Progress, Request a Quote,
// Quotes & Approvals, Let's Connect. All submissions write back into the
// existing admin collections (projectRequests, contactMessages).
// ====================================================================
const { useState: useP2, useContext: useC2, useMemo: useM2 } = React;
const useCPctx = () => useC2(CPContext);

// ====================================================================
// MY PROJECTS
// ====================================================================
function CPProjects() {
  const { db, clientCode, go } = useCPctx();
  const [q, setQ] = useP2("");
  const [filter, setFilter] = useP2("all");
  const tasks = useM2(() => db.tasks.filter((t) => t.client_code === clientCode && !t.isDeleted), [db.tasks, clientCode]);
  const filtered = tasks.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (!q) return true;
    const hay = `${cpProjName(t)} ${t.task_number} ${t.reference_number || ""} ${(t.language_pair || []).map((l) => `${l.source} ${l.target}`).join(" ")}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div>
      <div className="cp-tabs">
        {[["all", "All"], ["in_progress", "In Progress"], ["pending", "Pending"], ["completed", "Completed"]].map(([k, l]) => (
          <button key={k} className={`cp-tab${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div className="field-search" style={{ marginBottom: 20, maxWidth: 420 }}>
        <Icon name="search" size={17} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects or languages…" />
      </div>
      {filtered.length === 0 ? (
        <Card><div className="cp-empty"><Icon name="briefcase" /><div>No projects yet.</div></div></Card>
      ) : (
        <div className="cp-proj-grid">
          {filtered.map((t) => <ProjectCard key={t.id} task={t} db={db} go={go} />)}
        </div>
      )}
    </div>
  );
}

// ====================================================================
// PROJECT PROGRESS (View Progress)
// ====================================================================
function CPProgress({ taskId }) {
  const { db, client, go } = useCPctx();
  const task = db.tasks.find((t) => t.id === taskId && !t.isDeleted);
  if (!task) return (
    <div><Btn variant="ghost" icon="arrow-left" onClick={() => go("projects")}>Back to projects</Btn><Card><div className="cp-empty">Project not found.</div></Card></div>
  );
  const ji = cpJourneyIndex(task, db);
  const prog = cpProgress(task);
  const lp = task.language_pair || [];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Btn variant="ghost" icon="arrow-left" onClick={() => go("projects")}>Back to projects</Btn>
      </div>

      {/* journey */}
      <Card style={{ marginBottom: 20 }}>
        <div className="card__body"><Journey index={ji} /></div>
      </Card>

      {/* header info */}
      <Card style={{ marginBottom: 20 }}>
        <div className="card__head">
          <div>
            <h3 className="card__title" style={{ fontSize: 21 }}>{cpProjName(task)}</h3>
            <p className="card__sub">{task.reference_number || task.task_number} · {client.client_code}</p>
          </div>
          <StatusBadge status={task.status} />
        </div>
        <div className="card__body">
          <div className="kv">
            <div><span className="kv__k">Current Stage</span><span className="kv__v">{cpCurrentStage(task)}</span></div>
            <div><span className="kv__k">Journey Phase</span><span className="kv__v">{WT_JOURNEY_STAGES[ji]}</span></div>
            <div><span className="kv__k">Languages</span><span className="kv__v" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{lp.map((l, i) => <LangPair key={i} source={l.source} target={l.target} />)}</span></div>
            <div><span className="kv__k">Delivery Date</span><span className="kv__v">{fmtDate(task.end_date)}</span></div>
          </div>
          <div style={{ marginTop: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="kv__k">Overall Progress</span>
              <span style={{ fontWeight: 800, color: "var(--accent-2)" }}>{prog.pct}% · {prog.done}/{prog.total} stages</span>
            </div>
            <div className="cp-progbar"><div className="cp-progbar__fill" style={{ width: `${prog.pct}%` }}></div></div>
          </div>
        </div>
      </Card>

      {/* production stages */}
      <Card>
        <div className="card__head"><h3 className="card__title">Project Workflow</h3></div>
        <div className="card__body"><ProductionProgress task={task} /></div>
      </Card>
    </div>
  );
}

// ====================================================================
// REQUEST A QUOTE  → writes into admin Price Requests
// ====================================================================
const CP_PAYMENT_METHODS = ["Bank transfer", "PayPal", "Wise", "InstaPay", "Vodafone Cash", "Credit Card"];
const CP_CURRENCIES = ["USD", "EGP", "EUR", "GBP", "SAR", "AED"];

function CPFiles({ files, setFiles }) {
  const ref = React.useRef(null);
  const add = (list) => {
    const items = Array.from(list).map((f, i) => ({ id: Date.now() + i + Math.random(), original_name: f.name, file_status: "Pending", note: "", size: f.size, created_at: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString().slice(0, 10) }));
    setFiles((cur) => [...cur, ...items]);
  };
  return (
    <div>
      <input ref={ref} type="file" multiple style={{ display: "none" }}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv,.json,.png,.jpg,.jpeg"
        onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <button type="button" className="pdf-drop" onClick={() => ref.current && ref.current.click()}>
        <Icon name="cloud-upload" size={22} />
        <span><b>Upload files</b> — PDF, Word, Excel, PowerPoint, Text, ZIP & more</span>
      </button>
      {files.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {files.map((f) => (
            <span className="cp-filechip" key={f.id}>
              <Icon name="file" size={15} /><span>{f.original_name}</span>
              <button type="button" onClick={() => setFiles((cur) => cur.filter((x) => x.id !== f.id))}><Icon name="x" size={14} /></button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CPRequestQuote() {
  const { db, client, clientCode, go } = useCPctx();
  const clientUser = (db.users || []).find((u) => u.role === "Client" && u.linkedClientCode === clientCode);
  const [first, last] = (client.name || "").split(" ");
  const [form, setForm] = useP2({
    first_name: clientUser ? (clientUser.name.split(" ")[0] || "") : (first || ""),
    last_name: clientUser ? (clientUser.name.split(" ").slice(1).join(" ")) : (last || ""),
    email: client.email || "",
    project_name: "", project_link: "",
    source_language: "", target_language: "", description: "",
    time_zone: "", start_date: "", start_date_time: "", end_date: "", end_date_time: "",
    preferred_payment_type: "Bank transfer", currency: client.currency || "USD",
  });
  const [services, setServices] = useP2([]);
  const [files, setFiles] = useP2([]);
  const [done, setDone] = useP2(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleSvc = (id) => setServices((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const submit = () => {
    const required = [["first_name", "First name"], ["last_name", "Last name"], ["email", "Email"], ["project_name", "Project name"], ["source_language", "Source language"], ["target_language", "Target language"], ["description", "Details"], ["time_zone", "Time zone"], ["start_date", "Start date"], ["end_date", "Delivery date"]];
    const missing = required.find(([k]) => !String(form[k] || "").trim());
    if (missing) { toast(`${missing[1]} is required`, "info"); return; }
    DB.insert("projectRequests", {
      ...form,
      client_code: clientCode,
      source: "Client Portal",
      status: "pending",
      service_ids: services,
      media: files,
      quote: null,
      activity: [{ at: new Date().toISOString(), by: client.name, text: "Request submitted via Client Portal." }],
      created_at: new Date().toISOString().slice(0, 10),
    });
    toast("Your request has been submitted successfully.");
    setDone(true);
  };

  if (done) return (
    <Card>
      <div className="cp-success">
        <div className="cp-success__ic"><Icon name="check" size={38} /></div>
        <h2 style={{ fontFamily: "var(--display)", fontWeight: 900, fontSize: 26, margin: "0 0 8px" }}>Request submitted successfully</h2>
        <p className="muted" style={{ maxWidth: 440, margin: "0 auto 22px" }}>Our team will review your project and prepare a quotation. You'll see it under Quotes &amp; Approvals.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn variant="primary" icon="briefcase" onClick={() => go("projects")}>View My Projects</Btn>
          <Btn variant="ghost" icon="home" onClick={() => go("dashboard")}>Back to Dashboard</Btn>
        </div>
      </div>
    </Card>
  );

  return (
    <Card>
      <div className="card__body">
        <p className="muted" style={{ marginTop: 0 }}>Tell us about your project and we'll prepare a tailored quotation. Fields marked <span style={{ color: "var(--danger)" }}>*</span> are required.</p>

        <div className="cp-form-sec">About You</div>
        <div className="cp-grid3">
          <Field label="First Name" required><Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
          <Field label="Last Name" required><Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
          <Field label="Email" required><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
        </div>
        <div className="hint" style={{ marginTop: 6 }}>Linked to <b>{client.client_code}</b> · {client.name}</div>

        <div className="cp-form-sec">The Project</div>
        <div className="cp-grid2">
          <Field label="Project Name" required><Input value={form.project_name} onChange={(e) => set("project_name", e.target.value)} placeholder="e.g. Marketing Brochure 2026" /></Field>
          <Field label="Project Link"><Input value={form.project_link} onChange={(e) => set("project_link", e.target.value)} placeholder="https://…" /></Field>
          <Field label="Source Language" required><Input value={form.source_language} onChange={(e) => set("source_language", e.target.value)} placeholder="e.g. English" /></Field>
          <Field label="Target Language" required><Input value={form.target_language} onChange={(e) => set("target_language", e.target.value)} placeholder="e.g. Arabic, French" /></Field>
        </div>
        <Field label="Details / Information" required><Textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe scope, word count, tone, formatting needs…" /></Field>

        <div className="cp-form-sec">Services You Need</div>
        <div className="cp-svc-grid">
          {db.services.map((s) => (
            <label key={s.id} className={`check${services.includes(s.id) ? " on" : ""}`}>
              <input type="checkbox" checked={services.includes(s.id)} onChange={() => toggleSvc(s.id)} />
              <span>{s.name}</span>
            </label>
          ))}
        </div>

        <div className="cp-form-sec">Schedule</div>
        <div className="cp-grid3">
          <Field label="Time Zone" required><Input value={form.time_zone} onChange={(e) => set("time_zone", e.target.value)} placeholder="e.g. GMT+4 Dubai" /></Field>
          <Field label="Start Date" required><DateInput value={form.start_date} onChange={(v) => set("start_date", v)} /></Field>
          <Field label="Start Time" required><Input type="time" value={form.start_date_time} onChange={(e) => set("start_date_time", e.target.value)} /></Field>
          <Field label="Delivery Date" required><DateInput value={form.end_date} onChange={(v) => set("end_date", v)} /></Field>
          <Field label="Delivery Time" required><Input type="time" value={form.end_date_time} onChange={(e) => set("end_date_time", e.target.value)} /></Field>
        </div>

        <div className="cp-form-sec">Payment</div>
        <div className="cp-grid2">
          <Field label="Preferred Payment Method" required><Select value={form.preferred_payment_type} onChange={(e) => set("preferred_payment_type", e.target.value)}>{CP_PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
          <Field label="Preferred Currency" required><Select value={form.currency} onChange={(e) => set("currency", e.target.value)}>{CP_CURRENCIES.map((m) => <option key={m}>{m}</option>)}</Select></Field>
        </div>

        <div className="cp-form-sec">Files</div>
        <CPFiles files={files} setFiles={setFiles} />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 28 }}>
          <Btn variant="ghost" onClick={() => go("dashboard")}>Cancel</Btn>
          <Btn variant="primary" icon="check" onClick={submit}>Submit Request</Btn>
        </div>
      </div>
    </Card>
  );
}

// ====================================================================
// QUOTES & APPROVALS
// ====================================================================
const REJECT_REASONS = ["Price is too high", "Timeline does not fit", "Need to change project scope", "Chose another provider", "Other"];

function CPQuotes() {
  const { db, client, clientCode } = useCPctx();
  const quotes = useM2(() => db.projectRequests.filter((r) => r.client_code === clientCode && r.status !== "draft" && (r.quote || ["quoted", "accepted", "rejected"].includes(r.status))), [db.projectRequests, clientCode]);
  const [openId, setOpenId] = useP2(null);
  const [reject, setReject] = useP2(null); // request being rejected
  const [accept, setAccept] = useP2(null);

  const svcNames = (ids) => (ids || []).map((id) => (db.services.find((s) => s.id === id) || {}).name).filter(Boolean);

  const doAccept = (r) => {
    DB.update("projectRequests", r.id, {
      status: "accepted",
      quote: { ...(r.quote || {}), accepted_at: new Date().toISOString() },
      activity: [...(r.activity || []), { at: new Date().toISOString(), by: client.name, text: "Client accepted the quote." }],
    });
    toast("Your quote response has been sent.");
    setAccept(null);
  };

  return (
    <div>
      {quotes.length === 0 ? (
        <Card><div className="cp-empty"><Icon name="checklist-box" /><div>No quotes waiting for approval.</div></div></Card>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {quotes.map((r) => {
            const q = r.quote || {};
            const open = openId === r.id;
            const waiting = r.status === "quoted";
            return (
              <div className="cp-quote" key={r.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 200 }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink-4)" }}>REQ-{String(r.id).padStart(4, "0")}</div>
                    <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 21 }}>{r.project_name}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      <StatusBadge status={r.status} />
                      <LangPair source={r.source_language} target={r.target_language} />
                    </div>
                  </div>
                  <div style={{ textAlign: "end" }}>
                    <div className="cp-quote__amt">{money(q.amount, q.currency)}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>Valid until {fmtDate(q.valid_until)}</div>
                  </div>
                </div>

                {q.client_note ? <p style={{ margin: "14px 0 0", color: "var(--ink-2)", lineHeight: 1.6 }}>{q.client_note}</p> : null}

                {open ? (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line-2)" }}>
                    <div className="kv">
                      <div><span className="kv__k">Services</span><span className="kv__v" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{svcNames(q.services).length ? svcNames(q.services).map((n) => <Badge key={n} variant="primary">{n}</Badge>) : "—"}</span></div>
                      <div><span className="kv__k">Requested</span><span className="kv__v">{fmtDate(r.created_at)}</span></div>
                    </div>
                    {r.status === "rejected" && r.rejection_reason ? (
                      <div style={{ marginTop: 14, background: "var(--danger-soft)", padding: "12px 14px", borderRadius: 12 }}>
                        <span className="kv__k" style={{ color: "var(--danger)" }}>Rejection reason{r.rejection_category ? ` · ${r.rejection_category}` : ""}</span>
                        <p style={{ margin: "4px 0 0", fontSize: 14 }}>{r.rejection_reason}</p>
                      </div>
                    ) : null}
                    {(r.activity || []).length ? (
                      <div style={{ marginTop: 14 }}>
                        <span className="kv__k">Activity</span>
                        <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                          {r.activity.map((a, i) => <div key={i} style={{ fontSize: 13, color: "var(--ink-3)" }}>· {a.text} <span className="muted">— {fromNow(a.at)}</span></div>)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                  <Btn variant="ghost" size="sm" icon={open ? "chevron-down" : "eye"} onClick={() => setOpenId(open ? null : r.id)}>{open ? "Hide Details" : "View Details"}</Btn>
                  <div style={{ flex: 1 }}></div>
                  {waiting ? <>
                    <Btn variant="danger-soft" size="sm" icon="x" onClick={() => setReject(r)}>Reject</Btn>
                    <Btn variant="primary" size="sm" icon="check" onClick={() => setAccept(r)}>Accept</Btn>
                  </> : <Badge variant={r.status === "accepted" ? "ok" : "danger"}>{r.status === "accepted" ? "Accepted" : "Rejected"}</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {accept ? (
        <Modal title="Accept this quote?" onClose={() => setAccept(null)}
          footer={<>
            <Btn variant="ghost" onClick={() => setAccept(null)}>Cancel</Btn>
            <Btn variant="primary" icon="check" onClick={() => doAccept(accept)}>Yes, Accept</Btn>
          </>}>
          <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 15 }}>You're about to accept the quote for <b>{accept.project_name}</b> at <b>{money((accept.quote || {}).amount, (accept.quote || {}).currency)}</b>. Our team will begin once accepted.</p>
        </Modal>
      ) : null}

      {reject ? <RejectModal request={reject} client={client} onClose={() => setReject(null)} /> : null}
    </div>
  );
}

function RejectModal({ request, client, onClose }) {
  const [cat, setCat] = useP2("Price is too high");
  const [detail, setDetail] = useP2("");
  const submit = () => {
    if (!detail.trim() && cat === "Other") { toast("Please add details for your reason", "info"); return; }
    const reason = detail.trim() || cat;
    DB.update("projectRequests", request.id, {
      status: "rejected",
      rejection_category: cat,
      rejection_reason: reason,
      quote: { ...(request.quote || {}), rejected_at: new Date().toISOString() },
      activity: [...(request.activity || []), { at: new Date().toISOString(), by: client.name, text: `Client rejected the quote — ${cat}.` }],
    });
    toast("Your quote response has been sent.");
    onClose();
  };
  return (
    <Modal title="Reject quote" onClose={onClose}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" icon="x" onClick={submit}>Submit Rejection</Btn>
      </>}>
      <p style={{ margin: "0 0 16px", fontWeight: 700 }}>Please tell us why you are rejecting this quote</p>
      <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        {REJECT_REASONS.map((r) => (
          <label key={r} className={`check${cat === r ? " on" : ""}`} style={{ justifyContent: "flex-start", gap: 10 }}>
            <input type="radio" name="rej" checked={cat === r} onChange={() => setCat(r)} />
            <span>{r}</span>
          </label>
        ))}
      </div>
      <Field label="Additional details" hint="Optional, but helps us improve our offer">
        <Textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Tell us more…" />
      </Field>
    </Modal>
  );
}

// ====================================================================
// LET'S CONNECT  → writes into admin Contact Messages
// ====================================================================
function CPConnect() {
  const { db, client, clientCode, go } = useCPctx();
  const clientUser = (db.users || []).find((u) => u.role === "Client" && u.linkedClientCode === clientCode);
  const [form, setForm] = useP2({
    name: clientUser ? clientUser.name : client.name || "",
    email: client.email || "",
    phone: client.phone || (clientUser && clientUser.phone) || "",
    subject: "", message: "",
  });
  const [done, setDone] = useP2(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) { toast("Please fill all required fields", "info"); return; }
    DB.insert("contactMessages", {
      ...form,
      source: "Client Portal",
      client_code: clientCode,
      created_at: new Date().toISOString().slice(0, 10),
    });
    toast("Your message has been sent.");
    setDone(true);
  };

  if (done) return (
    <Card>
      <div className="cp-success">
        <div className="cp-success__ic"><Icon name="check" size={38} /></div>
        <h2 style={{ fontFamily: "var(--display)", fontWeight: 900, fontSize: 26, margin: "0 0 8px" }}>Message sent</h2>
        <p className="muted" style={{ maxWidth: 420, margin: "0 auto 22px" }}>Your message has been sent. Our team will get back to you soon.</p>
        <Btn variant="primary" icon="home" onClick={() => go("dashboard")}>Back to Dashboard</Btn>
      </div>
    </Card>
  );

  return (
    <div style={{ maxWidth: 680 }}>
      <Card>
        <div className="card__body">
          <p className="muted" style={{ marginTop: 0 }}>Have a question or need help? Send us a message and our team will get back to you.</p>
          <div className="cp-grid2">
            <Field label="Name" required><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Email" required><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          </div>
          <div className="cp-grid2">
            <Field label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Optional" /></Field>
            <Field label="Subject" required><Input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="What's this about?" /></Field>
          </div>
          <Field label="Message" required><Textarea rows={5} value={form.message} onChange={(e) => set("message", e.target.value)} placeholder="How can we help?" /></Field>
          <div className="hint">Sent as <b>{client.client_code}</b> · {client.name}</div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
            <Btn variant="ghost" onClick={() => go("dashboard")}>Cancel</Btn>
            <Btn variant="primary" icon="mail" onClick={submit}>Send Message</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { CPProjects, CPProgress, CPRequestQuote, CPQuotes, CPConnect, RejectModal, CPFiles });
