/* global React, useDB, useRouter, DB, nextTaskNumber, Icon, Btn, Badge, StatusBadge, Card, PageHead, SearchField, Field, Input, Select, Table, EmptyRow, usePaginate, Pager, Modal, useConfirm, toast, LangPair, fmtDate, fromNow, initials, FilesHistory, NotFound */
const { useState: useRS, useMemo: useRM } = React;

// ===================================================================
// PRICE REQUESTS
// ===================================================================
function Requests() {
  const [db] = useDB();
  const { go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const [q, setQ] = useRS("");
  const [status, setStatus] = useRS("");

  const filtered = useRM(() => db.projectRequests.filter((r) => {
    const langs = `${r.source_language || ""} ${r.target_language || ""}`;
    const dates = `${fmtDate(r.start_date)} ${fmtDate(r.end_date)} ${fmtDate(r.created_at)}`;
    const matchQ = !q || `${r.first_name} ${r.last_name} ${r.email} ${r.project_name} ${langs} ${dates}`.toLowerCase().includes(q.toLowerCase());
    return matchQ && (!status || r.status === status);
  }), [db.projectRequests, q, status]);
  const { page, setPage, pages, slice, total } = usePaginate(filtered, 8);
  const del = async (r) => { if (await confirm({ title: "Delete request?", message: `Remove “${r.project_name}”?`, danger: true, okLabel: "Delete" })) { DB.remove("projectRequests", r.id); toast("Request deleted", "del"); } };

  return (
    <div className="fade-in">
      {confirmNode}
      <PageHead crumb={<span>Workspace · Price Requests</span>} title="Price Requests" sub="Quote requests submitted from the website." />
      <Card>
        <div className="card__head">
          <div className="toolbar">
            <SearchField value={q} onChange={setQ} placeholder="Search by project, requester, language, date…" />
            <Select className="inp" style={{ width: "auto", height: 42, paddingTop: 0, paddingBottom: 0 }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Status</option><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="completed">Completed</option>
            </Select>
          </div>
        </div>
        <Table columns={[{ label: "Project", start: true }, { label: "Requester" }, { label: "Languages" }, { label: "Timeline" }, { label: "Status" }, { label: "Received" }, { label: "Actions", end: true }]}>
          {slice.length === 0 ? <EmptyRow span={7} icon="file-dollar" text="No requests found." /> :
            slice.map((r) => (
              <tr key={r.id}>
                <td className="lead-cell cell-left"><button className="link" onClick={() => go("request", { id: r.id })}>{r.project_name}</button></td>
                <td><div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.first_name} {r.last_name}</div><div className="muted" style={{ fontSize: 12.5 }}>{r.email}</div></div></td>
                <td><LangPair source={r.source_language} target={r.target_language} /></td>
                <td className="muted" style={{ fontSize: 13 }}>{fmtDate(r.start_date)} → {fmtDate(r.end_date)}</td>
                <td><StatusBadge status={r.status} /></td>
                <td className="muted" style={{ fontSize: 13 }}>{fromNow(r.created_at)}</td>
                <td className="text-end"><div className="row-actions">
                  <button className="act act--view" onClick={() => go("request", { id: r.id })}><Icon name="eye" size={16} /></button>
                  <button className="act act--del" onClick={() => del(r)}><Icon name="trash" size={16} /></button>
                </div></td>
              </tr>
            ))}
        </Table>
        <div className="card__foot"><Pager page={page} pages={pages} setPage={setPage} total={total} /></div>
      </Card>
    </div>
  );
}

function RequestDetail() {
  const [db] = useDB();
  const { route, go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const r = db.projectRequests.find((x) => x.id === route.params.id);
  if (!r) return <NotFound go={go} back="requests" />;
  const services = (r.service_ids || []).map((id) => db.services.find((s) => s.id === id)).filter(Boolean);

  const setStatus = (s) => { DB.update("projectRequests", r.id, { status: s }); toast(`Marked as ${s.replace("_", " ")}`); };
  const addMedia = (items) => DB.update("projectRequests", r.id, { media: [...items, ...(r.media || [])] });
  const delMedia = (id) => DB.update("projectRequests", r.id, { media: (r.media || []).filter((m) => m.id !== id) });

  return (
    <div className="fade-in">
      {confirmNode}
      <div className="flex items-center" style={{ marginBottom: 18 }}>
        <button className="btn btn--ghost" onClick={() => go("requests")}><Icon name="arrow-left" size={17} /><span>Back to requests</span></button>
      </div>
      <div className="detail-grid">
        <div className="row-gap">
          <Card>
            <div className="card__head"><div><h3 className="card__title">{r.project_name}</h3><p className="card__sub">Requested {fmtDate(r.created_at)}</p></div><StatusBadge status={r.status} /></div>
            <div className="card__body">
              <div className="kv">
                <div><span className="kv__k">Requester</span><span className="kv__v">{r.first_name} {r.last_name}</span></div>
                <div><span className="kv__k">Email</span><span className="kv__v">{r.email}</span></div>
                <div><span className="kv__k">Languages</span><span className="kv__v"><LangPair source={r.source_language} target={r.target_language} /></span></div>
                <div><span className="kv__k">Payment Type</span><span className="kv__v">{r.preferred_payment_type} · {r.currency}</span></div>
                <div><span className="kv__k">Time Zone</span><span className="kv__v">{r.time_zone}</span></div>
                <div><span className="kv__k">Project Link</span><span className="kv__v">{r.project_link ? <a className="link" href={r.project_link} target="_blank" rel="noreferrer">Open</a> : "—"}</span></div>
                <div><span className="kv__k">Start</span><span className="kv__v">{fmtDate(r.start_date)} · {r.start_date_time}</span></div>
                <div><span className="kv__k">End</span><span className="kv__v">{fmtDate(r.end_date)} · {r.end_date_time}</span></div>
              </div>
              {services.length ? <div style={{ marginTop: 18 }}><span className="kv__k">Services</span><div className="flex gap-8 wrap" style={{ marginTop: 6 }}>{services.map((s) => <Badge key={s.id} variant="primary">{s.name}</Badge>)}</div></div> : null}
              <div style={{ marginTop: 18 }}><span className="kv__k">Description</span><p style={{ margin: "6px 0 0" }}>{r.description}</p></div>
            </div>
          </Card>
          <FilesHistory media={r.media || []} onAdd={addMedia} onDelete={delMedia} />
        </div>
        <div className="row-gap">
          <Card>
            <div className="card__head"><h3 className="card__title">Update Status</h3></div>
            <div className="card__body row-gap" style={{ gap: 10 }}>
              {["pending", "in_progress", "completed"].map((s) => (
                <button key={s} className={`check${r.status === s ? " on" : ""}`} onClick={() => setStatus(s)} style={{ justifyContent: "space-between" }}>
                  <span className="flex items-center gap-8"><StatusBadge status={s} dot={false} /></span>
                  {r.status === s ? <Icon name="check" size={18} /> : null}
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <div className="card__head"><h3 className="card__title">Quick Reply</h3></div>
            <div className="card__body">
              <a className="btn btn--soft btn--block" href={`mailto:${r.email}?subject=Re: ${encodeURIComponent(r.project_name)}`}><Icon name="mail" size={17} /><span>Email {r.first_name}</span></a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ===================================================================
// CONTACT MESSAGES
// ===================================================================
function Messages() {
  const [db] = useDB();
  const { go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const [q, setQ] = useRS("");
  const filtered = useRM(() => db.contactMessages.filter((m) => !q || `${m.name} ${m.email} ${m.subject} ${m.message} ${fmtDate(m.created_at)}`.toLowerCase().includes(q.toLowerCase())), [db.contactMessages, q]);
  const { page, setPage, pages, slice, total } = usePaginate(filtered, 8);
  const del = async (m) => { if (await confirm({ title: "Delete message?", message: `Remove message from ${m.name}?`, danger: true, okLabel: "Delete" })) { DB.remove("contactMessages", m.id); toast("Message deleted", "del"); } };

  return (
    <div className="fade-in">
      {confirmNode}
      <PageHead crumb={<span>Workspace · Contact Messages</span>} title="Contact Messages" sub="Messages sent through the website contact form." />
      <Card>
        <div className="card__head"><SearchField value={q} onChange={setQ} placeholder="Search messages" /></div>
        <Table columns={[{ label: "From", start: true }, { label: "Subject" }, { label: "Message" }, { label: "Received" }, { label: "Actions", end: true }]}>
          {slice.length === 0 ? <EmptyRow span={5} icon="mail" text="No messages." /> :
            slice.map((m) => (
              <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => go("message", { id: m.id })}>
                <td className="cell-left"><div className="flex items-center gap-12"><span className="mini-avatar">{initials(m.name)}</span><div><div className="lead-cell" style={{ fontSize: 14 }}>{m.name}</div><div className="muted" style={{ fontSize: 12.5 }}>{m.email}</div></div></div></td>
                <td style={{ fontWeight: 600 }}>{m.subject}</td>
                <td className="muted" style={{ fontSize: 13, maxWidth: 320, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.message}</td>
                <td className="muted" style={{ fontSize: 13 }}>{fromNow(m.created_at)}</td>
                <td className="text-end"><div className="row-actions">
                  <button className="act act--view" title="View" onClick={(e) => { e.stopPropagation(); go("message", { id: m.id }); }}><Icon name="eye" size={16} /></button>
                  <button className="act act--del" title="Delete" onClick={(e) => { e.stopPropagation(); del(m); }}><Icon name="trash" size={16} /></button>
                </div></td>
              </tr>
            ))}
        </Table>
        <div className="card__foot"><Pager page={page} pages={pages} setPage={setPage} total={total} /></div>
      </Card>
    </div>
  );
}

// ===================================================================
// CONTACT MESSAGE DETAIL — full page
// ===================================================================
function MessageDetail() {
  const [db] = useDB();
  const { route, go } = useRouter();
  const [confirm, confirmNode] = useConfirm();
  const m = db.contactMessages.find((x) => x.id === route.params.id);
  if (!m) return (
    <div className="fade-in"><PageHead title="Message not found" /><Btn icon="arrow-left" onClick={() => go("messages")}>Back to messages</Btn></div>
  );
  const del = async () => { if (await confirm({ title: "Delete message?", message: `Remove message from ${m.name}?`, danger: true, okLabel: "Delete" })) { DB.remove("contactMessages", m.id); toast("Message deleted", "del"); go("messages"); } };
  const field = (label, val) => (
    <div className="info-cell"><span className="info-cell__k">{label}</span><span className="info-cell__v">{val || "\u2014"}</span></div>
  );

  return (
    <div className="fade-in">
      {confirmNode}
      <div className="flex items-center justify-between wrap gap-10" style={{ marginBottom: 4 }}>
        <button className="btn btn--ghost btn--sm" onClick={() => go("messages")}><Icon name="arrow-left" size={15} /><span>Back to messages</span></button>
        <div className="flex gap-8 wrap">
          <a className="btn btn--soft btn--sm" href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`}><Icon name="mail" size={16} /><span>Reply</span></a>
          <Btn variant="danger-soft" icon="trash" onClick={del}>Delete</Btn>
        </div>
      </div>
      <PageHead crumb={<span>Workspace · Contact Messages · {m.subject}</span>} title={m.subject}
        sub={`${m.name} · ${m.email} · ${fmtDate(m.created_at)}`} />

      <div className="detail-grid">
        <div className="detail-main">
          <Card>
            <div className="card__head"><h3 className="card__title">Message Information</h3></div>
            <div className="card__body">
              <div className="info-grid">
                {field("Sender Name", m.name)}
                {field("Sender Email", <a className="link" href={`mailto:${m.email}`}>{m.email}</a>)}
                {field("Date", fmtDate(m.created_at))}
                {field("Subject", m.subject)}
              </div>
              <div style={{ marginTop: 20 }}>
                <span className="info-cell__k">Message Body</span>
                <p style={{ margin: "8px 0 0", lineHeight: 1.7 }}>{m.message}</p>
              </div>
            </div>
          </Card>
        </div>
        <div className="detail-side">
          <Card>
            <div className="card__head"><h3 className="card__title">Sender</h3></div>
            <div className="card__body">
              <div className="flex items-center gap-12" style={{ marginBottom: 16 }}>
                <span className="avatar" style={{ width: 46, height: 46 }}>{initials(m.name)}</span>
                <div><div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div><div className="muted" style={{ fontSize: 12.5 }}>{fromNow(m.created_at)}</div></div>
              </div>
              <a className="btn btn--soft btn--block" href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`}><Icon name="mail" size={17} /><span>Reply to {m.name}</span></a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Requests, RequestDetail, Messages, MessageDetail });
