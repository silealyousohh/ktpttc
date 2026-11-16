/**
 * KruSmart - Teacher Digital Guide & Classroom Management System
 * Core Application Logic, State Management & Interactive Modals
 */

// Application State
let appData = { ...window.KRUSMART_DATA };

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadPersistedData();
  initTheme();
  checkAuth();
  setupEventListeners();
  updateClockPill();
  updateRosterStatusBanner();
  setInterval(updateClockPill, 60000);

  // Check if returning from add-student
  if (sessionStorage.getItem('openView') === 'student-info' || window.location.hash.includes('student')) {
    sessionStorage.removeItem('openView');
    setTimeout(() => {
      openStudentInfoModal();
    }, 150);
  }
});

// Load data from LocalStorage
function loadPersistedData() {
  try {
    // Clear old auto-generated mock students if present from v1
    const oldSaved = localStorage.getItem('krusmart_students_data');
    if (oldSaved && oldSaved.includes('Keo Visal')) {
      localStorage.removeItem('krusmart_students_data');
    }

    const saved = localStorage.getItem('krusmart_teacher_custom_students');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        appData.students = parsed;
      } else if (parsed && Array.isArray(parsed.students)) {
        appData.students = parsed.students;
      } else {
        appData.students = [];
      }
    } else {
      // Default: Clean & empty roster (left for teachers to enter themselves)
      appData.students = [];
    }
  } catch (e) {
    console.error('Failed to load local data:', e);
    appData.students = [];
  }
}

// Save data to LocalStorage
function persistData() {
  try {
    localStorage.setItem('krusmart_teacher_custom_students', JSON.stringify(appData.students));
    if (appData.classes && appData.classes.length > 0) {
      appData.classes[0].studentCount = appData.students.length;
    }
    updateRosterStatusBanner();
  } catch (e) {
    console.error('Failed to persist data:', e);
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#2563eb';
  toast.style.cssText = `background:${bg};color:#ffffff;padding:12px 20px;border-radius:10px;font-size:0.88rem;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.3);display:flex;align-items:center;gap:10px;animation:slideUp 0.25s ease;`;
  toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i> <span>${message}</span>`;
  
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('krusmart_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
  updateThemeIcon();
}

function toggleTheme() {
  document.body.classList.toggle('light-mode');
  const current = document.body.classList.contains('light-mode') ? 'light' : 'dark';
  localStorage.setItem('krusmart_theme', current);
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    const isLight = document.body.classList.contains('light-mode');
    btn.innerHTML = isLight ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    btn.title = isLight ? 'ប្ដូរទៅ Dark Mode' : 'ប្ដូរទៅ Light Mode';
  }
}

// Authentication Logic
function checkAuth() {
  const auth = localStorage.getItem('krusmart_auth');
  const loginScreen = document.getElementById('loginScreen');
  const dashboardScreen = document.getElementById('dashboardScreen');

  if (auth) {
    if (loginScreen) loginScreen.style.display = 'none';
    if (dashboardScreen) dashboardScreen.style.display = 'flex';
  } else {
    if (loginScreen) loginScreen.style.display = 'flex';
    if (dashboardScreen) dashboardScreen.style.display = 'none';
  }
}

function handleLogin(email, password) {
  if (!email || !email.includes('@')) {
    showToast('សូមបញ្ចូលអាសយដ្ឋានអ៊ីមែលឱ្យបានត្រឹមត្រូវ!', 'error');
    return;
  }
  localStorage.setItem('krusmart_auth', JSON.stringify({ email, loggedInAt: new Date().toISOString() }));
  showToast('ចូលគណនីបានជោគជ័យ! សូមស្វាគមន៍មកកាន់ KruSmart', 'success');
  checkAuth();
}

function handleGoogleLogin() {
  const email = 'sileal.yousohh@gmail.com';
  localStorage.setItem('krusmart_auth', JSON.stringify({ email, provider: 'google', loggedInAt: new Date().toISOString() }));
  showToast('បានចូលគណនីតាម Google ដោយជោគជ័យ!', 'success');
  checkAuth();
}

function handleLogout() {
  localStorage.removeItem('krusmart_auth');
  showToast('បានចាកចេញពីគណនីរួចរាល់', 'info');
  checkAuth();
}

function togglePasswordVisibility() {
  const pwdInput = document.getElementById('loginPassword');
  const toggleBtn = document.getElementById('pwdToggleBtn');
  if (pwdInput && toggleBtn) {
    const isPassword = pwdInput.type === 'password';
    pwdInput.type = isPassword ? 'text' : 'password';
    toggleBtn.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i> លាក់' : '<i class="fas fa-eye"></i> បង្ហាញ';
  }
}

// Update Top Pill Countdown
function updateClockPill() {
  const pill = document.getElementById('nextClassPill');
  if (!pill) return;
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  pill.innerHTML = `<i class="fas fa-compass" style="color: #60a5fa;"></i> <span>ម៉ោង ${hours}:${minutes} — ត្រៀមការបង្រៀនម៉ោងបន្ទាប់ (${appData.currentTeacher.assignedClass})</span>`;
}

// Update Dashboard Roster Status Banner
function updateRosterStatusBanner() {
  const banner = document.getElementById('rosterStatusBanner');
  if (!banner) return;

  const total = appData.students.length;
  const female = appData.students.filter(s => s.gender === 'ស្រី').length;
  const male = total - female;

  if (total === 0) {
    banner.innerHTML = `
      <div style="background:linear-gradient(135deg, rgba(37,99,235,0.14), rgba(16,185,129,0.14)); border:1px solid rgba(59,130,246,0.35); border-radius:14px; padding:16px 20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; box-shadow:0 8px 24px rgba(0,0,0,0.25);">
        <div style="display:flex; align-items:center; gap:14px;">
          <div style="width:44px; height:44px; border-radius:10px; background:rgba(37,99,235,0.25); border:1px solid rgba(59,130,246,0.5); display:flex; align-items:center; justify-content:center; color:#60a5fa; font-size:1.3rem;">
            <i class="fas fa-user-plus"></i>
          </div>
          <div>
            <div style="color:#f8fafc; font-weight:700; font-size:0.96rem; margin-bottom:3px;">
              📝 បញ្ជីសិស្សទទេរ (ត្រៀមសម្រាប់លោកគ្រូ-អ្នកគ្រូបញ្ចូលរៀងខ្លួន)
            </div>
            <div style="color:#94a3b8; font-size:0.83rem;">
              ប្រព័ន្ធមិនបង្កើតទិន្នន័យស្វ័យប្រវត្តិទេ — សូមចុច <strong>«បញ្ចូលសិស្សថ្មី»</strong> ឬ <strong>«នាំចូលបញ្ជីសិស្សរហ័ស»</strong> ដើម្បីចាប់ផ្ដើម។
            </div>
          </div>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button onclick="openAddStudentModal()" style="background:#2563eb; color:#fff; border:none; padding:9px 18px; border-radius:8px; font-weight:600; cursor:pointer; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(37,99,235,0.3);">
            <i class="fas fa-plus"></i> បញ្ចូលសិស្សថ្មី
          </button>
          <button onclick="openImportStudentsModal()" style="background:#059669; color:#fff; border:none; padding:9px 18px; border-radius:8px; font-weight:600; cursor:pointer; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(5,150,105,0.3);">
            <i class="fas fa-file-import"></i> នាំចូលបញ្ជីឈ្មោះ
          </button>
        </div>
      </div>
    `;
  } else {
    banner.innerHTML = `
      <div style="background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:38px; height:38px; border-radius:8px; background:rgba(59,130,246,0.15); display:flex; align-items:center; justify-content:center; color:#38bdf8;">
            <i class="fas fa-user-check"></i>
          </div>
          <div style="font-size:0.92rem; color:#cbd5e1;">
            <strong style="color:#60a5fa;">${appData.currentTeacher.assignedClass}</strong>៖ បញ្ជីឈ្មោះសិស្សសរុប <strong style="color:#f8fafc; font-size:1.05rem;">${total} នាក់</strong> 
            (ស្រី: <strong style="color:#f43f5e;">${female} នាក់</strong> | ប្រុស: <strong style="color:#38bdf8;">${male} នាក់</strong>)
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button onclick="openAddStudentModal()" style="background:#2563eb; color:#fff; border:none; padding:7px 14px; border-radius:6px; font-weight:600; cursor:pointer; font-size:0.82rem;"><i class="fas fa-user-plus"></i> បន្ថែមសិស្ស</button>
          <button onclick="openImportStudentsModal()" style="background:#059669; color:#fff; border:none; padding:7px 14px; border-radius:6px; font-weight:600; cursor:pointer; font-size:0.82rem;"><i class="fas fa-file-import"></i> នាំចូលបន្ថែម</button>
          <button onclick="clearAllStudentsConfirm()" style="background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3); padding:7px 12px; border-radius:6px; font-weight:600; cursor:pointer; font-size:0.82rem;"><i class="fas fa-trash-alt"></i> សម្អាតបញ្ជី</button>
        </div>
      </div>
    `;
  }
}

// Global Search across all cards
function handleGlobalSearch(query) {
  const clean = (query || '').toLowerCase().trim();
  const cards = document.querySelectorAll('.feature-card');
  const sections = document.querySelectorAll('.feature-section');

  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    const match = !clean || text.includes(clean);
    card.style.display = match ? 'flex' : 'none';
  });

  // Hide empty sections
  sections.forEach(sec => {
    const visibleCards = sec.querySelectorAll('.feature-card:not([style*="display: none"])');
    sec.style.display = visibleCards.length > 0 ? 'block' : 'none';
  });
}

// Event Listeners Setup
function setupEventListeners() {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail')?.value;
      const pwd = document.getElementById('loginPassword')?.value;
      handleLogin(email, pwd);
    });
  }

  const searchInput = document.getElementById('dashboardSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      handleGlobalSearch(e.target.value);
    });
  }

  // Close modals on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });
}

// Modal Control System
function openModal(id) {
  closeAllModals();
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
  document.body.style.overflow = '';
}

// Helper: Render Reusable Empty State Card
function renderStudentEmptyState(title, subtitle) {
  return `
    <div style="text-align:center; padding:45px 20px; background:rgba(15,23,42,0.5); border-radius:12px; border:1px dashed #334155; margin:10px 0;">
      <div style="font-size:3rem; margin-bottom:12px; opacity:0.85;">📋</div>
      <h4 style="color:#f8fafc; font-size:1.1rem; margin-bottom:8px;">${title || 'មិនទាន់មានទិន្នន័យសិស្សនៅឡើយទេ'}</h4>
      <p style="color:#94a3b8; font-size:0.88rem; max-width:460px; margin:0 auto 20px auto; line-height:1.6;">
        ${subtitle || 'លោកគ្រូ-អ្នកគ្រូ អាចចាប់ផ្ដើមបញ្ចូលសិស្សក្នុងថ្នាក់តាមទម្រង់ ឬនាំចូលបញ្ជីឈ្មោះសិស្សបានយ៉ាងងាយស្រួល។'}
      </p>
      <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
        <button onclick="openAddStudentModal()" style="background:#2563eb; color:#fff; border:none; padding:9px 18px; border-radius:8px; font-weight:600; cursor:pointer; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px;">
          <i class="fas fa-user-plus"></i> បញ្ចូលសិស្សថ្មី
        </button>
        <button onclick="openImportStudentsModal()" style="background:#059669; color:#fff; border:none; padding:9px 18px; border-radius:8px; font-weight:600; cursor:pointer; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px;">
          <i class="fas fa-file-import"></i> នាំចូលបញ្ជីសិស្ស
        </button>
      </div>
    </div>
  `;
}

// Helper: Passcode generator from name
function generatePasscode(name) {
  const clean = (name || 'STU').replace(/\s+/g, '').toUpperCase();
  const rand = Math.floor(10 + Math.random() * 90);
  return `${clean.slice(0, 4)}${rand}`;
}

// ==========================================================================
// STUDENT CRUD MANAGEMENT (ADD, EDIT, DELETE, BATCH IMPORT)
// ==========================================================================

function openAddStudentModal(studentId = null) {
  if (studentId) {
    window.location.href = `add-student.html?id=${encodeURIComponent(studentId)}`;
  } else {
    window.location.href = 'add-student.html';
  }
}

function saveStudentForm(andAddAnother = false) {
  const originalId = document.getElementById('editStudentOriginalId')?.value;
  const roll = Number(document.getElementById('stuRollInput')?.value) || (appData.students.length + 1);
  const id = document.getElementById('stuIdInput')?.value?.trim();
  const nameKh = document.getElementById('stuNameKhInput')?.value?.trim();
  const nameEn = document.getElementById('stuNameEnInput')?.value?.trim() || '';
  const gender = document.getElementById('stuGenderSelect')?.value || 'ប្រុស';
  const dob = document.getElementById('stuDobInput')?.value || '';
  const parentName = document.getElementById('stuParentNameInput')?.value?.trim() || '';
  const parentPhone = document.getElementById('stuParentPhoneInput')?.value?.trim() || '';
  const seatRow = Number(document.getElementById('stuSeatRowSelect')?.value) || 1;
  const seatCol = Number(document.getElementById('stuSeatColSelect')?.value) || 1;

  if (!id || !nameKh) {
    showToast('សូមបញ្ចូលអត្តលេខ និងគោត្តនាម-នាមសិស្ស!', 'error');
    return;
  }

  const avatar = gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓';

  if (originalId) {
    // Updating existing student
    const idx = appData.students.findIndex(x => x.id === originalId);
    if (idx !== -1) {
      appData.students[idx] = {
        ...appData.students[idx],
        roll,
        id,
        nameKh,
        nameEn,
        gender,
        dob,
        parentName,
        parentPhone,
        seatRow,
        seatCol,
        avatar
      };
      persistData();
      showToast(`បានកែប្រែព័ត៌មាន «${nameKh}» ដោយជោគជ័យ!`, 'success');
    }
  } else {
    // Checking duplicate ID
    if (appData.students.some(x => x.id === id)) {
      showToast(`អត្តលេខ ${id} មានក្នុងប្រព័ន្ធរួចហើយ!`, 'error');
      return;
    }

    const newStudent = {
      id,
      roll,
      nameKh,
      nameEn,
      gender,
      dob,
      parentName,
      parentPhone,
      passcode: generatePasscode(nameKh),
      attendance: 'present',
      seatRow,
      seatCol,
      avatar,
      behaviorScore: 100,
      scores: { KH: 0, MATH: 0, PHY: 0, CHEM: 0, BIO: 0, HIST: 0, GEO: 0, ENG: 0, MOR: 0 },
      absentYearCount: 0
    };

    appData.students.push(newStudent);
    persistData();
    showToast(`បានបញ្ចូលសិស្ស «${nameKh}» ដោយជោគជ័យ!`, 'success');
  }

  if (andAddAnother) {
    openAddStudentModal(null);
  } else {
    closeModal('modalAddStudent');
    // Refresh student info modal if it's open
    const infoModal = document.getElementById('modalStudentInfo');
    if (infoModal && infoModal.style.display === 'flex') {
      openStudentInfoModal();
    }
  }
}

function deleteStudent(id) {
  const s = appData.students.find(x => x.id === id);
  if (!s) return;

  if (!confirm(`តើលោកគ្រូ-អ្នកគ្រូពិតជាចង់លុបទិន្នន័យសិស្ស «${s.nameKh}» មែនទេ?`)) {
    return;
  }

  appData.students = appData.students.filter(x => x.id !== id);
  persistData();
  showToast(`បានលុបសិស្ស «${s.nameKh}» រួចរាល់`, 'info');
  openStudentInfoModal();
}

function clearAllStudentsConfirm() {
  if (appData.students.length === 0) {
    showToast('បញ្ជីសិស្សទទេរស្រាប់ហើយ!', 'info');
    return;
  }
  if (!confirm('តើលោកគ្រូ-អ្នកគ្រូពិតជាចង់សម្អាតបញ្ជីសិស្សទាំងអស់មែនទេ? ទិន្នន័យនឹងត្រូវលុបចេញពីប្រព័ន្ធ។')) {
    return;
  }

  appData.students = [];
  persistData();
  showToast('បានសម្អាតបញ្ជីសិស្សទាំងអស់រួចរាល់', 'info');
  closeAllModals();
}

// Batch Import Students
function openImportStudentsModal() {
  const ta = document.getElementById('importStudentsTextarea');
  if (ta) ta.value = '';
  openModal('modalImportStudents');
  setTimeout(() => {
    if (ta) ta.focus();
  }, 100);
}

function processBatchStudentImport() {
  const ta = document.getElementById('importStudentsTextarea');
  const text = (ta?.value || '').trim();

  if (!text) {
    showToast('សូមបញ្ចូល ឬ Paste បញ្ជីឈ្មោះសិស្សជាមុនសិន!', 'error');
    return;
  }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) {
    showToast('ពុំមានទិន្នន័យសម្រាប់នាំចូលទេ!', 'error');
    return;
  }

  let count = 0;
  let startRoll = appData.students.length;

  lines.forEach((line) => {
    // Split by comma, tab, or semicolon
    const parts = line.split(/[,;\t]+/).map(p => p.trim());
    const nameKh = parts[0];
    if (!nameKh) return;

    let gender = 'ប្រុស';
    if (parts[1]) {
      const g = parts[1].toLowerCase();
      if (g.includes('ស្រី') || g.includes('female') || g === 'f') {
        gender = 'ស្រី';
      }
    }

    const phone = parts[2] || '';
    startRoll++;
    const id = `STU-${String(startRoll).padStart(3, '0')}`;
    const row = Math.ceil(startRoll / 5);
    const col = ((startRoll - 1) % 5) + 1;

    appData.students.push({
      id,
      roll: startRoll,
      nameKh,
      nameEn: '',
      gender,
      dob: '2013-01-01',
      parentName: '',
      parentPhone: phone,
      passcode: generatePasscode(nameKh),
      attendance: 'present',
      seatRow: Math.min(5, Math.max(1, row)),
      seatCol: Math.min(5, Math.max(1, col)),
      avatar: gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓',
      behaviorScore: 100,
      scores: { KH: 0, MATH: 0, PHY: 0, CHEM: 0, BIO: 0, HIST: 0, GEO: 0, ENG: 0, MOR: 0 },
      absentYearCount: 0
    });
    count++;
  });

  persistData();
  closeModal('modalImportStudents');
  showToast(`បាននាំចូលសិស្សចំនួន ${count} នាក់ដោយជោគជ័យ!`, 'success');

  const infoModal = document.getElementById('modalStudentInfo');
  if (infoModal && infoModal.style.display === 'flex') {
    openStudentInfoModal();
  }
}

// ==========================================================================
// FEATURE MODAL CONTROLLERS (26 FEATURES)
// ==========================================================================

// 1. បញ្ជីព័ត៌មានសិស្ស (Student Info Profile Registry)
function openStudentInfoModal() {
  const body = document.getElementById('modalStudentInfoBody');
  if (!body) return;

  const total = appData.students.length;
  const female = appData.students.filter(s => s.gender === 'ស្រី').length;
  const male = total - female;

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
      <div style="font-size:0.95rem; color:#93c5fd; font-weight:600;">
        <i class="fas fa-users"></i> ចំនួនសិស្សសរុប: <strong>${total} នាក់</strong> 
        (ស្រី: <span style="color:#f43f5e;">${female}</span>, ប្រុស: <span style="color:#38bdf8;">${male}</span>)
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button onclick="openAddStudentModal()" style="background:#2563eb; color:#fff; border:none; padding:7px 14px; border-radius:6px; font-weight:600; cursor:pointer; font-size:0.85rem;"><i class="fas fa-user-plus"></i> បន្ថែមសិស្សថ្មី</button>
        <button onclick="openImportStudentsModal()" style="background:#059669; color:#fff; border:none; padding:7px 14px; border-radius:6px; font-weight:600; cursor:pointer; font-size:0.85rem;"><i class="fas fa-file-import"></i> នាំចូលបញ្ជីសិស្ស</button>
        ${total > 0 ? `<button onclick="window.print()" style="background:rgba(255,255,255,0.08); color:#cbd5e1; border:1px solid rgba(255,255,255,0.15); padding:7px 12px; border-radius:6px; cursor:pointer; font-size:0.85rem;"><i class="fas fa-print"></i> បោះពុម្ព</button>` : ''}
      </div>
    </div>
  `;

  if (total === 0) {
    html += renderStudentEmptyState(
      'មិនទាន់មានទិន្នន័យសិស្សនៅឡើយទេ',
      'សូមចុច «បន្ថែមសិស្សថ្មី» ដើម្បីបញ្ចូលព័ត៌មានសិស្សម្នាក់ៗ ឬចុច «នាំចូលបញ្ជីសិស្ស» ដើម្បី Paste ឈ្មោះសិស្សទាំងអស់ចូលតែម្តង។'
    );
  } else {
    html += `
      <div class="krusmart-table-wrap">
        <table class="krusmart-table">
          <thead>
            <tr>
              <th>ល.រ</th>
              <th>អត្តលេខ</th>
              <th>គោត្តនាម-នាម</th>
              <th>ភេទ</th>
              <th>ថ្ងៃខែឆ្នាំកំណើត</th>
              <th>អាណាព្យាបាល</th>
              <th>លេខទូរស័ព្ទ</th>
              <th>សកម្មភាព</th>
            </tr>
          </thead>
          <tbody>
    `;

    appData.students.forEach((s, idx) => {
      html += `
        <tr>
          <td>${idx + 1}</td>
          <td><code>${s.id}</code></td>
          <td style="font-weight:600; color:#f8fafc;">${s.avatar} ${s.nameKh} ${s.nameEn ? `<span style="font-size:0.75rem; color:#64748b;">(${s.nameEn})</span>` : ''}</td>
          <td><span style="color:${s.gender === 'ស្រី' ? '#f43f5e' : '#38bdf8'}; font-weight:600;">${s.gender}</span></td>
          <td>${s.dob || '-'}</td>
          <td>${s.parentName || '-'}</td>
          <td>${s.parentPhone ? `<a href="tel:${s.parentPhone}" style="color:#60a5fa; text-decoration:none;"><i class="fas fa-phone-alt"></i> ${s.parentPhone}</a>` : '-'}</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button onclick="openAddStudentModal('${s.id}')" style="background:#0284c7; border:none; color:#fff; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;" title="កែប្រែ"><i class="fas fa-edit"></i></button>
              <button onclick="deleteStudent('${s.id}')" style="background:#dc2626; border:none; color:#fff; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;" title="លុប"><i class="fas fa-trash-alt"></i></button>
            </div>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
  }

  body.innerHTML = html;
  openModal('modalStudentInfo');
}

// 2. បញ្ជីឈ្មោះសិស្ស (Student Name List)
function openStudentListModal() {
  openStudentInfoModal();
}

// 3. ចុះវត្តមានតាមប្លង់ (Classroom Seating Chart Attendance)
function openSeatingPlanModal() {
  const container = document.getElementById('seatingChartGrid');
  const summary = document.getElementById('seatingSummary');
  const countPresent = appData.students.filter(s => s.attendance === 'present').length;
  const countPerm = appData.students.filter(s => s.attendance === 'permission').length;
  const countAbsent = appData.students.filter(s => s.attendance === 'absent').length;

  if (summary) {
    if (appData.students.length === 0) {
      summary.innerHTML = `<span style="color:#94a3b8;"><i class="fas fa-info-circle"></i> មិនទាន់មានសិស្សសម្រាប់កត់ត្រាវត្តមាន</span>`;
    } else {
      summary.innerHTML = `
        <span style="color:#34d399; font-weight:700;"><i class="fas fa-check-circle"></i> វត្តមាន: ${countPresent}</span> |
        <span style="color:#fbbf24; font-weight:700;"><i class="fas fa-clock"></i> មានច្បាប់: ${countPerm}</span> |
        <span style="color:#f87171; font-weight:700;"><i class="fas fa-times-circle"></i> ឥតច្បាប់: ${countAbsent}</span>
      `;
    }
  }

  if (container) {
    if (appData.students.length === 0) {
      container.innerHTML = renderStudentEmptyState(
        'មិនទាន់មានសិស្សសម្រាប់រៀបចំតុអង្គុយទេ',
        'សូមបញ្ចូលសិស្សជាមុនសិន ដើម្បីឱ្យប្រព័ន្ធរៀបចំតុអង្គុយ និងអនុញ្ញាតឱ្យលោកគ្រូ-អ្នកគ្រូចុចកត់ត្រាវត្តមានតាមប្លង់តុ។'
      );
    } else {
      let html = '';
      appData.students.forEach(s => {
        const statusClass = s.attendance;
        const statusText = s.attendance === 'present' ? 'វត្តមាន' : s.attendance === 'permission' ? 'ច្បាប់' : 'អវត្តមាន';
        const badgeClass = s.attendance === 'present' ? 'status-p' : s.attendance === 'permission' ? 'status-pa' : 'status-a';

        html += `
          <div class="desk-card ${statusClass}" onclick="toggleStudentAttendance('${s.id}')" title="ចុចដើម្បីប្ដូរវត្តមាន">
            <div style="font-size:1.5rem;">${s.avatar}</div>
            <div class="desk-student-name">${s.nameKh}</div>
            <div style="font-size:0.7rem; color:#94a3b8;">តុទី ${s.roll}</div>
            <span class="desk-status-badge ${badgeClass}">${statusText}</span>
          </div>
        `;
      });
      container.innerHTML = html;
    }
  }
  openModal('modalSeatingPlan');
}

function toggleStudentAttendance(id) {
  const s = appData.students.find(x => x.id === id);
  if (!s) return;

  if (s.attendance === 'present') {
    s.attendance = 'permission';
  } else if (s.attendance === 'permission') {
    s.attendance = 'absent';
  } else {
    s.attendance = 'present';
  }

  persistData();
  openSeatingPlanModal();
}

function markAllPresent() {
  if (appData.students.length === 0) {
    showToast('មិនទាន់មានសិស្សសម្រាប់កត់ត្រាទេ!', 'info');
    return;
  }
  appData.students.forEach(s => s.attendance = 'present');
  persistData();
  showToast('បានកត់ត្រាវត្តមានពេញលេញសម្រាប់សិស្សទាំងអស់!', 'success');
  openSeatingPlanModal();
}

// 4. បញ្ជីវត្តមានប្រចាំខែ (Monthly Attendance)
function openMonthlyAttendanceModal() {
  const body = document.getElementById('modalMonthlyAttendanceBody');
  if (!body) return;

  if (appData.students.length === 0) {
    body.innerHTML = renderStudentEmptyState(
      'មិនទាន់មានទិន្នន័យវត្តមានប្រចាំខែទេ',
      'សូមបញ្ចូលបញ្ជីឈ្មោះសិស្សជាមុនសិន ដើម្បីបង្កើតតារាងវត្តមានប្រចាំខែ។'
    );
    openModal('modalMonthlyAttendance');
    return;
  }

  let html = `
    <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <h4 style="color:#60a5fa;"><i class="fas fa-calendar-alt"></i> បញ្ជីវត្តមានប្រចាំខែវិច្ឆិកា ឆ្នាំ២០២៦ (${appData.currentTeacher.assignedClass})</h4>
      <button onclick="window.print()" style="background:#2563eb; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer;"><i class="fas fa-print"></i> បោះពុម្ពតារាង A4</button>
    </div>
    <div class="krusmart-table-wrap">
      <table class="krusmart-table" style="font-size:0.8rem;">
        <thead>
          <tr>
            <th>ល.រ</th>
            <th>ឈ្មោះសិស្ស</th>
            <th>ភេទ</th>
            <th>វត្តមាន</th>
            <th>ច្បាប់</th>
            <th>ឥតច្បាប់</th>
            <th>សរុបអវត្តមាន</th>
            <th>ភាគរយវត្តមាន</th>
          </tr>
        </thead>
        <tbody>
  `;

  appData.students.forEach((s, idx) => {
    const absent = s.absentYearCount || 0;
    const rate = Math.max(0, 100 - (absent * 2.5)).toFixed(1);
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td style="font-weight:600; color:#f8fafc;">${s.nameKh}</td>
        <td>${s.gender}</td>
        <td style="color:#34d399; font-weight:600;">22 ថ្ងៃ</td>
        <td style="color:#fbbf24;">${Math.floor(absent / 2)} ថ្ងៃ</td>
        <td style="color:#f87171;">${Math.ceil(absent / 2)} ថ្ងៃ</td>
        <td style="font-weight:700; color:${absent > 5 ? '#ef4444' : '#cbd5e1'};">${absent} ថ្ងៃ</td>
        <td><strong style="color:${rate >= 90 ? '#34d399' : '#fbbf24'};">${rate}%</strong></td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  body.innerHTML = html;
  openModal('modalMonthlyAttendance');
}

// 5. បញ្ចូលពិន្ទុប្រចាំខែ (Monthly Score Entry & Evaluation)
function openMonthlyScoreModal() {
  const body = document.getElementById('modalMonthlyScoreBody');
  if (!body) return;

  if (appData.students.length === 0) {
    body.innerHTML = renderStudentEmptyState(
      'មិនទាន់មានសិស្សសម្រាប់បញ្ចូលពិន្ទុទេ',
      'សូមបញ្ចូលបញ្ជីសិស្សក្នុងថ្នាក់ជាមុនសិន ដើម្បីចាប់ផ្ដើមបញ្ចូលពិន្ទុ និងគណនាមធ្យមភាគ។'
    );
    openModal('modalMonthlyScore');
    return;
  }

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
      <div>
        <span style="font-size:1rem; font-weight:700; color:#38bdf8;"><i class="fas fa-pen-alt"></i> តារាងពិន្ទុប្រចាំខែវិច្ឆិកា</span>
        <span style="font-size:0.82rem; color:#94a3b8; margin-left:8px;">(មេគុណ: ខ្មែរ x2, គណិត x2)</span>
      </div>
      <div style="display:flex; gap:8px;">
        <button onclick="saveScoresFromTable()" style="background:#059669; color:#fff; border:none; padding:7px 16px; border-radius:6px; font-weight:600; cursor:pointer;"><i class="fas fa-save"></i> រក្សាទុកពិន្ទុ</button>
        <button onclick="window.print()" style="background:rgba(255,255,255,0.08); color:#fff; border:1px solid rgba(255,255,255,0.15); padding:7px 12px; border-radius:6px; cursor:pointer;"><i class="fas fa-print"></i> បោះពុម្ព</button>
      </div>
    </div>
    <div class="krusmart-table-wrap">
      <table class="krusmart-table" id="scoreTableEdit">
        <thead>
          <tr>
            <th>ល.រ</th>
            <th>ឈ្មោះសិស្ស</th>
            <th>ខ្មែរ (100)</th>
            <th>គណិត (100)</th>
            <th>រូប (50)</th>
            <th>គីមី (50)</th>
            <th>ជីវ (50)</th>
            <th>ប្រវត្តិ (50)</th>
            <th>អង់គ្លេស (50)</th>
            <th>សរុប</th>
            <th>មធ្យមភាគ</th>
            <th>និទ្ទេស</th>
          </tr>
        </thead>
        <tbody>
  `;

  appData.students.forEach((s, idx) => {
    const sc = s.scores || {};
    const kh = sc.KH || 0;
    const math = sc.MATH || 0;
    const phy = sc.PHY || 0;
    const chem = sc.CHEM || 0;
    const bio = sc.BIO || 0;
    const hist = sc.HIST || 0;
    const eng = sc.ENG || 0;

    const total = (kh * 2) + (math * 2) + phy + chem + bio + hist + eng;
    const avg = (total / 9).toFixed(2);
    let grade = 'F';
    let gradeColor = '#ef4444';
    if (avg >= 85) { grade = 'A'; gradeColor = '#10b981'; }
    else if (avg >= 75) { grade = 'B'; gradeColor = '#3b82f6'; }
    else if (avg >= 65) { grade = 'C'; gradeColor = '#06b6d4'; }
    else if (avg >= 50) { grade = 'D'; gradeColor = '#f59e0b'; }
    else { grade = 'F'; gradeColor = '#ef4444'; }

    html += `
      <tr data-student-id="${s.id}">
        <td>${idx + 1}</td>
        <td style="font-weight:600; color:#f8fafc; min-width:130px;">${s.nameKh}</td>
        <td><input type="number" class="score-input" data-subj="KH" value="${kh}" min="0" max="100" style="width:55px; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:4px; text-align:center; padding:4px;"></td>
        <td><input type="number" class="score-input" data-subj="MATH" value="${math}" min="0" max="100" style="width:55px; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:4px; text-align:center; padding:4px;"></td>
        <td><input type="number" class="score-input" data-subj="PHY" value="${phy}" min="0" max="50" style="width:50px; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:4px; text-align:center; padding:4px;"></td>
        <td><input type="number" class="score-input" data-subj="CHEM" value="${chem}" min="0" max="50" style="width:50px; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:4px; text-align:center; padding:4px;"></td>
        <td><input type="number" class="score-input" data-subj="BIO" value="${bio}" min="0" max="50" style="width:50px; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:4px; text-align:center; padding:4px;"></td>
        <td><input type="number" class="score-input" data-subj="HIST" value="${hist}" min="0" max="50" style="width:50px; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:4px; text-align:center; padding:4px;"></td>
        <td><input type="number" class="score-input" data-subj="ENG" value="${eng}" min="0" max="50" style="width:50px; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:4px; text-align:center; padding:4px;"></td>
        <td style="font-weight:700; color:#38bdf8;">${total}</td>
        <td style="font-weight:700;">${avg}</td>
        <td><span style="background:${gradeColor}22; color:${gradeColor}; font-weight:700; padding:2px 8px; border-radius:4px;">${grade}</span></td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  body.innerHTML = html;
  openModal('modalMonthlyScore');
}

function saveScoresFromTable() {
  const rows = document.querySelectorAll('#scoreTableEdit tbody tr');
  rows.forEach(row => {
    const id = row.getAttribute('data-student-id');
    const s = appData.students.find(x => x.id === id);
    if (s) {
      if (!s.scores) s.scores = {};
      row.querySelectorAll('.score-input').forEach(inp => {
        const subj = inp.getAttribute('data-subj');
        s.scores[subj] = Number(inp.value) || 0;
      });
    }
  });

  persistData();
  showToast('បានរក្សាទុកពិន្ទុ និងគណនាមធ្យមភាគដោយជោគជ័យ!', 'success');
  openMonthlyScoreModal();
}

// 6. បញ្ជូនពិន្ទុឆមាសទៅអាណាព្យាបាល (Send Scores to Parents)
function openSendParentScoreModal() {
  const body = document.getElementById('modalSendParentScoreBody');
  if (!body) return;

  if (appData.students.length === 0) {
    body.innerHTML = renderStudentEmptyState(
      'មិនទាន់មានសិស្សសម្រាប់ផ្ញើពិន្ទុទេ',
      'សូមបញ្ចូលបញ្ជីសិស្ស និងពិន្ទុជាមុនសិន ដើម្បីផ្ញើសារជូនដំណឹងទៅអាណាព្យាបាល។'
    );
    openModal('modalSendParentScore');
    return;
  }

  const sampleStudent = appData.students[0];
  let html = `
    <div style="background:#1e293b; border-radius:12px; padding:20px; border:1px solid rgba(255,255,255,0.08); margin-bottom:18px;">
      <h4 style="color:#60a5fa; margin-bottom:8px;"><i class="fas fa-paper-plane"></i> គំរូសារផ្ញើជូនអាណាព្យាបាល (Telegram / SMS Preview)</h4>
      <div style="background:#0f172a; border-radius:8px; padding:16px; border:1px dashed #334155; font-family:monospace; font-size:0.86rem; color:#e2e8f0; line-height:1.7;">
        🏫 <strong>${appData.currentTeacher.schoolKh}</strong><br>
        📋 <strong>សេចក្តីជូនដំណឹងអំពីលទ្ធផលសិក្សាប្រចាំឆមាស</strong><br>
        👤 ឈ្មោះសិស្ស៖ <strong>${sampleStudent.nameKh}</strong> (${sampleStudent.gender})<br>
        📚 ថ្នាក់៖ <strong>${appData.currentTeacher.assignedClass}</strong> | អត្តលេខ៖ ${sampleStudent.id}<br>
        ⭐️ មធ្យមភាគពិន្ទុ៖ <strong>${((Object.values(sampleStudent.scores || {}).reduce((a,b)=>a+b,0))/9).toFixed(1)} / 50</strong><br>
        🏆 ចំណាត់ថ្នាក់៖ <strong>លេខ ១</strong> ក្នុងចំណោមសិស្ស ${appData.students.length} នាក់<br>
        📅 វត្តមាន៖ ពេញលេញ<br>
        💬 យោបល់គ្រូ៖ សិស្សមានការខិតខំប្រឹងប្រែងរៀនសូត្រ និងមានវិន័យល្អប្រសើរ។
      </div>
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <span style="font-size:0.85rem; color:#94a3b8;">ប្រព័ន្ធនឹងផ្ញើសារស្វ័យប្រវត្តិតាមរយៈ Bot Telegram & SMS Gateway</span>
      <button onclick="showToast('បានផ្ញើលទ្ធផលពិន្ទុទៅអាណាព្យាបាលសិស្សទាំងអស់!', 'success')" style="background:#2563eb; color:#fff; border:none; padding:9px 18px; border-radius:8px; font-weight:600; cursor:pointer;"><i class="fas fa-paper-plane"></i> បញ្ជូនទៅអាណាព្យាបាលទាំងអស់</button>
    </div>
  `;
  body.innerHTML = html;
  openModal('modalSendParentScore');
}

// 7. បញ្ចូលពិន្ទុរហ័ស (Quick Score)
function openQuickScoreModal() {
  openMonthlyScoreModal();
}

// 8. តារាងពិន្ទុសរុប (Cumulative Score Sheet)
function openCumulativeScoreModal() {
  openMonthlyScoreModal();
}

// 9. តារាងចំណាត់ថ្នាក់ (Class Ranking Table)
function openRankingTableModal() {
  const body = document.getElementById('modalRankingTableBody');
  if (!body) return;

  if (appData.students.length === 0) {
    body.innerHTML = renderStudentEmptyState(
      'មិនទាន់មានទិន្នន័យចំណាត់ថ្នាក់ទេ',
      'សូមបញ្ចូលសិស្ស និងពិន្ទុប្រចាំខែជាមុនសិន ដើម្បីឱ្យប្រព័ន្ធគណនាចំណាត់ថ្នាក់ដោយស្វ័យប្រវត្តិ។'
    );
    openModal('modalRankingTable');
    return;
  }

  // Calculate averages & sort
  const ranked = appData.students.map(s => {
    const sc = s.scores || {};
    const total = ((sc.KH || 0) * 2) + ((sc.MATH || 0) * 2) + (sc.PHY || 0) + (sc.CHEM || 0) + (sc.BIO || 0) + (sc.HIST || 0) + (sc.ENG || 0);
    const avg = Number((total / 9).toFixed(2));
    return { ...s, totalScore: total, avgScore: avg };
  }).sort((a, b) => b.avgScore - a.avgScore);

  let html = `
    <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <h4 style="color:#f59e0b;"><i class="fas fa-trophy"></i> តារាងចំណាត់ថ្នាក់សិស្សប្រចាំឆមាស (${appData.currentTeacher.assignedClass})</h4>
      <button onclick="window.print()" style="background:#2563eb; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer;"><i class="fas fa-print"></i> បោះពុម្ព</button>
    </div>
    <div class="krusmart-table-wrap">
      <table class="krusmart-table">
        <thead>
          <tr>
            <th>ចំណាត់ថ្នាក់</th>
            <th>អត្តលេខ</th>
            <th>ឈ្មោះសិស្ស</th>
            <th>ភេទ</th>
            <th>ពិន្ទុសរុប</th>
            <th>មធ្យមភាគ</th>
            <th>និទ្ទេស</th>
          </tr>
        </thead>
        <tbody>
  `;

  ranked.forEach((s, idx) => {
    let rankBadge = `${idx + 1}`;
    if (idx === 0) rankBadge = '🥇 លេខ ១ (កិត្តិយស)';
    else if (idx === 1) rankBadge = '🥈 លេខ ២';
    else if (idx === 2) rankBadge = '🥉 លេខ ៣';

    html += `
      <tr style="${idx < 3 ? 'background:rgba(234,179,8,0.08);' : ''}">
        <td style="font-weight:700; color:${idx === 0 ? '#f59e0b' : idx < 3 ? '#60a5fa' : '#cbd5e1'};">${rankBadge}</td>
        <td><code>${s.id}</code></td>
        <td style="font-weight:600; color:#f8fafc;">${s.avatar} ${s.nameKh}</td>
        <td>${s.gender}</td>
        <td style="font-weight:700; color:#38bdf8;">${s.totalScore}</td>
        <td style="font-weight:700;">${s.avgScore}</td>
        <td>${s.avgScore >= 85 ? 'ល្អណាស់ (A)' : s.avgScore >= 75 ? 'ល្អ (B)' : s.avgScore >= 50 ? 'មធ្យម (C)' : 'ខ្សោយ (F)'}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  body.innerHTML = html;
  openModal('modalRankingTable');
}

// 10. តារាងកិត្តិយស & ប័ណ្ណសរសើរ (Honor Roll & Certificates)
function openHonorRollModal() {
  const body = document.getElementById('modalHonorRollBody');
  if (!body) return;

  if (appData.students.length === 0) {
    body.innerHTML = renderStudentEmptyState(
      'មិនទាន់មានទិន្នន័យសិស្សពូកែទេ',
      'សូមបញ្ចូលសិស្ស និងពិន្ទុជាមុនសិន ដើម្បីជ្រើសរើសជើងឯក និងបោះពុម្ពប័ណ្ណសរសើរ។'
    );
    openModal('modalHonorRoll');
    return;
  }

  const topStudents = appData.students.slice(0, 3);
  let html = `
    <div style="text-align:center; margin-bottom:20px;">
      <h3 style="color:#f59e0b; font-family:var(--font-moul); margin-bottom:6px;">ព្រះរាជាណាចក្រកម្ពុជា</h3>
      <h4 style="color:#cbd5e1; font-size:0.9rem; margin-bottom:12px;">ជាតិ សាសនា ព្រះមហាក្សត្រ</h4>
      <div style="font-size:1.15rem; font-weight:700; color:#38bdf8;">តារាងកិត្តិយសសិស្សពូកែប្រចាំខែ (${appData.currentTeacher.assignedClass})</div>
    </div>
    
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:24px;">
  `;

  topStudents.forEach((s, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
    const title = idx === 0 ? 'ជើងឯកឆ្នើម (លេខ ១)' : idx === 1 ? 'ឆ្នើមលំដាប់ទី២' : 'ឆ្នើមលំដាប់ទី៣';
    html += `
      <div style="background:#1e293b; border:1px solid rgba(234,179,8,0.3); border-radius:12px; padding:20px; text-align:center;">
        <div style="font-size:2.8rem; margin-bottom:8px;">${medal}</div>
        <h4 style="color:#f8fafc; font-size:1.1rem; margin-bottom:4px;">${s.nameKh}</h4>
        <p style="color:#94a3b8; font-size:0.8rem; margin-bottom:8px;">${s.nameEn || ''}</p>
        <div style="background:rgba(234,179,8,0.15); color:#facc15; padding:4px 10px; border-radius:6px; font-size:0.82rem; font-weight:700; margin-bottom:12px;">${title}</div>
        <button onclick="printStudentCertificate('${s.id}')" style="background:#2563eb; color:#fff; border:none; padding:7px 14px; border-radius:6px; font-size:0.82rem; font-weight:600; cursor:pointer;"><i class="fas fa-award"></i> បោះពុម្ពប័ណ្ណសរសើរ A4</button>
      </div>
    `;
  });

  html += `</div>`;
  body.innerHTML = html;
  openModal('modalHonorRoll');
}

function printStudentCertificate(id) {
  const s = appData.students.find(x => x.id === id);
  if (!s) return;
  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html>
    <html lang="km">
    <head>
      <meta charset="UTF-8">
      <title>ប័ណ្ណសរសើរ_${s.nameKh}</title>
      <link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600;700&family=Moul&display=swap" rel="stylesheet">
      <style>
        @page { size: A4 landscape; margin: 15mm; }
        body { font-family: 'Kantumruy Pro', sans-serif; text-align: center; color: #1e293b; padding: 30px; }
        .cert-border { border: 12px double #ca8a04; padding: 40px; border-radius: 12px; background: #fffbeb; }
        .moul { font-family: 'Moul', serif; }
        h1 { color: #b45309; margin: 15px 0; font-size: 32px; }
        h2 { color: #1e3a8a; font-size: 26px; margin: 20px 0; }
        p { font-size: 18px; line-height: 1.8; }
      </style>
    </head>
    <body onload="window.print()">
      <div class="cert-border">
        <h3 class="moul" style="color: #b45309;">ព្រះរាជាណាចក្រកម្ពុជា<br>ជាតិ សាសនា ព្រះមហាក្សត្រ</h3>
        <p style="font-size: 16px; margin-top: 10px;">ក្រសួងអប់រំ យុវជន និងកីឡា • ${appData.currentTeacher.schoolKh}</p>
        <h1 class="moul">ប័ណ្ណសរសើរ</h1>
        <p>ប្រគល់ជូនសិស្សឈ្មោះ៖</p>
        <h2 class="moul">${s.nameKh}</h2>
        <p>សិស្សថ្នាក់ទី៖ <strong>${appData.currentTeacher.assignedClass}</strong> • ឆ្នាំសិក្សា <strong>${appData.currentTeacher.academicYear}</strong></p>
        <p>ដែលទទួលបាន <strong>ចំណាត់ថ្នាក់ឆ្នើម</strong> និងមានអត្តចរិតល្អ សិក្សារៀនសូត្រជាប់ជាប្រចាំ។</p>
        <div style="display:flex; justify-content:space-between; margin-top:50px; padding: 0 40px;">
          <div><p>បានឃើញ និងឯកភាព<br><strong>នាយកវិទ្យាស្ថាន/សាលា</strong></p></div>
          <div><p>ថ្ងៃទី...... ខែវិច្ឆិកា ឆ្នាំ២០២៦<br><strong>គ្រូទទួលបន្ទុកថ្នាក់</strong><br><br><strong>${appData.currentTeacher.nameKh}</strong></p></div>
        </div>
      </div>
    </body>
    </html>
  `);
  win.document.close();
}

// 11. បញ្ជីសរុបអវត្តមានប្រចាំឆ្នាំ (Annual Absence Summary)
function openAnnualAbsenceModal() {
  openMonthlyAttendanceModal();
}

// 12. កែលម្អសិស្សខ្សោយ (Remedial Student Intervention)
function openRemedialModal() {
  const body = document.getElementById('modalRemedialBody');
  if (!body) return;

  if (appData.students.length === 0) {
    body.innerHTML = renderStudentEmptyState(
      'មិនទាន់មានទិន្នន័យសិស្សត្រូវកែលម្អទេ',
      'សូមបញ្ចូលសិស្ស និងពិន្ទុជាមុនសិន ដើម្បីស្វែងរកសិស្សខ្សោយ ឬត្រូវការបំប៉នបន្ថែម។'
    );
    openModal('modalRemedial');
    return;
  }

  const struggling = appData.students.filter(s => {
    const sc = s.scores || {};
    return ((sc.MATH && sc.MATH < 65) || (sc.KH && sc.KH < 65) || (s.absentYearCount > 5));
  });

  let html = `
    <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:10px; padding:14px; margin-bottom:16px;">
      <h4 style="color:#f87171;"><i class="fas fa-exclamation-triangle"></i> បញ្ជីសិស្សត្រូវការជំនួយគរុកោសល្យ និងការបំប៉នបន្ថែម</h4>
      <p style="font-size:0.85rem; color:#fca5a5;">សិស្សមានពិន្ទុក្រោមមធ្យម ឬអវត្តមានច្រើន ត្រូវរៀបចំផែនការបំប៉នបន្ថែមក្រោយម៉ោងសិក្សា។</p>
    </div>
  `;

  if (struggling.length === 0) {
    html += `
      <div style="text-align:center; padding:30px; color:#34d399;">
        <i class="fas fa-check-circle" style="font-size:2.5rem; margin-bottom:10px;"></i>
        <h4>ពុំមានសិស្សខ្សោយត្រូវកែលម្អទេ! សិស្សទាំងអស់មានលទ្ធផលល្អប្រសើរ។</h4>
      </div>
    `;
  } else {
    html += `
      <div class="krusmart-table-wrap">
        <table class="krusmart-table">
          <thead>
            <tr>
              <th>ល.រ</th>
              <th>ឈ្មោះសិស្ស</th>
              <th>មុខវិជ្ជាខ្សោយ</th>
              <th>ពិន្ទុ</th>
              <th>មូលហេតុចម្បង</th>
              <th>ផែនការកែលម្អ</th>
            </tr>
          </thead>
          <tbody>
    `;

    struggling.forEach((s, idx) => {
      html += `
        <tr>
          <td>${idx + 1}</td>
          <td style="font-weight:600; color:#f8fafc;">${s.nameKh}</td>
          <td style="color:#f87171; font-weight:600;">គណិតវិទ្យា / ខ្មែរ</td>
          <td>${s.scores?.MATH || 0}/100</td>
          <td>ខ្វះការយកចិត្តទុកដាក់ / អវត្តមានញឹកញាប់</td>
          <td><button onclick="showToast('បានកត់ត្រាកិច្ចការបំប៉នរួចរាល់', 'success')" style="background:#2563eb; color:#fff; border:none; padding:4px 10px; border-radius:4px; font-size:0.78rem; cursor:pointer;">រៀបចំម៉ោងបំប៉ន</button></td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
  }

  body.innerHTML = html;
  openModal('modalRemedial');
}

// 13. កែទម្លាប់អាកប្បកិរិយា (Behavior Tracking)
function openBehaviorModal() {
  const body = document.getElementById('modalBehaviorBody');
  if (!body) return;

  if (appData.students.length === 0) {
    body.innerHTML = renderStudentEmptyState(
      'មិនទាន់មានសិស្សសម្រាប់កត់ត្រាវិន័យទេ',
      'សូមបញ្ចូលបញ្ជីសិស្សជាមុនសិន ដើម្បីតាមដានពិន្ទុវិន័យ និងអាកប្បកិរិយា។'
    );
    openModal('modalBehavior');
    return;
  }

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
      <h4 style="color:#ec4899;"><i class="fas fa-smile"></i> បញ្ជីពិន្ទុវិន័យ និងអាកប្បកិរិយាសិស្ស (ពិន្ទុដើម ១០០)</h4>
      <button onclick="showToast('បានរក្សាទុកពិន្ទុវិន័យ', 'success')" style="background:#2563eb; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer;"><i class="fas fa-save"></i> រក្សាទុក</button>
    </div>
    <div class="krusmart-table-wrap">
      <table class="krusmart-table">
        <thead>
          <tr>
            <th>ល.រ</th>
            <th>ឈ្មោះសិស្ស</th>
            <th>ភេទ</th>
            <th>ពិន្ទុវិន័យ</th>
            <th>សកម្មភាពកែប្រែ</th>
            <th>ការវាយតម្លៃ</th>
          </tr>
        </thead>
        <tbody>
  `;

  appData.students.forEach((s, idx) => {
    const pts = s.behaviorScore || 100;
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td style="font-weight:600; color:#f8fafc;">${s.nameKh}</td>
        <td>${s.gender}</td>
        <td><strong style="color:${pts >= 95 ? '#34d399' : pts >= 85 ? '#60a5fa' : '#ef4444'}; font-size:1rem;">${pts}</strong>/100</td>
        <td>
          <button onclick="adjustBehavior('${s.id}', 2)" style="background:#10b981; color:#fff; border:none; padding:3px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; margin-right:4px;">+ សរសើរ</button>
          <button onclick="adjustBehavior('${s.id}', -2)" style="background:#ef4444; color:#fff; border:none; padding:3px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer;">- ព្រមាន</button>
        </td>
        <td>${pts >= 95 ? 'គំរូល្អណាស់' : pts >= 85 ? 'ល្អធម្មតា' : 'ត្រូវតាមដាន'}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  body.innerHTML = html;
  openModal('modalBehavior');
}

function adjustBehavior(id, amount) {
  const s = appData.students.find(x => x.id === id);
  if (!s) return;
  s.behaviorScore = Math.max(0, Math.min(100, (s.behaviorScore || 100) + amount));
  persistData();
  openBehaviorModal();
}

// 14. វិភាគអាយុ និងភេទ (Demographics)
function openDemographicsModal() {
  const body = document.getElementById('modalDemographicsBody');
  if (!body) return;

  const total = appData.students.length;
  const female = appData.students.filter(s => s.gender === 'ស្រី').length;
  const male = total - female;
  const femalePct = total > 0 ? ((female / total) * 100).toFixed(1) : '0';
  const malePct = total > 0 ? ((male / total) * 100).toFixed(1) : '0';

  let html = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
      <div style="background:#1e293b; padding:20px; border-radius:12px; text-align:center;">
        <h4 style="color:#38bdf8; margin-bottom:6px;"><i class="fas fa-mars"></i> សិស្សប្រុស</h4>
        <div style="font-size:2rem; font-weight:800; color:#38bdf8;">${male} នាក់</div>
        <p style="color:#94a3b8; font-size:0.85rem;">ស្មើនឹង ${malePct}% នៃសិស្សសរុប</p>
      </div>
      <div style="background:#1e293b; padding:20px; border-radius:12px; text-align:center;">
        <h4 style="color:#f43f5e; margin-bottom:6px;"><i class="fas fa-venus"></i> សិស្សស្រី</h4>
        <div style="font-size:2rem; font-weight:800; color:#f43f5e;">${female} នាក់</div>
        <p style="color:#94a3b8; font-size:0.85rem;">ស្មើនឹង ${femalePct}% នៃសិស្សសរុប</p>
      </div>
    </div>
    <div style="background:#1e293b; padding:20px; border-radius:12px;">
      <h4 style="color:#60a5fa; margin-bottom:12px;"><i class="fas fa-chart-pie"></i> ការបែងចែកតាមកម្រិតអាយុ</h4>
  `;

  if (total === 0) {
    html += `
      <p style="color:#94a3b8; font-size:0.88rem; text-align:center; padding:20px;">
        មិនទាន់មានទិន្នន័យសិស្សសម្រាប់វិភាគអាយុទេ។
      </p>
    `;
  } else {
    html += `
      <div style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
          <span>អាយុ ១២ ឆ្នាំ</span>
          <span>${Math.round(total * 0.3)} នាក់ (30%)</span>
        </div>
        <div style="height:10px; background:#0f172a; border-radius:5px; overflow:hidden;"><div style="width:30%; height:100%; background:#3b82f6;"></div></div>
      </div>
      <div style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
          <span>អាយុ ១៣ ឆ្នាំ (ត្រឹមត្រូវតាមកម្រិត)</span>
          <span>${Math.round(total * 0.6)} នាក់ (60%)</span>
        </div>
        <div style="height:10px; background:#0f172a; border-radius:5px; overflow:hidden;"><div style="width:60%; height:100%; background:#10b981;"></div></div>
      </div>
      <div>
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
          <span>អាយុ ១៤ ឆ្នាំឡើង</span>
          <span>${Math.max(0, total - Math.round(total * 0.9))} នាក់ (10%)</span>
        </div>
        <div style="height:10px; background:#0f172a; border-radius:5px; overflow:hidden;"><div style="width:10%; height:100%; background:#f59e0b;"></div></div>
      </div>
    `;
  }

  html += `</div>`;
  body.innerHTML = html;
  openModal('modalDemographics');
}

// 15. រដ្ឋបាលថ្នាក់រៀន (Class Administration)
function openClassAdminModal() {
  const body = document.getElementById('modalClassAdminBody');
  if (!body) return;

  const p1 = appData.students[0]?.nameKh || 'កំពុងរង់ចាំជ្រើសតាំង';
  const p2 = appData.students[1]?.nameKh || 'កំពុងរង់ចាំជ្រើសតាំង';
  const p3 = appData.students[2]?.nameKh || 'កំពុងរង់ចាំជ្រើសតាំង';

  let html = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
      <div style="background:#1e293b; padding:20px; border-radius:12px;">
        <h4 style="color:#a855f7; margin-bottom:12px;"><i class="fas fa-crown"></i> គណៈកម្មការថ្នាក់រៀន (${appData.currentTeacher.assignedClass})</h4>
        <ul style="list-style:none; line-height:2.2; font-size:0.88rem;">
          <li>👑 <strong>ប្រធានថ្នាក់៖</strong> ${p1}</li>
          <li>⭐️ <strong>អនុប្រធានថ្នាក់ទី១៖</strong> ${p2}</li>
          <li>⭐️ <strong>អនុប្រធានថ្នាក់ទី២៖</strong> ${p3}</li>
          <li>📚 <strong>បណ្ណារក្សថ្នាក់៖</strong> ស្ម័គ្រចិត្ត</li>
          <li>🧹 <strong>ប្រធានអនាម័យ៖</strong> ស្ម័គ្រចិត្ត</li>
        </ul>
      </div>
      <div style="background:#1e293b; padding:20px; border-radius:12px;">
        <h4 style="color:#60a5fa; margin-bottom:12px;"><i class="fas fa-book-reader"></i> បទបញ្ជាផ្ទៃក្នុងថ្នាក់</h4>
        <ul style="list-style:none; line-height:2; font-size:0.85rem; color:#cbd5e1;">
          <li>១. គោរពពេលវេលា និងចូលរៀនឱ្យបានទៀងទាត់</li>
          <li>២. ស្លៀកពាក់ឯកសណ្ឋានសិស្សឱ្យបានត្រឹមត្រូវ</li>
          <li>៣. យកចិត្តទុកដាក់ស្ដាប់ការពន្យល់របស់លោកគ្រូអ្នកគ្រូ</li>
          <li>៤. ថែរក្សាអនាម័យ និងទ្រព្យសម្បត្តិបន្ទប់រៀន</li>
          <li>៥. មិនប្រើប្រាស់ទូរស័ព្ទក្នុងពេលរៀនដោយគ្មានការអនុញ្ញាត</li>
        </ul>
      </div>
    </div>
  `;
  body.innerHTML = html;
  openModal('modalClassAdmin');
}

// 16. សៀវភៅតាមដានការបង្រៀន (Teaching Logbook)
function openFollowUpBookModal() {
  const body = document.getElementById('modalFollowUpBookBody');
  if (!body) return;

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
      <h4 style="color:#38bdf8;"><i class="fas fa-book-open"></i> កំណត់ត្រាបង្រៀនប្រចាំថ្ងៃ</h4>
      <button onclick="showToast('បានកត់ត្រាមេរៀនរួចរាល់', 'success')" style="background:#2563eb; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer;"><i class="fas fa-plus"></i> កត់ត្រាមេរៀនថ្មី</button>
    </div>
    <div class="krusmart-table-wrap">
      <table class="krusmart-table">
        <thead>
          <tr>
            <th>កាលបរិច្ឆេទ</th>
            <th>ម៉ោង</th>
            <th>មុខវិជ្ជា</th>
            <th>ជំពូក / មេរៀន</th>
            <th>វត្តមានសិស្ស</th>
            <th>ស្ថានភាព</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>16/11/2026</td>
            <td>07:00 - 08:35</td>
            <td>ភាសាខ្មែរ</td>
            <td>មេរៀនទី៥៖ អំណាន «ធម្មជាតិស្រុកកំណើត»</td>
            <td>${appData.students.length}/${appData.students.length}</td>
            <td><span style="color:#34d399; font-weight:700;">✓ បានបង្រៀន</span></td>
          </tr>
          <tr>
            <td>16/11/2026</td>
            <td>08:50 - 09:35</td>
            <td>គណិតវិទ្យា</td>
            <td>មេរៀនទី៤៖ ចំនួនគត់រ៉ឺឡាទីវ (លំហាត់អនុវត្ត)</td>
            <td>${appData.students.length}/${appData.students.length}</td>
            <td><span style="color:#34d399; font-weight:700;">✓ បានបង្រៀន</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  body.innerHTML = html;
  openModal('modalFollowUpBook');
}

// 17. សៀវភៅសិក្សាគោល & សៀវភៅគ្រូ (Curriculum Books)
function openCurriculumBooksModal() {
  const body = document.getElementById('modalCurriculumBooksBody');
  if (!body) return;

  let html = `
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:16px;">
  `;

  appData.curriculumBooks.forEach(b => {
    html += `
      <div style="background:#1e293b; border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <span style="background:rgba(59,130,246,0.15); color:#60a5fa; padding:3px 8px; border-radius:4px; font-size:0.75rem; font-weight:600;">${b.grade}</span>
          <h4 style="color:#f8fafc; font-size:0.95rem; margin:10px 0 6px 0; line-height:1.4;">${b.title}</h4>
          <p style="font-size:0.8rem; color:#94a3b8;">កម្រាស់៖ ${b.pages} ទំព័រ | កូដ៖ ${b.code}</p>
        </div>
        <div style="margin-top:14px; display:flex; gap:8px;">
          <a href="https://ktpttc.net/library" target="_blank" style="flex:1; background:#2563eb; color:#fff; text-decoration:none; padding:6px 0; border-radius:6px; text-align:center; font-size:0.82rem; font-weight:600;"><i class="fas fa-book-reader"></i> បើកអាន</a>
          <button onclick="showToast('កំពុងទាញយកឯកសារ...', 'info')" style="background:rgba(255,255,255,0.08); color:#fff; border:1px solid rgba(255,255,255,0.15); padding:6px 10px; border-radius:6px; cursor:pointer;"><i class="fas fa-download"></i></button>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  body.innerHTML = html;
  openModal('modalCurriculumBooks');
}

// 18. ទាញយកវិញ្ញាសាប្រឡង (Sample Exams)
function openExamPapersModal() {
  const body = document.getElementById('modalExamPapersBody');
  if (!body) return;

  let html = `
    <div class="krusmart-table-wrap">
      <table class="krusmart-table">
        <thead>
          <tr>
            <th>កូដវិញ្ញាសា</th>
            <th>ចំណងជើងវិញ្ញាសា</th>
            <th>មុខវិជ្ជា</th>
            <th>រយៈពេល</th>
            <th>សកម្មភាព</th>
          </tr>
        </thead>
        <tbody>
  `;

  appData.sampleExams.forEach(ex => {
    html += `
      <tr>
        <td><code>${ex.code}</code></td>
        <td style="font-weight:600; color:#f8fafc;">${ex.title}</td>
        <td><span style="color:#60a5fa;">${ex.subject}</span></td>
        <td>${ex.duration}</td>
        <td>
          <button onclick="showToast('កំពុងទាញយកវិញ្ញាសា PDF...', 'success')" style="background:#059669; color:#fff; border:none; padding:5px 12px; border-radius:4px; font-size:0.8rem; cursor:pointer;"><i class="fas fa-download"></i> ទាញយក PDF</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  body.innerHTML = html;
  openModal('modalExamPapers');
}

// 19. របាយការណ៍អាណាព្យាបាល (Parent Report Card)
function openParentReportModal() {
  openSendParentScoreModal();
}

// 20. លេខកូដសិស្ស (ឪពុកម្តាយ) (Passcodes)
function openStudentCodesModal() {
  const body = document.getElementById('modalStudentCodesBody');
  if (!body) return;

  if (appData.students.length === 0) {
    body.innerHTML = renderStudentEmptyState(
      'មិនទាន់មានលេខកូដសិស្សទេ',
      'សូមបញ្ចូលបញ្ជីសិស្សជាមុនសិន ដើម្បីឱ្យប្រព័ន្ធបង្កើតលេខកូដសម្ងាត់សម្រាប់អាណាព្យាបាល។'
    );
    openModal('modalStudentCodes');
    return;
  }

  let html = `
    <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <h4 style="color:#14b8a6;"><i class="fas fa-key"></i> កូដសម្ងាត់សម្រាប់អាណាព្យាបាលចូលពិនិត្យពិន្ទុតាមទូរស័ព្ទ</h4>
      <button onclick="window.print()" style="background:#2563eb; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer;"><i class="fas fa-print"></i> បោះពុម្ពបញ្ជីកូដ</button>
    </div>
    <div class="krusmart-table-wrap">
      <table class="krusmart-table">
        <thead>
          <tr>
            <th>ល.រ</th>
            <th>ឈ្មោះសិស្ស</th>
            <th>ឈ្មោះអាណាព្យាបាល</th>
            <th>លេខទូរស័ព្ទ</th>
            <th>កូដចូលប្រព័ន្ធ (Passcode)</th>
          </tr>
        </thead>
        <tbody>
  `;

  appData.students.forEach((s, idx) => {
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td style="font-weight:600; color:#f8fafc;">${s.nameKh}</td>
        <td>${s.parentName || '-'}</td>
        <td>${s.parentPhone || '-'}</td>
        <td><strong style="color:#14b8a6; font-family:monospace; font-size:0.95rem; background:#0f172a; padding:3px 8px; border-radius:4px; border:1px solid #334155;">${s.passcode}</strong></td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  body.innerHTML = html;
  openModal('modalStudentCodes');
}

// 21. កាលវិភាគសង្ខេបថ្នាក់ (Timetable)
function openTimetableModal() {
  const body = document.getElementById('modalTimetableBody');
  if (!body) return;

  let html = `
    <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <h4 style="color:#60a5fa;"><i class="fas fa-calendar-week"></i> កាលវិភាគបង្រៀនប្រចាំសប្ដាហ៍ (${appData.currentTeacher.assignedClass})</h4>
      <button onclick="window.print()" style="background:#2563eb; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer;"><i class="fas fa-print"></i> បោះពុម្ព</button>
    </div>
    <div class="krusmart-table-wrap">
      <table class="krusmart-table" style="text-align:center;">
        <thead>
          <tr>
            <th>ម៉ោង</th>
            <th>ចន្ទ</th>
            <th>អង្គារ</th>
            <th>ពុធ</th>
            <th>ព្រហស្បតិ៍</th>
            <th>សុក្រ</th>
            <th>សៅរ៍</th>
          </tr>
        </thead>
        <tbody>
  `;

  appData.timetable.forEach(t => {
    html += `
      <tr>
        <td style="font-weight:700; color:#93c5fd; background:#1e293b;">${t.time}</td>
        <td>${t.mon}</td>
        <td>${t.tue}</td>
        <td>${t.wed}</td>
        <td>${t.thu}</td>
        <td>${t.fri}</td>
        <td>${t.sat}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  body.innerHTML = html;
  openModal('modalTimetable');
}

// 22. បញ្ជីសារពើភ័ណ្ឌ (Inventory)
function openInventoryModal() {
  const body = document.getElementById('modalInventoryBody');
  if (!body) return;

  let html = `
    <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <h4 style="color:#f59e0b;"><i class="fas fa-box-open"></i> បញ្ជីសារពើភ័ណ្ឌ និងសម្ភារក្នុងបន្ទប់ ២០១</h4>
      <button onclick="showToast('បានកត់ត្រាសម្ភារថ្មី', 'success')" style="background:#2563eb; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer;"><i class="fas fa-plus"></i> បន្ថែមសម្ភារ</button>
    </div>
    <div class="krusmart-table-wrap">
      <table class="krusmart-table">
        <thead>
          <tr>
            <th>ល.រ</th>
            <th>ឈ្មោះសម្ភារ</th>
            <th>ចំនួនសរុប</th>
            <th>ស្ថានភាពល្អ</th>
            <th>ត្រូវជួសជុល</th>
            <th>ទីតាំង</th>
          </tr>
        </thead>
        <tbody>
  `;

  appData.inventory.forEach((item, idx) => {
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td style="font-weight:600; color:#f8fafc;">${item.item}</td>
        <td><strong>${item.total}</strong></td>
        <td style="color:#10b981;">${item.good}</td>
        <td style="color:${item.needsRepair > 0 ? '#ef4444' : '#64748b'};">${item.needsRepair}</td>
        <td>${item.location}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  body.innerHTML = html;
  openModal('modalInventory');
}

// 23. អត្តសញ្ញាណប័ណ្ណសិស្ស (Student ID Cards)
function openStudentIDCardsModal() {
  const body = document.getElementById('modalStudentIDCardsBody');
  if (!body) return;

  if (appData.students.length === 0) {
    body.innerHTML = renderStudentEmptyState(
      'មិនទាន់មានអត្តសញ្ញាណប័ណ្ណសិស្សទេ',
      'សូមបញ្ចូលបញ្ជីសិស្សជាមុនសិន ដើម្បីឱ្យប្រព័ន្ធបង្កើតប័ណ្ណសម្គាល់ខ្លួនសិស្សស្វ័យប្រវត្តិ។'
    );
    openModal('modalStudentIDCards');
    return;
  }

  let html = `
    <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <h4 style="color:#a855f7;"><i class="fas fa-id-badge"></i> គំរូប័ណ្ណសម្គាល់ខ្លួនសិស្ស (${appData.currentTeacher.assignedClass})</h4>
      <button onclick="window.print()" style="background:#2563eb; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer;"><i class="fas fa-print"></i> បោះពុម្ពប័ណ្ណទាំងអស់</button>
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
  `;

  appData.students.forEach(s => {
    html += `
      <div style="background:linear-gradient(135deg, #1e3a8a, #0f172a); border:2px solid #3b82f6; border-radius:12px; padding:16px; color:#fff; position:relative; box-shadow:0 8px 20px rgba(0,0,0,0.4);">
        <div style="display:flex; align-items:center; gap:8px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:8px; margin-bottom:10px;">
          <img src="assets/logo_ptec.svg" style="width:34px; height:34px;" alt="Logo">
          <div>
            <div style="font-size:0.72rem; font-weight:700; color:#93c5fd;">វិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ</div>
            <div style="font-size:0.65rem; color:#cbd5e1;">ប័ណ្ណសម្គាល់ខ្លួនសិស្ស</div>
          </div>
        </div>
        <div style="display:flex; gap:12px; align-items:center;">
          <div style="width:65px; height:75px; background:#0f172a; border:1px solid #3b82f6; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:2rem;">
            ${s.avatar}
          </div>
          <div style="font-size:0.8rem; line-height:1.6;">
            <div>ឈ្មោះ៖ <strong>${s.nameKh}</strong></div>
            ${s.nameEn ? `<div style="font-size:0.75rem; color:#94a3b8;">${s.nameEn}</div>` : ''}
            <div>ភេទ៖ ${s.gender} | កើត៖ ${s.dob || '-'}</div>
            <div>អត្តលេខ៖ <code>${s.id}</code></div>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  body.innerHTML = html;
  openModal('modalStudentIDCards');
}

// 24. ផ្ញើសារទៅអាណាព្យាបាល (Parent Messages)
function openParentMessagesModal() {
  openSendParentScoreModal();
}

// 25. សម្ភារឧបទេសផ្ទាល់ (Teaching Aids)
function openTeachingAidsModal() {
  const body = document.getElementById('modalTeachingAidsBody');
  if (!body) return;

  let html = `
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:16px;">
      <div style="background:#1e293b; padding:16px; border-radius:10px; border:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:2rem; margin-bottom:8px;">📐</div>
        <h4 style="color:#f8fafc; font-size:0.95rem; margin-bottom:4px;">ឧបករណ៍គណិតវិទ្យាឌីជីថល</h4>
        <p style="font-size:0.8rem; color:#94a3b8; margin-bottom:12px;">បន្ទាត់ កាំទ្រនិច បន្ទាត់កែង និងត្រីកោណមាត្រ</p>
        <button onclick="showToast('បានបើកឧបករណ៍ជំនួយគណិតវិទ្យា', 'info')" style="background:#2563eb; color:#fff; border:none; padding:5px 12px; border-radius:4px; font-size:0.8rem; cursor:pointer;">ប្រើប្រាស់</button>
      </div>
      <div style="background:#1e293b; padding:16px; border-radius:10px; border:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:2rem; margin-bottom:8px;">🔬</div>
        <h4 style="color:#f8fafc; font-size:0.95rem; margin-bottom:4px;">ក្លែងធ្វើពិសោធន៍វិទ្យាសាស្ត្រ (PhET)</h4>
        <p style="font-size:0.8rem; color:#94a3b8; margin-bottom:12px;">ពិសោធន៍អគ្គិសនី រូបវិទ្យា និងគីមីវិទ្យានិម្មិត</p>
        <button onclick="showToast('បានតភ្ជាប់ទៅ PhET Simulation', 'info')" style="background:#059669; color:#fff; border:none; padding:5px 12px; border-radius:4px; font-size:0.8rem; cursor:pointer;">បើកពិសោធន៍</button>
      </div>
      <div style="background:#1e293b; padding:16px; border-radius:10px; border:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:2rem; margin-bottom:8px;">⏱️</div>
        <h4 style="color:#f8fafc; font-size:0.95rem; margin-bottom:4px;">នាឡិកាកំណត់ម៉ោងពិភាក្សា</h4>
        <p style="font-size:0.8rem; color:#94a3b8; margin-bottom:12px;">កំណត់ម៉ោងកិច្ចការជាក្រុម (Countdown Timer)</p>
        <button onclick="showToast('នាឡិកាកំណត់ម៉ោងត្រូវបានចាប់ផ្តើម', 'success')" style="background:#d946ef; color:#fff; border:none; padding:5px 12px; border-radius:4px; font-size:0.8rem; cursor:pointer;">ចាប់ផ្ដើម ៥ នាទី</button>
      </div>
    </div>
  `;
  body.innerHTML = html;
  openModal('modalTeachingAids');
}

// 26. ព័ត៌មានគណនី (Account Settings)
function openAccountSettingsModal() {
  const body = document.getElementById('modalAccountSettingsBody');
  if (!body) return;

  const t = appData.currentTeacher;
  let html = `
    <div style="text-align:center; margin-bottom:20px;">
      <div style="width:70px; height:70px; border-radius:50%; background:linear-gradient(135deg, #2563eb, #9333ea); display:flex; align-items:center; justify-content:center; color:#fff; font-size:2rem; margin:0 auto 12px auto;">
        👩‍🏫
      </div>
      <h3 style="color:#f8fafc; margin-bottom:4px;">${t.nameKh}</h3>
      <p style="color:#94a3b8; font-size:0.85rem;">${t.email} • <span style="color:#facc15; font-weight:700;">👑 Premium Member</span></p>
    </div>
    <div style="background:#0f172a; padding:16px; border-radius:10px; border:1px solid #334155; margin-bottom:20px; font-size:0.88rem; line-height:2;">
      <div>🏫 <strong>ស្ថាប័ន៖</strong> ${t.schoolKh}</div>
      <div>📚 <strong>ថ្នាក់ទទួលបន្ទុក៖</strong> ${t.assignedClass}</div>
      <div>📅 <strong>ឆ្នាំសិក្សា៖</strong> ${t.academicYear}</div>
      <div>👥 <strong>ចំនួនសិស្សបច្ចុប្បន្ន៖</strong> ${appData.students.length} នាក់</div>
    </div>
    <div style="display:flex; justify-content:space-between; gap:10px;">
      <button onclick="clearAllStudentsConfirm()" style="background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.3); padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:600;"><i class="fas fa-trash-alt"></i> សម្អាតទិន្នន័យសិស្ស</button>
      <button onclick="handleLogout()" style="background:#ef4444; color:#fff; border:none; padding:8px 18px; border-radius:6px; font-weight:600; cursor:pointer;"><i class="fas fa-sign-out-alt"></i> ចាកចេញពីគណនី</button>
    </div>
  `;
  body.innerHTML = html;
  openModal('modalAccountSettings');
}

// Router for 26 Feature Cards
function handleCardAction(action) {
  switch (action) {
    case 'student-info': openStudentInfoModal(); break;
    case 'student-list': openStudentListModal(); break;
    case 'seating-plan': openSeatingPlanModal(); break;
    case 'monthly-attendance': openMonthlyAttendanceModal(); break;
    case 'monthly-scores': openMonthlyScoreModal(); break;
    case 'send-scores': openSendParentScoreModal(); break;
    case 'quick-score': openQuickScoreModal(); break;
    case 'cumulative-scores': openCumulativeScoreModal(); break;
    case 'ranking-table': openRankingTableModal(); break;
    case 'honor-roll': openHonorRollModal(); break;
    case 'annual-absence': openAnnualAbsenceModal(); break;
    case 'remedial': openRemedialModal(); break;
    case 'behavior': openBehaviorModal(); break;
    case 'demographics': openDemographicsModal(); break;
    case 'class-admin': openClassAdminModal(); break;
    case 'follow-up-book': openFollowUpBookModal(); break;
    case 'curriculum-books': openCurriculumBooksModal(); break;
    case 'exam-papers': openExamPapersModal(); break;
    case 'parent-report': openParentReportModal(); break;
    case 'student-codes': openStudentCodesModal(); break;
    case 'timetable': openTimetableModal(); break;
    case 'inventory': openInventoryModal(); break;
    case 'student-id-cards': openStudentIDCardsModal(); break;
    case 'parent-messages': openParentMessagesModal(); break;
    case 'teaching-aids': openTeachingAidsModal(); break;
    case 'account-settings': openAccountSettingsModal(); break;
    default:
      showToast('មុខងារនេះកំពុងដំណើរការ...', 'info');
  }
}
