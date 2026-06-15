/* global React, useDB, useRouter, DB, nextTaskNumber, nextPONumber, Icon, Btn, Badge, StatusBadge, Card, PageHead, SearchField, Field, Input, Textarea, Select, CheckCard, Table, EmptyRow, usePaginate, Pager, Modal, useConfirm, toast, LangPair, fmtDate, fromNow, initials */
const { useState: useTS, useMemo: useTM } = React;

// ===================================================================
// Reusable: Dropzone + Files history (shared with Price Requests)
// ===================================================================
function Dropzone({ onFiles }) {
  const [over, setOver] = useTS(false);
  const ref = React.useRef(null);
  // Read each dropped file into a data-URI so it can be downloaded later.
  const pick = (list) => {
    const files = Array.from(list);
    if (!files.length) return;
    Promise.all(files.map((file) => new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res({ name: file.name, data: r.result, size: file.size });
      r.onerror = () => res({ name: file.name, data: "", size: file.size });
      r.readAsDataURL(file);
    }))).then(onFiles);
  };
  return (
    <div className={`dropzone${over ? " over" : ""}`} onClick={() => ref.current.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}>
      <div style={{ display: "grid", placeItems: "center" }}><Icon name="cloud-upload" size={40} /></div>
      <div style={{ fontWeight: 600 }}>Click to upload <span className="muted" style={{ fontWeight: 400 }}>or drag and drop</span></div>
      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Images, PDF, Word, Excel, ZIP, Text files</div>
      <input ref={ref} type="file" multiple style={{ display: "none" }} onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

// Workflow statuses for files, with badge variants.
const FILE_STATUSES = ["In Progress", "Pending", "Update", "Complete"];
const FILE_STATUS_BADGE = { "In Progress": "info", "Pending": "warn", "Update": "muted", "Complete": "ok" };
// Legacy records used "DTP" — map it to "In Progress" for display/edit.
function normFileStatus(s) { return s === "DTP" ? "In Progress" : (s || "In Progress"); }
// Trigger a real download of a stored file (data-URI), keeping its name.
function downloadMedia(m) {
  if (!m.data) { toast("This file has no stored data to download", "info"); return; }
  const a = document.createElement("a");
  a.href = m.data; a.download = m.original_name || "file";
  document.body.appendChild(a); a.click(); a.remove();
}

function FilesHistory({ media, onAdd, onDelete, readOnly }) {
  const [open, setOpen] = useTS(false);
  const [form, setForm] = useTS({ file_name: "", file_status: "In Progress", note: "", files: [] });
  const save = () => {
    if (!form.file_name.trim() && !form.files.length) { toast("File name is required", "info"); return; }
    const today = new Date().toISOString().slice(0, 10);
    const items = form.files.length
      ? form.files.map((file) => ({ id: Date.now() + Math.random(), original_name: file.name, data: file.data || "", size: file.size, file_status: form.file_status, note: form.note, created_at: today, updated_at: today }))
      : [{ id: Date.now() + Math.random(), original_name: form.file_name, data: "", file_status: form.file_status, note: form.note, created_at: today, updated_at: today }];
    onAdd(items);
    setForm({ file_name: "", file_status: "In Progress", note: "", files: [] });
    setOpen(false);
    toast("File added");
  };
  return (
    <Card>
      <div className="card__head">
        <h3 className="card__title">Files History</h3>
        {!readOnly ? <Btn variant="primary" size="sm" icon="plus" onClick={() => setOpen(true)}>Add Files</Btn> : null}
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>File Name</th><th>Date</th><th>Note</th><th>Status</th><th className="text-end">Action</th></tr></thead>
          <tbody>
            {media.length === 0 ? <EmptyRow span={5} icon="files" text="No files attached." /> :
              media.map((m) => {
                const st = normFileStatus(m.file_status);
                return (
                <tr key={m.id}>
                  <td className="lead-cell"><span className="flex items-center gap-8"><Icon name="file" size={16} style={{ color: "var(--accent)" }} /> {m.original_name}</span></td>
                  <td className="muted" style={{ fontSize: 13 }}>{fmtDate(m.created_at)}</td>
                  <td className="muted" style={{ fontSize: 13 }}>{m.note || "—"}</td>
                  <td><Badge variant={FILE_STATUS_BADGE[st] || "muted"}>{st}</Badge></td>
                  <td className="text-end">
                    <div className="row-actions">
                      <button className="act act--view" title="Download" onClick={() => downloadMedia(m)}><Icon name="download" size={16} /></button>
                      {!readOnly ? <button className="act act--del" title="Delete" onClick={() => onDelete(m.id)}><Icon name="trash" size={16} /></button> : null}
                    </div>
                  </td>
                </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {open ? (
        <Modal title="Add a new file" onClose={() => setOpen(false)} footer={<>
          <Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={save}>Save</Btn>
        </>}>
          <div className="row-gap">
            <Field label="File Name" required><Input value={form.file_name} onChange={(e) => setForm({ ...form, file_name: e.target.value })} placeholder="Name" /></Field>
            <Field label="Status" required>
              <Select value={form.file_status} onChange={(e) => setForm({ ...form, file_status: e.target.value })}>
                {FILE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Note"><Textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Enter text here" /></Field>
            <Field label="Upload the Files">
              <Dropzone onFiles={(files) => setForm((f) => ({ ...f, files: [...f.files, ...files], file_name: f.file_name || (files[0] && files[0].name) || "" }))} />
              {form.files.map((file, i) => (
                <div className="file-item" key={i}>
                  <span className="flex items-center gap-12"><span className="file-item__ic"><Icon name="file" size={18} /></span><span style={{ fontSize: 14 }}>{file.name}</span></span>
                  <button className="act act--del" onClick={() => setForm((f) => ({ ...f, files: f.files.filter((_, x) => x !== i) }))}><Icon name="x" size={15} /></button>
                </div>
              ))}
            </Field>
          </div>
        </Modal>
      ) : null}
    </Card>
  );
}

// ===================================================================
// TASKS LIST
// ===================================================================
function Tasks() {
  const [db] = useDB();
  const { go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const [q, setQ] = useTS("");
  const [status, setStatus] = useTS("");
  const [month, setMonth] = useTS("");
  const [lifecycle, setLifecycle] = useTS("active");

  const monthOpts = useTM(() => {
    const set = new Map();
    db.tasks.forEach((t) => { const d = t.start_date; if (d && /^\d{4}-\d{2}/.test(d)) { const k = d.slice(0, 7); if (!set.has(k)) set.set(k, new Date(d).toLocaleString("en-US", { month: "long", year: "numeric" })); } });
    return [...set.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, label]) => ({ key, label }));
  }, [db.tasks]);

  const filtered = useTM(() => db.tasks.filter((t) => {
    // Lifecycle filter: All / Active (non-deleted) / Deleted-archived.
    if (lifecycle === "active" && t.isDeleted) return false;
    if (lifecycle === "deleted" && !t.isDeleted) return false;
    const langs = (t.language_pair || []).map((p) => `${p.source || ""} ${p.target || ""}`).join(" ");
    const statusLabel = (STATUS_MAP[t.status] || {}).label || t.status || "";
    const hay = `${t.task_number} ${t.client_code} ${(t.freelancer_codes || []).join(" ")} ${t.creator} ${expandLangs(langs)} ${statusLabel} ${fmtDate(t.start_date)} ${fmtDate(t.end_date)}`.toLowerCase();
    const matchQ = !q || hay.includes(q.toLowerCase());
    const matchS = !status || t.status === status;
    const matchM = !month || (t.start_date && t.start_date.slice(0, 7) === month);
    return matchQ && matchS && matchM;
  }).sort((a, b) => {
    // Newest task on top: sort by the numeric part of the task number, descending.
    const num = (t) => parseInt(String(t.task_number || "").replace(/\D/g, ""), 10) || 0;
    return num(b) - num(a);
  }), [db.tasks, q, status, month]);
  const { page, setPage, pages, slice, total } = usePaginate(filtered, 8);

  // Soft delete / archive: never remove the task — flag it so its number is
  // preserved, it stays in the table for audit, and it drops out of active KPIs.
  const del = async (t) => {
    if (await confirm({ title: "Delete task?", message: `${t.task_number} will be archived as deleted. Its number is kept and won't be reused. You can still view it for history.`, danger: true, okLabel: "Delete" })) {
      DB.update("tasks", t.id, { isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: currentUser(db).name });
      toast("Task archived as deleted", "del");
    }
  };

  return (
    <div className="fade-in">
      {confirmNode}
      <PageHead crumb={<span>Workspace · Tasks</span>} title="Tasks" sub="Manage translation tasks and their files."
        actions={can(db, "Create Task") ? <Btn variant="primary" icon="plus" onClick={() => go("task-new")}>New Task</Btn> : null} />
      <Card>
        <div className="card__head">
          <div className="toolbar">
            <SearchField value={q} onChange={setQ} placeholder="Search tasks" />
            <Select className="inp" style={{ width: "auto", height: 42, paddingTop: 0, paddingBottom: 0 }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Status</option><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
            </Select>
            <Select className="inp" style={{ width: "auto", height: 42, paddingTop: 0, paddingBottom: 0 }} value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">All Months</option>
              {monthOpts.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </Select>
            <Select className="inp" style={{ width: "auto", height: 42, paddingTop: 0, paddingBottom: 0 }} value={lifecycle} onChange={(e) => setLifecycle(e.target.value)}>
              <option value="active">Active Tasks</option>
              <option value="all">All Tasks</option>
              <option value="deleted">Deleted / Archived</option>
            </Select>
            {(q || status || month || lifecycle !== "active") ? <Btn variant="ghost" size="sm" onClick={() => { setQ(""); setStatus(""); setMonth(""); setLifecycle("active"); }}>Reset</Btn> : null}
          </div>
        </div>
        <Table columns={[{ label: "Task Number" }, { label: "Client" }, { label: "Freelancers" }, { label: "Languages" }, { label: "Status" }, { label: "Start" }, { label: "End" }, { label: "Created By" }, { label: "Actions", end: true }]}>
          {slice.length === 0 ? <EmptyRow span={9} icon="tasks" text="No tasks found." /> :
            slice.map((t) => {
              const client = db.clients.find((c) => c.client_code === t.client_code);
              return (
              <tr key={t.id} className={t.isDeleted ? "row-deleted" : undefined}>
                <td><button className="code-pill" onClick={() => go("task", { id: t.id })}>{t.task_number}</button></td>
                <td>{client
                  ? <button className="code-pill" onClick={() => go("client", { id: client.id })} title="Open client details">{t.client_code}</button>
                  : <span className="code-pill" style={{ opacity: .55, cursor: "default" }} title="This client no longer exists">{t.client_code || "—"}</span>}</td>
                <td>{(t.freelancer_codes || []).length ? t.freelancer_codes.map((fc) => {
                  const fr = db.freelancers.find((x) => x.freelancer_code === fc);
                  return (
                    <div key={fc} style={{ marginBottom: 4 }}>{fr
                      ? <button className="code-pill" style={{ fontSize: 12 }} onClick={() => go("freelancer", { id: fr.id })} title="Open freelancer details">{fc}</button>
                      : <span className="code-pill" style={{ fontSize: 12, opacity: .55, cursor: "default" }} title="This freelancer no longer exists">{fc}</span>}</div>
                  );
                }) : <span className="muted">—</span>}</td>
                <td>{(t.language_pair || []).slice(0, 2).map((p, i) => <div key={i} style={{ marginBottom: 3 }}><LangPair {...p} /></div>)}</td>
                <td>{t.isDeleted ? <Badge variant="muted">Deleted</Badge> : <StatusBadge status={t.status} />}</td>
                <td className="muted" style={{ fontSize: 13 }}>{fmtDate(t.start_date)}</td>
                <td className="muted" style={{ fontSize: 13 }}>{fmtDate(t.end_date)}</td>
                <td style={{ fontSize: 13.5 }}>{t.creator || "—"}</td>
                <td className="text-end">
                  <div className="row-actions">
                    <button className="act act--view" title="View" onClick={() => go("task", { id: t.id })}><Icon name="eye" size={16} /></button>
                    {!t.isDeleted && can(db, "Update Task") ? <button className="act act--edit" title="Edit" onClick={() => go("task-edit", { id: t.id })}><Icon name="edit" size={16} /></button> : null}
                    {!t.isDeleted && can(db, "Delete Task") ? <button className="act act--del" title="Delete" onClick={() => del(t)}><Icon name="trash" size={16} /></button> : null}
                  </div>
                </td>
              </tr>
              );
            })}
        </Table>
        <div className="card__foot"><Pager page={page} pages={pages} setPage={setPage} total={total} /></div>
      </Card>
    </div>
  );
}

// ===================================================================
// TASK DETAIL
// ===================================================================
function TaskDetail() {
  const [db] = useDB();
  const { route, go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const [tab, setTab] = useTS("details");
  const task = db.tasks.find((t) => t.id === route.params.id);
  if (!task) return <NotFound go={go} back="tasks" />;

  const client = db.clients.find((c) => c.client_code === task.client_code);
  const freelancers = (task.freelancer_codes || []).map((c) => db.freelancers.find((f) => f.freelancer_code === c)).filter(Boolean);
  const services = (task.service_ids || []).map((id) => db.services.find((s) => s.id === id)).filter(Boolean);
  // Unread client quote responses for this task → red dot on the Quotes tab.
  const norm = (v) => String(v || "").trim().toUpperCase();
  const unreadQuotes = (db.projectRequests || []).filter((r) => norm(r.task_code) === norm(task.task_number) && (r.status === "accepted" || r.status === "rejected") && !r.responseReadByTeam).length;

  const addMedia = (items) => DB.update("tasks", task.id, { media: [...items, ...(task.media || [])] });
  const delMedia = (id) => DB.update("tasks", task.id, { media: (task.media || []).filter((m) => m.id !== id) });
  const isDeleted = !!task.isDeleted;
  const del = async () => { if (await confirm({ title: "Delete task?", message: `${task.task_number} will be archived as deleted. Its number is kept and won't be reused.`, danger: true, okLabel: "Delete" })) { DB.update("tasks", task.id, { isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: currentUser(db).name }); toast("Task archived as deleted", "del"); go("tasks"); } };

  return (
    <div className="fade-in">
      {confirmNode}
      <div className="flex items-center" style={{ justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <button className="btn btn--ghost" onClick={() => go("tasks")}><Icon name="arrow-left" size={17} /><span>Back to tasks</span></button>
        <div className="flex gap-8 items-center">
          {isDeleted ? <Badge variant="muted">Deleted</Badge> : null}
          {!isDeleted && can(db, "Update Task") ? <Btn variant="soft" icon="edit" onClick={() => go("task-edit", { id: task.id })}>Edit</Btn> : null}
          {!isDeleted && can(db, "Delete Task") ? <Btn variant="danger-soft" icon="trash" onClick={del}>Delete</Btn> : null}
        </div>
      </div>

      {isDeleted ? (
        <div className="td-deleted-banner">
          <Icon name="alert-triangle" size={18} />
          <div>This task is <b>deleted / archived</b> and is shown for historical reference only. Editing is disabled.{task.deletedAt ? <span className="muted"> Deleted {fmtDate(task.deletedAt)}{task.deletedBy ? ` by ${task.deletedBy}` : ""}.</span> : null}</div>
        </div>
      ) : null}

      <div className="detail-grid">
        <div>
          <div className="tabs">
            {[["details", "Task Details"], ["files", `Files History`], ["vpo", "Freelancer PO"], ["progress", "Project Progress"], ["quotes", "Quotes & Approvals"]].map(([k, l]) => (
              <button key={k} className={`tab${tab === k ? " on" : ""}`} onClick={() => setTab(k)}>{l}{k === "files" ? <span className="badge badge--muted">{(task.media || []).length}</span> : null}{k === "quotes" && unreadQuotes > 0 ? <span className="td-tab-dot" title={`${unreadQuotes} unread client response${unreadQuotes > 1 ? "s" : ""}`}></span> : null}</button>
            ))}
          </div>

          {tab === "details" ? (
            <div className="row-gap">
              <Card>
                <div className="card__head"><h3 className="card__title">Task Information</h3><StatusBadge status={task.status} /></div>
                <div className="card__body">
                  <div className="kv">
                    <div><span className="kv__k">Task Number</span><span className="kv__v"><span className="code-pill">{task.task_number}</span></span></div>
                    <div><span className="kv__k">Client Code</span><span className="kv__v">{client ? <button className="link" onClick={() => go("client", { id: client.id })}>{task.client_code}</button> : task.client_code}</span></div>
                    <div><span className="kv__k">Reference Task</span><span className="kv__v">{(() => { const ref = task.reference_number ? db.tasks.find((t) => t.task_number === task.reference_number) : null; return ref ? <button className="code-pill" onClick={() => go("task", { id: ref.id })} title="Open reference task">{task.reference_number}</button> : (task.reference_number || "—"); })()}</span></div>
                    <div><span className="kv__k">Client Task Name</span><span className="kv__v">{task.client_task_name || "—"}</span></div>
                    <div><span className="kv__k">File Status</span><span className="kv__v">{task.file_status || "—"}</span></div>
                    <div><span className="kv__k">Page Numbers</span><span className="kv__v">{task.page_numbers || "—"}</span></div>
                    <div><span className="kv__k">Words Count</span><span className="kv__v">{task.words_count || "—"}</span></div>
                    <div><span className="kv__k">Start</span><span className="kv__v">{fmtDate(task.start_date)} · {task.start_time}</span></div>
                    <div><span className="kv__k">End</span><span className="kv__v">{fmtDate(task.end_date)} · {task.end_time}</span></div>
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <span className="kv__k">Language Pairs</span>
                    <div className="flex gap-8 wrap" style={{ marginTop: 6 }}>{(task.language_pair || []).map((p, i) => <LangPair key={i} {...p} />)}</div>
                  </div>
                  {services.length ? (
                    <div style={{ marginTop: 18 }}>
                      <span className="kv__k">Services</span>
                      <div className="flex gap-8 wrap" style={{ marginTop: 6 }}>{services.map((s) => <Badge key={s.id} variant="primary">{s.name}</Badge>)}</div>
                    </div>
                  ) : null}
                  {task.notes ? <div style={{ marginTop: 18 }}><span className="kv__k">Notes</span><p style={{ margin: "6px 0 0" }}>{task.notes}</p></div> : null}
                  {task.link ? <div style={{ marginTop: 18 }}><span className="kv__k">Link</span><div><a className="link" href={task.link} target="_blank" rel="noreferrer">{task.link}</a></div></div> : null}
                </div>
              </Card>

              {freelancers.length ? (
                <Card>
                  <div className="card__head"><h3 className="card__title">Freelancers on this task</h3></div>
                  <div className="card__body grid-2">
                    {freelancers.map((f) => {
                      const fSvc = (f.service_ids || []).map((id) => db.services.find((s) => s.id === id)).filter(Boolean);
                      const fLangs = f.language_pair || [];
                      return (
                      <div key={f.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 18 }}>
                        <div className="flex items-center" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                          <div className="flex items-center gap-12"><span className="avatar" style={{ width: 38, height: 38 }}>{initials(f.name)}</span>
                            <div><div style={{ fontWeight: 700 }}>{f.name}</div><button className="code-pill" style={{ fontSize: 11.5, marginTop: 2 }} onClick={() => go("freelancer", { id: f.id })} title="Open freelancer details">{f.freelancer_code}</button></div></div>
                          <button className="act act--view" title="Open freelancer details" onClick={() => go("freelancer", { id: f.id })}><Icon name="external-link" size={16} /></button>
                        </div>
                        <div className="kv" style={{ gap: "10px 18px" }}>
                          <div><span className="kv__k">Rate</span><span className="kv__v">{f.price_hr} {f.currency}</span></div>
                          <div><span className="kv__k">Quota</span><span className="kv__v">{f.quota}</span></div>
                        </div>
                        <div style={{ marginTop: 14 }}>
                          <span className="kv__k">Services</span>
                          <div className="flex gap-8 wrap" style={{ marginTop: 6 }}>{fSvc.length ? fSvc.map((s) => <Badge key={s.id} variant="primary">{s.name}</Badge>) : <span className="muted" style={{ fontSize: 13 }}>—</span>}</div>
                        </div>
                        <div style={{ marginTop: 14 }}>
                          <span className="kv__k">Language Pairs</span>
                          <div className="flex gap-8 wrap" style={{ marginTop: 6 }}>{fLangs.length ? fLangs.map((p, i) => <LangPair key={i} {...p} />) : <span className="muted" style={{ fontSize: 13 }}>—</span>}</div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </Card>
              ) : null}
            </div>
          ) : null}

          {tab === "files" ? <FilesHistory media={task.media || []} onAdd={addMedia} onDelete={delMedia} readOnly={isDeleted} /> : null}
          {tab === "vpo" ? <POTable kind="vendor" task={task} readOnly={isDeleted} /> : null}
          {tab === "progress" ? <AdminProjectProgress task={task} readOnly={isDeleted} /> : null}
          {tab === "quotes" ? <AdminTaskQuotes task={task} readOnly={isDeleted} /> : null}
        </div>

        <div className="row-gap">
          <Card>
            <div className="card__head"><h3 className="card__title">Summary</h3></div>
            <div className="card__body">
              <div className="summary-row"><span className="summary-row__k">Created By</span><span className="summary-row__v">{task.creator || "—"}</span></div>
              <div className="summary-row"><span className="summary-row__k">Created At</span><span className="summary-row__v">{fmtDate(task.created_at)}</span></div>
              <div className="summary-row"><span className="summary-row__k">Total Files</span><span className="summary-row__v">{(task.media || []).length}</span></div>
              <div className="summary-row"><span className="summary-row__k">Freelancers</span><span className="summary-row__v">{(task.freelancer_codes || []).length}</span></div>
              <div className="summary-row"><span className="summary-row__k">Services</span><span className="summary-row__v">{services.length}</span></div>
            </div>
          </Card>
          {services.length ? (
            <Card>
              <div className="card__head"><h3 className="card__title">Services Details</h3></div>
              <div className="card__body row-gap">
                {services.map((s) => (
                  <div key={s.id} style={{ paddingBottom: 12, borderBottom: "1px solid var(--line-2)" }}>
                    <div className="flex items-center" style={{ justifyContent: "space-between" }}><strong>{s.name}</strong><Badge variant={s.status === "active" ? "ok" : "muted"}>{s.status}</Badge></div>
                    <p className="muted" style={{ fontSize: 13, margin: "5px 0 0" }}>{s.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// PO TABLE (vendor / client)
// ===================================================================
function lineAmount(it) {
  return Number(it.rate || 0) * Number(it.qty || 0);
}
function addDays(s, n) {
  try { const d = new Date(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); } catch (e) { return s; }
}

function POTable({ kind, task, readOnly }) {
  const [db] = useDB();
  const { go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const coll = kind === "vendor" ? "vendorPOs" : "clientPOs";
  const rows = db[coll].filter((p) => p.task_id === task.id);
  const [open, setOpen] = useTS(false);
  const [editId, setEditId] = useTS(null);
  const [refErr, setRefErr] = useTS("");

  const defCur = kind === "vendor" ? "USD" : (db.clients.find((c) => c.client_code === task.client_code)?.currency || "USD");
  const svcNames = (task.service_ids || []).map((id) => (db.services.find((s) => s.id === id) || {}).name).filter(Boolean);
  const allSvc = db.services.map((s) => s.name);

  const blankItem = () => ({
    service: svcNames[0] || "Translation",
    description: task.task_number ? `${task.task_number} — language services` : "",
    qty: 1, rate: "",
  });
  const blank = () => {
    const today = new Date().toISOString().slice(0, 10);
    const fc = kind === "vendor" ? ((task.freelancer_codes || [])[0] || "") : undefined;
    return {
      po_number: nextPONumber(),
      freelancer_code: fc,
      ref_no: task.task_number || "",
      currency: defCur,
      date: today,
      due_date: addDays(today, 30),
      notes: "",
      items: [blankItem()],
    };
  };
  const [form, setForm] = useTS(blank);

  // switching freelancer just records the code — the PDF pulls the name and
  // contact details live from the Freelancers database when exported.
  const onFreelancer = (code) => setForm((f) => ({ ...f, freelancer_code: code }));

  const total = form.items.reduce((s, it) => s + Number(it.rate || 0) * Number(it.qty || 0), 0);
  const selFre = kind === "vendor" ? db.freelancers.find((x) => x.freelancer_code === form.freelancer_code) : null;

  const setItem = (i, patch) => setForm((f) => ({ ...f, items: f.items.map((it, x) => x === i ? { ...it, ...patch } : it) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, blankItem()] }));
  const delItem = (i) => setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, x) => x !== i) : f.items }));

  const save = () => {
    if (total <= 0) { toast("Add at least one line with a rate", "info"); return; }
    const refValid = !form.ref_no || db.tasks.some((t) => t.task_number === form.ref_no);
    if (!refValid) { setRefErr("This task does not exist. Please select an existing task."); toast("Reference No. must be an existing task", "info"); return; }
    setRefErr("");
    const items = form.items.map((it) => ({
      service: it.service, description: it.description,
      qty: Number(it.qty || 0), rate: Number(it.rate || 0),
    }));
    const payload = {
      po_number: form.po_number,
      ...(kind === "vendor" ? { freelancer_code: form.freelancer_code } : {}),
      ref_no: form.ref_no, due_date: form.due_date,
      currency: form.currency, date: form.date, notes: form.notes,
      items, amount: total,
    };
    if (editId) {
      // Updating the record auto-refreshes the on-demand PO PDF — View /
      // Download always render from the latest data, no stored file.
      DB.update(coll, editId, payload);
      toast("PO updated — PDF refreshed");
    } else {
      DB.insert(coll, { ...payload, task_id: task.id });
      toast("PO created — export to PDF from the list");
    }
    setForm(blank()); setOpen(false); setEditId(null);
  };
  const openNew = () => { setEditId(null); setForm(blank()); setRefErr(""); setOpen(true); };
  const openEdit = (p) => {
    setEditId(p.id); setRefErr("");
    setForm({
      po_number: p.po_number,
      freelancer_code: p.freelancer_code || (kind === "vendor" ? ((task.freelancer_codes || [])[0] || "") : undefined),
      ref_no: p.ref_no || task.task_number || "",
      currency: p.currency || defCur,
      date: p.date || new Date().toISOString().slice(0, 10),
      due_date: p.due_date || "",
      notes: p.notes || "",
      items: (p.items && p.items.length)
        ? p.items.map((it) => ({ service: it.service, description: it.description, qty: it.qty, rate: it.rate }))
        : [{ service: svcNames[0] || "Translation", description: p.ref_no || task.task_number || "", qty: 1, rate: p.amount || "" }],
    });
    setOpen(true);
  };
  const del = async (p) => { if (await confirm({ title: "Delete PO?", message: `Remove ${p.po_number}?`, danger: true, okLabel: "Delete" })) { DB.remove(coll, p.id); toast("PO deleted", "del"); } };
  const exportPdf = (p, autoPrint) => { if (window.exportPOInvoice) window.exportPOInvoice(p, kind, db, { autoPrint }); };

  return (
    <Card>
      {confirmNode}
      <div className="card__head">
        <div><h3 className="card__title">{kind === "vendor" ? "Freelancer" : "Client"} Purchase Orders</h3><p className="card__sub">For task {task.task_number}</p></div>
        {!readOnly ? <Btn variant="primary" size="sm" icon="plus" onClick={openNew}>New PO</Btn> : null}
      </div>
      <Table columns={kind === "vendor"
        ? [{ label: "PO Number" }, { label: "Freelancer" }, { label: "Amount" }, { label: "Date" }, { label: "Payment Due By" }, { label: "Action", end: true }]
        : [{ label: "PO Number" }, { label: "Amount" }, { label: "Date" }, { label: "Notes" }, { label: "Action", end: true }]}>
        {rows.length === 0 ? <EmptyRow span={kind === "vendor" ? 6 : 5} icon="file-invoice" text="No purchase orders yet." /> :
          rows.map((p) => {
            const frec = kind === "vendor" ? db.freelancers.find((x) => x.freelancer_code === p.freelancer_code) : null;
            return (
            <tr key={p.id}>
              <td><button className="link cell-mono" style={{ fontWeight: 700 }} title="Open PDF preview" onClick={() => exportPdf(p, false)}>{p.po_number}</button></td>
              {kind === "vendor" ? <td>{frec
                ? <button className="code-pill" onClick={() => go("freelancer", { id: frec.id })} title="Open freelancer details">{p.freelancer_code}</button>
                : <span className="cell-mono muted">{p.freelancer_code || "—"}</span>}</td> : null}
              <td className="lead-cell">{money(p.amount, p.currency)}</td>
              <td className="muted" style={{ fontSize: 13 }}>{fmtDate(p.date)}</td>
              {kind === "vendor" ? <td className="muted" style={{ fontSize: 13 }}>{p.due_date ? fmtDate(p.due_date) : "—"}</td> : null}
              {kind === "client" ? <td className="muted" style={{ fontSize: 13 }}>{p.notes || "—"}</td> : null}
              <td className="text-end">
                <div className="row-actions">
                  <button className="act act--view" title="View PDF preview" onClick={() => exportPdf(p, false)}><Icon name="eye" size={16} /></button>
                  <button className="act act--pdf" title="Download PDF" onClick={() => exportPdf(p, true)}><Icon name="download" size={16} /></button>
                  {!readOnly ? <button className="act act--edit" title="Edit" onClick={() => openEdit(p)}><Icon name="edit" size={16} /></button> : null}
                  {!readOnly ? <button className="act act--del" title="Delete" onClick={() => del(p)}><Icon name="trash" size={16} /></button> : null}
                </div>
              </td>
            </tr>
            );
          })}
      </Table>
      {open ? (
        <Modal lg title={`${editId ? "Edit" : "New"} ${kind === "vendor" ? "Freelancer" : "Client"} PO`} onClose={() => { setOpen(false); setEditId(null); }} footer={<>
          <Btn variant="ghost" onClick={() => { setOpen(false); setEditId(null); }}>Cancel</Btn><Btn variant="primary" onClick={save}>{editId ? "Save" : "Create"}</Btn></>}>
          <div className="form-grid">
            <Field label="PO Number" hint="Generated automatically"><Input value={form.po_number} readOnly className="inp--auto" /></Field>
            {kind === "vendor" ? (
              <Field label="Freelancer Code"><Select value={form.freelancer_code} onChange={(e) => onFreelancer(e.target.value)}>
                {(task.freelancer_codes || []).length ? task.freelancer_codes.map((c) => <option key={c} value={c}>{c}</option>) : <option value="">—</option>}
              </Select></Field>
            ) : <Field label="Reference No."><Input value={form.ref_no} onChange={(e) => setForm({ ...form, ref_no: e.target.value })} /></Field>}
            {kind === "vendor" ? <Field label="Freelancer Name" hint="From the Freelancers database"><Input value={selFre ? selFre.name : "—"} readOnly className="inp--auto" /></Field> : null}
            {kind === "vendor" ? (
              <Field label="Reference No." span={12} error={refErr} hint="Search and select an existing task">
                <Combo value={form.ref_no} error={!!refErr} placeholder="T-26-0001"
                  options={db.tasks} getValue={(t) => t.task_number}
                  getLabel={(t) => (db.clients.find((c) => c.client_code === t.client_code) || {}).name || t.client_code || "Task"}
                  onChange={(v) => { setForm({ ...form, ref_no: v }); if (refErr) setRefErr(""); }}
                  onPick={(t) => { setForm({ ...form, ref_no: t.task_number }); setRefErr(""); }} />
              </Field>
            ) : null}
            <Field label="Date"><DateInput value={form.date} onChange={(v) => setForm({ ...form, date: v })} /></Field>
            <Field label="Payment Due By"><DateInput value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} /></Field>
            <Field label="Currency"><Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option>USD</option><option>EGP</option></Select></Field>

            <div className="po-li">
              <div className="po-li__bar">
                <span className="po-li__title">Line items</span>
                <Btn variant="soft" size="sm" icon="plus" onClick={addItem}>Add line</Btn>
              </div>
              {form.items.map((it, i) => (
                <div className="po-item" key={i}>
                  <div className="po-item__row1">
                    <Input value={it.description} placeholder="Description of work" onChange={(e) => setItem(i, { description: e.target.value })} />
                    <button type="button" className="po-item__del" title="Remove line" disabled={form.items.length === 1} style={form.items.length === 1 ? { opacity: .4, cursor: "not-allowed" } : undefined} onClick={() => delItem(i)}><Icon name="trash" size={15} /></button>
                  </div>
                  <div className="po-item__grid">
                    <label className="micro"><span>Service</span>
                      <Select value={it.service} onChange={(e) => setItem(i, { service: e.target.value })}>
                        {[...new Set([it.service, ...allSvc].filter(Boolean))].map((n) => <option key={n} value={n}>{n}</option>)}
                      </Select></label>
                    <label className="micro"><span>Qty</span>
                      <Input type="number" min="0" step="1" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} /></label>
                    <label className="micro"><span>Rate</span>
                      <Input type="number" min="0" step="0.01" value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} /></label>
                  </div>
                  <div className="po-item__amt"><span className="muted">Line amount</span><b>{money(lineAmount(it), form.currency)}</b></div>
                </div>
              ))}
              <div className="po-totals">
                <div className="row grand"><span>Total</span><span>{money(total, form.currency)}</span></div>
              </div>
            </div>

            <Field label="Notes / extra terms" span={12}><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional — added above the standard terms on the PO" /></Field>
          </div>
        </Modal>
      ) : null}
    </Card>
  );
}

// ===================================================================
// TASK FORM (create / edit)
// ===================================================================
function TaskForm() {
  const [db] = useDB();
  const { route, go } = useRouter();
  const editing = route.name === "task-edit";
  const existing = editing ? db.tasks.find((t) => t.id === route.params.id) : null;

  const [f, setF] = useTS(() => {
    const toRows = (codes) => ((codes || []).length ? codes : [""]).map((code) => ({ code: code || "", name: (db.freelancers.find((x) => x.freelancer_code === code) || {}).name || "" }));
    return existing
      ? { ...existing, freelancerRows: toRows(existing.freelancer_codes) }
      : {
        task_number: nextTaskNumber(db.tasks), client_code: "", reference_number: "", client_task_name: "", status: "pending",
        page_numbers: "", words_count: "", start_date: new Date().toISOString().slice(0, 10), end_date: "",
        start_time: "09:00", end_time: "18:00", notes: "", link: "", file_status: "DTP",
        language_pair: [{ source: "", target: "" }], freelancerRows: [{ code: "", name: "" }], service_ids: [], media: [],
      };
  });
  const [err, setErr] = useTS({});
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  // Look up a freelancer by exact code (preferred) or exact name.
  const matchFreelancer = (row) => db.freelancers.find((x) => (x.freelancer_code || "").toLowerCase() === (row.code || "").toLowerCase())
    || db.freelancers.find((x) => (x.name || "").toLowerCase() === (row.name || "").toLowerCase());
  const rowServices = (row) => { const fr = matchFreelancer(row); return fr ? (fr.service_ids || []).map((id) => (db.services.find((s) => s.id === id) || {}).name).filter(Boolean) : []; };

  const setLang = (i, key, v) => setF((p) => ({ ...p, language_pair: p.language_pair.map((r, x) => x === i ? { ...r, [key]: v } : r) }));
  const addLang = () => setF((p) => ({ ...p, language_pair: [...p.language_pair, { source: "", target: "" }] }));
  const delLang = (i) => setF((p) => ({ ...p, language_pair: p.language_pair.length > 1 ? p.language_pair.filter((_, x) => x !== i) : p.language_pair }));
  // Freelancer rows: typing a code auto-fills name (and vice-versa) on exact
  // match; picking from the dropdown fills both from the real record.
  const setFreCode = (i, code) => setF((p) => ({ ...p, freelancerRows: p.freelancerRows.map((r, x) => { if (x !== i) return r; const fr = db.freelancers.find((z) => (z.freelancer_code || "").toLowerCase() === code.toLowerCase()); return { code, name: fr ? fr.name : r.name }; }) }));
  const setFreName = (i, name) => setF((p) => ({ ...p, freelancerRows: p.freelancerRows.map((r, x) => { if (x !== i) return r; const fr = db.freelancers.find((z) => (z.name || "").toLowerCase() === name.toLowerCase()); return { name, code: fr ? fr.freelancer_code : r.code }; }) }));
  const pickFre = (i, fr) => setF((p) => ({ ...p, freelancerRows: p.freelancerRows.map((r, x) => x === i ? { code: fr.freelancer_code, name: fr.name } : r) }));
  const addFre = () => setF((p) => ({ ...p, freelancerRows: [...p.freelancerRows, { code: "", name: "" }] }));
  const delFre = (i) => setF((p) => ({ ...p, freelancerRows: p.freelancerRows.length > 1 ? p.freelancerRows.filter((_, x) => x !== i) : [{ code: "", name: "" }] }));
  const toggleSvc = (id) => setF((p) => ({ ...p, service_ids: p.service_ids.includes(id) ? p.service_ids.filter((x) => x !== id) : [...p.service_ids, id] }));

  const save = () => {
    const e = {};
    if (!f.client_code.trim()) e.client_code = "Client code is required";
    if (!f.end_date) e.end_date = "End date is required";
    if (!f.language_pair.some((p) => p.source && p.target)) e.language_pair = "At least one full language pair is required";
    const usedRows = f.freelancerRows.filter((r) => r.code || r.name);
    if (usedRows.some((r) => !matchFreelancer(r))) e.freelancers = "One or more freelancers do not exist. Pick an existing freelancer.";
    setErr(e);
    if (Object.keys(e).length) { toast("Please fix the highlighted fields", "info"); return; }
    const freelancer_codes = [...new Set(usedRows.map((r) => matchFreelancer(r).freelancer_code))];
    const clean = { ...f, freelancer_codes, language_pair: f.language_pair.filter((p) => p.source || p.target) };
    delete clean.freelancerRows;
    if (editing) { DB.update("tasks", existing.id, clean); toast("Task updated"); go("task", { id: existing.id }); }
    else { const id = DB.nextId("tasks"); DB.insert("tasks", { ...clean, id, creator: currentUser(db).name, created_at: new Date().toISOString().slice(0, 10) }); toast("Task created"); go("task", { id }); }
  };

  return (
    <div className="fade-in">
      {editing && existing && existing.isDeleted ? (
        <Card><div className="cp-empty" style={{ padding: "40px 20px", textAlign: "center" }}>
          <Icon name="alert-triangle" size={30} />
          <div style={{ marginTop: 10, fontWeight: 700 }}>This task is deleted / archived and cannot be edited.</div>
          <div style={{ marginTop: 14 }}><Btn variant="soft" icon="eye" onClick={() => go("task", { id: existing.id })}>View task</Btn></div>
        </div></Card>
      ) : (
      <React.Fragment>
      <div className="flex items-center" style={{ marginBottom: 18 }}>
        <button className="btn btn--ghost" onClick={() => go(editing ? "task" : "tasks", editing ? { id: existing.id } : {})}><Icon name="arrow-left" size={17} /><span>Back</span></button>
      </div>
      <PageHead crumb={<span>Tasks · {editing ? "Edit" : "New"}</span>} title={editing ? `Edit ${existing.task_number}` : "New Task"} />
      <Card>
        <div className="card__body">
          <div className="form-grid">
            <Field label="Task Number" required><Input value={f.task_number} readOnly style={{ background: "var(--paper-3)" }} /></Field>
            <Field label="Client Code" required error={err.client_code}>
              <div className="inp-group"><Input value={f.client_code} onChange={(e) => set("client_code", e.target.value)} placeholder="WT-C-001" list="client-codes" />
                <button className="inp-group__btn" title="Clients" onClick={() => go("clients")}><Icon name="external-link" size={16} /></button></div>
              <datalist id="client-codes">{db.clients.map((c) => <option key={c.id} value={c.client_code}>{c.name}</option>)}</datalist>
            </Field>
            <Field label="Reference Task Number" hint="Optional — link to an existing task for reference">
              <Combo value={f.reference_number || ""} placeholder="Search a task number…"
                options={db.tasks.filter((t) => t.task_number !== f.task_number)} getValue={(t) => t.task_number}
                getLabel={(t) => (db.clients.find((c) => c.client_code === t.client_code) || {}).name || t.client_code || "Task"}
                onChange={(v) => set("reference_number", v.replace(/[^0-9A-Za-z\-]/g, ""))}
                onPick={(t) => set("reference_number", t.task_number)} /></Field>
            <Field label="Client Task Name"><Input value={f.client_task_name || ""} onChange={(e) => set("client_task_name", e.target.value)} placeholder="Optional" /></Field>
            <Field label="Status" required><Select value={f.status} onChange={(e) => set("status", e.target.value)}><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></Select></Field>
            <Field label="Page Numbers"><Input value={f.page_numbers} onChange={(e) => set("page_numbers", e.target.value)} /></Field>
            <Field label="Words Count"><Input value={f.words_count} onChange={(e) => set("words_count", e.target.value)} /></Field>
            <Field label="Start Date" required><DateInput value={f.start_date} onChange={(v) => set("start_date", v)} /></Field>
            <Field label="End Date" required error={err.end_date}><DateInput value={f.end_date} onChange={(v) => set("end_date", v)} /></Field>
            <Field label="Start Time" required><Input type="time" value={f.start_time} onChange={(e) => set("start_time", e.target.value)} /></Field>
            <Field label="End Time" required><Input type="time" value={f.end_time} onChange={(e) => set("end_time", e.target.value)} /></Field>
            <Field label="File Status"><Select value={f.file_status} onChange={(e) => set("file_status", e.target.value)}><option value="DTP">DTP</option><option value="Update">Update</option></Select></Field>
            <Field label="Link"><Input type="url" value={f.link} onChange={(e) => set("link", e.target.value)} placeholder="https://example.com/project" /></Field>
            <Field label="Notes" span={12}><Textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          </div>

          {/* language pairs */}
          <div style={{ marginTop: 26 }}>
            <div className="flex items-center" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <label style={{ fontWeight: 600, fontSize: 14 }}>Language Pairs <span className="req">*</span></label>
              <Btn variant="soft" size="sm" icon="plus" onClick={addLang}>Add Language</Btn>
            </div>
            {err.language_pair ? <div className="err" style={{ marginBottom: 8 }}>{err.language_pair}</div> : null}
            {f.language_pair.map((p, i) => (
              <div className="rep-row" key={i}>
                <Field label="Source"><Input value={p.source} onChange={(e) => setLang(i, "source", e.target.value)} placeholder="en" /></Field>
                <Field label="Target"><Input value={p.target} onChange={(e) => setLang(i, "target", e.target.value)} placeholder="ar" /></Field>
                <button className="rep-del" onClick={() => delLang(i)}><Icon name="trash" size={16} /></button>
              </div>
            ))}
          </div>

          {/* freelancers */}
          <div style={{ marginTop: 22 }}>
            <div className="flex items-center" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <div><label style={{ fontWeight: 600, fontSize: 14 }}>Freelancers</label><div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Pick from existing freelancers — code, name and services stay in sync.</div></div>
              <Btn variant="soft" size="sm" icon="plus" onClick={addFre}>Add Freelancer</Btn>
            </div>
            {err.freelancers ? <div className="err" style={{ marginBottom: 8 }}>{err.freelancers}</div> : null}
            {f.freelancerRows.map((r, i) => {
              const fr = matchFreelancer(r);
              const invalid = (r.code || r.name) && !fr;
              const svc = rowServices(r);
              return (
                <div className="rep-row rep-row--fl" key={i}>
                  <Field label="Freelancer Code">
                    <Combo value={r.code} error={invalid} placeholder="WT-F-0001"
                      options={db.freelancers} getValue={(x) => x.freelancer_code} getLabel={(x) => x.name}
                      onChange={(v) => setFreCode(i, v)} onPick={(x) => pickFre(i, x)} />
                  </Field>
                  <Field label="Freelancer Name">
                    <Combo value={r.name} error={invalid} placeholder="Type a name"
                      options={db.freelancers} getValue={(x) => x.name} getLabel={(x) => x.freelancer_code}
                      onChange={(v) => setFreName(i, v)} onPick={(x) => pickFre(i, x)} />
                  </Field>
                  <Field label="Freelancer Services">
                    <div className="fl-svc-box">
                      {invalid ? <span className="err" style={{ fontSize: 12 }}>No matching freelancer</span>
                        : svc.length ? svc.map((s) => <Badge key={s} variant="primary">{s}</Badge>)
                        : <span className="muted" style={{ fontSize: 13 }}>—</span>}
                    </div>
                  </Field>
                  <button className="rep-del" onClick={() => delFre(i)} title="Remove freelancer"><Icon name="trash" size={16} /></button>
                </div>
              );
            })}
          </div>

          {/* services */}
          <div style={{ marginTop: 22 }}>
            <label style={{ fontWeight: 600, fontSize: 14, display: "block", marginBottom: 10 }}>Services</label>
            <div className="check-grid">
              {db.services.map((s) => <CheckCard key={s.id} checked={f.service_ids.includes(s.id)} onChange={() => toggleSvc(s.id)} label={s.name} />)}
            </div>
          </div>
        </div>
        <div className="card__foot" style={{ justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => go(editing ? "task" : "tasks", editing ? { id: existing.id } : {})}>Cancel</Btn>
          <Btn variant="primary" icon="check" onClick={save}>{editing ? "Save changes" : "Create task"}</Btn>
        </div>
      </Card>
      </React.Fragment>
      )}
    </div>
  );
}

function NotFound({ go, back }) {
  return <div className="fade-in"><Card><div className="card__body" style={{ textAlign: "center", padding: 60 }}>
    <Icon name="inbox" size={40} style={{ opacity: .5 }} /><p className="muted" style={{ marginTop: 12 }}>Record not found.</p>
    <Btn variant="soft" onClick={() => go(back)}>Go back</Btn></div></Card></div>;
}

Object.assign(window, { Tasks, TaskDetail, TaskForm, FilesHistory, Dropzone, POTable, NotFound });
