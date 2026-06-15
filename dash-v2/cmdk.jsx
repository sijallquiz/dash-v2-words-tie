/* global React, useDB, useRouter, Icon, NAV */
const { useState: useKS, useEffect: useKE, useMemo: useKM, useRef: useKR } = React;

// ====================================================================
// COMMAND PALETTE (⌘K) — jump to pages + search records
// ====================================================================
function CommandPalette({ onClose }) {
  const [db] = useDB();
  const { go } = useRouter();
  const [q, setQ] = useKS("");
  const [sel, setSel] = useKS(0);
  const inputRef = useKR(null);

  useKE(() => { inputRef.current && inputRef.current.focus(); }, []);
  useKE(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // build flat nav targets
  const navTargets = useKM(() => {
    const t = [];
    NAV.forEach((it) => {
      if (it.type === "head") return;
      if (it.group) it.children.forEach((c) => t.push({ type: "Go to", label: c.label, icon: c.icon, go: () => go(c.name) }));
      else { t.push({ type: "Go to", label: it.label, icon: it.icon, go: () => go(it.name) });
        if (it.flat) it.flat.forEach((c) => t.push({ type: "Go to", label: c.label, icon: c.icon, go: () => go(c.name) })); }
    });
    return t;
  }, [go]);

  const results = useKM(() => {
    const ql = q.trim().toLowerCase();
    const groups = [];
    // pages
    const pages = navTargets.filter((t) => !ql || t.label.toLowerCase().includes(ql));
    if (pages.length) groups.push({ name: "Navigation", items: pages.slice(0, ql ? 6 : 99) });
    if (ql) {
      const tasks = db.tasks.filter((x) => `${x.task_number} ${x.client_code} ${x.creator}`.toLowerCase().includes(ql)).slice(0, 5)
        .map((x) => ({ type: "Task", label: x.task_number, sub: x.client_code, icon: "tasks", go: () => go("task", { id: x.id }) }));
      const clients = db.clients.filter((x) => `${x.name} ${x.client_code} ${x.email}`.toLowerCase().includes(ql)).slice(0, 5)
        .map((x) => ({ type: "Client", label: x.name, sub: x.client_code, icon: "address-book", go: () => go("client", { id: x.id }) }));
      const frs = db.freelancers.filter((x) => `${x.name} ${x.freelancer_code} ${x.email}`.toLowerCase().includes(ql)).slice(0, 5)
        .map((x) => ({ type: "Freelancer", label: x.name, sub: x.freelancer_code, icon: "users", go: () => go("freelancer", { id: x.id }) }));
      const reqs = db.projectRequests.filter((x) => `${x.project_name} ${x.first_name} ${x.last_name} ${x.email}`.toLowerCase().includes(ql)).slice(0, 5)
        .map((x) => ({ type: "Request", label: x.project_name, sub: `${x.first_name} ${x.last_name}`, icon: "file-dollar", go: () => go("request", { id: x.id }) }));
      if (tasks.length) groups.push({ name: "Tasks", items: tasks });
      if (clients.length) groups.push({ name: "Clients", items: clients });
      if (frs.length) groups.push({ name: "Freelancers", items: frs });
      if (reqs.length) groups.push({ name: "Price Requests", items: reqs });
    }
    return groups;
  }, [q, db, navTargets, go]);

  const flat = useKM(() => results.flatMap((g) => g.items), [results]);
  useKE(() => { setSel(0); }, [q]);

  const run = (item) => { item.go(); onClose(); };
  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (flat[sel]) run(flat[sel]); }
  };

  let idx = -1;
  return (
    <div className="cmdk-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk-box">
        <div className="cmdk-search">
          <Icon name="search" size={21} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} placeholder="Search tasks, clients, freelancers, or jump to a page…" />
          <kbd>ESC</kbd>
        </div>
        <div className="cmdk-list">
          {flat.length === 0 ? <div className="cmdk-empty"><Icon name="search" size={34} style={{ opacity: .4, marginBottom: 10 }} /><div>No results for “{q}”</div></div> :
            results.map((g) => (
              <div key={g.name}>
                <div className="cmdk-group">{g.name}</div>
                {g.items.map((item) => {
                  idx++; const myIdx = idx;
                  return (
                    <button key={myIdx} className={`cmdk-item${myIdx === sel ? " sel" : ""}`} onMouseEnter={() => setSel(myIdx)} onClick={() => run(item)}>
                      <span className="cmdk-item__ic"><Icon name={item.icon} size={17} /></span>
                      <span>{item.label}</span>
                      {item.sub ? <span className="cmdk-item__sub">{item.sub}</span> : <span className="cmdk-item__sub">{item.type}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CommandPalette });
