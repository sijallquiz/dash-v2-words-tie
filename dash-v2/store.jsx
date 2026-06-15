/* global React */
// ====================================================================
// WORDS TIE — Dashboard data store (localStorage-backed, reactive)
// ====================================================================
const { useState, useEffect, useSyncExternalStore, useCallback } = React;

const STORE_KEY = "wt_dashboard_v8";

// ====================================================================
// CLIENT PORTAL — shared constants, workflow + demo data factories.
// Added non-destructively: nothing here removes or rewrites existing
// records. The workflow lives ON the existing Task record (task.workflowStages)
// and quotes live ON the existing Price Request record (request.quote).
// ====================================================================
const WT_WORKFLOW_STAGES = ["Receiving Files", "Resources", "Translation", "Revision", "DTP", "Proofreading", "QA", "Delivery"];
const WT_STAGE_STATUSES = ["Not Started", "In Progress", "Waiting", "Completed", "Skipped"];
// High-level client-facing journey shown as the timeline at the top of each project.
const WT_JOURNEY_STAGES = ["Project Review", "Quotation", "Client Approval", "In Production", "Project Delivery", "Invoice Submission"];
// New permissions introduced for the Client Portal (added to Administrator + Client roles).
const WT_CLIENT_PORTAL_PERMISSIONS = [
  "View Client Portal", "View Client Dashboard", "View Own Projects", "Create Price Request",
  "View Own Price Requests", "Accept or Reject Quote", "Send Contact Message",
  "Upload Client Files", "View Client Project Progress",
];

// ====================================================================
// PERMISSIONS — grouped catalog (single source of truth for the Roles UI
// and all `can()` checks). Additive: legacy permission keys used elsewhere
// (e.g. "View Task", "Reset Company Capital Test Data") are kept verbatim so
// existing role data and existing checks keep working unchanged.
// Each group: { group, icon, perms: [{ key, label, danger? }] }.
// ====================================================================
const WT_PERMISSIONS = [
  { group: "Home", icon: "home", perms: [
    { key: "View Home", label: "View Home dashboard" },
    { key: "View Home KPIs", label: "View KPI cards" },
    { key: "View Upcoming Deadlines", label: "View upcoming deadlines" },
    { key: "View Recent Activity", label: "View recent activity" },
    { key: "View Finance Overview", label: "View finance overview" },
  ] },
  { group: "Tasks", icon: "tasks", perms: [
    { key: "View Task", label: "View tasks list & details" },
    { key: "Create Task", label: "Create task" },
    { key: "Update Task", label: "Edit task" },
    { key: "Delete Task", label: "Delete / archive task" },
    { key: "View Archived Tasks", label: "View archived / deleted tasks" },
    { key: "View Files History", label: "View files history" },
    { key: "Add Files", label: "Upload files" },
    { key: "Download Files", label: "Download files" },
    { key: "Delete Files", label: "Delete files" },
    { key: "View Freelancer PO", label: "View Freelancer PO" },
    { key: "Manage Freelancer PO", label: "Create / edit / delete Freelancer PO" },
    { key: "View Project Progress", label: "View project progress" },
    { key: "Edit Project Progress", label: "Edit progress stages & notes" },
    { key: "View Internal Notes", label: "View internal notes" },
    { key: "View Quotes & Approvals", label: "View quotes & approvals" },
    { key: "Send Quote to Client", label: "Create / send quote" },
    { key: "View Client Quote Response", label: "View client response details" },
  ] },
  { group: "Freelancers", icon: "users", perms: [
    { key: "View Freelancer", label: "View freelancers & profiles" },
    { key: "Create Freelancer", label: "Create freelancer" },
    { key: "Update Freelancer", label: "Edit freelancer" },
    { key: "Delete Freelancer", label: "Delete freelancer" },
    { key: "View Freelancer Rates", label: "View rates & per-word/page" },
    { key: "Manage Freelancer Attachments", label: "Upload / delete attachments" },
  ] },
  { group: "Clients", icon: "address-book", perms: [
    { key: "View Client", label: "View clients & profiles" },
    { key: "Create Client", label: "Create client" },
    { key: "Update Client", label: "Edit client" },
    { key: "Delete Client", label: "Delete client" },
    { key: "View Client Financials", label: "View billed / paid / outstanding" },
    { key: "Edit Client Price Services", label: "Edit client price services" },
  ] },
  { group: "Employees", icon: "id", perms: [
    { key: "View Employee", label: "View employees & profiles" },
    { key: "Create Employee", label: "Create employee" },
    { key: "Update Employee", label: "Edit employee" },
    { key: "Delete Employee", label: "Delete employee" },
    { key: "View Employee Salary", label: "View salary / rate" },
    { key: "View Employee Sensitive Data", label: "View bank / national ID / tax" },
  ] },
  { group: "Quote Calculator", icon: "calculator", perms: [
    { key: "View Calculator", label: "View quote calculator" },
    { key: "Use Calculator", label: "Build & edit quotes" },
    { key: "Export Quote", label: "Export / print quote" },
    { key: "Manage Language Rates", label: "Add / edit / delete language rates" },
    { key: "Manage Service Rates", label: "Add / edit / delete service rates" },
  ] },
  { group: "Client Portal", icon: "world", perms: [
    { key: "View Client Portal", label: "Access Client Portal" },
    { key: "Preview Client Portal as Admin", label: "Preview portal as admin" },
    { key: "View Client Dashboard", label: "View portal dashboard & KPIs" },
    { key: "View Own Projects", label: "View own projects" },
    { key: "View Client Project Progress", label: "View own project progress" },
    { key: "View Own Price Requests", label: "View own quotes & approvals" },
    { key: "Accept or Reject Quote", label: "Accept / reject quote" },
    { key: "Create Price Request", label: "Request a quote / new project" },
    { key: "Upload Client Files", label: "Upload request files" },
    { key: "Send Contact Message", label: "Use Let's Connect" },
  ] },
  { group: "Finance", icon: "wallet", perms: [
    { key: "View Finance", label: "View finance module & dashboard" },
    { key: "Export Finance Data", label: "Export finance data" },
    { key: "View Client Invoices", label: "View client invoices" },
    { key: "Create Client Invoice", label: "Create client invoice" },
    { key: "Update Client Invoice", label: "Edit client invoice" },
    { key: "Delete Client Invoice", label: "Delete client invoice" },
    { key: "View Freelancer Invoices", label: "View freelancer invoices" },
    { key: "Create Freelancer Invoice", label: "Create freelancer invoice" },
    { key: "Update Freelancer Invoice", label: "Edit freelancer invoice" },
    { key: "Delete Freelancer Invoice", label: "Delete freelancer invoice" },
    { key: "View Projects Ledger", label: "View projects ledger" },
    { key: "Manage Projects Ledger", label: "Create / edit / delete projects" },
    { key: "View Project Costs & Profit", label: "View cost, profit & margin" },
    { key: "View Payroll", label: "View payroll" },
    { key: "Manage Payroll", label: "Generate / edit / pay payroll" },
    { key: "Approve Payroll", label: "Approve payroll" },
    { key: "View Maintenance", label: "View maintenance" },
    { key: "Manage Maintenance", label: "Create / edit / pay maintenance" },
    { key: "Export Client Invoices Backup", label: "Export Client Invoices backup ZIP" },
    { key: "Reset Client Invoices Test Data", label: "Reset Client Invoices Test Data (high-risk)", danger: true },
    { key: "Export Freelancer Invoices Backup", label: "Export Freelancer Invoices backup ZIP" },
    { key: "Reset Freelancer Invoices Test Data", label: "Reset Freelancer Invoices Test Data (high-risk)", danger: true },
    { key: "Export Projects Ledger Backup", label: "Export Projects Ledger backup ZIP" },
    { key: "Reset Projects Ledger Test Data", label: "Reset Projects Ledger Test Data (high-risk)", danger: true },
    { key: "Export Payroll Backup", label: "Export Payroll backup ZIP" },
    { key: "Reset Payroll Test Data", label: "Reset Payroll Test Data (high-risk)", danger: true },
    { key: "Export Maintenance Backup", label: "Export Maintenance backup ZIP" },
    { key: "Reset Maintenance Test Data", label: "Reset Maintenance Test Data (high-risk)", danger: true },
  ] },
  { group: "Company Capital", icon: "bank", perms: [
    { key: "View Company Capital", label: "View company capital & KPIs" },
    { key: "Update Company Capital", label: "Edit / sync capital ledger" },
    { key: "Export Capital Transactions", label: "Export transactions" },
    { key: "Add Capital Entry", label: "Add capital entry" },
    { key: "Add Capital Adjustment", label: "Add adjustment" },
    { key: "Transfer Reserve", label: "Transfer reserve" },
    { key: "Reverse Capital Transaction", label: "Reverse transaction" },
    { key: "Export Company Capital Backup", label: "Export Company Capital backup ZIP" },
    { key: "Reset Company Capital Test Data", label: "Reset Test Data (high-risk)", danger: true },
  ] },
  { group: "Price Requests", icon: "file-dollar", perms: [
    { key: "View Project Request", label: "View price requests & details" },
    { key: "Manage Price Requests", label: "Update status / link / send quote" },
    { key: "Delete Project Request", label: "Delete price request" },
  ] },
  { group: "Contact Messages", icon: "mail", perms: [
    { key: "View Contact Message", label: "View contact messages" },
    { key: "Reply Contact Message", label: "Reply to message" },
    { key: "Delete Contact Message", label: "Delete message" },
  ] },
  { group: "System Management", icon: "shield", perms: [
    { key: "View User", label: "View users" },
    { key: "Create User", label: "Create user" },
    { key: "Update User", label: "Edit user / assign role" },
    { key: "Delete User", label: "Delete user" },
    { key: "View Role", label: "View roles" },
    { key: "Create Role", label: "Create role" },
    { key: "Update Role", label: "Edit role & permissions" },
    { key: "Delete Role", label: "Delete role" },
    { key: "Update Setting", label: "Manage settings" },
    { key: "View Danger Zone", label: "View Danger Zone (high-risk)", danger: true },
    { key: "Export Full Backup", label: "Export full backup ZIP" },
    { key: "Full Test Data Reset", label: "Full Test Data Reset (high-risk)", danger: true },
  ] },
];
const WT_ALL_PERMS = WT_PERMISSIONS.flatMap((g) => g.perms.map((p) => p.key));

// Sensible, additive defaults per built-in role. Administrator always gets ALL.
const WT_ROLE_DEFAULTS = {
  "Project Manager": [
    "View Home", "View Home KPIs", "View Upcoming Deadlines", "View Recent Activity",
    "View Task", "Create Task", "Update Task", "Delete Task", "View Archived Tasks",
    "View Files History", "Add Files", "Download Files", "Delete Files",
    "View Freelancer PO", "Manage Freelancer PO", "View Project Progress", "Edit Project Progress",
    "View Internal Notes", "View Quotes & Approvals", "Send Quote to Client", "View Client Quote Response",
    "View Freelancer", "View Freelancer Rates", "View Client",
    "View Calculator", "Use Calculator", "Export Quote", "Manage Language Rates", "Manage Service Rates",
    "View Project Request", "Manage Price Requests", "View Contact Message", "Reply Contact Message",
  ],
  "Finance": [
    "View Home", "View Home KPIs", "View Finance Overview",
    "View Finance", "Export Finance Data",
    "View Client Invoices", "Create Client Invoice", "Update Client Invoice", "Delete Client Invoice",
    "View Freelancer Invoices", "Create Freelancer Invoice", "Update Freelancer Invoice", "Delete Freelancer Invoice",
    "View Projects Ledger", "Manage Projects Ledger", "View Project Costs & Profit",
    "View Payroll", "Manage Payroll", "Approve Payroll", "View Maintenance", "Manage Maintenance",
    "View Company Capital", "Update Company Capital", "Export Capital Transactions",
    "Add Capital Entry", "Add Capital Adjustment", "Transfer Reserve", "Reverse Capital Transaction",
    "Export Company Capital Backup",
    "Export Client Invoices Backup", "Export Freelancer Invoices Backup",
    "Export Projects Ledger Backup", "Export Payroll Backup", "Export Maintenance Backup",
    "View Client", "View Client Financials",
  ],
};

// Acting-role preview: lets an admin preview the dashboard AS another role
// without changing the logged-in user. Permission checks (`can`) read this;
// the logged-in user shown in the sidebar stays the real admin.
function WT_getActingRole() { try { return localStorage.getItem("wt_acting_role") || null; } catch (e) { return null; } }
function WT_setActingRole(name) {
  try { if (name) localStorage.setItem("wt_acting_role", name); else localStorage.removeItem("wt_acting_role"); } catch (e) {}
  // force a reactive re-render so visibility updates immediately
  if (typeof DB !== "undefined" && DB.set) DB.set((s) => ({ ...s }));
}
// Central permission check. Administrator is always all-access.
function can(db, perm) {
  const roleName = WT_getActingRole() || (currentUser(db).role) || "";
  if (roleName === "Administrator") return true;
  const role = ((db && db.roles) || []).find((r) => r.name === roleName);
  return !!(role && (role.permissions || []).includes(perm));
}
function canAny(db, perms) { return perms.some((p) => can(db, p)); }

function _dISO(off) { const x = new Date(); x.setDate(x.getDate() + off); return x.toISOString().slice(0, 10); }
function _mkMediaP(names) { return names.map((n, i) => ({ id: Date.now() + i + Math.random(), original_name: n, file_status: i % 2 ? "Update" : "DTP", note: "", created_at: _dISO(-3 - i), updated_at: _dISO(-1) })); }

// Build the 8 production workflow stages for a task. `progress` = number of
// completed stages (0..8); the stage at index === progress (when > 0) is In Progress.
function wtDefaultWorkflow(task, progress) {
  const today = new Date().toISOString().slice(0, 10);
  const sd = (task && task.start_date) || today;
  return WT_WORKFLOW_STAGES.map((name, i) => {
    let status = "Not Started";
    if (i < progress) status = "Completed";
    else if (i === progress && progress > 0) status = "In Progress";
    return {
      n: i + 1, name, status,
      started: i <= progress && progress > 0 ? sd : "",
      completed: i < progress ? sd : "",
      owner: i < progress ? ((task && task.creator) || "Samar Ali") : "",
      client_note: "", internal_note: "",
      updated_at: today, updated_by: (task && task.creator) || "Samar Ali",
    };
  });
}
function _progressFor(status) { return status === "completed" ? 8 : status === "in_progress" ? 4 : 1; }

// Demo projects/tasks for the portal's linked client (Sahara Telecom · WT-C-0004).
function demoClientTasks() {
  const mk = (t) => { const ws = wtDefaultWorkflow(t, t._p); const { _p, ...rest } = t; return { ...rest, workflowStages: ws }; };
  return [
    mk({ id: 6, _p: 4, task_number: "T-26-0006", title: "Marketing Brochure 2026", client_code: "WT-C-0004", reference_number: "UAE0004", status: "in_progress", page_numbers: "8", words_count: "1,600", start_date: _dISO(-3), end_date: _dISO(10), start_time: "09:00", end_time: "18:00", notes: "Please deliver back in Bilingual Format.", link: "", file_status: "DTP", language_pair: [{ source: "en", target: "ar" }, { source: "en", target: "fr" }], freelancer_codes: ["WT-F-0002"], service_ids: [1, 5], creator: "Samar Ali", created_at: _dISO(-5), media: _mkMediaP(["brochure_source_EN.pdf", "brand_guidelines.pdf"]) }),
    mk({ id: 7, _p: 8, task_number: "T-26-0007", title: "Product Catalogue Q1", client_code: "WT-C-0004", reference_number: "UAE0007", status: "completed", page_numbers: "24", words_count: "6,400", start_date: _dISO(-30), end_date: _dISO(-6), start_time: "09:00", end_time: "18:00", notes: "Delivered, awaiting feedback.", link: "", file_status: "Complete", language_pair: [{ source: "en", target: "ar" }], freelancer_codes: ["WT-F-0001"], service_ids: [1, 6], creator: "Samar Ali", created_at: _dISO(-32), media: _mkMediaP(["catalogue_AR_final.pdf"]) }),
    mk({ id: 8, _p: 0, task_number: "T-26-0008", title: "Corporate Website Localization", client_code: "WT-C-0004", reference_number: "UAE0008", status: "pending", page_numbers: "\u2014", words_count: "9,000", start_date: _dISO(2), end_date: _dISO(20), start_time: "09:00", end_time: "18:00", notes: "Awaiting quotation approval.", link: "https://saharatelecom.com", file_status: "Pending", language_pair: [{ source: "en", target: "fr" }], freelancer_codes: [], service_ids: [2], creator: "Samar Ali", created_at: _dISO(-2), media: [] }),
  ];
}

// Demo price requests for the linked client — including quotes awaiting/after approval.
function demoClientRequests() {
  const now = new Date().toISOString();
  return [
    { id: 4, first_name: "Omar", last_name: "Faris", email: "portal@saharatelecom.com", client_code: "WT-C-0004", source: "Client Portal", source_language: "en", target_language: "ar", preferred_payment_type: "Bank transfer", currency: "USD", project_name: "Annual Report 2026", project_link: "", time_zone: "GMT+4 Dubai", start_date: _dISO(3), start_date_time: "09:00", end_date: _dISO(17), end_date_time: "17:00", description: "Full annual report, ~9,000 words EN\u2192AR with DTP to match the English layout.", status: "quoted", service_ids: [1, 5], created_at: _dISO(-4), media: _mkMediaP(["annual_report_EN.pdf"]), quote: { amount: 1850, currency: "USD", valid_until: _dISO(11), services: [1, 5], client_note: "Includes Arabic DTP to mirror the English layout. 50% deposit to start.", internal_note: "Estimated margin ~46%.", sent_at: now, sent_by: "Nour El-Din" }, activity: [{ at: now, by: "Nour El-Din", text: "Quote sent to client \u2014 $1,850.00" }] },
    { id: 5, first_name: "Omar", last_name: "Faris", email: "portal@saharatelecom.com", client_code: "WT-C-0004", source: "Client Portal", source_language: "en", target_language: "fr", preferred_payment_type: "PayPal", currency: "USD", project_name: "Investor Deck", project_link: "", time_zone: "GMT+4 Dubai", start_date: _dISO(-12), start_date_time: "09:00", end_date: _dISO(-4), end_date_time: "17:00", description: "30-slide investor deck EN\u2192FR, transcreation tone.", status: "accepted", service_ids: [1, 7], created_at: _dISO(-14), media: [], quote: { amount: 720, currency: "USD", valid_until: _dISO(-2), services: [1, 7], client_note: "Transcreation of all slides to match the brand voice.", sent_at: _dISO(-13) + "T09:00:00Z", sent_by: "Nour El-Din", accepted_at: _dISO(-11) + "T10:00:00Z" }, activity: [{ at: _dISO(-13) + "T09:00:00Z", by: "Nour El-Din", text: "Quote sent \u2014 $720.00" }, { at: _dISO(-11) + "T10:00:00Z", by: "Omar Faris", text: "Client accepted the quote." }] },
    { id: 6, first_name: "Omar", last_name: "Faris", email: "portal@saharatelecom.com", client_code: "WT-C-0004", source: "Client Portal", source_language: "en", target_language: "ar", preferred_payment_type: "Bank transfer", currency: "USD", project_name: "Press Release Batch", project_link: "", time_zone: "GMT+4 Dubai", start_date: _dISO(1), start_date_time: "10:00", end_date: _dISO(6), end_date_time: "12:00", description: "Six press releases EN\u2192AR, fast turnaround.", status: "pending", service_ids: [1], created_at: _dISO(-1), media: [], quote: null, activity: [] },
  ];
}

// Idempotent, non-destructive backfill so older saved stores gain Client Portal
// demo data + workflow without losing anything the user has entered.
function ensurePortalData(s) {
  s = { ...s };
  // After a Full Test Data Reset the operational tables are intentionally
  // empty — never re-inject demo records into a reset store.
  const wasFullReset = !!s.wtFullResetAt;
  s.tasks = (s.tasks || []).map((t) => t.workflowStages ? t : { ...t, workflowStages: wtDefaultWorkflow(t, _progressFor(t.status)) });
  if (!wasFullReset && !s.tasks.some((t) => t.client_code === "WT-C-0004")) {
    const base = Math.max(0, ...s.tasks.map((x) => x.id || 0)) + 1;
    s.tasks = [...demoClientTasks().map((t, i) => ({ ...t, id: base + i })), ...s.tasks];
  }
  s.projectRequests = (s.projectRequests || []).map((r) => r.quote === undefined ? { ...r, quote: null, activity: r.activity || [] } : r);
  if (!wasFullReset && !s.projectRequests.some((r) => r.source === "Client Portal")) {
    const base = Math.max(0, ...s.projectRequests.map((x) => x.id || 0)) + 1;
    s.projectRequests = [...demoClientRequests().map((r, i) => ({ ...r, id: base + i })), ...s.projectRequests];
  }
  // Roles: keep everything users already granted (additive only). Administrator
  // always gets the full catalog; built-in roles gain sensible defaults the
  // first time they're seen. Never removes an existing permission.
  s.roles = (s.roles || []).map((r) => {
    if (r.name === "Administrator") return { ...r, permissions: Array.from(new Set([...(r.permissions || []), ...WT_ALL_PERMS, ...WT_CLIENT_PORTAL_PERMISSIONS])) };
    if (WT_ROLE_DEFAULTS[r.name] && !r._defaultsApplied) return { ...r, _defaultsApplied: true, permissions: Array.from(new Set([...(r.permissions || []), ...WT_ROLE_DEFAULTS[r.name]])) };
    return r;
  });
  if (!s.roles.some((r) => r.name === "Client")) {
    s.roles = [...s.roles, { id: Math.max(0, ...s.roles.map((x) => x.id || 0)) + 1, name: "Client", permissions: [...WT_CLIENT_PORTAL_PERMISSIONS], created_at: _dISO(-60) }];
  }
  if (!s.users.some((u) => u.role === "Client")) {
    s.users = [{ id: Math.max(0, ...s.users.map((x) => x.id || 0)) + 1, name: "Omar Faris", email: "portal@saharatelecom.com", role: "Client", status: "active", phone: "+971 4 220 9981", created_at: _dISO(-60), linkedClientCode: "WT-C-0004" }, ...s.users];
  }
  return s;
}

// ---------------------------------------------------------------- seed
function seed() {
  const services = [
    { id: 1, name: "Translation", status: "active", description: "Human translation by native experts across 120+ languages.", icon: null },
    { id: 2, name: "Localization", status: "active", description: "Adapting software, apps and websites to local markets and culture.", icon: null },
    { id: 3, name: "Transcription", status: "active", description: "Accurate audio and video transcription in source and target languages.", icon: null },
    { id: 4, name: "Subtitling", status: "active", description: "Subtitles and captions, time-coded for video and media.", icon: null },
    { id: 5, name: "Desktop Publishing (DTP)", status: "active", description: "Desktop publishing and multilingual typesetting, Arabic-first.", icon: null },
    { id: 6, name: "Proofreading", status: "active", description: "Independent review and quality assurance of translated copy.", icon: null },
    { id: 7, name: "Transcreation", status: "active", description: "Creative adaptation of marketing and brand copy for local audiences.", icon: null },
    { id: 8, name: "QA & Testing", status: "active", description: "Linguistic and functional QA for software, apps and games.", icon: null },
    { id: 9, name: "Design Book", status: "active", description: "Layout and design of bilingual books and publications.", icon: null },
    { id: 10, name: "E-Learning", status: "active", description: "Localization of courses, LMS content and learning materials.", icon: null },
    { id: 11, name: "Video Editing", status: "active", description: "Editing, post-production and burning-in of localized video.", icon: null },
    { id: 12, name: "Voiceover", status: "active", description: "Professional voiceover and dubbing in multiple languages.", icon: null },
    { id: 13, name: "Ai Solutions", status: "active", description: "AI-assisted translation, MT post-editing and automation.", icon: null },
    { id: 14, name: "Typing", status: "active", description: "Multilingual typing and data entry, Arabic and Latin scripts.", icon: null },
  ];

  const clients = [
    { id: 1, client_code: "WT-C-0001", name: "Nile Media Group", email: "ops@nilemedia.com", phone: "+20 100 220 1180", agency: "In-house", currency: "USD", notes: "Priority client — media & broadcast localization." },
    { id: 2, client_code: "WT-C-0002", name: "Cairo Legal Partners", email: "contracts@clp-law.com", phone: "+20 122 555 0192", agency: "—", currency: "EGP", notes: "NDA on file. Legal terminology must match approved glossary." },
    { id: 3, client_code: "WT-C-0003", name: "Lumen Health", email: "localization@lumenhealth.io", phone: "+1 415 880 3321", agency: "Acclaro", currency: "USD", notes: "Regulated medical content — needs back-translation." },
    { id: 4, client_code: "WT-C-0004", name: "Sahara Telecom", email: "vendor@saharatelecom.com", phone: "+971 4 220 9981", agency: "—", currency: "USD", notes: "" },
    { id: 5, client_code: "WT-C-0005", name: "Olive & Co.", email: "hello@oliveandco.eg", phone: "+20 109 776 4410", agency: "—", currency: "EGP", notes: "Marketing & brand voice. Loves transcreation." },
    { id: 6, client_code: "WT-C-0006", name: "Meridian Games", email: "loc@meridian.gg", phone: "+44 20 7946 0322", agency: "—", currency: "USD", notes: "Game localization, fast turnarounds." },
    { id: 7, client_code: "WT-C-0007", name: "Al-Majd Media", email: "k.hassan@almajd.com", phone: "+966 11 220 4400", agency: "In-house", currency: "SAR", notes: "VIP client · Net 30 · Khaled Hassan." },
    { id: 8, client_code: "WT-C-0008", name: "Dubai Gov Portal", email: "f.rashidi@dubai.gov.ae", phone: "+971 4 555 0192", agency: "—", currency: "AED", notes: "Government account · Net 14 · Fatima Al-Rashidi." },
    { id: 9, client_code: "WT-C-0009", name: "LexCorp International", email: "j.smith@lexcorp.com", phone: "+1 212 880 3321", agency: "—", currency: "USD", notes: "Legal documents · Net 45 · John Smith." },
  ];

  const freelancers = [
    { id: 1, freelancer_code: "WT-F-0001", name: "Layla Hassan", email: "layla.h@gmail.com", phone: "+20 100 111 2233", company: "TransPerfect", quota: "2500 w/day", price_hr: 18, currency: "USD", notes: "Senior AR↔EN legal & medical.", service_ids: [1,6], language_pair: [{source:"en",target:"ar"},{source:"ar",target:"en"}] },
    { id: 2, freelancer_code: "WT-F-0002", name: "Marc Dubois", email: "marc.dubois@protonmail.com", phone: "+33 6 12 44 88 21", company: "Acclaro", quota: "3000 w/day", price_hr: 22, currency: "USD", notes: "EN↔FR marketing transcreation.", service_ids: [1,2], language_pair: [{source:"en",target:"fr"},{source:"fr",target:"en"}] },
    { id: 3, freelancer_code: "WT-F-0003", name: "Yuki Tanaka", email: "yuki.t@outlook.com", phone: "+81 90 1234 5678", company: "Keywords Studios", quota: "2000 w/day", price_hr: 26, currency: "USD", notes: "Game & software localization JA.", service_ids: [2,4], language_pair: [{source:"en",target:"ja"}] },
    { id: 4, freelancer_code: "WT-F-0004", name: "Sofia Marín", email: "sofia.marin@gmail.com", phone: "+34 612 998 220", company: "Acclaro", quota: "3500 w/day", price_hr: 16, currency: "USD", notes: "ES subtitling & media.", service_ids: [1,4], language_pair: [{source:"en",target:"es"},{source:"es",target:"en"}] },
    { id: 5, freelancer_code: "WT-F-0005", name: "Omar Khalil", email: "omar.k@gmail.com", phone: "+20 128 440 9911", company: "TransPerfect", quota: "DTP", price_hr: 14, currency: "USD", notes: "Arabic DTP / InDesign specialist.", service_ids: [5], language_pair: [{source:"en",target:"ar"}] },
    { id: 6, freelancer_code: "WT-F-0006", name: "Ahmed Hassan", email: "ahmed.h@email.com", phone: "+20 100 440 2210", company: "Lionbridge", quota: "2500 w/day", price_hr: 17, currency: "USD", notes: "EN↔AR legal specialist · Bank Transfer.", service_ids: [1,6], language_pair: [{source:"en",target:"ar"}] },
    { id: 7, freelancer_code: "WT-F-0007", name: "Sara Khalil", email: "sara.k@email.com", phone: "+20 122 660 1180", company: "Lionbridge", quota: "2200 w/day", price_hr: 20, currency: "USD", notes: "EN↔AR medical · PayPal.", service_ids: [1,6], language_pair: [{source:"en",target:"ar"}] },
    { id: 8, freelancer_code: "WT-F-0008", name: "Ezzat Mahmoud", email: "ezzat.m@email.com", phone: "+20 111 220 9900", company: "Keywords Studios", quota: "2600 w/day", price_hr: 18, currency: "USD", notes: "AR↔EN technical · Wise · Preferred vendor.", service_ids: [1,8], language_pair: [{source:"ar",target:"en"}] },
  ];

  const today = new Date();
  const d = (off) => { const x = new Date(today); x.setDate(x.getDate()+off); return x.toISOString().slice(0,10); };

  const mkMedia = (names) => names.map((n,i)=>({ id: Date.now()+i+Math.random(), original_name: n, file_status: i%2? "Update":"DTP", note: "", created_at: d(-3-i), updated_at: d(-1) }));

  const tasks = [
    { id: 1, task_number: "T-26-0001", client_code: "WT-C-0001", reference_number: "", status: "in_progress", page_numbers: "24", words_count: "8,420", start_date: d(-4), end_date: d(3), start_time: "09:00", end_time: "18:00", notes: "Broadcast promo package — tight QA loop.", link: "", file_status: "DTP", language_pair: [{source:"en",target:"ar"}], freelancer_codes: ["WT-F-0001"], service_ids: [1,4], creator: "Mariam Adel", created_at: d(-4), media: mkMedia(["promo_script_EN.docx","promo_script_AR_v2.docx"]) },
    { id: 2, task_number: "T-26-0002", client_code: "WT-C-0002", reference_number: "", status: "pending", page_numbers: "12", words_count: "3,100", start_date: d(-1), end_date: d(5), start_time: "10:00", end_time: "17:00", notes: "Contract set — must follow legal glossary.", link: "", file_status: "DTP", language_pair: [{source:"ar",target:"en"}], freelancer_codes: ["WT-F-0001"], service_ids: [1,6], creator: "Mariam Adel", created_at: d(-1), media: [] },
    { id: 3, task_number: "T-26-0003", client_code: "WT-C-0006", reference_number: "", status: "completed", page_numbers: "—", words_count: "15,800", start_date: d(-14), end_date: d(-2), start_time: "08:00", end_time: "20:00", notes: "Game UI + dialogue, JA build.", link: "https://meridian.gg/build/2261", file_status: "Update", language_pair: [{source:"en",target:"ja"}], freelancer_codes: ["WT-F-0003"], service_ids: [2], creator: "Karim Fouad", created_at: d(-14), media: mkMedia(["strings_en.json","strings_ja.json","glossary.xlsx"]) },
    { id: 4, task_number: "T-26-0004", client_code: "WT-C-0005", reference_number: "", status: "in_progress", page_numbers: "6", words_count: "1,250", start_date: d(-2), end_date: d(2), start_time: "11:00", end_time: "16:00", notes: "Brand campaign transcreation FR.", link: "", file_status: "DTP", language_pair: [{source:"en",target:"fr"}], freelancer_codes: ["WT-F-0002"], service_ids: [1,2], creator: "Mariam Adel", created_at: d(-2), media: [] },
    { id: 5, task_number: "T-26-0005", client_code: "WT-C-0003", reference_number: "", status: "pending", page_numbers: "40", words_count: "12,000", start_date: d(0), end_date: d(10), start_time: "09:00", end_time: "18:00", notes: "Medical IFU — back-translation required.", link: "", file_status: "DTP", language_pair: [{source:"en",target:"es"},{source:"en",target:"ar"}], freelancer_codes: ["WT-F-0004","WT-F-0001"], service_ids: [1,6], creator: "Karim Fouad", created_at: d(0), media: [] },
    ...demoClientTasks(),
  ];
  tasks.forEach((t) => { if (!t.workflowStages) t.workflowStages = wtDefaultWorkflow(t, _progressFor(t.status)); });

  const clientPOs = [
    { id: 1, task_id: 3, po_number: "PO-26-0001", amount: 2370, currency: "USD", date: d(-13), notes: "50% upfront." },
  ];
  const vendorPOs = [
    { id: 1, task_id: 3, po_number: "PO-26-0002", freelancer_code: "WT-F-0003", amount: 1100, currency: "USD", date: d(-13), notes: "" },
  ];

  const projectRequests = [
    { id: 1, first_name: "Hana", last_name: "Yousef", email: "hana@brightstart.org", source_language: "en", target_language: "ar", preferred_payment_type: "Bank transfer", currency: "USD", project_name: "NGO Annual Report", project_link: "https://brightstart.org/report", time_zone: "GMT+2 Cairo", start_date: d(2), start_date_time:"09:00", end_date: d(9), end_date_time:"17:00", description: "Annual report, ~9,000 words, EN→AR with DTP to match the English layout.", status: "pending", service_ids: [1,5], created_at: d(-1), media: [] },
    { id: 2, first_name: "Tom", last_name: "Becker", email: "tom.becker@finceptual.com", source_language: "en", target_language: "de", preferred_payment_type: "PayPal", currency: "USD", project_name: "Fintech App Store Listing", project_link: "", time_zone: "GMT+1 Berlin", start_date: d(1), start_date_time:"10:00", end_date: d(4), end_date_time:"12:00", description: "App store metadata and screenshots localization EN→DE.", status: "in_progress", service_ids: [2], created_at: d(-2), media: mkMedia(["aso_strings.csv"]) },
    { id: 3, first_name: "Reem", last_name: "Saleh", email: "reem@medplus.eg", source_language: "ar", target_language: "en", preferred_payment_type: "Bank transfer", currency: "EGP", project_name: "Clinic Website Copy", project_link: "https://medplus.eg", time_zone: "GMT+2 Cairo", start_date: d(-5), start_date_time:"09:00", end_date: d(-1), end_date_time:"18:00", description: "Website copy, AR→EN, ~4,000 words.", status: "completed", service_ids: [1], created_at: d(-6), media: [], quote: null, activity: [] },
    ...demoClientRequests(),
  ];

  const contactMessages = [
    { id: 1, name: "Daniel Okoro", email: "daniel@savannah.africa", subject: "Bulk translation pricing", message: "Hi, we have roughly 200,000 words of e-learning content to translate into French and Swahili. Could you share volume pricing and turnaround?", created_at: d(0) },
    { id: 2, name: "Aya Mostafa", email: "aya.m@gmail.com", subject: "Certified translation question", message: "Do you provide certified translations accepted by embassies? I need my academic transcripts translated AR→EN.", created_at: d(-1) },
    { id: 3, name: "Greg Hall", email: "greg@northwind.io", subject: "Partnership", message: "We're an agency looking for an Arabic-first vendor. Would love to explore a partnership.", created_at: d(-3) },
  ];

  const clientInvoices = [
    { id: 1, invoice_code: "INV-C-26-0001", task_code: "T-26-0003", client_code: "WT-C-0006", date_20: d(-13), date_80: d(-2), payment_20: 474, payment_80: 1896, total_price: 2370, status: "completed", currency: "USD", media: mkMedia(["INV-2261.pdf"]) },
    { id: 2, invoice_code: "INV-C-26-0002", task_code: "T-26-0001", client_code: "WT-C-0001", date_20: d(-4), date_80: null, payment_20: 320, payment_80: 1280, total_price: 1600, status: "in_progress", currency: "USD", media: [] },
    { id: 3, invoice_code: "INV-C-26-0003", task_code: "T-26-0002", client_code: "WT-C-0002", date_20: null, date_80: null, payment_20: 0, payment_80: 0, total_price: 9300, status: "pending", currency: "EGP", media: [] },
  ];
  const freelancerInvoices = [
    { id: 1, invoice_code: "INV-F-26-0001", task_code: "T-26-0003", freelancer_code: "WT-F-0003", date_20: d(-13), date_80: d(-2), payment_20: 220, payment_80: 880, total_price: 1100, status: "completed", currency: "USD", media: [] },
    { id: 2, invoice_code: "INV-F-26-0002", task_code: "T-26-0001", freelancer_code: "WT-F-0001", date_20: d(-4), date_80: null, payment_20: 150, payment_80: 600, total_price: 750, status: "in_progress", currency: "USD", media: [] },
  ];

  const revenues = [
    { id: 1, total_usd: 8420, total_egp: 142000, month: d(-1).slice(0,7)+"-01", sheets: [] },
    { id: 2, total_usd: 6110, total_egp: 98500, month: d(-32).slice(0,7)+"-01", sheets: [{id:91, original_name:"revenue_apr.xlsx"}] },
  ];
  const expenses = [
    { id: 1, total_usd: 3200, total_egp: 61000, month: d(-1).slice(0,7)+"-01", sheets: [] },
    { id: 2, total_usd: 2780, total_egp: 52300, month: d(-32).slice(0,7)+"-01", sheets: [] },
  ];
  const companyCapital = { total_capital_egp: 480000, temporary_capital_egp: 312000, emergency_capital_egp: 90000, total_capital_usd: 26500, temporary_capital_usd: 17200, emergency_capital_usd: 5000 };

  // ---- Company Capital: cash-based Capital Ledger (source of truth) ----
  // Reserves and opening balance are themselves posted transactions so the
  // whole history is auditable. Module cash events (invoice payments, payroll,
  // maintenance) are posted by the reconciler on top of these.
  const _capYY = new Date().getFullYear().toString().slice(-2);
  const _capNow = today.toISOString();
  const capitalMeta = { base_currency: "EGP", usd_rate: 50, opening_egp: 480000 };
  const capitalLedger = [
    { id: 3, txn_code: `CT-${_capYY}-0003`, date: d(-60), type: "Transfer", direction: "Internal", source: "Reserve Transfer", reference: "OPENING-RES", description: "Opening temporary reserve balance", amount: 312000, currency: "EGP", rate: 1, base_amount: 312000, reserve: "temporary", reserve_dir: "to", created_by: "Nour El-Din", posted_at: _capNow, status: "Posted", source_type: "opening_reserve", source_id: "TEMP", source_part: "", reason: "", notes: "Migrated from previous Temporary Capital.", locked: true },
    { id: 2, txn_code: `CT-${_capYY}-0002`, date: d(-60), type: "Transfer", direction: "Internal", source: "Reserve Transfer", reference: "OPENING-RES", description: "Opening emergency reserve balance", amount: 90000, currency: "EGP", rate: 1, base_amount: 90000, reserve: "emergency", reserve_dir: "to", created_by: "Nour El-Din", posted_at: _capNow, status: "Posted", source_type: "opening_reserve", source_id: "EMER", source_part: "", reason: "", notes: "Migrated from previous Emergency Capital.", locked: true },
    { id: 1, txn_code: `CT-${_capYY}-0001`, date: d(-60), type: "Income", direction: "In", source: "Opening", reference: "OPENING", description: "Opening capital balance (migrated)", amount: 480000, currency: "EGP", rate: 1, base_amount: 480000, reserve: "", reserve_dir: "", created_by: "Nour El-Din", posted_at: _capNow, status: "Posted", source_type: "opening", source_id: "OPENING", source_part: "", reason: "", notes: "Carried over from previous Total Capital.", locked: true },
  ];

  // ---- Maintenance: operating / recurring business expenses ----
  const maintenance = [
    { id: 1, maintenance_id: "MNT-26-0001", service_name: "ChatGPT Plus (Team)", payment_date: d(-12), amount: 60, currency: "USD", payment_method: "Wallet", status: "Paid", billing_cycle: "Monthly", vendor: "OpenAI", renewal_date: d(18), notes: "AI subscription for the localization team.", attachment: null },
    { id: 2, maintenance_id: "MNT-26-0002", service_name: "Website Hosting & Domain", payment_date: d(-34), amount: 4200, currency: "EGP", payment_method: "Bank Transfer", status: "Paid", billing_cycle: "Yearly", vendor: "Hostinger", renewal_date: d(331), notes: "Annual hosting + words-tie.com domain.", attachment: null },
    { id: 3, maintenance_id: "MNT-26-0003", service_name: "Adobe Creative Cloud", payment_date: d(-4), amount: 80, currency: "USD", payment_method: "InstaPay", status: "Pending", billing_cycle: "Monthly", vendor: "Adobe", renewal_date: d(26), notes: "DTP team licenses (InDesign, Photoshop).", attachment: null },
    { id: 4, maintenance_id: "MNT-26-0004", service_name: "Trados Studio License", payment_date: d(3), amount: 320, currency: "USD", payment_method: "Bank Transfer", status: "Upcoming", billing_cycle: "One-time", vendor: "RWS", renewal_date: "", notes: "CAT tool seat for senior linguist.", attachment: null },
    { id: 5, maintenance_id: "MNT-26-0005", service_name: "Office Internet (Fiber)", payment_date: d(-2), amount: 950, currency: "EGP", payment_method: "Vodafone Cash", status: "Paid", billing_cycle: "Monthly", vendor: "WE", renewal_date: d(28), notes: "", attachment: null },
  ];

  // ---- Employees: internal team & staff records ----
  const employees = [
    { id: 1, employee_code: "WT-E-0001", name: "Samar Ali", job_title: "Senior Project Manager", email: "samar@words-tie.com", phone: "+20 100 220 3344", start_date: d(-420), salary: 18000, currency: "EGP", payment_method: "Bank Transfer", bank_details: "NBE ****1180", status: "Active", department: "Operations", employment_type: "Full-time", national_id: "", emergency_contact: "+20 100 555 0011", end_date: "", notes: "Leads delivery & QA across legal/medical accounts.", attachment: null },
    { id: 2, employee_code: "WT-E-0002", name: "Nour El-Din", job_title: "Finance Officer", email: "nour@words-tie.com", phone: "+20 109 888 7766", start_date: d(-300), salary: 15000, currency: "EGP", payment_method: "InstaPay", bank_details: "InstaPay · nour@instapay", status: "Active", department: "Finance", employment_type: "Full-time", national_id: "", emergency_contact: "", end_date: "", notes: "Owns invoicing, capital and maintenance ledgers.", attachment: null },
    { id: 3, employee_code: "WT-E-0003", name: "Hassan Ali", job_title: "Localization Engineer", email: "hassan@words-tie.com", phone: "+20 111 222 3344", start_date: d(-140), salary: 1200, currency: "USD", payment_method: "Wise", bank_details: "Wise · hassan.ali", status: "On Leave", department: "Production", employment_type: "Contract", national_id: "", emergency_contact: "", end_date: "", notes: "", attachment: null },
  ];

  const industries = [
    { id: 1, name: "E-Learning & Education", status: "active", description: "Courses, LMS content and academic material." },
    { id: 2, name: "Technology", status: "active", description: "Software, SaaS, hardware and IT documentation." },
    { id: 3, name: "Gaming", status: "active", description: "UI, dialogue and store localization." },
    { id: 4, name: "Medical", status: "active", description: "Clinical, regulatory and patient-facing content." },
    { id: 5, name: "Finance", status: "active", description: "Banking, fintech and investment material." },
    { id: 6, name: "Government", status: "active", description: "Public sector, policy and official documents." },
    { id: 7, name: "Legal", status: "active", description: "Contracts, litigation and certified documents." },
    { id: 8, name: "Sciences", status: "active", description: "Research, academic and technical papers." },
    { id: 9, name: "Marketing", status: "active", description: "Transcreation and brand voice." },
    { id: 10, name: "E-Commerce", status: "active", description: "Product catalogs, storefronts and listings." },
    { id: 11, name: "Manufacturing & Engineering", status: "active", description: "Manuals, specs and technical engineering docs." },
    { id: 12, name: "Automotive", status: "active", description: "Vehicle manuals, UI and service content." },
    { id: 13, name: "Military", status: "active", description: "Defense, security and mission-critical material." },
    { id: 14, name: "AI", status: "active", description: "AI-assisted translation, MT post-editing and automation." },
  ];

  const clientPartners = [
    { id: 1, name: "Nile Media Group", url: "https://nilemedia.com", logo: null },
    { id: 2, name: "Lumen Health", url: "https://lumenhealth.io", logo: null },
    { id: 3, name: "Meridian Games", url: "https://meridian.gg", logo: null },
    { id: 4, name: "Sahara Telecom", url: "https://saharatelecom.com", logo: null },
  ];

  const iosImages = [
    { id: 1, title: "Onboarding — RTL", status: "active", image: null },
    { id: 2, title: "App Store Hero", status: "active", image: null },
    { id: 3, title: "Settings — Dark", status: "inactive", image: null },
  ];

  const testimonials = [
    { id: 1, name: "Sarah Whitman", role: "Head of Loc, Meridian Games", quote: "Words Tie turned around 16k words of JA dialogue in five days — clean, in-context, zero QA flags.", status: "active" },
    { id: 2, name: "Dr. Amir Saad", role: "Regulatory Lead, Lumen Health", quote: "Their back-translation workflow gave our reviewers exactly what they needed for approval.", status: "active" },
    { id: 3, name: "Olivia Grant", role: "Brand Director, Olive & Co.", quote: "The transcreation actually sounded like our brand in French. Rare.", status: "inactive" },
  ];

  const users = [
    { id: 1, name: "Mariam Adel", email: "mariam@words-tie.com", role: "Administrator", status: "active", phone: "+20 100 000 1111", created_at: d(-220) },
    { id: 2, name: "Karim Fouad", email: "karim@words-tie.com", role: "Project Manager", status: "active", phone: "+20 122 333 4455", created_at: d(-180) },
    { id: 3, name: "Nour El-Din", email: "nour@words-tie.com", role: "Finance", status: "active", phone: "+20 109 888 7766", created_at: d(-95) },
    { id: 4, name: "Hassan Ali", email: "hassan@words-tie.com", role: "Project Manager", status: "inactive", phone: "+20 111 222 3344", created_at: d(-40) },
    { id: 5, name: "Omar Faris", email: "portal@saharatelecom.com", role: "Client", status: "active", phone: "+971 4 220 9981", created_at: d(-60), linkedClientCode: "WT-C-0004" },
  ];

  const roles = [
    { id: 1, name: "Administrator", permissions: ["View Task","Create Task","Update Task","Delete Task","View Client","View Finance","View User","Update Setting","View Role", ...WT_CLIENT_PORTAL_PERMISSIONS], created_at: d(-220) },
    { id: 2, name: "Project Manager", permissions: ["View Task","Create Task","Update Task","View Client","View Freelancer","View Project Request"], created_at: d(-180) },
    { id: 3, name: "Finance", permissions: ["View Finance","View Revenue","View Expense","Update Company Capital","View Client"], created_at: d(-95) },
    { id: 4, name: "Client", permissions: [...WT_CLIENT_PORTAL_PERMISSIONS], created_at: d(-60) },
  ];

  const settings = [
    { id: 1, label: "Company Email", value: "hello@words-tie.com", type: "email" },
    { id: 2, label: "Support Email", value: "support@words-tie.com", type: "email" },
    { id: 3, label: "Phone", value: "+20 100 220 1180", type: "text" },
    { id: 4, label: "Address", value: "Maadi, Cairo, Egypt", type: "text" },
    { id: 5, label: "Website", value: "https://words-tie.com", type: "url" },
    { id: 6, label: "LinkedIn", value: "https://linkedin.com/company/words-tie", type: "url" },
    { id: 7, label: "Working Hours", value: "Sun–Thu, 09:00–18:00 (GMT+2)", type: "text" },
    { id: 8, label: "Default Currency", value: "USD", type: "text" },
  ];

  // ---- Operations: Projects ledger (from System v2.xlsx · 📋 Projects) ----
  // client_amount = volume*client_rate · fl_cost = volume*fl_rate · profit = client_amount-fl_cost (computed live)
  const projects = [
    { id: 1, project_id: "PRJ-2026-0001", task_code: "T-26-0001", date: d(-25), client_name: "Al-Majd Media", pm_name: "Samar Ali", service_type: "Translation", language_pair: "EN>AR", specialization: "Legal", volume: 2500, unit: "Words", client_rate: 0.12, freelancer: "Ahmed Hassan", fl_rate: 0.07, deadline: d(-11), status: "Delivered", invoice_no: "INV-2026-0001", payment_status: "Paid", notes: "Rush delivery" },
    { id: 2, project_id: "PRJ-2026-0002", task_code: "T-26-0002", date: d(-18), client_name: "Dubai Gov Portal", pm_name: "Samar Ali", service_type: "Translation", language_pair: "EN>AR", specialization: "Government", volume: 5000, unit: "Words", client_rate: 0.15, freelancer: "Sara Khalil", fl_rate: 0.09, deadline: d(4), status: "In Progress", invoice_no: "INV-2026-0002", payment_status: "Unpaid", notes: "Portal content batch 1" },
    { id: 3, project_id: "PRJ-2026-0003", task_code: "T-26-0003", date: d(-10), client_name: "LexCorp International", pm_name: "Karim Fouad", service_type: "Translation", language_pair: "AR>EN", specialization: "Legal", volume: 8000, unit: "Words", client_rate: 0.15, freelancer: "Ezzat Mahmoud", fl_rate: 0.08, deadline: d(6), status: "Delivered", invoice_no: "INV-2026-0003", payment_status: "Partially Paid", notes: "50% received" },
    { id: 4, project_id: "PRJ-2026-0004", task_code: "T-26-0004", date: d(-40), client_name: "Nile Media Group", pm_name: "Mariam Adel", service_type: "Subtitling", language_pair: "EN>AR", specialization: "Media", volume: 3200, unit: "Words", client_rate: 0.13, freelancer: "Layla Hassan", fl_rate: 0.07, deadline: d(-30), status: "Delivered", invoice_no: "INV-2026-0004", payment_status: "Paid", notes: "" },
    { id: 5, project_id: "PRJ-2026-0005", task_code: "T-26-0005", date: d(-5), client_name: "Lumen Health", pm_name: "Karim Fouad", service_type: "Translation", language_pair: "EN>AR, EN>ES", specialization: "Medical", volume: 12000, unit: "Words", client_rate: 0.16, freelancer: "Marc Dubois", fl_rate: 0.09, deadline: d(8), status: "In Progress", invoice_no: "INV-2026-0005", payment_status: "Unpaid", notes: "Back-translation required" },
  ];

  // ---- Payments tracker (from System v2.xlsx · 💳 Payments) ----
  const payments = [
    { id: 1, pay_id: "PAY-001", date: d(-20), party: "Al-Majd Media", type: "Incoming", project_id: "PRJ-2026-0001", invoice_no: "INV-2026-0001", amount: 300, currency: "USD", method: "Bank Transfer", notes: "Full payment" },
    { id: 2, pay_id: "PAY-002", date: d(-18), party: "Ahmed Hassan", type: "Outgoing", project_id: "PRJ-2026-0001", invoice_no: "", amount: 175, currency: "USD", method: "Bank Transfer", notes: "Freelancer fee" },
    { id: 3, pay_id: "PAY-003", date: d(-7), party: "LexCorp International", type: "Incoming", project_id: "PRJ-2026-0003", invoice_no: "INV-2026-0003", amount: 600, currency: "USD", method: "Wire Transfer", notes: "50% advance" },
    { id: 4, pay_id: "PAY-004", date: d(-35), party: "Nile Media Group", type: "Incoming", project_id: "PRJ-2026-0004", invoice_no: "INV-2026-0004", amount: 416, currency: "USD", method: "Bank Transfer", notes: "Full payment" },
    { id: 5, pay_id: "PAY-005", date: d(-12), party: "Sara Khalil", type: "Outgoing", project_id: "PRJ-2026-0002", invoice_no: "", amount: 450, currency: "USD", method: "PayPal", notes: "Freelancer fee" },
  ];

  return {
    services, clients, freelancers, tasks, clientPOs, vendorPOs,
    projectRequests, contactMessages, clientInvoices, freelancerInvoices,
    revenues, expenses, companyCapital, industries, clientPartners,
    iosImages, testimonials, users, roles, settings,
    projects, payments, maintenance, employees, payroll: [],
    capitalLedger, capitalMeta,
  };
}

// Build the opening Capital Ledger from a legacy companyCapital record, so
// older saved stores migrate non-destructively into the new ledger system:
// current Total Capital → Opening Capital, reserves → opening reserve wallets.
function migrateCapitalLedger(cc) {
  cc = cc || {};
  const yy = new Date().getFullYear().toString().slice(-2);
  const iso = new Date().toISOString();
  const back = (off) => { const x = new Date(); x.setDate(x.getDate() + off); return x.toISOString().slice(0, 10); };
  const total = +cc.total_capital_egp || 0, emer = +cc.emergency_capital_egp || 0, temp = +cc.temporary_capital_egp || 0;
  const rows = [];
  rows.push({ id: 1, txn_code: `CT-${yy}-0001`, date: back(-60), type: "Income", direction: "In", source: "Opening", reference: "OPENING", description: "Opening capital balance (migrated)", amount: total, currency: "EGP", rate: 1, base_amount: total, reserve: "", reserve_dir: "", created_by: "Nour El-Din", posted_at: iso, status: "Posted", source_type: "opening", source_id: "OPENING", source_part: "", reason: "", notes: "Carried over from previous Total Capital.", locked: true });
  if (emer) rows.push({ id: 2, txn_code: `CT-${yy}-0002`, date: back(-60), type: "Transfer", direction: "Internal", source: "Reserve Transfer", reference: "OPENING-RES", description: "Opening emergency reserve balance", amount: emer, currency: "EGP", rate: 1, base_amount: emer, reserve: "emergency", reserve_dir: "to", created_by: "Nour El-Din", posted_at: iso, status: "Posted", source_type: "opening_reserve", source_id: "EMER", source_part: "", reason: "", notes: "Migrated from previous Emergency Capital.", locked: true });
  if (temp) rows.push({ id: 3, txn_code: `CT-${yy}-0003`, date: back(-60), type: "Transfer", direction: "Internal", source: "Reserve Transfer", reference: "OPENING-RES", description: "Opening temporary reserve balance", amount: temp, currency: "EGP", rate: 1, base_amount: temp, reserve: "temporary", reserve_dir: "to", created_by: "Nour El-Din", posted_at: iso, status: "Posted", source_type: "opening_reserve", source_id: "TEMP", source_part: "", reason: "", notes: "Migrated from previous Temporary Capital.", locked: true });
  return rows.reverse();
}

// ---------------------------------------------------------------- store
let _state = load();
const _subs = new Set();

function load() {
  const s = seed();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Non-destructive migration: keep all saved data, but graft in any
      // top-level collections added in newer versions (e.g. maintenance,
      // employees) so older stores don't crash on missing arrays.
      const merged = { ...s, ...saved };
      for (const k of Object.keys(s)) if (merged[k] === undefined) merged[k] = s[k];
      // Capital Ledger migration: an older store has no capitalLedger — build
      // the opening balance + reserve wallets from its companyCapital values
      // so nothing is lost and current totals carry over as Opening Capital.
      if (!saved.capitalLedger) {
        const cc = saved.companyCapital || s.companyCapital;
        merged.capitalLedger = migrateCapitalLedger(cc);
        merged.capitalMeta = { base_currency: "EGP", usd_rate: 50, opening_egp: +(cc && cc.total_capital_egp) || 0 };
      }
      if (!merged.capitalMeta) merged.capitalMeta = { base_currency: "EGP", usd_rate: 50, opening_egp: 480000 };
      return ensurePortalData(merged);
    }
  } catch (e) {}
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
  return s;
}
function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(_state)); } catch (e) {} }
function emit() { _subs.forEach((fn) => fn()); }

const DB = {
  get: () => _state,
  set: (next) => { _state = typeof next === "function" ? next(_state) : next; persist(); emit(); },
  subscribe: (fn) => { _subs.add(fn); return () => _subs.delete(fn); },
  reset: () => { _state = seed(); persist(); emit(); },
  // Full Test Data Reset (System Management · Danger Zone). Additive:
  // empties ONLY operational demo/test collections and zeroes capital.
  // Users, roles, permissions, settings, services, industries and website
  // content are untouched. Writes an audit entry to db.resetLogs and sets
  // wtFullResetAt so demo data is never re-seeded into the cleared store.
  fullTestDataReset: ({ by, backup_file, resetRates } = {}) => {
    const MODULES = [
      ["capitalLedger", "Capital Transactions"], ["clientInvoices", "Client Invoices"],
      ["freelancerInvoices", "Freelancer Invoices"], ["projects", "Projects Ledger"],
      ["payments", "Payments"], ["payroll", "Payroll"], ["maintenance", "Maintenance"],
      ["tasks", "Tasks"], ["clientPOs", "Task Client POs"], ["vendorPOs", "Task Freelancer POs"],
      ["freelancers", "Freelancers"], ["clients", "Clients"], ["employees", "Employees"],
      ["projectRequests", "Price Requests & Portal Requests"], ["contactMessages", "Contact Messages"],
      ["revenues", "Revenues"], ["expenses", "Expenses"],
    ];
    const s0 = _state;
    const counts = {};
    MODULES.forEach(([k, label]) => { counts[label] = (s0[k] || []).length; });
    if (resetRates) {
      counts["Calculator Language Rates"] = (s0.langRates || []).length;
      counts["Calculator Service Rates"] = (s0.serviceRates || []).length;
    }
    const log = {
      id: ((s0.resetLogs || []).reduce((m, x) => Math.max(m, x.id || 0), 0) + 1),
      type: "Full Test Data Reset",
      by: by || currentUser(s0).name,
      at: new Date().toISOString(),
      backup_file: backup_file || "",
      modules: Object.keys(counts),
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    };
    DB.set((s) => {
      const next = { ...s, wtFullResetAt: log.at, resetLogs: [log, ...(s.resetLogs || [])] };
      MODULES.forEach(([k]) => { next[k] = []; });
      next.companyCapital = { total_capital_egp: 0, temporary_capital_egp: 0, emergency_capital_egp: 0, total_capital_usd: 0, temporary_capital_usd: 0, emergency_capital_usd: 0 };
      next.capitalMeta = { base_currency: "EGP", usd_rate: (s.capitalMeta && s.capitalMeta.usd_rate) || 50, opening_egp: 0 };
      if (resetRates) { delete next.langRates; delete next.serviceRates; }
      return next;
    });
    return log;
  },
  // generic collection helpers ------------------------------------
  nextId: (coll) => (_state[coll].reduce((m, x) => Math.max(m, x.id || 0), 0) + 1),
  insert: (coll, item) => {
    DB.set((s) => ({ ...s, [coll]: [{ ...item, id: item.id ?? (s[coll].reduce((m,x)=>Math.max(m,x.id||0),0)+1) }, ...s[coll]] }));
  },
  update: (coll, id, patch) => {
    DB.set((s) => ({ ...s, [coll]: s[coll].map((x) => x.id === id ? { ...x, ...patch } : x) }));
  },
  remove: (coll, id) => {
    DB.set((s) => ({ ...s, [coll]: s[coll].filter((x) => x.id !== id) }));
  },
  setKey: (key, value) => { DB.set((s) => ({ ...s, [key]: value })); },
  // Zero ONLY the finance transaction data so you can enter your own numbers
  // and test the dashboard from a clean slate. Reference data (clients,
  // freelancers, tasks, employees, projects, services) is kept intact so new
  // invoices and payroll can still link to real entities. No accounting logic
  // is changed — these are just emptied collections.
  resetFinance: () => {
    DB.set((s) => ({
      ...s,
      clientInvoices: [],
      freelancerInvoices: [],
      maintenance: [],
      payroll: [],
      payments: [],
      revenues: [],
      expenses: [],
      capitalLedger: [],
      capitalMeta: { base_currency: "EGP", usd_rate: (s.capitalMeta && s.capitalMeta.usd_rate) || 50, opening_egp: 0 },
      companyCapital: { total_capital_egp: 0, temporary_capital_egp: 0, emergency_capital_egp: 0, total_capital_usd: 0, temporary_capital_usd: 0, emergency_capital_usd: 0 },
    }));
  },
};

function useDB() {
  const state = useSyncExternalStore(DB.subscribe, DB.get);
  return [state, DB];
}

// ---------------------------------------------------------------- code gen
function nextCode(list, field, prefix, pad = 4) {
  const nums = list.map((x) => parseInt(String(x[field] || "").replace(/\D/g, ""), 10) || 0);
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(n).padStart(pad, "0")}`;
}
function nextTaskNumber(list) {
  const yr = new Date().getFullYear().toString().slice(-2);
  const nums = list.map((x) => parseInt(String(x.task_number||"").split("-").pop(), 10) || 0);
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `T-${yr}-${String(n).padStart(4, "0")}`;
}
// Invoice codes like INV-C-26-0004 (client) / INV-F-26-0003 (freelancer).
// Sequence is per-side and per-year; always returns the next free number.
function nextInvoiceCode(list, side) {
  const yr = new Date().getFullYear().toString().slice(-2);
  const tag = side === "freelancer" ? "F" : "C";
  const nums = list.map((x) => {
    const mt = String(x.invoice_code || "").match(/^INV-[CF]-\d{2}-(\d+)$/);
    return mt ? parseInt(mt[1], 10) : 0;
  });
  const n = (nums.length ? Math.max(0, ...nums) : 0) + 1;
  return `INV-${tag}-${yr}-${String(n).padStart(4, "0")}`;
}
// PO numbers like PO-26-0002 — two-digit year, sequence shared across
// client + vendor POs for the year, so numbers never collide across ledgers.
// Tolerates legacy PO-2026-XXXX records when computing the next number.
function nextPONumber() {
  const db = DB.get();
  const yy = new Date().getFullYear().toString().slice(-2);
  const all = [...(db.clientPOs || []), ...(db.vendorPOs || [])];
  const nums = all
    .map((p) => (String(p.po_number || "").match(/^PO-(\d{2,4})-(\d+)$/) || []))
    .filter((m) => m[1] && m[1].slice(-2) === yy)
    .map((m) => parseInt(m[2], 10) || 0);
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `PO-${yy}-${String(n).padStart(4, "0")}`;
}
// Maintenance IDs like MNT-26-0001 — two-digit year, sequential per year.
function nextMaintenanceId(list) {
  const yy = new Date().getFullYear().toString().slice(-2);
  const nums = (list || []).map((x) => {
    const mt = String(x.maintenance_id || "").match(/^MNT-\d{2}-(\d+)$/);
    return mt ? parseInt(mt[1], 10) : 0;
  });
  const n = (nums.length ? Math.max(0, ...nums) : 0) + 1;
  return `MNT-${yy}-${String(n).padStart(4, "0")}`;
}
// Capital Ledger transaction codes like CT-26-0001 — two-digit year, sequential.
function nextCapitalCode(list) {
  const yy = new Date().getFullYear().toString().slice(-2);
  const nums = (list || []).map((x) => {
    const mt = String(x.txn_code || "").match(/^CT-\d{2}-(\d+)$/);
    return mt ? parseInt(mt[1], 10) : 0;
  });
  const n = (nums.length ? Math.max(0, ...nums) : 0) + 1;
  return `CT-${yy}-${String(n).padStart(4, "0")}`;
}
// Employee codes like WT-E-0001 — smallest unused sequence number.
function nextEmployeeCode(list) {
  const used = new Set((list || []).map((x) => parseInt(String(x.employee_code || "").replace(/\D/g, ""), 10)).filter((n) => n > 0));
  let n = 1; while (used.has(n)) n++;
  return `WT-E-${String(n).padStart(4, "0")}`;
}

// Logged-in user — resolves to the active administrator (falls back to the
// first user). Centralised so the hero, sidebar and menus stay in sync.
function currentUser(db) {
  const list = (db && db.users) || [];
  return list.find((u) => u.role === "Administrator" && u.status === "active")
    || list.find((u) => u.status === "active")
    || list[0]
    || { name: "—", email: "", role: "—" };
}

Object.assign(window, { DB, useDB, nextCode, nextTaskNumber, nextInvoiceCode, nextPONumber, nextMaintenanceId, nextCapitalCode, nextEmployeeCode, currentUser, WT_seed: seed, WT_WORKFLOW_STAGES, WT_STAGE_STATUSES, WT_JOURNEY_STAGES, WT_CLIENT_PORTAL_PERMISSIONS, wtDefaultWorkflow, WT_PERMISSIONS, WT_ALL_PERMS, WT_ROLE_DEFAULTS, WT_getActingRole, WT_setActingRole, can, canAny });
