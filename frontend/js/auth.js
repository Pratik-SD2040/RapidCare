/**
 * RapidCare Authentication & Registration Handler
 */

document.addEventListener('DOMContentLoaded', () => {
  initLoginForm();
  initPatientRegisterForm();
  initClinicRegisterForm();
  initLogoutButton();
});

/**
 * Handle Login Form
 */
function initLoginForm() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  const errorAlert = document.getElementById('login-error');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorAlert) {
      errorAlert.style.display = 'none';
      errorAlert.textContent = '';
    }

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    if (!email || !password) {
      showError(errorAlert, 'Please enter both email and password.');
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Authenticating...';
      }

      const response = await api.post('/api/login', { email, password });

      // Save token and user details
      api.setToken(response.access_token);
      api.setStoredUser({
        id: response.user_id,
        name: response.name,
        role: response.role,
        status: response.status,
      });

      // Role-based redirection
      if (response.role === 'super_admin') {
        window.location.href = 'admin-dashboard.html';
      } else if (response.role === 'clinic_staff') {
        window.location.href = 'clinic-dashboard.html';
      } else {
        window.location.href = 'patient-dashboard.html';
      }
    } catch (err) {
      showError(errorAlert, err.message || 'Login failed. Please check your credentials.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    }
  });
}

/**
 * Handle Patient Registration Form
 */
function initPatientRegisterForm() {
  const form = document.getElementById('patient-register-form');
  if (!form) return;

  const errorAlert = document.getElementById('register-error');
  const successAlert = document.getElementById('register-success');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlerts(errorAlert, successAlert);

    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    const blood_group = document.getElementById('reg-blood-group')?.value || null;
    const submitBtn = form.querySelector('button[type="submit"]');

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';
      }

      // Default Pune coordinates if not geolocated
      let latitude = 18.5204;
      let longitude = 73.8567;

      await api.post('/api/register', {
        name,
        email,
        phone,
        password,
        blood_group,
        latitude,
        longitude,
      });

      // Automatically log the patient in after successful registration
      const loginRes = await api.post('/api/login', { email, password });
      api.setToken(loginRes.access_token);
      api.setStoredUser({
        id: loginRes.user_id,
        name: loginRes.name,
        role: loginRes.role,
        status: loginRes.status,
      });

      if (successAlert) {
        successAlert.style.display = 'block';
        successAlert.textContent = 'Account created successfully! Redirecting to dashboard...';
      }

      setTimeout(() => {
        window.location.href = 'patient-dashboard.html';
      }, 1000);
    } catch (err) {
      showError(errorAlert, err.message || 'Registration failed. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Complete Registration';
      }
    }
  });
}

/**
 * Handle Clinic Staff Registration Form
 */
function initClinicRegisterForm() {
  const form = document.getElementById('clinic-register-form');
  if (!form) return;

  const errorAlert = document.getElementById('clinic-error');
  const successAlert = document.getElementById('clinic-success');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlerts(errorAlert, successAlert);

    const name = document.getElementById('clinic-name').value.trim();
    const email = document.getElementById('clinic-email').value.trim();
    const phone = document.getElementById('clinic-phone').value.trim();
    const password = document.getElementById('clinic-password').value;
    const submitBtn = form.querySelector('button[type="submit"]');

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting registration...';
      }

      const latitude = 18.5204;
      const longitude = 73.8567;

      await api.post('/api/register-clinic', {
        name,
        email,
        phone,
        password,
        latitude,
        longitude,
      });

      form.reset();
      if (successAlert) {
        successAlert.style.display = 'block';
        successAlert.innerHTML = `
          <strong>Application Received!</strong><br>
          Your clinic staff registration has been submitted and is currently <strong>pending verification</strong>.
          Our administration will review and activate your account before you can log in.
        `;
      }
    } catch (err) {
      showError(errorAlert, err.message || 'Clinic registration failed. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Clinic Registration';
      }
    }
  });
}

/**
 * Helper to fill demo credentials into login form
 */
window.fillDemo = function (role) {
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  if (!emailInput || !passInput) return;

  if (role === 'admin') {
    emailInput.value = 'admin@rapidcare.demo';
    passInput.value = 'admin1234';
  } else if (role === 'clinic') {
    emailInput.value = 'clinic@rapidcare.demo';
    passInput.value = 'demo1234';
  } else if (role === 'patient') {
    emailInput.value = 'patient@rapidcare.demo';
    passInput.value = 'demo1234';
  }
};

/**
 * Helper to select and animate demo credentials segmented toggle
 */
window.selectDemoToggle = function (role) {
  const toggle = document.getElementById('demo-toggle');
  const adminOpt = document.getElementById('demo-opt-admin');
  const clinicOpt = document.getElementById('demo-opt-clinic');
  const patientOpt = document.getElementById('demo-opt-patient');

  if (toggle) {
    toggle.setAttribute('data-selected', role);
  }

  [adminOpt, clinicOpt, patientOpt].forEach((opt) => {
    if (!opt) return;
    if (opt.id === `demo-opt-${role}`) {
      opt.classList.add('active');
    } else {
      opt.classList.remove('active');
    }
  });

  window.fillDemo(role);
};

/**
 * Handle Logout
 */
function initLogoutButton() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      api.clearAuth();
      window.location.href = 'index.html';
    });
  }
}

/**
 * Route protection guard for dashboard pages
 */
window.guardPage = function (requiredRole) {
  const token = api.getToken();
  const user = api.getStoredUser();

  if (!token || !user) {
    api.clearAuth();
    window.location.href = 'index.html';
    return null;
  }

  if (requiredRole && user.role !== requiredRole) {
    if (user.role === 'super_admin') {
      window.location.href = 'admin-dashboard.html';
    } else if (user.role === 'clinic_staff') {
      window.location.href = 'clinic-dashboard.html';
    } else {
      window.location.href = 'patient-dashboard.html';
    }
    return null;
  }

  return user;
};

// UI Helpers
function showError(el, msg) {
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function hideAlerts(...elements) {
  elements.forEach((el) => {
    if (el) {
      el.style.display = 'none';
      el.textContent = '';
    }
  });
}
