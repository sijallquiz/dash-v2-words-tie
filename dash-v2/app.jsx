/* global React, ReactDOM, RouterProvider, useRouter, Sidebar, Topbar, ToastHost, useDB, CommandPalette,
   Home, Tasks, TaskDetail, TaskForm, Clients, ClientDetail, Freelancers, FreelancerDetail,
   Calculator, ProjectsLedger, ProjectDetail, Payments, FinanceDashboard, Maintenance, MaintenanceDetail,
   Employees, EmployeeDetail, Payroll, ClientPortal,
   Invoices, InvoiceDetailPage, MonthlyLedger, CompanyCapital, Requests, RequestDetail, Messages, MessageDetail, SystemManagement,
   useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor */
const { useState: useAS, useEffect: useAE, useMemo: useAM } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "tie",
  "dark": false,
  "density": "regular",
  "radius": "rounded"
}/*EDITMODE-END*/;

const ROUTES = {
  home: Home,
  tasks: Tasks, task: TaskDetail, "task-new": TaskForm, "task-edit": TaskForm,
  freelancers: Freelancers, freelancer: FreelancerDetail,
  clients: Clients, client: ClientDetail,
  employees: Employees, employee: EmployeeDetail,
  calculator: Calculator,
  "finance-dashboard": FinanceDashboard,
  maintenance: Maintenance, "maintenance-item": MaintenanceDetail,
  invoices: () => <Invoices view="client" />,
  "client-invoices": () => <Invoices view="client" />,
  "freelancer-invoices": () => <Invoices view="freelancer" />,
  "client-invoice": () => <InvoiceDetailPage side="client" />,
  "freelancer-invoice": () => <InvoiceDetailPage side="freelancer" />,
  projects: ProjectsLedger, project: ProjectDetail,
  payroll: Payroll,
  payments: Payments,
  revenues: FinanceDashboard,
  expenses: FinanceDashboard,
  capital: CompanyCapital,
  requests: Requests, request: RequestDetail,
  messages: Messages, message: MessageDetail,
  system: () => <SystemManagement tab="users" />,
  users: () => <SystemManagement tab="users" />,
  roles: () => <SystemManagement tab="roles" />,
  "client-portal": ClientPortal,
};

const ROUTE_VIEW_PERM = {
  tasks: ["View Task"], task: ["View Task"], "task-new": ["Create Task"], "task-edit": ["Update Task"],
  freelancers: ["View Freelancer"], freelancer: ["View Freelancer"],
  clients: ["View Client"], client: ["View Client"],
  employees: ["View Employee"], employee: ["View Employee"],
  calculator: ["View Calculator"],
  "finance-dashboard": ["View Finance"], revenues: ["View Finance"], expenses: ["View Finance"],
  invoices: ["View Client Invoices"], "client-invoices": ["View Client Invoices"], "client-invoice": ["View Client Invoices"],
  "freelancer-invoices": ["View Freelancer Invoices"], "freelancer-invoice": ["View Freelancer Invoices"],
  projects: ["View Projects Ledger"], project: ["View Projects Ledger"],
  payroll: ["View Payroll"], maintenance: ["View Maintenance"], "maintenance-item": ["View Maintenance"],
  capital: ["View Company Capital"],
  requests: ["View Project Request"], request: ["View Project Request"],
  messages: ["View Contact Message"], message: ["View Contact Message"],
  system: ["View User", "View Role"], users: ["View User"], roles: ["View Role"],
  "client-portal": ["View Client Portal", "Preview Client Portal as Admin"],
};

function AccessDenied({ onHome }) {
  return (
    <div className="fade-in access-denied">
      <div className="access-denied__ic"><Icon name="shield" size={30} /></div>
      <h2 style={{ fontFamily: "var(--display)", fontSize: 26, margin: "0 0 8px" }}>Access denied</h2>
      <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.55, margin: "0 0 22px" }}>Your role doesn’t have permission to view this page. If you believe this is a mistake, contact an administrator.</p>
      <Btn variant="primary" icon="home" onClick={onHome}>Back to Home</Btn>
    </div>
  );
}

function Shell() {
  const { route, go } = useRouter();
  const [db] = useDB();
  const acting = WT_getActingRole();
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [sideOpen, setSideOpen] = useAS(false);
  const [collapsed, setCollapsed] = useAS(() => localStorage.getItem("wt_collapsed") === "1");
  const [cmdOpen, setCmdOpen] = useAS(false);
  const theme = t.dark ? "dark" : "light";
  const setTheme = (v) => setTweak("dark", v === "dark");

  useAE(() => {
    const el = document.documentElement;
    el.setAttribute("data-theme", t.dark ? "dark" : "light");
    el.setAttribute("data-accent", t.accent);
    el.setAttribute("data-density", t.density);
    el.setAttribute("data-radius", t.radius);
  }, [t.dark, t.accent, t.density, t.radius]);

  useAE(() => { setSideOpen(false); }, [route.name, route.params.id]);
  useAE(() => { localStorage.setItem("wt_collapsed", collapsed ? "1" : "0"); }, [collapsed]);

  // ⌘K / Ctrl-K opens palette
  useAE(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const badges = useAM(() => ({
    pendingRequests: db.projectRequests.filter((r) => r.status === "pending").length,
    newMessages: db.contactMessages.filter((m) => (Date.now() - new Date(m.created_at).getTime()) / 86400000 < 7).length,
  }), [db]);

  const Page = ROUTES[route.name] || Home;
  const routePerms = ROUTE_VIEW_PERM[route.name];
  const allowed = !routePerms || canAny(db, routePerms);
  const previewing = acting && acting !== "Administrator";

  return (
    <div className={`app${collapsed ? " collapsed" : ""}`}>
      <Sidebar open={sideOpen} onClose={() => setSideOpen(false)}
        collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} badges={badges} />
      <div className="main">
        <Topbar onMenu={() => setSideOpen((o) => !o)} theme={theme} setTheme={setTheme} onOpenCmd={() => setCmdOpen(true)} />
        {previewing ? (
          <div className="preview-banner">
            <Icon name="eye" size={16} />
            <span>Previewing as <b>{acting}</b> — pages and actions are limited to this role’s permissions.</span>
            <button className="btn btn--soft btn--sm" onClick={() => WT_setActingRole(null)}><Icon name="arrow-left" size={15} /><span>Exit preview</span></button>
          </div>
        ) : null}
        <main className="content">{allowed ? <Page /> : <AccessDenied onHome={() => go("home")} />}</main>
      </div>
      <ToastHost />
      {cmdOpen ? <CommandPalette onClose={() => setCmdOpen(false)} /> : null}
      <TweaksPanel>
        <TweakSection label="Brand" />
        <TweakColor label="Accent" value={t.accent === "tie" ? "#1A6BFF" : "#C8941F"}
          options={["#1A6BFF", "#C8941F"]}
          onChange={(v) => setTweak("accent", v === "#1A6BFF" ? "tie" : "brand")} />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={["compact", "regular", "comfy"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakRadio label="Corners" value={t.radius} options={["sharp", "rounded", "soft"]}
          onChange={(v) => setTweak("radius", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <RouterProvider><Shell /></RouterProvider>
);
