/* global React, useDB, useRouter, DB, Icon, Btn, Badge, Card, PageHead, SearchField, Field, Input, Select, CheckCard, Table, EmptyRow, usePaginate, Pager, Modal, useConfirm, toast, initials, fmtDate, FullResetCard */
const { useState: useYS, useMemo: useYM } = React;

// ===================================================================
// SETTINGS
// ===================================================================
function Settings() {
  const [db] = useDB();
  const [draft, setDraft] = useYS(() => Object.fromEntries(db.settings.map((s) => [s.id, s.value])));
  const [dirty, setDirty] = useYS(false);
  React.useEffect(() => { setDraft(Object.fromEntries(db.settings.map((s) => [s.id, s.value]))); }, [db.settings]);
  const set = (id, v) => { setDraft((d) => ({ ...d, [id]: v })); setDirty(true); };
  const save = () => { DB.setKey("settings", db.settings.map((s) => ({ ...s, value: draft[s.id] }))); setDirty(false); toast("Settings saved"); };

  return (
    <div className="fade-in">
      <PageHead crumb={<span>Configuration · Settings</span>} title="Settings" sub="Global studio details used across the website and dashboard."
        actions={<Btn variant="primary" icon="check" onClick={save} className={dirty ? "" : ""} >{dirty ? "Save changes" : "Saved"}</Btn>} />
      <Card>
        <div className="card__head"><h3 className="card__title">General</h3><p className="card__sub">Contact information and defaults</p></div>
        <div className="card__body">
          <div className="form-grid">
            {db.settings.map((s) => (
              <Field key={s.id} label={s.label} span={s.type === "text" && s.label === "Address" ? 12 : undefined}>
                <Input type={s.type === "email" ? "email" : s.type === "url" ? "url" : "text"} value={draft[s.id] || ""} onChange={(e) => set(s.id, e.target.value)} />
              </Field>
            ))}
          </div>
        </div>
        <div className="card__foot" style={{ justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => { setDraft(Object.fromEntries(db.settings.map((s) => [s.id, s.value]))); setDirty(false); }}>Reset</Btn>
          <Btn variant="primary" icon="check" onClick={save}>Save changes</Btn>
        </div>
      </Card>

      <Card style={{ marginTop: 18 }}>
        <div className="card__head"><h3 className="card__title">Appearance & Data</h3></div>
        <div className="card__body">
          <div className="summary-row">
            <div><div style={{ fontWeight: 600 }}>Reset demo data</div><div className="muted" style={{ fontSize: 13 }}>Restore all tables to the original sample data.</div></div>
            <Btn variant="danger-soft" icon="trash" onClick={() => { if (confirm("Reset all dashboard data to defaults?")) { DB.reset(); toast("Data reset", "info"); } }}>Reset data</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ===================================================================
// SYSTEM MANAGEMENT — single page with Finance-style internal tabs
// ===================================================================
const SYS_TABS = [
  { name: "users", label: "Users", icon: "user" },
  { name: "roles", label: "Roles", icon: "users" },
];
function SystemTabs({ active }) {
  const { go } = useRouter();
  return (
    <div className="pill-tabs">
      {SYS_TABS.map((t) => (
        <button key={t.name} className={`pill-tab${active === t.name ? " on" : ""}`} onClick={() => go(t.name)}>
          <span className="flex items-center gap-8"><Icon name={t.icon} size={16} /> {t.label}</span>
        </button>
      ))}
    </div>
  );
}
function SystemManagement({ tab = "users" }) {
  const [db] = useDB();
  const active = tab === "roles" ? "roles" : "users";
  const [modal, setModal] = useYS(null);
  const canNew = active === "roles" ? can(db, "Create Role") : can(db, "Create User");
  return (
    <div className="fade-in">
      <PageHead crumb={<span>Configuration · System Management</span>} title="System Management"
        sub="Manage team access — users and permission roles."
        actions={canNew
          ? (active === "roles"
            ? <Btn variant="primary" icon="plus" onClick={() => setModal({ kind: "role", mode: "new" })}>New Role</Btn>
            : <Btn variant="primary" icon="plus" onClick={() => setModal({ kind: "user", mode: "new" })}>New User</Btn>)
          : null} />
      <SystemTabs active={active} />
      {active === "roles"
        ? <RolesBody modal={modal && modal.kind === "role" ? modal : null} setModal={setModal} />
        : <UsersBody modal={modal && modal.kind === "user" ? modal : null} setModal={setModal} />}
      <FullResetCard />
    </div>
  );
}

// ===================================================================
// USERS
// ===================================================================
function UsersBody({ modal, setModal }) {
  const [db] = useDB();
  const [confirm, confirmNode] = useConfirm();
  const [q, setQ] = useYS("");
  const filtered = useYM(() => db.users.filter((u) => !q || `${u.name} ${u.email} ${u.role} ${fmtDate(u.created_at)}`.toLowerCase().includes(q.toLowerCase())), [db.users, q]);
  const { page, setPage, pages, slice, total } = usePaginate(filtered, 8);
  const del = async (u) => { if (await confirm({ title: "Delete user?", message: `Remove ${u.name}?`, danger: true, okLabel: "Delete" })) { DB.remove("users", u.id); toast("User deleted", "del"); } };

  return (
    <>
      {confirmNode}
      <Card>
        <div className="card__head"><SearchField value={q} onChange={setQ} placeholder="Search users" /></div>
        <Table columns={[{ label: "User" }, { label: "Email" }, { label: "Role" }, { label: "Phone" }, { label: "Status" }, { label: "Joined" }, { label: "Actions", end: true }]}>
          {slice.length === 0 ? <EmptyRow span={7} icon="user" text="No users found." /> :
            slice.map((u) => (
              <tr key={u.id}>
                <td><div className="flex items-center gap-12"><span className="mini-avatar">{initials(u.name)}</span><span className="lead-cell">{u.name}</span></div></td>
                <td className="muted" style={{ fontSize: 13.5 }}>{u.email}</td>
                <td><Badge variant="primary">{u.role}</Badge></td>
                <td className="cell-mono" style={{ fontSize: 12.5 }}>{u.phone}</td>
                <td><Badge variant={u.status === "active" ? "ok" : "muted"}>{u.status}</Badge></td>
                <td className="muted" style={{ fontSize: 13 }}>{fmtDate(u.created_at)}</td>
                <td className="text-end"><div className="row-actions">
                  {can(db, "Update User") ? <button className="act act--edit" onClick={() => setModal({ kind: "user", mode: "edit", data: u })}><Icon name="edit" size={16} /></button> : null}
                  {can(db, "Delete User") ? <button className="act act--del" onClick={() => del(u)}><Icon name="trash" size={16} /></button> : null}
                </div></td>
              </tr>
            ))}
        </Table>
        <div className="card__foot"><Pager page={page} pages={pages} setPage={setPage} total={total} /></div>
      </Card>
      {modal ? <UserModal modal={modal} roles={db.roles} onClose={() => setModal(null)} /> : null}
    </>
  );
}

function UserModal({ modal, roles, onClose }) {
  const editing = modal.mode === "edit";
  const [f, setF] = useYS(() => editing ? { ...modal.data } : { name: "", email: "", role: roles[0]?.name || "", phone: "", status: "active", created_at: new Date().toISOString().slice(0, 10) });
  const [err, setErr] = useYS({});
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    const e = {}; if (!f.name.trim()) e.name = "Name is required"; if (!f.email.trim()) e.email = "Email is required";
    setErr(e); if (Object.keys(e).length) return;
    if (editing) { DB.update("users", modal.data.id, f); toast("User updated"); }
    else { DB.insert("users", f); toast("User created"); }
    onClose();
  };
  return (
    <Modal title={editing ? "Edit user" : "New user"} onClose={onClose} footer={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>{editing ? "Save" : "Create"}</Btn></>}>
      <div className="form-grid">
        <Field label="Name" required error={err.name} span={12}><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Email" required error={err.email}><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Role"><Select value={f.role} onChange={(e) => set("role", e.target.value)}>{roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}</Select></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
      </div>
    </Modal>
  );
}

// ===================================================================
// ROLES  — grouped, comprehensive permission catalog (WT_PERMISSIONS)
// ===================================================================
// Compact, readable summary of which module groups a role touches.
function roleGroupSummary(perms) {
  const set = new Set(perms);
  return WT_PERMISSIONS.map((g) => {
    const n = g.perms.filter((p) => set.has(p.key)).length;
    return n ? { group: g.group, n, total: g.perms.length } : null;
  }).filter(Boolean);
}

function RolesBody({ modal, setModal }) {
  const [db] = useDB();
  const [confirm, confirmNode] = useConfirm();
  const acting = WT_getActingRole();
  const del = async (r) => {
    if (r.name === "Administrator") { toast("The Administrator role can't be deleted", "info"); return; }
    if (await confirm({ title: "Delete role?", message: `Remove “${r.name}”? Users with this role will lose its permissions.`, danger: true, okLabel: "Delete" })) { DB.remove("roles", r.id); toast("Role deleted", "del"); }
  };
  return (
    <>
      {confirmNode}
      {/* Preview-as-role: see the dashboard exactly as a given role would. */}
      <div className="role-preview-bar">
        <div className="flex items-center gap-8">
          <Icon name="eye" size={16} />
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>Preview dashboard as</span>
        </div>
        <Select value={acting || "Administrator"} onChange={(e) => WT_setActingRole(e.target.value === "Administrator" ? null : e.target.value)} style={{ maxWidth: 240 }}>
          {db.roles.map((r) => <option key={r.id} value={r.name}>{r.name}{r.name === "Administrator" ? " (full access — you)" : ""}</option>)}
        </Select>
        {acting && acting !== "Administrator" ? <Btn variant="soft" size="sm" icon="arrow-left" onClick={() => WT_setActingRole(null)}>Exit preview</Btn> : <span className="muted" style={{ fontSize: 12.5 }}>Hides pages & actions a role can't access. Your own login is unchanged.</span>}
      </div>

      <div className="card-grid">
        {db.roles.map((r) => {
          const summary = roleGroupSummary(r.permissions || []);
          const isAdmin = r.name === "Administrator";
          return (
          <Card key={r.id} className="entity-card">
            <div className="card__body">
              <div className="flex items-center" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                <div className="stat__ic ic-primary"><Icon name="shield" size={22} /></div>
                <Badge variant={isAdmin ? "ok" : "muted"}>{isAdmin ? "Full access" : `${(r.permissions || []).length} permissions`}</Badge>
              </div>
              <h3 style={{ margin: "0 0 4px", fontFamily: "var(--display)", fontSize: 20 }}>{r.name}</h3>
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>Created {fmtDate(r.created_at)}</div>
              <div className="flex gap-8 wrap">
                {summary.slice(0, 5).map((s) => <Badge key={s.group} variant="primary">{s.group} · {s.n}</Badge>)}
                {summary.length > 5 ? <Badge variant="muted">+{summary.length - 5} more</Badge> : null}
                {summary.length === 0 ? <span className="muted" style={{ fontSize: 13 }}>No permissions yet</span> : null}
              </div>
            </div>
            <div className="card__foot">
              {can(db, "Update Role") ? <button className="btn btn--soft btn--sm" onClick={() => setModal({ kind: "role", mode: "edit", data: r })}><Icon name="edit" size={15} /><span>Edit</span></button> : <span></span>}
              {!isAdmin && can(db, "Delete Role") ? <button className="act act--del" onClick={() => del(r)}><Icon name="trash" size={16} /></button> : null}
            </div>
          </Card>
          );
        })}
      </div>
      {modal ? <RoleModal modal={modal} onClose={() => setModal(null)} /> : null}
    </>
  );
}

function RoleModal({ modal, onClose }) {
  const editing = modal.mode === "edit";
  const isAdmin = editing && modal.data.name === "Administrator";
  const [f, setF] = useYS(() => editing ? { ...modal.data, permissions: [...(modal.data.permissions || [])] } : { name: "", permissions: [], created_at: new Date().toISOString().slice(0, 10) });
  const [err, setErr] = useYS({});
  const [q, setQ] = useYS("");
  const [collapsed, setCollapsed] = useYS({});
  const sel = new Set(f.permissions);

  const setPerms = (next) => setF((s) => ({ ...s, permissions: Array.from(next) }));
  const toggle = (key) => { const n = new Set(sel); n.has(key) ? n.delete(key) : n.add(key); setPerms(n); };
  const groupAll = (g, on) => { const n = new Set(sel); g.perms.forEach((p) => on ? n.add(p.key) : n.delete(p.key)); setPerms(n); };
  const groupReadOnly = (g) => { const n = new Set(sel); g.perms.forEach((p) => { const ro = !p.danger && /^view\b/i.test(p.key); ro ? n.add(p.key) : n.delete(p.key); }); setPerms(n); };
  const allOn = sel.size >= WT_ALL_PERMS.length && WT_ALL_PERMS.every((k) => sel.has(k));

  const ql = q.trim().toLowerCase();
  const groups = WT_PERMISSIONS.map((g) => ({
    ...g,
    perms: ql ? g.perms.filter((p) => p.label.toLowerCase().includes(ql) || p.key.toLowerCase().includes(ql) || g.group.toLowerCase().includes(ql)) : g.perms,
  })).filter((g) => g.perms.length);

  const save = () => {
    if (!f.name.trim()) { setErr({ name: "Role name is required" }); return; }
    const payload = { ...f, name: f.name.trim() };
    if (editing) { DB.update("roles", modal.data.id, payload); toast("Role updated"); }
    else { DB.insert("roles", payload); toast("Role created"); }
    onClose();
  };

  return (
    <Modal title={editing ? `Edit role · ${modal.data.name}` : "New role"} lg onClose={onClose} footer={<>
      <span className="muted" style={{ fontSize: 12.5, marginInlineEnd: "auto" }}>{sel.size} of {WT_ALL_PERMS.length} permissions selected</span>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save}>{editing ? "Save changes" : "Create role"}</Btn></>}>
      <Field label="Role Name" required error={err.name} span={12}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} disabled={isAdmin} /></Field>

      {isAdmin ? (
        <div className="role-admin-note" style={{ marginTop: 14 }}><Icon name="shield" size={18} /><div>The <b>Administrator</b> role always has full access to every module and action. Permissions can't be removed to avoid locking the system.</div></div>
      ) : (
        <>
          <div className="flex items-center" style={{ justifyContent: "space-between", gap: 12, margin: "18px 0 12px", flexWrap: "wrap" }}>
            <label style={{ fontWeight: 700, fontSize: 14 }}>Permissions</label>
            <Btn variant="soft" size="sm" onClick={() => setPerms(allOn ? new Set() : new Set(WT_ALL_PERMS))}>{allOn ? "Clear all" : "Select all"}</Btn>
          </div>
          <div style={{ margin: "0 0 14px" }}><SearchField value={q} onChange={setQ} placeholder="Search permissions…" /></div>
          <div className="cap-reset-warn" style={{ marginBottom: 14 }}>
            <Icon name="alert-triangle" size={18} />
            <div>Permissions marked <b>high-risk</b> (Reset Test Data, Danger Zone, Full Reset) are destructive. Grant them only to trusted administrators — they are never enabled by default for Finance or other roles.</div>
          </div>
          <div className="perm-groups">
            {groups.map((g) => {
              const selN = g.perms.filter((p) => sel.has(p.key)).length;
              const allSel = selN === g.perms.length;
              const isCol = collapsed[g.group];
              return (
                <div key={g.group} className="perm-group">
                  <div className="perm-group__head">
                    <button className="perm-group__toggle" onClick={() => setCollapsed((c) => ({ ...c, [g.group]: !c[g.group] }))}>
                      <Icon name="chevron-right" size={15} className={isCol ? "" : "rot90"} />
                      <span className="perm-group__ic"><Icon name={g.icon} size={16} /></span>
                      <span className="perm-group__title">{g.group}</span>
                      <Badge variant={selN ? "primary" : "muted"}>{selN}/{g.perms.length}</Badge>
                    </button>
                    <div className="flex items-center gap-6">
                      <button className="btn btn--link btn--sm" onClick={() => groupReadOnly(g)} title="Select only the View permissions in this module">Read only</button>
                      <button className="btn btn--link btn--sm" onClick={() => groupAll(g, !allSel)}>{allSel ? "Clear" : "Select all"}</button>
                    </div>
                  </div>
                  {!isCol ? (
                    <div className="perm-group__body">
                      {g.perms.map((p) => (
                        <label key={p.key} className={`perm-item${sel.has(p.key) ? " on" : ""}${p.danger ? " danger" : ""}`}>
                          <input type="checkbox" checked={sel.has(p.key)} onChange={() => toggle(p.key)} />
                          <span className="perm-item__box"><Icon name="check" size={13} /></span>
                          <span className="perm-item__label">{p.label}{p.danger ? <Icon name="alert-triangle" size={13} /> : null}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {groups.length === 0 ? <div className="muted" style={{ padding: "16px 4px", fontSize: 13.5 }}>No permissions match “{q}”.</div> : null}
          </div>
        </>
      )}
    </Modal>
  );
}

Object.assign(window, { Settings, SystemManagement });
