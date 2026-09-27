/**
 * RapidCare Super Admin Dashboard Controller
 * Protected: requires 'super_admin' role.
 * Manages pending clinic registration verification and account approvals.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Guard route: must be super_admin
  const user = window.guardPage('super_admin');
  if (!user) return;

  // 2. Set admin display name
  const nameEl = document.getElementById('admin-display-name');
  if (nameEl) nameEl.textContent = user.name || 'Super Admin';

  // 3. Initial load of pending clinics
  await loadPendingClinics();
});

/**
 * Fetch and render all clinic registrations with status 'pending_verification'
 */
async function loadPendingClinics() {
  const container = document.getElementById('pending-clinics-list');
  const countBadge = document.getElementById('pending-count-badge');
  if (!container) return;

  try {
    const clinics = await api.get('/api/admin/pending-clinics');

    if (countBadge) {
      countBadge.textContent = `${clinics.length} Pending`;
    }

    if (!clinics || clinics.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon" style="color: var(--color-success); font-size: 2.2rem;">✓</div>
          <p style="font-weight: 600; margin-bottom: 4px;">No Pending Clinic Registrations</p>
          <p class="text-muted text-sm" style="margin: 0;">All clinic staff accounts on record have been reviewed and approved.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = clinics.map((c) => {
      const regDate = new Date(c.created_at).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      return `
        <div class="data-item" id="clinic-row-${c.id}">
          <div class="data-item-main">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="data-item-title">${escapeHtml(c.name)}</span>
              <span class="badge badge-pending text-sm">● Pending Verification</span>
            </div>
            <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-top: 4px; font-size: 0.9rem;">
              <span>✉️ <strong>${escapeHtml(c.email)}</strong></span>
              <span>📞 <strong>${escapeHtml(c.phone)}</strong></span>
            </div>
            <div class="data-item-meta" style="margin-top: 6px;">
              <span>📅 Registered: ${regDate}</span>
              <span>User ID: #${c.id}</span>
              ${c.latitude && c.longitude ? `<span>📍 GPS: ${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}</span>` : ''}
            </div>
          </div>
          <div class="data-item-actions">
            <button class="btn btn-primary btn-sm" onclick="approveClinic(${c.id}, '${escapeJs(c.name)}')">
              ✓ Approve Clinic
            </button>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-danger" style="margin: 0;">
        Failed to load pending clinics: ${escapeHtml(err.message)}
      </div>
    `;
  }
}

/**
 * Approve a pending clinic account
 */
window.approveClinic = async function (clinicId, clinicName) {
  const confirmed = confirm(`Are you sure you want to approve clinic "${clinicName}" for immediate platform access?`);
  if (!confirmed) return;

  try {
    await api.patch(`/api/admin/clinics/${clinicId}/approve`);
    showAdminAlert(`Clinic "${clinicName}" has been successfully approved! They can now log in.`, 'success');
    await loadPendingClinics();
  } catch (err) {
    showAdminAlert(`Failed to approve clinic: ${err.message}`, 'danger');
  }
};

window.loadPendingClinics = loadPendingClinics;

function showAdminAlert(msg, type = 'info') {
  const alertEl = document.getElementById('admin-alert');
  if (!alertEl) return;
  alertEl.className = `alert alert-${type} animate-in`;
  alertEl.textContent = msg;
  alertEl.style.display = 'block';
  setTimeout(() => {
    alertEl.style.display = 'none';
  }, 6000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeJs(text) {
  if (!text) return '';
  return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
}
