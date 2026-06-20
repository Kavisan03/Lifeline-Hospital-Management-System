// State caches
let patientsCache = [];
let doctorsCache = [];
let appointmentsCache = [];
let ecgAnimationId = null;
let currentUser = null; // Stores logged-in admin: { username, role, shift_start, shift_end, is_within_shift }

console.log("Lifeline app.js script loaded successfully.");

// Initialize App when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DOMContentLoaded fired.");
        initApp();
    });
} else {
    console.log("Document already ready. Direct initialization.");
    initApp();
}

function initApp() {
    console.log("initApp starting setup...");
    
    // Set current date in header safely
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        currentDateEl.textContent = new Date().toLocaleDateString('en-US', dateOptions);
    }

    // Initialize SPA navigation
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            if (targetTab) {
                switchTab(targetTab);
            }
        });
    });

    // Add search input binding safely
    const searchEl = document.getElementById('global-search');
    if (searchEl) {
        searchEl.addEventListener('input', handleSearch);
    }

    // Form Submissions safely
    const formPatient = document.getElementById('form-patient');
    if (formPatient) {
        formPatient.addEventListener('submit', handlePatientSubmit);
    }

    const formDoctor = document.getElementById('form-doctor');
    if (formDoctor) {
        formDoctor.addEventListener('submit', handleDoctorSubmit);
    }

    const formAppointment = document.getElementById('form-appointment');
    if (formAppointment) {
        formAppointment.addEventListener('submit', handleAppointmentSubmit);
    }

    const formLogin = document.getElementById('form-login');
    if (formLogin) {
        formLogin.addEventListener('submit', handleLoginSubmit);
    }

    const formAdmin = document.getElementById('form-admin');
    if (formAdmin) {
        formAdmin.addEventListener('submit', handleAdminSubmit);
    }

    // Quick Book Appointment Header Button safely
    const quickBookBtn = document.getElementById('btn-quick-appointment');
    if (quickBookBtn) {
        quickBookBtn.addEventListener('click', () => {
            openModal('modal-appointment');
        });
    }

    // Logout Click Binding
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogoutClick);
    }

    // Verify Session and load initial views
    checkSession();
}

/**
 * Handle switching tabs in SPA
 * @param {string} tabName 
 */
function switchTab(tabName) {
    if (tabName === 'admins' && (!currentUser || currentUser.role !== 'Super Admin')) {
        return;
    }

    // Toggle navigation buttons active state
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Toggle content panes
    const panes = document.querySelectorAll('.tab-pane');
    panes.forEach(pane => {
        if (pane.id === `tab-${tabName}`) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });

    // Control background animations depending on visible context
    if (ecgAnimationId) {
        cancelAnimationFrame(ecgAnimationId);
        ecgAnimationId = null;
    }

    // Run active tab tasks
    if (tabName === 'dashboard') {
        loadDashboardData();
        initECGMonitor();
    } else if (tabName === 'patients') {
        loadPatientsData();
    } else if (tabName === 'doctors') {
        loadDoctorsData();
    } else if (tabName === 'appointments') {
        loadAppointmentsData();
    } else if (tabName === 'admins') {
        loadAdminsData();
    }

    // Reset Search input safely
    const searchEl = document.getElementById('global-search');
    if (searchEl) {
        searchEl.value = '';
    }
}

/**
 * Open Modal Sheet
 * @param {string} modalId 
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.add('open');

    // If opening appointment booking, pre-populate select selectors
    if (modalId === 'modal-appointment') {
        populateDropdowns();
    }
}

/**
 * Close Modal Sheet
 * @param {string} modalId 
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('open');
    // Clear validation warnings
    const errorBanner = modal.querySelector('.error-banner');
    if (errorBanner) {
        errorBanner.style.display = 'none';
        errorBanner.textContent = '';
    }
    // Clear form fields
    const form = modal.querySelector('form');
    if (form) form.reset();
}

/**
 * Show actions toast notifications
 * @param {string} message 
 */
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Escapes characters for HTML outputs (XSS prevention)
 * @param {any} val 
 * @returns {string} Safe value
 */
function sanitizeHTML(val) {
    if (val === null || val === undefined) return '';
    return String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ========================================================
   API FETCH OPERATIONS & RENDERERS
   ======================================================== */

/**
 * Pull updates across caches to prevent delays
 */
async function refreshAllData() {
    try {
        const [patientsRes, doctorsRes, appointmentsRes] = await Promise.all([
            fetch('patients.php').then(r => r.json()),
            fetch('doctors.php').then(r => r.json()),
            fetch('appointments.php').then(r => r.json())
        ]);

        if (patientsRes.status === 'success') patientsCache = patientsRes.data;
        if (doctorsRes.status === 'success') doctorsCache = doctorsRes.data;
        if (appointmentsRes.status === 'success') appointmentsCache = appointmentsRes.data;

        // Auto load current views
        loadDashboardData();
    } catch (err) {
        console.error("Failed caching dashboard assets:", err);
    }
}

/**
 * Populate appointment dropdown selectors
 */
function populateDropdowns() {
    const patientSel = document.getElementById('app_patient');
    const doctorSel = document.getElementById('app_doctor');

    // Populate patients
    patientSel.innerHTML = '<option value="" disabled selected>Select Patient</option>';
    patientsCache.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `${p.first_name} ${p.last_name} (ID: ${p.id})`;
        patientSel.appendChild(option);
    });

    // Populate doctors
    doctorSel.innerHTML = '<option value="" disabled selected>Select Doctor</option>';
    doctorsCache.forEach(d => {
        const option = document.createElement('option');
        option.value = d.id;
        option.textContent = `Dr. ${d.first_name} ${d.last_name} (${d.specialization})`;
        doctorSel.appendChild(option);
    });
}

/**
 * Safe fetch helper that intercepts network errors and CORS blocks (e.g. file:// protocol)
 * @param {string} url 
 * @returns {Promise<object>} Response data or error status object
 */
async function safeFetchJSON(url) {
    try {
        const res = await fetch(url);
        // If not successful or not JSON, this will catch and handle it
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.warn(`[Lifeline API SafeFetch] Request failed for ${url}:`, e.message);
        return { status: 'error', message: e.message, data: [] };
    }
}

/**
 * Pull updates across caches to prevent delays
 */
async function refreshAllData() {
    console.log("Refreshing database cache...");
    const [patientsRes, doctorsRes, appointmentsRes] = await Promise.all([
        safeFetchJSON('patients.php'),
        safeFetchJSON('doctors.php'),
        safeFetchJSON('appointments.php')
    ]);

    if (patientsRes.status === 'success') patientsCache = patientsRes.data;
    if (doctorsRes.status === 'success') doctorsCache = doctorsRes.data;
    if (appointmentsRes.status === 'success') appointmentsCache = appointmentsRes.data;

    // Auto load current views
    await loadDashboardData();
}

/**
 * Render Dashboard metrics and upcoming rows
 */
async function loadDashboardData() {
    const result = await safeFetchJSON('dashboard.php');
    
    if (result.status === 'success' && result.data) {
        const metrics = result.data.metrics || {};
        
        const patientsEl = document.getElementById('stat-patients');
        if (patientsEl) patientsEl.textContent = Number(metrics.total_patients || 0).toLocaleString();
        
        const doctorsEl = document.getElementById('stat-doctors');
        if (doctorsEl) doctorsEl.textContent = Number(metrics.total_doctors || 0).toLocaleString();
        
        const appointmentsEl = document.getElementById('stat-appointments');
        if (appointmentsEl) appointmentsEl.textContent = Number(metrics.total_appointments || 0).toLocaleString();

        // Set progress text & bar
        const total = metrics.total_appointments || 0;
        const confirmed = metrics.confirmed_appointments || 0;
        const pending = metrics.pending_appointments || 0;
        
        const progressLabel = document.getElementById('stat-progress-label');
        if (progressLabel) {
            progressLabel.textContent = `Status: ${pending} Pending / ${confirmed} Confirmed`;
        }
        
        const fillPct = total > 0 ? Math.round((confirmed / total) * 100) : 0;
        const barFill = document.getElementById('stat-progress-bar');
        if (barFill) {
            barFill.style.width = `${fillPct}%`;
        }

        renderDashboardUpcoming(result.data.upcoming || []);
    } else {
        // Fallback for file:// or failed DB connection: Draw dummy/empty list state safely
        renderDashboardUpcoming([]);
    }
}

function renderDashboardUpcoming(schedules) {
    const container = document.getElementById('dashboard-upcoming');
    container.innerHTML = '';

    if (schedules.length === 0) {
        container.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;">No upcoming appointments scheduled today.</div>';
        return;
    }

    // Limit to 3 items on dashboard preview grid
    schedules.slice(0, 3).forEach(item => {
        const card = document.createElement('div');
        card.className = 'upcoming-card';

        const dateObj = new Date(item.appointment_date);
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

        const initials = `${item.patient_first[0] || ''}${item.patient_last[0] || ''}`.toUpperCase();

        card.innerHTML = `
            <div class="card-header">
                <div class="patient-info">
                    <div class="patient-badge">${initials}</div>
                    <div class="patient-details">
                        <h4>${sanitizeHTML(item.patient_first)} ${sanitizeHTML(item.patient_last)}</h4>
                        <span>Patient</span>
                    </div>
                </div>
                <div class="upcoming-card-caret"><i class="fa-solid fa-chevron-right"></i></div>
            </div>
            <div class="appointment-card-body">
                <div class="detail-row">
                    <span class="detail-label">Time</span>
                    <span class="detail-val">${dateStr} @ ${timeStr}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Doctor</span>
                    <span class="detail-val doc-name">Dr. ${sanitizeHTML(item.doctor_last)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Department</span>
                    <span class="detail-val">${sanitizeHTML(item.specialization)}</span>
                </div>
                <div class="detail-row" style="margin-top: 0.25rem;">
                    <span class="detail-label">Status</span>
                    <span class="status-badge ${item.status.toLowerCase()}">${sanitizeHTML(item.status)}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

/**
 * Fetch and Render Patients page list
 */
async function loadPatientsData() {
    const tableBody = document.getElementById('patients-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">Fetching patients data...</td></tr>';
    
    const json = await safeFetchJSON('patients.php');
    if (json.status === 'success') {
        patientsCache = json.data || [];
        renderPatients(patientsCache);
    } else {
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:var(--status-cancelled)">Failed to load data: ${json.message || 'Unknown error'}</td></tr>`;
    }
}

function renderPatients(list) {
    const tableBody = document.getElementById('patients-table-body');
    tableBody.innerHTML = '';

    if (list.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No patient records match the filter.</td></tr>';
        return;
    }

    list.forEach(p => {
        const tr = document.createElement('tr');
        const initials = `${p.first_name[0] || ''}${p.last_name[0] || ''}`.toUpperCase();
        const colors = [
            'linear-gradient(135deg, #a855f7, #ec4899)',
            'linear-gradient(135deg, #3b82f6, #06b6d4)',
            'linear-gradient(135deg, #10b981, #059669)',
            'linear-gradient(135deg, #f59e0b, #d97706)',
            'linear-gradient(135deg, #6366f1, #4f46e5)',
            'linear-gradient(135deg, #ec4899, #f43f5e)'
        ];
        const gradient = colors[p.id % colors.length];

        tr.innerHTML = `
            <td>
                <div class="avatar" style="width: 34px; height: 34px; border: 1.5px solid rgba(255,255,255,0.15); background: ${gradient}; font-size: 0.8rem; font-weight: 700; color: #fff; margin: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer;" title="Click to view appointments" onclick="filterAppointmentsByPatient('${sanitizeHTML(p.first_name)} ${sanitizeHTML(p.last_name)}')">
                    ${initials}
                </div>
            </td>
            <td style="font-weight: 600;">${sanitizeHTML(p.first_name)} ${sanitizeHTML(p.last_name)} <span style="font-size: 0.75rem; color: var(--color-text-secondary); margin-left: 0.25rem;">(ID: ${sanitizeHTML(p.id)})</span></td>
            <td>${sanitizeHTML(p.email)}</td>
            <td>${sanitizeHTML(p.phone)}</td>
            <td>${sanitizeHTML(p.date_of_birth)}</td>
            <td><span class="doc-tag">${sanitizeHTML(p.gender)}</span></td>
        `;
        tableBody.appendChild(tr);
    });
}

/**
 * Fetch and Render Doctors page list
 */
async function loadDoctorsData() {
    const tableBody = document.getElementById('doctors-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" class="empty-state">Fetching doctors roster...</td></tr>';
    
    const json = await safeFetchJSON('doctors.php');
    if (json.status === 'success') {
        doctorsCache = json.data || [];
        renderDoctors(doctorsCache);
    } else {
        tableBody.innerHTML = `<tr><td colspan="5" class="empty-state" style="color:var(--status-cancelled)">Failed to load data: ${json.message || 'Unknown error'}</td></tr>`;
    }
}

function renderDoctors(list) {
    const tableBody = document.getElementById('doctors-table-body');
    tableBody.innerHTML = '';

    if (list.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No doctor records match the filter.</td></tr>';
        return;
    }

    list.forEach(d => {
        const tr = document.createElement('tr');
        const initials = `${d.first_name[0] || ''}${d.last_name[0] || ''}`.toUpperCase();
        const colors = [
            'linear-gradient(135deg, #a855f7, #ec4899)',
            'linear-gradient(135deg, #3b82f6, #06b6d4)',
            'linear-gradient(135deg, #10b981, #059669)',
            'linear-gradient(135deg, #f59e0b, #d97706)',
            'linear-gradient(135deg, #6366f1, #4f46e5)',
            'linear-gradient(135deg, #ec4899, #f43f5e)'
        ];
        const gradient = colors[d.id % colors.length];

        tr.innerHTML = `
            <td>
                <div class="avatar" style="width: 34px; height: 34px; border: 1.5px solid rgba(255,255,255,0.15); background: ${gradient}; font-size: 0.8rem; font-weight: 700; color: #fff; margin: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; cursor: pointer;" title="Click to view appointments" onclick="filterAppointmentsByDoctor('${sanitizeHTML(d.last_name)}')">
                    ${initials}
                </div>
            </td>
            <td style="font-weight: 600;">Dr. ${sanitizeHTML(d.first_name)} ${sanitizeHTML(d.last_name)} <span style="font-size: 0.75rem; color: var(--color-text-secondary); margin-left: 0.25rem;">(ID: ${sanitizeHTML(d.id)})</span></td>
            <td>${sanitizeHTML(d.email)}</td>
            <td>${sanitizeHTML(d.phone)}</td>
            <td><span class="doc-tag">${sanitizeHTML(d.specialization)}</span></td>
        `;
        tableBody.appendChild(tr);
    });
}

/**
 * Fetch and Render Appointments page list
 */
async function loadAppointmentsData() {
    const tableBody = document.getElementById('appointments-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="8" class="empty-state">Fetching appointment calendars...</td></tr>';
    
    const json = await safeFetchJSON('appointments.php');
    if (json.status === 'success') {
        appointmentsCache = json.data || [];
        renderAppointments(appointmentsCache);
    } else {
        tableBody.innerHTML = `<tr><td colspan="8" class="empty-state" style="color:var(--status-cancelled)">Failed to load data: ${json.message || 'Unknown error'}</td></tr>`;
    }
}

function renderAppointments(list) {
    const tableBody = document.getElementById('appointments-table-body');
    tableBody.innerHTML = '';

    if (list.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="empty-state">No appointment details found.</td></tr>';
        return;
    }

    list.forEach(a => {
        const tr = document.createElement('tr');
        
        // Format appointment date nicely
        const dateObj = new Date(a.appointment_date);
        const formattedDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + 
                              ' at ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Action operations buttons conditional rendering based on status
        let actionsHtml = '';
        const isSuper = currentUser && currentUser.role === 'Super Admin';
        const inShift = currentUser && (currentUser.is_within_shift || isSuper);
        const canAppointment = currentUser && (isSuper || currentUser.role === 'Desk Admin') && inShift;

        if (a.status !== 'Completed' && a.status !== 'Cancelled') {
            if (canAppointment) {
                actionsHtml = `
                    <div class="row-actions-group">
                        <button class="row-action-btn confirm-act" title="Confirm Appointment" onclick="updateAppointmentStatus(${a.id}, 'Confirmed')">
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button class="row-action-btn" style="color: var(--color-primary);" title="Mark as Completed" onclick="updateAppointmentStatus(${a.id}, 'Completed')">
                            <i class="fa-solid fa-circle-check"></i>
                        </button>
                        <button class="row-action-btn cancel-act" title="Cancel Appointment" onclick="updateAppointmentStatus(${a.id}, 'Cancelled')">
                            <i class="fa-solid fa-ban"></i>
                        </button>
                    </div>
                `;
            } else {
                actionsHtml = `<span style="font-size:0.8rem;color:var(--color-text-secondary);font-style:italic;">Read-Only</span>`;
            }
        } else {
            actionsHtml = `<span style="font-size:0.8rem;color:var(--color-text-secondary);font-style:italic;">No Actions Available</span>`;
        }

        tr.innerHTML = `
            <td>#${sanitizeHTML(a.id)}</td>
            <td style="font-weight:600;">${sanitizeHTML(a.patient_first)} ${sanitizeHTML(a.patient_last)}</td>
            <td>Dr. ${sanitizeHTML(a.doctor_first)} ${sanitizeHTML(a.doctor_last)}</td>
            <td><span class="doc-tag">${sanitizeHTML(a.specialization)}</span></td>
            <td>${sanitizeHTML(formattedDate)}</td>
            <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sanitizeHTML(a.notes)}">
                ${sanitizeHTML(a.notes || 'N/A')}
            </td>
            <td><span class="status-badge ${a.status.toLowerCase()}">${sanitizeHTML(a.status)}</span></td>
            <td class="text-right">${actionsHtml}</td>
        `;
        tableBody.appendChild(tr);
    });
}

/**
 * API call to update status of an appointment
 * @param {number} id 
 * @param {string} newStatus 
 */
async function updateAppointmentStatus(id, newStatus) {
    try {
        const response = await fetch('appointments.php', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: newStatus })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            showToast(`Appointment status updated to ${newStatus}!`);
            // Refresh caches and current views
            await refreshAllData();
            
            // Check active views and trigger redraws
            const activeTab = document.querySelector('.nav-btn.active').getAttribute('data-tab');
            if (activeTab === 'appointments') {
                renderAppointments(appointmentsCache);
            }
        } else {
            alert(data.message || "Failed updating status");
        }
    } catch (err) {
        console.error("Status update error:", err);
    }
}

/* ========================================================
   FORM SUBMISSIONS INTERACTION HANDLERS
   ======================================================== */

async function handlePatientSubmit(e) {
    e.preventDefault();
    const errorEl = document.getElementById('p-error');
    errorEl.style.display = 'none';

    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('patients.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (result.status === 'success') {
            showToast("New patient registered successfully!");
            closeModal('modal-patient');
            await refreshAllData();
            
            const activeTab = document.querySelector('.nav-btn.active').getAttribute('data-tab');
            if (activeTab === 'patients') {
                renderPatients(patientsCache);
            }
        } else {
            errorEl.textContent = result.message;
            errorEl.style.display = 'block';
        }
    } catch (err) {
        errorEl.textContent = "Service unavailable, please retry later.";
        errorEl.style.display = 'block';
    }
}

async function handleDoctorSubmit(e) {
    e.preventDefault();
    const errorEl = document.getElementById('d-error');
    errorEl.style.display = 'none';

    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('doctors.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (result.status === 'success') {
            showToast("New doctor added successfully!");
            closeModal('modal-doctor');
            await refreshAllData();
            
            const activeTab = document.querySelector('.nav-btn.active').getAttribute('data-tab');
            if (activeTab === 'doctors') {
                renderDoctors(doctorsCache);
            }
        } else {
            errorEl.textContent = result.message;
            errorEl.style.display = 'block';
        }
    } catch (err) {
        errorEl.textContent = "Service unavailable, please retry.";
        errorEl.style.display = 'block';
    }
}

async function handleAppointmentSubmit(e) {
    e.preventDefault();
    const errorEl = document.getElementById('app-error');
    errorEl.style.display = 'none';

    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('appointments.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (result.status === 'success') {
            showToast("Appointment booked successfully!");
            closeModal('modal-appointment');
            await refreshAllData();
            
            const activeTab = document.querySelector('.nav-btn.active').getAttribute('data-tab');
            if (activeTab === 'appointments') {
                renderAppointments(appointmentsCache);
            }
        } else {
            errorEl.textContent = result.message;
            errorEl.style.display = 'block';
        }
    } catch (err) {
        errorEl.textContent = "Service unavailable, please check connections.";
        errorEl.style.display = 'block';
    }
}

/* ========================================================
   SEARCH FILTER LOGIC
   ======================================================== */

function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const activeTab = document.querySelector('.nav-btn.active').getAttribute('data-tab');

    if (activeTab === 'patients') {
        const filtered = patientsCache.filter(p => 
            p.first_name.toLowerCase().includes(query) || 
            p.last_name.toLowerCase().includes(query) || 
            p.email.toLowerCase().includes(query) ||
            p.phone.includes(query)
        );
        renderPatients(filtered);
    } else if (activeTab === 'doctors') {
        const filtered = doctorsCache.filter(d => 
            d.first_name.toLowerCase().includes(query) || 
            d.last_name.toLowerCase().includes(query) || 
            d.specialization.toLowerCase().includes(query) ||
            d.email.toLowerCase().includes(query)
        );
        renderDoctors(filtered);
    } else if (activeTab === 'appointments') {
        const filtered = appointmentsCache.filter(a => 
            a.patient_first.toLowerCase().includes(query) || 
            a.patient_last.toLowerCase().includes(query) || 
            a.doctor_last.toLowerCase().includes(query) ||
            a.specialization.toLowerCase().includes(query) ||
            (a.notes && a.notes.toLowerCase().includes(query))
        );
        renderAppointments(filtered);
    } else if (activeTab === 'dashboard') {
        // Redraw lists
        if (query === '') {
            refreshAllData();
        } else {
            const filtered = appointmentsCache.filter(a => 
                a.patient_first.toLowerCase().includes(query) || 
                a.patient_last.toLowerCase().includes(query) || 
                a.doctor_last.toLowerCase().includes(query)
            );
            renderDashboardUpcoming(filtered.slice(0, 3));
        }
    }
}

/* ========================================================
   LIVE VITAL SIGNALS MONITOR (EKG WAVEFORM SCANNER)
   ======================================================== */

function initECGMonitor() {
    const canvas = document.getElementById('ecg-monitor-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let x = 0;
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear background initially
    ctx.fillStyle = '#030107';
    ctx.fillRect(0, 0, width, height);

    const points = [];
    const step = 2;
    const midY = height / 2;

    function draw() {
        if (!document.getElementById('ecg-monitor-canvas')) return; // Guard in case DOM changed
        
        // Draw sweeping semi-transparent bar ahead of scan line to hide old trail
        ctx.fillStyle = 'rgba(3, 1, 7, 0.16)';
        ctx.fillRect(x, 0, 16, height);
        
        ctx.strokeStyle = '#ec4899'; // Magenta glow EKG line matching theme accent
        ctx.lineWidth = 2.2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#ec4899';
        
        ctx.beginPath();
        
        // Calculate y coordinate mimicking real QRS heartbeat waves
        let y = midY;
        const cycle = x % 90; // length of one heart cycle in steps

        if (cycle > 25 && cycle < 30) {
            y = midY - 2; // P wave
        } else if (cycle >= 30 && cycle < 33) {
            y = midY + 3; // Q dip
        } else if (cycle >= 33 && cycle < 36) {
            y = midY - 18; // R spike
        } else if (cycle >= 36 && cycle < 39) {
            y = midY + 12; // S dip
        } else if (cycle >= 39 && cycle < 43) {
            y = midY - 4; // T wave
        } else {
            // Natural resting vitals wiggles
            y = midY + (Math.random() - 0.5) * 1.2;
        }

        // Heartbeat visual trigger on the R spike peak
        if (cycle === 34) {
            triggerHeartbeatVisual();
        }

        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.moveTo(x - step, points[points.length - 1] || midY);
            ctx.lineTo(x, y);
        }
        ctx.stroke();

        points.push(y);
        if (points.length > width / step) {
            points.shift();
        }

        x += step;
        if (x >= width) {
            x = 0;
        }

        ecgAnimationId = requestAnimationFrame(draw);
    }
    
    draw();
}

function triggerHeartbeatVisual() {
    const icon = document.querySelector('.heart-pulse-icon');
    const bpmCounter = document.getElementById('live-bpm');
    
    if (icon) {
        icon.style.transform = 'scale(1.3)';
        icon.style.color = '#a855f7'; // Orchid purple highlight during contraction
        setTimeout(() => {
            icon.style.transform = '';
            icon.style.color = '';
        }, 150);
    }

    if (bpmCounter) {
        const baseBpm = 74;
        const variance = Math.floor(Math.random() * 4) - 2; // minor variance
        bpmCounter.textContent = baseBpm + variance;
    }
}

/* ========================================================
   AUTHENTICATION, SESSION & RBAC SYSTEM HELPERS
   ======================================================== */

/**
 * Checks session with backend to see if admin is logged in.
 * Updates views and profile drawers accordingly.
 */
async function checkSession() {
    try {
        const response = await fetch('session.php');
        const result = await response.json();

        if (response.ok && result.status === 'success') {
            currentUser = result.data;

            // Show application layouts
            const loginOverlay = document.getElementById('login-overlay');
            if (loginOverlay) loginOverlay.style.display = 'none';

            const appLayout = document.getElementById('app-layout');
            if (appLayout) appLayout.style.display = '';

            // Run role layouts setup
            setupRBACUI();

            // Refresh data caches
            await refreshAllData();

            // Load initial EKG vital monitors
            const activeTab = document.querySelector('.nav-btn.active')?.getAttribute('data-tab');
            if (activeTab === 'dashboard') {
                initECGMonitor();
            } else if (activeTab === 'admins') {
                if (currentUser.role === 'Super Admin') {
                    loadAdminsData();
                } else {
                    switchTab('dashboard');
                }
            }
        } else {
            throw new Error("No active session.");
        }
    } catch (err) {
        currentUser = null;

        // Reset layouts back to login state
        const appLayout = document.getElementById('app-layout');
        if (appLayout) appLayout.style.display = 'none';

        const loginOverlay = document.getElementById('login-overlay');
        if (loginOverlay) loginOverlay.style.display = '';

        if (ecgAnimationId) {
            cancelAnimationFrame(ecgAnimationId);
            ecgAnimationId = null;
        }
    }
}

/**
 * Configures the sidebar profiles and page actions dynamically depending on role & shift hours
 */
function setupRBACUI() {
    if (!currentUser) return;

    // 1. Configure Sidebar Profile Drawer
    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) {
        avatarEl.textContent = currentUser.username.substring(0, 2).toUpperCase();
    }

    const usernameEl = document.getElementById('profile-username');
    if (usernameEl) {
        usernameEl.textContent = currentUser.username;
    }

    const roleEl = document.getElementById('profile-role');
    if (roleEl) {
        roleEl.textContent = currentUser.role;
    }

    // 2. Configure shift status dot and label
    const dotEl = document.getElementById('profile-shift-indicator');
    const textEl = document.getElementById('profile-shift-text');

    if (dotEl && textEl) {
        dotEl.className = 'shift-dot'; // reset
        const isSuper = currentUser.role === 'Super Admin';
        const inShift = currentUser.is_within_shift || isSuper;

        if (isSuper) {
            dotEl.classList.add('active');
            textEl.textContent = '24/7 Super Admin';
        } else if (inShift) {
            dotEl.classList.add('active');
            textEl.textContent = `On Shift (${formatTimeShort(currentUser.shift_start)} - ${formatTimeShort(currentUser.shift_end)})`;
        } else {
            dotEl.classList.add('inactive');
            textEl.textContent = `Outside Shift (${formatTimeShort(currentUser.shift_start)} - ${formatTimeShort(currentUser.shift_end)})`;
        }
    }

    // 3. Display warning banner if outside of shift bounds
    const mainContent = document.querySelector('.main-content');
    const contentHeader = document.querySelector('.content-header');
    let warningBanner = document.getElementById('shift-warning-banner');

    const isSuper = currentUser.role === 'Super Admin';
    const inShift = currentUser.is_within_shift || isSuper;

    if (!inShift) {
        if (!warningBanner && mainContent && contentHeader) {
            warningBanner = document.createElement('div');
            warningBanner.id = 'shift-warning-banner';
            warningBanner.className = 'error-banner';
            warningBanner.style.marginTop = '0';
            warningBanner.style.marginBottom = '2.5rem';
            warningBanner.style.padding = '1.25rem 1.5rem';
            warningBanner.style.borderRadius = '16px';
            warningBanner.style.fontWeight = '600';
            warningBanner.style.display = 'flex';
            warningBanner.style.alignItems = 'center';
            warningBanner.style.gap = '0.75rem';
            warningBanner.style.fontSize = '0.95rem';
            warningBanner.style.boxShadow = '0 8px 24px rgba(239, 68, 68, 0.15)';
            
            warningBanner.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.25rem;"></i>
                <span>Access Restrained: You are currently outside your assigned shift hours (${formatTimeShort(currentUser.shift_start)} - ${formatTimeShort(currentUser.shift_end)}). You have read-only access. Write operations are blocked.</span>
            `;
            mainContent.insertBefore(warningBanner, contentHeader.nextSibling);
        }
    } else {
        if (warningBanner) {
            warningBanner.remove();
        }
    }

    // 4. Toggle Admins Navigation tab for Super Admin only
    const navBtnAdmins = document.getElementById('nav-btn-admins');
    if (navBtnAdmins) {
        navBtnAdmins.style.display = isSuper ? 'flex' : 'none';
    }

    // 5. Enforce Action Permissions constraints across pages
    const canPatient = (isSuper || currentUser.role === 'Desk Admin') && inShift;
    const canDoctor = (isSuper || currentUser.role === 'Doctor Admin') && inShift;
    const canAppointment = (isSuper || currentUser.role === 'Desk Admin') && inShift;

    // Hide register patients triggers
    document.querySelectorAll('[onclick*="modal-patient"]').forEach(el => {
        el.style.display = canPatient ? '' : 'none';
    });

    // Hide add doctors triggers
    document.querySelectorAll('[onclick*="modal-doctor"]').forEach(el => {
        el.style.display = canDoctor ? '' : 'none';
    });

    // Hide book appointments triggers
    document.querySelectorAll('[onclick*="modal-appointment"]').forEach(el => {
        el.style.display = canAppointment ? '' : 'none';
    });
    const quickBookBtn = document.getElementById('btn-quick-appointment');
    if (quickBookBtn) {
        quickBookBtn.style.display = canAppointment ? '' : 'none';
    }

    // Quick Actions operations container placeholder
    const quickActionsContainer = document.querySelector('.quick-actions');
    if (quickActionsContainer) {
        let placeholder = document.getElementById('quick-actions-placeholder');
        if (!canPatient && !canDoctor && !canAppointment) {
            if (!placeholder) {
                placeholder = document.createElement('div');
                placeholder.id = 'quick-actions-placeholder';
                placeholder.className = 'empty-state';
                placeholder.style.gridColumn = '1 / -1';
                placeholder.style.padding = '2rem 0';
                placeholder.innerHTML = '<i class="fa-solid fa-lock" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block; color: var(--color-text-secondary);"></i> No operations available for your current role or shift time.';
                quickActionsContainer.appendChild(placeholder);
            }
        } else {
            if (placeholder) {
                placeholder.remove();
            }
        }
    }
}

/**
 * Format time HH:MM:SS to HH:MM format for clean visual look
 * @param {string} t 
 * @returns {string} HH:MM
 */
function formatTimeShort(t) {
    if (!t) return '00:00';
    const parts = t.split(':');
    if (parts.length >= 2) {
        return `${parts[0]}:${parts[1]}`;
    }
    return t;
}

/**
 * Handle Login Form Submit
 * @param {Event} e 
 */
async function handleLoginSubmit(e) {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
    }

    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('login.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        let result;
        const responseClone = response.clone();
        try {
            result = await response.json();
        } catch (jsonErr) {
            const rawText = await responseClone.text();
            if (errorEl) {
                let cleanMsg = rawText;
                const match = rawText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                if (match && match[1]) {
                    cleanMsg = match[1].replace(/<[^>]*>/g, ' ').trim();
                }
                errorEl.textContent = `Server Error: ${cleanMsg.substring(0, 150)}`;
                errorEl.style.display = 'block';
            }
            return;
        }

        if (response.ok && result.status === 'success') {
            e.target.reset();
            showToast(`Welcome back, ${result.data.username}!`);
            await checkSession();
        } else {
            if (errorEl) {
                errorEl.textContent = result.message || 'Invalid username or password.';
                errorEl.style.display = 'block';
            }
        }
    } catch (err) {
        if (errorEl) {
            errorEl.textContent = `Network Error: ${err.message || 'Server unavailable.'}`;
            errorEl.style.display = 'block';
        }
    }
}

/**
 * Handle Sign Out Click
 */
async function handleLogoutClick() {
    try {
        const response = await fetch('logout.php');
        const result = await response.json();

        if (result.status === 'success') {
            showToast("Successfully signed out.");
            await checkSession();
        } else {
            alert("Sign out failed.");
        }
    } catch (err) {
        console.error("Sign out network error:", err);
    }
}

/**
 * Fetch admins list (Super Admin only)
 */
async function loadAdminsData() {
    const tableBody = document.getElementById('admins-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">Fetching system administrators...</td></tr>';

    const json = await safeFetchJSON('admins.php');
    if (json.status === 'success') {
        renderAdmins(json.data || []);
    } else {
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:var(--status-cancelled)">Failed to load data: ${json.message || 'Unknown error'}</td></tr>`;
    }
}

/**
 * Check if a shift is active on client side
 * @param {string} role 
 * @param {string} start 
 * @param {string} end 
 * @returns {boolean}
 */
function isShiftActive(role, start, end) {
    if (role === 'Super Admin') return true;

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const normalizeTime = (t) => {
        if (!t) return '00:00:00';
        if (t.split(':').length === 2) return t + ':00';
        return t;
    };

    const startN = normalizeTime(start);
    const endN = normalizeTime(end);

    if (startN <= endN) {
        return (currentTime >= startN && currentTime <= endN);
    } else {
        return (currentTime >= startN || currentTime <= endN);
    }
}

/**
 * Render Admins list
 * @param {Array} list 
 */
function renderAdmins(list) {
    const tableBody = document.getElementById('admins-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (list.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No administrator records found.</td></tr>';
        return;
    }

    list.forEach(a => {
        const tr = document.createElement('tr');
        const active = isShiftActive(a.role, a.shift_start, a.shift_end);

        let badgeClass = 'offline';
        let statusText = 'Offline';
        if (a.role === 'Super Admin') {
            badgeClass = 'active';
            statusText = 'Active (24/7)';
        } else {
            badgeClass = active ? 'active' : 'inactive';
            statusText = active ? 'On Shift' : 'Outside Shift';
        }

        tr.innerHTML = `
            <td>#${sanitizeHTML(a.id)}</td>
            <td style="font-weight: 600;">${sanitizeHTML(a.username)}</td>
            <td><span class="doc-tag">${sanitizeHTML(a.role)}</span></td>
            <td>${sanitizeHTML(formatTimeShort(a.shift_start))}</td>
            <td>${sanitizeHTML(formatTimeShort(a.shift_end))}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 0.35rem;">
                    <span class="shift-dot ${badgeClass}"></span>
                    <span style="font-size: 0.85rem; color: var(--color-text-secondary);">${statusText}</span>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

/**
 * Handle new Administrator Registration submission
 * @param {Event} e 
 */
async function handleAdminSubmit(e) {
    e.preventDefault();
    const errorEl = document.getElementById('adm-error');
    if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
    }

    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('admins.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            showToast("New administrator registered successfully!");
            closeModal('modal-admin');
            await loadAdminsData();
        } else {
            if (errorEl) {
                errorEl.textContent = result.message || 'Failed to add administrator.';
                errorEl.style.display = 'block';
            }
        }
    } catch (err) {
        if (errorEl) {
            errorEl.textContent = 'Server unavailable. Please try again.';
            errorEl.style.display = 'block';
        }
    }
}

/**
 * Filter appointments roster automatically by doctor last name
 * @param {string} doctorLastName 
 */
function filterAppointmentsByDoctor(doctorLastName) {
    switchTab('appointments');
    const searchEl = document.getElementById('global-search');
    if (searchEl) {
        searchEl.value = doctorLastName;
        handleSearch({ target: searchEl });
    }
    showToast(`Filtering schedules for Dr. ${doctorLastName}`);
}

/**
 * Filter appointments roster automatically by patient full name
 * @param {string} patientFullName 
 */
function filterAppointmentsByPatient(patientFullName) {
    switchTab('appointments');
    const searchEl = document.getElementById('global-search');
    if (searchEl) {
        searchEl.value = patientFullName;
        handleSearch({ target: searchEl });
    }
    showToast(`Filtering schedules for patient ${patientFullName}`);
}
