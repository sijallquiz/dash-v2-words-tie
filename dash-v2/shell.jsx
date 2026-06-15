/* global React, Icon, initials, useDB */
const { useState: useStateS, useEffect: useEffectS, useContext, createContext, useCallback: useCbS, useRef: useRefS, useMemo: useMemoS } = React;

// ====================================================================
// ROUTER
// ====================================================================
const RouterCtx = createContext(null);
const useRouter = () => useContext(RouterCtx);

function RouterProvider({ children }) {
  const [route, setRoute] = useStateS(() => {
    try { return JSON.parse(localStorage.getItem("wt_route")) || { name: "home", params: {} }; }
    catch (e) { return { name: "home", params: {} }; }
  });
  const go = useCbS((name, params = {}) => {
    setRoute({ name, params });
    try { localStorage.setItem("wt_route", JSON.stringify({ name, params })); } catch (e) {}
    const sc = document.querySelector(".content"); if (sc) sc.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, []);
  return <RouterCtx.Provider value={{ route, go }}>{children}</RouterCtx.Provider>;
}

// ====================================================================
// NAV CONFIG
// ====================================================================
const NAV = [
  { type: "head", label: "Workspace" },
  { name: "home", label: "Home", icon: "home" },
  { name: "tasks", label: "Tasks", icon: "tasks", match: ["tasks", "task", "task-new", "task-edit"] },
  { name: "freelancers", label: "Freelancers", icon: "users", match: ["freelancers", "freelancer", "freelancer-new", "freelancer-edit"] },
  { name: "clients", label: "Clients", icon: "address-book", match: ["clients", "client", "client-new", "client-edit"] },
  { name: "employees", label: "Employees", icon: "id", match: ["employees", "employee", "employee-new", "employee-edit"] },
  { name: "calculator", label: "Calculator", icon: "calculator", match: ["calculator"] },
  { name: "client-portal", label: "Client Portal", icon: "world", match: ["client-portal"] },

  { type: "head", label: "Receivables" },
  { name: "finance-dashboard", label: "Finance", icon: "wallet", match: ["finance", "finance-dashboard", "invoices", "client-invoices", "freelancer-invoices", "client-invoice", "freelancer-invoice", "projects", "project", "payroll", "maintenance", "capital"],
    flat: [
      { name: "finance-dashboard", label: "Dashboard", icon: "briefcase" },
      { name: "client-invoices", label: "Client Invoices", icon: "file-invoice" },
      { name: "freelancer-invoices", label: "Freelancer Invoices", icon: "file-invoice" },
      { name: "projects", label: "Projects Ledger", icon: "briefcase" },
      { name: "payroll", label: "Payroll", icon: "wallet" },
      { name: "maintenance", label: "Maintenance", icon: "settings" },
      { name: "capital", label: "Company Capital", icon: "bank" },
    ] },
  { name: "requests", label: "Price Requests", icon: "file-dollar", match: ["requests", "request"], badgeKey: "pendingRequests" },
  { name: "messages", label: "Contact Messages", icon: "mail", match: ["messages", "message"], badgeKey: "newMessages" },

  { type: "head", label: "Configuration" },
  { name: "system", label: "System Management", icon: "shield", match: ["system", "users", "user-new", "user-edit", "roles", "role-new", "role-edit"] },
];

function isActive(item, routeName) {
  if (item.match) return item.match.includes(routeName);
  return item.name === routeName;
}
// Which permission(s) gate each sidebar item. Any-of: item shows if the acting
// role has at least one. Items not listed are always visible.
const NAV_VIEW_PERM = {
  home: ["View Home"],
  tasks: ["View Task"],
  freelancers: ["View Freelancer"],
  clients: ["View Client"],
  employees: ["View Employee"],
  calculator: ["View Calculator"],
  "client-portal": ["View Client Portal", "Preview Client Portal as Admin"],
  "finance-dashboard": ["View Finance", "View Client Invoices", "View Freelancer Invoices", "View Projects Ledger", "View Payroll", "View Maintenance", "View Company Capital"],
  requests: ["View Project Request"],
  messages: ["View Contact Message"],
  system: ["View User", "View Role"],
};
// page-title lookup for the topbar
const PAGE_INFO = {
  home: ["Workspace", "Home"], tasks: ["Workspace", "Tasks"], task: ["Workspace", "Task Details"],
  "task-new": ["Workspace", "New Task"], "task-edit": ["Workspace", "Edit Task"],
  freelancers: ["Workspace", "Freelancers"], freelancer: ["Workspace", "Freelancer"],
  clients: ["Workspace", "Clients"], client: ["Workspace", "Client"],
  employees: ["Workspace", "Employees"], employee: ["Workspace", "Employee"],
  calculator: ["Workspace", "Quote Calculator"],
  "client-portal": ["Workspace", "Client Portal"],
  "finance-dashboard": ["Receivables", "Finance Dashboard"], maintenance: ["Receivables", "Maintenance"], "maintenance-item": ["Receivables", "Maintenance"], payroll: ["Receivables", "Payroll"],
  invoices: ["Receivables", "Invoices"], "client-invoices": ["Receivables", "Client Invoices"], "freelancer-invoices": ["Receivables", "Freelancer Invoices"], "client-invoice": ["Receivables", "Client Invoice"], "freelancer-invoice": ["Receivables", "Freelancer Invoice"], projects: ["Receivables", "Projects Ledger"], project: ["Receivables", "Project"], payments: ["Receivables", "Payments"], revenues: ["Receivables", "Revenues"], expenses: ["Receivables", "Expenses"], capital: ["Receivables", "Company Capital"],
  requests: ["Workspace", "Price Requests"], request: ["Workspace", "Price Request"],
  messages: ["Workspace", "Contact Messages"], message: ["Workspace", "Message"],
  system: ["Configuration", "System Management"], users: ["Configuration", "System Management"], roles: ["Configuration", "System Management"],
};

// ====================================================================
// SIDEBAR
// ====================================================================
function Sidebar({ open, onClose, collapsed, onToggleCollapse, badges }) {
  const { route, go } = useRouter();
  const [db] = useDB();
  const me = currentUser(db);
  const [openGroups, setOpenGroups] = useStateS(() => {
    const init = {};
    NAV.forEach((it) => { if (it.group) init[it.name] = it.children.some((c) => isActive(c, route.name)); });
    return init;
  });
  const [userMenu, setUserMenu] = useStateS(false);
  const [profileOpen, setProfileOpen] = useStateS(false);
  const userRef = useRefS(null);
  useEffectS(() => {
    setOpenGroups((g) => { const n = { ...g }; NAV.forEach((it) => { if (it.group && it.children.some((c) => isActive(c, route.name))) n[it.name] = true; }); return n; });
  }, [route.name]);
  useEffectS(() => {
    const onDoc = (e) => { if (userRef.current && !userRef.current.contains(e.target)) setUserMenu(false); };
    document.addEventListener("mousedown", onDoc); return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const nav = (name) => { go(name); onClose && onClose(); };

  // Hide sidebar items the acting role can't view; drop section heads left empty.
  const visibleNav = useMemoS(() => {
    const shown = NAV.filter((item) => item.type === "head" || !NAV_VIEW_PERM[item.name] || canAny(db, NAV_VIEW_PERM[item.name]));
    return shown.filter((item, idx) => item.type !== "head" || (shown[idx + 1] && shown[idx + 1].type !== "head"));
  }, [db]);

  return (
    <>
      {open ? <div className="scrim-mobile" onClick={onClose}></div> : null}
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="sidebar__inner">
          <div className="sidebar__brand">
            {!collapsed ? <>
              <img src={window.__resources?.logoLight || "assets/logo.png"} className="logo-light" alt="Words Tie" />
              <img src={window.__resources?.logoDark || "assets/logo-white.png"} className="logo-dark" alt="Words Tie" />
            </> : <span className="avatar" style={{ width: 34, height: 34, borderRadius: 11 }}>WT</span>}
            <button className="sidebar__collapse" onClick={onToggleCollapse} title={collapsed ? "Expand" : "Collapse"}>
              <Icon name={collapsed ? "chevron-right" : "arrow-left"} size={17} />
            </button>
          </div>

          <div className="sidebar__scroll">
            {visibleNav.map((item, i) => {
              if (item.type === "head") return <div className="nav-head" key={i}>{item.label}</div>;
              if (item.group) {
                const groupActive = item.children.some((c) => isActive(c, route.name));
                const isOpen = openGroups[item.name];
                return (
                  <div key={i}>
                    <button data-tip={item.label} className={`nav-item${groupActive ? " active" : ""}${isOpen && !collapsed ? " open" : ""}`}
                      onClick={() => { if (collapsed) { nav(item.children[0].name); } else { setOpenGroups((g) => ({ ...g, [item.name]: !g[item.name] })); } }}>
                      <span className="nav-item__ic"><Icon name={item.icon} size={21} /></span>
                      <span className="nav-item__label">{item.label}</span>
                      <span className="nav-item__chev"><Icon name="chevron-right" size={16} /></span>
                    </button>
                    {isOpen && !collapsed ? (
                      <div className="nav-sub">
                        {item.children.map((c) => (
                          <button key={c.name} className={`nav-item${isActive(c, route.name) ? " active" : ""}`} onClick={() => nav(c.name)}>
                            <span className="nav-item__ic"><Icon name={c.icon} size={17} /></span>
                            <span className="nav-item__label">{c.label}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }
              const bdg = item.badgeKey ? badges[item.badgeKey] : 0;
              return (
                <button key={i} data-tip={item.label} className={`nav-item${isActive(item, route.name) ? " active" : ""}`} onClick={() => nav(item.name)}>
                  <span className="nav-item__ic"><Icon name={item.icon} size={21} /></span>
                  <span className="nav-item__label">{item.label}</span>
                  {bdg ? <span className="nav-badge">{bdg}</span> : null}
                </button>
              );
            })}
          </div>

          <div className="sidebar__user" ref={userRef} onClick={() => setUserMenu((o) => !o)} style={{ cursor: "pointer" }}>
            <span className="avatar avatar--online">{initials(me.name)}</span>
            <span className="sidebar__user-meta">
              <span className="sidebar__user-name">{me.name}</span>
              <span className="sidebar__user-role">{me.role}</span>
            </span>
            <Icon name="dots" size={18} className="sidebar__user-chev" />
            {userMenu ? (
              <div className="menu-pop menu-pop--up" style={{ insetInlineStart: 10, insetInlineEnd: 10 }} onClick={(e) => e.stopPropagation()}>
                <div className="menu-pop__head"><span className="avatar" style={{ width: 38, height: 38 }}>{initials(me.name)}</span><div><div style={{ fontWeight: 700, fontSize: 14 }}>{me.name}</div><div className="muted" style={{ fontSize: 12 }}>{me.email}</div></div></div>
                <button className="menu-pop__item" onClick={() => { setProfileOpen(true); setUserMenu(false); }}><Icon name="user-check" size={18} /> My Profile</button>
                <div className="menu-pop__div"></div>
                <button className="menu-pop__item danger"><Icon name="logout" size={18} /> Log Out</button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
      {profileOpen ? <ProfileModal me={me} onClose={() => setProfileOpen(false)} /> : null}
    </>
  );
}

// ====================================================================
// TOPBAR  (page-aware)
// ====================================================================
function Topbar({ onMenu, theme, setTheme, onOpenCmd }) {
  const { route } = useRouter();
  const [crumb, title] = PAGE_INFO[route.name] || ["Workspace", "Home"];
  return (
    <header className="topbar">
      <button className="topbar__menu" onClick={onMenu}><Icon name="menu" size={22} /></button>
      <div className="topbar__head">
        <div className="topbar__crumb">{crumb}</div>
        <div className="topbar__title">{title}</div>
      </div>
      <div className="topbar__spacer"></div>
      <button className="cmdk" onClick={onOpenCmd}>
        <Icon name="search" size={18} />
        <span>Search or jump to…</span>
        <kbd>⌘K</kbd>
      </button>
      <div className="topbar__actions">
        <button className="icon-btn" title="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
        </button>
        <button className="icon-btn" title="Notifications"><Icon name="bell" size={20} /><span className="icon-btn__dot"></span></button>
      </div>
    </header>
  );
}

// ====================================================================
// MY PROFILE  (account + password change)
// ====================================================================
function ProfileModal({ me, onClose }) {
  const [pw, setPw] = useStateS({ current: "", next: "", confirm: "" });
  const set = (k, v) => setPw((p) => ({ ...p, [k]: v }));
  const submit = () => {
    if (!pw.current.trim()) { toast("Current password is required", "info"); return; }
    if (me.password && pw.current !== me.password) { toast("Current password is incorrect", "info"); return; }
    if (!pw.next.trim()) { toast("New password is required", "info"); return; }
    if (pw.next.length < 6) { toast("New password must be at least 6 characters", "info"); return; }
    if (pw.next !== pw.confirm) { toast("New passwords do not match", "info"); return; }
    DB.update("users", me.id, { password: pw.next });
    toast("Your password has been updated.");
    onClose();
  };
  return (
    <Modal title="My Profile" onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Close</Btn>
      <Btn variant="primary" icon="check" onClick={submit}>Update Password</Btn>
    </>}>
      <div className="flex items-center gap-12" style={{ marginBottom: 18 }}>
        <span className="avatar" style={{ width: 48, height: 48, fontSize: 16 }}>{initials(me.name)}</span>
        <div><div style={{ fontWeight: 800, fontSize: 16 }}>{me.name}</div><div className="muted" style={{ fontSize: 13 }}>{me.email}</div></div>
      </div>
      <div className="kv" style={{ marginBottom: 20 }}>
        <div><span className="kv__k">Role</span><span className="kv__v">{me.role || "—"}</span></div>
        <div><span className="kv__k">Status</span><span className="kv__v" style={{ textTransform: "capitalize" }}>{me.status || "—"}</span></div>
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-4)", fontWeight: 600, margin: "4px 0 12px", paddingBottom: 8, borderBottom: "1px solid var(--line-2)" }}>Change Password</div>
      <div className="form-grid">
        <Field label="Current Password" required span={12}><Input type="password" value={pw.current} onChange={(e) => set("current", e.target.value)} autoComplete="current-password" /></Field>
        <Field label="New Password" required hint="At least 6 characters"><Input type="password" value={pw.next} onChange={(e) => set("next", e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Confirm New Password" required><Input type="password" value={pw.confirm} onChange={(e) => set("confirm", e.target.value)} autoComplete="new-password" /></Field>
      </div>
    </Modal>
  );
}

Object.assign(window, { RouterProvider, useRouter, NAV, PAGE_INFO, Sidebar, Topbar, ProfileModal });
