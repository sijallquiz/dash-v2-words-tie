/* global React, useDB, useRouter, Icon, Card, StatusBadge, money, fromNow, fmtDate, initials */
const { useMemo } = React;

function Home() {
  const [db] = useDB();
  const { go } = useRouter();

  const k = useMemo(() => {
    const tasks = db.tasks.filter((t) => !t.isDeleted);
    const pending = tasks.filter((t) => t.status === "pending").length;
    const inProg = tasks.filter((t) => t.status === "in_progress").length;
    const done = tasks.filter((t) => t.status === "completed").length;
    const revUsd = db.revenues.reduce((s, r) => s + (+r.total_usd || 0), 0);
    const expUsd = db.expenses.reduce((s, r) => s + (+r.total_usd || 0), 0);
    const revEgp = db.revenues.reduce((s, r) => s + (+r.total_egp || 0), 0);
    const expEgp = db.expenses.reduce((s, r) => s + (+r.total_egp || 0), 0);
    const words = tasks.reduce((s, t) => s + (parseInt(String(t.words_count).replace(/\D/g, ""), 10) || 0), 0);
    const now = Date.now();
    const overdue = tasks.filter((t) => t.status !== "completed" && t.end_date && new Date(t.end_date).getTime() < now).length;
    const pendingReq = db.projectRequests.filter((r) => r.status === "pending").length;
    const newMsgs = db.contactMessages.filter((m) => (now - new Date(m.created_at).getTime()) / 86400000 < 7).length;
    return { pending, inProg, done, total: tasks.length, revUsd, expUsd, revEgp, expEgp, netUsd: revUsd - expUsd, netEgp: revEgp - expEgp, words, overdue, pendingReq, newMsgs, clients: db.clients.length, freelancers: db.freelancers.length };
  }, [db]);

  // upcoming deadlines (active tasks sorted by end date)
  const deadlines = useMemo(() => db.tasks
    .filter((t) => !t.isDeleted && t.status !== "completed" && t.end_date)
    .sort((a, b) => new Date(a.end_date) - new Date(b.end_date))
    .slice(0, 5), [db.tasks]);

  // recent activity feed (mix of tasks + requests + messages)
  const activity = useMemo(() => {
    const items = [];
    db.tasks.filter((t) => !t.isDeleted).forEach((t) => items.push({ ts: t.created_at, icon: "tasks", tone: "primary", text: <>New task <strong>{t.task_number}</strong> for {t.client_code}</>, go: () => go("task", { id: t.id }) }));
    db.projectRequests.forEach((r) => items.push({ ts: r.created_at, icon: "file-dollar", tone: "warn", text: <>Price request <strong>{r.project_name}</strong></>, go: () => go("request", { id: r.id }) }));
    db.contactMessages.forEach((m) => items.push({ ts: m.created_at, icon: "mail", tone: "info", text: <>Message from <strong>{m.name}</strong></>, go: () => go("messages") }));
    return items.sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 6);
  }, [db, go]);

  const me = currentUser(db);
  const today = fmtDate(new Date());

  // ---- Finance Overview — professional totals (USD), live from data ----
  // Revenue / Expenses come from the Projects Ledger (+ Maintenance op-ex),
  // matching the Finance Dashboard. Invoice totals + paid amounts come from
  // the Client / Freelancer Invoice ledgers.
  const fin = useMemo(() => {
    const EGP_PER_USD = 50;
    const toUSD = (a, c) => (c === "EGP" ? (+a || 0) / EGP_PER_USD : (+a || 0));
    const prj = db.projects || [];
    const num = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));
    const revenue = prj.reduce((s, p) => s + num(p.volume) * num(p.client_rate), 0);
    const prjExp = prj.reduce((s, p) => s + num(p.volume) * num(p.fl_rate), 0);
    const mntExp = (db.maintenance || []).reduce((s, m) => s + toUSD(m.amount, m.currency), 0);
    const payExp = (db.payroll || []).filter((p) => p.status === "Paid").reduce((s, p) => s + toUSD(p.salary, p.currency), 0);
    const expenses = prjExp + mntExp + payExp;
    const ci = db.clientInvoices || [];
    const fi = db.freelancerInvoices || [];
    const sum = (arr) => arr.reduce((s, x) => s + toUSD(x.total_price, x.currency), 0);
    const sumPaid = (arr) => arr.filter((x) => x.status === "completed").reduce((s, x) => s + toUSD(x.total_price, x.currency), 0);
    const clientUsd = sum(ci), flUsd = sum(fi);
    const paidClient = sumPaid(ci), paidFl = sumPaid(fi);
    return {
      revenue, expenses, net: revenue - expenses,
      clientUsd, flUsd, paidClient, paidFl,
      clientCount: ci.length, flCount: fi.length,
      paidClientCount: ci.filter((x) => x.status === "completed").length,
      paidFlCount: fi.filter((x) => x.status === "completed").length,
    };
  }, [db]);

  // ---- Company Capital — live from the same engine as Finance ▸ Company
  // Capital (single source of truth, base currency EGP). No duplicate math. ----
  const cap = useMemo(() => (window.Capital ? window.Capital.compute() : null), [db.capitalLedger, db.freelancerInvoices, db.projects]);

  const stats = [
    { label: "Active Tasks", num: k.inProg + k.pending, ic: "tasks", tone: "primary", trend: "up", trendVal: "+2", foot: `${k.inProg} in progress`, spark: [3,5,4,6,5,7,6], go: () => go("tasks") },
    { label: "Freelancers", num: k.freelancers, ic: "users", tone: "info", trend: "flat", trendVal: "0", foot: "on the roster", spark: [4,4,5,5,5,6,6], go: () => go("freelancers") },
    { label: "Employees", num: db.employees.length, ic: "id", tone: "ok", trend: "flat", trendVal: "0", foot: "internal team", spark: [3,3,4,4,5,5,5], go: () => go("employees") },
    { label: "Clients", num: k.clients, ic: "address-book", tone: "warn", trend: "flat", trendVal: "0", foot: "active accounts", spark: [5,5,5,6,5,5,6], go: () => go("clients") },
  ];

  const attn = [
    { num: k.overdue, label: "Overdue tasks", ic: "clock", tone: "danger", go: () => go("tasks") },
    { num: k.pendingReq, label: "Pending price requests", ic: "file-dollar", tone: "warn", go: () => go("requests") },
    { num: k.newMsgs, label: "New messages this week", ic: "mail", tone: "info", go: () => go("messages") },
  ];

  return (
    <div className="fade-in">
      {/* hero */}
      <div className="home-hero">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="home-hero__date">{today}</div>
          <h1 className="home-hero__title">Welcome, {(me.name || "").split(/\s+/)[0] || me.name}</h1>
          {me.email ? <div className="home-hero__email">{me.email}</div> : null}
          <p className="home-hero__sub">Here's what's moving across the studio. You have {k.inProg + k.pending} active {k.inProg + k.pending === 1 ? "task" : "tasks"} and {k.pendingReq} {k.pendingReq === 1 ? "request" : "requests"} waiting.</p>
        </div>
      </div>

      {/* needs attention */}
      <div className="attention-grid stagger">
        {attn.map((a) => (
          <button className="attn" key={a.label} onClick={a.go}>
            <span className={`attn__ic ic-${a.tone}`}><Icon name={a.ic} size={23} /></span>
            <span>
              <span className="attn__num" style={{ color: a.num > 0 ? `var(--${a.tone === "danger" ? "danger" : a.tone === "warn" ? "warn" : "info"})` : "var(--ink-3)" }}>{a.num}</span>
              <span className="attn__label">{a.label}</span>
            </span>
            <Icon name="arrow-right" size={19} className="attn__go" />
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="stat-grid stagger">
        {stats.map((s) => {
          const max = Math.max(...s.spark);
          return (
            <div className="stat" key={s.label} onClick={s.go} style={s.go ? { cursor: "pointer" } : undefined}>
              <div className="stat__top">
                <div className={`stat__ic ic-${s.tone}`}><Icon name={s.ic} size={24} /></div>
                <span className={`stat__trend ${s.trend}`}><Icon name={s.trend === "up" ? "arrow-up" : s.trend === "down" ? "arrow-down" : "arrow-right"} size={13} />{s.trendVal}</span>
              </div>
              <div className="stat__label">{s.label}</div>
              <div className="stat__num" style={s.big ? { fontSize: 26 } : undefined}>{s.num}{s.unit ? <small>{s.unit}</small> : null}</div>
              <div className="spark">{s.spark.map((v, i) => <span key={i} className={i === s.spark.length - 1 ? "hi" : ""} style={{ height: `${(v / max) * 100}%` }}></span>)}</div>
            </div>
          );
        })}
      </div>

      {/* finance overview — removed per request */}
      {false && (
      <Card style={{ marginBottom: 22 }}>
        <div className="card__head">
          <div><h3 className="card__title">Finance Overview</h3><p className="card__sub">Live from Client &amp; Freelancer Invoices and Expenses</p></div>
          <button className="btn btn--link" onClick={() => go("client-invoices")}>Open finance</button>
        </div>
        <div className="card__body">
          <div className="fin-grid">
            <button className="fin-card" onClick={() => go("finance-dashboard")}>
              <span className="fin-card__ic ic-ok"><Icon name="arrow-down" size={20} /></span>
              <span className="fin-card__k">Revenue Total</span>
              <span className="fin-card__v t-ok">{money(fin.revenue, "USD")}</span>
              <span className="fin-card__s">from projects ledger</span>
            </button>
            <button className="fin-card" onClick={() => go("finance-dashboard")}>
              <span className="fin-card__ic ic-danger"><Icon name="arrow-up" size={20} /></span>
              <span className="fin-card__k">Expenses Total</span>
              <span className="fin-card__v" style={{ color: "var(--danger,#e0566b)" }}>{money(fin.expenses, "USD")}</span>
              <span className="fin-card__s">freelancer + maintenance</span>
            </button>
            <button className="fin-card" onClick={() => go("client-invoices")}>
              <span className="fin-card__ic ic-info"><Icon name="file-invoice" size={20} /></span>
              <span className="fin-card__k">Client Invoices</span>
              <span className="fin-card__v">{money(fin.clientUsd, "USD")}</span>
              <span className="fin-card__s">{fin.clientCount} invoice{fin.clientCount === 1 ? "" : "s"}</span>
            </button>
            <button className="fin-card" onClick={() => go("freelancer-invoices")}>
              <span className="fin-card__ic ic-primary"><Icon name="file-invoice" size={20} /></span>
              <span className="fin-card__k">Freelancer Invoices</span>
              <span className="fin-card__v">{money(fin.flUsd, "USD")}</span>
              <span className="fin-card__s">{fin.flCount} invoice{fin.flCount === 1 ? "" : "s"}</span>
            </button>
            <button className="fin-card" onClick={() => go("client-invoices")}>
              <span className="fin-card__ic ic-ok"><Icon name="check" size={20} /></span>
              <span className="fin-card__k">Paid Client Invoices</span>
              <span className="fin-card__v t-ok">{money(fin.paidClient, "USD")}</span>
              <span className="fin-card__s">{fin.paidClientCount} of {fin.clientCount} paid</span>
            </button>
            <button className="fin-card" onClick={() => go("freelancer-invoices")}>
              <span className="fin-card__ic ic-ok"><Icon name="check" size={20} /></span>
              <span className="fin-card__k">Paid Freelancer Invoices</span>
              <span className="fin-card__v t-ok">{money(fin.paidFl, "USD")}</span>
              <span className="fin-card__s">{fin.paidFlCount} of {fin.flCount} paid</span>
            </button>
          </div>

          {cap ? (
            <div className="cap-overview">
              <div className="cap-overview__head">
                <span className="cap-overview__title">Company Capital <span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>· base EGP</span></span>
                <button className="btn btn--link" onClick={() => go("capital")}>Open capital</button>
              </div>
              <div className="fin-grid">
                <button className="fin-card" onClick={() => go("capital")}>
                  <span className="fin-card__ic ic-primary"><Icon name="bank" size={20} /></span>
                  <span className="fin-card__k">Current Total Capital</span>
                  <span className="fin-card__v">{money(cap.total, "EGP")}</span>
                  <span className="fin-card__s">all posted transactions</span>
                </button>
                <button className="fin-card" onClick={() => go("capital")}>
                  <span className={`fin-card__ic ${cap.available >= 0 ? "ic-ok" : "ic-danger"}`}><Icon name="wallet" size={20} /></span>
                  <span className="fin-card__k">Available Balance</span>
                  <span className="fin-card__v" style={{ color: cap.available >= 0 ? "var(--ok)" : "var(--danger,#e0566b)" }}>{money(cap.available, "EGP")}</span>
                  <span className="fin-card__s">reserves excluded</span>
                </button>
                <button className="fin-card" onClick={() => go("capital")}>
                  <span className="fin-card__ic ic-ok"><Icon name="arrow-down" size={20} /></span>
                  <span className="fin-card__k">Total Cash In</span>
                  <span className="fin-card__v t-ok">{money(cap.cashIn, "EGP")}</span>
                  <span className="fin-card__s">incoming to date</span>
                </button>
                <button className="fin-card" onClick={() => go("capital")}>
                  <span className="fin-card__ic ic-danger"><Icon name="arrow-up" size={20} /></span>
                  <span className="fin-card__k">Total Cash Out</span>
                  <span className="fin-card__v" style={{ color: "var(--danger,#e0566b)" }}>{money(cap.cashOut, "EGP")}</span>
                  <span className="fin-card__s">outgoing to date</span>
                </button>
                <button className="fin-card" onClick={() => go("projects")}>
                  <span className="fin-card__ic ic-warn"><Icon name="clock" size={20} /></span>
                  <span className="fin-card__k">Remaining Due</span>
                  <span className="fin-card__v">{money(cap.remainingDue, "EGP")}</span>
                  <span className="fin-card__s">outstanding client receivables</span>
                </button>
              </div>
            </div>
          ) : null}

          <div className="fin-break">
            <div className="summary-row"><span className="summary-row__k">Revenue total</span><span className="summary-row__v t-ok">{money(fin.revenue, "USD")}</span></div>
            <div className="summary-row"><span className="summary-row__k">Expenses total</span><span className="summary-row__v" style={{ color: "var(--danger,#e0566b)" }}>{money(fin.expenses, "USD")}</span></div>
            <div className="summary-row"><span className="summary-row__k">Net balance</span><span className="summary-row__v" style={{ color: fin.net >= 0 ? "var(--ok)" : "var(--danger,#e0566b)" }}>{money(fin.net, "USD")}</span></div>
          </div>
        </div>
      </Card>
      )}

      {/* deadlines + activity */}
      <div className="home-cols" style={{ marginBottom: 0 }}>
        <Card>
          <div className="card__head"><h3 className="card__title">Upcoming deadlines</h3><button className="btn btn--link" onClick={() => go("tasks")}>All tasks</button></div>
          <div className="card__body" style={{ paddingTop: 8, paddingBottom: 8 }}>
            {deadlines.length === 0 ? <p className="muted" style={{ textAlign: "center", padding: 30 }}>No upcoming deadlines.</p> :
              deadlines.map((t) => {
                const dt = new Date(t.end_date);
                const days = Math.ceil((dt - Date.now()) / 86400000);
                const soon = days <= 2;
                const client = db.clients.find((c) => c.client_code === t.client_code);
                return (
                  <div className="deadline-row" key={t.id} onClick={() => go("task", { id: t.id })} style={{ cursor: "pointer" }}>
                    <div className={`deadline-row__day${soon ? " soon" : ""}`}>
                      <div className="d">{dt.getDate()}</div>
                      <div className="m">{dt.toLocaleDateString("en-US", { month: "short" })}</div>
                    </div>
                    <div className="deadline-row__main">
                      <div className="deadline-row__title">{t.task_number} · {client ? client.name : t.client_code}</div>
                      <div className="deadline-row__meta">{t.words_count || "—"} words · {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "due today" : `in ${days}d`}</div>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                );
              })}
          </div>
        </Card>

        <Card>
          <div className="card__head"><h3 className="card__title">Recent activity</h3></div>
          <div className="card__body" style={{ paddingTop: 8, paddingBottom: 8 }}>
            {activity.map((a, i) => (
              <div className="deadline-row" key={i} onClick={a.go} style={{ cursor: "pointer" }}>
                <span className={`attn__ic ic-${a.tone}`} style={{ width: 38, height: 38, borderRadius: 11 }}><Icon name={a.icon} size={18} /></span>
                <div className="deadline-row__main">
                  <div style={{ fontSize: 14 }}>{a.text}</div>
                  <div className="deadline-row__meta">{fromNow(a.ts)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function BarChart({ data }) {
  if (!data.length) return <p className="muted">No data.</p>;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 28, height: 180, padding: "0 4px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 7, height: "100%", width: "100%", justifyContent: "center" }}>
            <div title={money(d.rev, "USD")} style={{ width: 28, height: `${Math.max(4, (d.rev / d.max) * 100)}%`, borderRadius: "8px 8px 0 0", background: "linear-gradient(180deg, var(--accent), var(--accent-2))", transition: "height .6s var(--ease)" }}></div>
            <div title={money(d.exp, "USD")} style={{ width: 28, height: `${Math.max(4, (d.exp / d.max) * 100)}%`, borderRadius: "8px 8px 0 0", background: "var(--ink-4)", opacity: .5, transition: "height .6s var(--ease)" }}></div>
          </div>
          <span className="cell-mono muted" style={{ fontSize: 11 }}>{d.month}</span>
        </div>
      ))}
    </div>
  );
}

function Donut({ pending, inProg, done }) {
  const total = Math.max(1, pending + inProg + done);
  const segs = [
    { v: done, c: "var(--ok)", label: "Completed" },
    { v: inProg, c: "var(--info)", label: "In Progress" },
    { v: pending, c: "var(--warn)", label: "Pending" },
  ];
  const R = 54, C = 2 * Math.PI * R; let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap", justifyContent: "center" }}>
      <svg width="148" height="148" viewBox="0 0 140 140" style={{ flex: "0 0 auto" }}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--line)" strokeWidth="17" />
        {segs.map((s, i) => {
          const len = (s.v / total) * C;
          const el = <circle key={i} cx="70" cy="70" r={R} fill="none" stroke={s.c} strokeWidth="17" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} strokeLinecap="round" transform="rotate(-90 70 70)" style={{ transition: "stroke-dasharray .7s var(--ease)" }} />;
          offset += len; return el;
        })}
        <text x="70" y="65" textAnchor="middle" style={{ font: "800 28px var(--display)", fill: "var(--ink)" }}>{total}</text>
        <text x="70" y="84" textAnchor="middle" style={{ font: "500 11px var(--mono)", fill: "var(--ink-4)", letterSpacing: "0.1em" }}>TASKS</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 13, minWidth: 130 }}>
        {segs.map((s) => (
          <div key={s.label} className="flex items-center gap-12">
            <span style={{ width: 11, height: 11, borderRadius: 4, background: s.c }}></span>
            <span style={{ fontSize: 14 }}>{s.label}</span>
            <span style={{ fontWeight: 800, marginInlineStart: "auto", fontSize: 16 }}>{s.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Home });
