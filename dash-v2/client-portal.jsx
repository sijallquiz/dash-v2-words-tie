/* global React, ReactDOM, useDB, DB, Icon, Btn, Badge, StatusBadge, Card, LangPair, money, fmtDate, fromNow, initials, toast, WT_JOURNEY_STAGES, WT_WORKFLOW_STAGES */
// ====================================================================
// CLIENT PORTAL — client-facing overlay module
// A self-contained experience the admin can preview and a client role
// would land in directly. Submissions flow back into the existing admin
// data (Price Requests, Contact Messages); projects + workflow read live
// from the existing Tasks. Scoped under .cp; admin UI untouched.
// ====================================================================
const { useState: useCP, useMemo: useCPM, useEffect: useCPE, createContext: createCPC, useContext: useCPC } = React;

const CPContext = createCPC(null);
const useCP_ = () => useCPC(CPContext);

// ---- helpers --------------------------------------------------------
// Map a task to its high-level client journey index (0..5).
function cpJourneyIndex(task, db) {
  const inv = (db.clientInvoices || []).find((i) => i.task_code === task.task_number);
  if (task.status === "completed") return (inv && inv.status === "completed") ? 5 : 4;
  if (task.status === "in_progress") return 3;
  return 0;
}
// Production progress: completed / active(non-skipped) stages.
function cpProgress(task) {
  const st = task.workflowStages || [];
  const active = st.filter((s) => s.status !== "Skipped");
  const done = st.filter((s) => s.status === "Completed");
  const pct = active.length ? Math.round((done.length / active.length) * 100) : 0;
  return { done: done.length, total: active.length, pct };
}
function cpCurrentStage(task) {
  const st = task.workflowStages || [];
  const inProg = st.find((s) => s.status === "In Progress");
  if (inProg) return inProg.name;
  const doneRev = [...st].reverse().find((s) => s.status === "Completed");
  if (doneRev) return doneRev.name;
  return WT_WORKFLOW_STAGES[0];
}
function cpProjName(t) { return t.title || t.project_name || t.task_number; }

// ====================================================================
// JOURNEY timeline (6 high-level phases)
// ====================================================================
function Journey({ index }) {
  return (
    <div className="cp-journey">
      {WT_JOURNEY_STAGES.map((s, i) => (
        <React.Fragment key={s}>
          {i > 0 ? <div className={`cp-jline${i <= index ? " done" : ""}`}></div> : null}
          <div className={`cp-jstep${i < index ? " is-done" : ""}${i === index ? " is-current" : ""}`}>
            <div className={`cp-jdot${i < index ? " done" : ""}${i === index ? " current" : ""}`}>
              {i < index ? <Icon name="check" size={18} /> : i === index ? <Icon name="clock" size={16} /> : null}
            </div>
            <span className="cp-jstep__lbl">{s}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ====================================================================
// PRODUCTION PROGRESS (8 vertical stages — client-safe fields only)
// ====================================================================
const STAGE_STATUS_LABEL = { "Not Started": "Not started", "In Progress": "In progress", "Waiting": "Waiting", "Completed": "Completed", "Skipped": "Skipped" };
function ProductionProgress({ task }) {
  const stages = task.workflowStages || [];
  return (
    <div className="cp-prog">
      {stages.map((s, i) => {
        const cls = s.status.toLowerCase().replace(" ", "_");
        return (
          <div className="cp-pstage" key={i}>
            <div className="cp-pstage__rail">
              <div className={`cp-pstage__dot ${cls}`}>
                {s.status === "Completed" ? <Icon name="check" size={15} /> : s.n}
              </div>
              <div className={`cp-pstage__bar ${cls}`}></div>
            </div>
            <div className="cp-pstage__body">
              <div className="cp-pstage__top">
                <span className={`cp-pstage__name${s.status === "Skipped" ? " skipped" : ""}`}>{s.name}</span>
                <StageBadge status={s.status} />
                {s.status === "Completed" && s.completed ? <span className="cp-pstage__date">Completed {fmtDate(s.completed)}</span> : null}
              </div>
              {s.client_note ? <p className="cp-pstage__note">{s.client_note}</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function StageBadge({ status }) {
  const map = { "Completed": "ok", "In Progress": "info", "Waiting": "warn", "Skipped": "muted", "Not Started": "muted" };
  return <span className={`badge badge--${map[status] || "muted"}`}>{STAGE_STATUS_LABEL[status] || status}</span>;
}

// ====================================================================
// CLIENT DASHBOARD
// ====================================================================
function ClientDashboard() {
  const { db, client, clientCode, go } = useCP_();
  const tasks = useCPM(() => db.tasks.filter((t) => t.client_code === clientCode && !t.isDeleted), [db.tasks, clientCode]);
  const requests = useCPM(() => db.projectRequests.filter((r) => r.client_code === clientCode), [db.projectRequests, clientCode]);

  const active = tasks.filter((t) => t.status !== "completed").length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const pendingQuotes = requests.filter((r) => r.status === "quoted");
  const approved = requests.filter((r) => r.status === "accepted").length;
  const files = tasks.reduce((n, t) => n + (t.media || []).length, 0) + requests.reduce((n, r) => n + (r.media || []).length, 0);
  const lastAt = [...tasks, ...requests].map((x) => x.created_at).sort().slice(-1)[0];

  const recent = [...tasks].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 3);

  const stats = [
    { label: "Active Projects", n: active, icon: "briefcase", cls: "ic-primary" },
    { label: "Pending Quotes", n: pendingQuotes.length, icon: "file-dollar", cls: "ic-warn" },
    { label: "Approved Quotes", n: approved, icon: "check", cls: "ic-ok" },
    { label: "Completed", n: completed, icon: "checklist-box", cls: "ic-ok" },
    { label: "Files Uploaded", n: files, icon: "files", cls: "ic-primary" },
  ];

  return (
    <div>
      {/* welcome hero */}
      <div className="cp-hero">
        <div className="cp-hero__row">
          <div>
            <div className="cp-hero__hi">Welcome, {client.name}</div>
            <div className="cp-hero__meta">
              <span>{client.email}</span>
              <span className="cp-hero__code">{client.client_code}</span>
            </div>
          </div>
          <div className="cp-hero__actions">
            <Btn variant="primary" icon="plus" onClick={() => go("request")}>New Project</Btn>
            <Btn variant="ghost" icon="message" onClick={() => go("connect")}>Contact Team</Btn>
          </div>
        </div>
      </div>

      {/* stat cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <div className="stat__top"><div className={`stat__ic ${s.cls}`}><Icon name={s.icon} size={22} /></div></div>
            <div className="stat__num" style={s.small ? { fontSize: 22, textTransform: "capitalize" } : null}>{s.n}</div>
            <div className="stat__label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* pending quotes */}
      <div className="cp-section-title"><Icon name="file-dollar" size={20} /> Pending Quotes</div>
      {pendingQuotes.length === 0 ? (
        <Card><div className="cp-empty"><Icon name="file-dollar" /><div>No quotes waiting for approval.</div></div></Card>
      ) : (
        <div className="row-gap" style={{ display: "grid", gap: 14 }}>
          {pendingQuotes.map((r) => (
            <Card key={r.id}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "20px 24px" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17, fontFamily: "var(--display)" }}>{r.project_name}</div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>Requested {fmtDate(r.created_at)} · valid until {fmtDate(r.quote.valid_until)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <div style={{ textAlign: "end" }}>
                    <div className="cp-quote__amt" style={{ fontSize: 24 }}>{money(r.quote.amount, r.quote.currency)}</div>
                  </div>
                  <Btn variant="primary" onClick={() => go("quotes")}>Review</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* quick actions */}
      <div className="cp-section-title"><Icon name="star" size={20} /> Quick Actions</div>
      <div className="cp-proj-grid">
        {[
          { t: "Request a Quote", s: "Start a new project request", i: "file-dollar", go: "request" },
          { t: "Let's Connect", s: "Send a message to our team", i: "message", go: "connect" },
          { t: "View My Projects", s: "Track all your projects", i: "briefcase", go: "projects" },
        ].map((q) => (
          <button key={q.t} className="cp-proj" style={{ textAlign: "start", cursor: "pointer" }} onClick={() => go(q.go)}>
            <div className="stat__ic ic-primary" style={{ width: 44, height: 44 }}><Icon name={q.i} size={20} /></div>
            <div className="cp-proj__name" style={{ fontSize: 17 }}>{q.t}</div>
            <div className="muted" style={{ fontSize: 13.5 }}>{q.s}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Reusable project card (dashboard + My Projects)
function ProjectCard({ task, db, go }) {
  const ji = cpJourneyIndex(task, db);
  const prog = cpProgress(task);
  return (
    <div className="cp-proj">
      <div>
        <div className="cp-proj__code">{task.reference_number || task.task_number}</div>
        <div className="cp-proj__name">{cpProjName(task)}</div>
      </div>
      <div className="cp-proj__row">
        <LangPair source={(task.language_pair || [])[0]?.source} target={(task.language_pair || [])[0]?.target} />
        {(task.language_pair || []).length > 1 ? <span className="muted" style={{ fontSize: 12 }}>+{task.language_pair.length - 1}</span> : null}
        <StatusBadge status={task.status} />
      </div>
      <div className="cp-proj__row" style={{ gap: 6 }}>
        <Icon name="clock" size={14} /> <span>{WT_JOURNEY_STAGES[ji]}</span>
        <span className="muted">· Due {fmtDate(task.end_date)}</span>
      </div>
      <div className="cp-progbar"><div className="cp-progbar__fill" style={{ width: `${prog.pct}%` }}></div></div>
      <div className="cp-proj__foot">
        <span className="muted" style={{ fontSize: 12.5 }}>{prog.pct}% complete</span>
        <Btn variant="soft" size="sm" iconRight="arrow-right" onClick={() => go("progress", task.id)}>View Progress</Btn>
      </div>
    </div>
  );
}

// ====================================================================
// SHELL
// ====================================================================
const CP_NAV = [
  { name: "dashboard", label: "Dashboard", icon: "home" },
  { name: "projects", label: "My Projects", icon: "briefcase" },
  { name: "request", label: "Request a Quote", icon: "file-dollar" },
  { name: "quotes", label: "Quotes & Approvals", icon: "checklist-box" },
  { name: "connect", label: "Let's Connect", icon: "message" },
];

function ClientPortal() {
  const [db] = useDB();
  const { go: adminGo } = useRouter();
  const clients = db.clients || [];
  const clientUser = (db.users || []).find((u) => u.role === "Client" && u.linkedClientCode);
  const [clientCode, setClientCode] = useCP(() => (clientUser && clientUser.linkedClientCode) || (clients[0] && clients[0].client_code) || "");
  const [page, setPage] = useCP({ name: "dashboard", taskId: null });
  const [sideOpen, setSideOpen] = useCP(false);
  const [userMenu, setUserMenu] = useCP(false);

  const client = useCPM(() => clients.find((c) => c.client_code === clientCode) || { name: "Client", email: "", client_code: clientCode }, [clients, clientCode]);
  // Pending quotes awaiting THIS client's response — drives the sidebar red badge.
  // Only count quotes still requiring client action (status "quoted"); exclude accepted/rejected/draft.
  const pendingQuotesCount = useCPM(
    () => (db.projectRequests || []).filter((r) => r.client_code === clientCode && r.status === "quoted").length,
    [db.projectRequests, clientCode]
  );
  const go = (name, taskId = null) => { setPage({ name, taskId }); setSideOpen(false); const m = document.querySelector(".cp-main"); if (m) m.scrollTo({ top: 0 }); };

  useCPE(() => { const m = document.querySelector(".cp-main"); if (m) m.scrollTo({ top: 0 }); }, [page.name]);

  const ctx = { db, client, clientCode, go, exit: () => adminGo("home") };
  const { CPProjects, CPProgress, CPRequestQuote, CPQuotes, CPConnect } = window;
  const PAGES = {
    dashboard: ClientDashboard, projects: CPProjects, progress: CPProgress,
    request: CPRequestQuote, quotes: CPQuotes, connect: CPConnect,
  };
  const Page = PAGES[page.name] || ClientDashboard;
  const pageTitle = { dashboard: ["Client Portal", "Dashboard"], projects: ["Client Portal", "My Projects"], request: ["Client Portal", "Request a Quote"], quotes: ["Client Portal", "Quotes & Approvals"], connect: ["Client Portal", "Let's Connect"], progress: ["My Projects", "Project Progress"] }[page.name] || ["Client Portal", ""];

  return (
    <CPContext.Provider value={ctx}>
      <div className={`cp${sideOpen ? " side-open" : ""}`}>
        {sideOpen ? <div className="cp-scrim" onClick={() => setSideOpen(false)}></div> : null}
        <aside className="cp-side">
          <div className="sidebar__inner">
            <div className="sidebar__brand">
              <img src={window.__resources?.logoLight || "assets/logo.png"} className="logo-light" alt="Words Tie" />
              <img src={window.__resources?.logoDark || "assets/logo-white.png"} className="logo-dark" alt="Words Tie" />
            </div>
            <div className="sidebar__scroll">
              <div className="nav-head">Client Portal</div>
              {CP_NAV.map((it) => (
                <button key={it.name} data-tip={it.label} className={`nav-item${page.name === it.name || (page.name === "progress" && it.name === "projects") ? " active" : ""}`} onClick={() => go(it.name)}>
                  <span className="nav-item__ic"><Icon name={it.icon} size={21} /></span>
                  <span className="nav-item__label">{it.label}</span>
                  {it.name === "quotes" && pendingQuotesCount > 0 ? <span className="nav-badge">{pendingQuotesCount}</span> : null}
                </button>
              ))}
            </div>
            <button className="cp-newproj" onClick={() => go("request")}>
              <Icon name="plus" size={19} />
              <span>New Project</span>
            </button>
            <div className="sidebar__user" onClick={() => setUserMenu((o) => !o)} style={{ cursor: "pointer" }}>
              <span className="avatar avatar--online">{initials(client.name)}</span>
              <span className="sidebar__user-meta">
                <span className="sidebar__user-name">{client.name}</span>
                <span className="sidebar__user-role">Client · {client.client_code}</span>
              </span>
              <Icon name="dots" size={18} className="sidebar__user-chev" />
              {userMenu ? (
                <div className="menu-pop menu-pop--up" style={{ insetInlineStart: 10, insetInlineEnd: 10 }} onClick={(e) => e.stopPropagation()}>
                  <div className="menu-pop__head"><span className="avatar" style={{ width: 38, height: 38 }}>{initials(client.name)}</span><div><div style={{ fontWeight: 700, fontSize: 14 }}>{client.name}</div><div className="muted" style={{ fontSize: 12 }}>{client.client_code}</div></div></div>
                  <button className="menu-pop__item" onClick={() => go("projects")}><Icon name="briefcase" size={18} /> My Projects</button>
                  <button className="menu-pop__item" onClick={() => go("connect")}><Icon name="message" size={18} /> Contact Team</button>
                  <div className="menu-pop__div"></div>
                  <button className="menu-pop__item danger" onClick={() => adminGo("home")}><Icon name="logout" size={18} /> Log Out</button>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="cp-main">
          <div className="cp-main__inner">
            <div className="cp-topbar">
              <button className="cp-burger" onClick={() => setSideOpen(true)}><Icon name="menu" size={22} /></button>
              <div>
                <div className="cp-topbar__title">{pageTitle[1]}</div>
                <div className="cp-topbar__sub">{client.name} · {client.client_code}</div>
              </div>
              <div className="cp-topbar__spacer"></div>
              <div className="cp-preview">
                <Icon name="eye" size={15} />
                <span>Admin preview</span>
                <select className="cp-switch" value={clientCode} onChange={(e) => { setClientCode(e.target.value); go("dashboard"); }}
                  style={{ background: "transparent", border: "none", fontWeight: 700 }}>
                  {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_code} · {c.name}</option>)}
                </select>
                <button className="cp-switch" onClick={() => adminGo("home")}>Exit</button>
              </div>
            </div>
            <Page key={page.name + (page.taskId || "")} taskId={page.taskId} />
          </div>
        </div>
      </div>
    </CPContext.Provider>
  );
}

Object.assign(window, { ClientPortal, CPContext, Journey, ProductionProgress, ProjectCard, cpJourneyIndex, cpProgress, cpCurrentStage, cpProjName, StageBadge });
