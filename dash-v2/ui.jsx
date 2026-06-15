/* global React */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ====================================================================
// ICONS — stroke SVGs (Tabler-style) keyed by name
// ====================================================================
const ICON_PATHS = {
  "home": '<path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"/>',
  "tasks": '<path d="M3.5 5.5l1.5 1.5l2.5 -2.5"/><path d="M3.5 11.5l1.5 1.5l2.5 -2.5"/><path d="M3.5 17.5l1.5 1.5l2.5 -2.5"/><path d="M11 6l9 0"/><path d="M11 12l9 0"/><path d="M11 18l9 0"/>',
  "users": '<path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0 -3 -3.85"/>',
  "user": '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/>',
  "user-check": '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4"/><path d="M15 19l2 2l4 -4"/>',
  "address-book": '<path d="M20 6v12a2 2 0 0 1 -2 2h-11a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1h11a2 2 0 0 1 2 2z"/><path d="M10 16h6"/><path d="M13 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M4 8h3"/><path d="M4 12h3"/><path d="M4 16h3"/>',
  "wallet": '<path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12"/><path d="M20 12v4h-4a2 2 0 0 1 0 -4h4"/>',
  "file-invoice": '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><path d="M9 7l1 0"/><path d="M9 13l6 0"/><path d="M13 17l2 0"/>',
  "file-pdf": '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4"/><path d="M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6"/><path d="M17 18h2"/><path d="M20 15h-3v6"/><path d="M11 15v6h1a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2h-1z"/>',
  "arrow-down": '<path d="M12 5l0 14"/><path d="M18 13l-6 6"/><path d="M6 13l6 6"/>',
  "arrow-up": '<path d="M12 5l0 14"/><path d="M18 11l-6 -6"/><path d="M6 11l6 -6"/>',
  "bank": '<path d="M3 21l18 0"/><path d="M3 10l18 0"/><path d="M5 6l7 -3l7 3"/><path d="M4 10l0 11"/><path d="M20 10l0 11"/><path d="M8 14l0 3"/><path d="M12 14l0 3"/><path d="M16 14l0 3"/>',
  "file-dollar": '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/><path d="M14 11h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-2.5"/><path d="M12 17v1m0 -8v1"/>',
  "mail": '<path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z"/><path d="M3 7l9 6l9 -6"/>',
  "briefcase": '<path d="M3 7m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/><path d="M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2"/><path d="M12 12l0 .01"/><path d="M3 13a20 20 0 0 0 18 0"/>',
  "building": '<path d="M3 21l18 0"/><path d="M9 8l1 0"/><path d="M9 12l1 0"/><path d="M9 16l1 0"/><path d="M14 8l1 0"/><path d="M14 12l1 0"/><path d="M14 16l1 0"/><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16"/>',
  "partners": '<path d="M12 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M5 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M19 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M12 7v4"/><path d="M6.5 17.5l3.5 -3"/><path d="M17.5 17.5l-3.5 -3"/>',
  "photo": '<path d="M15 8h.01"/><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z"/><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5"/><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3"/>',
  "settings": '<path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"/><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>',
  "search": '<path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M21 21l-6 -6"/>',
  "plus": '<path d="M12 5l0 14"/><path d="M5 12l14 0"/>',
  "edit": '<path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1"/><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z"/><path d="M16 5l3 3"/>',
  "trash": '<path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
  "eye": '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"/>',
  "external-link": '<path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6"/><path d="M11 13l9 -9"/><path d="M15 4h5v5"/>',
  "x": '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
  "download": '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/>',
  "upload": '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 9l5 -5l5 5"/><path d="M12 4l0 12"/>',
  "cloud-upload": '<path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1"/><path d="M9 15l3 -3l3 3"/><path d="M12 12l0 9"/>',
  "arrow-left": '<path d="M5 12l14 0"/><path d="M5 12l6 6"/><path d="M5 12l6 -6"/>',
  "arrow-right": '<path d="M5 12l14 0"/><path d="M13 18l6 -6"/><path d="M13 6l6 6"/>',
  "check": '<path d="M5 12l5 5l10 -10"/>',
  "send": '<path d="M10 14l11 -11"/><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5"/>',
  "alert-triangle": '<path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z"/><path d="M12 16h.01"/>',
  "chevron-right": '<path d="M9 6l6 6l-6 6"/>',
  "chevron-down": '<path d="M6 9l6 6l6 -6"/>',
  "bell": '<path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/>',
  "logout": '<path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2"/><path d="M9 12h12l-3 -3"/><path d="M18 15l3 -3"/>',
  "clock": '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/>',
  "calendar": '<path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/><path d="M11 15h1"/><path d="M12 15v3"/>',
  "dollar": '<path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2"/><path d="M12 3v3m0 12v3"/>',
  "file": '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/>',
  "files": '<path d="M15 3v4a1 1 0 0 0 1 1h4"/><path d="M18 17h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h4l5 5v7a2 2 0 0 1 -2 2z"/><path d="M16 17v2a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2"/>',
  "world": '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M3.6 9h16.8"/><path d="M3.6 15h16.8"/><path d="M11.5 3a17 17 0 0 0 0 18"/><path d="M12.5 3a17 17 0 0 1 0 18"/>',
  "star": '<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/>',
  "dots": '<path d="M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/>',
  "sun": '<path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"/>',
  "moon": '<path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"/>',
  "message": '<path d="M4 21v-13a3 3 0 0 1 3 -3h10a3 3 0 0 1 3 3v6a3 3 0 0 1 -3 3h-9l-4 4"/><path d="M8 9l8 0"/><path d="M8 13l6 0"/>',
  "checklist-box": '<path d="M11 6l9 0"/><path d="M11 12l9 0"/><path d="M11 18l9 0"/><path d="M4 6l1 1l2 -2"/><path d="M4 12l1 1l2 -2"/><path d="M4 18l1 1l2 -2"/>',
  "shield": '<path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3"/>',
  "id": '<path d="M3 4m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v10a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z"/><path d="M9 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M15 8l2 0"/><path d="M15 12l2 0"/><path d="M7 16l10 0"/>',
  "inbox": '<path d="M4 13a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2"/><path d="M4 13l3 -8h10l3 8"/><path d="M8 13h8a2 2 0 1 1 -8 0"/>',
  "menu": '<path d="M4 6l16 0"/><path d="M4 12l16 0"/><path d="M4 18l16 0"/>',
  "coin": '<path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18"/><path d="M14.8 9a2 2 0 0 0 -1.8 -1h-2a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-2a2 2 0 0 1 -1.8 -1"/><path d="M12 6v2m0 8v2"/>',
  "language": '<path d="M4 5h7"/><path d="M9 3v2c0 4.418 -2.239 8 -5 8"/><path d="M5 9c0 2.144 2.952 3.908 6.7 4"/><path d="M12 20l4 -9l4 9"/><path d="M19.1 18h-6.2"/>',
  "calculator": '<path d="M4 3m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M8 7m0 1a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z"/><path d="M8 14l0 .01"/><path d="M12 14l0 .01"/><path d="M16 14l0 .01"/><path d="M8 17l0 .01"/><path d="M12 17l0 .01"/><path d="M16 17l0 .01"/>',
};

function Icon({ name, size = 20, sw = 1.8, style, className }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || "" }}
    />
  );
}

// ====================================================================
// BUTTON
// ====================================================================
function Btn({ children, variant = "primary", icon, iconRight, onClick, size, type = "button", className = "", title, style }) {
  return (
    <button type={type} title={title} onClick={onClick} style={style}
      className={`btn btn--${variant}${size === "sm" ? " btn--sm" : ""} ${className}`}>
      {icon ? <Icon name={icon} size={size === "sm" ? 15 : 17} /> : null}
      {children ? <span>{children}</span> : null}
      {iconRight ? <Icon name={iconRight} size={size === "sm" ? 15 : 17} /> : null}
    </button>
  );
}

// ====================================================================
// BADGES
// ====================================================================
const STATUS_MAP = {
  pending: { label: "Pending", cls: "warn" },
  in_progress: { label: "In Progress", cls: "info" },
  completed: { label: "Completed", cls: "ok" },
  active: { label: "Active", cls: "ok" },
  inactive: { label: "Inactive", cls: "muted" },
  quoted: { label: "Quoted", cls: "info" },
  accepted: { label: "Accepted", cls: "ok" },
  approved: { label: "Approved", cls: "ok" },
  rejected: { label: "Rejected", cls: "danger" },
  delivered: { label: "Delivered", cls: "ok" },
};
function StatusBadge({ status, dot = true }) {
  const m = STATUS_MAP[status] || { label: status, cls: "muted" };
  return <span className={`badge badge--${m.cls}`}>{dot ? <span className="badge__dot"></span> : null}{m.label}</span>;
}
function Badge({ children, variant = "muted" }) {
  return <span className={`badge badge--${variant}`}>{children}</span>;
}

// ====================================================================
// CARD
// ====================================================================
function Card({ children, className = "", solid, style }) {
  return <div className={`card${solid ? " card--solid" : ""} ${className}`} style={style}>{children}</div>;
}

// ====================================================================
// PAGE HEADER
// ====================================================================
function PageHead({ crumb, title, sub, actions }) {
  return (
    <div className="page-head">
      <div>
        {crumb ? <div className="page-head__crumb">{crumb}</div> : null}
        <h1 className="page-title">{title}</h1>
        {sub ? <p className="page-sub">{sub}</p> : null}
      </div>
      {actions ? <div className="page-head__actions">{actions}</div> : null}
    </div>
  );
}

// ====================================================================
// SEARCH + FILTER FIELDS
// ====================================================================
function SearchField({ value, onChange, placeholder = "Search" }) {
  return (
    <div className="field-search">
      <Icon name="search" size={17} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// ====================================================================
// FORM PRIMITIVES
// ====================================================================
function Field({ label, required, hint, error, children, span }) {
  return (
    <div className="field" style={span === 12 ? { gridColumn: "1 / -1" } : undefined}>
      {label ? <label>{label}{required ? <span className="req">*</span> : null}</label> : null}
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
      {error ? <span className="err">{error}</span> : null}
    </div>
  );
}
function Input(props) { return <input {...props} className={`inp ${props.className || ""}`} />; }
function Textarea(props) { return <textarea {...props} className={`inp ${props.className || ""}`} />; }
function Select({ children, ...props }) { return <select {...props} className={`inp ${props.className || ""}`}>{children}</select>; }

function CheckCard({ checked, onChange, label }) {
  return (
    <label className={`check${checked ? " on" : ""}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

// ====================================================================
// TABLE shell
// ====================================================================
function Table({ columns, children }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr>{columns.map((c, i) => <th key={i} className={`${c.end ? "text-end" : ""}${c.start ? " cell-left" : ""}`} style={c.w ? { width: c.w } : undefined}>{c.label}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function EmptyRow({ span, icon = "inbox", text = "Nothing here yet." }) {
  return <tr><td className="empty-row" colSpan={span}><div><Icon name={icon} size={34} /></div>{text}</td></tr>;
}

// ====================================================================
// PAGINATION
// ====================================================================
function usePaginate(items, perPage = 8) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  useEffect(() => { if (page > pages) setPage(1); }, [pages, page]);
  const slice = items.slice((page - 1) * perPage, page * perPage);
  return { page, setPage, pages, slice, total: items.length };
}
function Pager({ page, pages, setPage, total }) {
  if (pages <= 1) return <span className="muted" style={{ fontSize: 13 }}>{total} {total === 1 ? "record" : "records"}</span>;
  const nums = [];
  for (let i = 1; i <= pages; i++) nums.push(i);
  return (
    <>
      <span className="muted" style={{ fontSize: 13 }}>{total} records</span>
      <div className="pager">
        <button className="pager__btn" disabled={page === 1} onClick={() => setPage(page - 1)}><Icon name="arrow-left" size={15} /></button>
        {nums.map((n) => <button key={n} className={`pager__btn${n === page ? " on" : ""}`} onClick={() => setPage(n)}>{n}</button>)}
        <button className="pager__btn" disabled={page === pages} onClick={() => setPage(page + 1)}><Icon name="arrow-right" size={15} /></button>
      </div>
    </>
  );
}

// ====================================================================
// MODAL
// ====================================================================
function Modal({ title, onClose, children, footer, lg }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  const node = (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${lg ? " modal--lg" : ""}`}>
        <div className="modal__head">
          <h3 className="modal__title">{title}</h3>
          <button className="modal__x" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
  // Portal to <body> so the fixed scrim escapes any transformed ancestor
  // (e.g. .fade-in pages), keeping the modal centered in the viewport.
  return ReactDOM.createPortal(node, document.body);
}

// confirm dialog hook
function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => {
    setState({ ...opts, resolve });
  }), []);
  const node = state ? (
    <Modal title={state.title || "Are you sure?"} onClose={() => { state.resolve(false); setState(null); }}
      footer={<>
        <Btn variant="ghost" onClick={() => { state.resolve(false); setState(null); }}>Cancel</Btn>
        <Btn variant={state.danger ? "danger" : "primary"} onClick={() => { state.resolve(true); setState(null); }}>{state.okLabel || "Confirm"}</Btn>
      </>}>
      <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 15 }}>{state.message}</p>
    </Modal>
  ) : null;
  return [confirm, node];
}

// ====================================================================
// TOAST  (global event-based)
// ====================================================================
function toast(msg, kind = "ok") { window.dispatchEvent(new CustomEvent("wt-toast", { detail: { msg, kind } })); }
function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const onT = (e) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, ...e.detail }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 2800);
    };
    window.addEventListener("wt-toast", onT);
    return () => window.removeEventListener("wt-toast", onT);
  }, []);
  const ic = { ok: "check", info: "bell", del: "trash" };
  return (
    <div className="toast-wrap">
      {items.map((i) => (
        <div className="toast" key={i.id}>
          <div className={`toast__ic ${i.kind}`}><Icon name={ic[i.kind] || "check"} size={18} /></div>
          <span className="toast__msg">{i.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ====================================================================
// PDF ATTACHMENT — PDF-only file field (stores { name, data } data-URI)
// Used by New/Edit Freelancer and New/Edit Client.
// ====================================================================
function PdfAttachment({ value, onChange, hint }) {
  const ref = useRef(null);
  const [err, setErr] = useState("");
  const pick = (file) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) { setErr("Only PDF files are allowed."); return; }
    setErr("");
    const reader = new FileReader();
    reader.onload = () => onChange({ name: file.name, data: reader.result, size: file.size, uploaded_at: new Date().toISOString().slice(0, 10) });
    reader.readAsDataURL(file);
  };
  return (
    <div>
      <input ref={ref} type="file" accept="application/pdf,.pdf" style={{ display: "none" }}
        onChange={(e) => { pick(e.target.files[0]); e.target.value = ""; }} />
      {value && value.data ? (
        <div className="pdf-chip">
          <span className="pdf-chip__ic"><Icon name="file" size={18} /></span>
          <span className="pdf-chip__name">{value.name || "Attachment.pdf"}</span>
          <a className="pdf-chip__act" href={value.data} target="_blank" rel="noreferrer" title="View PDF"><Icon name="eye" size={15} /></a>
          <button type="button" className="pdf-chip__act" title="Replace PDF" onClick={() => ref.current && ref.current.click()}><Icon name="upload" size={15} /></button>
          <button type="button" className="pdf-chip__act pdf-chip__act--del" title="Remove" onClick={() => { onChange(null); setErr(""); }}><Icon name="x" size={15} /></button>
        </div>
      ) : (
        <button type="button" className="pdf-drop" onClick={() => ref.current && ref.current.click()}>
          <Icon name="cloud-upload" size={22} />
          <span><b>Upload PDF</b> — PDF files only</span>
        </button>
      )}
      {hint && !err ? <span className="hint">{hint}</span> : null}
      {err ? <span className="err">{err}</span> : null}
    </div>
  );
}

// Read-only view link for a stored PDF attachment (details pages)
function PdfViewLink({ value, label = "View Attachment" }) {
  if (!value || !value.data) return <span className="muted">—</span>;
  return (
    <a className="btn btn--soft" href={value.data} target="_blank" rel="noreferrer" download={value.name || "attachment.pdf"} style={{ textDecoration: "none" }}>
      <Icon name="file" size={16} /><span>{label}</span>
    </a>
  );
}

// ====================================================================
// MEDIA ATTACHMENT — PDF + image file field (.pdf .jpg .jpeg .png .webp)
// Stores { name, data (data-URI), size, type, uploaded_at }.
// Used by Invoices, Maintenance and Employees.
// ====================================================================
const MEDIA_OK = /\.(pdf|jpe?g|png|webp)$/i;
const MEDIA_MIME = /^(application\/pdf|image\/(jpeg|png|webp))$/i;
function MediaAttachment({ value, onChange, hint }) {
  const ref = useRef(null);
  const [err, setErr] = useState("");
  const pick = (file) => {
    if (!file) return;
    const ok = MEDIA_MIME.test(file.type || "") || MEDIA_OK.test(file.name || "");
    if (!ok) { setErr("Only PDF and image files are allowed."); return; }
    setErr("");
    const reader = new FileReader();
    reader.onload = () => onChange({ name: file.name, data: reader.result, size: file.size, type: file.type, uploaded_at: new Date().toISOString().slice(0, 10) });
    reader.readAsDataURL(file);
  };
  const isImg = value && /^image\//.test(value.type || "") || (value && /\.(jpe?g|png|webp)$/i.test(value.name || ""));
  return (
    <div>
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" style={{ display: "none" }}
        onChange={(e) => { pick(e.target.files[0]); e.target.value = ""; }} />
      {value && value.data ? (
        <div className="pdf-chip">
          <span className="pdf-chip__ic"><Icon name={isImg ? "photo" : "file"} size={18} /></span>
          <span className="pdf-chip__name">{value.name || "Attachment"}</span>
          <a className="pdf-chip__act" href={value.data} target="_blank" rel="noreferrer" title="View attachment"><Icon name="eye" size={15} /></a>
          <a className="pdf-chip__act" href={value.data} download={value.name || "attachment"} title="Download attachment"><Icon name="download" size={15} /></a>
          <button type="button" className="pdf-chip__act" title="Replace attachment" onClick={() => ref.current && ref.current.click()}><Icon name="upload" size={15} /></button>
          <button type="button" className="pdf-chip__act pdf-chip__act--del" title="Remove" onClick={() => { onChange(null); setErr(""); }}><Icon name="x" size={15} /></button>
        </div>
      ) : (
        <button type="button" className="pdf-drop" onClick={() => ref.current && ref.current.click()}>
          <Icon name="cloud-upload" size={22} />
          <span><b>Upload file</b> — PDF or image only</span>
        </button>
      )}
      {hint && !err ? <span className="hint">{hint}</span> : null}
      {err ? <span className="err">{err}</span> : null}
    </div>
  );
}

// Read-only view + download links for a stored media attachment (details pages)
function MediaViewLink({ value }) {
  if (!value || !value.data) return <span className="muted">—</span>;
  const isImg = /^image\//.test(value.type || "") || /\.(jpe?g|png|webp)$/i.test(value.name || "");
  return (
    <span className="flex items-center gap-8 wrap">
      <a className="btn btn--soft btn--sm" href={value.data} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
        <Icon name={isImg ? "photo" : "file"} size={15} /><span>View</span>
      </a>
      <a className="btn btn--ghost btn--sm" href={value.data} download={value.name || "attachment"} style={{ textDecoration: "none" }}>
        <Icon name="download" size={15} /><span>Download</span>
      </a>
    </span>
  );
}

// ====================================================================
// DATE INPUT — always displays/accepts dd/mm/yyyy (day-first), while
// storing/returning ISO yyyy-mm-dd so saved data stays correct.
// A calendar button opens the native picker for convenience.
// ====================================================================
function isoToDMY(s) {
  if (!s) return "";
  const m = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? `${m[3].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[1]}` : "";
}
function dmyToISO(s) {
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const d = +m[1], mo = +m[2], y = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function DateInput({ value, onChange, placeholder = "dd/mm/yyyy", className = "" }) {
  const [text, setText] = useState(() => isoToDMY(value));
  const nativeRef = useRef(null);
  useEffect(() => { setText(isoToDMY(value)); }, [value]);
  const handleText = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
    else if (digits.length > 2) out = digits.slice(0, 2) + "/" + digits.slice(2);
    setText(out);
    const iso = dmyToISO(out);
    if (iso) onChange(iso); else if (!digits) onChange("");
  };
  // Open the native calendar. The transparent native input below already
  // receives the click on its (full-width) picker indicator; calling
  // showPicker() here is a belt-and-suspenders path for Firefox and any
  // browser where the indicator click alone doesn't trigger it.
  const openPicker = () => {
    const el = nativeRef.current; if (!el) return;
    try { if (typeof el.showPicker === "function") el.showPicker(); else el.focus(); }
    catch (e) { /* picker already opening, or unsupported — ignore */ }
  };
  return (
    <div className={`date-input ${className}`}>
      <input className="inp date-input__text" value={text} placeholder={placeholder} inputMode="numeric"
        onChange={(e) => handleText(e.target.value)}
        onBlur={(e) => { const iso = dmyToISO(e.target.value); if (iso) setText(isoToDMY(iso)); else if (!e.target.value.replace(/\D/g, "")) setText(""); }} />
      <span className="date-input__btn" aria-hidden="true"><Icon name="calendar" size={17} /></span>
      <input ref={nativeRef} type="date" className="date-input__native" value={value || ""}
        aria-label="Open calendar" title="Open calendar"
        onClick={openPicker} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ====================================================================
// COMBO — searchable autocomplete bound to a list of records.
// Filters as you type, click to select; reports the chosen record.
// ====================================================================
function Combo({ value, onChange, onPick, options, getLabel, getValue, placeholder, error }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrapRef = useRef(null);
  const q = value || "";
  const matches = options.filter((o) => {
    const lbl = getLabel(o).toLowerCase(), val = String(getValue(o)).toLowerCase();
    const s = q.toLowerCase();
    return !s || lbl.includes(s) || val.includes(s);
  }).slice(0, 8);
  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const choose = (o) => { onPick(o); setOpen(false); };
  return (
    <div className="combo" ref={wrapRef}>
      <input className={`inp${error ? " inp--err" : ""}`} value={q} placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, matches.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" && open && matches[hi]) { e.preventDefault(); choose(matches[hi]); }
          else if (e.key === "Escape") setOpen(false);
        }} />
      {open && matches.length ? (
        <div className="combo__menu">
          {matches.map((o, i) => (
            <button type="button" key={getValue(o)} className={`combo__opt${i === hi ? " hi" : ""}`}
              onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); choose(o); }}>
              <span className="combo__opt-v">{getValue(o)}</span>
              <span className="combo__opt-l">{getLabel(o)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ====================================================================
// LANG PAIR chip
// ====================================================================
function LangPair({ source, target }) {
  return <span className="lang-chip">{(source || "").toUpperCase()} <Icon name="arrow-right" size={12} /> {(target || "").toUpperCase()}</span>;
}

// ====================================================================
// money format
// ====================================================================
function money(n, cur) {
  const v = Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cur === "EGP" ? `${v} EGP` : cur === "USD" ? `$${v}` : v;
}
function initials(name) { return (name || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }
function fmtDate(s) { if (!s) return "\u2014"; try { const d = new Date(s); if (isNaN(d)) return s; return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; } catch (e) { return s; } }
// Alias kept for callers expecting numeric day/month/year.
const fmtDateNum = fmtDate;
// Long-form date (with month name) — kept for the rare place that wants it.
function fmtDateLong(s) { if (!s) return "\u2014"; try { const d = new Date(s); if (isNaN(d)) return s; return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } catch (e) { return s; } }
function fromNow(s) {
  if (!s) return "—";
  const diff = (Date.now() - new Date(s).getTime()) / 86400000;
  if (diff < 1) return "today";
  if (diff < 2) return "yesterday";
  if (diff < 30) return `${Math.floor(diff)}d ago`;
  return fmtDate(s);
}

// ====================================================================
// Language search helper — lets users find records by language code OR
// full name. "en" ↔ "english", "ar" ↔ "arabic", etc. Used in table search
// haystacks across the dashboard.
// ====================================================================
const LANG_NAMES = {
  en: "english", ar: "arabic", fr: "french", es: "spanish", de: "german", it: "italian",
  pt: "portuguese", ru: "russian", zh: "chinese", ja: "japanese", ko: "korean", tr: "turkish",
  nl: "dutch", hi: "hindi", ur: "urdu", fa: "persian farsi", he: "hebrew", el: "greek",
  pl: "polish", sv: "swedish", no: "norwegian", da: "danish", fi: "finnish", cs: "czech",
  ro: "romanian", hu: "hungarian", th: "thai", vi: "vietnamese", id: "indonesian", ms: "malay",
  uk: "ukrainian", bg: "bulgarian", hr: "croatian", sr: "serbian", sk: "slovak", ca: "catalan",
};
const LANG_CODE_BY_NAME = (() => { const m = {}; Object.entries(LANG_NAMES).forEach(([c, n]) => n.split(" ").forEach((w) => { m[w] = c; })); return m; })();
// Given any language text ("EN>AR", "English"), return a lowercased string that
// also contains the matching codes AND full names, so search matches either.
function expandLangs(text) {
  const s = String(text || "").toLowerCase();
  if (!s) return "";
  const extra = [];
  s.split(/[^a-z]+/).filter(Boolean).forEach((tok) => {
    if (LANG_NAMES[tok]) extra.push(LANG_NAMES[tok]);
    if (LANG_CODE_BY_NAME[tok]) extra.push(LANG_CODE_BY_NAME[tok]);
  });
  return (s + " " + extra.join(" ")).trim();
}

Object.assign(window, {
  Icon, Btn, Badge, StatusBadge, STATUS_MAP, Card, PageHead, SearchField,
  Field, Input, Textarea, Select, CheckCard, Table, EmptyRow,
  usePaginate, Pager, Modal, useConfirm, toast, ToastHost, LangPair,
  PdfAttachment, PdfViewLink, MediaAttachment, MediaViewLink, Combo, DateInput, isoToDMY, dmyToISO,
  money, initials, fmtDate, fmtDateNum, fmtDateLong, fromNow, expandLangs, LANG_NAMES,
});
