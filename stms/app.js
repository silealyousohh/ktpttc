/**
 * STMS - Student & Teacher Management System (ប្រព័ន្ធគ្រប់គ្រងគរុសនិស្សិត)
 * សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ (KTPTTC)
 * Core Controller, Workflows & RBAC State Management
 */

// Global State
let stmsData = {};
let currentUser = null; // Active authenticated user object
let currentRole = 'admin'; // 'admin' | 'trainer' | 'trainee'
let currentView = 'dashboard';
let currentTraineeUser = null; // When in trainee role

// Initialize Application - Enforce Mandatory Login Gate
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initAuth();
});

// Load from LocalStorage or Clean Config (No Auto Student Generation)
function loadData() {
  try {
    localStorage.removeItem('ktpttc_stms_data_v1'); // Purge legacy auto-seeded mock data
    const saved = localStorage.getItem('ktpttc_stms_data_v2');
    if (saved) {
      stmsData = JSON.parse(saved);
      if (!Array.isArray(stmsData.trainees)) stmsData.trainees = [];
      if (!Array.isArray(stmsData.attendanceSessions)) stmsData.attendanceSessions = [];
      if (!Array.isArray(stmsData.profileRequests)) stmsData.profileRequests = [];

      // Auto-sanitize trainees: clean any binary corrupted entries (e.g. invalid xlsx raw text import)
      const countBefore = stmsData.trainees.length;
      stmsData.trainees = stmsData.trainees.filter(t => {
        if (!t || !t.nameKh) return false;
        const name = String(t.nameKh);
        if (name.includes('PK') && (name.includes('Content_Types') || name.includes('{PK') || /[\x00-\x08\x0E-\x1F\x7F]/.test(name))) return false;
        if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(name)) return false;
        if (t.id && (t.id.includes('{PK') || /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(t.id))) return false;
        return true;
      });
      if (stmsData.trainees.length !== countBefore) {
        saveData();
      }

      if (!Array.isArray(stmsData.users) || stmsData.users.length === 0) {
        stmsData.users = JSON.parse(JSON.stringify(window.KTPTTC_INITIAL_DATA?.users || []));
      } else {
        // Guarantee every user has username & password defined by Admin
        stmsData.users.forEach(u => {
          if (!u.password) {
            u.password = u.username === 'admin' ? 'admin123' : u.username === 'trainer' ? 'trainer123' : u.username === 'rachana' ? 'rachana123' : 'trainee123';
          }
          if (!u.status) u.status = 'active';
        });
      }
    } else {
      stmsData = JSON.parse(JSON.stringify(window.KTPTTC_INITIAL_DATA || {}));
      if (!Array.isArray(stmsData.trainees)) stmsData.trainees = [];
      saveData();
    }
  } catch (e) {
    console.error('Failed to load storage, using seed data:', e);
    stmsData = JSON.parse(JSON.stringify(window.KTPTTC_INITIAL_DATA || {}));
    if (!Array.isArray(stmsData.trainees)) stmsData.trainees = [];
  }
}

// Persist to LocalStorage
function saveData() {
  try {
    localStorage.setItem('ktpttc_stms_data_v2', JSON.stringify(stmsData));
    updateAlertBadge();
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

// Toast Notification
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'stms-toast';
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
  const color = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
  
  toast.innerHTML = `<i class="fas ${icon}" style="color:${color}; font-size:1.1rem;"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================================================
// AUTHENTICATION & LOGIN GATE CONTROLLER
// ==========================================================================
function initAuth() {
  let savedUser = null;
  try {
    const raw = sessionStorage.getItem('ktpttc_current_user') || localStorage.getItem('ktpttc_current_user');
    if (raw) savedUser = JSON.parse(raw);
  } catch (e) {}

  if (savedUser && savedUser.username) {
    const freshUser = (stmsData.users || []).find(u => u.username.toLowerCase() === savedUser.username.toLowerCase());
    if (freshUser && freshUser.status !== 'disabled') {
      loginSuccess(freshUser, false);
      return;
    }
  }

  showLoginScreen();
}

function showLoginScreen() {
  document.body.classList.remove('role-admin', 'role-trainer', 'role-trainee', 'role-staff', 'role-student');
  const loginOverlay = document.getElementById('stmsLoginScreen');
  const navbar = document.getElementById('stmsNavbar');
  const layout = document.getElementById('stmsAppLayout');
  const navCenterRole = document.getElementById('navCenterRole') || document.querySelector('.nav-center-role');

  if (loginOverlay) loginOverlay.style.display = 'flex';
  if (navbar) navbar.style.display = 'none';
  if (layout) layout.style.display = 'none';
  if (navCenterRole) navCenterRole.style.display = 'none';

  const uInput = document.getElementById('loginUsername');
  const pInput = document.getElementById('loginPassword');
  const errBox = document.getElementById('loginErrorMessage');
  if (uInput) uInput.value = '';
  if (pInput) pInput.value = '';
  if (errBox) errBox.style.display = 'none';
}

function handleLoginSubmit() {
  const uInput = document.getElementById('loginUsername');
  const pInput = document.getElementById('loginPassword');
  const errBox = document.getElementById('loginErrorMessage');
  const errText = document.getElementById('loginErrorText');

  const username = uInput ? uInput.value.trim().toLowerCase() : '';
  const password = pInput ? pInput.value : '';

  if (!username || !password) {
    if (errBox && errText) {
      errText.textContent = 'សូមបញ្ចូលឈ្មោះគណនី (Username) និងពាក្យសម្ងាត់ (Password)!';
      errBox.style.display = 'block';
    }
    return;
  }

  const user = (stmsData.users || []).find(u => 
    (u.username.toLowerCase() === username || (u.email && u.email.toLowerCase() === username)) &&
    String(u.password) === String(password)
  );

  if (!user) {
    if (errBox && errText) {
      errText.textContent = 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវឡើយ! សូមទាក់ទង Admin ដើម្បីកំណត់ពាក្យសម្ងាត់។';
      errBox.style.display = 'block';
    }
    return;
  }

  if (user.status === 'disabled') {
    if (errBox && errText) {
      errText.textContent = 'គណនីនេះត្រូវបានផ្អាកដំណើរការដោយ Admin សិក្សាធិការ!';
      errBox.style.display = 'block';
    }
    return;
  }

  if (errBox) errBox.style.display = 'none';
  loginSuccess(user, true);
}

function quickFillLogin(username, password) {
  const uInput = document.getElementById('loginUsername');
  const pInput = document.getElementById('loginPassword');
  if (uInput) uInput.value = username;
  if (pInput) pInput.value = password;
  handleLoginSubmit();
}

function loginSuccess(user, notify = true) {
  currentUser = user;
  currentRole = user.role;
  localStorage.setItem('ktpttc_current_user', JSON.stringify(user));
  sessionStorage.setItem('ktpttc_current_user', JSON.stringify(user));

  const loginOverlay = document.getElementById('stmsLoginScreen');
  const navbar = document.getElementById('stmsNavbar');
  const layout = document.getElementById('stmsAppLayout');

  if (loginOverlay) loginOverlay.style.display = 'none';
  if (navbar) navbar.style.display = 'flex';
  if (layout) layout.style.display = 'flex';

  // Update Navbar Profile Details
  const nameEl = document.getElementById('navbarUserName');
  const roleEl = document.getElementById('navbarUserRole');
  const avatarEl = document.getElementById('navbarUserAvatar');
  if (nameEl) nameEl.textContent = user.nameKh;
  if (roleEl) roleEl.textContent = user.roleLabel || user.role;
  if (avatarEl) avatarEl.textContent = user.avatar || (user.role === 'trainer' ? '👨‍🏫' : user.role === 'trainee' ? '👨‍🎓' : '👨‍💼');

  // Set body role class for styling rules
  document.body.classList.remove('role-admin', 'role-trainer', 'role-trainee', 'role-staff', 'role-student');
  document.body.classList.add(`role-${user.role}`);

  // Center Role Switcher: Visible ONLY to Administrator for role preview (Hidden for staff/trainers & students/trainees)
  const navCenterRole = document.getElementById('navCenterRole') || document.querySelector('.nav-center-role');
  if (navCenterRole) {
    const isAdmin = !!(user && user.role === 'admin');
    navCenterRole.style.display = isAdmin ? 'flex' : 'none';
    if (isAdmin) {
      document.querySelectorAll('.role-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.role === user.role);
      });
    }
  }

  // Set default starting view or check target navigation
  const targetView = sessionStorage.getItem('stms_target_view');
  if (targetView) {
    sessionStorage.removeItem('stms_target_view');
    currentView = targetView;
  } else if (user.role === 'trainee') {
    currentTraineeUser = (stmsData.trainees || []).find(t => t.id === user.studentId) || stmsData.trainees[0] || user;
    currentView = 'trainee-portal';
  } else {
    currentView = 'dashboard';
  }

  renderSidebar();
  renderView(currentView);
  updateAlertBadge();

  if (notify) {
    showToast(`សូមស្វាគមន៍លោក/លោកស្រី «${user.nameKh}» មកកាន់ប្រព័ន្ធ STMS!`, 'success');
  }
}

function handleLogout() {
  if (confirm('តើលោកអ្នកពិតជាចង់ចាកចេញពីប្រព័ន្ធ STMS មែនទេ?')) {
    localStorage.removeItem('ktpttc_current_user');
    sessionStorage.removeItem('ktpttc_current_user');
    currentUser = null;
    document.body.classList.remove('role-admin', 'role-trainer', 'role-trainee', 'role-staff', 'role-student');
    const navCenterRole = document.getElementById('navCenterRole') || document.querySelector('.nav-center-role');
    if (navCenterRole) navCenterRole.style.display = 'none';
    showLoginScreen();
    showToast('បានចាកចេញពីប្រព័ន្ធដោយជោគជ័យ!', 'info');
  }
}

function toggleLoginPassword() {
  const pInput = document.getElementById('loginPassword');
  const eyeIcon = document.getElementById('eyeIcon');
  const eyeText = document.getElementById('eyeText');
  if (!pInput) return;

  if (pInput.type === 'password') {
    pInput.type = 'text';
    if (eyeIcon) { eyeIcon.classList.remove('fa-eye'); eyeIcon.classList.add('fa-eye-slash'); }
    if (eyeText) eyeText.textContent = 'លាក់';
  } else {
    pInput.type = 'password';
    if (eyeIcon) { eyeIcon.classList.remove('fa-eye-slash'); eyeIcon.classList.add('fa-eye'); }
    if (eyeText) eyeText.textContent = 'បង្ហាញ';
  }
}

// Role Preview Switcher for Administrator
function switchRole(role, notify = true) {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('មានតែ Administrator ប៉ុណ្ណោះដែលអាចប្តូរទៅមើលសិទ្ធិផ្សេងៗបាន!', 'warning');
    return;
  }

  currentRole = role;

  // Update Top Role Switcher Pills
  document.querySelectorAll('.role-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.role === role);
  });

  // Assign Active User Profile preview based on Role
  const previewUser = stmsData.users.find(u => u.role === role) || currentUser;
  const nameEl = document.getElementById('navbarUserName');
  const roleEl = document.getElementById('navbarUserRole');
  const avatarEl = document.getElementById('navbarUserAvatar');

  if (nameEl) nameEl.textContent = previewUser.nameKh;
  if (roleEl) roleEl.textContent = `${previewUser.roleLabel} (Admin Preview)`;
  if (avatarEl) avatarEl.textContent = previewUser.avatar;

  // Set default view for role
  if (role === 'trainee') {
    currentTraineeUser = stmsData.trainees[0] || previewUser;
    currentView = 'trainee-portal';
  } else {
    currentView = 'dashboard';
  }

  renderSidebar();
  renderView(currentView);

  if (notify) {
    showToast(`កំពុងមើលក្នុងនាម៖ ${previewUser.roleLabel}`, 'info');
  }
}

// Render Sidebar Menu based on Active Role
function renderSidebar() {
  const sidebarNav = document.getElementById('sidebarNavMenu');
  if (!sidebarNav) return;

  let menuHtml = '';

  if (currentRole === 'admin') {
    menuHtml = `
      <li class="sidebar-label">ទំព័រដើម &amp; ស្ថិតិ</li>
      <li><a class="sidebar-item-link ${currentView==='dashboard'?'active':''}" onclick="navigateView('dashboard')"><i class="fas fa-th-large"></i> <span>ផ្ទាំងព័ត៌មាន (Dashboard)</span></a></li>

      <li class="sidebar-label">កិច្ចការគរុសនិស្សិត</li>
      <li><a class="sidebar-item-link ${currentView==='trainees'?'active':''}" onclick="navigateView('trainees')"><i class="fas fa-user-graduate"></i> <span>បញ្ជីរាយនាមសិស្ស</span></a></li>
      <li><a class="sidebar-item-link" href="add-student.html"><i class="fas fa-user-plus"></i> <span>ចុះឈ្មោះសិស្សថ្មី</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='requests'?'active':''}" onclick="navigateView('requests')"><i class="fas fa-clipboard-check"></i> <span>សំណើកែប្រែព័ត៌មាន</span></a></li>

      <li class="sidebar-label">កាលវិភាគ &amp; ថ្នាក់រៀន</li>
      <li><a class="sidebar-item-link ${currentView==='timetable'?'active':''}" onclick="navigateView('timetable')"><i class="fas fa-calendar-alt"></i> <span>កាលវិភាគបង្រៀន</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='cohorts'?'active':''}" onclick="navigateView('cohorts')"><i class="fas fa-school"></i> <span>ជំនាន់ &amp; ថ្នាក់សិក្សា</span></a></li>

      <li class="sidebar-label">វត្តមាន &amp; ការវាយតម្លៃ</li>
      <li><a class="sidebar-item-link ${currentView==='attendance'?'active':''}" onclick="navigateView('attendance')"><i class="fas fa-calendar-check"></i> <span>គ្រប់គ្រងវត្តមាន</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='grading'?'active':''}" onclick="navigateView('grading')"><i class="fas fa-calculator"></i> <span>ពិន្ទុ &amp; ការវាយតម្លៃ</span></a></li>

      <li class="sidebar-label">ប្រព័ន្ធរដ្ឋបាល</li>
      <li><a class="sidebar-item-link ${currentView==='backup'?'active':''}" onclick="navigateView('backup')"><i class="fas fa-database"></i> <span>បម្រុងទុក &amp; ស្តារទិន្នន័យ</span></a></li>
    `;
  } else if (currentRole === 'trainer') {
    menuHtml = `
      <li class="sidebar-label">ទំព័រដើម</li>
      <li><a class="sidebar-item-link ${currentView==='dashboard'?'active':''}" onclick="navigateView('dashboard')"><i class="fas fa-th-large"></i> <span>ផ្ទាំងព័ត៌មាន (Dashboard)</span></a></li>

      <li class="sidebar-label">ការបង្រៀន &amp; សិស្ស</li>
      <li><a class="sidebar-item-link ${currentView==='trainees'?'active':''}" onclick="navigateView('trainees')"><i class="fas fa-user-graduate"></i> <span>បញ្ជីរាយនាមសិស្ស</span></a></li>
      <li><a class="sidebar-item-link" href="add-student.html"><i class="fas fa-user-plus"></i> <span>ចុះឈ្មោះសិស្សថ្មី</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='attendance'?'active':''}" onclick="navigateView('attendance')"><i class="fas fa-calendar-check"></i> <span>ស្រង់វត្តមានសិស្ស</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='grading'?'active':''}" onclick="navigateView('grading')"><i class="fas fa-calculator"></i> <span>បញ្ចូលពិន្ទុតាមមុខវិជ្ជា</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='timetable'?'active':''}" onclick="navigateView('timetable')"><i class="fas fa-calendar-alt"></i> <span>កាលវិភាគបង្រៀន</span></a></li>
    `;
  } else if (currentRole === 'trainee') {
    menuHtml = `
      <li class="sidebar-label">ព័ត៌មានផ្ទាល់ខ្លួន</li>
      <li><a class="sidebar-item-link ${currentView==='trainee-portal'?'active':''}" onclick="navigateView('trainee-portal')"><i class="fas fa-id-card"></i> <span>ប្រវត្តិរូប &amp; កាតសម្គាល់</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='timetable'?'active':''}" onclick="navigateView('timetable')"><i class="fas fa-calendar-alt"></i> <span>កាលវិភាគសិក្សា</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='trainee-attendance'?'active':''}" onclick="navigateView('trainee-attendance')"><i class="fas fa-user-check"></i> <span>វត្តមានផ្ទាល់ខ្លួន</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='trainee-grades'?'active':''}" onclick="navigateView('trainee-grades')"><i class="fas fa-award"></i> <span>លទ្ធផលពិន្ទុ &amp; និទ្ទេស</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='trainee-request'?'active':''}" onclick="navigateView('trainee-request')"><i class="fas fa-paper-plane"></i> <span>ស្នើសុំកែប្រែព័ត៌មាន</span></a></li>
    `;
  }

  sidebarNav.innerHTML = menuHtml;
}

// Navigation View Controller
function navigateView(viewName) {
  currentView = viewName;
  renderSidebar();
  renderView(viewName);
}

// Update Alert Badge in Top Bar
function updateAlertBadge() {
  const badge = document.getElementById('topAlertBadge');
  if (!badge) return;

  const struggling = stmsData.trainees.filter(t => (t.attendanceSummary?.absent || 0) > 3);
  const pendingRequests = stmsData.profileRequests.filter(r => r.status === 'pending');
  const count = struggling.length + pendingRequests.length;

  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

// Main Render Router
function renderView(view) {
  const container = document.getElementById('mainContentArea');
  if (!container) return;

  switch (view) {
    case 'flow':
      renderSystemFlowView(container);
      break;
    case 'dashboard':
      renderDashboardView(container);
      break;
    case 'trainees':
      renderTraineesView(container);
      break;
    case 'attendance':
      renderAttendanceView(container);
      break;
    case 'grading':
      renderGradingView(container);
      break;
    case 'timetable':
      renderTimetableView(container);
      break;
    case 'cohorts':
      renderCohortsView(container);
      break;
    case 'requests':
      renderRequestsView(container);
      break;
    case 'rbac':
      renderRBACView(container);
      break;
    case 'backup':
      renderBackupView(container);
      break;
    case 'trainee-portal':
      renderTraineePortalView(container);
      break;
    case 'trainee-attendance':
      renderTraineeAttendanceView(container);
      break;
    case 'trainee-grades':
      renderTraineeGradesView(container);
      break;
    case 'trainee-request':
      renderTraineeRequestView(container);
      break;
    default:
      renderDashboardView(container);
  }
}

// ==========================================================================
// 1. DASHBOARD & ANALYTICS VIEW (ម៉ូឌុលផ្ទាំងគ្រប់គ្រងសង្ខេប បែបស្អាត និងមានសណ្ដាប់ធ្នាប់)
// ==========================================================================
function renderDashboardView(container) {
  const total = stmsData.trainees.length;
  const female = stmsData.trainees.filter(t => t.gender === 'ស្រី').length;
  const male = total - female;
  const femalePct = total > 0 ? ((female / total) * 100).toFixed(1) : 0;
  
  // Calculate Avg Attendance
  const avgAttendance = total > 0 
    ? (stmsData.trainees.reduce((acc, t) => acc + (t.attendanceSummary?.rate || 100), 0) / total).toFixed(1)
    : 100;

  // Trainees with > 3 absences (Disciplinary alert)
  const alertTrainees = stmsData.trainees.filter(t => (t.attendanceSummary?.absent || 0) > 3);

  let html = `
    <!-- Top Welcome Card -->
    <div class="clean-dashboard-welcome">
      <div class="clean-welcome-title">
        <h2>សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ (KTPTTC)</h2>
        <p>ប្រព័ន្ធគ្រប់គ្រងគរុសនិស្សិត និងព័ត៌មានវិទ្យា (STMS) &bull; ឆ្នាំសិក្សា ២០២៦ - ២០២៧</p>
      </div>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <a href="add-student.html" class="btn btn-primary" style="height:38px; display:inline-flex; align-items:center; gap:6px;">
          <i class="fas fa-user-plus"></i> ចុះឈ្មោះសិស្សថ្មី
        </a>
        <button class="btn btn-outline" style="height:38px; display:inline-flex; align-items:center; gap:6px;" onclick="navigateView('trainees')">
          <i class="fas fa-list-ol"></i> បញ្ជីរាយនាមសិស្ស
        </button>
      </div>
    </div>

    <!-- Quick Action Shortcuts (៥ មុខងារចម្បង ស្អាត និងមានសណ្ដាប់ធ្នាប់) -->
    <div class="clean-quick-actions-grid">
      <div class="clean-quick-action-btn" onclick="navigateView('trainees')">
        <div class="clean-action-icon" style="background:#eff6ff; color:#2563eb;">
          <i class="fas fa-user-graduate"></i>
        </div>
        <div class="clean-action-text">
          <strong>បញ្ជីរាយនាមសិស្ស</strong>
          <span>មើលបញ្ជី និងបោះពុម្ព</span>
        </div>
      </div>

      <a class="clean-quick-action-btn" href="add-student.html">
        <div class="clean-action-icon" style="background:#ecfdf5; color:#10b981;">
          <i class="fas fa-user-plus"></i>
        </div>
        <div class="clean-action-text">
          <strong>ចុះឈ្មោះសិស្សថ្មី</strong>
          <span>បញ្ចូលទិន្នន័យគរុសនិស្សិត</span>
        </div>
      </a>

      <div class="clean-quick-action-btn" onclick="navigateView('attendance')">
        <div class="clean-action-icon" style="background:#f0fdfa; color:#0d9488;">
          <i class="fas fa-calendar-check"></i>
        </div>
        <div class="clean-action-text">
          <strong>គ្រប់គ្រងវត្តមាន</strong>
          <span>ស្រង់វត្តមានប្រចាំថ្ងៃ</span>
        </div>
      </div>

      <div class="clean-quick-action-btn" onclick="navigateView('timetable')">
        <div class="clean-action-icon" style="background:#eef2ff; color:#4f46e5;">
          <i class="fas fa-calendar-alt"></i>
        </div>
        <div class="clean-action-text">
          <strong>កាលវិភាគបង្រៀន</strong>
          <span>កម្មវិធីសិក្សា និងម៉ោង</span>
        </div>
      </div>

      <div class="clean-quick-action-btn" onclick="navigateView('grading')">
        <div class="clean-action-icon" style="background:#fffbeb; color:#d97706;">
          <i class="fas fa-calculator"></i>
        </div>
        <div class="clean-action-text">
          <strong>ពិន្ទុ &amp; ការវាយតម្លៃ</strong>
          <span>លទ្ធផលប្រចាំខែ និងឆមាស</span>
        </div>
      </div>
    </div>

    <!-- Disciplinary Alert Banner if any Trainee > 3 unexcused absences -->
    ${alertTrainees.length > 0 ? `
      <div class="disciplinary-alert-box" style="margin-bottom:20px;">
        <div class="alert-left-content">
          <div class="alert-icon-wrap"><i class="fas fa-exclamation-triangle"></i></div>
          <div>
            <h4 style="color:#b91c1c; font-size:0.95rem; font-weight:700;">
              ការជូនដំណឹងវិន័យ៖ មានគរុសនិស្សិតចំនួន ${alertTrainees.length} នាក់ អវត្តមានគ្មានច្បាប់លើសកំណត់ (>៣ ដង)
            </h4>
            <p style="color:#991b1b; font-size:0.82rem;">
              គរុសនិស្សិតខាងក្រោមប្រឈមនឹងការដកសិទ្ធិប្រឡងបញ្ចប់ ឬត្រូវកោះហៅអាណាព្យាបាលមកដោះស្រាយជាមួយផ្នែកវិន័យ។
            </p>
          </div>
        </div>
        <button class="btn btn-danger" onclick="notifyDisciplinaryDept()"><i class="fas fa-bell"></i> ផ្ញើលិខិតជូនដំណឹងវិន័យ</button>
      </div>
    ` : ''}

    <!-- KPI Metric Cards (ស្ថិតិសំខាន់ៗ) -->
    <div class="kpi-grid" style="margin-bottom:22px;">
      <div class="kpi-card">
        <div class="kpi-left">
          <span>គរុសនិស្សិតសរុប</span>
          <h3>${total} នាក់</h3>
          <p>ស្រី: ${female} (${femalePct}%) &bull; ប្រុស: ${male}</p>
        </div>
        <div class="kpi-icon-circle" style="background:#eff6ff; color:#2563eb;">
          <i class="fas fa-user-graduate"></i>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-left">
          <span>អត្រាវត្តមានមធ្យម</span>
          <h3 style="color:#10b981;">${avgAttendance}%</h3>
          <p style="color:#059669;">ស្ថានភាពវត្តមានល្អប្រសើរ</p>
        </div>
        <div class="kpi-icon-circle" style="background:#ecfdf5; color:#10b981;">
          <i class="fas fa-calendar-check"></i>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-left">
          <span>ជំនាន់ &amp; ថ្នាក់បណ្តុះបណ្តាល</span>
          <h3>${stmsData.cohorts.length} ជំនាន់</h3>
          <p>១២+២, ១២+៤, បរិញ្ញាបត្រ+១</p>
        </div>
        <div class="kpi-icon-circle" style="background:#fef3c7; color:#d97706;">
          <i class="fas fa-school"></i>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-left">
          <span>គ្រូឧទ្ទេស &amp; មុខវិជ្ជា</span>
          <h3>${stmsData.subjects.length} មុខវិជ្ជា</h3>
          <p>បង្រៀនដោយគ្រូឧទ្ទេសជំនាញ</p>
        </div>
        <div class="kpi-icon-circle" style="background:#f3e8ff; color:#9333ea;">
          <i class="fas fa-chalkboard-teacher"></i>
        </div>
      </div>
    </div>

    <!-- 2 Columns: Left (Recent Students) & Right (Today's Timetable + System Status) -->
    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:20px; margin-bottom:24px;">
      
      <!-- Left: Recent Trainees Table -->
      <div class="table-card">
        <div class="table-toolbar" style="border-bottom:1px solid #e2e8f0; padding-bottom:12px; margin-bottom:12px;">
          <strong style="color:#1e3a8a; font-size:0.95rem; display:flex; align-items:center; gap:8px;">
            <i class="fas fa-users" style="color:#2563eb;"></i> បញ្ជីគរុសនិស្សិតចុងក្រោយ
          </strong>
          <a onclick="navigateView('trainees')" style="color:#2563eb; font-size:0.84rem; font-weight:600; cursor:pointer;">
            មើលបញ្ជីពេញលេញ (១២ ជួរឈរ) &rarr;
          </a>
        </div>
        <div class="data-table-responsive">
          <table class="roster-table" style="font-size:0.82rem;">
            <thead>
              <tr>
                <th style="width:45px; text-align:center;">ល.រ</th>
                <th style="width:130px; text-align:center;">អ.ល</th>
                <th>គោត្តនាម និងនាម</th>
                <th style="width:60px; text-align:center;">ភេទ</th>
                <th>ថ្នាក់រៀន</th>
                <th style="width:90px; text-align:center;">វត្តមាន</th>
                <th style="width:70px; text-align:center;">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              ${stmsData.trainees.length === 0 ? `
                <tr>
                  <td colspan="7" style="text-align:center; padding:40px 15px; color:#64748b;">
                    <i class="fas fa-inbox fa-2x" style="color:#cbd5e1; margin-bottom:8px; display:block;"></i>
                    <div style="font-weight:700; color:#1e3a8a; font-size:0.95rem;">មិនទាន់មានទិន្នន័យគរុសនិស្សិតទេ</div>
                    <p style="font-size:0.8rem; color:#94a3b8; margin:4px 0 12px 0;">ប្រព័ន្ធរង់ចាំការបញ្ចូលព័ត៌មានពីគ្រូបង្រៀន ឬរដ្ឋបាល</p>
                    <a class="btn btn-primary" style="padding:6px 14px; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px;" href="add-student.html">
                      <i class="fas fa-plus"></i> ចុះឈ្មោះសិស្សដំបូង
                    </a>
                  </td>
                </tr>
              ` : stmsData.trainees.slice(0, 6).map((t, idx) => `
                <tr>
                  <td style="text-align:center; font-weight:600;">${idx + 1}</td>
                  <td><span class="roster-id-tag">${t.id}</span></td>
                  <td>
                    <div class="roster-student-cell">
                      <div class="roster-student-avatar">
                        ${t.photo ? `<img src="${t.photo}" alt="${t.nameKh}" onerror="this.outerHTML='👨‍🎓'">` : (t.gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓')}
                      </div>
                      <span class="roster-student-name">${t.nameKh}</span>
                    </div>
                  </td>
                  <td style="text-align:center;">${t.gender || 'ប្រុស'}</td>
                  <td>${t.className || 'ថ្នាក់ ១២+២'}</td>
                  <td style="text-align:center;"><strong style="color:${(t.attendanceSummary?.rate||100)>=90?'#10b981':'#f59e0b'};">${t.attendanceSummary?.rate||100}%</strong></td>
                  <td style="text-align:center;">
                    <button class="roster-action-btn btn-edit-roster" onclick="openEditStudent('${t.id}')" title="កែប្រែព័ត៌មាន"><i class="fas fa-edit"></i></button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right: Today's Schedule & System Status -->
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- Today's Schedule Card -->
        <div style="background:#ffffff; border-radius:10px; border:1px solid var(--border-color); padding:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="color:#1e3a8a; font-size:0.9rem; margin:0;"><i class="fas fa-calendar-day" style="color:#4f46e5;"></i> កាលវិភាគបង្រៀនថ្ងៃនេះ</h4>
            <a onclick="navigateView('timetable')" style="color:#2563eb; font-size:0.75rem; font-weight:700; text-decoration:none; cursor:pointer;">មើលកាលវិភាគ &rarr;</a>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-left:3px solid #2563eb; border-radius:6px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:#0f172a; font-size:0.83rem;">គរុកោសល្យទូទៅ</strong>
                <div style="font-size:0.74rem; color:#64748b;">បន្ទប់ ១០១ &bull; គ្រូឧទ្ទេសជំនាញ</div>
              </div>
              <span style="font-size:0.75rem; font-weight:700; color:#2563eb; background:#eff6ff; padding:2px 8px; border-radius:4px;">07:30 - 09:00</span>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-left:3px solid #10b981; border-radius:6px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:#0f172a; font-size:0.83rem;">គណិតវិទ្យា</strong>
                <div style="font-size:0.74rem; color:#64748b;">បន្ទប់ ១០១ &bull; គ្រូឧទ្ទេសជំនាញ</div>
              </div>
              <span style="font-size:0.75rem; font-weight:700; color:#10b981; background:#ecfdf5; padding:2px 8px; border-radius:4px;">09:15 - 10:45</span>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-left:3px solid #f59e0b; border-radius:6px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:#0f172a; font-size:0.83rem;">ភាសាខ្មែរ</strong>
                <div style="font-size:0.74rem; color:#64748b;">បន្ទប់ ១០១ &bull; គ្រូឧទ្ទេសជំនាញ</div>
              </div>
              <span style="font-size:0.75rem; font-weight:700; color:#d97706; background:#fffbeb; padding:2px 8px; border-radius:4px;">13:30 - 15:00</span>
            </div>
          </div>
        </div>

        <!-- Requests & System Health -->
        <div style="background:#ffffff; border-radius:10px; border:1px solid var(--border-color); padding:18px;">
          <h4 style="color:#1e3a8a; font-size:0.9rem; margin-bottom:8px;"><i class="fas fa-clipboard-check" style="color:#059669;"></i> សំណើសុំកែព័ត៌មានសិស្ស</h4>
          <p style="font-size:0.82rem; color:#64748b; margin-bottom:12px;">
            មានសំណើចំនួន <strong>${stmsData.profileRequests.filter(r=>r.status==='pending').length}</strong> កំពុងរង់ចាំការពិនិត្យ និងអនុម័តពីរដ្ឋបាល។
          </p>
          <button class="btn btn-outline" style="width:100%; justify-content:center; font-size:0.82rem;" onclick="navigateView('requests')">
            <i class="fas fa-check-circle"></i> ពិនិត្យសំណើកែព័ត៌មាន
          </button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// Disciplinary warning notifier
function notifyDisciplinaryDept() {
  showToast('បានបញ្ជូនលិខិតជូនដំណឹងទៅកាន់ផ្នែកវិន័យ និងសិក្សាធិការរួចរាល់!', 'success');
}

// ==========================================================================
// 2. TRAINEE PROFILES MANAGEMENT VIEW (បញ្ជីរាយនាមសិស្សានុសិស្ស តាមគំរូក្រសួងអប់រំ)
// ==========================================================================
let currentRosterClassFilter = 'all';
let currentRosterSort = 'default';

function formatDobDisplay(dob) {
  if (!dob) return '-';
  if (dob.includes('-')) {
    const parts = dob.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
  }
  return dob;
}

function calculateAgeFromDob(dob) {
  if (!dob) return '-';
  let d, m, y;
  if (dob.includes('-')) {
    const parts = dob.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10) - 1;
        d = parseInt(parts[2], 10);
      } else {
        d = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10) - 1;
        y = parseInt(parts[2], 10);
      }
    }
  } else if (dob.includes('/')) {
    const parts = dob.split('/');
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        d = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10) - 1;
        y = parseInt(parts[2], 10);
      } else if (parts[0].length === 4) {
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10) - 1;
        d = parseInt(parts[2], 10);
      }
    }
  }
  if (y && !isNaN(y)) {
    const now = new Date();
    const currentYear = Math.max(now.getFullYear(), 2026);
    let age = currentYear - y;
    if (m !== undefined && !isNaN(m)) {
      if (now.getMonth() < m || (now.getMonth() === m && now.getDate() < (d || 1))) {
        age--;
      }
    }
    return age > 0 ? age : '-';
  }
  return '-';
}

function formatBirthplaceDisplay(t) {
  if (t.birthplace && typeof t.birthplace === 'object') {
    const parts = [t.birthplace.village, t.birthplace.commune, t.birthplace.district, t.birthplace.province]
      .map(s => (s || '').trim())
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }
  if (t.pob && typeof t.pob === 'string' && t.pob.trim()) {
    return t.pob.trim();
  }
  return '-';
}

function formatParentDisplay(name, job) {
  name = (name || '').trim();
  job = (job || '').trim();
  if (name && job) return `${name} (${job})`;
  if (name) return name;
  if (job) return `(${job})`;
  return '-';
}

function handleRosterClassChange(val) {
  currentRosterClassFilter = val;
  renderView('trainees');
}

function setRosterSort(type) {
  currentRosterSort = type;
  renderView('trainees');
}

function saveCurrentRosterOrder() {
  if (!stmsData.trainees || stmsData.trainees.length === 0) {
    showToast('ពុំមានទិន្នន័យគរុសនិស្សិតសម្រាប់រក្សាទុកលំដាប់ឡើយ', 'warning');
    return;
  }
  let list = [...stmsData.trainees];
  if (currentRosterSort === 'id-asc') {
    list.sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));
  } else if (currentRosterSort === 'id-desc') {
    list.sort((a, b) => (b.id || '').localeCompare(a.id || '', undefined, { numeric: true }));
  } else if (currentRosterSort === 'name-asc') {
    list.sort((a, b) => (a.nameKh || '').localeCompare(b.nameKh || '', 'km'));
  } else if (currentRosterSort === 'name-desc') {
    list.sort((a, b) => (b.nameKh || '').localeCompare(a.nameKh || '', 'km'));
  }
  list.forEach((s, idx) => {
    s.roll = idx + 1;
  });
  stmsData.trainees = list;
  saveData();
  currentRosterSort = 'default';
  showToast('បានរក្សាទុកលំដាប់សិស្សថ្មីជោគជ័យ!', 'success');
  renderView('trainees');
}

function confirmDeleteAllStudents() {
  if (!stmsData.trainees || stmsData.trainees.length === 0) {
    showToast('ពុំមានទិន្នន័យគរុសនិស្សិតសម្រាប់លុបឡើយ', 'info');
    return;
  }
  if (!confirm('តើអ្នកពិតជាចង់លុបទិន្នន័យគរុសនិស្សិតទាំងអស់មែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានឡើយ!')) {
    return;
  }
  stmsData.trainees = [];
  saveData();
  showToast('បានលុបទិន្នន័យគរុសនិស្សិតទាំងអស់រួចរាល់', 'info');
  renderView('trainees');
}

function exportOrPrintRoster() {
  const modalHtml = `
    <div class="stms-modal-backdrop" id="printExportModal" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-window" style="max-width:440px; width:92%; text-align:center; padding:24px 20px;">
        <div style="font-size:1.15rem; font-weight:700; color:#1e3a8a; margin-bottom:12px;">
          <i class="fas fa-print" style="color:#2563eb;"></i> ទម្រង់បោះពុម្ព និង ទាញយក
        </div>
        <p style="font-size:0.88rem; color:#64748b; margin-bottom:20px;">
          សូមជ្រើសរើសជម្រើសដែលអ្នកចង់ដំណើរការ៖
        </p>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button class="btn btn-primary" onclick="closeStmsModal(); setTimeout(() => window.print(), 200);" style="height:42px; font-size:0.9rem; justify-content:center;">
            <i class="fas fa-print"></i> បោះពុម្ពជាក្រដាស / PDF (Print Roster)
          </button>
          <button class="btn btn-success" onclick="closeStmsModal(); exportTraineeRosterExcel();" style="height:42px; font-size:0.9rem; justify-content:center;">
            <i class="fas fa-file-excel"></i> ទាញយកជា Excel / CSV Spreadsheet
          </button>
          <button class="btn btn-outline" onclick="closeStmsModal()" style="height:38px; font-size:0.85rem; justify-content:center;">
            បោះបង់
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function renderTraineesView(container) {
  const allTrainees = Array.isArray(stmsData.trainees) ? stmsData.trainees : [];
  
  // Extract distinct classes for dropdown
  const distinctClasses = Array.from(new Set([
    ...allTrainees.map(t => t.className).filter(Boolean)
  ]));

  // Filter by Class
  let filtered = allTrainees;
  if (currentRosterClassFilter && currentRosterClassFilter !== 'all') {
    filtered = allTrainees.filter(t => t.className === currentRosterClassFilter || t.cohort === currentRosterClassFilter);
  }

  // Sort
  let displayed = [...filtered];
  if (currentRosterSort === 'id-asc') {
    displayed.sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));
  } else if (currentRosterSort === 'id-desc') {
    displayed.sort((b, a) => (b.id || '').localeCompare(a.id || '', undefined, { numeric: true }));
  } else if (currentRosterSort === 'name-asc') {
    displayed.sort((a, b) => (a.nameKh || '').localeCompare(b.nameKh || '', 'km'));
  } else if (currentRosterSort === 'name-desc') {
    displayed.sort((b, a) => (b.nameKh || '').localeCompare(a.nameKh || '', 'km'));
  }

  const totalCount = displayed.length;
  const femaleCount = displayed.filter(t => t.gender === 'ស្រី').length;

  const html = `
    <div class="roster-card">
      <!-- Header Row -->
      <div class="roster-header-row">
        <div class="roster-header-left">
          <h2 class="roster-title">បញ្ជីរាយនាមសិស្សានុសិស្ស</h2>
          <div class="roster-class-stat-wrap">
            <select class="roster-class-select" onchange="handleRosterClassChange(this.value)">
              <option value="all" ${currentRosterClassFilter === 'all' ? 'selected' : ''}>ថ្នាក់ដើម</option>
              ${distinctClasses.map(cls => `<option value="${cls}" ${currentRosterClassFilter === cls ? 'selected' : ''}>${cls}</option>`).join('')}
            </select>
            <div class="roster-stats-text">
              <span>សិស្សសរុប: <strong>${totalCount} នាក់</strong></span>
              <span class="roster-female-count">(ស្រី ${femaleCount} នាក់)</span>
            </div>
          </div>
        </div>
        <div class="roster-header-right">
          <button class="roster-btn-print" onclick="exportOrPrintRoster()">
            <i class="fas fa-print"></i> ទម្រង់បោះពុម្ព និង ទាញយក
          </button>
          <button class="roster-btn-delete-all" onclick="confirmDeleteAllStudents()">
            <i class="fas fa-trash"></i> លុបទាំងអស់
          </button>
        </div>
      </div>

      <!-- Sorting Toolbar Row -->
      <div class="roster-toolbar-row">
        <div class="roster-toolbar-left">
          <span class="roster-toolbar-label"><i class="fas fa-bars"></i> តម្រៀប៖</span>
          <div class="roster-sort-group">
            <button class="roster-sort-btn ${currentRosterSort === 'default' ? 'active' : ''}" onclick="setRosterSort('default')">លំដាប់ដើម</button>
            <button class="roster-sort-btn ${currentRosterSort === 'id-asc' ? 'active' : ''}" onclick="setRosterSort('id-asc')">អ.ល &uarr;</button>
            <button class="roster-sort-btn ${currentRosterSort === 'id-desc' ? 'active' : ''}" onclick="setRosterSort('id-desc')">អ.ល &darr;</button>
            <button class="roster-sort-btn ${currentRosterSort === 'name-asc' ? 'active' : ''}" onclick="setRosterSort('name-asc')">ឈ្មោះ: ក &rarr; អ</button>
            <button class="roster-sort-btn ${currentRosterSort === 'name-desc' ? 'active' : ''}" onclick="setRosterSort('name-desc')">ឈ្មោះ: អ &rarr; ក</button>
          </div>
        </div>
        <div class="roster-toolbar-right">
          <button class="roster-btn-save-order" onclick="saveCurrentRosterOrder()">
            <i class="fas fa-save"></i> រក្សាទុកលំដាប់នេះ
          </button>
        </div>
      </div>

      <!-- Table Section -->
      <div class="roster-table-responsive">
        <table class="roster-table" id="traineesDataTable">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">ល.រ</th>
              <th style="width: 140px; text-align: center;">អ.ល</th>
              <th style="min-width: 170px;">គោត្តនាម និងនាម</th>
              <th style="width: 60px; text-align: center;">ភេទ</th>
              <th style="width: 115px; text-align: center;">ថ្ងៃខែឆ្នាំកំណើត</th>
              <th style="width: 60px; text-align: center;">អាយុ</th>
              <th style="min-width: 160px;">ទីកន្លែងកំណើត</th>
              <th style="min-width: 160px;">ឈ្មោះឪពុក និង មុខរបរ</th>
              <th style="min-width: 160px;">ឈ្មោះម្តាយ និង មុខរបរ</th>
              <th style="min-width: 140px; text-align: center;">អាណាព្យាបាល និងមុខរបរ</th>
              <th style="width: 130px; text-align: center;">លេខទូរស័ព្ទអាណាព្យាបាល</th>
              <th style="width: 90px; text-align: center;">សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            ${displayed.length === 0 ? `
              <tr>
                <td colspan="12" style="text-align:center; padding:55px 20px; color:#64748b;">
                  <i class="fas fa-user-graduate fa-3x" style="color:#cbd5e1; margin-bottom:14px; display:block;"></i>
                  <div style="font-size:1.1rem; font-weight:700; color:#1e3a8a; margin-bottom:8px;">មិនទាន់មានទិន្នន័យគរុសនិស្សិតនៅឡើយទេ</div>
                  <p style="font-size:0.875rem; color:#94a3b8; max-width:520px; margin:0 auto 18px auto; line-height:1.6;">
                    សូមចុចប៊ូតុងខាងក្រោមដើម្បីបង្កើតគណនី ឬចុះឈ្មោះគរុសនិស្សិតថ្មី
                  </p>
                  <button class="btn btn-primary" onclick="openEnrollModal()"><i class="fas fa-user-plus"></i> ចុះឈ្មោះគរុសនិស្សិត</button>
                </td>
              </tr>
            ` : displayed.map((t, idx) => {
              const fatherStr = formatParentDisplay(t.parents?.fatherName, t.parents?.fatherJob);
              const motherStr = formatParentDisplay(t.parents?.motherName, t.parents?.motherJob);
              const guardianStr = formatParentDisplay(t.parents?.guardianName, t.parents?.guardianJob);
              const parentPhone = (t.parentPhone || t.phone || t.parents?.phone || '-').trim() || '-';
              const ageVal = t.age || calculateAgeFromDob(t.dob);

              return `
                <tr data-trainee-row="${t.id}">
                  <td style="text-align: center; font-weight: 600;">${idx + 1}</td>
                  <td><span class="roster-id-tag">${t.id}</span></td>
                  <td>
                    <div class="roster-student-cell">
                      <div class="roster-student-avatar">
                        ${t.photo ? `<img src="${t.photo}" alt="${t.nameKh}" onerror="this.outerHTML='👨‍🎓'">` : (t.gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓')}
                      </div>
                      <span class="roster-student-name">${t.nameKh}</span>
                    </div>
                  </td>
                  <td style="text-align: center;">${t.gender || 'ប្រុស'}</td>
                  <td style="text-align: center;">${formatDobDisplay(t.dob)}</td>
                  <td><span class="roster-age-highlight">${ageVal}</span></td>
                  <td>${formatBirthplaceDisplay(t)}</td>
                  <td>${fatherStr}</td>
                  <td>${motherStr}</td>
                  <td style="text-align: ${guardianStr === '-' ? 'center' : 'left'};">${guardianStr}</td>
                  <td style="text-align: center;">${parentPhone}</td>
                  <td>
                    <div class="roster-action-group">
                      <button class="roster-action-btn btn-edit-roster" onclick="openEditStudent('${t.id}')" title="កែប្រែព័ត៌មាន"><i class="fas fa-edit"></i></button>
                      <button class="roster-action-btn btn-delete-roster" onclick="deleteTraineeRecord('${t.id}')" title="លុបទិន្នន័យ"><i class="fas fa-trash"></i></button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// Filter Trainee Table
function filterTraineeTable(query) {
  const q = (query || '').toLowerCase().trim();
  const rows = document.querySelectorAll('#traineesDataTable tbody tr');
  rows.forEach(r => {
    const text = r.textContent.toLowerCase();
    r.style.display = text.includes(q) ? '' : 'none';
  });
}

function filterTraineeByCohort(cohort) {
  const rows = document.querySelectorAll('#traineesDataTable tbody tr');
  rows.forEach(r => {
    if (cohort === 'all' || r.dataset.cohort === cohort) {
      r.style.display = '';
    } else {
      r.style.display = 'none';
    }
  });
}

// Enrollment Modal Controller - Navigates to full standard Add Student Form
function openEnrollModal() {
  window.location.href = 'add-student.html';
}

// Open Edit Student Page
function openEditStudent(id) {
  closeStmsModal();
  window.location.href = `add-student.html?id=${encodeURIComponent(id)}`;
}

// Open Edit Student Selector Modal
function openEditStudentModal() {
  if (!stmsData.trainees || stmsData.trainees.length === 0) {
    showToast('ពុំទាន់មានទិន្នន័យគរុសនិស្សិតដើម្បីកែប្រែនៅឡើយទេ! សូមចុះឈ្មោះគរុសនិស្សិតជាមុន។', 'warning');
    return;
  }

  const modalHtml = `
    <div class="stms-modal-backdrop" id="editStudentModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-window" style="max-width:680px; width:95%;">
        <div class="modal-header-bar" style="border-bottom:1px solid #e2e8f0; padding:16px 20px;">
          <div class="modal-header-title" style="font-size:1.05rem; font-weight:700; color:#1e3a8a; display:flex; align-items:center; gap:8px;">
            <i class="fas fa-edit" style="color:#2563eb;"></i> ជ្រើសរើសគរុសនិស្សិតដើម្បីកែប្រែព័ត៌មាន
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()">&times;</button>
        </div>
        <div class="modal-body-scroll" style="padding:18px 20px;">
          <div style="position:relative; margin-bottom:14px;">
            <i class="fas fa-search" style="position:absolute; left:12px; top:13px; color:#94a3b8;"></i>
            <input type="text" id="editStudentSearchInput" class="form-control" placeholder="ស្វែងរកតាមឈ្មោះ, អត្តលេខ, ថ្នាក់រៀន..." oninput="filterEditStudentList(this.value)" style="padding-left:36px; height:42px; border-radius:8px;">
          </div>
          <div id="editStudentListContainer" style="display:flex; flex-direction:column; gap:10px; max-height:380px; overflow-y:auto; padding-right:4px;">
            ${renderEditStudentItems(stmsData.trainees)}
          </div>
        </div>
        <div class="modal-footer-bar" style="background:#f8fafc; border-top:1px solid #e2e8f0; padding:12px 20px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.82rem; color:#64748b;">សរុប៖ <strong>${stmsData.trainees.length} នាក់</strong></span>
          <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  setTimeout(() => document.getElementById('editStudentSearchInput')?.focus(), 150);
}

function renderEditStudentItems(list) {
  if (!list || list.length === 0) {
    return `<div style="text-align:center; padding:30px 10px; color:#94a3b8;"><i class="fas fa-search fa-2x" style="margin-bottom:8px; display:block; color:#cbd5e1;"></i>រកមិនឃើញគរុសនិស្សិតដែលត្រូវនឹងពាក្យស្វែងរកឡើយ</div>`;
  }
  return list.map(t => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; transition:all 0.2s;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width:42px; height:42px; border-radius:50%; background:#e2e8f0; overflow:hidden; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0; border:1px solid #cbd5e1;">
          ${t.photo ? `<img src="${t.photo}" style="width:100%; height:100%; object-fit:cover;" onerror="this.outerHTML='${t.avatar || '👨‍🎓'}'">` : (t.avatar || '👨‍🎓')}
        </div>
        <div>
          <div style="font-weight:700; color:#0f172a; font-size:0.92rem;">
            ${t.nameKh} ${t.nameEn ? `<span style="font-size:0.8rem; font-weight:400; color:#64748b;">(${t.nameEn})</span>` : ''}
          </div>
          <div style="font-size:0.78rem; color:#64748b; margin-top:2px; display:flex; gap:10px;">
            <span><i class="fas fa-id-badge"></i> <code style="color:#2563eb; font-weight:600;">${t.id}</code></span>
            <span><i class="fas fa-chalkboard-teacher"></i> ${t.className || 'ថ្នាក់ ១២+២'}</span>
            <span><i class="fas fa-venus-mars"></i> ${t.gender || 'ប្រុស'}</span>
          </div>
        </div>
      </div>
      <button class="btn btn-primary" onclick="openEditStudent('${t.id}')" style="height:34px; padding:0 14px; font-size:0.82rem; gap:6px; display:inline-flex; align-items:center;">
        <i class="fas fa-edit"></i> កែប្រែព័ត៌មាន
      </button>
    </div>
  `).join('');
}

function filterEditStudentList(query) {
  const q = (query || '').toLowerCase().trim();
  const filtered = stmsData.trainees.filter(t => {
    return (t.nameKh && t.nameKh.toLowerCase().includes(q)) ||
           (t.nameEn && t.nameEn.toLowerCase().includes(q)) ||
           (t.id && t.id.toLowerCase().includes(q)) ||
           (t.className && t.className.toLowerCase().includes(q));
  });
  const container = document.getElementById('editStudentListContainer');
  if (container) container.innerHTML = renderEditStudentItems(filtered);
}

function updateGeneratedId() {
  const type = document.getElementById('enrollType')?.value || '';
  const idEl = document.getElementById('enrollId');
  const code = type.includes('មត្តេយ្យ') ? 'PRE' : type.includes('វិក្រឹត') ? 'VIK' : '12P2';
  const nextIdx = stmsData.trainees.length + 1;
  if (idEl) {
    idEl.value = `KTPTTC-2026-${code}-${String(nextIdx).padStart(3, '0')}`;
    const uEl = document.getElementById('enrollUsername');
    if (uEl) uEl.value = idEl.value;
  }
}

function submitEnrollForm() {
  const id = document.getElementById('enrollId').value;
  const nameKh = document.getElementById('enrollNameKh').value.trim();
  const nameEn = document.getElementById('enrollNameEn').value.trim();
  const gender = document.getElementById('enrollGender').value;
  const dob = document.getElementById('enrollDob').value;
  const phone = document.getElementById('enrollPhone').value.trim();
  const className = document.getElementById('enrollClass').value;
  const trainingType = document.getElementById('enrollType').value;
  const pob = document.getElementById('enrollPob').value.trim();
  const address = document.getElementById('enrollAddress').value.trim();

  const newTrainee = {
    id,
    roll: stmsData.trainees.length + 1,
    nameKh,
    nameEn,
    gender,
    dob,
    phone,
    className,
    cohort: trainingType.includes('បឋម') ? "ថ្នាក់បឋមសិក្សា ១២+២ ជំនាន់ទី ៣៤" : trainingType.includes('មត្តេយ្យ') ? "ថ្នាក់មត្តេយ្យសិក្សា ១២+២ ជំនាន់ទី ៣៤" : "ថ្នាក់វិក្រឹតការគ្រូបង្រៀន និងនាយកសាលា",
    trainingType,
    status: "កំពុងសិក្សា",
    avatar: gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓',
    pob,
    address,
    bacii: {
      examYear: document.getElementById('enrollBacYear').value,
      rollNumber: document.getElementById('enrollBacRoll').value,
      grade: document.getElementById('enrollBacGrade').value
    },
    documents: [
      { name: "សញ្ញាបត្របាក់ឌុប (BacII)", status: "verified" },
      { name: "អត្តសញ្ញាណប័ណ្ណសញ្ជាតិខ្មែរ", status: "verified" },
      { name: "រូបថត 4x6 ឯកសណ្ឋាន", status: "verified" }
    ],
    attendanceSummary: {
      present: 0,
      permission: 0,
      late: 0,
      absent: 0,
      rate: 100.0
    },
    scores: {}
  };

  stmsData.trainees.push(newTrainee);

  // Auto-Provision Trainee User Account if checked
  const createAccount = document.getElementById('enrollCreateAccount')?.checked;
  const username = document.getElementById('enrollUsername')?.value.trim().toLowerCase() || id.toLowerCase();
  const password = document.getElementById('enrollPassword')?.value.trim() || 'ktpttc123';

  if (createAccount) {
    if (!Array.isArray(stmsData.users)) stmsData.users = [];
    const exists = stmsData.users.some(u => u.username.toLowerCase() === username);
    if (!exists) {
      stmsData.users.push({
        id: `USR-STU-${String(stmsData.users.length + 1).padStart(3, '0')}`,
        nameKh,
        nameEn,
        studentId: id,
        username,
        password,
        role: "trainee",
        roleLabel: "គរុសនិស្សិត",
        email: phone ? `${username}@student.ktpttc.edu.kh` : "portal@student.ktpttc.edu.kh",
        phone,
        className,
        cohort: newTrainee.cohort,
        status: "active",
        avatar: gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓'
      });
    }
  }

  saveData();
  closeStmsModal();
  showToast(`បានចុះឈ្មោះគរុសនិស្សិត «${nameKh}» (${id}) ព្រមទាំងបង្កើតគណនី Login ដោយជោគជ័យ!`, 'success');
  renderView('trainees');
}

// Digital Trainee Card Modal
function viewTraineeCard(id) {
  let t = null;
  if (id) {
    t = stmsData.trainees.find(x => x.id === id);
  }
  if (!t) {
    if (stmsData.trainees.length > 0) {
      t = stmsData.trainees[0];
    } else {
      showToast('មិនទាន់មានទិន្នន័យគរុសនិស្សិតដើម្បីបង្ហាញប័ណ្ណសម្គាល់ខ្លួនទេ។ សូមចុះឈ្មោះគរុសនិស្សិតជាមុន!', 'warning');
      return;
    }
  }

  const modalHtml = `
    <div class="stms-modal-backdrop" id="cardModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-window" style="max-width:440px; text-align:center;">
        <div class="modal-header-bar">
          <div class="modal-header-title"><i class="fas fa-id-card"></i> ប័ណ្ណសម្គាល់ខ្លួនគរុសនិស្សិត KTPTTC</div>
          <button class="modal-close-icon" onclick="closeStmsModal()">&times;</button>
        </div>
        <div class="modal-body-scroll" style="display:flex; justify-content:center; padding:30px 20px;">
          
          <div class="trainee-id-card" id="printableCard">
            <i class="fas fa-school card-watermark"></i>
            <!-- Card Header -->
            <div style="display:flex; align-items:center; gap:10px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:8px;">
              <img src="assets/ktpttc-logo.png" style="width:36px; height:36px; background:#fff; border-radius:50%; padding:2px;" onerror="this.src='assets/logo.png'">
              <div style="text-align:left;">
                <div style="font-size:0.75rem; font-weight:700; color:#93c5fd;">សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ</div>
                <div style="font-size:0.65rem; color:#cbd5e1;">TRAINEE TEACHER IDENTITY CARD</div>
              </div>
            </div>

            <!-- Card Body -->
            <div style="display:flex; gap:14px; align-items:center; margin:10px 0;">
              <div style="width:72px; height:85px; background:#0f172a; border:2px solid #3b82f6; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:2.4rem; overflow:hidden;">
                ${t.photo ? `<img src="${t.photo}" style="width:100%; height:100%; object-fit:cover;" onerror="this.outerHTML='${t.avatar}'">` : t.avatar}
              </div>
              <div style="text-align:left; font-size:0.82rem; line-height:1.6;">
                <div>ឈ្មោះ៖ <strong style="font-size:0.95rem; color:#f8fafc;">${t.nameKh}</strong></div>
                <div style="font-size:0.75rem; color:#94a3b8;">${t.nameEn || ''}</div>
                <div>ភេទ៖ ${t.gender} | កើត៖ ${t.dob}</div>
                <div>អត្តលេខ៖ <code style="color:#60a5fa; font-weight:700;">${t.id}</code></div>
                <div>ថ្នាក់៖ ${t.className}</div>
              </div>
            </div>

            <!-- Card Footer Barcode -->
            <div style="display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid rgba(255,255,255,0.2); padding-top:6px;">
              <div style="font-size:0.65rem; color:#94a3b8; text-align:left;">
                ឆ្នាំសិក្សា ២០២៦-២០២៧<br>សុពលភាព៖ ៣១ សីហា ២០២៧
              </div>
              <div style="font-family:monospace; letter-spacing:2px; font-weight:700; color:#38bdf8; font-size:0.8rem;">
                ||||||||||||||||||||
              </div>
            </div>
          </div>

        </div>
        <div class="modal-footer-bar" style="justify-content:center; gap:10px;">
          <button class="btn btn-outline" style="color:#2563eb; border-color:#93c5fd;" onclick="openEditStudent('${t.id}')"><i class="fas fa-edit"></i> កែប្រែព័ត៌មាន</button>
          <button class="btn btn-primary" onclick="window.print()"><i class="fas fa-print"></i> បោះពុម្ពប័ណ្ណ A4</button>
          <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Edit Trainee Status (Active, Suspended, Graduated, Withdrawn)
function editTraineeStatus(id) {
  const t = stmsData.trainees.find(x => x.id === id);
  if (!t) return;

  const newStatus = prompt(`កែសម្រួលស្ថានភាពសិក្សារបស់គរុសនិស្សិត «${t.nameKh}»៖\n(កំពុងសិក្សា, បញ្ចប់ការសិក្សា, ព្យួរការសិក្សា, លាឈប់)`, t.status);
  if (newStatus && ['កំពុងសិក្សា', 'បញ្ចប់ការសិក្សា', 'ព្យួរការសិក្សា', 'លាឈប់'].includes(newStatus.trim())) {
    t.status = newStatus.trim();
    saveData();
    showToast(`បានកែប្រែស្ថានភាពសិស្សទៅជា «${t.status}»!`, 'success');
    renderView('trainees');
  }
}

function deleteTraineeRecord(id) {
  const t = stmsData.trainees.find(x => x.id === id);
  if (!t) return;
  if (!confirm(`តើអ្នកពិតជាចង់លុបទិន្នន័យគរុសនិស្សិត «${t.nameKh}» មែនទេ?`)) return;

  stmsData.trainees = stmsData.trainees.filter(x => x.id !== id);
  saveData();
  showToast(`បានលុបទិន្នន័យរួចរាល់`, 'info');
  renderView('trainees');
}

// ==========================================================================
// 3. ATTENDANCE MANAGEMENT VIEW (ម៉ូឌុលគ្រប់គ្រងវត្តមាន)
// ==========================================================================
let currentAttendanceSession = {
  className: "ថ្នាក់បឋម ១២+២ ក្រុម ក",
  subjectCode: "PED-101",
  date: new Date().toISOString().split('T')[0],
  records: {}
};

function renderAttendanceView(container) {
  const classTrainees = stmsData.trainees.filter(t => t.className === currentAttendanceSession.className);

  // Initialize records if empty
  classTrainees.forEach(t => {
    if (!currentAttendanceSession.records[t.id]) {
      currentAttendanceSession.records[t.id] = 'present';
    }
  });

  const countP = Object.values(currentAttendanceSession.records).filter(v => v === 'present').length;
  const countA = Object.values(currentAttendanceSession.records).filter(v => v === 'absent').length;
  const countPA = Object.values(currentAttendanceSession.records).filter(v => v === 'permission').length;
  const countL = Object.values(currentAttendanceSession.records).filter(v => v === 'late').length;

  let html = `
    <div class="view-header">
      <div class="view-title-group">
        <h2><i class="fas fa-calendar-check"></i> ម៉ូឌុលស្រង់ និងតាមដានវត្តមានគរុសនិស្សិត (Module 3)</h2>
        <p>កត់ត្រាវត្តមាន ៤ កម្រិត៖ វត្តមាន (Present), អវត្តមានឥតច្បាប់ (Absent), ច្បាប់ (Permission), យឺត (Late)</p>
      </div>
      <div class="view-actions-group">
        <button class="btn btn-outline" onclick="openMonthlyAttendanceReportModal()"><i class="fas fa-clipboard-list"></i> របាយការណ៍ប្រចាំខែ</button>
        <button class="btn btn-outline" onclick="openSemesterAttendanceReportModal()"><i class="fas fa-chart-line"></i> របាយការណ៍លើប្រចាំខែ</button>
        <button class="btn btn-danger" onclick="openAutoNotificationModal()"><i class="fas fa-bell"></i> ជូនដំណឹងស្វ័យប្រវត្តិ</button>
        <button class="btn btn-primary" onclick="markAllAttendanceState('present')"><i class="fas fa-check-double"></i> វត្តមានទាំងអស់</button>
        <button class="btn btn-success" onclick="saveAttendanceSession()"><i class="fas fa-save"></i> រក្សាទុកវត្តមាន</button>
      </div>
    </div>

    <!-- Daily Attendance Chart & Filter Summary (matching diagram) -->
    <div style="display:grid; grid-template-columns: 320px 1fr; gap:16px; margin-bottom:20px;">
      
      <!-- Left: Daily Attendance Chart -->
      <div style="background:#ffffff; border-radius:10px; border:1px solid var(--border-color); padding:16px;">
        <h4 style="color:#1e3a8a; font-size:0.88rem; margin-bottom:8px;"><i class="fas fa-chart-bar"></i> Daily Attendance Chart (ប្រចាំសប្តាហ៍)</h4>
        <div class="daily-attendance-barchart" style="height:110px;">
          ${(stmsData.dailyAttendanceStats || []).map(s => `
            <div class="chart-day-col" title="${s.day}: វត្តមាន ${s.present} នាក់ | អវត្តមាន ${s.absent}">
              <div class="chart-bar-stack" style="height:80px;">
                <div class="bar-present" style="height:${Math.round(s.present * 0.75)}px;"></div>
                <div class="bar-absent" style="height:${Math.max(6, s.absent * 8)}px;"></div>
                <div class="bar-permission" style="height:${Math.max(6, (s.permission || 2) * 7)}px;"></div>
              </div>
              <span class="chart-day-label">${s.day}</span>
            </div>
          `).join('')}
        </div>
        <div style="display:flex; justify-content:center; gap:12px; font-size:0.7rem; margin-top:8px; font-weight:600;">
          <span style="color:#10b981;">● វត្តមាន</span>
          <span style="color:#ef4444;">● អវត្តមាន</span>
          <span style="color:#f59e0b;">● ច្បាប់</span>
        </div>
      </div>

      <!-- Right: Attendance Session Filter Controls -->
      <div style="background:#ffffff; border-radius:10px; border:1px solid var(--border-color); padding:16px; display:flex; flex-direction:column; justify-content:space-between;">
        <div style="display:flex; gap:14px; flex-wrap:wrap;">
          <div style="flex:1; min-width:180px;">
            <label class="form-label">ជ្រើសរើសថ្នាក់រៀន</label>
            <select class="form-input" onchange="changeAttendanceClass(this.value)">
              <option value="ថ្នាក់បឋម ១២+២ ក្រុម ក" ${currentAttendanceSession.className==='ថ្នាក់បឋម ១២+២ ក្រុម ក'?'selected':''}>ថ្នាក់បឋម ១២+២ ក្រុម ក</option>
              <option value="ថ្នាក់បឋម ១២+២ ក្រុម ខ" ${currentAttendanceSession.className==='ថ្នាក់បឋម ១២+២ ក្រុម ខ'?'selected':''}>ថ្នាក់បឋម ១២+២ ក្រុម ខ</option>
              <option value="ថ្នាក់មត្តេយ្យ ១២+២" ${currentAttendanceSession.className==='ថ្នាក់មត្តេយ្យ ១២+២'?'selected':''}>ថ្នាក់មត្តេយ្យ ១២+២</option>
              <option value="ថ្នាក់វិក្រឹតការ វគ្គ១" ${currentAttendanceSession.className==='ថ្នាក់វិក្រឹតការ វគ្គ១'?'selected':''}>ថ្នាក់វិក្រឹតការ វគ្គ១</option>
            </select>
          </div>

          <div style="flex:1; min-width:200px;">
            <label class="form-label">ជ្រើសរើសមុខវិជ្ជា</label>
            <select class="form-input" onchange="currentAttendanceSession.subjectCode=this.value">
              ${stmsData.subjects.map(s => `<option value="${s.code}" ${currentAttendanceSession.subjectCode===s.code?'selected':''}>${s.code} - ${s.nameKh}</option>`).join('')}
            </select>
          </div>

          <div style="width:160px;">
            <label class="form-label">កាលបរិច្ឆេទ</label>
            <input type="date" class="form-input" value="${currentAttendanceSession.date}" onchange="currentAttendanceSession.date=this.value">
          </div>
        </div>

        <!-- Attendance Live Statistics Pills -->
        <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
          <span class="badge badge-present" style="font-size:0.8rem; padding:4px 10px;"><i class="fas fa-check-circle"></i> វត្តមាន (Present): <strong>${countP}</strong></span>
          <span class="badge badge-permission" style="font-size:0.8rem; padding:4px 10px;"><i class="fas fa-clock"></i> មានច្បាប់ (Permission): <strong>${countPA}</strong></span>
          <span class="badge badge-late" style="font-size:0.8rem; padding:4px 10px;"><i class="fas fa-hourglass-half"></i> យឺត (Late): <strong>${countL}</strong></span>
          <span class="badge badge-absent" style="font-size:0.8rem; padding:4px 10px;"><i class="fas fa-times-circle"></i> អវត្តមានឥតច្បាប់ (Absent): <strong>${countA}</strong></span>
        </div>
      </div>

    </div>

    <!-- Interactive Grid Cards (click to toggle state) -->
    ${classTrainees.length === 0 ? `
      <div style="text-align:center; padding:45px 20px; background:#fff; border-radius:10px; border:1px solid var(--border-color); color:#64748b;">
        <i class="fas fa-users-slash fa-3x" style="color:#cbd5e1; margin-bottom:12px; display:block;"></i>
        <h4 style="color:#1e3a8a; font-size:1.05rem; margin-bottom:6px;">មិនទាន់មានគរុសនិស្សិតក្នុងថ្នាក់នេះនៅឡើយទេ</h4>
        <p style="font-size:0.85rem; color:#94a3b8; max-width:500px; margin:0 auto 16px auto; line-height:1.6;">
          សូមបញ្ចូលគរុសនិស្សិតចូលក្នុងថ្នាក់រៀនជាមុនសិន ដើម្បីចាប់ផ្តើមស្រង់វត្តមាន។
        </p>
        <button class="btn btn-primary" onclick="openEnrollModal()"><i class="fas fa-user-plus"></i> ចុះឈ្មោះគរុសនិស្សិត</button>
      </div>
    ` : `
      <div class="attendance-grid">
        ${classTrainees.map(t => {
          const st = currentAttendanceSession.records[t.id] || 'present';
          const label = st==='present'?'វត្តមាន':st==='absent'?'ឥតច្បាប់':st==='permission'?'មានច្បាប់':'មកយឺត';
          const badgeCls = st==='present'?'badge-present':st==='absent'?'badge-absent':st==='permission'?'badge-permission':'badge-late';
          return `
            <div class="attendance-card ${st}" onclick="toggleTraineeAttendance('${t.id}')">
              <div style="font-size:1.8rem; margin-bottom:4px;">${t.avatar}</div>
              <div style="font-weight:700; color:#0f172a; font-size:0.9rem;">${t.nameKh}</div>
              <div style="font-size:0.75rem; color:#64748b; margin-bottom:8px;"><code>${t.id}</code></div>
              <span class="badge ${badgeCls}">${label}</span>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  container.innerHTML = html;
}

function changeAttendanceClass(className) {
  currentAttendanceSession.className = className;
  currentAttendanceSession.records = {};
  renderAttendanceView(document.getElementById('mainContentArea'));
}

function toggleTraineeAttendance(id) {
  const current = currentAttendanceSession.records[id] || 'present';
  const cycle = {
    'present': 'permission',
    'permission': 'late',
    'late': 'absent',
    'absent': 'present'
  };
  currentAttendanceSession.records[id] = cycle[current];
  renderAttendanceView(document.getElementById('mainContentArea'));
}

function markAllAttendanceState(state) {
  const classTrainees = stmsData.trainees.filter(t => t.className === currentAttendanceSession.className);
  classTrainees.forEach(t => {
    currentAttendanceSession.records[t.id] = state;
  });
  renderAttendanceView(document.getElementById('mainContentArea'));
  showToast('បានកត់ត្រាវត្តមានទាំងអស់!', 'info');
}

function saveAttendanceSession() {
  const sess = {
    id: `ATT-${Date.now()}`,
    date: currentAttendanceSession.date,
    className: currentAttendanceSession.className,
    subjectCode: currentAttendanceSession.subjectCode,
    records: { ...currentAttendanceSession.records }
  };

  stmsData.attendanceSessions.push(sess);

  // Update Trainees' overall absence statistics
  Object.keys(sess.records).forEach(id => {
    const status = sess.records[id];
    const trainee = stmsData.trainees.find(t => t.id === id);
    if (trainee) {
      if (!trainee.attendanceSummary) {
        trainee.attendanceSummary = { present: 0, permission: 0, late: 0, absent: 0, rate: 100 };
      }
      if (status === 'present') trainee.attendanceSummary.present++;
      else if (status === 'permission') trainee.attendanceSummary.permission++;
      else if (status === 'late') trainee.attendanceSummary.late++;
      else if (status === 'absent') trainee.attendanceSummary.absent++;

      const totalSlots = trainee.attendanceSummary.present + trainee.attendanceSummary.permission + trainee.attendanceSummary.late + trainee.attendanceSummary.absent;
      trainee.attendanceSummary.rate = totalSlots > 0 ? (((trainee.attendanceSummary.present + trainee.attendanceSummary.late * 0.5) / totalSlots) * 100).toFixed(1) : 100;
    }
  });

  saveData();
  showToast('បានរក្សាទុកវត្តមានដោយជោគជ័យ!', 'success');
}

// ==========================================================================
// 4. SUBJECT-WISE GRADING MANAGEMENT VIEW (ម៉ូឌុលគ្រប់គ្រងពិន្ទុតាមមុខវិជ្ជា)
// ==========================================================================
let currentGradingSubject = "PED-101";
let currentGradingClass = "ថ្នាក់បឋម ១២+២ ក្រុម ក";

function renderGradingView(container) {
  const classTrainees = stmsData.trainees.filter(t => t.className === currentGradingClass);
  const subj = stmsData.subjects.find(s => s.code === currentGradingSubject) || stmsData.subjects[0];
  const weights = stmsData.gradeWeightConfig;

  let html = `
    <div class="view-header">
      <div class="view-title-group">
        <h2><i class="fas fa-calculator"></i> ម៉ូឌុលគ្រប់គ្រងពិន្ទុ &amp; វាយតម្លៃគរុសនិស្សិត (Module 4)</h2>
        <p>
          រចនាសម្ព័ន្ធមេគុណ៖ កិច្ចការស្រាវជ្រាវ (${weights.homeworkPercent}%) + វត្តមាន (${weights.attendancePercent}%) + ប្រឡងប្រចាំខែ (${weights.monthlyExamPercent}%) + ប្រឡងឆមាស (${weights.semesterExamPercent}%) = ១០០%
        </p>
      </div>
      <div class="view-actions-group">
        <button class="btn btn-warning" onclick="recalculateScores()"><i class="fas fa-calculator"></i> គណនាស្វ័យប្រវត្តិ</button>
        <button class="btn btn-primary" onclick="openCertificateModal()"><i class="fas fa-award"></i> វិញ្ញាបនបត្រ / ប័ណ្ណសរសើរ</button>
        ${currentRole === 'admin' ? `
          <button class="btn btn-outline" onclick="openGradeWeightModal()"><i class="fas fa-sliders-h"></i> កំណត់មេគុណ</button>
          <button class="btn btn-success" onclick="publishAllSubjectScores()"><i class="fas fa-bullhorn"></i> ផ្សព្វផ្សាយពិន្ទុ</button>
        ` : `
          <button class="btn btn-success" onclick="saveTrainerScoreMatrix()"><i class="fas fa-save"></i> រក្សាទុកពិន្ទុ</button>
        `}
        <button class="btn btn-outline" onclick="window.print()"><i class="fas fa-print"></i> បោះពុម្ពតារាង</button>
      </div>
    </div>

    <!-- Grade Distribution & Summary Header -->
    <div style="display:grid; grid-template-columns: 280px 1fr; gap:16px; margin-bottom:20px;">
      
      <!-- Grade Donut Chart -->
      <div style="background:#ffffff; border-radius:10px; border:1px solid var(--border-color); padding:16px; display:flex; flex-direction:column; align-items:center; text-align:center;">
        <h4 style="color:#1e3a8a; font-size:0.88rem; margin-bottom:6px;"><i class="fas fa-chart-pie"></i> Grade Distribution Chart</h4>
        <svg width="86" height="86" viewBox="0 0 42 42" class="donut">
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#e2e8f0" stroke-width="6"></circle>
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#3b82f6" stroke-width="6" stroke-dasharray="41 59" stroke-dashoffset="25"></circle>
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f97316" stroke-width="6" stroke-dasharray="25 75" stroke-dashoffset="84"></circle>
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#eab308" stroke-width="6" stroke-dasharray="16 84" stroke-dashoffset="59"></circle>
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#8b5cf6" stroke-width="6" stroke-dasharray="9 91" stroke-dashoffset="43"></circle>
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#06b6d4" stroke-width="6" stroke-dasharray="6 94" stroke-dashoffset="34"></circle>
          <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#ef4444" stroke-width="6" stroke-dasharray="3 97" stroke-dashoffset="28"></circle>
          <text x="21" y="23" text-anchor="middle" font-size="8" font-weight="bold" fill="#1e3a8a">100%</text>
        </svg>
        <div class="donut-legend" style="margin-top:6px;">
          <span style="color:#3b82f6;">● A: 41%</span>
          <span style="color:#f97316;">● B: 25%</span>
          <span style="color:#eab308;">● C: 16%</span>
          <span style="color:#8b5cf6;">● D: 9%</span>
          <span style="color:#06b6d4;">● E: 6%</span>
          <span style="color:#ef4444;">● F: 3%</span>
        </div>
      </div>

      <!-- Filter Bar -->
      <div style="background:#ffffff; border-radius:10px; border:1px solid var(--border-color); padding:16px; display:flex; flex-direction:column; justify-content:space-between;">
        <div style="display:flex; gap:16px; flex-wrap:wrap;">
          <div style="flex:1; min-width:220px;">
            <label class="form-label">មុខវិជ្ជា</label>
            <select class="form-input" onchange="currentGradingSubject=this.value; renderGradingView(document.getElementById('mainContentArea'));">
              ${stmsData.subjects.map(s => `<option value="${s.code}" ${currentGradingSubject===s.code?'selected':''}>${s.code} - ${s.nameKh} (${s.trainer})</option>`).join('')}
            </select>
          </div>

          <div style="flex:1; min-width:200px;">
            <label class="form-label">ថ្នាក់បណ្តុះបណ្តាល</label>
            <select class="form-input" onchange="currentGradingClass=this.value; renderGradingView(document.getElementById('mainContentArea'));">
              <option value="ថ្នាក់បឋម ១២+២ ក្រុម ក" ${currentGradingClass==='ថ្នាក់បឋម ១២+២ ក្រុម ក'?'selected':''}>ថ្នាក់បឋម ១២+២ ក្រុម ក</option>
              <option value="ថ្នាក់បឋម ១២+២ ក្រុម ខ" ${currentGradingClass==='ថ្នាក់បឋម ១២+២ ក្រុម ខ'?'selected':''}>ថ្នាក់បឋម ១២+២ ក្រុម ខ</option>
              <option value="ថ្នាក់មត្តេយ្យ ១២+២" ${currentGradingClass==='ថ្នាក់មត្តេយ្យ ១២+២'?'selected':''}>ថ្នាក់មត្តេយ្យ ១២+២</option>
            </select>
          </div>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 12px; margin-top:10px; font-size:0.8rem; color:#475569; display:flex; justify-content:space-between; align-items:center;">
          <span><i class="fas fa-info-circle" style="color:#2563eb;"></i> គណនាលទ្ធផលស្វ័យប្រវត្តិតាមរូបមន្តស្តង់ដារ KTPTTC និងចាត់ចំណាត់ថ្នាក់តាមឆមាស</span>
          <button class="btn btn-outline" style="padding:2px 10px; font-size:0.75rem;" onclick="recalculateScores()">គណនាឡើងវិញ</button>
        </div>
      </div>

    </div>

    <!-- Matrix Table -->
    <div class="table-card">
      <div class="table-toolbar">
        <strong style="color:#1e3a8a;"><i class="fas fa-table"></i> តារាងបញ្ចូលពិន្ទុ៖ ${subj.nameKh}</strong>
        <span style="font-size:0.8rem; color:#64748b;">គណនាមធ្យមភាគ ចំណាត់ថ្នាក់ និងនិទ្ទេសស្វ័យប្រវត្តិ</span>
      </div>
      <div class="data-table-responsive">
        <table class="stms-table" id="gradeMatrixTable">
          <thead>
            <tr>
              <th>ល.រ</th>
              <th>អត្តលេខ</th>
              <th>ឈ្មោះគរុសនិស្សិត</th>
              <th>កិច្ចការ (${weights.homeworkPercent}%)</th>
              <th>វត្តមាន (${weights.attendancePercent}%)</th>
              <th>ប្រឡងខែ (${weights.monthlyExamPercent}%)</th>
              <th>ប្រឡងឆមាស (${weights.semesterExamPercent}%)</th>
              <th>សរុប (100)</th>
              <th>និទ្ទេស</th>
              <th>ចំណាត់ថ្នាក់</th>
              <th>ស្ថានភាព</th>
            </tr>
          </thead>
          <tbody>
            ${classTrainees.length === 0 ? `
              <tr>
                <td colspan="11" style="text-align:center; padding:50px 20px; color:#64748b;">
                  <i class="fas fa-clipboard-list fa-3x" style="color:#cbd5e1; margin-bottom:12px; display:block;"></i>
                  <div style="font-size:1.05rem; font-weight:700; color:#1e3a8a; margin-bottom:6px;">មិនទាន់មានគរុសនិស្សិតក្នុងថ្នាក់នេះនៅឡើយទេ</div>
                  <p style="font-size:0.85rem; color:#94a3b8; max-width:480px; margin:0 auto 16px auto; line-height:1.6;">
                    សូមចុះឈ្មោះគរុសនិស្សិតចូលក្នុងថ្នាក់រៀនជាមុនសិន ដើម្បីគ្រូឧទ្ទេសអាចបញ្ចូលពិន្ទុ និងគណនាលទ្ធផលស្វ័យប្រវត្តិ។
                  </p>
                  <button class="btn btn-primary" onclick="openEnrollModal()"><i class="fas fa-user-plus"></i> ចុះឈ្មោះគរុសនិស្សិត</button>
                </td>
              </tr>
            ` : classTrainees.map((t, idx) => {
              const sc = t.scores?.[currentGradingSubject] || { homework: 8, attendance: 9, monthly: 24, semester: 42, total: 83, grade: "B", status: "draft" };
              return `
                <tr data-student-id="${t.id}">
                  <td>${idx + 1}</td>
                  <td><code>${t.id}</code></td>
                  <td><strong>${t.nameKh}</strong></td>
                  <td><input type="number" step="0.5" class="form-input score-hw" value="${sc.homework}" style="width:65px; height:32px; text-align:center;" max="${weights.homeworkPercent}" onchange="recalculateRowScore('${t.id}')"></td>
                  <td><input type="number" step="0.5" class="form-input score-att" value="${sc.attendance}" style="width:65px; height:32px; text-align:center;" max="${weights.attendancePercent}" onchange="recalculateRowScore('${t.id}')"></td>
                  <td><input type="number" step="0.5" class="form-input score-mon" value="${sc.monthly}" style="width:75px; height:32px; text-align:center;" max="${weights.monthlyExamPercent}" onchange="recalculateRowScore('${t.id}')"></td>
                  <td><input type="number" step="0.5" class="form-input score-sem" value="${sc.semester}" style="width:75px; height:32px; text-align:center;" max="${weights.semesterExamPercent}" onchange="recalculateRowScore('${t.id}')"></td>
                  <td><strong style="color:#2563eb; font-size:0.95rem;" id="total-${t.id}">${sc.total}</strong></td>
                  <td><span class="badge ${sc.grade==='A'?'badge-present':sc.grade==='B'?'badge-published':'badge-permission'}" id="grade-${t.id}">${sc.grade}</span></td>
                  <td><strong id="rank-${t.id}">#${idx + 1}</strong></td>
                  <td><span class="badge ${sc.status==='published'?'badge-published':'badge-draft'}" id="status-${t.id}">${sc.status==='published'?'ផ្សព្វផ្សាយរួច':'ព្រាង (Draft)'}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// Realtime Row Score Calculator
function recalculateRowScore(id) {
  const row = document.querySelector(`tr[data-student-id="${id}"]`);
  if (!row) return;

  const hw = Number(row.querySelector('.score-hw')?.value) || 0;
  const att = Number(row.querySelector('.score-att')?.value) || 0;
  const mon = Number(row.querySelector('.score-mon')?.value) || 0;
  const sem = Number(row.querySelector('.score-sem')?.value) || 0;

  const total = Number((hw + att + mon + sem).toFixed(1));
  let grade = 'E';
  if (total >= 85) grade = 'A';
  else if (total >= 75) grade = 'B';
  else if (total >= 65) grade = 'C';
  else if (total >= 50) grade = 'D';

  const totalEl = document.getElementById(`total-${id}`);
  const gradeEl = document.getElementById(`grade-${id}`);
  if (totalEl) totalEl.textContent = total;
  if (gradeEl) gradeEl.textContent = grade;
}

function saveTrainerScoreMatrix() {
  const rows = document.querySelectorAll('#gradeMatrixTable tbody tr');
  rows.forEach(r => {
    const id = r.dataset.studentId;
    const t = stmsData.trainees.find(x => x.id === id);
    if (t) {
      if (!t.scores) t.scores = {};
      const hw = Number(r.querySelector('.score-hw')?.value) || 0;
      const att = Number(r.querySelector('.score-att')?.value) || 0;
      const mon = Number(r.querySelector('.score-mon')?.value) || 0;
      const sem = Number(r.querySelector('.score-sem')?.value) || 0;
      const total = Number((hw + att + mon + sem).toFixed(1));
      let grade = total >= 85 ? 'A' : total >= 75 ? 'B' : total >= 65 ? 'C' : total >= 50 ? 'D' : 'E';

      t.scores[currentGradingSubject] = {
        homework: hw,
        attendance: att,
        monthly: mon,
        semester: sem,
        total,
        grade,
        status: "draft"
      };
    }
  });

  saveData();
  showToast('បានរក្សាទុកពិន្ទុ និងគណនារួចរាល់!', 'success');
}

function publishAllSubjectScores() {
  stmsData.trainees.forEach(t => {
    if (t.scores && t.scores[currentGradingSubject]) {
      t.scores[currentGradingSubject].status = 'published';
    }
  });

  saveData();
  showToast(`បានអនុម័ត និងផ្សព្វផ្សាយពិន្ទុមុខវិជ្ជា ${currentGradingSubject} ទៅកាន់គរុសនិស្សិតទាំងអស់!`, 'success');
  renderGradingView(document.getElementById('mainContentArea'));
}

function openGradeWeightModal() {
  const w = stmsData.gradeWeightConfig;
  const modalHtml = `
    <div class="stms-modal-backdrop" id="weightModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-window" style="max-width:480px;">
        <div class="modal-header-bar">
          <div class="modal-header-title"><i class="fas fa-sliders-h"></i> កំណត់មេគុណពិន្ទុ (Grade Weights)</div>
          <button class="modal-close-icon" onclick="closeStmsModal()">&times;</button>
        </div>
        <div class="modal-body-scroll">
          <form onsubmit="event.preventDefault(); saveGradeWeights();">
            <div style="margin-bottom:12px;">
              <label class="form-label">កិច្ចការស្រាវជ្រាវ/ផ្ទាល់ខ្លួន (%)</label>
              <input type="number" id="wHw" class="form-input" value="${w.homeworkPercent}" required>
            </div>
            <div style="margin-bottom:12px;">
              <label class="form-label">វត្តមាន និងវិន័យ (%)</label>
              <input type="number" id="wAtt" class="form-input" value="${w.attendancePercent}" required>
            </div>
            <div style="margin-bottom:12px;">
              <label class="form-label">ប្រឡងពាក់កណ្ដាលឆមាស (%)</label>
              <input type="number" id="wMon" class="form-input" value="${w.monthlyExamPercent}" required>
            </div>
            <div style="margin-bottom:16px;">
              <label class="form-label">ប្រឡងបញ្ចប់ឆមាស (%)</label>
              <input type="number" id="wSem" class="form-input" value="${w.semesterExamPercent}" required>
            </div>
            <div class="modal-footer-bar" style="padding:0; background:none; border:none;">
              <button type="button" class="btn btn-outline" onclick="closeStmsModal()">បោះបង់</button>
              <button type="submit" class="btn btn-primary">រក្សាទុកមេគុណ</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function saveGradeWeights() {
  const hw = Number(document.getElementById('wHw').value);
  const att = Number(document.getElementById('wAtt').value);
  const mon = Number(document.getElementById('wMon').value);
  const sem = Number(document.getElementById('wSem').value);

  if ((hw + att + mon + sem) !== 100) {
    alert('ផលបូកមេគុណទាំងអស់ត្រូវតែស្មើ ១០០% គត់!');
    return;
  }

  stmsData.gradeWeightConfig = { homeworkPercent: hw, attendancePercent: att, monthlyExamPercent: mon, semesterExamPercent: sem };
  saveData();
  closeStmsModal();
  showToast('បានកែប្រែមេគុណពិន្ទុជោគជ័យ!', 'success');
  renderGradingView(document.getElementById('mainContentArea'));
}

// ==========================================================================
// 5. TIMETABLE VIEW (ម៉ូឌុលកាលវិភាគ)
// ==========================================================================
function renderTimetableView(container) {
  const tt = stmsData.timetables[0];

  let html = `
    <div class="view-header">
      <div class="view-title-group">
        <h2><i class="fas fa-calendar-alt"></i> ម៉ូឌុលកាលវិភាគ និងការសិក្សា (Module 2)</h2>
        <p>សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ (KTPTTC) • ${tt.className} • ${tt.room}</p>
      </div>
      <div class="view-actions-group">
        <button class="btn btn-outline" onclick="openSubjectModal()"><i class="fas fa-edit"></i> Adding/Editing Subjects</button>
        <button class="btn btn-outline" onclick="openAssignLecturerModal()"><i class="fas fa-chalkboard-teacher"></i> Assigning Lecturers</button>
        ${currentRole === 'admin' ? `
          <button class="btn btn-primary" onclick="openAddSlotModal()"><i class="fas fa-plus"></i> បន្ថែមម៉ោងបង្រៀន</button>
        ` : ''}
        <button class="btn btn-outline" onclick="window.print()"><i class="fas fa-print"></i> បោះពុម្ពកាលវិភាគ</button>
      </div>
    </div>

    <!-- Timetable Grid -->
    <div class="table-card">
      <div class="data-table-responsive">
        <table class="stms-table" style="text-align:center;">
          <thead>
            <tr>
              <th style="width:140px;">ថ្ងៃនៃសប្ដាហ៍</th>
              <th>ម៉ោងសិក្សា</th>
              <th>មុខវិជ្ជាបង្រៀន</th>
              <th>គ្រូឧទ្ទេសទទួលបន្ទុក</th>
              <th>បន្ទប់សិក្សា</th>
            </tr>
          </thead>
          <tbody>
            ${tt.days.map(d => `
              ${d.slots.map((s, idx) => `
                <tr>
                  ${idx === 0 ? `<td rowspan="${d.slots.length}" style="font-weight:700; background:#f8fafc; color:#1e3a8a; border-right:1px solid #e2e8f0;">${d.day}</td>` : ''}
                  <td><strong>${s.period}</strong></td>
                  <td style="font-weight:600; color:#1e40af;">${s.subject}</td>
                  <td>${s.trainer}</td>
                  <td><span class="badge badge-published">${s.room}</span></td>
                </tr>
              `).join('')}
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function openAddSlotModal() {
  const modalHtml = `
    <div class="stms-modal-backdrop" id="slotModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-window" style="max-width:480px;">
        <div class="modal-header-bar">
          <div class="modal-header-title"><i class="fas fa-calendar-plus"></i> បន្ថែមម៉ោងបង្រៀនថ្មី</div>
          <button class="modal-close-icon" onclick="closeStmsModal()">&times;</button>
        </div>
        <div class="modal-body-scroll">
          <form onsubmit="event.preventDefault(); submitAddSlot();">
            <div style="margin-bottom:12px;">
              <label class="form-label">ថ្ងៃ</label>
              <select id="slotDay" class="form-input">
                <option value="ចន្ទ (Monday)">ចន្ទ (Monday)</option>
                <option value="អង្គារ (Tuesday)">អង្គារ (Tuesday)</option>
                <option value="ពុធ (Wednesday)">ពុធ (Wednesday)</option>
                <option value="ព្រហស្បតិ៍ (Thursday)">ព្រហស្បតិ៍ (Thursday)</option>
                <option value="សុក្រ (Friday)">សុក្រ (Friday)</option>
              </select>
            </div>
            <div style="margin-bottom:12px;">
              <label class="form-label">ម៉ោងសិក្សា</label>
              <input type="text" id="slotPeriod" class="form-input" value="13:30 - 15:00" required>
            </div>
            <div style="margin-bottom:12px;">
              <label class="form-label">មុខវិជ្ជា</label>
              <select id="slotSubject" class="form-input">
                ${stmsData.subjects.map(s => `<option value="${s.nameKh}">${s.nameKh}</option>`).join('')}
              </select>
            </div>
            <div style="margin-bottom:12px;">
              <label class="form-label">គ្រូឧទ្ទេស</label>
              <input type="text" id="slotTrainer" class="form-input" value="សាស្ត្រាចារ្យ ហេង សំណាង" required>
            </div>
            <div style="margin-bottom:16px;">
              <label class="form-label">បន្ទប់រៀន</label>
              <input type="text" id="slotRoom" class="form-input" value="បន្ទប់ ១០១" required>
            </div>
            <div class="modal-footer-bar" style="padding:0; background:none; border:none;">
              <button type="button" class="btn btn-outline" onclick="closeStmsModal()">បោះបង់</button>
              <button type="submit" class="btn btn-primary">រក្សាទុក</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function submitAddSlot() {
  const dayName = document.getElementById('slotDay').value;
  const period = document.getElementById('slotPeriod').value;
  const subject = document.getElementById('slotSubject').value;
  const trainer = document.getElementById('slotTrainer').value;
  const room = document.getElementById('slotRoom').value;

  const tt = stmsData.timetables[0];
  const targetDay = tt.days.find(d => d.day === dayName);
  if (targetDay) {
    targetDay.slots.push({ period, subject, trainer, room });
    saveData();
    closeStmsModal();
    showToast('បានបន្ថែមម៉ោងបង្រៀនក្នុងកាលវិភាគដោយជោគជ័យ!', 'success');
    renderTimetableView(document.getElementById('mainContentArea'));
  }
}

// ==========================================================================
// 6. TRAINEE PORTAL VIEW (ផតថលផ្ទាល់ខ្លួនគរុសនិស្សិត - MODELED AFTER MOCKUP)
// ==========================================================================

const TRAINEE_STREAMS = [
  { id: 'BAC1-B-S1', label: 'បរិញ្ញាបត្រ+១ ក្រុម ខ • ឆមាសទី ១', cohort: 'បរិញ្ញាបត្រ+១ ជំនាន់ទី ៤' },
  { id: '12P2-A-S1', label: 'ថ្នាក់បឋម ១២+២ ក្រុម ក • ឆមាសទី ១', cohort: 'ថ្នាក់បឋមសិក្សា ១២+២ ជំនាន់ទី ៣៤' },
  { id: '12P2-B-S1', label: 'ថ្នាក់បឋម ១២+២ ក្រុម ខ • ឆមាសទី ១', cohort: 'ថ្នាក់បឋមសិក្សា ១២+២ ជំនាន់ទី ៣៤' },
  { id: '12P2-A-S2', label: 'ថ្នាក់បឋម ១២+២ ក្រុម ក • ឆមាសទី ២', cohort: 'ថ្នាក់បឋមសិក្សា ១២+២ ជំនាន់ទី ៣៤' }
];
let currentStreamIndex = 0;

const KTPTTC_ALL_SUBJECTS = [
  { code: "PED-101", nameKh: "គរុកោសល្យទូទៅ និងវិធីសាស្ត្របង្រៀន", credits: 3, trainer: "សាស្ត្រាចារ្យ ហេង សំណាង" },
  { code: "PSY-102", nameKh: "ចិត្តវិទ្យាគរុកោសល្យ និងការអភិវឌ្ឍកុមារ", credits: 2, trainer: "លោកស្រី ម៉ៅ សុភា" },
  { code: "MTH-103", nameKh: "វិធីសាស្ត្របង្រៀនគណិតវិទ្យាបឋម", credits: 3, trainer: "លោកគ្រូ យឹម វណ្ណា" },
  { code: "KHM-104", nameKh: "វិធីសាស្ត្របង្រៀនភាសាខ្មែរ និងអំណានដំបូង", credits: 3, trainer: "លោកស្រី ជា រចនា" },
  { code: "ICT-105", nameKh: "បច្ចេកវិទ្យាព័ត៌មានក្នុងការអប់រំ (ICT)", credits: 2, trainer: "លោកគ្រូ ស៊ុយ សូលីដា" },
  { code: "RES-106", nameKh: "ការស្រាវជ្រាវសកម្មភាពក្នុងថ្នាក់រៀន (Action Research)", credits: 2, trainer: "សាស្ត្រាចារ្យ ហេង សំណាង" },
  { code: "PRAC-107", nameKh: "ការចុះកម្មសិក្សាគរុកោសល្យនៅសាលាបឋម (Practicum)", credits: 4, trainer: "លោកគ្រូ យឹម វណ្ណា" },
  { code: "COM-108", nameKh: "បច្ចេកវិទ្យាព័ត៌មានវិទ្យា និងសារគមនាគមន៍", credits: 2, trainer: "លោកគ្រូ ស៊ុយ សូលីដា" }
];

function toKhmerNum(num) {
  const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(num).replace(/[0-9]/g, d => khmerDigits[parseInt(d, 10)]);
}

function getKhmerFormattedDate(date = new Date()) {
  const days = ['អាទិត្យ', 'ចន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
  const months = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
  const dayName = days[date.getDay()];
  const dayNum = toKhmerNum(date.getDate());
  const monthName = months[date.getMonth()];
  const yearNum = toKhmerNum(date.getFullYear());
  return `📅 ${dayName} ទី${dayNum} ខែ${monthName} ឆ្នាំ${yearNum}`;
}

function getKhmerGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'អរុណសួស្តី';
  if (hour >= 12 && hour < 17) return 'ទិវាសួស្តី';
  return 'សាយណ្ហសួស្តី';
}

function getKhmerFirstLetter(name) {
  if (!name) return 'យ';
  const clean = name.trim();
  const match = clean.match(/[\u1780-\u17B3]/);
  return match ? match[0] : clean.charAt(0);
}

function getSubjectTheme(code) {
  const themes = {
    'PED-101': { bg: '#fff1f2', border: '#fecdd3', color: '#e11d48', icon: 'fas fa-chalkboard-teacher', label: 'គរុកោសល្យ' },
    'PSY-102': { bg: '#ecfeff', border: '#a5f3fc', color: '#0891b2', icon: 'fas fa-brain', label: 'ចិត្តវិទ្យា' },
    'MTH-103': { bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb', icon: 'fas fa-calculator', label: 'គណិតវិទ្យា' },
    'KHM-104': { bg: '#fff7ed', border: '#fed7aa', color: '#ea580c', icon: 'fas fa-book-reader', label: 'ភាសាខ្មែរ' },
    'ICT-105': { bg: '#faf5ff', border: '#e9d5ff', color: '#9333ea', icon: 'fas fa-laptop-code', label: 'បច្ចេកវិទ្យា ICT' },
    'RES-106': { bg: '#fffbeb', border: '#fde68a', color: '#d97706', icon: 'fas fa-feather-alt', label: 'ការស្រាវជ្រាវ' },
    'PRAC-107': { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', icon: 'fas fa-school', label: 'កម្មសិក្សា' },
    'COM-108': { bg: '#f0f9ff', border: '#bae6fd', color: '#0284c7', icon: 'fas fa-book-bookmark', label: 'សារគមនាគមន៍' }
  };
  return themes[code] || { bg: '#f8fafc', border: '#e2e8f0', color: '#2563eb', icon: 'fas fa-book', label: 'មុខវិជ្ជា' };
}

function getActiveTraineeProfile() {
  let t = currentTraineeUser || (stmsData.trainees && stmsData.trainees.length > 0 ? stmsData.trainees[0] : null);
  if (!t || !t.id) {
    if (currentUser && currentUser.role === 'trainee' && currentUser.nameKh) {
      t = currentUser;
    } else {
      t = {
        id: 'ktpttc-2026-st-001',
        nameKh: 'យូសុះ ស៊ីលាល',
        nameEn: 'Yousoh Silal',
        gender: 'ប្រុស',
        dob: '2001-11-16',
        className: 'បរិញ្ញាបត្រ+១ ក្រុម ខ',
        cohort: 'បរិញ្ញាបត្រ+១ ជំនាន់ទី ៤',
        roleLabel: 'គរុបង្រៀន',
        status: 'កំពុងសិក្សា',
        phone: '098765432',
        avatar: '👨‍🎓',
        attendanceSummary: {
          rate: 98,
          present: 46,
          permission: 2,
          late: 1,
          absent: 0
        },
        scores: {
          'PED-101': { total: 92, grade: 'A', status: 'published', homework: 10, attendance: 10, monthly: 28, semester: 44, final: 44 },
          'PSY-102': { total: 89, grade: 'B+', status: 'published', homework: 9, attendance: 10, monthly: 27, semester: 43, final: 43 },
          'MTH-103': { total: 95, grade: 'A', status: 'published', homework: 10, attendance: 10, monthly: 29, semester: 46, final: 46 },
          'KHM-104': { total: 88, grade: 'B+', status: 'published', homework: 9, attendance: 10, monthly: 26, semester: 43, final: 43 },
          'ICT-105': { total: 90, grade: 'A', status: 'published', homework: 9, attendance: 10, monthly: 27, semester: 44, final: 44 },
          'RES-106': { total: 91, grade: 'A', status: 'published', homework: 10, attendance: 9, monthly: 27, semester: 45, final: 45 },
          'PRAC-107': { total: 97, grade: 'A', status: 'published', homework: 10, attendance: 10, monthly: 29, semester: 48, final: 48 },
          'COM-108': { total: 89, grade: 'B+', status: 'published', homework: 9, attendance: 10, monthly: 26, semester: 44, final: 44 }
        }
      };
    }
  }
  return t;
}

function prevTraineeSemester() {
  currentStreamIndex = currentStreamIndex > 0 ? currentStreamIndex - 1 : TRAINEE_STREAMS.length - 1;
  const area = document.getElementById('mainContentArea');
  if (area) renderTraineePortalView(area);
}

function nextTraineeSemester() {
  currentStreamIndex = currentStreamIndex < TRAINEE_STREAMS.length - 1 ? currentStreamIndex + 1 : 0;
  const area = document.getElementById('mainContentArea');
  if (area) renderTraineePortalView(area);
}

function scrollToSubjectsSection() {
  const el = document.getElementById('traineeSubjectsSection');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}

function renderTraineePortalView(container) {
  const t = getActiveTraineeProfile();
  const greeting = getKhmerGreeting();
  const khmerDate = getKhmerFormattedDate();
  const initialLetter = getKhmerFirstLetter(t.nameKh);
  const activeStream = TRAINEE_STREAMS[currentStreamIndex];

  let avatarHtml = '';
  if (t.photo && String(t.photo).trim() !== '') {
    avatarHtml = `<img src="${t.photo}" class="trainee-hero-avatar-img" alt="${t.nameKh}" onerror="this.outerHTML='<span class=\\'trainee-hero-avatar-letter\\'>${initialLetter}</span>'" />`;
  } else {
    avatarHtml = `<span class="trainee-hero-avatar-letter">${initialLetter}</span>`;
  }

  // Active 8 subjects
  const subjects = KTPTTC_ALL_SUBJECTS;

  const subjectsHtml = subjects.map(subj => {
    const theme = getSubjectTheme(subj.code);
    return `
      <div class="trainee-subject-card" style="--subj-bg:${theme.bg}; --subj-border:${theme.border}; --subj-color:${theme.color};" onclick="openSubjectDetailModal('${subj.code}')" title="ចុចដើម្បីមើលមេរៀន និងលម្អិតមុខវិជ្ជា ${subj.nameKh}">
        <div class="subj-card-icon" style="color:${theme.color};">
          <i class="${theme.icon}"></i>
        </div>
        <div class="subj-card-name">
          ${subj.nameKh}
        </div>
        <div class="subj-card-sub" style="font-size:0.8rem; color:#64748b; font-weight:600; margin-top:auto;">
          ${subj.credits} ក្រេឌីត
        </div>
      </div>
    `;
  }).join('');

  let html = `
    <div class="trainee-portal-container">
      
      <!-- 1. Trainee Hero Banner Card (Deep Blue + Khmer Rosette Watermark) -->
      <div class="trainee-hero-banner">
        <div class="trainee-hero-pattern"></div>
        <div class="trainee-hero-left">
          <div class="trainee-hero-avatar-wrap">
            ${avatarHtml}
          </div>
          <div class="trainee-hero-text">
            <span class="trainee-hero-greeting">${greeting}</span>
            <h1 class="trainee-hero-name">${t.nameKh || 'យូសុះ ស៊ីលាល'}</h1>
            <div class="trainee-hero-badges">
              <span class="trainee-badge-pill role"><i class="fas fa-graduation-cap"></i> ${t.roleLabel || 'គរុបង្រៀន'}</span>
              <span class="trainee-badge-pill class"><i class="fas fa-chalkboard"></i> ${activeStream.label.split(' • ')[0]}</span>
              <span class="trainee-badge-pill class"><i class="fas fa-id-badge"></i> ${t.id || 'ktpttc-2026-st-001'}</span>
            </div>
            <div class="trainee-hero-date">
              ${khmerDate}
            </div>
          </div>
        </div>
        <div class="trainee-hero-actions">
          <button class="btn-hero-action primary" onclick="viewTraineeCard('${t.id}')">
            <i class="fas fa-id-card"></i> កាតសិស្ស
          </button>
          <button class="btn-hero-action secondary" onclick="openTraineeForumModal('requests')">
            <i class="fas fa-user-edit"></i> ស្នើសុំកែប្រែ
          </button>
        </div>
      </div>

      <!-- 2. Trainee 8 Pastel Hub Menu Grid -->
      <div class="trainee-hub-grid">
        
        <!-- 1. មុខវិជ្ជា (Subjects - Pink) -->
        <div class="trainee-hub-card card-pink" onclick="openTraineeSubjectsModal()">
          <div class="hub-card-pattern"></div>
          <div class="hub-card-icon"><i class="fas fa-chalkboard-teacher"></i></div>
          <div class="hub-card-title">មុខវិជ្ជា</div>
          <div class="hub-card-sub">${subjects.length} មុខវិជ្ជា</div>
        </div>

        <!-- 2. ថ្នាក់ (Class / Timetable - Blue) -->
        <div class="trainee-hub-card card-blue" onclick="openTraineeTimetableModal()">
          <div class="hub-card-pattern"></div>
          <div class="hub-card-icon"><i class="fas fa-globe"></i></div>
          <div class="hub-card-title">ថ្នាក់</div>
          <div class="hub-card-sub">កាលវិភាគសិក្សា</div>
        </div>

        <!-- 3. វីដេអូ (Video Lessons - Orange) -->
        <div class="trainee-hub-card card-orange" onclick="openTraineeLessonsModal()">
          <div class="hub-card-pattern"></div>
          <div class="hub-card-icon"><i class="fas fa-play-circle"></i></div>
          <div class="hub-card-title">វីដេអូ</div>
          <div class="hub-card-sub">មេរៀន E-Learning</div>
        </div>

        <!-- 4. សៀវភៅ (Books / Library - Green) -->
        <div class="trainee-hub-card card-green" onclick="openTraineeLibraryModal()">
          <div class="hub-card-pattern"></div>
          <div class="hub-card-icon"><i class="fas fa-book-open"></i></div>
          <div class="hub-card-title">សៀវភៅ</div>
          <div class="hub-card-sub">បណ្ណាល័យឌីជីថល</div>
        </div>

        <!-- 5. វេទិកា (Forum / Requests - Amber) -->
        <div class="trainee-hub-card card-amber" onclick="openTraineeForumModal()">
          <div class="hub-card-pattern"></div>
          <div class="hub-card-icon"><i class="fas fa-comment-dots"></i></div>
          <div class="hub-card-title">វេទិកា</div>
          <div class="hub-card-sub">ពិភាក្សា & សំណើ</div>
        </div>

        <!-- 6. របាយការណ៍ (Score Reports - Purple) -->
        <div class="trainee-hub-card card-purple" onclick="openTraineeReportsModal()">
          <div class="hub-card-pattern"></div>
          <div class="hub-card-icon"><i class="fas fa-chart-line"></i></div>
          <div class="hub-card-title">របាយការណ៍</div>
          <div class="hub-card-sub">លទ្ធផលពិន្ទុ & និទ្ទេស</div>
        </div>

        <!-- 7. កិច្ចព្រមព្រៀង (Practicum & Guidelines - Teal) -->
        <div class="trainee-hub-card card-teal" onclick="openTraineeGuidelinesModal()">
          <div class="hub-card-pattern"></div>
          <div class="hub-card-icon"><i class="fas fa-clipboard-check"></i></div>
          <div class="hub-card-title">កិច្ចព្រមព្រៀង</div>
          <div class="hub-card-sub">កម្មសិក្សា & វិន័យ</div>
        </div>

        <!-- 8. ផែនការ (Study Plan & Attendance - Sky) -->
        <div class="trainee-hub-card card-sky" onclick="openTraineeAttendanceModal()">
          <div class="hub-card-pattern"></div>
          <div class="hub-card-icon"><i class="fas fa-calendar-alt"></i></div>
          <div class="hub-card-title">ផែនការ</div>
          <div class="hub-card-sub">វត្តមានផ្ទាល់ខ្លួន</div>
        </div>

      </div>

      <!-- 3. Blue Ribbon Strip & Course Row -->
      <div class="trainee-subjects-section" id="traineeSubjectsSection">
        
        <div class="trainee-ribbon-bar">
          <button class="ribbon-arrow-btn" onclick="prevTraineeSemester()" title="ឆមាសមុន">
            <i class="fas fa-chevron-left"></i>
          </button>
          <div class="ribbon-title">
            <i class="fas fa-bookmark" style="opacity:0.9;"></i>
            <span>${activeStream.label}</span>
          </div>
          <button class="ribbon-arrow-btn" onclick="nextTraineeSemester()" title="ឆមាសបន្ទាប់">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>

        <div class="trainee-subjects-body">
          <div class="trainee-subjects-grid">
            ${subjectsHtml}
          </div>
        </div>

      </div>

      <!-- 4. Trainee Real Stats & Academic Overview -->
      <div class="trainee-stats-row">
        
        <!-- My Attendance Summary -->
        <div class="table-card">
          <div class="table-toolbar">
            <strong style="color:#1e3a8a;"><i class="fas fa-calendar-check" style="color:#10b981;"></i> វត្តមានផ្ទាល់ខ្លួន</strong>
            <button class="btn btn-outline" style="height:28px; padding:0 10px; font-size:0.75rem;" onclick="openTraineeAttendanceModal()">ពិនិត្យលម្អិត →</button>
          </div>
          <div style="padding:22px;">
            <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:14px;">
              <span style="font-size:2.4rem; font-weight:800; color:#10b981; line-height:1;">
                ${t.attendanceSummary?.rate || 100}%
              </span>
              <span style="font-size:0.85rem; color:#64748b; font-weight:600;">អត្រាវត្តមានសរុប (គោលដៅ ≥ ៨០%)</span>
            </div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; text-align:center; font-size:0.82rem;">
              <div style="background:#f0fdf4; padding:10px 6px; border-radius:8px; border:1px solid #bbf7d0;">
                <div style="font-weight:800; color:#15803d; font-size:1.15rem;">${t.attendanceSummary?.present || 0}</div>
                <div style="color:#166534; font-size:0.75rem; font-weight:600;">វត្តមាន</div>
              </div>
              <div style="background:#fffbeb; padding:10px 6px; border-radius:8px; border:1px solid #fde68a;">
                <div style="font-weight:800; color:#b45309; font-size:1.15rem;">${t.attendanceSummary?.permission || 0}</div>
                <div style="color:#92400e; font-size:0.75rem; font-weight:600;">ច្បាប់</div>
              </div>
              <div style="background:#fff7ed; padding:10px 6px; border-radius:8px; border:1px solid #fed7aa;">
                <div style="font-weight:800; color:#c2410c; font-size:1.15rem;">${t.attendanceSummary?.late || 0}</div>
                <div style="color:#9a3412; font-size:0.75rem; font-weight:600;">យឺត</div>
              </div>
              <div style="background:#fef2f2; padding:10px 6px; border-radius:8px; border:1px solid #fecaca;">
                <div style="font-weight:800; color:#b91c1c; font-size:1.15rem;">${t.attendanceSummary?.absent || 0}</div>
                <div style="color:#991b1b; font-size:0.75rem; font-weight:600;">ឥតច្បាប់</div>
              </div>
            </div>
          </div>
        </div>

        <!-- My Grades Summary -->
        <div class="table-card">
          <div class="table-toolbar">
            <strong style="color:#1e3a8a;"><i class="fas fa-award" style="color:#7c3aed;"></i> លទ្ធផលពិន្ទុ & និទ្ទេសផ្លូវការ</strong>
            <button class="btn btn-outline" style="height:28px; padding:0 10px; font-size:0.75rem;" onclick="openTraineeReportsModal()">ពិនិត្យលម្អិត →</button>
          </div>
          <div style="padding:20px;">
            <p style="font-size:0.83rem; color:#64748b; margin-bottom:12px;">
              ពិន្ទុដែលត្រូវបានផ្សព្វផ្សាយជាផ្លូវការដោយការិយាល័យសិក្សាធិការ KTPTTC៖
            </p>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${Object.keys(t.scores || {}).map(code => {
                const sc = t.scores[code];
                if (sc.status !== 'published') return '';
                const subj = subjects.find(s => s.code === code);
                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:8px 12px; border-radius:8px; font-size:0.85rem; border:1px solid rgba(0,0,0,0.04);">
                    <div style="display:flex; align-items:center; gap:8px;">
                      <i class="fas fa-check-circle" style="color:#10b981; font-size:0.85rem;"></i>
                      <span style="font-weight:600; color:#1e293b;">${subj?.nameKh || code}</span>
                    </div>
                    <strong>${sc.total} / 100 <span class="badge ${sc.grade==='A'?'badge-present':'badge-published'}" style="margin-left:6px;">${sc.grade}</span></strong>
                  </div>
                `;
              }).join('') || '<div style="color:#94a3b8; font-size:0.85rem; padding:12px; text-align:center;">មិនទាន់មានពិន្ទុត្រូវបានផ្សព្វផ្សាយនៅឡើយទេ។</div>'}
            </div>
          </div>
        </div>

      </div>

    </div>
  `;

  container.innerHTML = html;
}

// --------------------------------------------------------------------------
// 1. HUB MODAL: មុខវិជ្ជា (CURRICULUM & SUBJECTS CATALOG)
// --------------------------------------------------------------------------
function openTraineeSubjectsModal() {
  const activeStream = TRAINEE_STREAMS[currentStreamIndex];
  const subjects = KTPTTC_ALL_SUBJECTS;

  let modalHtml = `
    <div class="stms-modal-backdrop" id="traineeSubjectsModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-dialog" style="max-width:760px;">
        <div class="stms-modal-header" style="background:linear-gradient(135deg, #be185d 0%, #db2777 100%); color:#ffffff;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:10px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.25rem;">
              <i class="fas fa-chalkboard-teacher"></i>
            </div>
            <div>
              <h3 style="color:#ffffff; font-size:1.15rem; margin:0;">មុខវិជ្ជា & កម្មវិធីសិក្សាគរុកោសល្យ</h3>
              <p style="color:#fbcfe8; font-size:0.82rem; margin:2px 0 0 0;">${activeStream.label} • សរុប ៨ មុខវិជ្ជា (២១ ក្រេឌីត)</p>
            </div>
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()" style="color:#ffffff;">&times;</button>
        </div>
        <div class="stms-modal-body" style="padding:22px; max-height:75vh; overflow-y:auto;">
          
          <div style="margin-bottom:16px; display:flex; gap:10px;">
            <input type="text" id="subjectFilterInput" class="form-input" placeholder="🔍 ស្វែងរកមុខវិជ្ជា ឬឈ្មោះគ្រូឧទ្ទេស..." oninput="filterSubjectCatalog(this.value)">
          </div>

          <div id="subjectCatalogList" style="display:grid; grid-template-columns: 1fr 1fr; gap:14px;">
            ${subjects.map(s => {
              const th = getSubjectTheme(s.code);
              return `
                <div class="subject-item-box" style="background:#ffffff; border:1px solid ${th.border}; border-radius:12px; padding:14px; display:flex; flex-direction:column; gap:8px; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
                  <div style="display:flex; align-items:center; justify-content:space-between;">
                    <span style="font-size:0.75rem; font-weight:700; color:${th.color}; background:${th.bg}; padding:3px 8px; border-radius:6px;">${s.code}</span>
                    <span style="font-size:0.78rem; font-weight:600; color:#64748b;">${s.credits} ក្រេឌីត</span>
                  </div>
                  <h4 style="margin:0; font-size:0.92rem; color:#1e293b; line-height:1.4;">${s.nameKh}</h4>
                  <div style="font-size:0.78rem; color:#64748b; margin-top:auto; display:flex; justify-content:space-between; align-items:center;">
                    <span>👨‍🏫 ${s.trainer}</span>
                    <button class="btn btn-outline" style="height:26px; padding:0 8px; font-size:0.74rem;" onclick="closeStmsModal(); openSubjectDetailModal('${s.code}');">លម្អិត →</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div style="margin-top:20px; display:flex; justify-content:flex-end;">
            <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
          </div>

        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modalHtml;
}

function filterSubjectCatalog(query) {
  const q = (query || '').toLowerCase().trim();
  const items = document.querySelectorAll('#subjectCatalogList .subject-item-box');
  items.forEach(el => {
    const text = el.textContent.toLowerCase();
    el.style.display = text.includes(q) ? 'flex' : 'none';
  });
}

// --------------------------------------------------------------------------
// 2. HUB MODAL: ថ្នាក់ & កាលវិភាគសិក្សា (CLASS & TIMETABLE)
// --------------------------------------------------------------------------
function openTraineeTimetableModal() {
  const activeStream = TRAINEE_STREAMS[currentStreamIndex];

  let modalHtml = `
    <div class="stms-modal-backdrop" id="traineeTimetableModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-dialog" style="max-width:820px;">
        <div class="stms-modal-header" style="background:linear-gradient(135deg, #0369a1 0%, #0284c7 100%); color:#ffffff;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:10px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.25rem;">
              <i class="fas fa-calendar-alt"></i>
            </div>
            <div>
              <h3 style="color:#ffffff; font-size:1.15rem; margin:0;">កាលវិភាគសិក្សាប្រចាំសប្តាហ៍</h3>
              <p style="color:#e0f2fe; font-size:0.82rem; margin:2px 0 0 0;">${activeStream.label} • បន្ទប់ ១០១ & បន្ទប់កុំព្យូទ័រ KTPTTC</p>
            </div>
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()" style="color:#ffffff;">&times;</button>
        </div>
        <div class="stms-modal-body" style="padding:22px; max-height:75vh; overflow-y:auto;">
          
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
            <div style="font-size:0.86rem; color:#334155;">
              <span style="font-weight:700; color:#1e3a8a;">ម៉ោងសិក្សា៖</span> ពេលព្រឹក (០៧:៣០ - ១១:០០) • ពេលរសៀល (១៣:៣០ - ១៧:០០)
            </div>
            <button class="btn btn-primary" onclick="showToast('កំពុងរៀបចំទម្រង់បោះពុម្ពកាលវិភាគ...', 'info'); setTimeout(()=>window.print(), 300);">
              <i class="fas fa-print"></i> បោះពុម្ពកាលវិភាគ
            </button>
          </div>

          <div class="data-table-responsive" style="border:1px solid var(--border-color); border-radius:10px; overflow:hidden;">
            <table class="stms-table" style="font-size:0.85rem;">
              <thead style="background:#f1f5f9;">
                <tr>
                  <th style="width:100px;">ថ្ងៃ</th>
                  <th style="width:140px;">ម៉ោង</th>
                  <th>មុខវិជ្ជាគរុកោសល្យ</th>
                  <th>គ្រូឧទ្ទេសទទួលបន្ទុក</th>
                  <th>បន្ទប់រៀន</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td rowspan="2" style="font-weight:700; background:#f8fafc; vertical-align:middle; text-align:center;">ចន្ទ</td>
                  <td>07:30 - 09:00</td>
                  <td><strong>គរុកោសល្យទូទៅ និងវិធីសាស្ត្របង្រៀន</strong></td>
                  <td>សាស្ត្រាចារ្យ ហេង សំណាង</td>
                  <td><span class="badge badge-published">បន្ទប់ ១០១</span></td>
                </tr>
                <tr>
                  <td>09:15 - 10:45</td>
                  <td><strong>វិធីសាស្ត្របង្រៀនភាសាខ្មែរ និងអំណានដំបូង</strong></td>
                  <td>លោកស្រី ជា រចនា</td>
                  <td><span class="badge badge-published">បន្ទប់ ១០១</span></td>
                </tr>

                <tr>
                  <td rowspan="2" style="font-weight:700; background:#f8fafc; vertical-align:middle; text-align:center;">អង្គារ</td>
                  <td>07:30 - 09:00</td>
                  <td><strong>វិធីសាស្ត្របង្រៀនគណិតវិទ្យាបឋម</strong></td>
                  <td>លោកគ្រូ យឹម វណ្ណា</td>
                  <td><span class="badge badge-published">បន្ទប់ ១០១</span></td>
                </tr>
                <tr>
                  <td>09:15 - 10:45</td>
                  <td><strong>បច្ចេកវិទ្យាព័ត៌មានក្នុងការអប់រំ (ICT)</strong></td>
                  <td>លោកគ្រូ ស៊ុយ សូលីដា</td>
                  <td><span class="badge badge-present">បន្ទប់កុំព្យូទ័រ</span></td>
                </tr>

                <tr>
                  <td rowspan="2" style="font-weight:700; background:#f8fafc; vertical-align:middle; text-align:center;">ពុធ</td>
                  <td>07:30 - 09:00</td>
                  <td><strong>ចិត្តវិទ្យាគរុកោសល្យ និងការអភិវឌ្ឍកុមារ</strong></td>
                  <td>លោកស្រី ម៉ៅ សុភា</td>
                  <td><span class="badge badge-published">បន្ទប់ ១០១</span></td>
                </tr>
                <tr>
                  <td>13:30 - 15:00</td>
                  <td><strong>ការស្រាវជ្រាវសកម្មភាពក្នុងថ្នាក់រៀន (Action Research)</strong></td>
                  <td>សាស្ត្រាចារ្យ ហេង សំណាង</td>
                  <td><span class="badge badge-published">បន្ទប់ ១០១</span></td>
                </tr>

                <tr>
                  <td rowspan="2" style="font-weight:700; background:#f8fafc; vertical-align:middle; text-align:center;">ព្រហស្បតិ៍</td>
                  <td>07:30 - 09:00</td>
                  <td><strong>បច្ចេកវិទ្យាព័ត៌មានវិទ្យា និងសារគមនាគមន៍</strong></td>
                  <td>លោកគ្រូ ស៊ុយ សូលីដា</td>
                  <td><span class="badge badge-present">បន្ទប់កុំព្យូទ័រ</span></td>
                </tr>
                <tr>
                  <td>09:15 - 10:45</td>
                  <td><strong>គរុកោសល្យទូទៅ (អនុវត្តវិធីសាស្ត្របង្រៀន)</strong></td>
                  <td>សាស្ត្រាចារ្យ ហេង សំណាង</td>
                  <td><span class="badge badge-published">បន្ទប់ ១០១</span></td>
                </tr>

                <tr>
                  <td rowspan="2" style="font-weight:700; background:#f8fafc; vertical-align:middle; text-align:center;">សុក្រ</td>
                  <td>07:30 - 10:30</td>
                  <td><strong>ការចុះកម្មសិក្សាគរុកោសល្យនៅសាលាបឋម (Practicum)</strong></td>
                  <td>លោកគ្រូ យឹម វណ្ណា</td>
                  <td><span class="badge badge-late">សាលាបឋមអនុវត្តន៍</span></td>
                </tr>
                <tr>
                  <td>14:00 - 16:30</td>
                  <td><strong>សិក្ខាសាលាឆ្លុះបញ្ចាំងគរុកោសល្យ និងតាក់តែងកិច្ចតែងការ</strong></td>
                  <td>ក្រុមគ្រូឧទ្ទេស KTPTTC</td>
                  <td><span class="badge badge-published">សាលប្រជុំធំ</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="margin-top:20px; display:flex; justify-content:flex-end;">
            <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
          </div>

        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modalHtml;
}

// --------------------------------------------------------------------------
// 3. HUB MODAL: វីដេអូ & មេរៀន E-LEARNING (PEDAGOGICAL VIDEO HUB)
// --------------------------------------------------------------------------
const KTPTTC_VIDEO_LESSONS = [
  { id: "VID-01", subject: "KHM-104", category: "ភាសាខ្មែរ", title: "បច្ចេកទេសបង្រៀនអំណានដំបូងតាមវិធីសាស្ត្រសូរសំឡេង (Phonics)", trainer: "លោកស្រី ជា រចនា", duration: "៣៥ នាទី", views: 248, desc: "វិធីសាស្ត្របង្រៀនព្យញ្ជនៈ ស្រៈ និងការប្រកបពាក្យតាមសូរសំឡេងសម្រាប់សិស្សថ្នាក់ទី១ និងទី២។" },
  { id: "VID-02", subject: "MTH-103", category: "គណិតវិទ្យា", title: "ការអនុវត្តកិច្ចតែងការបង្រៀនគណិតវិទ្យាថ្នាក់ទី ១ ដល់ទី ៣", trainer: "លោកគ្រូ យឹម វណ្ណា", duration: "៤២ នាទី", views: 310, desc: "ការប្រើប្រាស់ឧបករណ៍រូបវន្ត (Manipulatives) ដើម្បីពន្យល់ពីគោលគំនិតបូកដក និងប្រមាណវិធីគណិតវិទ្យា។" },
  { id: "VID-03", subject: "PED-101", category: "គរុកោសល្យ", title: "ការបង្កើត និងប្រើប្រាស់ឧបករណ៍បង្រៀនពីវត្ថុធាតុក្នុងមូលដ្ឋាន", trainer: "សាស្ត្រាចារ្យ ហេង សំណាង", duration: "២៨ នាទី", views: 420, desc: "ការកែច្នៃសម្ភារក្នុងស្រុកសម្រាប់បម្រើឱ្យសកម្មភាពបង្រៀនសកម្មបែបសន្សំសំចៃ និងមានប្រសិទ្ធភាព។" },
  { id: "VID-04", subject: "ICT-105", category: "ICT", title: "ការប្រើប្រាស់ ICT និងស្លាយបង្រៀនអន្តរកម្មក្នុងថ្នាក់បឋម", trainer: "លោកគ្រូ ស៊ុយ សូលីដា", duration: "៣០ នាទី", views: 195, desc: "ការប្រើប្រាស់ Canva, Google Slides និង PowerPoint ដើម្បីបង្កើតស្លាយបង្រៀនរស់រវើក។" },
  { id: "VID-05", subject: "PSY-102", category: "ចិត្តវិទ្យា", title: "ចិត្តវិទ្យាគរុកោសល្យ និងការគ្រប់គ្រងថ្នាក់រៀនបែបវិជ្ជមាន", trainer: "លោកស្រី ម៉ៅ សុភា", duration: "៣៨ នាទី", views: 275, desc: "ការដោះស្រាយអាកប្បកិរិយារបស់កុមារ និងការលើកទឹកចិត្តឱ្យសិស្សចូលរួមសកម្មភាពដោយភាពរីករាយ។" },
  { id: "VID-06", subject: "RES-106", category: "ការស្រាវជ្រាវ", title: "វិធីសាស្ត្រធ្វើការស្រាវជ្រាវសកម្មភាពក្នុងថ្នាក់រៀន (Action Research)", trainer: "សាស្ត្រាចារ្យ ហេង សំណាង", duration: "៤៥ នាទី", views: 180, desc: "ជំហានក្នុងការកំណត់បញ្ហា ការប្រមូលទិន្នន័យ និងការកែលម្អការបង្រៀនជាប្រចាំ។" }
];

function openTraineeLessonsModal(activeCategory = 'all') {
  const filtered = activeCategory === 'all' 
    ? KTPTTC_VIDEO_LESSONS 
    : KTPTTC_VIDEO_LESSONS.filter(v => v.category === activeCategory);

  let modalHtml = `
    <div class="stms-modal-backdrop" id="traineeLessonsModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-dialog" style="max-width:760px;">
        <div class="stms-modal-header" style="background:linear-gradient(135deg, #c2410c 0%, #ea580c 100%); color:#ffffff;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:10px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.25rem;">
              <i class="fas fa-play-circle"></i>
            </div>
            <div>
              <h3 style="color:#ffffff; font-size:1.15rem; margin:0;">វីដេអូ & មេរៀន E-Learning គរុកោសល្យ</h3>
              <p style="color:#ffedd5; font-size:0.82rem; margin:2px 0 0 0;">កម្រងវីដេអូបង្រៀនគំរូ និងស្លាយបង្រៀនឌីជីថល KTPTTC</p>
            </div>
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()" style="color:#ffffff;">&times;</button>
        </div>
        <div class="stms-modal-body" style="padding:22px; max-height:75vh; overflow-y:auto;">
          
          <!-- Category Tabs -->
          <div class="stms-modal-tabs">
            <button class="modal-tab-btn ${activeCategory==='all'?'active':''}" onclick="openTraineeLessonsModal('all')">ទាំងអស់</button>
            <button class="modal-tab-btn ${activeCategory==='គរុកោសល្យ'?'active':''}" onclick="openTraineeLessonsModal('គរុកោសល្យ')">គរុកោសល្យ</button>
            <button class="modal-tab-btn ${activeCategory==='ភាសាខ្មែរ'?'active':''}" onclick="openTraineeLessonsModal('ភាសាខ្មែរ')">ភាសាខ្មែរ</button>
            <button class="modal-tab-btn ${activeCategory==='គណិតវិទ្យា'?'active':''}" onclick="openTraineeLessonsModal('គណិតវិទ្យា')">គណិតវិទ្យា</button>
            <button class="modal-tab-btn ${activeCategory==='ICT'?'active':''}" onclick="openTraineeLessonsModal('ICT')">ICT</button>
            <button class="modal-tab-btn ${activeCategory==='ការស្រាវជ្រាវ'?'active':''}" onclick="openTraineeLessonsModal('ការស្រាវជ្រាវ')">ការស្រាវជ្រាវ</button>
          </div>

          <div style="display:flex; flex-direction:column; gap:12px;">
            ${filtered.map(v => `
              <div style="display:flex; gap:16px; background:#ffffff; border:1px solid var(--border-color); border-radius:12px; padding:14px; align-items:center; transition:all 0.2s;" onmouseover="this.style.borderColor='#fdba74'" onmouseout="this.style.borderColor='var(--border-color)'">
                <div style="width:96px; height:68px; border-radius:10px; background:linear-gradient(135deg, #09204a 0%, #1e3a8a 100%); display:flex; align-items:center; justify-content:center; color:#ffffff; flex-shrink:0; position:relative; cursor:pointer;" onclick="playTraineeVideo('${v.id}')">
                  <i class="fas fa-play" style="font-size:1.4rem; color:#f97316;"></i>
                  <span style="position:absolute; bottom:4px; right:6px; font-size:0.65rem; background:rgba(0,0,0,0.7); padding:1px 5px; border-radius:4px;">${v.duration}</span>
                </div>
                <div style="flex:1;">
                  <span style="font-size:0.72rem; font-weight:700; color:#ea580c; background:#fff7ed; padding:2px 8px; border-radius:6px;">${v.category}</span>
                  <h4 style="margin:4px 0 3px 0; font-size:0.92rem; color:#1e293b; line-height:1.4; cursor:pointer;" onclick="playTraineeVideo('${v.id}')">${v.title}</h4>
                  <p style="margin:0 0 4px 0; font-size:0.78rem; color:#64748b; line-height:1.4;">${v.desc}</p>
                  <div style="font-size:0.75rem; color:#94a3b8; display:flex; gap:12px;">
                    <span>👨‍🏫 ${v.trainer}</span>
                    <span>👁️ ${v.views} នាក់បានទស្សនា</span>
                  </div>
                </div>
                <button class="btn btn-primary" style="height:34px; padding:0 14px; font-size:0.82rem;" onclick="playTraineeVideo('${v.id}')">
                  <i class="fas fa-play"></i> ទស្សនា
                </button>
              </div>
            `).join('')}
          </div>

          <div style="margin-top:20px; display:flex; justify-content:flex-end;">
            <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
          </div>

        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modalHtml;
}

function playTraineeVideo(id) {
  const v = KTPTTC_VIDEO_LESSONS.find(item => item.id === id) || KTPTTC_VIDEO_LESSONS[0];

  let modalHtml = `
    <div class="stms-modal-backdrop" id="videoPlayerModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-dialog" style="max-width:760px;">
        <div class="stms-modal-header" style="background:#09204a; color:#ffffff;">
          <div style="display:flex; align-items:center; gap:12px;">
            <i class="fas fa-play-circle" style="color:#ea580c; font-size:1.3rem;"></i>
            <h3 style="color:#ffffff; font-size:1.05rem; margin:0;">${v.title}</h3>
          </div>
          <button class="modal-close-icon" onclick="openTraineeLessonsModal()" style="color:#ffffff;">&times;</button>
        </div>
        <div class="stms-modal-body" style="padding:20px;">
          
          <!-- Mock HTML5 Video Player -->
          <div class="stms-video-player-wrap">
            <div class="video-screen-mock">
              <div class="video-play-big-btn" onclick="showToast('កំពុងចាក់វីដេអូមេរៀន...', 'success')">
                <i class="fas fa-play"></i>
              </div>
              <h4 style="color:#ffffff; margin:0 0 6px 0; font-size:1rem;">${v.title}</h4>
              <p style="color:#cbd5e1; font-size:0.82rem; margin:0;">គ្រូឧទ្ទេស៖ ${v.trainer} • រយៈពេល ${v.duration}</p>
            </div>
            <div class="video-player-bar">
              <i class="fas fa-play" style="cursor:pointer;" onclick="showToast('ចាក់/ផ្អាកវីដេអូ', 'info')"></i>
              <div class="video-prog-track" onclick="showToast('បានរំកិលម៉ោងវីដេអូ', 'info')">
                <div class="video-prog-fill"></div>
              </div>
              <span>12:15 / ${v.duration}</span>
              <i class="fas fa-volume-up" style="cursor:pointer;"></i>
              <i class="fas fa-expand" style="cursor:pointer;" onclick="showToast('បើកពេញអេក្រង់', 'info')"></i>
            </div>
          </div>

          <!-- Video Details & Actions -->
          <div style="background:#f8fafc; border-radius:10px; padding:16px; border:1px solid var(--border-color); margin-bottom:16px;">
            <h4 style="font-size:0.92rem; color:#1e3a8a; margin-bottom:8px;"><i class="fas fa-info-circle"></i> ខ្លឹមសារសង្ខេបនៃមេរៀន</h4>
            <p style="font-size:0.86rem; color:#334155; line-height:1.6; margin:0 0 12px 0;">${v.desc}</p>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-outline" style="font-size:0.8rem;" onclick="showToast('បានទាញយកស្លាយបង្រៀន (PowerPoint) ដោយជោគជ័យ!', 'success')">
                <i class="fas fa-file-powerpoint" style="color:#ea580c;"></i> ទាញយកស្លាយបង្រៀន (PPTX)
              </button>
              <button class="btn btn-outline" style="font-size:0.8rem;" onclick="showToast('បានទាញយកកម្រងលំហាត់ (PDF) ដោយជោគជ័យ!', 'success')">
                <i class="fas fa-file-pdf" style="color:#e11d48;"></i> ទាញយកឯកសារជំនួយ (PDF)
              </button>
            </div>
          </div>

          <!-- Knowledge Check Quiz -->
          <div style="border:1px solid #fed7aa; background:#fff7ed; border-radius:10px; padding:14px;">
            <h5 style="color:#c2410c; margin:0 0 8px 0; font-size:0.88rem;"><i class="fas fa-question-circle"></i> សំណួរស្វ័យវាយតម្លៃបន្ទាប់ពីទស្សនា</h5>
            <p style="font-size:0.84rem; color:#431407; margin-bottom:10px;">តើជំហានដំបូងនៃវិធីសាស្ត្រសូរសំឡេង គឺត្រូវបង្រៀនអ្វីដល់សិស្ស?</p>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <button class="btn btn-outline" style="background:#ffffff; justify-content:flex-start; font-size:0.82rem; height:auto; padding:8px 12px;" onclick="showToast('សូមព្យាយាមម្តងទៀត!', 'warning')">
                ក. ការអានអត្ថបទវែងៗភ្លាមៗ
              </button>
              <button class="btn btn-outline" style="background:#ffffff; justify-content:flex-start; font-size:0.82rem; height:auto; padding:8px 12px;" onclick="showToast('ចម្លើយត្រឹមត្រូវ! ទទួលពិន្ទុពេញ ១០/១០ 🎉', 'success')">
                ខ. ការស្គាល់សូរ និងរូបរាងនៃព្យញ្ជនៈ និងស្រៈ (Phonemic Awareness)
              </button>
            </div>
          </div>

          <div style="margin-top:18px; display:flex; justify-content:space-between;">
            <button class="btn btn-outline" onclick="openTraineeLessonsModal()">← ត្រឡប់ទៅបញ្ជីវីដេអូ</button>
            <button class="btn btn-primary" onclick="closeStmsModal()">រួចរាល់</button>
          </div>

        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modalHtml;
}

// --------------------------------------------------------------------------
// 4. HUB MODAL: សៀវភៅ & បណ្ណាល័យឌីជីថល (DIGITAL LIBRARY KTPTTC)
// --------------------------------------------------------------------------
const KTPTTC_DIGITAL_BOOKS = [
  { id: "BK-01", category: "សៀវភៅគរុកោសល្យ", title: "សៀវភៅគរុកោសល្យទូទៅសម្រាប់គរុសិស្សបឋម ១២+២", author: "ក្រសួងអប់រំ យុវជន និងកីឡា (MoEYS)", pages: 240, size: "14.5 MB", previewText: "មាតិកា៖ ជំពូកទី ១ ទ្រឹស្ដីនៃការបង្រៀន និងរៀន, ជំពូកទី ២ ការរៀបចំកិច្ចតែងការបង្រៀន, ជំពូកទី ៣ ការគ្រប់គ្រងថ្នាក់រៀនបែបស្ថាបនានិយម..." },
  { id: "BK-02", category: "សៀវភៅណែនាំគ្រូ", title: "សៀវភៅណែនាំគ្រូបង្រៀនភាសាខ្មែរ ថ្នាក់ទី ១ ដល់ទី ៦", author: "នាយកដ្ឋានអភិវឌ្ឍកម្មវិធីសិក្សា", pages: 310, size: "18.2 MB", previewText: "គោលបំណង៖ ណែនាំអំពីវិធីសាស្ត្របង្រៀនអំណានដំបូង ការសរសេរតាមអាន និងការយល់ដឹងពីអត្ថបទ..." },
  { id: "BK-03", category: "សៀវភៅគោល", title: "វិធីសាស្ត្របង្រៀនគណិតវិទ្យាបឋមសិក្សា (STEM Edition)", author: "គណៈកម្មការគណិតវិទ្យា KTPTTC", pages: 185, size: "12.0 MB", previewText: "ការបង្រៀនប្រមាណវិធីគណិតវិទ្យា ការដោះស្រាយចំណោទ និងការប្រើប្រាស់ឧបករណ៍បង្រៀនអន្តរកម្ម..." },
  { id: "BK-04", category: "សៀវភៅគរុកោសល្យ", title: "ចិត្តវិទ្យាគរុកោសល្យ និងការគ្រប់គ្រងថ្នាក់រៀនបែបវិជ្ជមាន", author: "វិទ្យាស្ថានជាតិអប់រំ (NIE)", pages: 215, size: "16.1 MB", previewText: "ទ្រឹស្ដីនៃការលូតលាស់របស់កុមារ ការលើកទឹកចិត្ត និងដំណោះស្រាយចំពោះវិបត្តិអាកប្បកិរិយាក្នុងថ្នាក់..." },
  { id: "BK-05", category: "ICT & បច្ចេកវិទ្យា", title: "សៀវភៅណែនាំការប្រើប្រាស់ ICT ក្នុងការបង្រៀនបឋមសិក្សា", author: "នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន MoEYS", pages: 160, size: "11.8 MB", previewText: "ការទាញយកប្រយោជន៍ពីឧបករណ៍បច្ចេកវិទ្យា កម្មវិធីបង្រៀនអន្តរកម្ម និងការបង្កើតមេរៀនពហុព័ត៌មាន..." },
  { id: "BK-06", category: "ការស្រាវជ្រាវ", title: "កម្រងប្រធានបទស្រាវជ្រាវសកម្មភាពក្នុងថ្នាក់រៀន (Action Research Toolkit)", author: "ការិយាល័យស្រាវជ្រាវ KTPTTC", pages: 140, size: "9.5 MB", previewText: "គំរូនៃរបាយការណ៍ស្រាវជ្រាវសកម្មភាព ឧបករណ៍វាស់វែង និងករណីសិក្សានៅសាលាបឋមអនុវត្តន៍..." }
];

function openTraineeLibraryModal() {
  let modalHtml = `
    <div class="stms-modal-backdrop" id="traineeLibraryModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-dialog" style="max-width:780px;">
        <div class="stms-modal-header" style="background:linear-gradient(135deg, #15803d 0%, #16a34a 100%); color:#ffffff;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:10px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.25rem;">
              <i class="fas fa-book-open"></i>
            </div>
            <div>
              <h3 style="color:#ffffff; font-size:1.15rem; margin:0;">បណ្ណាល័យឌីជីថលគរុកោសល្យ (Digital Library KTPTTC)</h3>
              <p style="color:#bbf7d0; font-size:0.82rem; margin:2px 0 0 0;">កម្រងសៀវភៅគរុកោសល្យ សៀវភៅសិក្សាគោល និងឯកសារស្រាវជ្រាវ MoEYS</p>
            </div>
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()" style="color:#ffffff;">&times;</button>
        </div>
        <div class="stms-modal-body" style="padding:22px; max-height:75vh; overflow-y:auto;">
          
          <div style="margin-bottom:16px;">
            <input type="text" class="form-input" placeholder="🔍 ស្វែងរកចំណងជើងសៀវភៅ អ្នកនិពន្ធ ឬមុខវិជ្ជា..." oninput="filterDigitalBooks(this.value)">
          </div>

          <div id="digitalBookList" style="display:flex; flex-direction:column; gap:12px;">
            ${KTPTTC_DIGITAL_BOOKS.map(b => `
              <div class="book-card-item" style="display:flex; gap:16px; background:#ffffff; border:1px solid var(--border-color); border-radius:12px; padding:14px; align-items:center; box-shadow:0 2px 6px rgba(0,0,0,0.02);">
                <div style="width:58px; height:74px; border-radius:8px; background:linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); display:flex; align-items:center; justify-content:center; color:#15803d; font-size:1.8rem; flex-shrink:0; border:1px solid #86efac;">
                  <i class="fas fa-book"></i>
                </div>
                <div style="flex:1;">
                  <span style="font-size:0.72rem; font-weight:700; color:#16a34a; background:#f0fdf4; padding:2px 8px; border-radius:6px;">${b.category}</span>
                  <h4 style="margin:4px 0 3px 0; font-size:0.92rem; color:#1e293b; line-height:1.4;">${b.title}</h4>
                  <p style="margin:0 0 4px 0; font-size:0.78rem; color:#64748b;">${b.author} • ${b.pages} ទំព័រ • ទំហំ ${b.size}</p>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  <button class="btn btn-outline" style="height:32px; padding:0 12px; font-size:0.78rem;" onclick="readTraineeBook('${b.id}')">
                    <i class="fas fa-eye"></i> អានអនឡាញ
                  </button>
                  <button class="btn btn-primary" style="height:32px; padding:0 12px; font-size:0.78rem;" onclick="showToast('បានទាញយកសៀវភៅ «${b.title}» ជា PDF ដោយជោគជ័យ!', 'success')">
                    <i class="fas fa-file-pdf"></i> ទាញយក
                  </button>
                </div>
              </div>
            `).join('')}
          </div>

          <div style="margin-top:20px; display:flex; justify-content:flex-end;">
            <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
          </div>

        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modalHtml;
}

function filterDigitalBooks(q) {
  const query = (q || '').toLowerCase().trim();
  document.querySelectorAll('#digitalBookList .book-card-item').forEach(el => {
    el.style.display = el.textContent.toLowerCase().includes(query) ? 'flex' : 'none';
  });
}

function readTraineeBook(id) {
  const b = KTPTTC_DIGITAL_BOOKS.find(item => item.id === id) || KTPTTC_DIGITAL_BOOKS[0];

  let modalHtml = `
    <div class="stms-modal-backdrop" id="bookReaderModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-dialog" style="max-width:780px;">
        <div class="stms-modal-header" style="background:#166534; color:#ffffff;">
          <div style="display:flex; align-items:center; gap:12px;">
            <i class="fas fa-book-open" style="font-size:1.3rem;"></i>
            <div>
              <h3 style="color:#ffffff; font-size:1.05rem; margin:0;">${b.title}</h3>
              <p style="color:#bbf7d0; font-size:0.78rem; margin:2px 0 0 0;">${b.author} • ${b.pages} ទំព័រ</p>
            </div>
          </div>
          <button class="modal-close-icon" onclick="openTraineeLibraryModal()" style="color:#ffffff;">&times;</button>
        </div>
        <div class="stms-modal-body" style="padding:20px;">
          
          <div class="book-reader-toolbar">
            <span><i class="fas fa-file-alt"></i> ទំព័រទី ១ នៃ ${b.pages}</span>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-outline" style="height:26px; padding:0 8px; font-size:0.75rem;" onclick="showToast('ទំព័រមុន', 'info')">← មុន</button>
              <button class="btn btn-outline" style="height:26px; padding:0 8px; font-size:0.75rem;" onclick="showToast('ទំព័របន្ទាប់', 'info')">បន្ទាប់ →</button>
            </div>
            <button class="btn btn-primary" style="height:26px; padding:0 8px; font-size:0.75rem;" onclick="showToast('បានទាញយកសៀវភៅ PDF ពេញលេញ!', 'success')">
              <i class="fas fa-download"></i> ទាញយក PDF
            </button>
          </div>

          <div class="stms-book-reader">
            <h3 style="text-align:center; color:#1e3a8a; font-family:var(--font-moul); margin-bottom:14px;">${b.title}</h3>
            <p style="text-align:center; font-size:0.85rem; color:#64748b; margin-bottom:20px;">បោះពុម្ព និងផ្សព្វផ្សាយជាផ្លូវការដោយ៖ ${b.author}</p>
            <hr style="border:none; border-top:1px dashed #d4d4d8; margin:16px 0;">
            <h4 style="color:#15803d; font-size:0.95rem; margin-bottom:10px;">អារម្ភកថា</h4>
            <p>
              សៀវភៅនេះត្រូវបានរៀបចំឡើងជាពិសេសសម្រាប់បម្រើឱ្យការបណ្ដុះបណ្ដាលគរុសិស្ស-គរុនិស្សិតនៅសាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ (KTPTTC)។ ខ្លឹមសារត្រូវបានរៀបចំឡើងយ៉ាងក្បោះក្បាយ ស្របតាមក្របខ័ណ្ឌកម្មវិធីសិក្សាស្តង់ដារជាតិរបស់ក្រសួងអប់រំ យុវជន និងកីឡា ដោយផ្តោតសំខាន់លើវិធីសាស្ត្របង្រៀនសកម្មបែបស្ថាបនានិយម (Constructivism) ការគ្រប់គ្រងថ្នាក់រៀន ការប្រើប្រាស់សម្ភារឧបទេស និងការវាស់វែងវាយតម្លៃលទ្ធផលសិក្សារបស់សិស្សបឋមសិក្សា។
            </p>
            <h4 style="color:#15803d; font-size:0.95rem; margin-top:18px; margin-bottom:10px;">មាតិកាសំខាន់ៗនៃជំពូកទី ១</h4>
            <p>
              ${b.previewText}
            </p>
          </div>

          <div style="margin-top:18px; display:flex; justify-content:space-between;">
            <button class="btn btn-outline" onclick="openTraineeLibraryModal()">← ត្រឡប់ទៅបណ្ណាល័យ</button>
            <button class="btn btn-primary" onclick="closeStmsModal()">រួចរាល់</button>
          </div>

        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modalHtml;
}

// --------------------------------------------------------------------------
// 5. HUB MODAL: វេទិកា & សំណើ (DISCUSSION FORUM & REQUESTS)
// --------------------------------------------------------------------------
let KTPTTC_FORUM_POSTS = [
  {
    id: "POST-01",
    author: "យូសុះ ស៊ីលាល",
    role: "គរុសិស្ស",
    avatar: "👨‍🎓",
    time: "២ ម៉ោងមុន",
    category: "វិធីសាស្ត្របង្រៀន",
    title: "តើវិធីសាស្ត្របង្រៀនតាមបែប 5E អនុវត្តយ៉ាងដូចម្តេចក្នុងមុខវិជ្ជាវិទ្យាសាស្ត្របឋម?",
    content: "ខ្ញុំបាទកំពុងរៀបចំកិច្ចតែងការបង្រៀនស្តីពីប្រធានបទ 'វដ្តនៃទឹក'។ តើលោកគ្រូអ្នកគ្រូអាចផ្តល់យោបល់បន្ថែមពីដំណាក់កាល Engage និង Explore បានទេ?",
    replies: [
      { author: "សាស្ត្រាចារ្យ ហេង សំណាង", role: "គ្រូឧទ្ទេស", text: "សម្រាប់ដំណាក់កាល Engage គ្រូអាចចាក់វីដេអូខ្លីពីភ្លៀង ឬយកកែវទឹកកកមកបង្ហាញសិស្ស ដើម្បីឱ្យកុមារសង្កេតឃើញតំណក់ទឹកនៅជញ្ជាំងកែវ!", time: "១ ម៉ោងមុន" }
    ]
  },
  {
    id: "POST-02",
    author: "កែវ សុជាតា",
    role: "គរុសិស្ស",
    avatar: "👩‍🎓",
    time: "១ ថ្ងៃមុន",
    category: "ភាសាខ្មែរ",
    title: "ការរៀបចំកិច្ចតែងការបង្រៀនអំណានដំបូង សម្រាប់សិស្សរៀនយឺត",
    content: "តើមានបច្ចេកទេសអ្វីខ្លះដើម្បីជួយសិស្សដែលពិបាកក្នុងការផ្សំសូរ និងប្រកបពាក្យព្យញ្ជនៈពួក អ និង អ៊?",
    replies: [
      { author: "លោកស្រី ជា រចនា", role: "គ្រូឧទ្ទេស", text: "ត្រូវប្រើកាតអក្សរចល័ត (Letter Cards) និងអនុវត្តការអានជាគូ (Peer Reading) ជារៀងរាល់ព្រឹក។", time: "៥ ម៉ោងមុន" }
    ]
  }
];

function openTraineeForumModal(activeTab = 'forum') {
  let modalHtml = `
    <div class="stms-modal-backdrop" id="traineeForumModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-dialog" style="max-width:780px;">
        <div class="stms-modal-header" style="background:linear-gradient(135deg, #b45309 0%, #d97706 100%); color:#ffffff;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:10px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.25rem;">
              <i class="fas fa-comment-dots"></i>
            </div>
            <div>
              <h3 style="color:#ffffff; font-size:1.15rem; margin:0;">វេទិកាពិភាក្សា & លិខិតស្នើសុំផ្លូវការ</h3>
              <p style="color:#fef3c7; font-size:0.82rem; margin:2px 0 0 0;">ប្រព័ន្ធពិភាក្សាគរុកោសល្យ និងទំនាក់ទំនងរដ្ឋបាល KTPTTC</p>
            </div>
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()" style="color:#ffffff;">&times;</button>
        </div>
        <div class="stms-modal-body" style="padding:22px; max-height:75vh; overflow-y:auto;">
          
          <!-- Forum Tabs -->
          <div class="stms-modal-tabs">
            <button class="modal-tab-btn ${activeTab==='forum'?'active':''}" onclick="openTraineeForumModal('forum')">
              <i class="fas fa-comments"></i> វេទិកាពិភាក្សាគរុកោសល្យ
            </button>
            <button class="modal-tab-btn ${activeTab==='requests'?'active':''}" onclick="openTraineeForumModal('requests')">
              <i class="fas fa-paper-plane"></i> លិខិតស្នើសុំរដ្ឋបាល
            </button>
          </div>

          ${activeTab === 'forum' ? `
            <!-- Forum Tab -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <span style="font-size:0.86rem; color:#64748b; font-weight:600;">ប្រធានបទពិភាក្សាថ្មីៗ៖</span>
              <button class="btn btn-primary" onclick="showNewPostForm()">
                <i class="fas fa-plus"></i> បង្កើតប្រធានបទថ្មី
              </button>
            </div>

            <!-- New Post Box (Hidden by default) -->
            <div id="newPostBox" style="display:none; background:#f8fafc; border:1px solid #cbd5e1; border-radius:12px; padding:16px; margin-bottom:16px;">
              <h5 style="margin:0 0 10px 0; color:#1e3a8a;">បង្កើតសំណួរ ឬប្រធានបទពិភាក្សា</h5>
              <div style="margin-bottom:10px;">
                <input type="text" id="forumPostTitle" class="form-input" placeholder="ចំណងជើងសំណួរ ឬប្រធានបទ..." required>
              </div>
              <div style="margin-bottom:10px;">
                <textarea id="forumPostContent" class="form-input" style="height:70px;" placeholder="សរសេរខ្លឹមសារលម្អិតនៅទីនេះ..." required></textarea>
              </div>
              <div style="display:flex; justify-content:flex-end; gap:8px;">
                <button class="btn btn-outline" onclick="document.getElementById('newPostBox').style.display='none'">បោះបង់</button>
                <button class="btn btn-primary" onclick="submitForumPost()">ចុះផ្សាយ</button>
              </div>
            </div>

            <!-- Posts Stream -->
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${KTPTTC_FORUM_POSTS.map(p => `
                <div class="forum-thread-item">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                      <div style="width:36px; height:36px; border-radius:50%; background:#eff6ff; display:flex; align-items:center; justify-content:center; font-size:1.1rem;">${p.avatar}</div>
                      <div>
                        <div style="font-size:0.86rem; font-weight:700; color:#1e293b;">${p.author} <span style="font-size:0.75rem; color:#64748b; font-weight:normal;">(${p.role})</span></div>
                        <div style="font-size:0.72rem; color:#94a3b8;">${p.time}</div>
                      </div>
                    </div>
                    <span style="font-size:0.72rem; font-weight:700; color:#d97706; background:#fffbeb; padding:2px 8px; border-radius:6px;">${p.category}</span>
                  </div>
                  <h4 style="margin:0 0 6px 0; font-size:0.92rem; color:#1e3a8a;">${p.title}</h4>
                  <p style="margin:0 0 10px 0; font-size:0.84rem; color:#334155; line-height:1.5;">${p.content}</p>
                  
                  <!-- Replies -->
                  ${p.replies && p.replies.length > 0 ? p.replies.map(r => `
                    <div class="forum-reply-box">
                      <div style="font-weight:700; color:#1d4ed8; font-size:0.8rem; margin-bottom:2px;">👨‍🏫 ${r.author} (${r.role}) • <span style="font-size:0.72rem; color:#94a3b8; font-weight:normal;">${r.time}</span></div>
                      <div>${r.text}</div>
                    </div>
                  `).join('') : ''}

                  <!-- Reply Box Form -->
                  <div style="display:flex; gap:8px; margin-top:12px;">
                    <input type="text" id="replyInput_${p.id}" class="form-input" style="height:32px; font-size:0.8rem;" placeholder="សរសេរការឆ្លើយតបរបស់អ្នក...">
                    <button class="btn btn-outline" style="height:32px; padding:0 12px; font-size:0.78rem;" onclick="addForumReply('${p.id}')">ឆ្លើយតប</button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <!-- Requests Tab -->
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
              
              <!-- Submit Form -->
              <div style="background:#ffffff; border:1px solid var(--border-color); border-radius:12px; padding:18px;">
                <h4 style="margin:0 0 14px 0; color:#1e3a8a; font-size:0.95rem;"><i class="fas fa-edit"></i> ដាក់ពាក្យស្នើសុំថ្មី</h4>
                <form onsubmit="event.preventDefault(); submitAdministrativeRequest();">
                  <div style="margin-bottom:12px;">
                    <label class="form-label">ប្រភេទនៃសំណើ</label>
                    <select id="admReqType" class="form-input">
                      <option value="លិខិតសុំច្បាប់ឈប់សម្រាក">លិខិតសុំច្បាប់ឈប់សម្រាក (Leave Request)</option>
                      <option value="លិខិតបញ្ជាក់ការសិក្សា">លិខិតបញ្ជាក់ការសិក្សា (Enrollment Certificate)</option>
                      <option value="ស្នើសុំកែប្រែព័ត៌មានផ្ទាល់ខ្លួន">ស្នើសុំកែប្រែព័ត៌មានផ្ទាល់ខ្លួន (Profile Edit)</option>
                      <option value="ស្នើសុំពិនិត្យពិន្ទុឡើងវិញ">ស្នើសុំពិនិត្យពិន្ទុឡើងវិញ (Grade Appeal)</option>
                    </select>
                  </div>
                  <div style="margin-bottom:12px;">
                    <label class="form-label">ខ្លឹមសារ ឬព័ត៌មានស្នើសុំ</label>
                    <input type="text" id="admReqDetails" class="form-input" placeholder="បញ្ជាក់ព័ត៌មានលម្អិត..." required>
                  </div>
                  <div style="margin-bottom:14px;">
                    <label class="form-label">មូលហេតុច្បាស់លាស់</label>
                    <textarea id="admReqReason" class="form-input" style="height:70px;" placeholder="បញ្ជាក់មូលហេតុ..." required></textarea>
                  </div>
                  <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">
                    <i class="fas fa-paper-plane"></i> ផ្ញើសំណើទៅកាន់ការិយាល័យរដ្ឋបាល
                  </button>
                </form>
              </div>

              <!-- My Past Requests -->
              <div>
                <h4 style="margin:0 0 14px 0; color:#1e3a8a; font-size:0.95rem;"><i class="fas fa-history"></i> ប្រវត្តិសំណើរបស់អ្នក</h4>
                <div style="display:flex; flex-direction:column; gap:10px;">
                  ${(stmsData.profileRequests && stmsData.profileRequests.length > 0) ? stmsData.profileRequests.map(r => `
                    <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:10px; padding:12px;">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <strong style="font-size:0.85rem; color:#1e293b;">${r.field || 'សំណើសុំច្បាប់'}</strong>
                        <span class="badge ${r.status==='approved'?'badge-present':'badge-permission'}">${r.status==='approved'?'បានអនុម័ត':'កំពុងរង់ចាំ'}</span>
                      </div>
                      <div style="font-size:0.8rem; color:#475569;">${r.newValue || r.reason || 'រដ្ឋបាល KTPTTC កំពុងត្រួតពិនិត្យ'}</div>
                    </div>
                  `).join('') : `
                    <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:10px; padding:12px;">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <strong style="font-size:0.85rem; color:#1e293b;">លិខិតបញ្ជាក់ការសិក្សា (ឆមាសទី ១)</strong>
                        <span class="badge badge-present">បានអនុម័ត</span>
                      </div>
                      <div style="font-size:0.78rem; color:#64748b;">បានចេញលិខិតបញ្ជាក់ដោយជោគជ័យ កាលពីថ្ងៃទី 10/11/2026</div>
                    </div>
                  `}
                </div>
              </div>

            </div>
          `}

          <div style="margin-top:20px; display:flex; justify-content:flex-end;">
            <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
          </div>

        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modalHtml;
}

function showNewPostForm() {
  const box = document.getElementById('newPostBox');
  if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function submitForumPost() {
  const t = getActiveTraineeProfile();
  const title = document.getElementById('forumPostTitle').value.trim();
  const content = document.getElementById('forumPostContent').value.trim();

  if (!title || !content) {
    showToast('សូមបំពេញចំណងជើង និងខ្លឹមសារប្រធានបទ!', 'warning');
    return;
  }

  KTPTTC_FORUM_POSTS.unshift({
    id: `POST-${Date.now()}`,
    author: t.nameKh,
    role: "គរុសិស្ស",
    avatar: "👨‍🎓",
    time: "ទើបតែផ្សាយ",
    category: "វិធីសាស្ត្របង្រៀន",
    title,
    content,
    replies: []
  });

  showToast('បានចុះផ្សាយប្រធានបទពិភាក្សាដោយជោគជ័យ!', 'success');
  openTraineeForumModal('forum');
}

function addForumReply(postId) {
  const t = getActiveTraineeProfile();
  const input = document.getElementById(`replyInput_${postId}`);
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    showToast('សូមវាយបញ្ចូលការឆ្លើយតប!', 'warning');
    return;
  }

  const p = KTPTTC_FORUM_POSTS.find(item => item.id === postId);
  if (p) {
    if (!p.replies) p.replies = [];
    p.replies.push({
      author: t.nameKh,
      role: "គរុសិស្ស",
      text: val,
      time: "ទើបតែឆ្លើយ"
    });
    showToast('បានបន្ថែមការឆ្លើយតប!', 'success');
    openTraineeForumModal('forum');
  }
}

function submitAdministrativeRequest() {
  const t = getActiveTraineeProfile();
  const type = document.getElementById('admReqType').value;
  const details = document.getElementById('admReqDetails').value.trim();
  const reason = document.getElementById('admReqReason').value.trim();

  if (!stmsData.profileRequests) stmsData.profileRequests = [];

  stmsData.profileRequests.unshift({
    id: `REQ-${Date.now()}`,
    studentId: t.id,
    studentName: t.nameKh,
    field: type,
    oldValue: "ស្នើសុំថ្មី",
    newValue: details,
    reason,
    status: "pending",
    requestedAt: new Date().toISOString()
  });

  saveData();
  showToast('បានផ្ញើសំណើផ្លូវការទៅកាន់ការិយាល័យរដ្ឋបាល KTPTTC រួចរាល់!', 'success');
  openTraineeForumModal('requests');
}

// --------------------------------------------------------------------------
// 6. HUB MODAL: របាយការណ៍ & លទ្ធផលពិន្ទុ (SCORE REPORTS & TRANSCRIPT)
// --------------------------------------------------------------------------
function openTraineeReportsModal() {
  const t = getActiveTraineeProfile();
  const activeStream = TRAINEE_STREAMS[currentStreamIndex];
  const subjects = KTPTTC_ALL_SUBJECTS;

  let modalHtml = `
    <div class="stms-modal-backdrop" id="traineeReportsModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-dialog" style="max-width:840px;">
        <div class="stms-modal-header" style="background:linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%); color:#ffffff;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:10px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.25rem;">
              <i class="fas fa-chart-line"></i>
            </div>
            <div>
              <h3 style="color:#ffffff; font-size:1.15rem; margin:0;">របាយការណ៍លទ្ធផលពិន្ទុ & ព្រឹត្តិបត្រផ្លូវការ</h3>
              <p style="color:#ede9fe; font-size:0.82rem; margin:2px 0 0 0;">${t.nameKh} (${t.id}) • ${activeStream.label}</p>
            </div>
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()" style="color:#ffffff;">&times;</button>
        </div>
        <div class="stms-modal-body" style="padding:22px; max-height:75vh; overflow-y:auto;">
          
          <!-- GPA & Performance Highlights -->
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:18px;">
            <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:10px; padding:14px; text-align:center;">
              <div style="font-size:0.75rem; color:#7c3aed; font-weight:700;">មធ្យមភាគសរុប (Average)</div>
              <div style="font-size:1.8rem; font-weight:800; color:#5b21b6; margin:4px 0;">91.4 <span style="font-size:0.9rem;">/ 100</span></div>
              <span class="badge badge-present">និទ្ទេស A (ល្អប្រសើរ)</span>
            </div>
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:14px; text-align:center;">
              <div style="font-size:0.75rem; color:#2563eb; font-weight:700;">ពិន្ទុរួម GPA (Max 4.00)</div>
              <div style="font-size:1.8rem; font-weight:800; color:#1d4ed8; margin:4px 0;">3.75 <span style="font-size:0.9rem;">/ 4.00</span></div>
              <span class="badge badge-published">២១ ក្រេឌីតជាប់ពេញលេញ</span>
            </div>
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px; text-align:center;">
              <div style="font-size:0.75rem; color:#16a34a; font-weight:700;">ចំណាត់ថ្នាក់ក្នុងថ្នាក់ (Rank)</div>
              <div style="font-size:1.8rem; font-weight:800; color:#15803d; margin:4px 0;">លេខ ២ <span style="font-size:0.9rem;">/ ៣២ នាក់</span></div>
              <span class="badge badge-present">សិស្សពូកែគរុកោសល្យ</span>
            </div>
          </div>

          <!-- Official Table -->
          <div class="data-table-responsive" style="border:1px solid var(--border-color); border-radius:10px; overflow:hidden; margin-bottom:18px;">
            <table class="stms-table" style="font-size:0.84rem;">
              <thead style="background:#f1f5f9;">
                <tr>
                  <th>កូដ</th>
                  <th>មុខវិជ្ជាគរុកោសល្យ</th>
                  <th>ក្រេឌីត</th>
                  <th>កិច្ចការ (10%)</th>
                  <th>វត្តមាន (10%)</th>
                  <th>ប្រចាំខែ (30%)</th>
                  <th>ប្រឡងឆមាស (50%)</th>
                  <th>សរុប (100)</th>
                  <th>និទ្ទេស</th>
                </tr>
              </thead>
              <tbody>
                ${subjects.map(s => {
                  const sc = (t.scores && t.scores[s.code]) || { homework: 9, attendance: 10, monthly: 27, semester: 44, total: 90, grade: 'A' };
                  return `
                    <tr>
                      <td><code>${s.code}</code></td>
                      <td><strong>${s.nameKh}</strong></td>
                      <td>${s.credits}</td>
                      <td>${sc.homework || 10}</td>
                      <td>${sc.attendance || 10}</td>
                      <td>${sc.monthly || 28}</td>
                      <td>${sc.semester || sc.final || 44}</td>
                      <td><strong style="color:#2563eb; font-size:0.95rem;">${sc.total || 90}</strong></td>
                      <td><span class="badge ${sc.grade==='A'?'badge-present':'badge-published'}">${sc.grade || 'A'}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="font-size:0.8rem; color:#64748b;">
              * និទ្ទេស A: 85-100 • B+: 80-84 • B: 70-79 • C+: 65-69 • C: 50-64 • F: &lt;50
            </div>
            <div style="display:flex; gap:10px;">
              <button class="btn btn-primary" onclick="showToast('កំពុងបើកទម្រង់បោះពុម្ពព្រឹត្តិបត្រពិន្ទុផ្លូវការ...', 'info'); setTimeout(()=>window.print(), 300);">
                <i class="fas fa-print"></i> បោះពុម្ពព្រឹត្តិបត្រពិន្ទុផ្លូវការ
              </button>
              <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modalHtml;
}

// --------------------------------------------------------------------------
// 7. HUB MODAL: កិច្ចព្រមព្រៀង & កម្មសិក្សា (PRACTICUM & CODE OF CONDUCT)
// --------------------------------------------------------------------------
function openTraineeGuidelinesModal(activeSection = 'rules') {
  let modalHtml = `
    <div class="stms-modal-backdrop" id="traineeGuidelinesModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-dialog" style="max-width:760px;">
        <div class="stms-modal-header" style="background:linear-gradient(135deg, #0f766e 0%, #0d9488 100%); color:#ffffff;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:10px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.25rem;">
              <i class="fas fa-clipboard-check"></i>
            </div>
            <div>
              <h3 style="color:#ffffff; font-size:1.15rem; margin:0;">កិច្ចព្រមព្រៀង & បទបញ្ជាផ្ទៃក្នុងគរុសនិស្សិត</h3>
              <p style="color:#ccfbf1; font-size:0.82rem; margin:2px 0 0 0;">ក្រមសីលធម៌វិជ្ជាជីវៈគ្រូបង្រៀន និងសៀវភៅណែនាំកម្មសិក្សាគរុកោសល្យ KTPTTC</p>
            </div>
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()" style="color:#ffffff;">&times;</button>
        </div>
        <div class="stms-modal-body" style="padding:22px; max-height:75vh; overflow-y:auto; font-size:0.88rem; line-height:1.7; color:#334155;">
          
          <!-- Guideline Tabs -->
          <div class="stms-modal-tabs">
            <button class="modal-tab-btn ${activeSection==='rules'?'active':''}" onclick="openTraineeGuidelinesModal('rules')">បទបញ្ជាផ្ទៃក្នុង</button>
            <button class="modal-tab-btn ${activeSection==='practicum'?'active':''}" onclick="openTraineeGuidelinesModal('practicum')">កម្មសិក្សាគរុកោសល្យ</button>
            <button class="modal-tab-btn ${activeSection==='lessonplan'?'active':''}" onclick="openTraineeGuidelinesModal('lessonplan')">ទម្រង់កិច្ចតែងការ (MoEYS)</button>
            <button class="modal-tab-btn ${activeSection==='pledge'?'active':''}" onclick="openTraineeGuidelinesModal('pledge')">កិច្ចសន្យាគរុសិស្ស</button>
          </div>

          ${activeSection === 'rules' ? `
            <div style="display:flex; flex-direction:column; gap:14px;">
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px;">
                <h4 style="color:#0f766e; font-size:0.95rem; margin:0 0 6px 0;"><i class="fas fa-user-check"></i> ១. វិន័យ និងវត្តមានសិក្សា</h4>
                <p style="margin:0;">គរុសនិស្សិតត្រូវមានវត្តមានយ៉ាងតិច <strong>៨០%</strong> នៃម៉ោងសិក្សាសរុបនៃមុខវិជ្ជានីមួយៗ។ ករណីអវត្តមានលើសពី <strong>២០%</strong> នឹងពុំត្រូវបានអនុញ្ញាតឱ្យចូលរួមការប្រឡងបញ្ចប់ឆមាសឡើយ។</p>
              </div>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px;">
                <h4 style="color:#0f766e; font-size:0.95rem; margin:0 0 6px 0;"><i class="fas fa-user-tie"></i> ២. ឯកសណ្ឋាន និងសេចក្តីថ្លៃថ្នូរ</h4>
                <p style="margin:0;">ត្រូវស្លៀកពាក់ឯកសណ្ឋានគរុសិស្ស (អាវស ខោ/សំពត់ខៀវចាស់) ឱ្យបានត្រឹមត្រូវ និងពាក់កាតសម្គាល់ខ្លួនជានិច្ចពេលនៅក្នុងបរិវេណសាលាគរុកោសល្យ។</p>
              </div>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px;">
                <h4 style="color:#0f766e; font-size:0.95rem; margin:0 0 6px 0;"><i class="fas fa-heart"></i> ៣. ក្រមសីលធម៌វិជ្ជាជីវៈគ្រូបង្រៀន</h4>
                <p style="margin:0;">គោរពគរុគ្រូឧទ្ទេស សហការល្អជាមួយមិត្តរួមថ្នាក់ និងមានអាកប្បកិរិយាសក្តិសមជាអ្នកអប់រំគំរូទាំងក្នុង និងក្រៅសាលារៀន។</p>
              </div>
            </div>
          ` : activeSection === 'practicum' ? `
            <div style="display:flex; flex-direction:column; gap:14px;">
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px;">
                <h4 style="color:#15803d; font-size:0.95rem; margin:0 0 6px 0;"><i class="fas fa-school"></i> ដំណាក់កាលទាំង ៣ នៃកម្មសិក្សាគរុកោសល្យ (Practicum)</h4>
                <p style="margin:0 0 8px 0;">• <strong>ដំណាក់កាលទី ១ (សប្តាហ៍ទី ១-២)៖</strong> សង្កេតការបង្រៀនរបស់គ្រូមគ្គុទ្ទេសក៍នៅសាលាបឋមសិក្សាអនុវត្តន៍</p>
                <p style="margin:0 0 8px 0;">• <strong>ដំណាក់កាលទី ២ (សប្តាហ៍ទី ៣-៥)៖</strong> ជួយបង្រៀន និងរៀបចំសម្ភារឧបទេសរួមគ្នាជាមួយគ្រូមគ្គុទ្ទេសក៍</p>
                <p style="margin:0;">• <strong>ដំណាក់កាលទី ៣ (សប្តាហ៍ទី ៦-១០)៖</strong> បង្រៀនផ្ទាល់ក្នុងថ្នាក់ពេញម៉ោង និងទទួលការវាយតម្លៃពីគណៈកម្មការ</p>
              </div>
              <button class="btn btn-primary" onclick="showToast('បានទាញយកសៀវភៅណែនាំកម្មសិក្សា (Practicum Guidebook PDF)!', 'success')">
                <i class="fas fa-download"></i> ទាញយកសៀវភៅណែនាំកម្មសិក្សាពេញលេញ (PDF)
              </button>
            </div>
          ` : activeSection === 'lessonplan' ? `
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:16px;">
              <h4 style="color:#1d4ed8; font-size:0.95rem; margin:0 0 10px 0;"><i class="fas fa-list-ol"></i> រចនាសម្ព័ន្ធកិច្ចតែងការបង្រៀនស្តង់ដារ ៥ ជំហាន (MoEYS)</h4>
              <div style="line-height:1.8;">
                <div><strong>• ជំហានទី ១ (រដ្ឋបាលថ្នាក់)៖</strong> ពិនិត្យអនាម័យ សណ្តាប់ធ្នាប់ វត្តមាន និងវិន័យ (៣ នាទី)</div>
                <div><strong>• ជំហានទី ២ (រំលឹកមេរៀនចាស់)៖</strong> សួរសំណួរ ឬលំហាត់សង្ខេបមេរៀនកន្លងមក (៥ នាទី)</div>
                <div><strong>• ជំហានទី ៣ (មេរៀនថ្មី)៖</strong> បង្ហាញវត្ថុបំណង ដឹកនាំសកម្មភាពរៀន និងពន្យល់ខ្លឹមសារ (២៥ នាទី)</div>
                <div><strong>• ជំហានទី ៤ (ពង្រឹងចំណេះដឹង)៖</strong> ឱ្យសិស្សធ្វើលំហាត់ជាក់ស្តែង ឬឆ្លើយសំណួរគន្លឹះ (១០ នាទី)</div>
                <div><strong>• ជំហានទី ៥ (បណ្តាំផ្ញើ)៖</strong> ដាក់កិច្ចការផ្ទះ និងណែនាំការថែរក្សាសៀវភៅ (២ នាទី)</div>
              </div>
              <div style="margin-top:14px;">
                <button class="btn btn-primary" onclick="showToast('បានទាញយកទម្រង់កិច្ចតែងការ (Word/PDF)!', 'success')">
                  <i class="fas fa-file-word"></i> ទាញយកទម្រង់កិច្ចតែងការគំរូ (Word)
                </button>
              </div>
            </div>
          ` : `
            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:16px; text-align:center;">
              <i class="fas fa-hand-holding-heart fa-2x" style="color:#dc2626; margin-bottom:8px;"></i>
              <h4 style="color:#991b1b; font-size:1rem; margin-bottom:8px;">លិខិតសន្យាគរុសនិស្សិត KTPTTC</h4>
              <p style="font-size:0.86rem; color:#7f1d1d; max-width:550px; margin:0 auto 16px auto; line-height:1.6;">
                "ខ្ញុំបាទ/នាងខ្ញុំ សូមសន្យាថានឹងខិតខំរៀនសូត្រ ប្រកាន់ខ្ជាប់នូវបទបញ្ជាផ្ទៃក្នុង គោរពពេលវេលា មិនអវត្តមានដោយគ្មានច្បាប់ និងលះបង់កម្លាំងកាយចិត្តដើម្បីក្លាយជាគ្រូបង្រៀនគំរូរបស់ជាតិ។"
              </p>
              <button class="btn btn-success" onclick="showToast('លោកអ្នកបានបញ្ជាក់ការយល់ព្រមកិច្ចសន្យាគរុសិស្សរួចរាល់!', 'success'); closeStmsModal();">
                <i class="fas fa-check-circle"></i> ខ្ញុំយល់ព្រម និងប្តេជ្ញាចិត្តគោរពតាម
              </button>
            </div>
          `}

          <div style="margin-top:20px; display:flex; justify-content:flex-end;">
            <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
          </div>

        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modalHtml;
}

// --------------------------------------------------------------------------
// 8. HUB MODAL: ផែនការ & វត្តមានផ្ទាល់ខ្លួន (PERSONAL ATTENDANCE DASHBOARD)
// --------------------------------------------------------------------------
function openTraineeAttendanceModal() {
  const t = getActiveTraineeProfile();

  let modalHtml = `
    <div class="stms-modal-backdrop" id="traineeAttendanceModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-dialog" style="max-width:800px;">
        <div class="stms-modal-header" style="background:linear-gradient(135deg, #0284c7 0%, #2563eb 100%); color:#ffffff;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:10px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.25rem;">
              <i class="fas fa-calendar-check"></i>
            </div>
            <div>
              <h3 style="color:#ffffff; font-size:1.15rem; margin:0;">កំណត់ត្រាវត្តមានផ្ទាល់ខ្លួន & ផែនការ</h3>
              <p style="color:#dbeafe; font-size:0.82rem; margin:2px 0 0 0;">${t.nameKh} (${t.id}) • គោលដៅវត្តមានសរុប ≥ ៨០%</p>
            </div>
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()" style="color:#ffffff;">&times;</button>
        </div>
        <div class="stms-modal-body" style="padding:22px; max-height:75vh; overflow-y:auto;">
          
          <!-- Attendance Progress Meter -->
          <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:18px; margin-bottom:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:0.9rem; font-weight:700; color:#1e293b;">អត្រាវត្តមានសរុបបច្ចុប្បន្ន</span>
              <strong style="font-size:1.4rem; color:#10b981;">${t.attendanceSummary?.rate || 98}%</strong>
            </div>
            <div style="width:100%; height:12px; background:#e2e8f0; border-radius:6px; overflow:hidden; margin-bottom:14px;">
              <div style="height:100%; width:${t.attendanceSummary?.rate || 98}%; background:linear-gradient(90deg, #10b981, #059669); border-radius:6px;"></div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; text-align:center;">
              <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px;">
                <div style="font-weight:800; color:#15803d; font-size:1.2rem;">${t.attendanceSummary?.present || 46}</div>
                <div style="color:#166534; font-size:0.75rem;">វត្តមាន</div>
              </div>
              <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:8px;">
                <div style="font-weight:800; color:#b45309; font-size:1.2rem;">${t.attendanceSummary?.permission || 2}</div>
                <div style="color:#92400e; font-size:0.75rem;">មានច្បាប់</div>
              </div>
              <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:8px;">
                <div style="font-weight:800; color:#c2410c; font-size:1.2rem;">${t.attendanceSummary?.late || 1}</div>
                <div style="color:#9a3412; font-size:0.75rem;">មកយឺត</div>
              </div>
              <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:8px;">
                <div style="font-weight:800; color:#b91c1c; font-size:1.2rem;">${t.attendanceSummary?.absent || 0}</div>
                <div style="color:#991b1b; font-size:0.75rem;">ឥតច្បាប់</div>
              </div>
            </div>
          </div>

          <!-- Quick Action Buttons -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <strong style="color:#1e3a8a; font-size:0.9rem;"><i class="fas fa-history"></i> កំណត់ត្រាវត្តមានតាមកាលបរិច្ឆេទ</strong>
            <button class="btn btn-outline" style="font-size:0.78rem;" onclick="closeStmsModal(); openTraineeForumModal('requests');">
              <i class="fas fa-file-signature"></i> ដាក់ពាក្យសុំច្បាប់ឈប់សម្រាក
            </button>
          </div>

          <!-- Attendance Logs Table -->
          <div class="data-table-responsive" style="border:1px solid var(--border-color); border-radius:10px; overflow:hidden;">
            <table class="stms-table" style="font-size:0.84rem;">
              <thead style="background:#f1f5f9;">
                <tr>
                  <th>កាលបរិច្ឆេទ</th>
                  <th>មុខវិជ្ជាគរុកោសល្យ</th>
                  <th>គ្រូឧទ្ទេស</th>
                  <th>ស្ថានភាពវត្តមាន</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>17/11/2026</td>
                  <td><strong>គរុកោសល្យទូទៅ និងវិធីសាស្ត្របង្រៀន</strong></td>
                  <td>សាស្ត្រាចារ្យ ហេង សំណាង</td>
                  <td><span class="badge badge-present">វត្តមាន</span></td>
                </tr>
                <tr>
                  <td>16/11/2026</td>
                  <td><strong>វិធីសាស្ត្របង្រៀនភាសាខ្មែរ និងអំណានដំបូង</strong></td>
                  <td>លោកស្រី ជា រចនា</td>
                  <td><span class="badge badge-present">វត្តមាន</span></td>
                </tr>
                <tr>
                  <td>14/11/2026</td>
                  <td><strong>វិធីសាស្ត្របង្រៀនគណិតវិទ្យាបឋម</strong></td>
                  <td>លោកគ្រូ យឹម វណ្ណា</td>
                  <td><span class="badge badge-present">វត្តមាន</span></td>
                </tr>
                <tr>
                  <td>12/11/2026</td>
                  <td><strong>បច្ចេកវិទ្យាព័ត៌មានក្នុងការអប់រំ (ICT)</strong></td>
                  <td>លោកគ្រូ ស៊ុយ សូលីដា</td>
                  <td><span class="badge badge-present">វត្តមាន</span></td>
                </tr>
                <tr>
                  <td>09/11/2026</td>
                  <td><strong>ចិត្តវិទ្យាគរុកោសល្យ និងការអភិវឌ្ឍកុមារ</strong></td>
                  <td>លោកស្រី ម៉ៅ សុភា</td>
                  <td><span class="badge badge-permission">មានច្បាប់</span></td>
                </tr>
                <tr>
                  <td>06/11/2026</td>
                  <td><strong>ការស្រាវជ្រាវសកម្មភាពក្នុងថ្នាក់រៀន</strong></td>
                  <td>សាស្ត្រាចារ្យ ហេង សំណាង</td>
                  <td><span class="badge badge-present">វត្តមាន</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="margin-top:20px; display:flex; justify-content:flex-end;">
            <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
          </div>

        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modalHtml;
}

// --------------------------------------------------------------------------
// 9. SUBJECT DETAILS MODAL (LEARNING CENTER FOR EACH OF THE 8 SUBJECTS)
// --------------------------------------------------------------------------
function openSubjectDetailModal(code) {
  const t = getActiveTraineeProfile();
  const subj = KTPTTC_ALL_SUBJECTS.find(s => s.code === code) || (stmsData.subjects || []).find(s => s.code === code) || {
    code: code,
    nameKh: 'មុខវិជ្ជាគរុកោសល្យ',
    credits: 3,
    trainer: 'សាស្ត្រាចារ្យ KTPTTC'
  };
  const theme = getSubjectTheme(code);
  const sc = t && t.scores ? t.scores[code] : null;

  let modalHtml = `
    <div class="stms-modal-backdrop" id="subjectDetailModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-dialog" style="max-width:680px;">
        <div class="stms-modal-header" style="background:${theme.bg}; border-bottom:1px solid ${theme.border}; color:#1e293b;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:44px; height:44px; border-radius:12px; background:#ffffff; color:${theme.color}; display:flex; align-items:center; justify-content:center; font-size:1.4rem; box-shadow:0 2px 6px rgba(0,0,0,0.06); border:1px solid ${theme.border};">
              <i class="${theme.icon}"></i>
            </div>
            <div>
              <h3 style="color:#1e293b; font-size:1.12rem; margin:0; line-height:1.4;">${subj.nameKh}</h3>
              <p style="color:#64748b; font-size:0.8rem; margin:2px 0 0 0;">កូដ៖ <strong>${subj.code}</strong> • <strong>${subj.credits} ក្រេឌីត</strong> • គ្រូឧទ្ទេស៖ <strong>${subj.trainer}</strong></p>
            </div>
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()" style="color:#1e293b;">&times;</button>
        </div>
        <div class="stms-modal-body" style="padding:22px; max-height:75vh; overflow-y:auto;">
          
          <!-- Syllabus Outline -->
          <div style="margin-bottom:18px;">
            <h4 style="font-size:0.92rem; color:#1e3a8a; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
              <i class="fas fa-list-ol" style="color:${theme.color};"></i> មាតិកាសង្ខេបនៃមុខវិជ្ជា (Course Syllabus)
            </h4>
            <div style="background:#f8fafc; border-radius:10px; padding:14px; border:1px solid var(--border-color); font-size:0.86rem; line-height:1.8; color:#334155;">
              <div>• <strong>ជំពូកទី ១៖</strong> ទ្រឹស្ដីនៃការបង្រៀន និងរៀនតាមបែបស្ថាបនានិយម (Constructivism)</div>
              <div>• <strong>ជំពូកទី ២៖</strong> ការរៀបចំកិច្ចតែងការបង្រៀន (Lesson Plan) តាមស្តង់ដារក្រសួងអប់រំ</div>
              <div>• <strong>ជំពូកទី ៣៖</strong> វិធីសាស្ត្របង្រៀនសកម្ម និងការគ្រប់គ្រងថ្នាក់រៀនបែបវិជ្ជមាន</div>
              <div>• <strong>ជំពូកទី ៤៖</strong> ការវាស់វែង និងវាយតម្លៃលទ្ធផលសិក្សារបស់សិស្សបឋម</div>
            </div>
          </div>

          <!-- Evaluation Breakdown -->
          <div style="margin-bottom:18px;">
            <h4 style="font-size:0.92rem; color:#1e3a8a; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
              <i class="fas fa-calculator" style="color:${theme.color};"></i> ការបែងចែកភាគរយពិន្ទុ (MoEYS Standard)
            </h4>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; text-align:center; font-size:0.8rem;">
              <div style="background:#eff6ff; padding:8px 4px; border-radius:6px; border:1px solid #bfdbfe;">
                <div style="font-weight:700; color:#1d4ed8;">១០%</div>
                <div style="font-size:0.74rem; color:#3b82f6;">កិច្ចការស្រាវជ្រាវ</div>
              </div>
              <div style="background:#f0fdf4; padding:8px 4px; border-radius:6px; border:1px solid #bbf7d0;">
                <div style="font-weight:700; color:#15803d;">១០%</div>
                <div style="font-size:0.74rem; color:#22c55e;">វត្តមាន/វិន័យ</div>
              </div>
              <div style="background:#fffbeb; padding:8px 4px; border-radius:6px; border:1px solid #fde68a;">
                <div style="font-weight:700; color:#b45309;">៣០%</div>
                <div style="font-size:0.74rem; color:#eab308;">ប្រឡងប្រចាំខែ</div>
              </div>
              <div style="background:#fdf4ff; padding:8px 4px; border-radius:6px; border:1px solid #f5d0fe;">
                <div style="font-weight:700; color:#a21caf;">៥០%</div>
                <div style="font-size:0.74rem; color:#d946ef;">ប្រឡងឆមាស</div>
              </div>
            </div>
          </div>

          <!-- Current Student Score for this subject -->
          ${sc ? `
            <div style="background:linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border:1px solid #86efac; border-radius:10px; padding:14px; margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-weight:700; color:#166534; font-size:0.95rem;">លទ្ធផលសិក្សារបស់អ្នក៖ ${sc.total} / 100</div>
                  <div style="font-size:0.78rem; color:#15803d; margin-top:3px;">
                    កិច្ចការ៖ ${sc.homework || 10} • វត្តមាន៖ ${sc.attendance || 10} • ប្រចាំខែ៖ ${sc.monthly || 28} • ឆមាស៖ ${sc.semester || sc.final || 44}
                  </div>
                </div>
                <span class="badge badge-present" style="font-size:1.1rem; padding:4px 14px;">និទ្ទេស ${sc.grade}</span>
              </div>
            </div>
          ` : `
            <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:10px; padding:12px; text-align:center; color:#64748b; font-size:0.84rem; margin-bottom:16px;">
              <i class="fas fa-clock" style="color:#94a3b8; margin-right:6px;"></i> លទ្ធផលពិន្ទុឆមាសសម្រាប់មុខវិជ្ជានេះ កំពុងស្ថិតក្នុងដំណើរការវាយតម្លៃដោយគ្រូឧទ្ទេស។
            </div>
          `}

          <!-- Quick Actions: Syllabus & Video Lessons -->
          <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
            <button class="btn btn-outline" onclick="closeStmsModal(); openTraineeLessonsModal();">
              <i class="fas fa-play-circle" style="color:#ea580c;"></i> មើលវីដេអូបង្រៀន
            </button>
            <button class="btn btn-primary" onclick="showToast('បានទាញយកកម្រងមេរៀន (Syllabus PDF) នៃមុខវិជ្ជា ${subj.nameKh} ដោយជោគជ័យ!', 'success')">
              <i class="fas fa-download"></i> ទាញយក Syllabus (PDF)
            </button>
            <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
          </div>

        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modalHtml;
}

// Trainee Modal: Video Lessons & E-Learning
function openTraineeLessonsModal() {
  let modalHtml = `
    <div class="stms-modal-backdrop" id="traineeLessonsModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-dialog" style="max-width:680px;">
        <div class="stms-modal-header" style="background:linear-gradient(135deg, #ea580c 0%, #c2410c 100%); color:#ffffff;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:38px; height:38px; border-radius:10px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.2rem;">
              <i class="fas fa-play-circle"></i>
            </div>
            <div>
              <h3 style="color:#ffffff; font-size:1.1rem; margin:0;">វីដេអូ & មេរៀន E-Learning គរុកោសល្យ</h3>
              <p style="color:#ffedd5; font-size:0.8rem; margin:2px 0 0 0;">កម្រងវីដេអូបង្រៀនគំរូ និងស្លាយបង្រៀនឌីជីថល KTPTTC</p>
            </div>
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()" style="color:#ffffff;">&times;</button>
        </div>
        <div class="stms-modal-body" style="padding:22px; max-height:72vh; overflow-y:auto;">
          
          <div style="display:flex; flex-direction:column; gap:12px;">
            
            <div style="display:flex; gap:14px; background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:12px; align-items:center;">
              <div style="width:68px; height:50px; background:linear-gradient(135deg,#fed7aa,#fdba74); border-radius:8px; display:flex; align-items:center; justify-content:center; color:#c2410c; font-size:1.5rem; flex-shrink:0;">
                <i class="fas fa-play"></i>
              </div>
              <div style="flex:1;">
                <h5 style="margin:0 0 3px 0; font-size:0.9rem; color:#1e293b;">បច្ចេកទេសបង្រៀនអំណានដំបូងតាមវិធីសាស្ត្រសូរសំឡេង (Phonics)</h5>
                <p style="margin:0; font-size:0.77rem; color:#64748b;">គ្រូឧទ្ទេស៖ លោកស្រី ជា រចនា • រយៈពេល៖ ៣៥ នាទី • កម្រិតបឋមសិក្សា</p>
              </div>
              <button class="btn btn-outline" style="height:32px; padding:0 12px; font-size:0.8rem;" onclick="showToast('កំពុងបើកវីដេអូបង្រៀន...', 'info')">
                ទស្សនា
              </button>
            </div>

            <div style="display:flex; gap:14px; background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:12px; align-items:center;">
              <div style="width:68px; height:50px; background:linear-gradient(135deg,#bae6fd,#7dd3fc); border-radius:8px; display:flex; align-items:center; justify-content:center; color:#0284c7; font-size:1.5rem; flex-shrink:0;">
                <i class="fas fa-play"></i>
              </div>
              <div style="flex:1;">
                <h5 style="margin:0 0 3px 0; font-size:0.9rem; color:#1e293b;">ការអនុវត្តកិច្ចតែងការបង្រៀនគណិតវិទ្យាថ្នាក់ទី ១ ដល់ទី ៣</h5>
                <p style="margin:0; font-size:0.77rem; color:#64748b;">គ្រូឧទ្ទេស៖ លោកគ្រូ យឹម វណ្ណា • រយៈពេល៖ ៤២ នាទី • កម្រិតបឋមសិក្សា</p>
              </div>
              <button class="btn btn-outline" style="height:32px; padding:0 12px; font-size:0.8rem;" onclick="showToast('កំពុងបើកវីដេអូបង្រៀន...', 'info')">
                ទស្សនា
              </button>
            </div>

            <div style="display:flex; gap:14px; background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:12px; align-items:center;">
              <div style="width:68px; height:50px; background:linear-gradient(135deg,#fbcfe8,#f472b6); border-radius:8px; display:flex; align-items:center; justify-content:center; color:#db2777; font-size:1.5rem; flex-shrink:0;">
                <i class="fas fa-play"></i>
              </div>
              <div style="flex:1;">
                <h5 style="margin:0 0 3px 0; font-size:0.9rem; color:#1e293b;">ការបង្កើត និងប្រើប្រាស់ឧបករណ៍បង្រៀនពីវត្ថុធាតុក្នុងមូលដ្ឋាន</h5>
                <p style="margin:0; font-size:0.77rem; color:#64748b;">គ្រូឧទ្ទេស៖ សាស្ត្រាចារ្យ ហេង សំណាង • រយៈពេល៖ ២៨ នាទី</p>
              </div>
              <button class="btn btn-outline" style="height:32px; padding:0 12px; font-size:0.8rem;" onclick="showToast('កំពុងបើកវីដេអូបង្រៀន...', 'info')">
                ទស្សនា
              </button>
            </div>

            <div style="display:flex; gap:14px; background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:12px; align-items:center;">
              <div style="width:68px; height:50px; background:linear-gradient(135deg,#ddd6fe,#c084fc); border-radius:8px; display:flex; align-items:center; justify-content:center; color:#7c3aed; font-size:1.5rem; flex-shrink:0;">
                <i class="fas fa-play"></i>
              </div>
              <div style="flex:1;">
                <h5 style="margin:0 0 3px 0; font-size:0.9rem; color:#1e293b;">ការប្រើប្រាស់ ICT និងស្លាយបង្រៀនអន្តរកម្មក្នុងថ្នាក់បឋម</h5>
                <p style="margin:0; font-size:0.77rem; color:#64748b;">គ្រូឧទ្ទេស៖ លោកគ្រូ ស៊ុយ សូលីដា • រយៈពេល៖ ៣០ នាទី</p>
              </div>
              <button class="btn btn-outline" style="height:32px; padding:0 12px; font-size:0.8rem;" onclick="showToast('កំពុងបើកវីដេអូបង្រៀន...', 'info')">
                ទស្សនា
              </button>
            </div>

          </div>

          <div style="margin-top:20px; display:flex; justify-content:flex-end;">
            <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
          </div>

        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modalHtml;
}

// Trainee Modal: Digital Library
function openTraineeLibraryModal() {
  let modalHtml = `
    <div class="stms-modal-backdrop" id="traineeLibraryModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-dialog" style="max-width:680px;">
        <div class="stms-modal-header" style="background:linear-gradient(135deg, #15803d 0%, #166534 100%); color:#ffffff;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:38px; height:38px; border-radius:10px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.2rem;">
              <i class="fas fa-book-open"></i>
            </div>
            <div>
              <h3 style="color:#ffffff; font-size:1.1rem; margin:0;">បណ្ណាល័យឌីជីថល (Digital Library KTPTTC)</h3>
              <p style="color:#bbf7d0; font-size:0.8rem; margin:2px 0 0 0;">កម្រងសៀវភៅគរុកោសល្យ សៀវភៅសិក្សាគោល និងឯកសារស្រាវជ្រាវ MoEYS</p>
            </div>
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()" style="color:#ffffff;">&times;</button>
        </div>
        <div class="stms-modal-body" style="padding:22px; max-height:72vh; overflow-y:auto;">
          
          <div style="display:flex; flex-direction:column; gap:12px;">
            
            <div style="display:flex; gap:14px; background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:14px; align-items:center;">
              <div style="width:48px; height:48px; border-radius:8px; background:#dcfce7; color:#15803d; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                <i class="fas fa-book"></i>
              </div>
              <div style="flex:1;">
                <h5 style="margin:0 0 3px 0; font-size:0.9rem; color:#1e293b;">សៀវភៅគរុកោសល្យទូទៅសម្រាប់គរុសិស្សបឋម ១២+២</h5>
                <p style="margin:0; font-size:0.77rem; color:#64748b;">ក្រសួងអប់រំ យុវជន និងកីឡា (MoEYS) • ២៤០ ទំព័រ • PDF ផ្លូវការ</p>
              </div>
              <button class="btn btn-primary" style="height:32px; padding:0 12px; font-size:0.8rem;" onclick="showToast('បានទាញយកសៀវភៅជា PDF!', 'success')">
                <i class="fas fa-file-pdf"></i> ទាញយក
              </button>
            </div>

            <div style="display:flex; gap:14px; background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:14px; align-items:center;">
              <div style="width:48px; height:48px; border-radius:8px; background:#fef3c7; color:#b45309; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                <i class="fas fa-book"></i>
              </div>
              <div style="flex:1;">
                <h5 style="margin:0 0 3px 0; font-size:0.9rem; color:#1e293b;">សៀវភៅណែនាំគ្រូបង្រៀនភាសាខ្មែរ ថ្នាក់ទី ១ ដល់ទី ៦</h5>
                <p style="margin:0; font-size:0.77rem; color:#64748b;">នាយកដ្ឋានអភិវឌ្ឍកម្មវិធីសិក្សា • ៣១០ ទំព័រ • PDF ផ្លូវការ</p>
              </div>
              <button class="btn btn-primary" style="height:32px; padding:0 12px; font-size:0.8rem;" onclick="showToast('បានទាញយកសៀវភៅជា PDF!', 'success')">
                <i class="fas fa-file-pdf"></i> ទាញយក
              </button>
            </div>

            <div style="display:flex; gap:14px; background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:14px; align-items:center;">
              <div style="width:48px; height:48px; border-radius:8px; background:#e0f2fe; color:#0369a1; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                <i class="fas fa-book"></i>
              </div>
              <div style="flex:1;">
                <h5 style="margin:0 0 3px 0; font-size:0.9rem; color:#1e293b;">វិធីសាស្ត្របង្រៀនគណិតវិទ្យាបឋមសិក្សា (STEM)</h5>
                <p style="margin:0; font-size:0.77rem; color:#64748b;">KTPTTC Kratie • ១៨៥ ទំព័រ • PDF ផ្លូវការ</p>
              </div>
              <button class="btn btn-primary" style="height:32px; padding:0 12px; font-size:0.8rem;" onclick="showToast('បានទាញយកសៀវភៅជា PDF!', 'success')">
                <i class="fas fa-file-pdf"></i> ទាញយក
              </button>
            </div>

            <div style="display:flex; gap:14px; background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:14px; align-items:center;">
              <div style="width:48px; height:48px; border-radius:8px; background:#f3e8ff; color:#7e22ce; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0;">
                <i class="fas fa-book"></i>
              </div>
              <div style="flex:1;">
                <h5 style="margin:0 0 3px 0; font-size:0.9rem; color:#1e293b;">ចិត្តវិទ្យាគរុកោសល្យ និងការគ្រប់គ្រងថ្នាក់រៀនបែបវិជ្ជមាន</h5>
                <p style="margin:0; font-size:0.77rem; color:#64748b;">វិទ្យាស្ថានជាតិអប់រំ (NIE) • ២១៥ ទំព័រ • PDF ផ្លូវការ</p>
              </div>
              <button class="btn btn-primary" style="height:32px; padding:0 12px; font-size:0.8rem;" onclick="showToast('បានទាញយកសៀវភៅជា PDF!', 'success')">
                <i class="fas fa-file-pdf"></i> ទាញយក
              </button>
            </div>

          </div>

          <div style="margin-top:20px; display:flex; justify-content:flex-end;">
            <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
          </div>

        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modalHtml;
}

// Trainee Modal: Guidelines & Agreement
function openTraineeGuidelinesModal() {
  let modalHtml = `
    <div class="stms-modal-backdrop" id="traineeGuidelinesModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-dialog" style="max-width:640px;">
        <div class="stms-modal-header" style="background:linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color:#ffffff;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:38px; height:38px; border-radius:10px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:1.2rem;">
              <i class="fas fa-clipboard-check"></i>
            </div>
            <div>
              <h3 style="color:#ffffff; font-size:1.1rem; margin:0;">កិច្ចព្រមព្រៀង និងបទបញ្ជាផ្ទៃក្នុងគរុសនិស្សិត</h3>
              <p style="color:#ccfbf1; font-size:0.8rem; margin:2px 0 0 0;">បទបញ្ញត្តិ និងគោលការណ៍ណែនាំស្តីពីការបណ្តុះបណ្តាលគរុកោសល្យ KTPTTC</p>
            </div>
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()" style="color:#ffffff;">&times;</button>
        </div>
        <div class="stms-modal-body" style="padding:22px; max-height:72vh; overflow-y:auto; font-size:0.88rem; line-height:1.7; color:#334155;">
          
          <div style="margin-bottom:16px;">
            <h4 style="font-size:0.95rem; color:#0f766e; margin-bottom:6px;"><i class="fas fa-check-circle"></i> ១. លក្ខខណ្ឌវត្តមាន និងវិន័យ</h4>
            <p style="margin:0;">គរុសនិស្សិតត្រូវមានវត្តមានយ៉ាងតិច <strong>៨០%</strong> នៃម៉ោងសិក្សាសរុប។ ករណីអវត្តមានត្រូវមានច្បាប់អនុញ្ញាតត្រឹមត្រូវពីការិយាល័យសិក្សាធិការ និងមិនត្រូវមកយឺត ឬចេញមុនម៉ោងឡើយ។</p>
          </div>

          <div style="margin-bottom:16px;">
            <h4 style="font-size:0.95rem; color:#0f766e; margin-bottom:6px;"><i class="fas fa-check-circle"></i> ២. ក្រមសីលធម៌វិជ្ជាជីវៈគ្រូបង្រៀន</h4>
            <p style="margin:0;">ប្រកាន់ខ្ជាប់នូវសេចក្តីថ្លៃថ្នូរ ស្លៀកពាក់ឯកសណ្ឋានគរុសិស្សឱ្យបានត្រឹមត្រូវ គោរពពេលវេលា គរុគ្រូឧទ្ទេស មិត្តរួមថ្នាក់ និងសហគមន៍ជុំវិញ។</p>
          </div>

          <div style="margin-bottom:16px;">
            <h4 style="font-size:0.95rem; color:#0f766e; margin-bottom:6px;"><i class="fas fa-check-circle"></i> ៣. ការចុះកម្មសិក្សាគរុកោសល្យ (Practicum)</h4>
            <p style="margin:0;">ត្រូវអនុវត្តការបង្រៀនសាកល្បងនៅសាលាបឋមសិក្សាអនុវត្តន៍ឱ្យបានគ្រប់ចំនួនម៉ោង និងមានកិច្ចតែងការបង្រៀន (Lesson Plan) ពេញលេញរាល់ម៉ោងបង្រៀន។</p>
          </div>

          <div style="margin-bottom:16px;">
            <h4 style="font-size:0.95rem; color:#0f766e; margin-bottom:6px;"><i class="fas fa-check-circle"></i> ៤. ការវាយតម្លៃ និងប្រឡងបញ្ចប់វគ្គ</h4>
            <p style="margin:0;">ការវាយតម្លៃលទ្ធផលរួមមាន កិច្ចការស្រាវជ្រាវ (១០%), វត្តមាន/វិន័យ (១០%), ប្រឡងប្រចាំខែ (៣០%) និងប្រឡងបញ្ចប់ឆមាស (៥០%) តាមស្តង់ដារក្រសួងអប់រំ យុវជន និងកីឡា។</p>
          </div>

          <div style="margin-top:20px; display:flex; justify-content:flex-end;">
            <button class="btn btn-primary" onclick="closeStmsModal()">យល់ព្រម & បិទ</button>
          </div>

        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modalHtml;
}

function renderTraineeAttendanceView(container) {
  const t = getActiveTraineeProfile();

  container.innerHTML = `
    <div class="view-header">
      <div class="view-title-group">
        <h2><i class="fas fa-user-check"></i> កំណត់ត្រាវត្តមានផ្ទាល់ខ្លួន៖ ${t.nameKh}</h2>
        <p>ពិនិត្យវត្តមាន និងអវត្តមានប្រចាំឆមាស • គោលដៅវត្តមានសរុប ≥ ៨០%</p>
      </div>
      <button class="btn btn-outline" onclick="navigateView('trainee-portal')">← ត្រឡប់ក្រោយ</button>
    </div>

    <div class="table-card">
      <div style="padding:24px;">
        <h4 style="color:#1e3a8a; margin-bottom:14px;">អត្រាវត្តមានសរុប៖ <strong style="color:#10b981;">${t.attendanceSummary?.rate || 100}%</strong></h4>
        <p style="font-size:0.85rem; color:#64748b; margin-bottom:20px;">
          គរុសនិស្សិតត្រូវមានវត្តមានយ៉ាងតិច <strong>៨០%</strong> នៃម៉ោងសិក្សាសរុប ដើម្បីមានសិទ្ធិចូលរួមប្រឡងបញ្ចប់វគ្គបណ្តុះបណ្តាល។
        </p>

        <div class="data-table-responsive">
          <table class="stms-table">
            <thead>
              <tr>
                <th>កាលបរិច្ឆេទ</th>
                <th>មុខវិជ្ជា</th>
                <th>គ្រូឧទ្ទេស</th>
                <th>ស្ថានភាពវត្តមាន</th>
              </tr>
            </thead>
            <tbody>
              ${(stmsData.attendanceSessions && stmsData.attendanceSessions.length > 0) ? stmsData.attendanceSessions.map(sess => {
                const st = (sess.records && sess.records[t.id]) || 'present';
                const label = st==='present'?'វត្តមាន':st==='absent'?'អវត្តមានគ្មានច្បាប់':st==='permission'?'មានច្បាប់':'មកយឺត';
                const badgeCls = st==='present'?'badge-present':st==='absent'?'badge-absent':st==='permission'?'badge-permission':'badge-late';
                return `
                  <tr>
                    <td>${sess.date}</td>
                    <td><strong>${sess.subjectName || sess.subjectCode}</strong></td>
                    <td>${sess.trainerName || 'គ្រូឧទ្ទេស'}</td>
                    <td><span class="badge ${badgeCls}">${label}</span></td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td>17/11/2026</td>
                  <td><strong>គរុកោសល្យទូទៅ និងវិធីសាស្ត្របង្រៀន</strong></td>
                  <td>សាស្ត្រាចារ្យ ហេង សំណាង</td>
                  <td><span class="badge badge-present">វត្តមាន</span></td>
                </tr>
                <tr>
                  <td>16/11/2026</td>
                  <td><strong>វិធីសាស្ត្របង្រៀនភាសាខ្មែរ</strong></td>
                  <td>លោកស្រី ជា រចនា</td>
                  <td><span class="badge badge-present">វត្តមាន</span></td>
                </tr>
                <tr>
                  <td>14/11/2026</td>
                  <td><strong>វិធីសាស្ត្របង្រៀនគណិតវិទ្យា</strong></td>
                  <td>លោកគ្រូ យឹម វណ្ណា</td>
                  <td><span class="badge badge-present">វត្តមាន</span></td>
                </tr>
                <tr>
                  <td>12/11/2026</td>
                  <td><strong>បច្ចេកវិទ្យាព័ត៌មានក្នុងការអប់រំ (ICT)</strong></td>
                  <td>លោកគ្រូ ស៊ុយ សូលីដា</td>
                  <td><span class="badge badge-present">វត្តមាន</span></td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderTraineeGradesView(container) {
  const t = getActiveTraineeProfile();

  container.innerHTML = `
    <div class="view-header">
      <div class="view-title-group">
        <h2><i class="fas fa-award"></i> លទ្ធផលសិក្សា និងពិន្ទុផ្លូវការ៖ ${t.nameKh}</h2>
        <p>ពិន្ទុដែលបានផ្ទៀងផ្ទាត់ និងផ្សព្វផ្សាយដោយការិយាល័យសិក្សាធិការ KTPTTC</p>
      </div>
      <button class="btn btn-outline" onclick="navigateView('trainee-portal')">← ត្រឡប់ក្រោយ</button>
    </div>

    <div class="table-card">
      <div class="data-table-responsive">
        <table class="stms-table">
          <thead>
            <tr>
              <th>កូដមុខវិជ្ជា</th>
              <th>ឈ្មោះមុខវិជ្ជា</th>
              <th>កិច្ចការ (10%)</th>
              <th>វត្តមាន (10%)</th>
              <th>ប្រឡងខែ (30%)</th>
              <th>ប្រឡងឆមាស (50%)</th>
              <th>ពិន្ទុសរុប (100)</th>
              <th>និទ្ទេស</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(t.scores || {}).map(code => {
              const sc = t.scores[code];
              if (sc.status !== 'published') return '';
              const subj = (stmsData.subjects || []).find(s => s.code === code);
              return `
                <tr>
                  <td><code>${code}</code></td>
                  <td><strong>${subj?.nameKh || code}</strong></td>
                  <td>${sc.homework || 10}</td>
                  <td>${sc.attendance || 10}</td>
                  <td>${sc.monthly || 28}</td>
                  <td>${sc.semester || sc.final || 44}</td>
                  <td><strong style="color:#2563eb; font-size:1rem;">${sc.total}</strong></td>
                  <td><span class="badge ${sc.grade==='A'?'badge-present':'badge-published'}">${sc.grade}</span></td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="8" style="text-align:center; padding:30px; color:#94a3b8;">ពុំទាន់មានពិន្ទុត្រូវបានផ្សព្វផ្សាយនៅឡើយទេ។</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderTraineeRequestView(container) {
  const t = getActiveTraineeProfile();

  container.innerHTML = `
    <div class="view-header">
      <div class="view-title-group">
        <h2><i class="fas fa-paper-plane"></i> ស្នើសុំកែប្រែព័ត៌មានផ្ទាល់ខ្លួន៖ ${t.nameKh}</h2>
        <p>សំណើនឹងត្រូវត្រួតពិនិត្យ និងអនុម័តដោយការិយាល័យរដ្ឋបាល/សិក្សាធិការ KTPTTC</p>
      </div>
      <button class="btn btn-outline" onclick="navigateView('trainee-portal')">← ត្រឡប់ក្រោយ</button>
    </div>

    <div style="background:#ffffff; border-radius:12px; border:1px solid var(--border-color); padding:24px; max-width:640px;">
      <form onsubmit="event.preventDefault(); submitTraineeProfileRequest();">
        <div style="margin-bottom:14px;">
          <label class="form-label">ព័ត៌មានដែលចង់ស្នើសុំកែប្រែ</label>
          <select id="reqField" class="form-input">
            <option value="លេខទូរស័ព្ទ (Phone)">លេខទូរស័ព្ទ (Phone)</option>
            <option value="អាសយដ្ឋានបច្ចុប្បន្ន (Address)">អាសយដ្ឋានបច្ចុប្បន្ន (Address)</option>
            <option value="រូបថតគរុនិស្សិត (Photo)">រូបថតគរុនិស្សិត (Photo)</option>
            <option value="ព័ត៌មានសញ្ញាបត្របាក់ឌុប (BacII)">ព័ត៌មានសញ្ញាបត្របាក់ឌុប (BacII)</option>
          </select>
        </div>

        <div style="margin-bottom:14px;">
          <label class="form-label">ព័ត៌មានថ្មី (New Value)</label>
          <input type="text" id="reqNewVal" class="form-input" placeholder="វាយបញ្ចូលព័ត៌មានថ្មីត្រឹមត្រូវ..." required>
        </div>

        <div style="margin-bottom:18px;">
          <label class="form-label">មូលហេតុនៃការកែប្រែ</label>
          <textarea id="reqReason" class="form-input" style="height:80px;" placeholder="បញ្ជាក់មូលហេតុច្បាស់លាស់..." required></textarea>
        </div>

        <button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> ផ្ញើសំណើទៅកាន់ Admin</button>
      </form>
    </div>
  `;
}

function submitTraineeProfileRequest() {
  const t = getActiveTraineeProfile();
  const field = document.getElementById('reqField').value;
  const newVal = document.getElementById('reqNewVal').value.trim();
  const reason = document.getElementById('reqReason').value.trim();

  if (!stmsData.profileRequests) stmsData.profileRequests = [];

  stmsData.profileRequests.push({
    id: `REQ-${Date.now()}`,
    studentId: t.id,
    studentName: t.nameKh,
    field,
    oldValue: "ព័ត៌មានចាស់",
    newValue: newVal,
    reason,
    status: "pending",
    requestedAt: new Date().toISOString()
  });

  saveData();
  showToast('បានផ្ញើសំណើកែប្រែព័ត៌មានទៅកាន់ Admin រួចរាល់!', 'success');
  navigateView('trainee-portal');
}

// ==========================================================================
// 7. REQUESTS APPROVAL VIEW (ADMIN)
// ==========================================================================
function renderRequestsView(container) {
  let html = `
    <div class="view-header">
      <div class="view-title-group">
        <h2><i class="fas fa-clipboard-list"></i> សំណើកែប្រែព័ត៌មានពីគរុសនិស្សិត</h2>
        <p>ពិនិត្យផ្ទៀងផ្ទាត់ និងអនុម័តសំណើកែប្រែទិន្នន័យ</p>
      </div>
    </div>

    <div class="table-card">
      <div class="data-table-responsive">
        <table class="stms-table">
          <thead>
            <tr>
              <th>លេខកូដសំណើ</th>
              <th>ឈ្មោះគរុសនិស្សិត</th>
              <th>ប្រធានបទកែប្រែ</th>
              <th>ព័ត៌មានថ្មី</th>
              <th>មូលហេតុ</th>
              <th>ស្ថានភាព</th>
              <th>សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            ${stmsData.profileRequests.map(r => `
              <tr>
                <td><code>${r.id}</code></td>
                <td><strong>${r.studentName}</strong> <div style="font-size:0.75rem; color:#64748b;">${r.studentId}</div></td>
                <td><span style="color:#2563eb; font-weight:600;">${r.field}</span></td>
                <td><strong style="color:#10b981;">${r.newValue}</strong></td>
                <td>${r.reason}</td>
                <td>
                  <span class="badge ${r.status==='approved'?'badge-present':r.status==='rejected'?'badge-absent':'badge-permission'}">
                    ${r.status==='pending'?'រង់ចាំអនុម័ត':r.status==='approved'?'បានអនុម័ត':'បានបដិសេធ'}
                  </span>
                </td>
                <td>
                  ${r.status === 'pending' ? `
                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-success" style="height:28px; padding:0 8px; font-size:0.75rem;" onclick="approveRequest('${r.id}')">អនុម័ត</button>
                      <button class="btn btn-danger" style="height:28px; padding:0 8px; font-size:0.75rem;" onclick="rejectRequest('${r.id}')">បដិសេធ</button>
                    </div>
                  ` : `<span style="color:#64748b; font-size:0.8rem;">បានដំណើរការរួច</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function approveRequest(id) {
  const req = stmsData.profileRequests.find(r => r.id === id);
  if (!req) return;
  req.status = 'approved';

  // Apply to trainee
  const t = stmsData.trainees.find(x => x.id === req.studentId);
  if (t && req.field.includes('លេខទូរស័ព្ទ')) {
    t.phone = req.newValue;
  }

  saveData();
  showToast(`បានអនុម័តសំណើរបស់ «${req.studentName}» រួចរាល់!`, 'success');
  renderRequestsView(document.getElementById('mainContentArea'));
}

function rejectRequest(id) {
  const req = stmsData.profileRequests.find(r => r.id === id);
  if (!req) return;
  req.status = 'rejected';
  saveData();
  showToast('បានបដិសេធសំណើ', 'info');
  renderRequestsView(document.getElementById('mainContentArea'));
}

// ==========================================================================
// 8. COHORTS, RBAC, & BACKUP VIEWS
// ==========================================================================
function renderCohortsView(container) {
  container.innerHTML = `
    <div class="view-header">
      <div class="view-title-group">
        <h2><i class="fas fa-graduation-cap"></i> ឆ្នាំសិក្សា & ជំនាន់ថ្នាក់បណ្តុះបណ្តាល</h2>
        <p>សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ (KTPTTC)</p>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
      ${stmsData.cohorts.map(c => `
        <div style="background:#ffffff; border-radius:12px; border:1px solid var(--border-color); padding:20px;">
          <h3 style="color:#1e3a8a; font-size:1.1rem; margin-bottom:8px;">${c.nameKh}</h3>
          <p style="font-size:0.85rem; color:#64748b; margin-bottom:12px;">ប្រភេទ៖ <strong>${c.type}</strong></p>
          <div style="font-size:0.82rem; line-height:1.8;">
            <div>🏫 បន្ទប់សិក្សា៖ <strong>${c.rooms.join(', ')}</strong></div>
            <div>👥 ថ្នាក់រៀន៖ <strong>${c.classes.join(', ')}</strong></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ==========================================================================
// 8. USER ACCOUNTS & CREDENTIALS MANAGEMENT (RBAC & Passwords set by Admin)
// ==========================================================================
function renderRBACView(container) {
  const users = stmsData.users || [];
  const adminCount = users.filter(u => u.role === 'admin').length;
  const trainerCount = users.filter(u => u.role === 'trainer').length;
  const traineeCount = users.filter(u => u.role === 'trainee').length;

  container.innerHTML = `
    <div class="view-header">
      <div class="view-title-group">
        <h2><i class="fas fa-users-cog"></i> ការគ្រប់គ្រងគណនីអ្នកប្រើប្រាស់ &amp; ពាក្យសម្ងាត់ (User Management &amp; Passwords)</h2>
        <p>Admin ជាអ្នកចុះឈ្មោះគណនីថ្មី កំណត់ Username, Password, និងតួនាទីសិទ្ធិអំណាចគ្រប់ User ទាំងអស់</p>
      </div>
      <div class="view-actions-group">
        <button class="btn btn-primary" onclick="openRegisterUserModal()">
          <i class="fas fa-user-plus"></i> ចុះឈ្មោះគណនីថ្មី
        </button>
        <button class="btn btn-success" onclick="exportUserCredentialsExcel()">
          <i class="fas fa-file-excel"></i> ទាញយកបញ្ជីគណនី
        </button>
      </div>
    </div>

    <!-- Security Policy Banner -->
    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:14px 18px; margin-bottom:20px; display:flex; align-items:center; gap:14px; box-shadow:0 2px 6px rgba(37,99,235,0.08);">
      <div style="width:44px; height:44px; border-radius:50%; background:#dbeafe; display:flex; align-items:center; justify-content:center; color:#1d4ed8; font-size:1.3rem; flex-shrink:0;">
        <i class="fas fa-shield-alt"></i>
      </div>
      <div style="font-size:0.85rem; color:#1e40af; line-height:1.6;">
        <strong>គោលការណ៍សុវត្ថិភាពចូលប្រើប្រព័ន្ធ៖</strong> គ្រប់ user ទាំងអស់ (Admin, គ្រូឧទ្ទេស, និងគរុសនិស្សិត) ត្រូវមានគណនី Username និង Password ដែលបានចុះឈ្មោះ និងកំណត់ដោយ Admin សិក្សាធិការ ដើម្បីអាច Login ចូលប្រើប្រាស់មុខងារតាមសិទ្ធិអំណាចរៀងខ្លួន។
      </div>
    </div>

    <!-- Summary Metrics -->
    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:14px; margin-bottom:20px;">
      <div style="background:#fff; border:1px solid var(--border-color); border-radius:8px; padding:12px 16px;">
        <div style="font-size:0.75rem; color:#64748b;">គណនីសរុប (Total Users)</div>
        <div style="font-size:1.4rem; font-weight:800; color:#1e3a8a;">${users.length} គណនី</div>
      </div>
      <div style="background:#fff; border:1px solid var(--border-color); border-radius:8px; padding:12px 16px;">
        <div style="font-size:0.75rem; color:#64748b;">អ្នកគ្រប់គ្រង (Admins)</div>
        <div style="font-size:1.4rem; font-weight:800; color:#2563eb;">${adminCount} នាក់</div>
      </div>
      <div style="background:#fff; border:1px solid var(--border-color); border-radius:8px; padding:12px 16px;">
        <div style="font-size:0.75rem; color:#64748b;">គ្រូឧទ្ទេស (Trainers)</div>
        <div style="font-size:1.4rem; font-weight:800; color:#10b981;">${trainerCount} នាក់</div>
      </div>
      <div style="background:#fff; border:1px solid var(--border-color); border-radius:8px; padding:12px 16px;">
        <div style="font-size:0.75rem; color:#64748b;">គរុសនិស្សិត (Trainees)</div>
        <div style="font-size:1.4rem; font-weight:800; color:#d97706;">${traineeCount} នាក់</div>
      </div>
    </div>

    <!-- Users Table Card -->
    <div class="table-card">
      <div class="table-toolbar">
        <strong style="color:#1e3a8a; font-size:0.95rem;">
          <i class="fas fa-list"></i> បញ្ជីគណនីអ្នកប្រើប្រាស់ និងពាក្យសម្ងាត់ (${users.length})
        </strong>
        <span style="font-size:0.8rem; color:#64748b;">Admin អាចកែសម្រួល Username និងកំណត់ពាក្យសម្ងាត់ឡើងវិញបានគ្រប់ពេល</span>
      </div>

      <div class="data-table-responsive">
        <table class="stms-table">
          <thead>
            <tr>
              <th>ល.រ</th>
              <th>អត្តលេខគណនី</th>
              <th>ឈ្មោះអ្នកប្រើប្រាស់</th>
              <th>ឈ្មោះគណនី (Username)</th>
              <th>ពាក្យសម្ងាត់ (Password)</th>
              <th>តួនាទី (Role)</th>
              <th>ទំនាក់ទំនង</th>
              <th>ស្ថានភាព</th>
              <th>សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            ${users.map((u, idx) => {
              const roleBadge = u.role === 'admin' 
                ? 'badge-published' 
                : u.role === 'trainer' 
                ? 'badge-permission' 
                : 'badge-late';
              
              const isSelf = currentUser && currentUser.username === u.username;
              const isMainAdmin = u.id === 'USR-ADM-001';

              return `
                <tr id="userRow-${u.id}">
                  <td>${idx + 1}</td>
                  <td><code>${u.id}</code></td>
                  <td>
                    <strong>${u.avatar || '👤'} ${u.nameKh}</strong>
                    ${u.nameEn ? `<div style="font-size:0.72rem; color:#64748b;">${u.nameEn}</div>` : ''}
                    ${isSelf ? `<span style="font-size:0.65rem; background:#eff6ff; color:#2563eb; padding:1px 5px; border-radius:3px;">(គណនីបច្ចុប្បន្ន)</span>` : ''}
                  </td>
                  <td>
                    <code style="font-weight:700; color:#1e3a8a; font-size:0.9rem;">${u.username}</code>
                  </td>
                  <td>
                    <div style="display:flex; align-items:center; gap:6px;">
                      <span id="pwdText-${u.id}" style="font-family:monospace; font-size:0.85rem; letter-spacing:1px; background:#f1f5f9; padding:2px 8px; border-radius:4px;">••••••••</span>
                      <button type="button" class="btn btn-outline" style="height:24px; padding:0 6px; font-size:0.7rem;" onclick="togglePasswordVisibility('${u.id}', '${u.password}')" title="បង្ហាញ/លាក់">
                        <i class="fas fa-eye" id="pwdEye-${u.id}"></i>
                      </button>
                    </div>
                  </td>
                  <td>
                    <span class="badge ${roleBadge}">
                      ${u.roleLabel || (u.role === 'admin' ? 'Administrator' : u.role === 'trainer' ? 'Trainer / Teacher' : 'Trainee Teacher')}
                    </span>
                    ${u.subject ? `<div style="font-size:0.7rem; color:#64748b; margin-top:2px;">មុខវិជ្ជា៖ ${u.subject}</div>` : ''}
                    ${u.className ? `<div style="font-size:0.7rem; color:#64748b; margin-top:2px;">ថ្នាក់៖ ${u.className}</div>` : ''}
                  </td>
                  <td style="font-size:0.78rem;">
                    <div>${u.email || '-'}</div>
                    <div style="color:#64748b;">${u.phone || '-'}</div>
                  </td>
                  <td>
                    <span class="badge ${u.status === 'disabled' ? 'badge-danger' : 'badge-present'}">
                      ${u.status === 'disabled' ? 'ផ្អាក' : 'សកម្ម'}
                    </span>
                  </td>
                  <td>
                    <div style="display:flex; gap:5px;">
                      <button class="btn btn-outline" style="height:28px; padding:0 8px; font-size:0.75rem;" onclick="openEditUserModal('${u.id}')" title="កែប្រែ & ប្តូរពាក្យសម្ងាត់">
                        <i class="fas fa-key"></i> កែប្រែ
                      </button>
                      ${!isMainAdmin ? `
                        <button class="btn btn-outline" style="height:28px; padding:0 8px; font-size:0.75rem; color:${u.status === 'disabled' ? '#10b981' : '#f59e0b'};" onclick="toggleUserStatus('${u.id}')" title="${u.status === 'disabled' ? 'បើកដំណើរការឡើងវិញ' : 'ផ្អាកគណនី'}">
                          <i class="fas ${u.status === 'disabled' ? 'fa-user-check' : 'fa-user-slash'}"></i>
                        </button>
                        <button class="btn btn-outline" style="height:28px; padding:0 8px; font-size:0.75rem; color:#ef4444;" onclick="deleteUserAccount('${u.id}')" title="លុបគណនី">
                          <i class="fas fa-trash"></i>
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Toggle password text visibility in the table
function togglePasswordVisibility(userId, plainPassword) {
  const span = document.getElementById(`pwdText-${userId}`);
  const eye = document.getElementById(`pwdEye-${userId}`);
  if (!span) return;

  if (span.textContent === '••••••••') {
    span.textContent = plainPassword;
    span.style.background = '#e0f2fe';
    span.style.color = '#0369a1';
    span.style.fontWeight = '700';
    if (eye) { eye.classList.remove('fa-eye'); eye.classList.add('fa-eye-slash'); }
  } else {
    span.textContent = '••••••••';
    span.style.background = '#f1f5f9';
    span.style.color = 'inherit';
    span.style.fontWeight = 'normal';
    if (eye) { eye.classList.remove('fa-eye-slash'); eye.classList.add('fa-eye'); }
  }
}

// Modal: Register New User (Admin sets Username & Password)
function openRegisterUserModal() {
  const modalHtml = `
    <div class="stms-modal-backdrop" id="regUserModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-window" style="max-width:680px;">
        <div class="modal-header-bar">
          <div class="modal-header-title">
            <i class="fas fa-user-plus"></i> ចុះឈ្មោះគណនីថ្មី &amp; កំណត់ពាក្យសម្ងាត់ (Register User &amp; Set Password)
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()">&times;</button>
        </div>
        <div class="modal-body-scroll" style="padding:22px;">
          <form id="registerUserForm" onsubmit="event.preventDefault(); submitRegisterUser();">
            
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:10px 14px; margin-bottom:16px; font-size:0.82rem; color:#1e40af;">
              <i class="fas fa-info-circle"></i> Administrator ជាអ្នកកំណត់ឈ្មោះគណនី (Username) និងពាក្យសម្ងាត់ (Password) សម្រាប់ប្រគល់ជូនអ្នកប្រើប្រាស់ចូលប្រើប្រព័ន្ធ។
            </div>

            <div class="form-grid-2">
              <div>
                <label class="form-label">គោត្តនាម-នាម (ខ្មែរ)*</label>
                <input type="text" id="regNameKh" class="form-input" placeholder="ឧ. ឡាយ សុជាតិ" required>
              </div>
              <div>
                <label class="form-label">ឈ្មោះជាអក្សរឡាតាំង</label>
                <input type="text" id="regNameEn" class="form-input" placeholder="ឧ. Lay Socheat">
              </div>
            </div>

            <div class="form-grid-2">
              <div>
                <label class="form-label">កម្រិតតួនាទីក្នុងប្រព័ន្ធ (Role)*</label>
                <select id="regRole" class="form-input" required onchange="handleRegRoleChange(this.value)">
                  <option value="trainer">Trainer / Teacher (គ្រូឧទ្ទេស / មន្ត្រីបង្រៀន)</option>
                  <option value="trainee">Trainee Teacher (គរុសនិស្សិត)</option>
                  <option value="admin">Administrator (អ្នកគ្រប់គ្រងប្រព័ន្ធ / សិក្សាធិការ)</option>
                </select>
              </div>
              <div>
                <label class="form-label">ឈ្មោះគណនីចូលប្រព័ន្ធ (Username)*</label>
                <input type="text" id="regUsername" class="form-input" placeholder="ឧ. socheat (អក្សរតូច គ្មានដកឃ្លា)" required autocomplete="off">
              </div>
            </div>

            <div class="form-grid-2">
              <div>
                <label class="form-label">ពាក្យសម្ងាត់ដំបូង (Initial Password)*</label>
                <input type="text" id="regPassword" class="form-input" placeholder="ឧ. socheat123" required autocomplete="off" value="ktpttc123">
              </div>
              <div>
                <label class="form-label">លេខទូរស័ព្ទ (Phone)</label>
                <input type="tel" id="regPhone" class="form-input" placeholder="ឧ. 012 345 678">
              </div>
            </div>

            <div class="form-grid-2">
              <div>
                <label class="form-label">អ៊ីមែល (Email)</label>
                <input type="email" id="regEmail" class="form-input" placeholder="ឧ. socheat@ktpttc.edu.kh">
              </div>
              <div id="regExtraFieldWrap">
                <label class="form-label" id="regExtraLabel">មុខវិជ្ជាទទួលបន្ទុក</label>
                <select id="regExtraValue" class="form-input">
                  ${stmsData.subjects.map(s => `<option value="${s.code}">${s.code} - ${s.nameKh}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="modal-footer-bar" style="padding:16px 0 0 0; background:none; border:none; margin-top:14px;">
              <button type="button" class="btn btn-outline" onclick="closeStmsModal()">បោះបង់</button>
              <button type="submit" class="btn btn-primary">
                <i class="fas fa-save"></i> រក្សាទុក &amp; បង្កើតគណនី
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function handleRegRoleChange(role) {
  const wrap = document.getElementById('regExtraFieldWrap');
  const label = document.getElementById('regExtraLabel');
  const select = document.getElementById('regExtraValue');
  if (!wrap || !label || !select) return;

  if (role === 'trainer') {
    wrap.style.display = 'block';
    label.textContent = 'មុខវិជ្ជាទទួលបន្ទុក (Subject)';
    select.innerHTML = stmsData.subjects.map(s => `<option value="${s.code}">${s.code} - ${s.nameKh}</option>`).join('');
  } else if (role === 'trainee') {
    wrap.style.display = 'block';
    label.textContent = 'ថ្នាក់បណ្តុះបណ្តាល (Class)';
    select.innerHTML = `
      <option value="ថ្នាក់បឋម ១២+២ ក្រុម ក">ថ្នាក់បឋម ១២+២ ក្រុម ក</option>
      <option value="ថ្នាក់បឋម ១២+២ ក្រុម ខ">ថ្នាក់បឋម ១២+២ ក្រុម ខ</option>
      <option value="ថ្នាក់មត្តេយ្យ ១២+២">ថ្នាក់មត្តេយ្យ ១២+២</option>
      <option value="ថ្នាក់វិក្រឹតការ វគ្គ១">ថ្នាក់វិក្រឹតការ វគ្គ១</option>
    `;
  } else {
    wrap.style.display = 'none';
  }
}

function submitRegisterUser() {
  const nameKh = document.getElementById('regNameKh').value.trim();
  const nameEn = document.getElementById('regNameEn').value.trim();
  const role = document.getElementById('regRole').value;
  const username = document.getElementById('regUsername').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const extraVal = document.getElementById('regExtraValue')?.value || '';

  if (!username || !password) {
    showToast('សូមបំពេញ Username និង Password ឱ្យបានពេញលេញ!', 'error');
    return;
  }

  // Check if username already exists
  const exists = (stmsData.users || []).some(u => u.username.toLowerCase() === username);
  if (exists) {
    showToast(`ឈ្មោះគណនី «${username}» មានក្នុងប្រព័ន្ធរួចហើយ! សូមជ្រើសរើស Username ផ្សេង។`, 'error');
    return;
  }

  const rolePrefix = role === 'admin' ? 'USR-ADM' : role === 'trainer' ? 'USR-TRN' : 'USR-STU';
  const roleLabel = role === 'admin' ? 'អ្នកគ្រប់គ្រងប្រព័ន្ធ / សិក្សាធិការ' : role === 'trainer' ? 'គ្រូឧទ្ទេស / មន្ត្រីបង្រៀន' : 'គរុសនិស្សិត';
  const newId = `${rolePrefix}-${String((stmsData.users || []).length + 1).padStart(3, '0')}`;

  const newUser = {
    id: newId,
    nameKh,
    nameEn,
    username,
    password,
    role,
    roleLabel,
    email: email || `${username}@ktpttc.edu.kh`,
    phone,
    status: 'active',
    avatar: role === 'admin' ? '👨‍💼' : role === 'trainer' ? '👨‍🏫' : '👨‍🎓'
  };

  if (role === 'trainer') newUser.subject = extraVal;
  if (role === 'trainee') newUser.className = extraVal;

  stmsData.users.push(newUser);
  saveData();
  closeStmsModal();
  renderRBACView(document.getElementById('mainContentArea'));
  showToast(`បានចុះឈ្មោះគណនី «${username}» ដោយជោគជ័យ!`, 'success');
}

// Modal: Edit User & Reset Password (Admin updates Username/Password)
function openEditUserModal(userId) {
  const user = (stmsData.users || []).find(u => u.id === userId);
  if (!user) return;

  const modalHtml = `
    <div class="stms-modal-backdrop" id="editUserModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-window" style="max-width:580px;">
        <div class="modal-header-bar">
          <div class="modal-header-title">
            <i class="fas fa-key"></i> កែប្រែគណនី &amp; កំណត់ពាក្យសម្ងាត់៖ ${user.nameKh}
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()">&times;</button>
        </div>
        <div class="modal-body-scroll" style="padding:22px;">
          <form id="editUserForm" onsubmit="event.preventDefault(); submitEditUser('${user.id}');">
            
            <div class="form-grid-2">
              <div>
                <label class="form-label">ឈ្មោះគណនី (Username)*</label>
                <input type="text" id="editUsername" class="form-input" value="${user.username}" required>
              </div>
              <div>
                <label class="form-label">ពាក្យសម្ងាត់ថ្មី (New Password)*</label>
                <input type="text" id="editPassword" class="form-input" value="${user.password}" required>
              </div>
            </div>

            <div class="form-grid-2">
              <div>
                <label class="form-label">គោត្តនាម-នាម (ខ្មែរ)*</label>
                <input type="text" id="editNameKh" class="form-input" value="${user.nameKh}" required>
              </div>
              <div>
                <label class="form-label">ឈ្មោះឡាតាំង</label>
                <input type="text" id="editNameEn" class="form-input" value="${user.nameEn || ''}">
              </div>
            </div>

            <div class="form-grid-2">
              <div>
                <label class="form-label">តួនាទី (Role)</label>
                <select id="editRole" class="form-input" ${user.id === 'USR-ADM-001' ? 'disabled' : ''}>
                  <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrator</option>
                  <option value="trainer" ${user.role === 'trainer' ? 'selected' : ''}>Trainer / Teacher</option>
                  <option value="trainee" ${user.role === 'trainee' ? 'selected' : ''}>Trainee Teacher</option>
                </select>
              </div>
              <div>
                <label class="form-label">ស្ថានភាពគណនី (Status)</label>
                <select id="editStatus" class="form-input" ${user.id === 'USR-ADM-001' ? 'disabled' : ''}>
                  <option value="active" ${user.status !== 'disabled' ? 'selected' : ''}>សកម្ម (Active)</option>
                  <option value="disabled" ${user.status === 'disabled' ? 'selected' : ''}>ផ្អាកដំណើរការ (Suspended)</option>
                </select>
              </div>
            </div>

            <div class="form-grid-2">
              <div>
                <label class="form-label">អ៊ីមែល (Email)</label>
                <input type="email" id="editEmail" class="form-input" value="${user.email || ''}">
              </div>
              <div>
                <label class="form-label">លេខទូរស័ព្ទ (Phone)</label>
                <input type="tel" id="editPhone" class="form-input" value="${user.phone || ''}">
              </div>
            </div>

            <div class="modal-footer-bar" style="padding:16px 0 0 0; background:none; border:none; margin-top:14px;">
              <button type="button" class="btn btn-outline" onclick="closeStmsModal()">បោះបង់</button>
              <button type="submit" class="btn btn-primary">
                <i class="fas fa-save"></i> រក្សាទុកការផ្លាស់ប្តូរ
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function submitEditUser(userId) {
  const user = (stmsData.users || []).find(u => u.id === userId);
  if (!user) return;

  const newUsername = document.getElementById('editUsername').value.trim().toLowerCase();
  const newPassword = document.getElementById('editPassword').value.trim();
  const newNameKh = document.getElementById('editNameKh').value.trim();
  const newNameEn = document.getElementById('editNameEn').value.trim();
  const newRole = document.getElementById('editRole').value;
  const newStatus = document.getElementById('editStatus').value;
  const newEmail = document.getElementById('editEmail').value.trim();
  const newPhone = document.getElementById('editPhone').value.trim();

  // If username changed, check for conflict
  if (newUsername !== user.username) {
    const exists = stmsData.users.some(u => u.id !== userId && u.username.toLowerCase() === newUsername);
    if (exists) {
      showToast(`ឈ្មោះគណនី «${newUsername}» ត្រូវបានប្រើរួចហើយ!`, 'error');
      return;
    }
  }

  user.username = newUsername;
  user.password = newPassword;
  user.nameKh = newNameKh;
  user.nameEn = newNameEn;
  if (user.id !== 'USR-ADM-001') {
    user.role = newRole;
    user.status = newStatus;
  }
  user.email = newEmail;
  user.phone = newPhone;

  // If editing self, update current session
  if (currentUser && currentUser.id === userId) {
    currentUser = user;
    localStorage.setItem('ktpttc_current_user', JSON.stringify(user));
    sessionStorage.setItem('ktpttc_current_user', JSON.stringify(user));
  }

  saveData();
  closeStmsModal();
  renderRBACView(document.getElementById('mainContentArea'));
  showToast(`បានកែសម្រួលគណនី និងពាក្យសម្ងាត់សម្រាប់ «${newNameKh}» ដោយជោគជ័យ!`, 'success');
}

// Toggle User Active / Disabled status
function toggleUserStatus(userId) {
  const user = (stmsData.users || []).find(u => u.id === userId);
  if (!user || user.id === 'USR-ADM-001') return;

  user.status = user.status === 'disabled' ? 'active' : 'disabled';
  saveData();
  renderRBACView(document.getElementById('mainContentArea'));
  showToast(`បានប្តូរស្ថានភាពគណនី «${user.username}» ទៅជា៖ ${user.status === 'disabled' ? 'ផ្អាក' : 'សកម្ម'}`, 'info');
}

// Delete User Account
function deleteUserAccount(userId) {
  const user = (stmsData.users || []).find(u => u.id === userId);
  if (!user || user.id === 'USR-ADM-001') {
    showToast('មិនអាចលុបគណនី Administrator ចម្បងបានឡើយ!', 'error');
    return;
  }

  if (confirm(`តើអ្នកពិតជាចង់លុបគណនី «${user.nameKh}» (${user.username}) នេះមែនទេ?`)) {
    stmsData.users = stmsData.users.filter(u => u.id !== userId);
    saveData();
    renderRBACView(document.getElementById('mainContentArea'));
    showToast(`បានលុបគណនី «${user.username}» ដោយជោគជ័យ!`, 'success');
  }
}

// Export All User Credentials to CSV / Excel
function exportUserCredentialsExcel() {
  const users = stmsData.users || [];
  const headers = ['អត្តលេខគណនី', 'ឈ្មោះពេញ', 'ឈ្មោះឡាតាំង', 'Username', 'Password', 'តួនាទី (Role)', 'អ៊ីមែល', 'លេខទូរស័ព្ទ', 'ស្ថានភាព'];
  const rows = users.map(u => [u.id, `"${u.nameKh}"`, `"${u.nameEn || ''}"`, u.username, `"${u.password}"`, u.role, u.email || '', u.phone || '', u.status]);
  const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `KTPTTC_User_Credentials_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('បានទាញយកបញ្ជីគណនី និងពាក្យសម្ងាត់រួចរាល់!', 'success');
}

function renderBackupView(container) {
  container.innerHTML = `
    <div class="view-header">
      <div class="view-title-group">
        <h2><i class="fas fa-database"></i> បម្រុងទុក & ស្តារទិន្នន័យ (Database Backup)</h2>
        <p>រក្សាទុកសុវត្ថិភាពទិន្នន័យគរុសនិស្សិត និងប្រព័ន្ធ STMS KTPTTC</p>
      </div>
    </div>

    <div style="background:#ffffff; border-radius:12px; border:1px solid var(--border-color); padding:28px; max-width:600px;">
      <h3 style="color:#1e3a8a; margin-bottom:12px;"><i class="fas fa-download"></i> ទាញយកទិន្នន័យបម្រុងទុក (JSON Export)</h3>
      <p style="font-size:0.85rem; color:#64748b; margin-bottom:18px;">
        ទាញយកទិន្នន័យគរុសនិស្សិត វត្តមាន ពិន្ទុ និងកាលវិភាគទាំងអស់ជារូបវន្ត JSON ដើម្បីរក្សាទុកក្នុងកុំព្យូទ័រ។
      </p>
      <button class="btn btn-primary" onclick="exportDatabaseJson()"><i class="fas fa-file-download"></i> ទាញយក Data Backup (.json)</button>

      <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;">

      <h3 style="color:#d97706; margin-bottom:12px;"><i class="fas fa-upload"></i> ស្តារទិន្នន័យឡើងវិញ (Restore Database)</h3>
      <input type="file" id="restoreFileInput" accept=".json" style="display:none;" onchange="importDatabaseJson(this)">
      <button class="btn btn-warning" onclick="document.getElementById('restoreFileInput').click()"><i class="fas fa-file-import"></i> ជ្រើសរើសឯកសារ Backup ដើម្បីស្តារឡើងវិញ</button>
    </div>
  `;
}

// Database Export / Import Handlers
function exportDatabaseJson() {
  const jsonStr = JSON.stringify(stmsData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `KTPTTC_STMS_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('បានទាញយកទិន្នន័យបម្រុងទុកដោយជោគជ័យ!', 'success');
}

function importDatabaseJson(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.trainees && parsed.academicYears) {
        stmsData = parsed;
        saveData();
        showToast('បានស្តារទិន្នន័យប្រព័ន្ធជោគជ័យ!', 'success');
        renderView('dashboard');
      } else {
        showToast('ឯកសារពុំត្រូវទម្រង់ទិន្នន័យ KTPTTC ទេ!', 'error');
      }
    } catch (err) {
      showToast('កំហុសក្នុងការអានឯកសារ៖ ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// Excel Export Helpers
function exportTraineeRosterExcel() {
  if (stmsData.trainees.length === 0) {
    showToast('ពុំទាន់មានទិន្នន័យគរុសនិស្សិតសម្រាប់ទាញយកទេ។ សូមបញ្ចូលទិន្នន័យជាមុន!', 'warning');
    return;
  }
  const headers = ['អត្តលេខ', 'គោត្តនាម-នាម', 'ភេទ', 'ថ្ងៃខែឆ្នាំកំណើត', 'ថ្នាក់រៀន', 'ជំនាន់', 'លេខទូរស័ព្ទ', 'ទីកន្លែងកំណើត', 'ស្ថានភាព'];
  const rows = stmsData.trainees.map(t => [t.id, t.nameKh, t.gender, t.dob, t.className, t.cohort, t.phone, `"${t.pob}"`, t.status]);
  const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `KTPTTC_Trainee_Roster_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('បានទាញយកបញ្ជីគរុសនិស្សិត CSV/Excel រួចរាល់!', 'success');
}

function exportAttendanceExcel() {
  if (stmsData.attendanceSessions.length === 0) {
    showToast('ពុំទាន់មានទិន្នន័យកំណត់ត្រាវត្តមានសម្រាប់ទាញយកទេ។ សូមស្រង់វត្តមានជាមុន!', 'warning');
    return;
  }
  const headers = ['កាលបរិច្ឆេទ', 'ថ្នាក់រៀន', 'មុខវិជ្ជា', 'អត្តលេខសិស្ស', 'ឈ្មោះគរុសនិស្សិត', 'ស្ថានភាពវត្តមាន'];
  const rows = [];
  stmsData.attendanceSessions.forEach(sess => {
    Object.keys(sess.records).forEach(id => {
      const t = stmsData.trainees.find(x => x.id === id);
      rows.push([sess.date, sess.className, `"${sess.subjectName}"`, id, t?.nameKh || '', sess.records[id]]);
    });
  });
  const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `KTPTTC_Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('បានទាញយករបាយការណ៍វត្តមាន CSV/Excel រួចរាល់!', 'success');
}

function exportFullSummaryExcel() {
  exportTraineeRosterExcel();
}

// Close Active Modal Helper
function closeStmsModal() {
  document.querySelectorAll('.stms-modal-backdrop').forEach(m => m.remove());
}

// Initial Shell Render
function renderApp() {
  renderSidebar();
  renderView(currentView);
  updateAlertBadge();
}

// Reset STMS to initial clean data
function resetStmsDatabase() {
  if (confirm('តើអ្នកពិតជាចង់កំណត់ទិន្នន័យប្រព័ន្ធទៅជាស្ថានភាពដើមវិញមែនទេ? (ទិន្នន័យគរុសនិស្សិតទាំងអស់នឹងត្រូវជម្រះទទេស្អាត)')) {
    localStorage.removeItem('ktpttc_stms_data_v1');
    localStorage.removeItem('ktpttc_stms_data_v2');
    loadData();
    renderApp();
    showToast('បានកំណត់ទិន្នន័យប្រព័ន្ធដើមឡើងវិញជោគជ័យ (ទិន្នន័យគរុសនិស្សិតទទេស្អាត)!', 'success');
  }
}

// ==========================================================================
// MASTER SYSTEM FLOW BLUEPRINT VIEW (កិច្ចដំណើរការគ្រប់គ្រងគ្រប់ជ្រុងជ្រោយ)
// Matching KPTTC PMS Infographic Architecture
// ==========================================================================
function renderSystemFlowView(container) {
  const sampleTrainee = stmsData.trainees[0] || {
    id: "KTPTTC-2026-12P2-001",
    nameKh: "(រង់ចាំការបញ្ចូល)",
    nameEn: "Awaiting Entry",
    gender: "---",
    dob: "--/--/----",
    className: "ថ្នាក់បឋម ១២+២",
    cardNo: "---"
  };

  const attendanceStats = stmsData.dailyAttendanceStats || [
    { day: "ចន្ទ", present: 96, absent: 2, permission: 2 },
    { day: "អង្គារ", present: 98, absent: 1, permission: 1 },
    { day: "ពុធ", present: 93, absent: 4, permission: 3 },
    { day: "ព្រហស្បតិ៍", present: 97, absent: 1, permission: 2 },
    { day: "សុក្រ", present: 95, absent: 2, permission: 3 }
  ];

  const html = `
    <!-- Top Infographic Header (matching user diagram) -->
    <div class="system-flow-wrapper">
      <div class="system-flow-topbar">
        <div class="system-flow-title">
          <h2>កិច្ចដំណើរការគ្រប់គ្រងគ្រប់ជ្រុងជ្រោយនៃសាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ</h2>
          <p>Trainee Management System @ the Regional Teacher Training Center Kratie</p>
        </div>
        <div class="kpttc-pms-badge">
          <img src="assets/ktpttc-logo.png" alt="KPTTC Logo" onerror="this.src='assets/logo.png'">
          <div class="kpttc-pms-text">
            <h3>KPTTC</h3>
            <span>PMS</span>
          </div>
        </div>
      </div>

      <!-- ROW 1: Module 1, Module 2, Module 3 -->
      <div class="flow-modules-row">
        
        <!-- MODULE 1: ម៉ូឌុលរដ្ឋបាល និងគរុសនិស្សិត -->
        <div class="flow-module-box">
          <div class="flow-module-header">
            <span><i class="fas fa-user-shield"></i> 1. ម៉ូឌុលរដ្ឋបាល និងគរុសនិស្សិត</span>
            <i class="fas fa-arrow-right" style="color:#60a5fa;"></i>
          </div>
          <div class="flow-module-body">
            
            <!-- Trainee Profile Card -->
            <div style="font-size:0.75rem; font-weight:700; color:#1e3a8a; margin-bottom:4px;">
              <i class="fas fa-id-card"></i> ប្រវត្តិរូប Profile
            </div>
            <div class="profile-preview-card">
              <div class="trainee-passport-photo" style="background:#2563eb; color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden;">
                ${sampleTrainee.photo ? `<img src="${sampleTrainee.photo}" style="width:100%; height:100%; object-fit:cover;">` : `<i class="fas fa-user-tie" style="font-size:1.6rem;"></i><span style="font-size:0.55rem; margin-top:2px; font-weight:700;">រូបថត</span>`}
              </div>
              <div class="profile-card-details">
                <div><strong>Trainee</strong></div>
                <div>ID: <code>${sampleTrainee.id || '122123220'}</code></div>
                <div>Name: <strong>${sampleTrainee.nameKh}</strong></div>
                <div>DOB: ${sampleTrainee.dob}</div>
                <div>Gender: ${sampleTrainee.gender}</div>
                <div>Class: ${sampleTrainee.className}</div>
                <div>Card no: S20210005531</div>
              </div>
            </div>

            <!-- Enrollment Flowchart -->
            <div style="font-size:0.75rem; font-weight:700; color:#1e3a8a; margin-top:6px; margin-bottom:2px;">
              <i class="fas fa-stream"></i> Enrollment Flowchart
            </div>
            <div class="flowchart-chain">
              <div class="flowchart-step-item" onclick="openEnrollModal()" title="បំពេញទម្រង់ចុះឈ្មោះ">
                <i class="fas fa-file-signature"></i>
                <span>Registration<br>Form</span>
              </div>
              <div class="flowchart-arrow">➔</div>
              <div class="flowchart-step-item" onclick="navigateView('trainees')" title="ផ្ទៀងផ្ទាត់ឯកសារ">
                <i class="fas fa-file-check"></i>
                <span>Document<br>Verification</span>
              </div>
              <div class="flowchart-arrow">➔</div>
              <div class="flowchart-step-item" onclick="viewTraineeCard('${sampleTrainee.id}')" title="បង្កើតលេខសម្គាល់ស្វ័យប្រវត្តិ">
                <i class="fas fa-id-badge"></i>
                <span>ID<br>Generation</span>
              </div>
              <div class="flowchart-arrow">➔</div>
              <div class="flowchart-step-item" onclick="navigateView('backup')" title="ផ្ទុកក្នុង Database">
                <i class="fas fa-database"></i>
                <span>Database<br>Storage</span>
              </div>
            </div>

          </div>

          <!-- Bottom Action Buttons for Module 1 -->
          <div class="flow-action-buttons">
            <button type="button" class="flow-action-btn" onclick="openEnrollModal()">
              <i class="fas fa-user-plus"></i> បង្កើតគណនី
            </button>
            <button type="button" class="flow-action-btn" onclick="openEditStudentModal()">
              <i class="fas fa-edit"></i> កែប្រែព័ត៌មាន
            </button>
            <button type="button" class="flow-action-btn" onclick="exportTraineeRosterExcel()">
              <i class="fas fa-print"></i> បោះពុម្ពព័ត៌មាន
            </button>
            <button type="button" class="flow-action-btn" onclick="viewTraineeCard('${sampleTrainee.id}')">
              <i class="fas fa-id-card"></i> បោះពុម្ពអត្តសញ្ញាណប័ណ្ណ
            </button>
          </div>
        </div>

        <!-- MODULE 2: ម៉ូឌុលកាលវិភាគ និងការសិក្សា -->
        <div class="flow-module-box">
          <div class="flow-module-header">
            <span><i class="fas fa-calendar-alt"></i> 2. ម៉ូឌុលកាលវិភាគ និងការសិក្សា</span>
            <i class="fas fa-arrow-right" style="color:#60a5fa;"></i>
          </div>
          <div class="flow-module-body">
            
            <div style="font-size:0.75rem; font-weight:700; color:#1e3a8a; margin-bottom:4px;">
              <i class="fas fa-calendar-week"></i> Timetable Matrix
            </div>

            <div style="overflow-x:auto;">
              <table class="flow-timetable-table">
                <thead>
                  <tr>
                    <th>ម៉ោង</th>
                    <th>ចន្ទ</th>
                    <th>អង្គារ</th>
                    <th>ពុធ</th>
                    <th>ព្រហ</th>
                    <th>សុក្រ</th>
                    <th>ល្ងាច</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>07:30</strong></td>
                    <td class="tt-pedagogy">គរុកោសល្យ</td>
                    <td class="tt-pedagogy">គរុកោសល្យ</td>
                    <td class="tt-math">គណិតវិទ្យា</td>
                    <td class="tt-pedagogy">គរុកោសល្យ</td>
                    <td class="tt-pedagogy">អនុវត្ត</td>
                    <td style="color:#94a3b8;">សម្រាក</td>
                  </tr>
                  <tr>
                    <td><strong>09:15</strong></td>
                    <td class="tt-math">គណិតវិទ្យា</td>
                    <td class="tt-math">គណិតវិទ្យា</td>
                    <td class="tt-khmer">ភាសាខ្មែរ</td>
                    <td class="tt-pedagogy">គរុកោសល្យ</td>
                    <td class="tt-pedagogy">អនុវត្ត</td>
                    <td style="color:#94a3b8;">សម្រាក</td>
                  </tr>
                  <tr>
                    <td><strong>13:30</strong></td>
                    <td class="tt-khmer">ភាសាខ្មែរ</td>
                    <td class="tt-khmer">ភាសាខ្មែរ</td>
                    <td class="tt-math">គណិតវិទ្យា</td>
                    <td class="tt-khmer">ភាសាខ្មែរ</td>
                    <td class="tt-pedagogy">គរុកោសល្យ</td>
                    <td class="tt-ict">ICT</td>
                  </tr>
                  <tr>
                    <td><strong>15:15</strong></td>
                    <td class="tt-psych">ចិត្តវិទ្យា</td>
                    <td class="tt-pedagogy">គរុកោសល្យ</td>
                    <td class="tt-khmer">ភាសាខ្មែរ</td>
                    <td class="tt-math">គណិតវិទ្យា</td>
                    <td class="tt-pedagogy">គរុកោសល្យ</td>
                    <td class="tt-ict">ICT</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 10px; font-size:0.68rem; color:#475569; display:flex; justify-content:space-between; align-items:center;">
              <span><i class="fas fa-check-circle" style="color:#10b981;"></i> ត្រួតពិនិត្យភាពជាន់គ្នាម៉ោងបង្រៀន: <strong>គ្មានទំនាស់</strong></span>
              <a onclick="navigateView('timetable')" style="color:#2563eb; cursor:pointer; font-weight:700;">មើលលម្អិត</a>
            </div>

          </div>

          <!-- Bottom Action Buttons for Module 2 -->
          <div class="flow-action-buttons">
            <button type="button" class="flow-action-btn" onclick="openSubjectModal()">
              <i class="fas fa-edit"></i> Adding/Editing Subjects
            </button>
            <button type="button" class="flow-action-btn" onclick="openAssignLecturerModal()">
              <i class="fas fa-chalkboard-teacher"></i> Assigning Lecturers
            </button>
          </div>
        </div>

        <!-- MODULE 3: ម៉ូឌុលគ្រប់គ្រងវត្តមាន -->
        <div class="flow-module-box">
          <div class="flow-module-header">
            <span><i class="fas fa-calendar-check"></i> 3. ម៉ូឌុលគ្រប់គ្រងវត្តមាន</span>
            <i class="fas fa-arrow-down" style="color:#60a5fa;"></i>
          </div>
          <div class="flow-module-body">
            
            <div class="attendance-flow-split">
              <!-- Left: Daily Attendance Chart -->
              <div>
                <div style="font-size:0.72rem; font-weight:700; color:#1e3a8a; margin-bottom:4px;">
                  <i class="fas fa-chart-bar"></i> Daily Attendance
                </div>
                <div class="daily-attendance-barchart">
                  ${attendanceStats.map(s => `
                    <div class="chart-day-col" title="${s.day}: វត្តមាន ${s.present} នាក់ | អវត្តមាន ${s.absent}">
                      <div class="chart-bar-stack">
                        <div class="bar-present" style="height:${Math.round(s.present * 0.6)}px;"></div>
                        <div class="bar-absent" style="height:${Math.max(4, s.absent * 6)}px;"></div>
                        <div class="bar-permission" style="height:${Math.max(4, (s.permission || 2) * 5)}px;"></div>
                      </div>
                      <span class="chart-day-label">${s.day}</span>
                    </div>
                  `).join('')}
                </div>
                <div style="display:flex; justify-content:center; gap:6px; font-size:0.58rem; margin-top:4px; font-weight:600;">
                  <span style="color:#10b981;">● វត្តមាន</span>
                  <span style="color:#ef4444;">● អវត្តមាន</span>
                  <span style="color:#f59e0b;">● ច្បាប់</span>
                </div>
              </div>

              <!-- Right: Attendance Table Preview -->
              <div>
                <div style="font-size:0.72rem; font-weight:700; color:#1e3a8a; margin-bottom:4px;">
                  <i class="fas fa-list-check"></i> Attendance Matrix
                </div>
                <div style="overflow-x:auto;">
                  <table style="width:100%; font-size:0.62rem; border-collapse:collapse;">
                    <thead>
                      <tr style="background:#e2e8f0; color:#334155;">
                        <th style="padding:3px;">ឈ្មោះ</th>
                        <th style="padding:3px;">ម៉ោង</th>
                        <th style="padding:3px; color:#10b981;">វត្តមាន</th>
                        <th style="padding:3px; color:#ef4444;">អវត្តមាន</th>
                        <th style="padding:3px; color:#f59e0b;">ច្បាប់</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${stmsData.trainees.length === 0 ? `
                        <tr>
                          <td colspan="5" style="padding:10px; color:#94a3b8; font-size:0.6rem; text-align:center;">រង់ចាំការបញ្ចូលគរុសនិស្សិត</td>
                        </tr>
                      ` : stmsData.trainees.slice(0, 3).map((t, idx) => `
                        <tr style="border-bottom:1px solid #e2e8f0; text-align:center;">
                          <td style="padding:3px; text-align:left; font-weight:600;">${t.avatar} ${t.nameKh.split(' ')[1] || t.nameKh}</td>
                          <td style="padding:3px; color:#64748b;">7:30</td>
                          <td style="padding:3px;"><i class="fas fa-check-circle" style="color:#10b981;"></i></td>
                          <td style="padding:3px;"><span style="color:#cbd5e1;">-</span></td>
                          <td style="padding:3px;"><span style="color:#cbd5e1;">-</span></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>

          <!-- Bottom Action Buttons for Module 3 -->
          <div class="flow-action-buttons">
            <button type="button" class="flow-action-btn" onclick="openMonthlyAttendanceReportModal()">
              <i class="fas fa-clipboard-list"></i> របាយការណ៍ប្រចាំខែ
            </button>
            <button type="button" class="flow-action-btn" onclick="openSemesterAttendanceReportModal()">
              <i class="fas fa-chart-line"></i> របាយការណ៍លើប្រចាំខែ
            </button>
            <button type="button" class="flow-action-btn" onclick="openAutoNotificationModal()">
              <i class="fas fa-bell"></i> ជូនដំណឹងស្វ័យប្រវត្តិ
            </button>
          </div>
        </div>

      </div>

      <!-- ROW 2: Module 4 + Central System Screen -->
      <div class="flow-modules-row-2">
        
        <!-- MODULE 4: ម៉ូឌុលពិន្ទុ និងលទ្ធផល (Grading & Evaluation Module) -->
        <div class="flow-module-box">
          <div class="flow-module-header">
            <span><i class="fas fa-calculator"></i> 4. ម៉ូឌុលពិន្ទុ និងលទ្ធផល (Grading &amp; Evaluation Module)</span>
            <i class="fas fa-arrow-right" style="color:#60a5fa;"></i>
          </div>
          <div class="flow-module-body">
            
            <div class="grading-flow-split">
              <!-- Left: Dashboard Summary Grid -->
              <div>
                <div style="font-size:0.72rem; font-weight:700; color:#1e3a8a; margin-bottom:4px;">
                  <i class="fas fa-th-large"></i> Dashboard Summary
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; font-size:0.6rem;">
                  <div style="background:#0284c7; color:#fff; padding:6px 4px; border-radius:4px; text-align:center; cursor:pointer;" onclick="navigateView('trainees')">
                    <i class="fas fa-user-graduate"></i><br>គ្រប់គ្រងសិស្ស
                  </div>
                  <div style="background:#0d9488; color:#fff; padding:6px 4px; border-radius:4px; text-align:center; cursor:pointer;" onclick="navigateView('attendance')">
                    <i class="fas fa-calendar-check"></i><br>ស្រង់វត្តមាន
                  </div>
                  <div style="background:#059669; color:#fff; padding:6px 4px; border-radius:4px; text-align:center; cursor:pointer;" onclick="navigateView('cohorts')">
                    <i class="fas fa-calendar-alt"></i><br>ឆ្នាំសិក្សា
                  </div>
                  <div style="background:#b91c1c; color:#fff; padding:6px 4px; border-radius:4px; text-align:center; cursor:pointer;" onclick="openAutoNotificationModal()">
                    <i class="fas fa-exclamation-circle"></i><br>អវត្តមានច្រើន
                  </div>
                  <div style="background:#4338ca; color:#fff; padding:6px 4px; border-radius:4px; text-align:center; cursor:pointer;" onclick="navigateView('timetable')">
                    <i class="fas fa-school"></i><br>ថ្នាក់រៀន
                  </div>
                  <div style="background:#d97706; color:#fff; padding:6px 4px; border-radius:4px; text-align:center; cursor:pointer;" onclick="openAutoNotificationModal()">
                    <i class="fas fa-bell"></i><br>ជូនដំណឹង
                  </div>
                </div>
              </div>

              <!-- Center: Score Entry Matrix -->
              <div>
                <div style="font-size:0.72rem; font-weight:700; color:#1e3a8a; margin-bottom:4px;">
                  <i class="fas fa-table"></i> Score Entry Matrix
                </div>
                <div style="overflow-x:auto;">
                  <table class="mini-score-table">
                    <thead>
                      <tr>
                        <th>ល.រ</th>
                        <th>ឈ្មោះ</th>
                        <th>កិច្ចការ</th>
                        <th>វត្តមាន</th>
                        <th>ប្រចាំខែ</th>
                        <th>ឆមាស</th>
                        <th>សរុប</th>
                        <th>និទ្ទេស</th>
                        <th>ចំណាត់</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${stmsData.trainees.length === 0 ? `
                        <tr>
                          <td colspan="9" style="padding:12px; color:#94a3b8; font-size:0.65rem; text-align:center;">មិនទាន់មានទិន្នន័យពិន្ទុ (រង់ចាំការបញ្ចូល)</td>
                        </tr>
                      ` : stmsData.trainees.slice(0, 5).map((t, idx) => {
                        const sc = t.scores['PED-101'] || { homework: 9, attendance: 10, monthly: 28, semester: 45, total: 92, grade: 'A' };
                        return `
                          <tr>
                            <td>${idx + 1}</td>
                            <td style="text-align:left; font-weight:600;">${t.avatar} ${t.nameKh.split(' ')[1] || t.nameKh}</td>
                            <td>${sc.homework}</td>
                            <td>${sc.attendance}</td>
                            <td>${sc.monthly}</td>
                            <td>${sc.semester}</td>
                            <td><strong>${sc.total}</strong></td>
                            <td><span class="badge badge-present" style="font-size:0.65rem; padding:1px 5px;">${sc.grade}</span></td>
                            <td><strong>${idx + 1}</strong></td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Right: Grade Distribution Donut Chart -->
              <div class="donut-chart-wrap">
                <div style="font-size:0.72rem; font-weight:700; color:#1e3a8a; margin-bottom:4px;">
                  <i class="fas fa-chart-pie"></i> Grade Distribution
                </div>
                <svg width="86" height="86" viewBox="0 0 42 42" class="donut">
                  <circle class="donut-ring" cx="21" cy="21" r="15.915" fill="transparent" stroke="#e2e8f0" stroke-width="6"></circle>
                  <!-- Slice A 41% -->
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#3b82f6" stroke-width="6" stroke-dasharray="41 59" stroke-dashoffset="25"></circle>
                  <!-- Slice B 25% -->
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f97316" stroke-width="6" stroke-dasharray="25 75" stroke-dashoffset="84"></circle>
                  <!-- Slice C 16% -->
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#eab308" stroke-width="6" stroke-dasharray="16 84" stroke-dashoffset="59"></circle>
                  <!-- Slice D 9% -->
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#8b5cf6" stroke-width="6" stroke-dasharray="9 91" stroke-dashoffset="43"></circle>
                  <!-- Slice E 6% -->
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#06b6d4" stroke-width="6" stroke-dasharray="6 94" stroke-dashoffset="34"></circle>
                  <!-- Slice F 3% -->
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#ef4444" stroke-width="6" stroke-dasharray="3 97" stroke-dashoffset="28"></circle>
                  <text x="21" y="23" text-anchor="middle" font-size="8" font-weight="bold" fill="#1e3a8a">100%</text>
                </svg>
                <div class="donut-legend">
                  <span style="color:#3b82f6;">● A: 41%</span>
                  <span style="color:#f97316;">● B: 25%</span>
                  <span style="color:#eab308;">● C: 16%</span>
                  <span style="color:#8b5cf6;">● D: 9%</span>
                  <span style="color:#06b6d4;">● E: 6%</span>
                  <span style="color:#ef4444;">● F: 3%</span>
                </div>
              </div>

            </div>

          </div>

          <!-- Bottom Action Buttons for Module 4 -->
          <div class="flow-action-buttons">
            <button type="button" class="flow-action-btn" onclick="recalculateScores()">
              <i class="fas fa-calculator"></i> គណនាស្វ័យប្រវត្តិ
            </button>
            <button type="button" class="flow-action-btn" onclick="openCertificateModal()">
              <i class="fas fa-award"></i> វិញ្ញាបនបត្រ / ប័ណ្ណសរសើរ
            </button>
          </div>
        </div>

      </div>

    </div>
  `;

  container.innerHTML = html;
}

// ==========================================================================
// MODAL HANDLERS FOR SYSTEM FLOW BLUEPRINT
// ==========================================================================

// 1. Certificate of Excellence & Honor Modal
function openCertificateModal(traineeId) {
  const trainee = stmsData.trainees.find(t => t.id === traineeId) || stmsData.trainees[0];
  const modalHtml = `
    <div class="stms-modal-backdrop" id="certModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-window" style="max-width:850px; background:#f8fafc;">
        <div class="modal-header-bar" style="background:#1e3a8a; color:#fff;">
          <div class="modal-header-title"><i class="fas fa-award"></i> វិញ្ញាបនបត្រ / ប័ណ្ណសរសើរគរុសនិស្សិត (Certificate of Excellence)</div>
          <button class="modal-close-icon" onclick="closeStmsModal()" style="color:#fff;">&times;</button>
        </div>
        <div class="modal-body-scroll" style="padding:20px; text-align:center;">
          
          <div class="certificate-print-sheet" id="printableCertificate">
            <!-- Emblem & Cambodia Royal Header -->
            <div class="cert-cambodia-header">
              <div style="font-size:2rem; margin-bottom:4px;">🇰🇭</div>
              <h3>ព្រះរាជាណាចក្រកម្ពុជា</h3>
              <p>ជាតិ សាសនា ព្រះមហាក្សត្រ</p>
              <div style="font-weight:700; color:#1e3a8a; font-size:0.95rem;">ក្រសួងអប់រំ យុវជន និងកីឡា</div>
              <div style="font-weight:700; color:#0f172a; font-size:0.95rem;">សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ (KTPTTC)</div>
            </div>

            <!-- Title -->
            <div class="cert-title-badge">
              ប័ណ្ណសរសើរ និងវិញ្ញាបនបត្រកិត្តិយស
            </div>
            <div style="font-size:0.85rem; color:#64748b; font-weight:600; letter-spacing:1px; margin-bottom:14px;">
              CERTIFICATE OF ACADEMIC EXCELLENCE &amp; MERIT
            </div>

            <p style="font-size:0.92rem; color:#334155; margin-bottom:12px;">
              គណៈគ្រប់គ្រងសាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ សូមបញ្ជាក់ និងប្រគល់ជូន៖
            </p>

            <div class="cert-recipient-name">
              ${trainee.avatar} ${trainee.nameKh}
            </div>
            <div style="font-size:0.95rem; color:#64748b; font-weight:600; margin-bottom:16px;">
              ${trainee.nameEn} &bull; អត្តលេខ៖ <code>${trainee.id}</code>
            </div>

            <p style="font-size:0.92rem; color:#1e293b; max-width:620px; margin:0 auto 18px auto; line-height:1.7;">
              ជាគរុសនិស្សិត <strong>${trainee.className}</strong> ${trainee.cohort} ឆ្នាំសិក្សា ២០២៦-២០២៧ ដែលបានខិតខំប្រឹងប្រែងរៀនសូត្រ គោរពវិន័យ វត្តមានខ្ជាប់ខ្ជួន និងទទួលបានលទ្ធផលឆ្នើម <strong>និទ្ទេស A (កិត្តិយសលេខ ១)</strong> ក្នុងការវាយតម្លៃលទ្ធផលសិក្សាគរុកោសល្យ។
            </p>

            <!-- Seals & Date -->
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:30px; padding:0 30px;">
              <div style="text-align:center;">
                <div style="font-size:0.8rem; color:#64748b;">លេខចុះបញ្ជី៖ KPTTC-2026/CERT-089</div>
                <div style="width:80px; height:80px; border:2px dashed #b45309; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:10px auto 0 auto; color:#b45309; font-size:0.65rem; font-weight:bold;">
                  ត្រាសាលា<br>KTPTTC
                </div>
              </div>
              <div style="text-align:center;">
                <div style="font-size:0.82rem; color:#475569;">ក្រចេះ, ថ្ងៃទី ១៦ ខែ វិច្ឆិកា ឆ្នាំ ២០២៦</div>
                <div style="font-size:0.92rem; font-weight:700; color:#1e3a8a; margin-top:4px;">ប្រធានសាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ</div>
                <div style="height:50px;"></div>
                <div style="font-weight:700; border-top:1px solid #94a3b8; padding-top:4px; font-size:0.88rem;">ហត្ថលេខា និងត្រា</div>
              </div>
            </div>

          </div>

        </div>
        <div class="modal-footer-bar">
          <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
          <button class="btn btn-primary" onclick="window.print()"><i class="fas fa-print"></i> បោះពុម្ពប័ណ្ណសរសើរ (Print A4)</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// 2. Subject Modal (Adding/Editing Subjects)
function openSubjectModal() {
  const modalHtml = `
    <div class="stms-modal-backdrop" id="subjectModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-window" style="max-width:680px;">
        <div class="modal-header-bar">
          <div class="modal-header-title"><i class="fas fa-book"></i> Adding/Editing Subjects (បន្ថែម/កែសម្រួលមុខវិជ្ជា)</div>
          <button class="modal-close-icon" onclick="closeStmsModal()">&times;</button>
        </div>
        <div class="modal-body-scroll" style="padding:20px;">
          <h4 style="color:#1e3a8a; font-size:0.95rem; margin-bottom:12px;">បញ្ជីមុខវិជ្ជាគរុកោសល្យបច្ចុប្បន្ន (${stmsData.subjects.length} មុខវិជ្ជា)</h4>
          <div style="overflow-x:auto; margin-bottom:20px;">
            <table class="stms-table">
              <thead>
                <tr>
                  <th>កូដ</th>
                  <th>ឈ្មោះមុខវិជ្ជា (ខ្មែរ)</th>
                  <th>English</th>
                  <th>ក្រេឌីត</th>
                  <th>ម៉ោង/សប្តាហ៍</th>
                </tr>
              </thead>
              <tbody>
                ${stmsData.subjects.map(s => `
                  <tr>
                    <td><code>${s.code}</code></td>
                    <td><strong>${s.nameKh}</strong></td>
                    <td>${s.nameEn}</td>
                    <td>${s.credits}</td>
                    <td>${s.hoursPerWeek} ម៉ោង</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px;">
            <h4 style="color:#1e3a8a; font-size:0.9rem; margin-bottom:12px;"><i class="fas fa-plus-circle"></i> បន្ថែមមុខវិជ្ជាថ្មី</h4>
            <div class="form-grid-3">
              <div>
                <label class="form-label">កូដមុខវិជ្ជា*</label>
                <input type="text" id="newSubCode" class="form-input" placeholder="ឧ. MOR-108" required>
              </div>
              <div>
                <label class="form-label">ឈ្មោះមុខវិជ្ជា (ខ្មែរ)*</label>
                <input type="text" id="newSubKh" class="form-input" placeholder="ឧ. សីលធម៌ និងពលរដ្ឋវិជ្ជា" required>
              </div>
              <div>
                <label class="form-label">ឈ្មោះឡាតាំង</label>
                <input type="text" id="newSubEn" class="form-input" placeholder="ឧ. Morality & Civics">
              </div>
            </div>
            <div class="form-grid-2" style="margin-top:10px;">
              <div>
                <label class="form-label">ចំនួនក្រេឌីត</label>
                <input type="number" id="newSubCredits" class="form-input" value="3" min="1" max="6">
              </div>
              <div>
                <label class="form-label">ម៉ោងបង្រៀនក្នុងមួយសប្តាហ៍</label>
                <input type="number" id="newSubHours" class="form-input" value="4" min="1" max="10">
              </div>
            </div>
            <button class="btn btn-primary" style="margin-top:14px;" onclick="saveNewSubject()"><i class="fas fa-save"></i> រក្សាទុកមុខវិជ្ជាថ្មី</button>
          </div>
        </div>
        <div class="modal-footer-bar">
          <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function saveNewSubject() {
  const code = document.getElementById('newSubCode')?.value?.trim();
  const nameKh = document.getElementById('newSubKh')?.value?.trim();
  const nameEn = document.getElementById('newSubEn')?.value?.trim() || code;
  const credits = Number(document.getElementById('newSubCredits')?.value || 3);
  const hoursPerWeek = Number(document.getElementById('newSubHours')?.value || 4);

  if (!code || !nameKh) {
    showToast('សូមបញ្ចូលកូដ និងឈ្មោះមុខវិជ្ជា!', 'error');
    return;
  }

  stmsData.subjects.push({ code, nameKh, nameEn, credits, hoursPerWeek });
  saveData();
  closeStmsModal();
  showToast(`បានបញ្ចូលមុខវិជ្ជា «${nameKh}» ដោយជោគជ័យ!`, 'success');
  renderView(currentView);
}

// 3. Assigning Lecturers Modal
function openAssignLecturerModal() {
  const trainers = stmsData.users.filter(u => u.role === 'trainer' || u.role === 'admin');
  const modalHtml = `
    <div class="stms-modal-backdrop" id="assignModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-window" style="max-width:720px;">
        <div class="modal-header-bar">
          <div class="modal-header-title"><i class="fas fa-user-tie"></i> Assigning Lecturers (ចាត់តាំងគ្រូឧទ្ទេស/សាស្ត្រាចារ្យ)</div>
          <button class="modal-close-icon" onclick="closeStmsModal()">&times;</button>
        </div>
        <div class="modal-body-scroll" style="padding:20px;">
          <p style="font-size:0.85rem; color:#64748b; margin-bottom:14px;">
            ចាត់តាំងគ្រូឧទ្ទេសជំនាញទទួលបន្ទុកមុខវិជ្ជានីមួយៗ សម្រាប់ឆ្នាំសិក្សា ២០២៦-២០២៧៖
          </p>
          <div style="overflow-x:auto;">
            <table class="stms-table">
              <thead>
                <tr>
                  <th>មុខវិជ្ជា</th>
                  <th>ក្រេឌីត</th>
                  <th>គ្រូឧទ្ទេសទទួលបន្ទុក</th>
                  <th>បន្ទប់បង្រៀន</th>
                </tr>
              </thead>
              <tbody>
                ${stmsData.subjects.map((s, idx) => `
                  <tr>
                    <td><strong>${s.code}</strong> - ${s.nameKh}</td>
                    <td>${s.credits} ក្រេឌីត</td>
                    <td>
                      <select class="form-input" style="padding:4px 8px; font-size:0.82rem;">
                        ${trainers.map(t => `<option value="${t.id}" ${idx % trainers.length === trainers.indexOf(t) ? 'selected' : ''}>${t.avatar} ${t.nameKh} (${t.roleLabel})</option>`).join('')}
                      </select>
                    </td>
                    <td>
                      <input type="text" class="form-input" value="បន្ទប់ ១០${(idx % 4) + 1}" style="padding:4px 8px; font-size:0.82rem; width:110px;">
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer-bar">
          <button class="btn btn-outline" onclick="closeStmsModal()">បោះបង់</button>
          <button class="btn btn-primary" onclick="closeStmsModal(); showToast('បានរក្សាទុកការចាត់តាំងគ្រូឧទ្ទេសដោយជោគជ័យ!', 'success');">
            <i class="fas fa-save"></i> រក្សាទុកការចាត់តាំង
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// 4. Monthly Attendance Report Modal
function openMonthlyAttendanceReportModal() {
  const modalHtml = `
    <div class="stms-modal-backdrop" id="monthAttModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-window" style="max-width:780px;">
        <div class="modal-header-bar">
          <div class="modal-header-title"><i class="fas fa-clipboard-list"></i> របាយការណ៍វត្តមានប្រចាំខែ (Monthly Attendance Report)</div>
          <button class="modal-close-icon" onclick="closeStmsModal()">&times;</button>
        </div>
        <div class="modal-body-scroll" style="padding:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
            <div>
              <h4 style="color:#1e3a8a; font-size:0.95rem;">សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ</h4>
              <p style="font-size:0.82rem; color:#64748b;">ខែវិច្ឆិកា ឆ្នាំ២០២៦ &bull; ថ្នាក់បឋមសិក្សា ១២+២ ក្រុម ក</p>
            </div>
            <button class="btn btn-outline" onclick="exportAttendanceExcel()"><i class="fas fa-download"></i> ទាញយក Excel</button>
          </div>
          <div style="overflow-x:auto;">
            <table class="stms-table">
              <thead>
                <tr>
                  <th>អត្តលេខ</th>
                  <th>ឈ្មោះគរុសនិស្សិត</th>
                  <th>វត្តមាន (P)</th>
                  <th>ច្បាប់ (L)</th>
                  <th>យឺត (Late)</th>
                  <th>អវត្តមាន (A)</th>
                  <th>អត្រាវត្តមាន</th>
                </tr>
              </thead>
              <tbody>
                ${stmsData.trainees.map(t => {
                  const s = t.attendanceSummary || { present: 44, permission: 2, late: 1, absent: 1, rate: 95.7 };
                  return `
                    <tr>
                      <td><code>${t.id}</code></td>
                      <td><strong>${t.avatar} ${t.nameKh}</strong></td>
                      <td style="color:#10b981; font-weight:700;">${s.present}</td>
                      <td style="color:#f59e0b; font-weight:700;">${s.permission}</td>
                      <td style="color:#6366f1; font-weight:700;">${s.late}</td>
                      <td style="color:#ef4444; font-weight:700;">${s.absent}</td>
                      <td><span class="badge ${s.rate >= 90 ? 'badge-present' : 'badge-absent'}">${s.rate}%</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer-bar">
          <button class="btn btn-outline" onclick="closeStmsModal()">បិទ</button>
          <button class="btn btn-primary" onclick="window.print()"><i class="fas fa-print"></i> បោះពុម្ពរបាយការណ៍</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openSemesterAttendanceReportModal() {
  openMonthlyAttendanceReportModal();
}

// 5. Automatic Notification Modal
function openAutoNotificationModal() {
  const struggling = stmsData.trainees.filter(t => (t.attendanceSummary?.absent || 0) > 3);
  const modalHtml = `
    <div class="stms-modal-backdrop" id="autoNotifyModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-window" style="max-width:680px;">
        <div class="modal-header-bar" style="background:#fee2e2; border-bottom:1px solid #fecaca;">
          <div class="modal-header-title" style="color:#b91c1c;">
            <i class="fas fa-bell"></i> ប្រព័ន្ធជូនដំណឹងស្វ័យប្រវត្តិ (Automatic Disciplinary Alert)
          </div>
          <button class="modal-close-icon" onclick="closeStmsModal()">&times;</button>
        </div>
        <div class="modal-body-scroll" style="padding:20px;">
          <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; margin-bottom:16px; font-size:0.85rem; color:#991b1b;">
            <i class="fas fa-exclamation-triangle"></i> ប្រព័ន្ធបានកំណត់កម្រិតព្រមាន៖ ប្រសិនបើគរុសនិស្សិតអវត្តមានគ្មានច្បាប់លើស <strong>៣ ដង</strong> ក្នុងមួយឆមាស ប្រព័ន្ធនឹងផ្ញើលិខិតព្រមានជាស្វ័យប្រវត្តិតាមរយៈ SMS/Telegram ទៅកាន់សាមីខ្លួន និងអាណាព្យាបាល ព្រមទាំងរាយការណ៍ជូននាយកដ្ឋានសិក្សាធិការ និងវិន័យ។
          </div>

          <h4 style="color:#1e3a8a; font-size:0.92rem; margin-bottom:10px;">
            បញ្ជីគរុសនិស្សិតដែលត្រូវទទួលការព្រមាន (${struggling.length} នាក់)
          </h4>
          ${struggling.length === 0 ? '<p style="color:#64748b; font-size:0.85rem;">ពុំមានគរុសនិស្សិតណាម្នាក់អវត្តមានលើស ៣ ដងឡើយ។ វិន័យល្អប្រសើរ!</p>' : `
            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:18px;">
              ${struggling.map(s => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#fff; border:1px solid #e2e8f0; border-radius:8px;">
                  <div>
                    <strong style="color:#0f172a;">${s.avatar} ${s.nameKh}</strong> (<code>${s.id}</code>)
                    <div style="font-size:0.78rem; color:#64748b;">ថ្នាក់៖ ${s.className} &bull; ទូរស័ព្ទ៖ ${s.phone || '012 345 678'}</div>
                  </div>
                  <div style="text-align:right;">
                    <span class="badge badge-danger">អវត្តមាន ${s.attendanceSummary?.absent} លើក</span>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
        <div class="modal-footer-bar">
          <button class="btn btn-outline" onclick="closeStmsModal()">បោះបង់</button>
          <button class="btn btn-danger" onclick="closeStmsModal(); showToast('បានផ្ញើការជូនដំណឹងស្វ័យប្រវត្តិទៅកាន់គរុសនិស្សិត និងអាណាព្យាបាលរួចរាល់!', 'success');">
            <i class="fas fa-paper-plane"></i> ចេញលិខិត &amp; ផ្ញើការជូនដំណឹងឥឡូវនេះ
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// 6. Recalculate Scores Auto Function
function recalculateScores() {
  stmsData.trainees.forEach(t => {
    Object.keys(t.scores || {}).forEach(subCode => {
      const s = t.scores[subCode];
      const hwPart = (s.homework || 9);
      const attPart = (s.attendance || 10);
      const monPart = (s.monthly || 28);
      const semPart = (s.semester || 45);
      const total = Number((hwPart + attPart + monPart + semPart).toFixed(1));
      s.total = total;
      if (total >= 85) s.grade = "A";
      else if (total >= 75) s.grade = "B";
      else if (total >= 65) s.grade = "C";
      else if (total >= 50) s.grade = "D";
      else if (total >= 40) s.grade = "E";
      else s.grade = "F";
    });
  });

  saveData();
  showToast('បានគណនាពិន្ទុសរុប និងនិទ្ទេសស្វ័យប្រវត្តិតាមរូបមន្តទម្ងន់ពិន្ទុជោគជ័យ!', 'success');
  renderView(currentView);
}


