/**
 * RapidCare Patient Dashboard Controller
 * Handles appointment booking/listing, emergency ambulance SOS, and blood donor matching.
 */

// Geolocation state
let userCoordinates = {
  latitude: 18.5204,
  longitude: 73.8567,
  detected: false,
};

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Guard route for patient role
  const user = window.guardPage('patient');
  if (!user) return;

  // 2. Set user display details
  const nameEl = document.getElementById('user-display-name');
  const headingEl = document.getElementById('welcome-heading');
  if (nameEl) nameEl.textContent = user.name || 'Patient';
  if (headingEl) headingEl.textContent = `Hello, ${user.name || 'Patient'}`;

  // 3. Initiate browser geolocation detection
  initGeolocation();

  // 4. Load initial data
  await Promise.all([
    loadMyAppointments(),
    loadMyAmbulanceRequests(),
    loadNearbyAmbulances(),
  ]);

  // 5. Initialize form listeners & buttons
  initAppointmentBooking();
  initEmergencySOS();
  initBloodMatching();

  // Set default datetime to tomorrow at 10:00 AM
  const dateInput = document.getElementById('app-date');
  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    dateInput.value = tomorrow.toISOString().slice(0, 16);
  }

  // 6. Horizontal scroll for quick-jump navigation bar
  initHorizontalQuickJumpScroll();
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

/**
 * Browser Geolocation
 */
function initGeolocation() {
  const statusEl = document.getElementById('geo-status');
  if (!navigator.geolocation) {
    if (statusEl) statusEl.textContent = '📍 Manual coordinates (Pune)';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userCoordinates.latitude = parseFloat(pos.coords.latitude.toFixed(4));
      userCoordinates.longitude = parseFloat(pos.coords.longitude.toFixed(4));
      userCoordinates.detected = true;
      if (statusEl) {
        statusEl.textContent = `📍 GPS Active (${userCoordinates.latitude}, ${userCoordinates.longitude})`;
        statusEl.style.color = 'var(--color-success)';
      }
      // Refresh fleet and matches using real GPS
      loadNearbyAmbulances();
    },
    (err) => {
      if (statusEl) {
        statusEl.textContent = '📍 Using regional coordinates (Pune)';
      }
    },
    { timeout: 7000 }
  );
}

/**
 * ============================================================================
 * Section 1: My Appointments & Section 2.5: Visit History
 * ============================================================================
 */
async function loadMyAppointments() {
  const container = document.getElementById('appointments-list');
  const historyContainer = document.getElementById('visit-history-list');
  const historyBadge = document.getElementById('visit-history-count-badge');
  if (!container) return;

  try {
    const appointments = await api.get('/api/appointments/mine');

    // 1. Check for lightweight 24-hour appointment reminder (Feature 6)
    checkAppointmentReminder(appointments);

    if (!appointments || appointments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <p style="font-weight: 600; margin-bottom: 4px;">No upcoming appointments.</p>
          <p class="text-muted text-sm" style="margin: 0;">Use the form to schedule a clinic consultation.</p>
        </div>
      `;
      if (historyContainer) {
        historyContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <p style="font-weight: 600; margin-bottom: 4px;">No completed visits on record yet.</p>
            <p class="text-muted text-sm" style="margin: 0;">Once a clinic consultation is marked completed by staff, it will appear here in your visit history.</p>
          </div>
        `;
      }
      if (historyBadge) historyBadge.textContent = '0 Completed Visits';
      return;
    }

    // 2. Separate into Active/Upcoming vs. Completed Visit History (Feature 2)
    const upcoming = appointments.filter((app) => app.status !== 'completed');
    const completed = appointments
      .filter((app) => app.status === 'completed')
      .sort((a, b) => new Date(b.requested_date) - new Date(a.requested_date)); // Most recent first

    // Render Upcoming / Active Appointments
    if (upcoming.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <p style="font-weight: 600; margin-bottom: 4px;">No active or upcoming appointments.</p>
          <p class="text-muted text-sm" style="margin: 0;">Use the booking form to request a new consultation.</p>
        </div>
      `;
    } else {
      container.innerHTML = upcoming.map((app) => {
        const dateFormatted = new Date(app.requested_date).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });

        return `
          <div class="data-item">
            <div class="data-item-main">
              <div class="data-item-title">${escapeHtml(app.reason)}</div>
              <div class="data-item-meta">
                <span>📅 ${dateFormatted}</span>
                <span>Ref: #APP-${app.id}</span>
              </div>
            </div>
            <div class="data-item-actions">
              ${renderAppointmentStatusBadge(app.status)}
            </div>
          </div>
        `;
      }).join('');
    }

    // Render Visit History (Feature 2: only completed, sorted newest first)
    if (historyContainer) {
      if (historyBadge) {
        historyBadge.textContent = `${completed.length} Completed Visit${completed.length === 1 ? '' : 's'}`;
      }

      if (completed.length === 0) {
        historyContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <p style="font-weight: 600; margin-bottom: 4px;">No completed visits on record yet.</p>
            <p class="text-muted text-sm" style="margin: 0;">Once a clinic consultation is marked completed by staff, it will appear here in your visit history.</p>
          </div>
        `;
      } else {
        historyContainer.innerHTML = completed.map((app) => {
          const dateFormatted = new Date(app.requested_date).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          });

          return `
            <div class="data-item">
              <div class="data-item-main">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="data-item-title">${escapeHtml(app.reason)}</span>
                  <span class="badge badge-completed text-sm">✓ Completed Consultation</span>
                </div>
                <div class="data-item-meta" style="margin-top: 4px;">
                  <span>📅 Consulted: ${dateFormatted}</span>
                  <span>Record ID: #HIST-${app.id}</span>
                  <span>Status: Verified by Clinic Staff</span>
                </div>
              </div>
              <div class="data-item-actions">
                <span class="badge badge-approved">Archived</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-danger" style="margin: 0;">
        Failed to load appointments: ${escapeHtml(err.message)}
      </div>
    `;
  }
}

function initAppointmentBooking() {
  const form = document.getElementById('appointment-form');
  const refreshBtn = document.getElementById('refresh-appointments-btn');
  const alertEl = document.getElementById('appointment-form-alert');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadMyAppointments);
  }

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (alertEl) alertEl.style.display = 'none';

    const reason = document.getElementById('app-reason').value.trim();
    const dateVal = document.getElementById('app-date').value;
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!reason || !dateVal) {
      if (alertEl) {
        alertEl.textContent = 'Please fill out both the visit reason and requested date.';
        alertEl.style.display = 'block';
      }
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Booking...';
      }

      await api.post('/api/appointments', {
        reason,
        requested_date: new Date(dateVal).toISOString(),
      });

      form.reset();
      showDashboardAlert('Appointment requested successfully! The clinic staff will review and confirm your slot.', 'success');
      await loadMyAppointments();
    } catch (err) {
      if (alertEl) {
        alertEl.textContent = err.message || 'Failed to book appointment.';
        alertEl.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm Appointment Request';
      }
    }
  });
}

/**
 * ============================================================================
 * Section 2: Emergency Ambulance SOS
 * ============================================================================
 */
async function loadMyAmbulanceRequests() {
  const container = document.getElementById('ambulance-list');
  if (!container) return;

  try {
    const requests = await api.get('/api/ambulance-requests/mine');

    if (!requests || requests.length === 0) {
      container.innerHTML = `
        <div class="empty-state card-compact" style="padding: 24px;">
          <p class="text-muted text-sm" style="margin: 0;">No active ambulance SOS requests.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = requests.map((req) => {
      const timeAgo = new Date(req.created_at).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      return `
        <div class="data-item">
          <div class="data-item-main">
            <div class="data-item-title">Ambulance Request #${req.id}</div>
            <div class="data-item-meta">
              <span>📍 ${escapeHtml(req.pickup_location)}</span>
              <span>🕒 ${timeAgo}</span>
              <span>GPS: ${req.latitude.toFixed(4)}, ${req.longitude.toFixed(4)}</span>
            </div>
          </div>
          <div class="data-item-actions">
            ${renderAmbulanceStatusBadge(req.status)}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-danger" style="margin: 0;">
        Failed to load ambulance tracking: ${escapeHtml(err.message)}
      </div>
    `;
  }
}

function initEmergencySOS() {
  const sosBtn = document.getElementById('sos-btn');
  const refreshBtn = document.getElementById('refresh-ambulance-btn');
  const locationInput = document.getElementById('manual-location');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadMyAmbulanceRequests);
  }

  if (!sosBtn) return;

  sosBtn.addEventListener('click', async () => {
    const locationText = locationInput?.value.trim() || 'Pune, Maharashtra (Device Coordinates)';

    const confirmed = confirm(
      `🚨 CONFIRM EMERGENCY SOS DISPATCH\n\nLocation: ${locationText}\nGPS: ${userCoordinates.latitude}, ${userCoordinates.longitude}\n\nDo you want to dispatch an ambulance now?`
    );
    if (!confirmed) return;

    try {
      sosBtn.disabled = true;
      sosBtn.innerHTML = `<span>⏳</span><span>DISPATCHING SOS...</span>`;

      const response = await api.post('/api/ambulance-requests', {
        pickup_location: locationText,
        latitude: userCoordinates.latitude,
        longitude: userCoordinates.longitude,
      });

      showDashboardAlert(`🚨 Emergency Ambulance #${response.id} requested! Staff notified at central clinic.`, 'danger');
      await loadMyAmbulanceRequests();
    } catch (err) {
      alert(`Emergency SOS failed: ${err.message}`);
    } finally {
      sosBtn.disabled = false;
      sosBtn.innerHTML = `<span style="font-size: 1.5rem;">🚨</span><span>REQUEST EMERGENCY AMBULANCE</span>`;
    }
  });
}

/**
 * ============================================================================
 * Section 3: Blood Matching Engine
 * ============================================================================
 */
function initBloodMatching() {
  const form = document.getElementById('blood-request-form');
  const alertEl = document.getElementById('blood-form-alert');
  const wrapper = document.getElementById('blood-matches-wrapper');
  const grid = document.getElementById('donor-matches-grid');
  const countBadge = document.getElementById('matches-count-badge');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (alertEl) alertEl.style.display = 'none';

    const bloodGroup = document.getElementById('blood-group-select').value;
    const location = document.getElementById('blood-location').value.trim();
    const urgency = document.getElementById('blood-urgency').value;
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!bloodGroup || !location) {
      if (alertEl) {
        alertEl.textContent = 'Please select a blood group and enter location.';
        alertEl.style.display = 'block';
      }
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Matching Donors...';
      }

      // 1. Submit blood request
      const bloodReq = await api.post('/api/blood-requests', {
        blood_group_needed: bloodGroup,
        location,
        latitude: userCoordinates.latitude,
        longitude: userCoordinates.longitude,
        urgency,
      });

      // 2. Fetch ranked compatible donors
      const matches = await api.get(`/api/blood-requests/${bloodReq.id}/matches`);

      // 3. Render matches
      wrapper.style.display = 'block';
      if (countBadge) {
        countBadge.textContent = `${matches.length} Compatible Donors Found`;
      }

      if (!matches || matches.length === 0) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">🩸</div>
            <p>No available donors found matching type ${escapeHtml(bloodGroup)}.</p>
            <p class="text-muted text-sm">Our medical coordination team has been notified of your requirement.</p>
          </div>
        `;
      } else {
        grid.innerHTML = matches.map((donor) => `
          <div class="donor-card">
            <div class="donor-card-top">
              <span class="donor-name">${escapeHtml(donor.name)}</span>
              <span class="badge badge-confirmed">Group: ${escapeHtml(donor.blood_group)}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="donor-distance">📍 ${donor.distance_km} km away</span>
              <span class="badge badge-approved text-sm">Available</span>
            </div>

            <a href="tel:${escapeHtml(donor.phone)}" class="donor-phone-btn">
              <span>📞</span>
              <span>Call ${escapeHtml(donor.phone)}</span>
            </a>
          </div>
        `).join('');
      }

      // Smooth scroll to results
      wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
      if (alertEl) {
        alertEl.textContent = err.message || 'Failed to match blood donors.';
        alertEl.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Find Compatible Donors';
      }
    }
  });
}

/**
 * UI Badges and Helpers
 */
function renderAppointmentStatusBadge(status) {
  switch (status) {
    case 'confirmed':
      return `<span class="badge badge-confirmed">✓ Confirmed</span>`;
    case 'completed':
      return `<span class="badge badge-completed">✓ Completed</span>`;
    case 'no_show':
      return `<span class="badge badge-noshow">● No Show</span>`;
    default:
      return `<span class="badge badge-pending">● Requested</span>`;
  }
}

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

function showDashboardAlert(msg, type = 'info') {
  const alertEl = document.getElementById('dashboard-alert');
  if (!alertEl) return;
  alertEl.className = `alert alert-${type}`;
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

/**
 * ============================================================================
 * Available Ambulances Fleet Proximity (Feature 3)
 * ============================================================================
 */
async function loadNearbyAmbulances() {
  const container = document.getElementById('nearby-ambulances-list');
  if (!container) return;

  try {
    const ambulances = await api.get(
      `/api/ambulances/nearby?lat=${userCoordinates.latitude}&lon=${userCoordinates.longitude}`
    );

    if (!ambulances || ambulances.length === 0) {
      container.innerHTML = `
        <div class="empty-state card-compact" style="grid-column: 1 / -1; padding: 20px;">
          <p class="text-muted text-sm" style="margin: 0;">No ambulances currently available in this radius.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = ambulances.map((amb) => `
      <div class="donor-card" style="padding: 16px;">
        <div class="donor-card-top">
          <span class="donor-name" style="font-size: 0.95rem;">🚑 ${escapeHtml(amb.name)}</span>
          <span class="badge badge-approved text-sm">● Available</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
          <span class="donor-distance" style="font-size: 0.8rem;">📍 ${amb.distance_km} km away</span>
          <span class="text-sm text-muted">Ready to dispatch</span>
        </div>
      </div>
    `).join('');

  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-danger" style="grid-column: 1 / -1; margin: 0; padding: 12px;">
        Failed to load fleet: ${escapeHtml(err.message)}
      </div>
    `;
  }
}

// Make globally available for button clicks
window.loadNearbyAmbulances = loadNearbyAmbulances;

/**
 * ============================================================================
 * Lightweight Follow-up Reminder Banner (Feature 6)
 * ============================================================================
 */
function checkAppointmentReminder(appointments) {
  const banner = document.getElementById('appointment-reminder-banner');
  const textEl = document.getElementById('appointment-reminder-text');
  if (!banner || !textEl || !appointments || appointments.length === 0) return;

  if (sessionStorage.getItem('rapidcare_dismiss_reminder')) {
    banner.style.display = 'none';
    return;
  }

  const now = new Date();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Find an upcoming appointment in the next 24 hours
  const upcomingIn24h = appointments.find((app) => {
    if (app.status === 'cancelled' || app.status === 'no_show' || app.status === 'completed') {
      return false;
    }
    const appDate = new Date(app.requested_date);
    return appDate >= now && appDate <= next24h;
  });

  if (upcomingIn24h) {
    const d = new Date(upcomingIn24h.requested_date);
    const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeFormatted = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    textEl.innerHTML = `<strong>Reminder:</strong> You have an upcoming consultation for <em>"${escapeHtml(upcomingIn24h.reason)}"</em> on <strong>${dateFormatted}</strong> at <strong>${timeFormatted}</strong>.`;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

window.dismissAppointmentReminder = function () {
  const banner = document.getElementById('appointment-reminder-banner');
  if (banner) banner.style.display = 'none';
  sessionStorage.setItem('rapidcare_dismiss_reminder', 'true');
};
