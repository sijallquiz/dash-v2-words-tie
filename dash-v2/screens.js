/* =====================================================================
   Words Tie Dashboard — screen templates
   Each function returns an HTML string. Markup uses the same Bootstrap /
   Sneat class names as the real Blade views, so the theme maps 1:1.
   ===================================================================== */
(function () {
  const S = {};

  /* ---------- small helpers ---------- */
  const statusBadge = (s) => {
    const m = {
      pending: ['Pending', 'bg-label-warning'],
      in_progress: ['In Progress', 'bg-label-info'],
      completed: ['Completed', 'bg-label-success'],
      paid: ['Paid', 'bg-label-success'],
      unpaid: ['Unpaid', 'bg-label-danger'],
      partial: ['Partial', 'bg-label-warning'],
    };
    const [label, cls] = m[s] || [s, 'bg-label-secondary'];
    return `<span class="badge ${cls}">${label}</span>`;
  };
  const pageHead = (title, sub, actions = '') => `
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
      <div>
        <h4 class="wt-page-title">${title}</h4>
        <p class="wt-page-sub">${sub}</p>
      </div>
      <div class="d-flex flex-wrap gap-2 align-items-center">${actions}</div>
    </div>`;

  /* =================================================================
     DASHBOARD
     ================================================================= */
  S.dashboard = () => {
    const stat = (icon, grad, label, value, foot, footCls) => `
      <div class="col-xl-3 col-md-6">
        <div class="card h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <span class="wt-stat-icon" style="background:${grad}"><i class="ti ${icon}"></i></span>
              <i class="ti ti-dots-vertical text-muted"></i>
            </div>
            <span class="text-muted d-block mb-1" style="font-size:.85rem;font-weight:600;">${label}</span>
            <h3 class="mb-1 wt-num">${value}</h3>
            <small class="${footCls} fw-semibold">${foot}</small>
          </div>
        </div>
      </div>`;
    const g1 = 'linear-gradient(120deg,#19AAFD,#006DF7)';
    const g2 = 'linear-gradient(120deg,#3bc9f0,#19AAFD)';
    const g3 = 'linear-gradient(120deg,#2bd49a,#1aa179)';
    const g4 = 'linear-gradient(120deg,#f4b24a,#e08a2b)';

    const recentTask = (n, st, ago) => `
      <tr><td><a href="#" onclick="WT_GO('task-details');return false;" class="wt-num">${n}</a></td>
      <td>${statusBadge(st)}</td><td><small class="text-muted">${ago}</small></td></tr>`;
    const recentReq = (name, email, st, ago) => `
      <tr><td><a href="#" class="fw-semibold">${name}</a></td>
      <td><small>${email}</small></td><td>${statusBadge(st)}</td>
      <td><small class="text-muted">${ago}</small></td></tr>`;

    return `
      ${pageHead('Welcome back, Admin 👋', "Here's what's happening across Words Tie today.",
        `<button class="btn btn-outline-primary"><i class="ti ti-download me-1"></i>Export</button>
         <button class="btn btn-primary" onclick="WT_GO('create-task')"><i class="ti ti-plus me-1"></i>New Task</button>`)}

      <div class="row g-4 mb-2">
        ${stat('ti-users', g1, 'Total Users', '1,284', '<i class="ti ti-user-check"></i> 1,190 Active', 'text-primary')}
        ${stat('ti-checklist', g2, 'Total Tasks', '3,517', '<i class="ti ti-clock"></i> 42 Pending · 18 In Progress', 'text-info')}
        ${stat('ti-building', g3, 'Total Clients', '386', '<i class="ti ti-trending-up"></i> +12 this month', 'text-success')}
        ${stat('ti-user-star', g4, 'Total Freelancers', '512', '<i class="ti ti-user-check"></i> 94 active now', 'text-warning')}
      </div>

      <div class="row g-4 mt-0 mb-2">
        ${stat('ti-file-dollar', g4, 'Price Requests', '128', '<i class="ti ti-clock"></i> 3 Pending review', 'text-warning')}
        ${stat('ti-mail', 'linear-gradient(120deg,#f48aa0,#e0566b)', 'Contact Messages', '64', '<i class="ti ti-calendar"></i> 9 this week', 'text-danger')}
        ${stat('ti-arrow-down-right', g3, 'Total Revenue', '$184,920', '2,940,000 EGP', 'text-success')}
        ${stat('ti-arrow-up-right', 'linear-gradient(120deg,#f48aa0,#e0566b)', 'Total Expenses', '$72,140', '1,210,000 EGP', 'text-danger')}
      </div>

      <div class="row g-4 mt-0">
        <div class="col-lg-5">
          <div class="card h-100">
            <div class="card-header"><h5 class="mb-0">Financial Summary</h5></div>
            <div class="card-body">
              ${['USD', 'EGP'].map((cur, i) => `
                <div class="${i ? 'mt-4' : ''}">
                  <h6 class="text-muted mb-3" style="letter-spacing:.08em;">${cur}</h6>
                  <div class="d-flex justify-content-between mb-2"><span class="text-muted">Total Revenue</span><span class="fw-semibold text-success wt-num">${cur === 'USD' ? '$184,920' : '2,940,000'}</span></div>
                  <div class="d-flex justify-content-between mb-2"><span class="text-muted">Total Expenses</span><span class="fw-semibold text-danger wt-num">${cur === 'USD' ? '$72,140' : '1,210,000'}</span></div>
                  <div class="d-flex justify-content-between pt-2" style="border-top:1px solid var(--wt-line)"><span class="fw-semibold">Net Profit</span><span class="fw-bold text-success wt-num">${cur === 'USD' ? '$112,780' : '1,730,000'}</span></div>
                </div>`).join('')}
            </div>
          </div>
        </div>
        <div class="col-lg-7">
          <div class="card h-100">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0">Recent Tasks</h5>
              <a href="#" onclick="WT_GO('tasks');return false;" class="btn btn-sm btn-label-primary">View all</a>
            </div>
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead><tr><th>Task Number</th><th>Status</th><th>Created</th></tr></thead>
                <tbody>
                  ${recentTask('WT-2041', 'in_progress', '2 hours ago')}
                  ${recentTask('WT-2040', 'completed', '5 hours ago')}
                  ${recentTask('WT-2039', 'pending', '1 day ago')}
                  ${recentTask('WT-2038', 'completed', '1 day ago')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-4 mt-0">
        <div class="col-12">
          <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
              <h5 class="mb-0">Recent Price Requests</h5>
              <a href="#" onclick="WT_GO('requests');return false;" class="btn btn-sm btn-label-primary">View all</a>
            </div>
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead><tr><th>Project Name</th><th>Email</th><th>Status</th><th>Created</th></tr></thead>
                <tbody>
                  ${recentReq('iOS app localization', 'jane@acme.com', 'pending', '3 hours ago')}
                  ${recentReq('E-learning subtitles', 'omar@nile.io', 'completed', '8 hours ago')}
                  ${recentReq('Legal document translation', 'lana@kanzway.com', 'pending', '1 day ago')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;
  };

  /* =================================================================
     TASKS (index / table)
     ================================================================= */
  S.tasks = () => {
    const row = (num, client, free, ref, st, start, end, by) => `
      <tr>
        <td><a href="#" onclick="WT_GO('task-details');return false;" class="fw-semibold wt-num">${num}</a></td>
        <td><a href="#" class="text-decoration-none">${client}</a></td>
        <td>${free.map(f => `<a href="#" class="d-block text-decoration-none wt-num" style="font-size:.85rem">${f}</a>`).join('')}</td>
        <td>${ref ? `<a href="#" class="wt-num">${ref}</a>` : '<span class="text-muted">—</span>'}</td>
        <td>${statusBadge(st)}</td>
        <td><span class="wt-num" style="font-size:.85rem">${start}</span></td>
        <td><span class="wt-num" style="font-size:.85rem">${end}</span></td>
        <td>${by}</td>
        <td class="text-end">
          <div class="d-inline-flex gap-2">
            <a href="#" onclick="WT_GO('task-details');return false;" class="btn btn-sm btn-icon btn-outline-info" title="View"><i class="ti ti-eye"></i></a>
            <a href="#" class="btn btn-sm btn-icon btn-primary" title="Edit"><i class="ti ti-edit"></i></a>
            <button class="btn btn-sm btn-icon btn-label-danger" title="Delete"><i class="ti ti-trash"></i></button>
          </div>
        </td>
      </tr>`;

    return `
      <div class="card">
        <div class="card-header border-0 pb-3">
          <div class="d-flex flex-column flex-xl-row justify-content-between align-items-xl-center gap-3">
            <div><h4 class="wt-page-title mb-1">Tasks</h4><p class="wt-page-sub">Manage tasks and their files.</p></div>
            <div class="d-flex flex-wrap gap-2 align-items-center">
              <div class="input-group input-group-merge" style="min-width:240px;max-width:280px;">
                <span class="input-group-text"><i class="ti ti-search"></i></span>
                <input type="text" class="form-control" placeholder="Search tasks">
              </div>
              <select class="form-select" style="width:auto;">
                <option>All Status</option><option>Pending</option><option>In Progress</option><option>Completed</option>
              </select>
              <button class="btn btn-outline-primary px-4">Search</button>
              <button class="btn btn-primary px-3" onclick="WT_GO('create-task')"><i class="ti ti-plus me-1"></i>New Task</button>
            </div>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead><tr>
              <th>Task #</th><th>Client Code</th><th>Freelancers</th><th>Reference</th>
              <th>Status</th><th>Start</th><th>End</th><th>Created By</th><th class="text-end">Actions</th>
            </tr></thead>
            <tbody>
              ${row('WT-2041', 'CL-118', ['FR-204', 'FR-211'], 'WT-1990', 'in_progress', '2026-05-28', '2026-06-08', 'Mariam H.')}
              ${row('WT-2040', 'CL-092', ['FR-188'], null, 'completed', '2026-05-25', '2026-06-01', 'Omar A.')}
              ${row('WT-2039', 'CL-145', ['FR-204'], 'WT-2010', 'pending', '2026-06-02', '2026-06-14', 'Mariam H.')}
              ${row('WT-2038', 'CL-077', ['FR-160', 'FR-199'], null, 'completed', '2026-05-20', '2026-05-30', 'Sara K.')}
              ${row('WT-2037', 'CL-203', ['FR-211'], null, 'in_progress', '2026-05-30', '2026-06-10', 'Omar A.')}
            </tbody>
          </table>
        </div>
        <div class="card-footer d-flex justify-content-between align-items-center flex-wrap gap-2">
          <small class="text-muted">Showing 5 of 3,517 tasks</small>
          <nav><ul class="pagination pagination-sm mb-0">
            <li class="page-item disabled"><a class="page-link"><i class="ti ti-chevron-left"></i></a></li>
            <li class="page-item active"><a class="page-link">1</a></li>
            <li class="page-item"><a class="page-link">2</a></li>
            <li class="page-item"><a class="page-link">3</a></li>
            <li class="page-item"><a class="page-link"><i class="ti ti-chevron-right"></i></a></li>
          </ul></nav>
        </div>
      </div>`;
  };

  /* =================================================================
     TASK DETAILS (tabs)
     ================================================================= */
  S.taskDetails = () => {
    const field = (label, val, mono) => `
      <div class="col-md-6 mb-3"><small class="text-muted d-block mb-1">${label}</small>
      <span class="fw-semibold ${mono ? 'wt-num' : ''}">${val}</span></div>`;
    const sumRow = (label, val) => `<small class="text-muted d-block">${label}</small><p class="fw-semibold mb-3">${val}</p>`;
    const fileRow = (name, date, st) => `
      <tr><td class="fw-semibold">${name}</td><td><small class="text-muted wt-num">${date}</small></td>
      <td>${st === 'DTP' ? '<span class="badge bg-label-success">DTP</span>' : '<span class="badge bg-label-warning">Update</span>'}</td>
      <td class="text-end"><div class="d-inline-flex gap-2">
        <a href="#" class="btn btn-sm btn-icon btn-outline-primary" title="Download"><i class="ti ti-download"></i></a>
        <button class="btn btn-sm btn-icon btn-label-danger" title="Delete"><i class="ti ti-trash"></i></button>
      </div></td></tr>`;
    const freelancerCard = (name, code, email, phone, quota, rate) => `
      <div class="col-md-6">
        <div class="card border">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <div><h5 class="mb-1"><a href="#" class="text-decoration-none">${name}</a></h5>
              <small class="text-muted">Code: <span class="wt-num">${code}</span></small></div>
              <a href="#" class="btn btn-sm btn-icon btn-outline-primary"><i class="ti ti-external-link"></i></a>
            </div>
            <div class="row g-2">
              <div class="col-12"><small class="text-muted d-block">Email</small><span class="fw-semibold">${email}</span></div>
              <div class="col-6"><small class="text-muted d-block">Quota</small><span class="fw-semibold wt-num">${quota}</span></div>
              <div class="col-6"><small class="text-muted d-block">Rate / Hour</small><span class="fw-semibold wt-num">${rate}</span></div>
              <div class="col-12 mt-2"><small class="text-muted d-block mb-1">Language Pairs</small>
                <div class="d-flex flex-wrap gap-1"><span class="badge bg-label-secondary">EN → AR</span><span class="badge bg-label-secondary">FR → AR</span></div></div>
            </div>
          </div>
        </div>
      </div>`;

    return `
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <a href="#" onclick="WT_GO('tasks');return false;" class="btn btn-link p-0"><i class="ti ti-arrow-left me-1"></i>Back to list</a>
        <div class="d-flex gap-2">
          <a href="#" class="btn btn-sm btn-icon btn-label-primary" title="Edit"><i class="ti ti-edit"></i></a>
          <button class="btn btn-sm btn-icon btn-label-danger" title="Delete"><i class="ti ti-trash"></i></button>
        </div>
      </div>

      <div class="d-flex align-items-center gap-3 mb-4">
        <span class="wt-stat-icon" style="background:var(--wt-grad)"><i class="ti ti-checklist"></i></span>
        <div><h4 class="wt-page-title mb-0">Task <span class="wt-num">WT-2041</span></h4>
        <p class="wt-page-sub">In progress · Client <span class="wt-num">CL-118</span></p></div>
        <div class="ms-auto">${statusBadge('in_progress')}</div>
      </div>

      <div class="row g-4">
        <div class="col-lg-8">
          <ul class="nav nav-tabs mb-4" role="tablist">
            <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-details" type="button">Task Details</button></li>
            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-files" type="button">Files History <span class="badge bg-label-secondary ms-1">3</span></button></li>
            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-vpo" type="button">Freelancer PO</button></li>
            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-cpo" type="button">Client PO</button></li>
          </ul>
          <div class="tab-content p-0" style="background:transparent;">
            <div class="tab-pane fade show active" id="tab-details">
              <div class="card mb-4">
                <div class="card-header"><h5 class="mb-0">Task Information</h5></div>
                <div class="card-body"><div class="row">
                  ${field('Task Number', 'WT-2041', true)}
                  ${field('Client Code', '<a href="#" class="text-decoration-none wt-num">CL-118</a>')}
                  ${field('Reference Task', '<a href="#" class="wt-num">WT-1990</a>')}
                  ${field('Page Numbers', '24', true)}
                  ${field('Words Count', '8,420', true)}
                  ${field('Start Date & Time', '2026-05-28 09:00', true)}
                  ${field('End Date & Time', '2026-06-08 18:00', true)}
                  <div class="col-12 mb-3"><small class="text-muted d-block mb-2">Language Pairs</small>
                    <div class="d-flex flex-wrap gap-2"><span class="badge bg-label-primary">EN → AR</span><span class="badge bg-label-primary">FR → AR</span></div></div>
                  <div class="col-12 mb-3"><small class="text-muted d-block mb-2">Services</small>
                    <div class="d-flex flex-wrap gap-2"><span class="badge bg-label-primary">Translation</span><span class="badge bg-label-primary">Proofreading</span><span class="badge bg-label-primary">DTP</span></div></div>
                  <div class="col-12"><small class="text-muted d-block mb-1">Notes</small><p class="mb-0">Marketing handbook for Q3 launch — keep tone formal, deliver source-formatted files.</p></div>
                </div></div>
              </div>
              <div class="card">
                <div class="card-header"><h5 class="mb-0">Freelancers Working on This Task</h5></div>
                <div class="card-body"><div class="row g-4">
                  ${freelancerCard('Khaled Mansour', 'FR-204', 'khaled@wt.io', '+20 100 000', '40 / wk', '$22')}
                  ${freelancerCard('Nour El-Din', 'FR-211', 'nour@wt.io', '+20 101 111', '35 / wk', '$25')}
                </div></div>
              </div>
            </div>

            <div class="tab-pane fade" id="tab-files">
              <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <h5 class="mb-0">Files History</h5>
                  <button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#addFileModal"><i class="ti ti-plus me-1"></i>Add File</button>
                </div>
                <div class="table-responsive">
                  <table class="table table-hover mb-0">
                    <thead><tr><th>File Name</th><th>Date</th><th>Status</th><th class="text-end">Files</th></tr></thead>
                    <tbody>
                      ${fileRow('handbook_source.indd', '28/05/2026 09:12 AM', 'DTP')}
                      ${fileRow('handbook_AR_v1.pdf', '02/06/2026 02:40 PM', 'Update')}
                      ${fileRow('handbook_AR_final.pdf', '06/06/2026 11:05 AM', 'Update')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="tab-pane fade" id="tab-vpo">
              ${poPanel('Freelancer Purchase Orders', 'PO to freelancers for this task.', 'FPO')}
            </div>
            <div class="tab-pane fade" id="tab-cpo">
              ${poPanel('Client Purchase Orders', 'PO issued to the client for this task.', 'CPO')}
            </div>
          </div>
        </div>

        <div class="col-lg-4">
          <div class="card mb-4">
            <div class="card-header"><h5 class="mb-0">Task Summary</h5></div>
            <div class="card-body">
              ${sumRow('Created By', 'Mariam Hassan')}
              ${sumRow('Created At', '<span class="wt-num">28/05/2026 09:00 AM</span>')}
              ${sumRow('Updated At', '<span class="wt-num">06/06/2026 11:05 AM</span>')}
              ${sumRow('Total Files', '<span class="wt-num">3</span>')}
              ${sumRow('Total Freelancers', '<span class="wt-num">2</span>')}
              <small class="text-muted d-block">Total Services</small><p class="fw-semibold mb-0 wt-num">3</p>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h5 class="mb-0">Services Details</h5></div>
            <div class="card-body"><div class="list-group">
              ${['Translation', 'Proofreading', 'Desktop Publishing'].map(s => `
                <div class="list-group-item mb-2">
                  <div class="d-flex justify-content-between align-items-start">
                    <div><h6 class="mb-1">${s}</h6><p class="mb-0 text-muted small">EN ⇄ AR professional service</p></div>
                    <span class="badge bg-label-success">active</span>
                  </div>
                </div>`).join('')}
            </div></div>
          </div>
        </div>
      </div>

      <!-- Add File Modal -->
      <div class="modal fade" id="addFileModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">Add a new File</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
            <div class="modal-body">
              <div class="mb-3"><label class="form-label">File Name <span class="text-danger">*</span></label>
                <input type="text" class="form-control" placeholder="Name"></div>
              <div class="mb-3"><label class="form-label">Status <span class="text-danger">*</span></label>
                <select class="form-select"><option>Status</option><option>DTP</option><option>Update</option></select></div>
              <div class="mb-3"><label class="form-label">Note</label><textarea class="form-control" rows="2" placeholder="Enter text here"></textarea></div>
              <label class="form-label">Upload the Files <span class="text-danger">*</span></label>
              <div style="border:2px dashed var(--wt-line-strong);border-radius:14px;padding:2rem;text-align:center;background:rgba(25,170,253,.04);cursor:pointer;">
                <i class="ti ti-cloud-upload" style="font-size:2.6rem;color:var(--wt-blue-2);"></i>
                <div class="mt-2"><strong>Click to upload</strong> or drag and drop</div>
                <small class="text-muted">Images, PDF, Word, Excel, ZIP, Text files</small>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button class="btn btn-primary">Save</button>
            </div>
          </div>
        </div>
      </div>`;

    function poPanel(title, sub, prefix) {
      const r = (n, amt, st) => `<tr><td class="fw-semibold wt-num">${n}</td><td class="wt-num">${amt}</td><td>${statusBadge(st)}</td>
        <td class="text-end"><div class="d-inline-flex gap-2">
        <a href="#" class="btn btn-sm btn-icon btn-outline-info"><i class="ti ti-eye"></i></a>
        <a href="#" class="btn btn-sm btn-icon btn-outline-primary"><i class="ti ti-printer"></i></a></div></td></tr>`;
      return `<div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <div><h5 class="mb-0">${title}</h5><small class="text-muted">${sub}</small></div>
          <button class="btn btn-primary btn-sm"><i class="ti ti-plus me-1"></i>New PO</button>
        </div>
        <div class="table-responsive"><table class="table table-hover mb-0">
          <thead><tr><th>PO Number</th><th>Amount</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
          <tbody>${r(prefix + '-3012', '$540.00', 'paid')}${r(prefix + '-3013', '$320.00', 'unpaid')}</tbody>
        </table></div></div>`;
    }
  };

  /* =================================================================
     CREATE TASK (form — styled like the Words Tie request page)
     ================================================================= */
  S.createTask = () => {
    const section = (n, title, body) => `
      <div class="mb-4">
        <div class="d-flex align-items-center gap-3 mb-3">
          <span class="wt-step solid">${n}</span><h5 class="mb-0">${title}</h5>
        </div>
        ${body}
      </div>`;
    const services = ['AI Solutions', 'Design Book', 'Desktop Publishing (DTP)', 'E-Learning', 'Localization', 'Proofreading', 'QA & Testing', 'Subtitling', 'Transcreation', 'Transcription', 'Translation', 'Typing'];

    return `
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <a href="#" onclick="WT_GO('tasks');return false;" class="btn btn-link p-0"><i class="ti ti-arrow-left me-1"></i>Back to list</a>
      </div>
      ${pageHead('Create New Task', 'Fill in the details below. Required fields are marked with *.')}
      <div class="row g-4">
        <div class="col-lg-8">
          <div class="card"><div class="card-body p-4">
            ${section('01', 'Task basics', `
              <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Task Number *</label><input class="form-control" placeholder="WT-0000"></div>
                <div class="col-md-6"><label class="form-label">Client Code *</label><input class="form-control" placeholder="CL-000"></div>
                <div class="col-md-6"><label class="form-label">Reference Task</label><input class="form-control" placeholder="Optional"></div>
                <div class="col-md-6"><label class="form-label">Status *</label>
                  <select class="form-select"><option>Pending</option><option>In Progress</option><option>Completed</option></select></div>
              </div>`)}
            ${section('02', 'Scope & timing', `
              <div class="row g-3">
                <div class="col-md-3"><label class="form-label">Page Numbers</label><input class="form-control" placeholder="0"></div>
                <div class="col-md-3"><label class="form-label">Words Count</label><input class="form-control" placeholder="0"></div>
                <div class="col-md-3"><label class="form-label">Start Date *</label><input type="date" class="form-control"></div>
                <div class="col-md-3"><label class="form-label">End Date *</label><input type="date" class="form-control"></div>
                <div class="col-md-6"><label class="form-label">Source Language *</label><input class="form-control" placeholder="English"></div>
                <div class="col-md-6"><label class="form-label">Target Language *</label><input class="form-control" placeholder="Arabic"></div>
                <div class="col-12"><label class="form-label">Project Link</label><input class="form-control" placeholder="https://"></div>
                <div class="col-12"><label class="form-label">Notes</label><textarea class="form-control" rows="3" placeholder="Describe the project, audience, tone…"></textarea></div>
              </div>`)}
            ${section('03', 'Services needed *', `
              <div class="row g-2">
                ${services.map(s => `<div class="col-md-4 col-sm-6">
                  <label class="d-flex align-items-center gap-2 p-2 rounded" style="border:1.5px solid var(--wt-line);cursor:pointer;">
                  <input class="form-check-input mt-0" type="checkbox"><span style="font-size:.88rem;font-weight:500;">${s}</span></label></div>`).join('')}
              </div>`)}
            ${section('04', 'Attachments', `
              <div style="border:2px dashed var(--wt-line-strong);border-radius:16px;padding:2.5rem;text-align:center;background:rgba(25,170,253,.04);cursor:pointer;">
                <i class="ti ti-cloud-upload" style="font-size:3rem;color:var(--wt-blue-2);"></i>
                <div class="mt-2"><strong>Click to upload</strong> or drag and drop</div>
                <small class="text-muted">PDF, Word, Excel, ZIP, images — up to 50MB each</small>
              </div>`)}
            <div class="d-flex justify-content-end gap-2 pt-2">
              <button class="btn btn-outline-secondary" onclick="WT_GO('tasks')">Cancel</button>
              <button class="btn btn-primary px-4"><i class="ti ti-check me-1"></i>Save Task</button>
            </div>
          </div></div>
        </div>
        <div class="col-lg-4">
          <div class="card" style="position:sticky;top:90px;">
            <div class="card-header"><h6 class="mb-0">How tasks work</h6></div>
            <div class="card-body">
              ${[['Add the client & reference', 'Link to an existing client code.'], ['Set scope and deadline', 'Words, pages and the delivery window.'], ['Assign freelancers', 'You can attach them after saving.'], ['Upload source files', 'Everything stays in Files History.']].map((x, i) => `
                <div class="d-flex gap-3 ${i ? 'mt-3' : ''}"><span class="wt-step">${String(i + 1).padStart(2, '0')}</span>
                <div><div class="fw-semibold" style="font-size:.92rem">${x[0]}</div><small class="text-muted">${x[1]}</small></div></div>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
  };

  /* =================================================================
     INVOICES (finance)
     ================================================================= */
  S.invoices = () => {
    const inv = (n, party, amt, cur, st, date) => `
      <tr>
        <td class="fw-semibold wt-num">${n}</td>
        <td>${party}</td>
        <td class="fw-semibold wt-num">${amt} <small class="text-muted">${cur}</small></td>
        <td>${statusBadge(st)}</td>
        <td class="wt-num"><small class="text-muted">${date}</small></td>
        <td class="text-end"><div class="d-inline-flex gap-2">
          <a href="#" class="btn btn-sm btn-icon btn-outline-info" title="View"><i class="ti ti-eye"></i></a>
          <a href="#" class="btn btn-sm btn-icon btn-primary" title="Edit"><i class="ti ti-edit"></i></a>
          <a href="#" class="btn btn-sm btn-icon btn-label-primary" title="Print"><i class="ti ti-printer"></i></a>
          <button class="btn btn-sm btn-icon btn-label-danger" title="Delete"><i class="ti ti-trash"></i></button>
        </div></td>
      </tr>`;
    return `
      ${pageHead('Invoices', 'Client and freelancer invoices in one place.',
        `<button class="btn btn-outline-primary"><i class="ti ti-download me-1"></i>Export</button>
         <button class="btn btn-primary"><i class="ti ti-plus me-1"></i>New Invoice</button>`)}

      <div class="row g-4 mb-1">
        ${[['Total Billed', '$248,500', 'ti-file-invoice', 'linear-gradient(120deg,#19AAFD,#006DF7)', 'text-primary'],
           ['Paid', '$186,200', 'ti-circle-check', 'linear-gradient(120deg,#2bd49a,#1aa179)', 'text-success'],
           ['Outstanding', '$62,300', 'ti-clock', 'linear-gradient(120deg,#f4b24a,#e08a2b)', 'text-warning'],
           ['Overdue', '$14,100', 'ti-alert-triangle', 'linear-gradient(120deg,#f48aa0,#e0566b)', 'text-danger']].map(c => `
          <div class="col-xl-3 col-md-6"><div class="card"><div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-3"><span class="wt-stat-icon" style="background:${c[3]}"><i class="ti ${c[2]}"></i></span></div>
            <span class="text-muted d-block mb-1" style="font-size:.85rem;font-weight:600;">${c[0]}</span>
            <h3 class="mb-0 wt-num">${c[1]}</h3>
          </div></div></div>`).join('')}
      </div>

      <div class="card">
        <div class="card-header border-0">
          <ul class="nav nav-tabs card-header-tabs mb-0">
            <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#inv-client" type="button">Client Invoices</button></li>
            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#inv-free" type="button">Freelancer Invoices</button></li>
          </ul>
        </div>
        <div class="tab-content p-0">
          <div class="tab-pane fade show active" id="inv-client">
            <div class="table-responsive"><table class="table table-hover mb-0">
              <thead><tr><th>Invoice #</th><th>Client</th><th>Amount</th><th>Status</th><th>Issued</th><th class="text-end">Actions</th></tr></thead>
              <tbody>
                ${inv('INV-5021', 'Acme Corp', '12,400.00', 'USD', 'paid', '2026-05-30')}
                ${inv('INV-5022', 'Nile Media', '8,900.00', 'USD', 'partial', '2026-06-01')}
                ${inv('INV-5023', 'KanzWay', '3,200.00', 'USD', 'unpaid', '2026-06-03')}
                ${inv('INV-5024', 'Delta Bank', '21,000.00', 'EGP', 'paid', '2026-06-04')}
              </tbody>
            </table></div>
          </div>
          <div class="tab-pane fade" id="inv-free">
            <div class="table-responsive"><table class="table table-hover mb-0">
              <thead><tr><th>Invoice #</th><th>Freelancer</th><th>Amount</th><th>Status</th><th>Issued</th><th class="text-end">Actions</th></tr></thead>
              <tbody>
                ${inv('FNV-2210', 'Khaled Mansour', '540.00', 'USD', 'paid', '2026-05-31')}
                ${inv('FNV-2211', 'Nour El-Din', '320.00', 'USD', 'unpaid', '2026-06-02')}
              </tbody>
            </table></div>
          </div>
        </div>
      </div>`;
  };

  /* =================================================================
     Generic placeholder for the remaining sections
     ================================================================= */
  S.placeholder = (name) => {
    const labels = {
      freelancers: ['Freelancers', 'ti-users', 'Manage your freelancer roster.'],
      clients: ['Clients', 'ti-address-book', 'Your client directory.'],
      revenues: ['Revenues', 'ti-arrow-down-right', 'Track incoming revenue.'],
      expenses: ['Expenses', 'ti-arrow-up-right', 'Track outgoing expenses.'],
      capital: ['Company Capital', 'ti-building-bank', 'Manage company capital.'],
      requests: ['Price Requests', 'ti-file-dollar', 'Incoming quote requests from the website.'],
      messages: ['Contact Messages', 'ti-mail', 'Messages from the contact form.'],
      services: ['Services', 'ti-briefcase', 'Services you offer.'],
      industries: ['Industries', 'ti-building', 'Industry categories.'],
      settings: ['Settings', 'ti-settings', 'System & site settings.'],
    };
    const [title, icon, sub] = labels[name] || ['Section', 'ti-layout-grid', ''];
    return `
      ${pageHead(title, sub,
        `<button class="btn btn-outline-primary"><i class="ti ti-download me-1"></i>Export</button>
         <button class="btn btn-primary"><i class="ti ti-plus me-1"></i>New ${title.replace(/s$/, '')}</button>`)}
      <div class="card"><div class="card-body text-center py-5">
        <span class="wt-stat-icon mb-3" style="background:var(--wt-grad);width:72px;height:72px;font-size:2rem;"><i class="ti ${icon}"></i></span>
        <h5 class="mt-3 mb-1">${title} list</h5>
        <p class="text-muted mb-4" style="max-width:420px;margin-inline:auto;">This section uses the same redesigned table, cards, forms and buttons you see on the <a href="#" onclick="WT_GO('tasks');return false;">Tasks</a> and <a href="#" onclick="WT_GO('invoices');return false;">Invoices</a> screens.</p>
        <div class="d-flex gap-2 justify-content-center">
          <button class="btn btn-outline-primary" onclick="WT_GO('tasks')">See a table page</button>
          <button class="btn btn-primary" onclick="WT_GO('create-task')">See a form page</button>
        </div>
      </div></div>`;
  };

  // map screen keys -> renderers
  window.WT_SCREENS = {
    dashboard: S.dashboard,
    tasks: S.tasks,
    'task-details': S.taskDetails,
    'create-task': S.createTask,
    invoices: S.invoices,
    freelancers: S.placeholder, clients: S.placeholder, revenues: S.placeholder,
    expenses: S.placeholder, capital: S.placeholder, requests: S.placeholder,
    messages: S.placeholder, services: S.placeholder, industries: S.placeholder,
    settings: S.placeholder, placeholder: S.placeholder,
  };
})();
