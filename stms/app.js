/**
 * STMS - Student & Teacher Management System (ប្រព័ន្ធគ្រប់គ្រងគរុសនិស្សិត)
 * សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ (KTPTTC)
 * Core Controller, Workflows & RBAC State Management
 */

// Global State
let stmsData = {};
let currentUser = null; // Active authenticated user object
let currentRole = 'admin'; // 'admin' | 'trainer' | 'trainee'
let currentView = 'flow';
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
  const loginOverlay = document.getElementById('stmsLoginScreen');
  const navbar = document.getElementById('stmsNavbar');
  const layout = document.getElementById('stmsAppLayout');

  if (loginOverlay) loginOverlay.style.display = 'flex';
  if (navbar) navbar.style.display = 'none';
  if (layout) layout.style.display = 'none';

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

  // Center Role Switcher: Visible ONLY to Administrator for role preview
  const navCenterRole = document.getElementById('navCenterRole');
  if (navCenterRole) {
    navCenterRole.style.display = user.role === 'admin' ? 'flex' : 'none';
    document.querySelectorAll('.role-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.role === user.role);
    });
  }

  // Set default starting view
  if (user.role === 'trainee') {
    currentTraineeUser = (stmsData.trainees || []).find(t => t.id === user.studentId) || stmsData.trainees[0] || user;
    currentView = 'trainee-portal';
  } else {
    currentView = 'flow';
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
    currentView = 'flow';
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
      <li class="sidebar-label">កិច្ចដំណើរការប្រព័ន្ធ (Architecture)</li>
      <li><a class="sidebar-item-link ${currentView==='flow'?'active':''}" onclick="navigateView('flow')"><i class="fas fa-project-diagram"></i> <span>កិច្ចដំណើរការប្រព័ន្ធ (System Flow)</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='dashboard'?'active':''}" onclick="navigateView('dashboard')"><i class="fas fa-chart-pie"></i> <span>ផ្ទាំងព័ត៌មាន (Dashboard)</span></a></li>
      
      <li class="sidebar-label">១. ម៉ូឌុលរដ្ឋបាល និងគរុសនិស្សិត</li>
      <li><a class="sidebar-item-link ${currentView==='trainees'?'active':''}" onclick="navigateView('trainees')"><i class="fas fa-user-graduate"></i> <span>ប្រវត្តិគរុសនិស្សិត (Profiles)</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='requests'?'active':''}" onclick="navigateView('requests')"><i class="fas fa-clipboard-list"></i> <span>សំណើកែព័ត៌មាន (Requests)</span></a></li>

      <li class="sidebar-label">២. ម៉ូឌុលកាលវិភាគ និងការសិក្សា</li>
      <li><a class="sidebar-item-link ${currentView==='timetable'?'active':''}" onclick="navigateView('timetable')"><i class="fas fa-calendar-alt"></i> <span>កាលវិភាគបង្រៀន (Timetable)</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='cohorts'?'active':''}" onclick="navigateView('cohorts')"><i class="fas fa-graduation-cap"></i> <span>ឆ្នាំសិក្សា & ជំនាន់ថ្នាក់</span></a></li>

      <li class="sidebar-label">៣. ម៉ូឌុលគ្រប់គ្រងវត្តមាន</li>
      <li><a class="sidebar-item-link ${currentView==='attendance'?'active':''}" onclick="navigateView('attendance')"><i class="fas fa-calendar-check"></i> <span>គ្រប់គ្រងវត្តមាន (Attendance)</span></a></li>

      <li class="sidebar-label">៤. ម៉ូឌុលពិន្ទុ និងលទ្ធផល</li>
      <li><a class="sidebar-item-link ${currentView==='grading'?'active':''}" onclick="navigateView('grading')"><i class="fas fa-calculator"></i> <span>ពិន្ទុ & វាយតម្លៃ (Grading)</span></a></li>

      <li class="sidebar-label">ប្រព័ន្ធ & សុវត្ថិភាព</li>
      <li><a class="sidebar-item-link ${currentView==='rbac'?'active':''}" onclick="navigateView('rbac')"><i class="fas fa-user-shield"></i> <span>សិទ្ធិ & គណនី (RBAC)</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='backup'?'active':''}" onclick="navigateView('backup')"><i class="fas fa-database"></i> <span>បម្រុងទុកទិន្នន័យ (Backup)</span></a></li>
    `;
  } else if (currentRole === 'trainer') {
    menuHtml = `
      <li class="sidebar-label">កិច្ចដំណើរការ & ទំព័រដើម</li>
      <li><a class="sidebar-item-link ${currentView==='flow'?'active':''}" onclick="navigateView('flow')"><i class="fas fa-project-diagram"></i> <span>កិច្ចដំណើរការប្រព័ន្ធ (System Flow)</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='dashboard'?'active':''}" onclick="navigateView('dashboard')"><i class="fas fa-home"></i> <span>ទំព័រដើម</span></a></li>

      <li class="sidebar-label">ការបង្រៀន & វត្តមាន</li>
      <li><a class="sidebar-item-link ${currentView==='attendance'?'active':''}" onclick="navigateView('attendance')"><i class="fas fa-clipboard-check"></i> <span>ស្រង់វត្តមានសិស្ស</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='grading'?'active':''}" onclick="navigateView('grading')"><i class="fas fa-edit"></i> <span>បញ្ចូលពិន្ទុតាមមុខវិជ្ជា</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='timetable'?'active':''}" onclick="navigateView('timetable')"><i class="fas fa-calendar-day"></i> <span>កាលវិភាគបង្រៀនរបស់ខ្ញុំ</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='trainees'?'active':''}" onclick="navigateView('trainees')"><i class="fas fa-users"></i> <span>បញ្ជីឈ្មោះគរុសនិស្សិត</span></a></li>
    `;
  } else if (currentRole === 'trainee') {
    menuHtml = `
      <li class="sidebar-label">កិច្ចដំណើរការ & ផតថល</li>
      <li><a class="sidebar-item-link ${currentView==='flow'?'active':''}" onclick="navigateView('flow')"><i class="fas fa-project-diagram"></i> <span>កិច្ចដំណើរការប្រព័ន្ធ (System Flow)</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='trainee-portal'?'active':''}" onclick="navigateView('trainee-portal')"><i class="fas fa-id-badge"></i> <span>ប្រវត្តិរូប & កាតសម្គាល់</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='trainee-attendance'?'active':''}" onclick="navigateView('trainee-attendance')"><i class="fas fa-user-check"></i> <span>វត្តមានផ្ទាល់ខ្លួន</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='trainee-grades'?'active':''}" onclick="navigateView('trainee-grades')"><i class="fas fa-award"></i> <span>លទ្ធផលពិន្ទុ & និទ្ទេស</span></a></li>
      <li><a class="sidebar-item-link ${currentView==='timetable'?'active':''}" onclick="navigateView('timetable')"><i class="fas fa-calendar-week"></i> <span>កាលវិភាគសិក្សាថ្នាក់</span></a></li>
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
// 1. DASHBOARD & ANALYTICS VIEW (ម៉ូឌុលផ្ទាំងគ្រប់គ្រងសង្ខេប)
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
    <!-- Top System Flow Blueprint Callout Banner -->
    <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb); border-radius: 12px; padding: 18px 22px; color: #ffffff; display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; box-shadow: 0 4px 16px rgba(37,99,235,0.25); flex-wrap:wrap; gap:12px;">
      <div>
        <h3 style="font-family: var(--font-moul); font-size: 1.05rem; margin-bottom: 4px;">
          <i class="fas fa-project-diagram"></i> កិច្ចដំណើរការគ្រប់គ្រងគ្រប់ជ្រុងជ្រោយនៃសាលា (System Flow Blueprint)
        </h3>
        <p style="font-size: 0.82rem; color: #bfdbfe;">
          ស្ដង់ដារទាំង ៤ ម៉ូឌុល៖ 1. រដ្ឋបាលគរុសនិស្សិត &bull; 2. កាលវិភាគសិក្សា &bull; 3. គ្រប់គ្រងវត្តមាន &bull; 4. ពិន្ទុ &amp; វាយតម្លៃ
        </p>
      </div>
      <button class="btn btn-warning" onclick="navigateView('flow')" style="font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
        <i class="fas fa-sitemap"></i> បើកមើលកិច្ចដំណើរការប្រព័ន្ធ (View Flowchart)
      </button>
    </div>

    <!-- View Header -->
    <div class="view-header">
      <div class="view-title-group">
        <h2><i class="fas fa-tachometer-alt"></i> ផ្ទាំងព័ត៌មាន &amp; ស្ថិតិសាលា KTPTTC</h2>
        <p>ប្រព័ន្ធគ្រប់គ្រងគរុសនិស្សិត សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ (ឆ្នាំសិក្សា ២០២៦-២០២៧)</p>
      </div>
      <div class="view-actions-group">
        <button class="btn btn-outline" onclick="navigateView('flow')"><i class="fas fa-project-diagram"></i> កិច្ចដំណើរការប្រព័ន្ធ (Flow)</button>
        ${currentRole === 'admin' ? `
          <button class="btn btn-primary" onclick="openEnrollModal()"><i class="fas fa-user-plus"></i> ចុះឈ្មោះគរុនិស្សិតថ្មី</button>
          <button class="btn btn-outline" onclick="exportFullSummaryExcel()"><i class="fas fa-file-excel"></i> របាយការណ៍សង្ខេប</button>
        ` : ''}
      </div>
    </div>

    <!-- Disciplinary Alert Banner if any Trainee > 3 unexcused absences -->
    ${alertTrainees.length > 0 ? `
      <div class="disciplinary-alert-box">
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

    <!-- KPI Metric Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-left">
          <span>គរុសនិស្សិតសរុប</span>
          <h3>${total} នាក់</h3>
          <p>ស្រី: ${female} (${femalePct}%) | ប្រុស: ${male}</p>
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
          <span>ជំនាន់ & ថ្នាក់បណ្តុះបណ្តាល</span>
          <h3>${stmsData.cohorts.length} ជំនាន់</h3>
          <p>១២+២ បឋម, មត្តេយ្យ, វិក្រឹតការ</p>
        </div>
        <div class="kpi-icon-circle" style="background:#fef3c7; color:#d97706;">
          <i class="fas fa-school"></i>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-left">
          <span>គ្រូឧទ្ទេស & មុខវិជ្ជា</span>
          <h3>${stmsData.subjects.length} មុខវិជ្ជា</h3>
          <p>បង្រៀនដោយគ្រូឧទ្ទេសជំនាញ</p>
        </div>
        <div class="kpi-icon-circle" style="background:#f3e8ff; color:#9333ea;">
          <i class="fas fa-chalkboard-teacher"></i>
        </div>
      </div>
    </div>

    <!-- Analytics & Active Attendance Log -->
    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:20px; margin-bottom:24px;">
      
      <!-- Left: Recent Trainees Table -->
      <div class="table-card">
        <div class="table-toolbar">
          <strong style="color:#1e3a8a; font-size:0.92rem;"><i class="fas fa-users"></i> បញ្ជីគរុសនិស្សិតចុងក្រោយ</strong>
          <a onclick="navigateView('trainees')" style="color:#2563eb; font-size:0.8rem; font-weight:600; cursor:pointer;">មើលទាំងអស់ →</a>
        </div>
        <div class="data-table-responsive">
          <table class="stms-table">
            <thead>
              <tr>
                <th>អត្តលេខ</th>
                <th>ឈ្មោះគរុសនិស្សិត</th>
                <th>ភេទ</th>
                <th>ថ្នាក់រៀន</th>
                <th>វត្តមាន</th>
                <th>ស្ថានភាព</th>
              </tr>
            </thead>
            <tbody>
              ${stmsData.trainees.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align:center; padding:35px 15px; color:#64748b;">
                    <i class="fas fa-inbox fa-2x" style="color:#cbd5e1; margin-bottom:8px; display:block;"></i>
                    <div style="font-weight:700; color:#1e3a8a; font-size:0.95rem;">មិនទាន់មានទិន្នន័យគរុសនិស្សិតទេ</div>
                    <p style="font-size:0.8rem; color:#94a3b8; margin:4px 0 10px 0;">ប្រព័ន្ធរង់ចាំការបញ្ចូលព័ត៌មានពីគ្រូបង្រៀន ឬរដ្ឋបាល</p>
                    <button class="btn btn-primary" style="padding:4px 12px; font-size:0.75rem;" onclick="openEnrollModal()"><i class="fas fa-plus"></i> ចុះឈ្មោះថ្មី</button>
                  </td>
                </tr>
              ` : stmsData.trainees.slice(0, 5).map(t => `
                <tr>
                  <td><code>${t.id}</code></td>
                  <td><strong>${t.avatar} ${t.nameKh}</strong></td>
                  <td>${t.gender}</td>
                  <td>${t.className}</td>
                  <td><strong style="color:${(t.attendanceSummary?.rate||100)>=90?'#10b981':'#f59e0b'};">${t.attendanceSummary?.rate||100}%</strong></td>
                  <td><span class="badge badge-present">${t.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right: Grade Distribution & Cohorts summary -->
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="background:#ffffff; border-radius:10px; border:1px solid var(--border-color); padding:18px;">
          <h4 style="color:#1e3a8a; font-size:0.9rem; margin-bottom:12px;"><i class="fas fa-chart-bar"></i> ការបែងចែកជំនាន់បណ្តុះបណ្តាល</h4>
          <div style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:3px;">
              <span>១២+២ បឋមសិក្សា (ជំនាន់ទី៣៤)</span>
              <span>${Math.round(total * 0.7)} នាក់ (70%)</span>
            </div>
            <div style="height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;"><div style="width:70%; height:100%; background:#2563eb;"></div></div>
          </div>
          <div style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:3px;">
              <span>១២+២ មត្តេយ្យសិក្សា (ជំនាន់ទី៣៤)</span>
              <span>${Math.round(total * 0.2)} នាក់ (20%)</span>
            </div>
            <div style="height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;"><div style="width:20%; height:100%; background:#10b981;"></div></div>
          </div>
          <div>
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:3px;">
              <span>ថ្នាក់វិក្រឹតការនាយក-គ្រូ</span>
              <span>${Math.max(0, total - Math.round(total * 0.9))} នាក់ (10%)</span>
            </div>
            <div style="height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;"><div style="width:10%; height:100%; background:#f59e0b;"></div></div>
          </div>
        </div>

        <div style="background:#ffffff; border-radius:10px; border:1px solid var(--border-color); padding:18px;">
          <h4 style="color:#1e3a8a; font-size:0.9rem; margin-bottom:10px;"><i class="fas fa-bell"></i> សំណើកែព័ត៌មានរង់ចាំការអនុម័ត</h4>
          <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:10px;">
            មានសំណើចំនួន <strong>${stmsData.profileRequests.filter(r=>r.status==='pending').length}</strong> ពីគរុសនិស្សិតកំពុងរង់ចាំការត្រួតពិនិត្យ។
          </p>
          <button class="btn btn-outline" style="width:100%; justify-content:center;" onclick="navigateView('requests')">ពិនិត្យសំណើ</button>
        </div>

        <!-- Library Management Card (matching central diagram screen) -->
        <div style="background:#ffffff; border-radius:10px; border:1px solid var(--border-color); padding:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="color:#1e3a8a; font-size:0.9rem; margin:0;"><i class="fas fa-book"></i> បណ្ណាល័យ Management</h4>
            <a href="/library" target="_blank" style="color:#2563eb; font-size:0.75rem; font-weight:700; text-decoration:none;">បើកបណ្ណាល័យ →</a>
          </div>
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; text-align:center;">
            <div style="background:#eff6ff; padding:8px 4px; border-radius:6px; border:1px solid #dbeafe;">
              <div style="font-size:0.68rem; color:#1e40af;">Total Books</div>
              <strong style="color:#1d4ed8; font-size:0.95rem;">1,485</strong>
            </div>
            <div style="background:#fef3c7; padding:8px 4px; border-radius:6px; border:1px solid #fde68a;">
              <div style="font-size:0.68rem; color:#92400e;">Issue/Return</div>
              <strong style="color:#d97706; font-size:0.95rem;">124 / 110</strong>
            </div>
            <div style="background:#ecfdf5; padding:8px 4px; border-radius:6px; border:1px solid #a7f3d0;">
              <div style="font-size:0.68rem; color:#065f46;">Available</div>
              <strong style="color:#059669; font-size:0.95rem;">1,361</strong>
            </div>
          </div>
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
// 2. TRAINEE PROFILES MANAGEMENT VIEW (ម៉ូឌុលគ្រប់គ្រងប្រវត្តិគរុសនិស្សិត)
// ==========================================================================
function renderTraineesView(container) {
  let html = `
    <div class="view-header">
      <div class="view-title-group">
        <h2><i class="fas fa-user-graduate"></i> ម៉ូឌុលរដ្ឋបាល និងគរុសនិស្សិត (Module 1)</h2>
        <p>គ្រប់គ្រងទិន្នន័យផ្ទាល់ខ្លួន សញ្ញាបត្របាក់ឌុប កាតសម្គាល់ខ្លួន និងស្ថានភាពសិក្សា KTPTTC</p>
      </div>
      <div class="view-actions-group">
        <button class="btn btn-primary" onclick="openEnrollModal()"><i class="fas fa-user-plus"></i> បង្កើតគណនី</button>
        <button class="btn btn-outline" onclick="exportTraineeRosterExcel()"><i class="fas fa-print"></i> បោះពុម្ពព័ត៌មាន</button>
        <button class="btn btn-outline" onclick="viewTraineeCard()"><i class="fas fa-id-card"></i> បោះពុម្ពអត្តសញ្ញាណប័ណ្ណ</button>
        <button class="btn btn-success" onclick="exportTraineeRosterExcel()"><i class="fas fa-file-excel"></i> ទាញយក Excel</button>
      </div>
    </div>

    <!-- Enrollment Flowchart (matching diagram) -->
    <div style="background:#ffffff; border-radius:10px; border:1px solid var(--border-color); padding:14px 18px; margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong style="color:#1e3a8a; font-size:0.85rem;"><i class="fas fa-stream"></i> Enrollment Flowchart (ដំណើរការចុះឈ្មោះគរុសនិស្សិតស្តង់ដារ)</strong>
        <span style="font-size:0.75rem; color:#64748b;">ចុចលើដំណាក់កាលនីមួយៗដើម្បីដំណើរការ</span>
      </div>
      <div class="flowchart-chain" style="padding:10px 16px;">
        <div class="flowchart-step-item" onclick="openEnrollModal()" title="បំពេញទម្រង់ចុះឈ្មោះ">
          <i class="fas fa-file-signature"></i>
          <span>Registration<br>Form</span>
        </div>
        <div class="flowchart-arrow">➔</div>
        <div class="flowchart-step-item" onclick="showToast('ការផ្ទៀងផ្ទាត់ឯកសារ៖ សញ្ញាបត្របាក់ឌុប & អត្តសញ្ញាណប័ណ្ណ', 'info')" title="ផ្ទៀងផ្ទាត់ឯកសារ">
          <i class="fas fa-file-check"></i>
          <span>Document<br>Verification</span>
        </div>
        <div class="flowchart-arrow">➔</div>
        <div class="flowchart-step-item" onclick="viewTraineeCard()" title="បង្កើតលេខសម្គាល់ស្វ័យប្រវត្តិ">
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

    <div class="table-card">
      <div class="table-toolbar">
        <div class="search-input-wrap">
          <i class="fas fa-search"></i>
          <input type="text" id="traineeFilterInput" class="search-input" placeholder="ស្វែងរកតាមឈ្មោះ, អត្តលេខ, ថ្នាក់..." oninput="filterTraineeTable(this.value)">
        </div>

        <div style="display:flex; gap:10px; align-items:center;">
          <select id="cohortFilterSelect" class="form-input" style="width:200px;" onchange="filterTraineeByCohort(this.value)">
            <option value="all">គ្រប់ជំនាន់បណ្តុះបណ្តាល</option>
            ${stmsData.cohorts.map(c => `<option value="${c.nameKh}">${c.nameKh}</option>`).join('')}
          </select>
          <span style="font-size:0.85rem; color:#64748b; font-weight:600;">សរុប: <strong>${stmsData.trainees.length} នាក់</strong></span>
        </div>
      </div>

      <div class="data-table-responsive">
        <table class="stms-table" id="traineesDataTable">
          <thead>
            <tr>
              <th>ល.រ</th>
              <th>អត្តលេខគរុនិស្សិត</th>
              <th>គោត្តនាម-នាម</th>
              <th>ភេទ</th>
              <th>ថ្ងៃខែឆ្នាំកំណើត</th>
              <th>ថ្នាក់រៀន</th>
              <th>បាក់ឌុប (BacII)</th>
              <th>ឯកសារយោង</th>
              <th>ស្ថានភាពសិក្សា</th>
              <th>សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
            ${stmsData.trainees.length === 0 ? `
              <tr>
                <td colspan="10" style="text-align:center; padding:55px 20px; color:#64748b;">
                  <i class="fas fa-user-graduate fa-3x" style="color:#cbd5e1; margin-bottom:14px; display:block;"></i>
                  <div style="font-size:1.1rem; font-weight:700; color:#1e3a8a; margin-bottom:8px;">មិនទាន់មានទិន្នន័យគរុសនិស្សិតនៅឡើយទេ</div>
                  <p style="font-size:0.875rem; color:#94a3b8; max-width:520px; margin:0 auto 18px auto; line-height:1.6;">
                    ប្រព័ន្ធត្រូវបានរៀបចំទទេស្អាត (Clean State) ដោយមិនមានទិន្នន័យសិស្សស្វ័យប្រវត្តិឡើយ ទុកជូនលោកគ្រូ-អ្នកគ្រូ និងរដ្ឋបាលបញ្ចូលផ្ទាល់។
                  </p>
                  <button class="btn btn-primary" onclick="openEnrollModal()"><i class="fas fa-user-plus"></i> ចុះឈ្មោះគរុសនិស្សិតដំបូង</button>
                </td>
              </tr>
            ` : stmsData.trainees.map((t, idx) => `
              <tr data-trainee-row="${t.id}" data-cohort="${t.cohort}">
                <td>${idx + 1}</td>
                <td><code>${t.id}</code></td>
                <td><strong style="color:#0f172a;">${t.avatar} ${t.nameKh}</strong> ${t.nameEn ? `<div style="font-size:0.75rem; color:#64748b;">${t.nameEn}</div>` : ''}</td>
                <td><span style="color:${t.gender==='ស្រី'?'#ec4899':'#0284c7'}; font-weight:700;">${t.gender}</span></td>
                <td>${t.dob}</td>
                <td>${t.className}</td>
                <td><span style="background:#eff6ff; color:#1d4ed8; font-weight:600; padding:2px 6px; border-radius:4px; font-size:0.75rem;">${t.bacii?.grade || 'និទ្ទេស C'}</span></td>
                <td>
                  <span style="color:#10b981; font-size:0.8rem; font-weight:600;"><i class="fas fa-check-circle"></i> ${t.documents?.length || 3} ឯកសារ</span>
                </td>
                <td>
                  <span class="badge ${t.status==='កំពុងសិក្សា'?'badge-present':t.status==='ព្យួរការសិក្សា'?'badge-permission':'badge-draft'}">
                    ${t.status}
                  </span>
                </td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <button class="btn btn-outline" style="height:30px; padding:0 8px;" onclick="viewTraineeCard('${t.id}')" title="មើលកាតសម្គាល់ខ្លួន"><i class="fas fa-id-card"></i></button>
                    ${currentRole === 'admin' ? `
                      <button class="btn btn-outline" style="height:30px; padding:0 8px;" onclick="editTraineeStatus('${t.id}')" title="កែប្រែស្ថានភាព"><i class="fas fa-edit"></i></button>
                      <button class="btn btn-outline" style="height:30px; padding:0 8px; color:#ef4444;" onclick="deleteTraineeRecord('${t.id}')" title="លុប"><i class="fas fa-trash"></i></button>
                    ` : ''}
                  </div>
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

// Enrollment Modal Controller
function openEnrollModal() {
  const currentYear = stmsData.academicYears.find(y => y.isCurrent) || stmsData.academicYears[0];
  const nextIdx = stmsData.trainees.length + 1;
  const autoId = `KTPTTC-2026-12P2-${String(nextIdx).padStart(3, '0')}`;

  const modalHtml = `
    <div class="stms-modal-backdrop" id="enrollModalBackdrop" onclick="if(event.target===this) closeStmsModal()">
      <div class="stms-modal-window" style="max-width:820px;">
        <div class="modal-header-bar">
          <div class="modal-header-title"><i class="fas fa-user-plus"></i> ចុះឈ្មោះគរុសនិស្សិតថ្មី (Trainee Enrollment)</div>
          <button class="modal-close-icon" onclick="closeStmsModal()">&times;</button>
        </div>
        <div class="modal-body-scroll">
          <form id="enrollForm" onsubmit="event.preventDefault(); submitEnrollForm();">
            
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px; margin-bottom:18px; font-size:0.85rem; color:#1e40af;">
              <i class="fas fa-info-circle"></i> លេខសម្គាល់គរុសនិស្សិត (Unique ID) នឹងត្រូវបង្កើតដោយស្វ័យប្រវត្តិតាមស្តង់ដារ KTPTTC និងឆ្នាំសិក្សា។
            </div>

            <div class="form-grid-3">
              <div>
                <label class="form-label">អត្តលេខស្វ័យប្រវត្តិ (Unique ID)*</label>
                <input type="text" id="enrollId" class="form-input" value="${autoId}" readonly style="background:#f1f5f9; font-weight:700;">
              </div>
              <div>
                <label class="form-label">ប្រភេទថ្នាក់បណ្តុះបណ្តាល*</label>
                <select id="enrollType" class="form-input" onchange="updateGeneratedId()">
                  <option value="12+2 (បឋមសិក្សា)">ថ្នាក់ ១២+២ (បឋមសិក្សា)</option>
                  <option value="12+2 (មត្តេយ្យ)">ថ្នាក់ ១២+២ (មត្តេយ្យ)</option>
                  <option value="វិក្រឹតការ">ថ្នាក់វិក្រឹតការគ្រូ-នាយក</option>
                </select>
              </div>
              <div>
                <label class="form-label">ថ្នាក់រៀន*</label>
                <select id="enrollClass" class="form-input">
                  <option value="ថ្នាក់បឋម ១២+២ ក្រុម ក">ថ្នាក់បឋម ១២+២ ក្រុម ក</option>
                  <option value="ថ្នាក់បឋម ១២+២ ក្រុម ខ">ថ្នាក់បឋម ១២+២ ក្រុម ខ</option>
                  <option value="ថ្នាក់មត្តេយ្យ ១២+២">ថ្នាក់មត្តេយ្យ ១២+២</option>
                  <option value="ថ្នាក់វិក្រឹតការ វគ្គ១">ថ្នាក់វិក្រឹតការ វគ្គ១</option>
                </select>
              </div>
            </div>

            <div class="form-grid-3">
              <div>
                <label class="form-label">គោត្តនាម-នាម (ខ្មែរ)*</label>
                <input type="text" id="enrollNameKh" class="form-input" placeholder="ឧ. សុខ ចិន្តា" required>
              </div>
              <div>
                <label class="form-label">ឈ្មោះឡាតាំង</label>
                <input type="text" id="enrollNameEn" class="form-input" placeholder="ឧ. Sok Chenda">
              </div>
              <div>
                <label class="form-label">ភេទ*</label>
                <select id="enrollGender" class="form-input" required>
                  <option value="ប្រុស">ប្រុស (Male)</option>
                  <option value="ស្រី">ស្រី (Female)</option>
                </select>
              </div>
            </div>

            <div class="form-grid-2">
              <div>
                <label class="form-label">ថ្ងៃខែឆ្នាំកំណើត*</label>
                <input type="date" id="enrollDob" class="form-input" required value="2005-01-01">
              </div>
              <div>
                <label class="form-label">លេខទូរស័ព្ទផ្ទាល់ខ្លួន</label>
                <input type="tel" id="enrollPhone" class="form-input" placeholder="ឧ. 012 345 678">
              </div>
            </div>

            <div style="margin-bottom:14px;">
              <label class="form-label">ទីកន្លែងកំណើត (ភូមិ ឃុំ ស្រុក ខេត្ត)</label>
              <input type="text" id="enrollPob" class="form-input" placeholder="ឧ. ឃុំឆ្លូង ស្រុកឆ្លូង ខេត្តក្រចេះ">
            </div>

            <div style="margin-bottom:14px;">
              <label class="form-label">អាសយដ្ឋានបច្ចុប្បន្ន / ទីស្នាក់នៅ</label>
              <input type="text" id="enrollAddress" class="form-input" placeholder="ឧ. អន្តេវាសិកដ្ឋាន KTPTTC">
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; margin-bottom:16px;">
              <h4 style="color:#1e3a8a; font-size:0.85rem; margin-bottom:10px;"><i class="fas fa-file-certificate"></i> ព័ត៌មានសញ្ញាបត្របាក់ឌុប (BacII)</h4>
              <div class="form-grid-3">
                <div>
                  <label class="form-label">សម័យប្រឡង (ឆ្នាំ)</label>
                  <input type="text" id="enrollBacYear" class="form-input" value="2024">
                </div>
                <div>
                  <label class="form-label">លេខតុ / លេខរៀង</label>
                  <input type="text" id="enrollBacRoll" class="form-input" placeholder="ឧ. 54290">
                </div>
                <div>
                  <label class="form-label">និទ្ទេសទទួលបាន</label>
                  <select id="enrollBacGrade" class="form-input">
                    <option value="និទ្ទេស A">និទ្ទេស A</option>
                    <option value="និទ្ទេស B" selected>និទ្ទេស B</option>
                    <option value="និទ្ទេស C">និទ្ទេស C</option>
                    <option value="និទ្ទេស D">និទ្ទេស D</option>
                    <option value="និទ្ទេស E">និទ្ទេស E</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Trainee Login Credentials Setup (Admin issues Username & Password) -->
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:14px; margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4 style="color:#166534; font-size:0.85rem; font-weight:700;">
                  <i class="fas fa-key"></i> កំណត់គណនី Login សម្រាប់គរុសនិស្សិត (កំណត់ដោយ Admin)
                </h4>
                <label style="font-size:0.8rem; color:#15803d; cursor:pointer; font-weight:600;">
                  <input type="checkbox" id="enrollCreateAccount" checked onchange="document.getElementById('enrollAccountFields').style.display=this.checked?'grid':'none'"> បង្កើតគណនីភ្លាមៗ
                </label>
              </div>
              <div class="form-grid-2" id="enrollAccountFields">
                <div>
                  <label class="form-label">ឈ្មោះគណនី (Username)*</label>
                  <input type="text" id="enrollUsername" class="form-input" value="${autoId}">
                </div>
                <div>
                  <label class="form-label">ពាក្យសម្ងាត់ដំបូង (Initial Password)*</label>
                  <input type="text" id="enrollPassword" class="form-input" value="ktpttc123">
                </div>
              </div>
            </div>

            <div class="modal-footer-bar" style="padding:0; background:none; border:none;">
              <button type="button" class="btn btn-outline" onclick="closeStmsModal()">បោះបង់</button>
              <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> រក្សាទុក & បង្កើតអត្តលេខ</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
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
              <img src="assets/logo_ptec.svg" style="width:36px; height:36px; background:#fff; border-radius:50%; padding:2px;" onerror="this.src='assets/logo.png'">
              <div style="text-align:left;">
                <div style="font-size:0.75rem; font-weight:700; color:#93c5fd;">សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ</div>
                <div style="font-size:0.65rem; color:#cbd5e1;">TRAINEE TEACHER IDENTITY CARD</div>
              </div>
            </div>

            <!-- Card Body -->
            <div style="display:flex; gap:14px; align-items:center; margin:10px 0;">
              <div style="width:72px; height:85px; background:#0f172a; border:2px solid #3b82f6; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:2.4rem; overflow:hidden;">
                ${t.avatar}
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
        <div class="modal-footer-bar" style="justify-content:center;">
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
// 6. TRAINEE PORTAL VIEW (ផតថលផ្ទាល់ខ្លួនគរុសនិស្សិត)
// ==========================================================================
function renderTraineePortalView(container) {
  const t = currentTraineeUser || (stmsData.trainees.length > 0 ? stmsData.trainees[0] : null);
  if (!t) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h2><i class="fas fa-id-badge"></i> ផតថលផ្ទាល់ខ្លួនរបស់គរុសនិស្សិត</h2>
          <p>ប្រព័ន្ធគ្រប់គ្រងគរុសនិស្សិត សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ (KTPTTC)</p>
        </div>
      </div>
      <div style="background:#ffffff; border-radius:12px; border:1px solid var(--border-color); padding:50px 20px; text-align:center;">
        <i class="fas fa-user-clock fa-3x" style="color:#cbd5e1; margin-bottom:14px; display:block;"></i>
        <h3 style="color:#1e3a8a; font-size:1.15rem; margin-bottom:8px;">មិនទាន់មានទិន្នន័យគរុសនិស្សិតនៅក្នុងប្រព័ន្ធនៅឡើយទេ</h3>
        <p style="font-size:0.88rem; color:#64748b; max-width:500px; margin:0 auto 18px auto; line-height:1.6;">
          ប្រព័ន្ធត្រូវបានកំណត់ទទេស្អាតតាមការណែនាំ ដោយមិនមានទិន្នន័យសិស្សស្វ័យប្រវត្តិឡើយ ដើម្បីរង់ចាំគ្រូបង្រៀន ឬរដ្ឋបាលបញ្ចូលទិន្នន័យគរុសនិស្សិតពិតប្រាកដ។
        </p>
        <button class="btn btn-primary" onclick="openEnrollModal()"><i class="fas fa-user-plus"></i> ចុះឈ្មោះគរុសនិស្សិតដំបូង</button>
      </div>
    `;
    return;
  }

  let html = `
    <div class="view-header">
      <div class="view-title-group">
        <h2><i class="fas fa-id-badge"></i> ផតថលផ្ទាល់ខ្លួនរបស់គរុសនិស្សិត</h2>
        <p>សូមស្វាគមន៍មកកាន់ប្រព័ន្ធ STMS KTPTTC • គរុសនិស្សិត៖ <strong>${t.nameKh}</strong> (${t.id})</p>
      </div>
      <div class="view-actions-group">
        <button class="btn btn-primary" onclick="viewTraineeCard('${t.id}')"><i class="fas fa-id-card"></i> បើកកាតសម្គាល់ខ្លួន</button>
        <button class="btn btn-outline" onclick="navigateView('trainee-request')"><i class="fas fa-edit"></i> ស្នើសុំកែប្រែព័ត៌មាន</button>
      </div>
    </div>

    <!-- Top Profile Summary Card -->
    <div style="background:#ffffff; border-radius:12px; border:1px solid var(--border-color); padding:24px; margin-bottom:24px; display:flex; gap:24px; align-items:center; flex-wrap:wrap;">
      <div style="width:90px; height:90px; border-radius:50%; background:#eff6ff; border:3px solid #3b82f6; display:flex; align-items:center; justify-content:center; font-size:3rem;">
        ${t.avatar}
      </div>
      <div style="flex:1;">
        <h3 style="font-size:1.3rem; color:#1e3a8a; margin-bottom:4px;">${t.nameKh} <span style="font-size:0.9rem; color:#64748b;">(${t.nameEn||''})</span></h3>
        <p style="font-size:0.88rem; color:#475569; margin-bottom:8px;">
          អត្តលេខ៖ <code style="font-weight:700; color:#2563eb;">${t.id}</code> • ថ្នាក់៖ <strong>${t.className}</strong> (${t.cohort})
        </p>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <span class="badge badge-present">ស្ថានភាព៖ ${t.status}</span>
          <span class="badge badge-published">បាក់ឌុប៖ ${t.bacii?.grade || 'និទ្ទេស B'}</span>
          <span class="badge badge-permission">វត្តមាន៖ ${t.attendanceSummary?.rate || 100}%</span>
        </div>
      </div>
    </div>

    <!-- Quick Cards: Attendance & Grades -->
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:24px;">
      
      <!-- My Attendance Summary -->
      <div class="table-card">
        <div class="table-toolbar">
          <strong style="color:#1e3a8a;"><i class="fas fa-calendar-check"></i> វត្តមានផ្ទាល់ខ្លួន</strong>
          <button class="btn btn-outline" style="height:28px; padding:0 8px; font-size:0.75rem;" onclick="navigateView('trainee-attendance')">ពិនិត្យលម្អិត →</button>
        </div>
        <div style="padding:20px;">
          <div style="font-size:2.2rem; font-weight:800; color:#10b981; margin-bottom:8px;">
            ${t.attendanceSummary?.rate || 100}%
          </div>
          <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; text-align:center; font-size:0.8rem;">
            <div style="background:#f0fdf4; padding:8px; border-radius:6px;"><div style="font-weight:700; color:#15803d;">${t.attendanceSummary?.present||0}</div><div>វត្តមាន</div></div>
            <div style="background:#fffbeb; padding:8px; border-radius:6px;"><div style="font-weight:700; color:#b45309;">${t.attendanceSummary?.permission||0}</div><div>ច្បាប់</div></div>
            <div style="background:#fff7ed; padding:8px; border-radius:6px;"><div style="font-weight:700; color:#c2410c;">${t.attendanceSummary?.late||0}</div><div>យឺត</div></div>
            <div style="background:#fef2f2; padding:8px; border-radius:6px;"><div style="font-weight:700; color:#b91c1c;">${t.attendanceSummary?.absent||0}</div><div>ឥតច្បាប់</div></div>
          </div>
        </div>
      </div>

      <!-- My Grades Summary -->
      <div class="table-card">
        <div class="table-toolbar">
          <strong style="color:#1e3a8a;"><i class="fas fa-award"></i> លទ្ធផលពិន្ទុ & និទ្ទេស</strong>
          <button class="btn btn-outline" style="height:28px; padding:0 8px; font-size:0.75rem;" onclick="navigateView('trainee-grades')">ពិនិត្យលម្អិត →</button>
        </div>
        <div style="padding:20px;">
          <p style="font-size:0.85rem; color:#475569; margin-bottom:12px;">
            ពិន្ទុដែលត្រូវបានផ្សព្វផ្សាយជាផ្លូវការដោយការិយាល័យសិក្សាធិការ KTPTTC៖
          </p>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${Object.keys(t.scores || {}).map(code => {
              const sc = t.scores[code];
              if (sc.status !== 'published') return '';
              const subj = stmsData.subjects.find(s => s.code === code);
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:8px 12px; border-radius:6px; font-size:0.85rem;">
                  <span>${subj?.nameKh || code}</span>
                  <strong>${sc.total} / 100 <span class="badge ${sc.grade==='A'?'badge-present':'badge-published'}">${sc.grade}</span></strong>
                </div>
              `;
            }).join('') || '<div style="color:#94a3b8; font-size:0.85rem;">មិនទាន់មានពិន្ទុត្រូវបានផ្សព្វផ្សាយនៅឡើយទេ។</div>'}
          </div>
        </div>
      </div>

    </div>
  `;

  container.innerHTML = html;
}

function renderTraineeAttendanceView(container) {
  const t = currentTraineeUser || (stmsData.trainees.length > 0 ? stmsData.trainees[0] : null);
  if (!t) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h2><i class="fas fa-user-check"></i> កំណត់ត្រាវត្តមានផ្ទាល់ខ្លួន</h2>
          <p>ពិនិត្យវត្តមាន និងអវត្តមានប្រចាំឆមាស</p>
        </div>
        <button class="btn btn-outline" onclick="navigateView('trainee-portal')">← ត្រឡប់ក្រោយ</button>
      </div>
      <div style="background:#fff; border-radius:10px; border:1px solid var(--border-color); padding:40px; text-align:center; color:#64748b;">
        <i class="fas fa-inbox fa-3x" style="color:#cbd5e1; margin-bottom:12px; display:block;"></i>
        <h4 style="color:#1e3a8a;">មិនទាន់មានទិន្នន័យគរុសនិស្សិតនៅឡើយទេ</h4>
        <p style="font-size:0.85rem; color:#94a3b8; margin-top:6px;">សូមចុះឈ្មោះគរុសនិស្សិតជាមុនសិន។</p>
      </div>
    `;
    return;
  }
  container.innerHTML = `
    <div class="view-header">
      <div class="view-title-group">
        <h2><i class="fas fa-user-check"></i> កំណត់ត្រាវត្តមានផ្ទាល់ខ្លួន៖ ${t.nameKh}</h2>
        <p>ពិនិត្យវត្តមាន និងអវត្តមានប្រចាំឆមាស</p>
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
              ${stmsData.attendanceSessions.map(sess => {
                const st = sess.records[t.id] || 'present';
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
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderTraineeGradesView(container) {
  const t = currentTraineeUser || (stmsData.trainees.length > 0 ? stmsData.trainees[0] : null);
  if (!t) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h2><i class="fas fa-award"></i> លទ្ធផលសិក្សា និងពិន្ទុផ្លូវការ</h2>
          <p>ពិន្ទុដែលបានផ្ទៀងផ្ទាត់ និងផ្សព្វផ្សាយដោយការិយាល័យសិក្សាធិការ KTPTTC</p>
        </div>
        <button class="btn btn-outline" onclick="navigateView('trainee-portal')">← ត្រឡប់ក្រោយ</button>
      </div>
      <div style="background:#fff; border-radius:10px; border:1px solid var(--border-color); padding:40px; text-align:center; color:#64748b;">
        <i class="fas fa-inbox fa-3x" style="color:#cbd5e1; margin-bottom:12px; display:block;"></i>
        <h4 style="color:#1e3a8a;">មិនទាន់មានទិន្នន័យគរុសនិស្សិតនៅឡើយទេ</h4>
        <p style="font-size:0.85rem; color:#94a3b8; margin-top:6px;">សូមចុះឈ្មោះគរុសនិស្សិតជាមុនសិន។</p>
      </div>
    `;
    return;
  }
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
              const subj = stmsData.subjects.find(s => s.code === code);
              return `
                <tr>
                  <td><code>${code}</code></td>
                  <td><strong>${subj?.nameKh || code}</strong></td>
                  <td>${sc.homework}</td>
                  <td>${sc.attendance}</td>
                  <td>${sc.monthly}</td>
                  <td>${sc.semester}</td>
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
  const t = currentTraineeUser || (stmsData.trainees.length > 0 ? stmsData.trainees[0] : null);
  if (!t) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h2><i class="fas fa-paper-plane"></i> ស្នើសុំកែប្រែព័ត៌មានផ្ទាល់ខ្លួន</h2>
          <p>សំណើនឹងត្រូវត្រួតពិនិត្យ និងអនុម័តដោយការិយាល័យរដ្ឋបាល/សិក្សាធិការ</p>
        </div>
        <button class="btn btn-outline" onclick="navigateView('trainee-portal')">← ត្រឡប់ក្រោយ</button>
      </div>
      <div style="background:#fff; border-radius:10px; border:1px solid var(--border-color); padding:40px; text-align:center; color:#64748b;">
        <i class="fas fa-inbox fa-3x" style="color:#cbd5e1; margin-bottom:12px; display:block;"></i>
        <h4 style="color:#1e3a8a;">មិនទាន់មានទិន្នន័យគរុសនិស្សិតនៅឡើយទេ</h4>
        <p style="font-size:0.85rem; color:#94a3b8; margin-top:6px;">សូមចុះឈ្មោះគរុសនិស្សិតជាមុនសិន។</p>
      </div>
    `;
    return;
  }
  container.innerHTML = `
    <div class="view-header">
      <div class="view-title-group">
        <h2><i class="fas fa-paper-plane"></i> ស្នើសុំកែប្រែព័ត៌មានផ្ទាល់ខ្លួន</h2>
        <p>សំណើនឹងត្រូវត្រួតពិនិត្យ និងអនុម័តដោយការិយាល័យរដ្ឋបាល/សិក្សាធិការ</p>
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
  const t = currentTraineeUser || stmsData.trainees[0];
  const field = document.getElementById('reqField').value;
  const newVal = document.getElementById('reqNewVal').value.trim();
  const reason = document.getElementById('reqReason').value.trim();

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
              <div class="trainee-passport-photo" style="background:#2563eb; color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                <i class="fas fa-user-tie" style="font-size:1.6rem;"></i>
                <span style="font-size:0.55rem; margin-top:2px; font-weight:700;">រូបថត</span>
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
            <button type="button" class="flow-action-btn" onclick="navigateView('trainees')">
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

        <!-- Central System Screen (Computer Monitor Representation) -->
        <div class="system-monitor-device">
          <div class="monitor-screen-inner">
            
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:6px; margin-bottom:8px;">
              <span style="font-weight:700; color:#38bdf8; font-size:0.75rem;"><i class="fas fa-desktop"></i> KTPTTC STMS Live Monitor</span>
              <span style="background:#0369a1; color:#ffffff; font-size:0.6rem; padding:2px 8px; border-radius:10px;">Connected v2.0</span>
            </div>

            <!-- Library Management Block (matching bottom right of diagram) -->
            <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px; margin-bottom:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <strong style="color:#f8fafc; font-size:0.72rem;"><i class="fas fa-book"></i> បណ្ណាល័យ Management</strong>
                <a href="/library" target="_blank" style="color:#38bdf8; font-size:0.65rem; text-decoration:none;">បើកបណ្ណាល័យ →</a>
              </div>
              <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px; text-align:center;">
                <div style="background:#1e293b; padding:4px; border-radius:4px;">
                  <div style="font-size:0.6rem; color:#94a3b8;">Total Books</div>
                  <strong style="color:#38bdf8; font-size:0.78rem;">1,485</strong>
                </div>
                <div style="background:#1e293b; padding:4px; border-radius:4px;">
                  <div style="font-size:0.6rem; color:#94a3b8;">Issue/Return</div>
                  <strong style="color:#f59e0b; font-size:0.78rem;">124 / 110</strong>
                </div>
                <div style="background:#1e293b; padding:4px; border-radius:4px;">
                  <div style="font-size:0.6rem; color:#94a3b8;">Available</div>
                  <strong style="color:#10b981; font-size:0.78rem;">1,361</strong>
                </div>
              </div>
            </div>

            <!-- User Roles Tree Diagram (matching diagram) -->
            <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px;">
              <div style="font-size:0.7rem; font-weight:700; color:#f8fafc; margin-bottom:6px;">
                <i class="fas fa-users-cog"></i> User Roles &amp; RBAC Hierarchy
              </div>
              <div style="display:flex; flex-direction:column; align-items:center; gap:4px; font-size:0.65rem;">
                <div style="background:#1e3a8a; color:#fff; padding:3px 12px; border-radius:12px; font-weight:700; border:1px solid #3b82f6; cursor:pointer;" onclick="switchRole('admin')">
                  <i class="fas fa-shield-alt"></i> Administrator (គ្រប់គ្រងប្រព័ន្ធ)
                </div>
                <div style="color:#64748b; font-size:0.7rem;">↓</div>
                <div style="background:#0369a1; color:#fff; padding:3px 12px; border-radius:12px; font-weight:700; border:1px solid #38bdf8; cursor:pointer;" onclick="switchRole('trainer')">
                  <i class="fas fa-chalkboard-teacher"></i> Trainer / Teacher (គ្រូឧទ្ទេស)
                </div>
                <div style="color:#64748b; font-size:0.7rem;">↓</div>
                <div style="background:#047857; color:#fff; padding:3px 12px; border-radius:12px; font-weight:700; border:1px solid #10b981; cursor:pointer;" onclick="switchRole('trainee')">
                  <i class="fas fa-user-graduate"></i> Trainee Teacher (គរុសនិស្សិត)
                </div>
              </div>
            </div>

          </div>
          <!-- Monitor stand -->
          <div class="monitor-stand"></div>
          <div class="monitor-base"></div>
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


