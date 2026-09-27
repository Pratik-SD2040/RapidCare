/**
 * RapidCare Clinic Operations Dashboard Controller
 * Protected: requires clinic_staff role.
 * Handles appointment scheduling, ambulance dispatch controls, and blood request tracking.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Guard route: must be clinic_staff
  const user = window.guardPage('clinic_staff');
  if (!user) return;

  // 2. Set clinic staff display
  const nameEl = document.getElementById('clinic-display-name');
  const headingEl = document.getElementById('clinic-heading');
  if (nameEl) nameEl.textContent = user.name || 'Clinic Staff';
  if (headingEl) headingEl.textContent = `${user.name || 'Central Clinic'} Operations`;

  // 3. Setup refresh button and patient search input
  const refreshBtn = document.getElementById('refresh-all-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadAllData);
  }

  const searchInput = document.getElementById('appointment-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderAppointmentsList();
    });
  }

  // 4. Horizontal scroll for quick jump navigation bar
  initHorizontalQuickJumpScroll();

  // 5. Initial load of all data
  await loadAllData();
});

function initHorizontalQuickJumpScroll() {
  const bars = document.querySelectorAll('.quick-jump-bar');
  bars.forEach((bar) => {
    bar.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        bar.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  });
}

// Stored application state for client-side search, analytics, and unified emergency dashboard
let allAppointments = [];
let allAmbulanceRequests = [];
let allBloodRequests = [];
let allPatients = [];

/**
 * Load all sections concurrently and calculate analytics & unified emergency stats
 */
async function loadAllData() {
  await Promise.all([
    loadAppointments(),
    loadAmbulanceRequests(),
    loadBloodRequests(),
    loadPatients(),
  ]);

  // Update top 5 analytics stat cards (Feature 2)
  updateDashboardAnalytics();

  // Update Unified Emergency Overview (Feature 1)
  renderUnifiedEmergencyOverview();
}

/**
 * Load registered patients for analytics (Feature 2)
 */
async function loadPatients() {
  try {
    allPatients = await api.get('/api/patients');
  } catch (err) {
    console.warn('Could not load patients list:', err);
    allPatients = [];
  }
}

/**
 * Update 5 Top Analytics Stat Cards (Feature 2)
 */
function updateDashboardAnalytics() {
  // 1. Total appointments today
  const todayStr = new Date().toDateString();
  const appointmentsToday = allAppointments.filter((app) => {
    if (!app.requested_date) return false;
    return new Date(app.requested_date).toDateString() === todayStr;
  }).length;

  // 2. Pending appointments count
  const pendingAppointments = allAppointments.filter((app) => {
    const st = (app.status || '').toLowerCase();
    return st === 'pending' || st === 'requested';
  }).length;

  // 3. Active ambulance requests count (requested or dispatched)
  const activeAmbulances = allAmbulanceRequests.filter((req) => {
    const st = (req.status || '').toLowerCase();
    return st === 'requested' || st === 'dispatched';
  }).length;

  // 4. Open blood requests count
  const openBlood = allBloodRequests.filter((req) => {
    const st = (req.status || '').toLowerCase();
    return st === 'open';
  }).length;

  // 5. Total registered patients
  const totalPatients = allPatients.length;

  // Bind to DOM cards
  const elToday = document.getElementById('stat-appointments-today');
  const elPending = document.getElementById('stat-appointments-pending');
  const elAmbulance = document.getElementById('stat-ambulance-active');
  const elBlood = document.getElementById('stat-blood-open');
  const elPatients = document.getElementById('stat-patients-total');

  if (elToday) elToday.textContent = appointmentsToday;
  if (elPending) elPending.textContent = pendingAppointments;
  if (elAmbulance) elAmbulance.textContent = activeAmbulances;
  if (elBlood) elBlood.textContent = openBlood;
  if (elPatients) elPatients.textContent = totalPatients;
}

/**
 * ============================================================================
 * Section 1: Appointments Management & Patient Search
 * ============================================================================
 */
async function loadAppointments() {
  const badgeEl = document.getElementById('appointments-badge-count');

  try {
    allAppointments = await api.get('/api/appointments');

    if (badgeEl) badgeEl.textContent = `${allAppointments.length} Total`;

    renderAppointmentsList();
  } catch (err) {
    const container = document.getElementById('clinic-appointments-list');
    if (container) {
      container.innerHTML = `
        <div class="alert alert-danger">Failed to load appointments: ${escapeHtml(err.message)}</div>
      `;
    }
  }
}

function renderAppointmentsList() {
  const container = document.getElementById('clinic-appointments-list');
  if (!container) return;

  const searchInput = document.getElementById('appointment-search');
  const query = (searchInput?.value || '').trim().toLowerCase();

  const filtered = query
    ? allAppointments.filter((app) => {
        const name = (app.patient?.name || '').toLowerCase();
        const email = (app.patient?.email || '').toLowerCase();
        const phone = (app.patient?.phone || '').toLowerCase();
        const reason = (app.reason || '').toLowerCase();
        return (
          name.includes(query) ||
          email.includes(query) ||
          phone.includes(query) ||
          reason.includes(query)
        );
      })
    : allAppointments;

  if (!filtered || filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${query ? '🔍' : '📅'}</div>
        <p style="font-weight: 600; margin-bottom: 4px;">
          ${query ? `No appointments matching "${escapeHtml(query)}"` : 'No patient appointments on record.'}
        </p>
        ${query ? '<p class="text-muted text-sm" style="margin: 0;">Try searching by another patient name or email address.</p>' : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((app) => {
    const dateFormatted = new Date(app.requested_date).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const patientName = app.patient ? escapeHtml(app.patient.name) : `Patient #${app.patient_id}`;
    const patientPhone = app.patient ? escapeHtml(app.patient.phone) : 'N/A';
    const patientEmail = app.patient?.email ? escapeHtml(app.patient.email) : '';

    return `
      <div class="data-item">
        <div class="data-item-main">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="data-item-title">${patientName}</span>
            ${patientEmail ? `<span class="text-sm text-muted">✉️ ${patientEmail}</span>` : ''}
            <span class="text-sm text-muted">📞 ${patientPhone}</span>
          </div>
          <div style="font-size: 0.95rem; margin: 3px 0;">Reason: <strong>${escapeHtml(app.reason)}</strong></div>
          <div class="data-item-meta">
            <span>📅 ${dateFormatted}</span>
            <span>Ref: #APP-${app.id}</span>
          </div>
        </div>
        <div class="data-item-actions">
          <label class="text-sm text-muted" for="status-app-${app.id}">Status:</label>
          <select id="status-app-${app.id}" class="select-status" onchange="updateAppointmentStatus(${app.id}, this.value)">
            <option value="requested" ${app.status === 'requested' ? 'selected' : ''}>● Requested</option>
            <option value="confirmed" ${app.status === 'confirmed' ? 'selected' : ''}>✓ Confirmed</option>
            <option value="completed" ${app.status === 'completed' ? 'selected' : ''}>✓ Completed</option>
            <option value="no_show" ${app.status === 'no_show' ? 'selected' : ''}>✕ No Show</option>
          </select>
        </div>
      </div>
    `;
  }).join('');
}

window.updateAppointmentStatus = async function (appId, newStatus) {
  try {
    await api.patch(`/api/appointments/${appId}/status`, { status: newStatus });
    showClinicAlert(`Appointment #${appId} status updated to ${newStatus.toUpperCase()}`, 'success');
    await loadAllData();
  } catch (err) {
    showClinicAlert(`Failed to update status: ${err.message}`, 'danger');
  }
};

/**
 * ============================================================================
 * Section 2: Ambulance Dispatch Coordination
 * ============================================================================
 */
async function loadAmbulanceRequests() {
  const container = document.getElementById('clinic-ambulance-list');
  const badgeEl = document.getElementById('ambulance-badge-count');
  if (!container) return;

  try {
    const requests = await api.get('/api/ambulance-requests');
    allAmbulanceRequests = requests || [];

    if (badgeEl) badgeEl.textContent = `${allAmbulanceRequests.length} Requests`;

    if (!allAmbulanceRequests || allAmbulanceRequests.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🚑</div>
          <p>No emergency ambulance requests.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = allAmbulanceRequests.map((req) => {
      const timeFormatted = new Date(req.created_at).toLocaleString('en-US', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
      const patientName = req.patient ? escapeHtml(req.patient.name) : `Patient #${req.patient_id}`;
      const patientPhone = req.patient ? escapeHtml(req.patient.phone) : 'N/A';

      return `
        <div class="data-item">
          <div class="data-item-main">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="data-item-title">SOS Request #${req.id} — ${patientName}</span>
              <span class="text-sm text-muted">📞 ${patientPhone}</span>
            </div>
            <div style="font-size: 0.95rem; margin: 2px 0;">📍 Location: <strong>${escapeHtml(req.pickup_location)}</strong></div>
            <div class="data-item-meta">
              <span>🕒 ${timeFormatted}</span>
              <span>GPS: ${req.latitude.toFixed(4)}, ${req.longitude.toFixed(4)}</span>
              <span>Status: ${renderAmbulanceStatusBadge(req.status)}</span>
            </div>
          </div>
          <div class="data-item-actions">
            ${renderAmbulanceActionButtons(req.id, req.status)}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-danger">Failed to load ambulance requests: ${escapeHtml(err.message)}</div>
    `;
  }
}

function renderAmbulanceActionButtons(reqId, currentStatus) {
  if (currentStatus === 'requested') {
    return `
      <button class="btn btn-accent btn-sm" onclick="updateAmbulanceStatus(${reqId}, 'dispatched')">
        ➔ Dispatch
      </button>
      <button class="btn btn-secondary btn-sm" onclick="updateAmbulanceStatus(${reqId}, 'cancelled')">
        Cancel
      </button>
    `;
  } else if (currentStatus === 'dispatched') {
    return `
      <button class="btn btn-primary btn-sm" onclick="updateAmbulanceStatus(${reqId}, 'arrived')">
        ✓ Arrived
      </button>
      <button class="btn btn-secondary btn-sm" onclick="updateAmbulanceStatus(${reqId}, 'cancelled')">
        Cancel
      </button>
    `;
  } else {
    return `
      <span class="text-muted text-sm">${renderAmbulanceStatusBadge(currentStatus)}</span>
    `;
  }
}

window.updateAmbulanceStatus = async function (reqId, newStatus) {
  try {
    await api.patch(`/api/ambulance-requests/${reqId}/status`, { status: newStatus });
    showClinicAlert(`Ambulance #${reqId} status updated to ${newStatus.toUpperCase()}`, 'success');
    await loadAllData();
  } catch (err) {
    showClinicAlert(`Failed to update ambulance status: ${err.message}`, 'danger');
  }
};

/**
 * ============================================================================
 * Section 3: Blood Requirements
 * ============================================================================
 */
async function loadBloodRequests() {
  const container = document.getElementById('clinic-blood-list');
  const badgeEl = document.getElementById('blood-badge-count');
  if (!container) return;

  try {
    const requests = await api.get('/api/blood-requests?open_only=true');
    allBloodRequests = requests || [];

    if (badgeEl) badgeEl.textContent = `${allBloodRequests.length} Open`;

    if (!allBloodRequests || allBloodRequests.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🩸</div>
          <p>No open blood requirements currently active.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = allBloodRequests.map((req) => {
      const timeFormatted = new Date(req.created_at).toLocaleString('en-US', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
      const requesterName = req.requester ? escapeHtml(req.requester.name) : `Requester #${req.requester_id}`;
      const requesterPhone = req.requester ? escapeHtml(req.requester.phone) : 'N/A';
      const isUrgent = req.urgency === 'urgent';

      return `
        <div class="data-item">
          <div class="data-item-main">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge ${isUrgent ? 'badge-urgent' : 'badge-pending'}">Blood Needed: ${escapeHtml(req.blood_group_needed)}</span>
              <span class="data-item-title">${requesterName}</span>
              <span class="text-sm text-muted">📞 ${requesterPhone}</span>
            </div>
            <div style="font-size: 0.95rem; margin: 3px 0;">📍 Location: <strong>${escapeHtml(req.location)}</strong></div>
            <div class="data-item-meta">
              <span>🕒 ${timeFormatted}</span>
              <span>GPS: ${req.latitude.toFixed(4)}, ${req.longitude.toFixed(4)}</span>
              <span>Urgency: ${isUrgent ? '🚨 Urgent' : 'Normal'}</span>
            </div>
          </div>
          <div class="data-item-actions">
            <button class="btn btn-primary btn-sm" onclick="markBloodFulfilled(${req.id})">
              ✓ Mark Fulfilled
            </button>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-danger">Failed to load blood requests: ${escapeHtml(err.message)}</div>
    `;
  }
}

window.markBloodFulfilled = async function (reqId) {
  try {
    await api.patch(`/api/blood-requests/${reqId}/status`, { status: 'fulfilled' });
    showClinicAlert(`Blood Request #${reqId} marked as fulfilled!`, 'success');
    await loadAllData();
  } catch (err) {
    showClinicAlert(`Failed to update blood request: ${err.message}`, 'danger');
  }
};

/**
 * UI Badges & Alerts
 */
function renderAmbulanceStatusBadge(status) {
  switch (status) {
    case 'dispatched':
      return `<span class="badge badge-dispatched">➔ Dispatched</span>`;
    case 'arrived':
      return `<span class="badge badge-arrived">✓ Arrived</span>`;
    case 'cancelled':
      return `<span class="badge badge-cancelled">✕ Cancelled</span>`;
    default:
      return `<span class="badge badge-urgent">● Requested</span>`;
  }
}

function showClinicAlert(msg, type = 'info') {
  const alertEl = document.getElementById('clinic-alert');
  if (!alertEl) return;
  alertEl.className = `alert alert-${type}`;
  alertEl.textContent = msg;
  alertEl.style.display = 'block';
  setTimeout(() => {
    alertEl.style.display = 'none';
  }, 5000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * ============================================================================
 * Feature 1: Unified Emergency Dashboard (Emergency Overview)
 * ============================================================================
 */
function renderUnifiedEmergencyOverview() {
  const ambsContainer = document.getElementById('unified-ambulance-list');
  const bloodContainer = document.getElementById('unified-blood-list');
  const totalStatEl = document.getElementById('unified-emergency-total-stat');
  const ambBadgeEl = document.getElementById('unified-ambulance-count-badge');
  const bloodBadgeEl = document.getElementById('unified-blood-count-badge');

  // Filter active (non-completed) ambulance requests: requested or dispatched
  const activeAmbs = allAmbulanceRequests.filter(
    (r) => r.status === 'requested' || r.status === 'dispatched'
  );

  // Filter open blood requests
  const openBloods = allBloodRequests.filter((r) => r.status === 'open');

  const totalEmergencies = activeAmbs.length + openBloods.length;

  if (totalStatEl) {
    totalStatEl.textContent = `${totalEmergencies} Active Emergenc${totalEmergencies === 1 ? 'y' : 'ies'}`;
  }
  if (ambBadgeEl) ambBadgeEl.textContent = `${activeAmbs.length} Active`;
  if (bloodBadgeEl) bloodBadgeEl.textContent = `${openBloods.length} Open`;

  // Render Active Ambulance Dispatches in Emergency Overview
  if (ambsContainer) {
    if (activeAmbs.length === 0) {
      ambsContainer.innerHTML = `
        <div class="empty-state card-compact" style="padding: 16px; text-align: center;">
          <p style="color: var(--color-success); font-weight: 600; margin-bottom: 2px;">✓ All Dispatches Clear</p>
          <p class="text-muted text-sm" style="margin: 0;">No pending or in-transit emergency ambulances.</p>
        </div>
      `;
    } else {
      ambsContainer.innerHTML = activeAmbs.map((req) => {
        const timeFormatted = new Date(req.created_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const patientName = req.patient ? escapeHtml(req.patient.name) : `Patient #${req.patient_id}`;
        const patientPhone = req.patient ? escapeHtml(req.patient.phone) : 'N/A';

        return `
          <div class="data-item" style="padding: 12px 14px;">
            <div class="data-item-main">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="data-item-title" style="font-size: 0.95rem;">SOS #${req.id} — ${patientName}</span>
                <span class="text-sm text-muted">📞 ${patientPhone}</span>
              </div>
              <div style="font-size: 0.88rem; margin: 2px 0;">📍 <strong>${escapeHtml(req.pickup_location)}</strong></div>
              <div class="data-item-meta" style="font-size: 0.78rem;">
                <span>🕒 ${timeFormatted}</span>
                <span>GPS: ${req.latitude.toFixed(4)}, ${req.longitude.toFixed(4)}</span>
                <span>${renderAmbulanceStatusBadge(req.status)}</span>
              </div>
            </div>
            <div class="data-item-actions">
              ${renderAmbulanceActionButtons(req.id, req.status)}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Render Open Blood Requirements in Emergency Overview
  if (bloodContainer) {
    if (openBloods.length === 0) {
      bloodContainer.innerHTML = `
        <div class="empty-state card-compact" style="padding: 16px; text-align: center;">
          <p style="color: var(--color-success); font-weight: 600; margin-bottom: 2px;">✓ Blood Requirements Fulfilled</p>
          <p class="text-muted text-sm" style="margin: 0;">No active patient blood requests awaiting matches.</p>
        </div>
      `;
    } else {
      bloodContainer.innerHTML = openBloods.map((req) => {
        const timeFormatted = new Date(req.created_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const requesterName = req.requester ? escapeHtml(req.requester.name) : `Requester #${req.requester_id}`;
        const requesterPhone = req.requester ? escapeHtml(req.requester.phone) : 'N/A';
        const isUrgent = req.urgency === 'urgent';

        return `
          <div class="data-item" style="padding: 12px 14px;">
            <div class="data-item-main">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge ${isUrgent ? 'badge-urgent' : 'badge-pending'}">${escapeHtml(req.blood_group_needed)}</span>
                <span class="data-item-title" style="font-size: 0.95rem;">${requesterName}</span>
                <span class="text-sm text-muted">📞 ${requesterPhone}</span>
              </div>
              <div style="font-size: 0.88rem; margin: 2px 0;">📍 <strong>${escapeHtml(req.location)}</strong></div>
              <div class="data-item-meta" style="font-size: 0.78rem;">
                <span>🕒 ${timeFormatted}</span>
                <span>Urgency: ${isUrgent ? '🚨 Urgent' : 'Normal'}</span>
              </div>
            </div>
            <div class="data-item-actions">
              <button class="btn btn-primary btn-sm" onclick="markBloodFulfilled(${req.id})">
                ✓ Mark Fulfilled
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

