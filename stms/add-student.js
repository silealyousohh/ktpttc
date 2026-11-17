/**
 * KruSmart - Student & Teacher Registration Form (ទម្រង់ចុះឈ្មោះសិស្ស និងគ្រូឧទ្ទេស)
 * Standard MoEYS Cambodia Registration Logic
 * KTPTTC - Kratie Provincial Teacher Training Center
 */

let currentRegistrationRole = 'student'; // 'student' or 'teacher'
let currentPhotoData = '';

document.addEventListener('DOMContentLoaded', () => {
  initCambodiaGeo();
  populateDynamicClasses();
  populateDynamicSubjects();
  setupClassSelector();

  // Check URL query parameters for role & edit ID
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = (urlParams.get('role') || urlParams.get('type') || '').toLowerCase();
  const editId = urlParams.get('id');

  const teachers = getSavedTeachers();
  const isTeacherId = editId && (editId.startsWith('USR-TRN') || teachers.some(tr => tr.id === editId || tr.username === editId));

  if (roleParam === 'teacher' || roleParam === 'trainer' || isTeacherId) {
    switchRegistrationRole('teacher', true);
  } else {
    switchRegistrationRole('student', true);
  }

  checkEditMode();
});

// Toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
  const color = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#38bdf8';
  
  toast.innerHTML = `<i class="fas ${icon}" style="color:${color}; font-size:1.1rem;"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --------------------------------------------------------------------------
// STORAGE ACCESSORS
// --------------------------------------------------------------------------

// Get saved students array from localStorage (KTPTTC STMS Database v2)
function getSavedStudents() {
  try {
    const rawStms = localStorage.getItem('ktpttc_stms_data_v2');
    if (rawStms) {
      const parsed = JSON.parse(rawStms);
      if (parsed && Array.isArray(parsed.trainees) && parsed.trainees.length > 0) {
        return parsed.trainees.filter(t => t && t.nameKh && !String(t.nameKh).includes('PK') && !/[\x00-\x08\x0E-\x1F\x7F]/.test(String(t.nameKh)));
      }
    }
    const legacy = localStorage.getItem('krusmart_teacher_custom_students');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(t => t && t.nameKh && !String(t.nameKh).includes('PK') && !/[\x00-\x08\x0E-\x1F\x7F]/.test(String(t.nameKh)));
      }
      if (parsed && Array.isArray(parsed.students) && parsed.students.length > 0) {
        return parsed.students.filter(t => t && t.nameKh && !String(t.nameKh).includes('PK') && !/[\x00-\x08\x0E-\x1F\x7F]/.test(String(t.nameKh)));
      }
    }
    if (window.KTPTTC_INITIAL_DATA && Array.isArray(window.KTPTTC_INITIAL_DATA.trainees)) {
      return window.KTPTTC_INITIAL_DATA.trainees;
    }
  } catch (e) {
    console.error(e);
  }
  return [];
}

// Save students array to localStorage
function saveStudentsToStorage(list) {
  try {
    let stmsObj = null;
    const rawStms = localStorage.getItem('ktpttc_stms_data_v2');
    if (rawStms) {
      stmsObj = JSON.parse(rawStms);
    } else {
      stmsObj = JSON.parse(JSON.stringify(window.KTPTTC_INITIAL_DATA || {}));
    }
    stmsObj.trainees = list;
    localStorage.setItem('ktpttc_stms_data_v2', JSON.stringify(stmsObj));
    localStorage.setItem('krusmart_teacher_custom_students', JSON.stringify(list));
  } catch (e) {
    console.error(e);
  }
}

// Get saved teachers array from localStorage
function getSavedTeachers() {
  try {
    const mockTeacherIds = ['USR-TRN-003', 'USR-TRN-004', 'USR-TRN-005', 'USR-TRN-006', 'USR-TRN-007', 'USR-TRN-008'];
    const mockTeacherNames = ['លោកស្រី ម៉ៅ សុភា', 'លោក គង់ វិចិត្រ', 'លោក អ៊ុំ សុវណ្ណ', 'លោក ព្រុំ សម្បត្តិ', 'លោកស្រី នួន ចរិយា', 'លោក ឡុង វិសិដ្ឋ'];

    const rawStms = localStorage.getItem('ktpttc_stms_data_v2');
    if (rawStms) {
      const parsed = JSON.parse(rawStms);
      if (parsed && Array.isArray(parsed.users)) {
        const cleanUsers = parsed.users.filter(u => !u || (!mockTeacherIds.includes(u.id) && !mockTeacherNames.includes(u.nameKh)));
        if (cleanUsers.length !== parsed.users.length) {
          parsed.users = cleanUsers;
          localStorage.setItem('ktpttc_stms_data_v2', JSON.stringify(parsed));
        }
        return cleanUsers.filter(u => u && u.role === 'trainer');
      }
    }
    if (window.KTPTTC_INITIAL_DATA && Array.isArray(window.KTPTTC_INITIAL_DATA.users)) {
      return window.KTPTTC_INITIAL_DATA.users.filter(u => u && u.role === 'trainer' && !mockTeacherIds.includes(u.id) && !mockTeacherNames.includes(u.nameKh));
    }
  } catch (e) {
    console.error(e);
  }
  return [];
}

// --------------------------------------------------------------------------
// ROLE SWITCHER LOGIC
// --------------------------------------------------------------------------

function switchRegistrationRole(role, isInitial = false) {
  currentRegistrationRole = role;

  const tabStu = document.getElementById('tabModeStudent');
  const tabTrn = document.getElementById('tabModeTeacher');
  const subtitle = document.getElementById('navBrandSubtitle');
  const formTitle = document.getElementById('formHeaderTitle');
  const classSel = document.getElementById('classSelector');
  const trnSubjSel = document.getElementById('teacherSubjectSelector');
  const rosterBtnText = document.getElementById('btnNavRosterText');
  const stuFields = document.getElementById('studentBasicFields');
  const trnFields = document.getElementById('teacherBasicFields');
  const stuStatus = document.getElementById('studentStatusSection');
  const trnEmp = document.getElementById('teacherEmploymentSection');
  const stuParents = document.getElementById('studentParentsSection');
  const trnEmerg = document.getElementById('teacherEmergencySection');
  const submitText = document.getElementById('btnSubmitText');

  // Student inputs
  const regStuId = document.getElementById('regStuId');
  const regNameKh = document.getElementById('regNameKh');
  const regUsername = document.getElementById('regUsername');
  const regPassword = document.getElementById('regPassword');

  // Teacher inputs
  const regTeacherId = document.getElementById('regTeacherId');
  const regTeacherNameKh = document.getElementById('regTeacherNameKh');
  const regTeacherPhone = document.getElementById('regTeacherPhone');
  const regTeacherUsername = document.getElementById('regTeacherUsername');
  const regTeacherPassword = document.getElementById('regTeacherPassword');

  if (role === 'teacher') {
    if (tabStu) tabStu.classList.remove('active');
    if (tabTrn) tabTrn.classList.add('active');
    if (subtitle) subtitle.innerText = 'ចុះឈ្មោះគ្រូឧទ្ទេសថ្មី (Add Teacher / Faculty)';
    if (formTitle && (!formTitle.dataset.editing || formTitle.dataset.editing === 'false')) {
      formTitle.innerHTML = '<i class="fas fa-chalkboard-teacher" style="color:#2563eb;"></i> គ្រប់គ្រងបញ្ជីគ្រូឧទ្ទេស និងសាស្ត្រាចារ្យ';
    }
    if (classSel) classSel.style.display = 'none';
    if (trnSubjSel) trnSubjSel.style.display = '';
    if (rosterBtnText) rosterBtnText.innerText = '+ បញ្ជីឈ្មោះគ្រូឧទ្ទេស';

    if (stuFields) stuFields.style.display = 'none';
    if (trnFields) trnFields.style.display = '';
    if (stuStatus) stuStatus.style.display = 'none';
    if (trnEmp) trnEmp.style.display = '';
    if (stuParents) stuParents.style.display = 'none';
    if (trnEmerg) trnEmerg.style.display = '';
    if (submitText && (!submitText.dataset.editing || submitText.dataset.editing === 'false')) {
      submitText.innerText = 'រក្សាទុកគ្រូឧទ្ទេស';
    }

    // Disable all inputs in student containers & enable teacher containers
    [stuFields, stuStatus, stuParents].forEach(sec => {
      if (sec) {
        sec.querySelectorAll('input, select, textarea').forEach(el => {
          el.disabled = true;
          el.required = false;
        });
      }
    });
    [trnFields, trnEmp, trnEmerg].forEach(sec => {
      if (sec) {
        sec.querySelectorAll('input, select, textarea').forEach(el => {
          el.disabled = false;
        });
      }
    });

    if (!isInitial || (regTeacherId && !regTeacherId.value)) {
      initTeacherIdSuggestion();
    }
  } else {
    if (tabStu) tabStu.classList.add('active');
    if (tabTrn) tabTrn.classList.remove('active');
    if (subtitle) subtitle.innerText = 'ចុះឈ្មោះសិស្សថ្មី (Add Student)';
    if (formTitle && (!formTitle.dataset.editing || formTitle.dataset.editing === 'false')) {
      formTitle.innerHTML = 'គ្រប់គ្រងបញ្ជីសិស្ស';
    }
    if (classSel) classSel.style.display = '';
    if (trnSubjSel) trnSubjSel.style.display = 'none';
    if (rosterBtnText) rosterBtnText.innerText = '+ បញ្ជីឈ្មោះសិស្ស';

    if (stuFields) stuFields.style.display = '';
    if (trnFields) trnFields.style.display = 'none';
    if (stuStatus) stuStatus.style.display = '';
    if (trnEmp) trnEmp.style.display = 'none';
    if (stuParents) stuParents.style.display = '';
    if (trnEmerg) trnEmerg.style.display = 'none';
    if (submitText && (!submitText.dataset.editing || submitText.dataset.editing === 'false')) {
      submitText.innerText = 'រក្សាទុកសិស្ស';
    }

    // Disable all inputs in teacher containers & enable student containers
    [trnFields, trnEmp, trnEmerg].forEach(sec => {
      if (sec) {
        sec.querySelectorAll('input, select, textarea').forEach(el => {
          el.disabled = true;
          el.required = false;
        });
      }
    });
    [stuFields, stuStatus, stuParents].forEach(sec => {
      if (sec) {
        sec.querySelectorAll('input, select, textarea').forEach(el => {
          el.disabled = false;
        });
      }
    });

    if (!isInitial || (regStuId && !regStuId.value)) {
      initStudentIdSuggestion();
    }
  }
}
window.switchRegistrationRole = switchRegistrationRole;

// Sync top teacher subject dropdown with form subject dropdown
function syncTeacherSubject(val) {
  const formSel = document.getElementById('regTeacherSubject');
  if (formSel && val && val !== 'all') {
    formSel.value = val;
  }
}
window.syncTeacherSubject = syncTeacherSubject;

// Toggle Password Visibility
function toggleRegPassword(inputId = 'regPassword', iconId = 'regEyeIcon') {
  const pInput = document.getElementById(inputId);
  const eyeIcon = document.getElementById(iconId);
  if (!pInput) return;
  if (pInput.type === 'password') {
    pInput.type = 'text';
    if (eyeIcon) eyeIcon.className = 'fas fa-eye-slash';
  } else {
    pInput.type = 'password';
    if (eyeIcon) eyeIcon.className = 'fas fa-eye';
  }
}
window.toggleRegPassword = toggleRegPassword;

// --------------------------------------------------------------------------
// ID SUGGESTIONS
// --------------------------------------------------------------------------

// Auto-suggest next Student ID & default Username
function initStudentIdSuggestion() {
  const students = getSavedStudents();
  const nextNumber = students.length + 1;
  const idInput = document.getElementById('regStuId');
  const uInput = document.getElementById('regUsername');
  
  if (idInput && !idInput.value) {
    const autoId = `KTPTTC-2026-12P2-${String(nextNumber).padStart(3, '0')}`;
    idInput.value = autoId;
    if (uInput && !uInput.value) {
      uInput.value = autoId.toLowerCase();
    }
  }

  // Live sync regStuId to regUsername if not manually touched
  if (idInput && !idInput._hasSyncListener) {
    idInput._hasSyncListener = true;
    idInput.addEventListener('input', () => {
      if (uInput && (!uInput.dataset.manual || uInput.dataset.manual === 'false')) {
        uInput.value = idInput.value.trim().toLowerCase();
      }
    });
  }

  if (uInput && !uInput._hasManualListener) {
    uInput._hasManualListener = true;
    uInput.addEventListener('input', () => {
      uInput.dataset.manual = 'true';
    });
  }
}

// Auto-suggest next Teacher ID & default Username / Email
function initTeacherIdSuggestion() {
  const teachers = getSavedTeachers();
  const nextNumber = teachers.length + 1;
  const idInput = document.getElementById('regTeacherId');
  const uInput = document.getElementById('regTeacherUsername');
  const emailInput = document.getElementById('regTeacherEmail');

  if (idInput && !idInput.value) {
    const autoId = `USR-TRN-${String(nextNumber).padStart(3, '0')}`;
    idInput.value = autoId;
    if (uInput && !uInput.value) {
      uInput.value = autoId.toLowerCase();
    }
    if (emailInput && !emailInput.value) {
      emailInput.value = `${autoId.toLowerCase()}@ktpttc.edu.kh`;
    }
  }

  // Live sync regTeacherId to username & email
  if (idInput && !idInput._hasSyncListenerTrn) {
    idInput._hasSyncListenerTrn = true;
    idInput.addEventListener('input', () => {
      const val = idInput.value.trim().toLowerCase();
      if (uInput && (!uInput.dataset.manual || uInput.dataset.manual === 'false')) {
        uInput.value = val;
      }
      if (emailInput && (!emailInput.dataset.manual || emailInput.dataset.manual === 'false')) {
        emailInput.value = `${val}@ktpttc.edu.kh`;
      }
    });
  }

  if (uInput && !uInput._hasManualListenerTrn) {
    uInput._hasManualListenerTrn = true;
    uInput.addEventListener('input', () => {
      uInput.dataset.manual = 'true';
    });
  }

  if (emailInput && !emailInput._hasManualListenerTrn) {
    emailInput._hasManualListenerTrn = true;
    emailInput.addEventListener('input', () => {
      emailInput.dataset.manual = 'true';
    });
  }
}

// --------------------------------------------------------------------------
// DYNAMIC CLASS & SUBJECT LOADERS WITH QUICK CREATION MODALS
// --------------------------------------------------------------------------

// Populate Dynamic Classes from Storage
function populateDynamicClasses(selectedClass = null) {
  const sel = document.getElementById('classSelector');
  const classInput = document.getElementById('regClass');
  const groupInput = document.getElementById('regGroup');

  let classList = [];
  try {
    const raw = localStorage.getItem('ktpttc_stms_data_v2');
    if (raw) {
      const data = JSON.parse(raw);
      const set = new Set();
      (data.cohorts || []).forEach(c => {
        (c.classes || []).forEach(cls => { if (cls) set.add(cls.trim()); });
      });
      (data.customClasses || []).forEach(c => {
        const name = typeof c === 'string' ? c : c?.name;
        if (name) set.add(name.trim());
      });
      (data.trainees || []).forEach(t => {
        if (t.className) set.add(t.className.trim());
      });
      classList = Array.from(set);
    }
  } catch (e) {
    console.error(e);
  }

  if (sel) {
    if (classList.length === 0) {
      sel.innerHTML = '<option value="">-- សូមចុចប៊ូតុង + ដើម្បីបន្ថែមថ្នាក់រៀន --</option>';
    } else {
      const currentVal = selectedClass || sel.value || classList[0];
      sel.innerHTML = classList.map(cls => `<option value="${cls}" ${cls === currentVal ? 'selected' : ''}>${cls}</option>`).join('');
    }
  }

  // Also ensure regClass has matching options
  if (classInput) {
    const gradeLevels = ['១២+២', '១២+៤', 'បរិញ្ញាបត្រ+១', '១២+២ (មត្តេយ្យ)', 'វិក្រឹតការ'];
    const currentGVal = classInput.value;
    classInput.innerHTML = gradeLevels.map(gl => `<option value="${gl}" ${gl === currentGVal ? 'selected' : ''}>${gl}</option>`).join('');
  }

  // Also ensure regGroup has standard groups
  if (groupInput) {
    const groups = ['ក្រុម ក', 'ក្រុម ខ', 'ក្រុម គ', 'ក្រុម ឃ', 'ក្រុម ង', 'ក្រុម ១', 'ក្រុម ២', 'ក្រុម ៣'];
    const currentGrVal = groupInput.value;
    groupInput.innerHTML = groups.map(gr => `<option value="${gr}" ${gr === currentGrVal ? 'selected' : ''}>${gr}</option>`).join('');
  }

  if (selectedClass) {
    syncClassInputFromSelected(selectedClass);
  }
}
window.populateDynamicClasses = populateDynamicClasses;

function syncClassInputFromSelected(val) {
  const classInput = document.getElementById('regClass');
  const groupInput = document.getElementById('regGroup');
  if (classInput) {
    if (val.includes('១២+៤')) classInput.value = '១២+៤';
    else if (val.includes('បរិញ្ញា')) classInput.value = 'បរិញ្ញាបត្រ+១';
    else if (val.includes('មត្តេយ្យ')) classInput.value = '១២+២ (មត្តេយ្យ)';
    else if (val.includes('វិក្រឹត')) classInput.value = 'វិក្រឹតការ';
    else classInput.value = '១២+២';
  }
  if (groupInput) {
    if (val.includes('ក្រុម ខ')) groupInput.value = 'ក្រុម ខ';
    else if (val.includes('ក្រុម គ')) groupInput.value = 'ក្រុម គ';
    else if (val.includes('ក្រុម ឃ')) groupInput.value = 'ក្រុម ឃ';
    else if (val.includes('ក្រុម ង')) groupInput.value = 'ក្រុម ង';
    else if (val.includes('ក្រុម ១')) groupInput.value = 'ក្រុម ១';
    else if (val.includes('ក្រុម ២')) groupInput.value = 'ក្រុម ២';
    else if (val.includes('ក្រុម ៣')) groupInput.value = 'ក្រុម ៣';
    else groupInput.value = 'ក្រុម ក';
  }
}

// Populate Dynamic Subjects from Storage
function populateDynamicSubjects(selectedCode = null) {
  const trnSubjSel = document.getElementById('teacherSubjectSelector');
  const regSubjSel = document.getElementById('regTeacherSubject');

  let subjects = [];
  try {
    const raw = localStorage.getItem('ktpttc_stms_data_v2');
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.subjects) && data.subjects.length > 0) {
        subjects = data.subjects;
      }
    }
  } catch (e) {
    console.error(e);
  }

  if (subjects.length === 0 && window.KTPTTC_INITIAL_DATA && Array.isArray(window.KTPTTC_INITIAL_DATA.subjects)) {
    subjects = window.KTPTTC_INITIAL_DATA.subjects;
  }

  if (subjects.length === 0) {
    subjects = [
      { code: "PED-101", nameKh: "គរុកោសល្យទូទៅ និងវិធីសាស្ត្របង្រៀន" },
      { code: "PSY-102", nameKh: "ចិត្តវិទ្យាគរុកោសល្យ និងការអភិវឌ្ឍកុមារ" },
      { code: "MTH-103", nameKh: "វិធីសាស្ត្របង្រៀនគណិតវិទ្យាបឋម" },
      { code: "KHM-104", nameKh: "វិធីសាស្ត្របង្រៀនភាសាខ្មែរ និងអំណានដំបូង" },
      { code: "ICT-105", nameKh: "បច្ចេកវិទ្យាព័ត៌មានក្នុងការអប់រំ (ICT)" },
      { code: "RES-106", nameKh: "ការស្រាវជ្រាវសកម្មភាពក្នុងថ្នាក់រៀន (Action Research)" },
      { code: "PRAC-107", nameKh: "ការចុះកម្មសិក្សាគរុកោសល្យនៅសាលាបឋម (Practicum)" },
      { code: "COM-108", nameKh: "បច្ចេកវិទ្យាព័ត៌មានវិទ្យា និងសារគមនាគមន៍" }
    ];
  }

  if (trnSubjSel) {
    const currentVal = trnSubjSel.value || 'all';
    trnSubjSel.innerHTML = `
      <option value="all">មុខវិជ្ជាទាំងអស់</option>
      ${subjects.map(s => `<option value="${s.code}" ${s.code === currentVal ? 'selected' : ''}>${s.code} • ${s.nameKh}</option>`).join('')}
    `;
  }

  if (regSubjSel) {
    const currentRegVal = selectedCode || regSubjSel.value || subjects[0]?.code;
    regSubjSel.innerHTML = subjects.map(s => `<option value="${s.code}" ${s.code === currentRegVal ? 'selected' : ''}>${s.code} • ${s.nameKh}</option>`).join('');
  }
}
window.populateDynamicSubjects = populateDynamicSubjects;

// Setup Class Selector dropdown (2-way sync with regClass & regGroup)
function setupClassSelector() {
  const sel = document.getElementById('classSelector');
  if (sel) {
    sel.addEventListener('change', (e) => {
      syncClassInputFromSelected(e.target.value);
    });
  }
}

// Close Quick Modal
function closeQuickModal() {
  const container = document.getElementById('quickModalContainer');
  if (container) container.innerHTML = '';
}
window.closeQuickModal = closeQuickModal;

// Quick Add Class Modal
function openQuickAddClassModal() {
  const container = document.getElementById('quickModalContainer');
  if (!container) return;

  container.innerHTML = `
    <div style="position:fixed; inset:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(3px); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;" onclick="if(event.target===this) closeQuickModal()">
      <div style="background:#fff; border-radius:12px; width:100%; max-width:480px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.2); overflow:hidden;">
        <div style="background:#1e3a8a; color:#fff; padding:14px 18px; display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:1rem; display:flex; align-items:center; gap:8px;">
            <i class="fas fa-chalkboard"></i> បន្ថែមថ្នាក់រៀនថ្មី (Add Class)
          </strong>
          <button type="button" onclick="closeQuickModal()" style="background:none; border:none; color:#fff; font-size:1.4rem; cursor:pointer; line-height:1;">&times;</button>
        </div>
        <form onsubmit="saveQuickClass(event)" style="padding:18px;">
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div>
              <label style="font-size:0.8rem; font-weight:700; color:#1e3a8a; margin-bottom:4px; display:block;">
                ឈ្មោះថ្នាក់ពេញ (Full Class Name) <span style="color:#ef4444;">*</span>
              </label>
              <input type="text" id="quickClassName" class="form-control" placeholder="ឧ. ១២+២ ក្រុម គ" required>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <div>
                <label style="font-size:0.8rem; font-weight:700; color:#1e3a8a; margin-bottom:4px; display:block;">កម្រិតសិក្សា</label>
                <select id="quickClassGrade" class="form-control">
                  <option value="១២+២">១២+២ (បឋម)</option>
                  <option value="១២+៤">១២+៤ (បឋម)</option>
                  <option value="បរិញ្ញាបត្រ+១">បរិញ្ញាបត្រ+១</option>
                  <option value="១២+២ (មត្តេយ្យ)">១២+២ (មត្តេយ្យ)</option>
                  <option value="វិក្រឹតការ">វិក្រឹតការ</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.8rem; font-weight:700; color:#1e3a8a; margin-bottom:4px; display:block;">ក្រុម</label>
                <select id="quickClassGroup" class="form-control">
                  <option value="ក្រុម ក">ក្រុម ក</option>
                  <option value="ក្រុម ខ">ក្រុម ខ</option>
                  <option value="ក្រុម គ">ក្រុម គ</option>
                  <option value="ក្រុម ឃ">ក្រុម ឃ</option>
                  <option value="ក្រុម ង">ក្រុម ង</option>
                  <option value="ក្រុម ១">ក្រុម ១</option>
                </select>
              </div>
            </div>
            <div>
              <label style="font-size:0.8rem; font-weight:700; color:#1e3a8a; margin-bottom:4px; display:block;">បន្ទប់រៀន</label>
              <input type="text" id="quickClassRoom" class="form-control" value="បន្ទប់ ១០១" placeholder="បន្ទប់រៀន">
            </div>
          </div>
          <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px; border-top:1px solid #e2e8f0; padding-top:12px;">
            <button type="button" class="btn-cancel" onclick="closeQuickModal()" style="height:34px; padding:0 12px; font-size:0.82rem; border-radius:6px; background:#f1f5f9; border:1px solid #cbd5e1; cursor:pointer;">បោះបង់</button>
            <button type="submit" class="btn-action btn-submit" style="height:34px; padding:0 14px; font-size:0.82rem; border-radius:6px; background:#2563eb; color:#fff; border:none; cursor:pointer;">
              <i class="fas fa-save"></i> រក្សាទុកថ្នាក់
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}
window.openQuickAddClassModal = openQuickAddClassModal;

function saveQuickClass(event) {
  event.preventDefault();
  const name = document.getElementById('quickClassName').value.trim();
  const gradeLevel = document.getElementById('quickClassGrade').value;
  const group = document.getElementById('quickClassGroup').value;
  const room = document.getElementById('quickClassRoom').value.trim() || 'បន្ទប់ ១០១';

  if (!name) {
    showToast('សូមបញ្ចូលឈ្មោះថ្នាក់!', 'error');
    return;
  }

  try {
    let stmsObj = null;
    const rawStms = localStorage.getItem('ktpttc_stms_data_v2');
    if (rawStms) stmsObj = JSON.parse(rawStms);
    else stmsObj = JSON.parse(JSON.stringify(window.KTPTTC_INITIAL_DATA || {}));

    if (!Array.isArray(stmsObj.customClasses)) stmsObj.customClasses = [];
    if (!Array.isArray(stmsObj.cohorts)) stmsObj.cohorts = [];

    // Push class
    stmsObj.customClasses.push({ name, gradeLevel, group, room, capacity: 35 });

    // Link to first matching cohort or first cohort
    if (stmsObj.cohorts.length > 0) {
      const matchCohort = stmsObj.cohorts.find(c => c.nameKh && c.nameKh.includes(gradeLevel.replace(/\(.*\)/, '').trim())) || stmsObj.cohorts[0];
      if (matchCohort) {
        if (!Array.isArray(matchCohort.classes)) matchCohort.classes = [];
        if (!matchCohort.classes.includes(name)) matchCohort.classes.push(name);
      }
    }

    localStorage.setItem('ktpttc_stms_data_v2', JSON.stringify(stmsObj));
    populateDynamicClasses(name);
    closeQuickModal();
    showToast(`✅ បានបន្ថែមថ្នាក់ «${name}» ដោយជោគជ័យ!`, 'success');
  } catch (e) {
    console.error(e);
    showToast('បរាជ័យក្នុងការរក្សាទុកថ្នាក់!', 'error');
  }
}
window.saveQuickClass = saveQuickClass;

// Quick Add Subject Modal
function openQuickAddSubjectModal() {
  const container = document.getElementById('quickModalContainer');
  if (!container) return;

  container.innerHTML = `
    <div style="position:fixed; inset:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(3px); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;" onclick="if(event.target===this) closeQuickModal()">
      <div style="background:#fff; border-radius:12px; width:100%; max-width:500px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.2); overflow:hidden;">
        <div style="background:#7c3aed; color:#fff; padding:14px 18px; display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:1rem; display:flex; align-items:center; gap:8px;">
            <i class="fas fa-book"></i> បន្ថែមមុខវិជ្ជាថ្មី (Add Subject)
          </strong>
          <button type="button" onclick="closeQuickModal()" style="background:none; border:none; color:#fff; font-size:1.4rem; cursor:pointer; line-height:1;">&times;</button>
        </div>
        <form onsubmit="saveQuickSubject(event)" style="padding:18px;">
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div style="display:grid; grid-template-columns: 1fr 2fr; gap:10px;">
              <div>
                <label style="font-size:0.8rem; font-weight:700; color:#1e3a8a; margin-bottom:4px; display:block;">
                  កូដមុខវិជ្ជា <span style="color:#ef4444;">*</span>
                </label>
                <input type="text" id="quickSubjCode" class="form-control" placeholder="ឧ. MTH-104" style="text-transform:uppercase; font-weight:700;" required>
              </div>
              <div>
                <label style="font-size:0.8rem; font-weight:700; color:#1e3a8a; margin-bottom:4px; display:block;">
                  ឈ្មោះជាខ្មែរ <span style="color:#ef4444;">*</span>
                </label>
                <input type="text" id="quickSubjNameKh" class="form-control" placeholder="ឧ. វិធីសាស្ត្របង្រៀនគណិតវិទ្យា" required>
              </div>
            </div>
            <div>
              <label style="font-size:0.8rem; font-weight:700; color:#1e3a8a; margin-bottom:4px; display:block;">ឈ្មោះជាឡាតាំង (English Name)</label>
              <input type="text" id="quickSubjNameEn" class="form-control" placeholder="ឧ. Mathematics Methodology">
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <div>
                <label style="font-size:0.8rem; font-weight:700; color:#1e3a8a; margin-bottom:4px; display:block;">ក្រេឌីត</label>
                <input type="number" id="quickSubjCredits" class="form-control" value="3" min="1" max="10">
              </div>
              <div>
                <label style="font-size:0.8rem; font-weight:700; color:#1e3a8a; margin-bottom:4px; display:block;">ឆមាស</label>
                <select id="quickSubjSemester" class="form-control">
                  <option value="ឆមាសទី ១">ឆមាសទី ១</option>
                  <option value="ឆមាសទី ២">ឆមាសទី ២</option>
                  <option value="ទាំងពីរឆមាស">ទាំងពីរឆមាស</option>
                </select>
              </div>
            </div>
          </div>
          <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px; border-top:1px solid #e2e8f0; padding-top:12px;">
            <button type="button" class="btn-cancel" onclick="closeQuickModal()" style="height:34px; padding:0 12px; font-size:0.82rem; border-radius:6px; background:#f1f5f9; border:1px solid #cbd5e1; cursor:pointer;">បោះបង់</button>
            <button type="submit" class="btn-action btn-submit" style="height:34px; padding:0 14px; font-size:0.82rem; border-radius:6px; background:#7c3aed; color:#fff; border:none; cursor:pointer;">
              <i class="fas fa-save"></i> រក្សាទុកមុខវិជ្ជា
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}
window.openQuickAddSubjectModal = openQuickAddSubjectModal;

function saveQuickSubject(event) {
  event.preventDefault();
  const code = document.getElementById('quickSubjCode').value.trim().toUpperCase();
  const nameKh = document.getElementById('quickSubjNameKh').value.trim();
  const nameEn = document.getElementById('quickSubjNameEn').value.trim();
  const credits = parseInt(document.getElementById('quickSubjCredits').value, 10) || 3;
  const semester = document.getElementById('quickSubjSemester').value;

  if (!code || !nameKh) {
    showToast('សូមបញ្ចូលកូដ និងឈ្មោះមុខវិជ្ជា!', 'error');
    return;
  }

  try {
    let stmsObj = null;
    const rawStms = localStorage.getItem('ktpttc_stms_data_v2');
    if (rawStms) stmsObj = JSON.parse(rawStms);
    else stmsObj = JSON.parse(JSON.stringify(window.KTPTTC_INITIAL_DATA || {}));

    if (!Array.isArray(stmsObj.subjects)) stmsObj.subjects = [];

    const existingIdx = stmsObj.subjects.findIndex(s => s.code === code);
    const subjObj = { code, nameKh, nameEn, credits, semester, category: 'គរុកោសល្យ' };

    if (existingIdx !== -1) {
      stmsObj.subjects[existingIdx] = subjObj;
    } else {
      stmsObj.subjects.push(subjObj);
    }

    localStorage.setItem('ktpttc_stms_data_v2', JSON.stringify(stmsObj));
    populateDynamicSubjects(code);
    closeQuickModal();
    showToast(`✅ បានបន្ថែមមុខវិជ្ជា «${nameKh} (${code})» ដោយជោគជ័យ!`, 'success');
  } catch (e) {
    console.error(e);
    showToast('បរាជ័យក្នុងការរក្សាទុកមុខវិជ្ជា!', 'error');
  }
}
window.saveQuickSubject = saveQuickSubject;

// --------------------------------------------------------------------------
// EDIT MODE HANDLER
// --------------------------------------------------------------------------

// Check Edit Mode from URL query (?id=STU-001 or ?role=teacher&id=USR-TRN-001)
function checkEditMode() {
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('id');
  if (!editId) return;

  const title = document.getElementById('formHeaderTitle');
  const submitText = document.getElementById('btnSubmitText');
  const submitIcon = document.getElementById('btnSubmitIcon');
  const submitBtn = document.getElementById('btnSubmitForm');

  if (title) title.dataset.editing = 'true';
  if (submitText) {
    submitText.dataset.editing = 'true';
    submitText.innerText = 'រក្សាទុកការកែប្រែ (Update)';
  }
  if (submitIcon) submitIcon.className = 'fas fa-sync-alt';
  if (submitBtn) {
    submitBtn.style.background = '#2563eb';
    submitBtn.type = 'button';
    submitBtn.onclick = function(e) {
      if (e) e.preventDefault();
      handleUnifiedSave();
      return false;
    };
  }

  // 1. Try finding Teacher first if role is teacher
  if (currentRegistrationRole === 'teacher' || editId.startsWith('USR-TRN')) {
    const teachers = getSavedTeachers();
    const tr = teachers.find(x => x.id === editId || (x.id && x.id.toLowerCase() === editId.toLowerCase()) || x.username === editId);
    if (tr) {
      if (currentRegistrationRole !== 'teacher') switchRegistrationRole('teacher', true);
      if (title) title.innerHTML = `<i class="fas fa-chalkboard-teacher" style="color: #2563eb;"></i> កែប្រែព័ត៌មានគ្រូឧទ្ទេស (${tr.nameKh})`;

      const idInput = document.getElementById('regTeacherId');
      if (idInput) {
        idInput.value = tr.id;
        idInput.readOnly = true;
        idInput.style.backgroundColor = '#f1f5f9';
        idInput.style.cursor = 'not-allowed';
      }

      if (document.getElementById('regTeacherSubject')) document.getElementById('regTeacherSubject').value = tr.subject || 'PED-101';
      if (document.getElementById('teacherSubjectSelector')) document.getElementById('teacherSubjectSelector').value = tr.subject || 'PED-101';
      if (document.getElementById('regTeacherQual')) document.getElementById('regTeacherQual').value = tr.qualification || 'អនុបណ្ឌិតគរុកោសល្យ';
      if (document.getElementById('regTeacherNameKh')) document.getElementById('regTeacherNameKh').value = tr.nameKh || '';
      if (document.getElementById('regTeacherNameEn')) document.getElementById('regTeacherNameEn').value = tr.nameEn || '';
      if (document.getElementById('regTeacherGender')) document.getElementById('regTeacherGender').value = tr.gender || 'ប្រុស';
      if (document.getElementById('regTeacherDob')) {
        document.getElementById('regTeacherDob').value = tr.dob || '1985-05-15';
        calculateAgeFromDob(tr.dob || '1985-05-15', 'regTeacherAge');
      }
      if (document.getElementById('regTeacherPhone')) document.getElementById('regTeacherPhone').value = tr.phone || '';
      if (document.getElementById('regTeacherEmail')) document.getElementById('regTeacherEmail').value = tr.email || '';
      if (document.getElementById('regTeacherUsername')) {
        document.getElementById('regTeacherUsername').value = tr.username || tr.id.toLowerCase();
        document.getElementById('regTeacherUsername').dataset.manual = 'true';
      }
      if (document.getElementById('regTeacherPassword')) document.getElementById('regTeacherPassword').value = tr.password || 'ktpttc123';
      if (document.getElementById('regTeacherRoleTitle')) document.getElementById('regTeacherRoleTitle').value = tr.position || 'គ្រូឧទ្ទេសពេញម៉ោង';
      if (document.getElementById('regTeacherExperience')) document.getElementById('regTeacherExperience').value = tr.experience || '';

      if (tr.photo) setPhotoPreview(tr.photo);

      // Place of birth
      if (tr.birthplace && typeof tr.birthplace === 'object') {
        if (document.getElementById('pobProvince')) document.getElementById('pobProvince').value = tr.birthplace.province || '';
        if (document.getElementById('pobDistrict')) document.getElementById('pobDistrict').value = tr.birthplace.district || '';
        if (document.getElementById('pobCommune')) document.getElementById('pobCommune').value = tr.birthplace.commune || '';
        if (document.getElementById('pobVillage')) document.getElementById('pobVillage').value = tr.birthplace.village || '';
      } else if (tr.pob && typeof tr.pob === 'string') {
        if (document.getElementById('pobProvince')) document.getElementById('pobProvince').value = tr.pob;
      }

      // Address
      const curAddr = tr.currentAddress || tr.address;
      if (curAddr && typeof curAddr === 'object') {
        if (document.getElementById('curProvince')) document.getElementById('curProvince').value = curAddr.province || '';
        if (document.getElementById('curDistrict')) document.getElementById('curDistrict').value = curAddr.district || '';
        if (document.getElementById('curCommune')) document.getElementById('curCommune').value = curAddr.commune || '';
        if (document.getElementById('curVillage')) document.getElementById('curVillage').value = curAddr.village || '';
      } else if (typeof curAddr === 'string' && curAddr) {
        if (document.getElementById('curProvince')) document.getElementById('curProvince').value = curAddr;
      }

      // Employment
      if (tr.employment) {
        if (document.getElementById('teacherStatusWork')) document.getElementById('teacherStatusWork').value = tr.employment.status || 'កំពុងបង្រៀន';
        if (document.getElementById('teacherContractType')) document.getElementById('teacherContractType').value = tr.employment.type || 'ក្របខណ្ឌរដ្ឋ';
        if (document.getElementById('teacherStartDate')) document.getElementById('teacherStartDate').value = tr.employment.startDate || '';
        if (document.getElementById('teacherDept')) document.getElementById('teacherDept').value = tr.employment.department || 'ដេប៉ាតឺម៉ង់គរុកោសល្យទូទៅ';
      }

      // Emergency Contact
      if (tr.emergencyContact) {
        if (document.getElementById('teacherEmergName')) document.getElementById('teacherEmergName').value = tr.emergencyContact.name || '';
        if (document.getElementById('teacherEmergRel')) document.getElementById('teacherEmergRel').value = tr.emergencyContact.relation || '';
        if (document.getElementById('teacherEmergPhone')) document.getElementById('teacherEmergPhone').value = tr.emergencyContact.phone || '';
      }

      // Additional
      if (tr.additional) {
        if (document.getElementById('ethnicGroup')) document.getElementById('ethnicGroup').value = tr.additional.specialSkills || '';
        if (document.getElementById('specialNotes')) document.getElementById('specialNotes').value = tr.additional.specialNotes || '';
        if (document.getElementById('serviceNotes')) document.getElementById('serviceNotes').value = tr.additional.serviceNotes || '';
      }

      setTimeout(() => { syncAllGeoFields(); }, 50);
      return;
    }
  }

  // 2. Try finding Student
  const students = getSavedStudents();
  const s = students.find(x => x.id === editId || (x.id && x.id.toLowerCase() === editId.toLowerCase()));
  if (!s) {
    showToast(`រកមិនឃើញទិន្នន័យដែលមានអត្តលេខ ${editId} ទេ!`, 'error');
    return;
  }

  if (currentRegistrationRole !== 'student') switchRegistrationRole('student', true);
  if (title) title.innerHTML = `<i class="fas fa-user-edit" style="color: #2563eb;"></i> កែប្រែព័ត៌មានសិស្ស (${s.nameKh})`;

  const idInput = document.getElementById('regStuId');
  if (idInput) {
    idInput.value = s.id;
    idInput.readOnly = true;
    idInput.style.backgroundColor = '#f1f5f9';
    idInput.style.cursor = 'not-allowed';
  }

  const classVal = s.classGrade || (s.className && s.className.includes('១២+៤') ? '១២+៤' : s.className && s.className.includes('បរិញ្ញា') ? 'បរិញ្ញាបត្រ+១' : '១២+២');
  const groupVal = s.group || (s.className && s.className.includes('ក្រុម ខ') ? 'ក្រុម ខ' : s.className && s.className.includes('ក្រុម គ') ? 'ក្រុម គ' : s.className && s.className.includes('ក្រុម ឃ') ? 'ក្រុម ឃ' : s.className && s.className.includes('ក្រុម ង') ? 'ក្រុម ង' : s.className && s.className.includes('ក្រុម ១') ? 'ក្រុម ១' : s.className && s.className.includes('ក្រុម ២') ? 'ក្រុម ២' : 'ក្រុម ក');

  if (document.getElementById('regClass')) document.getElementById('regClass').value = classVal;
  if (document.getElementById('regGroup')) document.getElementById('regGroup').value = groupVal;

  const sel = document.getElementById('classSelector');
  if (sel) sel.value = `${classVal} ${groupVal}`;

  if (document.getElementById('regNameKh')) document.getElementById('regNameKh').value = s.nameKh || '';
  if (document.getElementById('regNameEn')) document.getElementById('regNameEn').value = s.nameEn || '';
  if (document.getElementById('regGender')) document.getElementById('regGender').value = s.gender || 'ប្រុស';
  if (document.getElementById('regDob')) {
    document.getElementById('regDob').value = s.dob || '';
    calculateAgeFromDob(s.dob, 'regAge');
  }
  if (document.getElementById('regParentPhone')) document.getElementById('regParentPhone').value = s.parentPhone || s.phone || '';
  if (document.getElementById('regUsername')) {
    document.getElementById('regUsername').value = s.username || s.id.toLowerCase();
    document.getElementById('regUsername').dataset.manual = 'true';
  }
  if (document.getElementById('regPassword')) {
    document.getElementById('regPassword').value = s.password || 'ktpttc123';
  }

  if (s.photo) setPhotoPreview(s.photo);

  if (s.birthplace && typeof s.birthplace === 'object') {
    if (document.getElementById('pobProvince')) document.getElementById('pobProvince').value = s.birthplace.province || '';
    if (document.getElementById('pobDistrict')) document.getElementById('pobDistrict').value = s.birthplace.district || '';
    if (document.getElementById('pobCommune')) document.getElementById('pobCommune').value = s.birthplace.commune || '';
    if (document.getElementById('pobVillage')) document.getElementById('pobVillage').value = s.birthplace.village || '';
  } else if (s.pob && typeof s.pob === 'string') {
    if (document.getElementById('pobProvince')) document.getElementById('pobProvince').value = s.pob;
  }

  const curAddr = s.currentAddress || s.address;
  if (curAddr && typeof curAddr === 'object') {
    if (document.getElementById('curProvince')) document.getElementById('curProvince').value = curAddr.province || '';
    if (document.getElementById('curDistrict')) document.getElementById('curDistrict').value = curAddr.district || '';
    if (document.getElementById('curCommune')) document.getElementById('curCommune').value = curAddr.commune || '';
    if (document.getElementById('curVillage')) document.getElementById('curVillage').value = curAddr.village || '';
  } else if (typeof curAddr === 'string' && curAddr) {
    if (document.getElementById('curProvince')) document.getElementById('curProvince').value = curAddr;
  }

  setTimeout(() => { syncAllGeoFields(); }, 50);

  if (s.status && typeof s.status === 'object') {
    if (document.getElementById('statusNew')) document.getElementById('statusNew').value = s.status.isNew || 'បាទ/ចាស';
    if (document.getElementById('statusRepeater')) document.getElementById('statusRepeater').value = s.status.isRepeater || 'ទេ';
    if (document.getElementById('statusFamily')) document.getElementById('statusFamily').value = s.status.familyStatus || 'ទេ';
    if (document.getElementById('statusDisability')) document.getElementById('statusDisability').value = s.status.disability || 'ទេ';
    if (document.getElementById('statusPoorCard')) document.getElementById('statusPoorCard').value = s.status.poorCard || 'គ្មាន';
    if (document.getElementById('statusEthnic')) document.getElementById('statusEthnic').value = s.status.ethnic || 'ទេ';
    if (document.getElementById('statusScholarship')) document.getElementById('statusScholarship').value = s.status.scholarship || 'ទេ';
  }

  if (s.parents) {
    if (document.getElementById('fatherName')) document.getElementById('fatherName').value = s.parents.fatherName || '';
    if (document.getElementById('fatherJob')) document.getElementById('fatherJob').value = s.parents.fatherJob || '';
    if (document.getElementById('motherName')) document.getElementById('motherName').value = s.parents.motherName || '';
    if (document.getElementById('motherJob')) document.getElementById('motherJob').value = s.parents.motherJob || '';
    if (document.getElementById('guardianName')) document.getElementById('guardianName').value = s.parents.guardianName || '';
    if (document.getElementById('guardianJob')) document.getElementById('guardianJob').value = s.parents.guardianJob || '';
  }

  if (s.additional) {
    if (document.getElementById('ethnicGroup')) document.getElementById('ethnicGroup').value = s.additional.ethnicGroup || '';
    if (document.getElementById('specialNotes')) document.getElementById('specialNotes').value = s.additional.specialNotes || '';
    if (document.getElementById('serviceNotes')) document.getElementById('serviceNotes').value = s.additional.serviceNotes || '';
  }
}

// Calculate Age from Date of Birth
function calculateAgeFromDob(dobString, targetId = 'regAge') {
  const ageInput = document.getElementById(targetId);
  if (!dobString || !ageInput) return;

  const dob = new Date(dobString);
  const now = new Date();
  if (isNaN(dob.getTime())) return;

  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    age--;
  }

  if (age >= 0 && age < 100) {
    ageInput.value = `${age} ឆ្នាំ`;
  } else {
    ageInput.value = '';
  }
}
window.calculateAgeFromDob = calculateAgeFromDob;

// --------------------------------------------------------------------------
// PHOTO HANDLERS
// --------------------------------------------------------------------------

function triggerPhotoFileInput() {
  const input = document.getElementById('photoFileInput');
  if (input) input.click();
}
window.triggerPhotoFileInput = triggerPhotoFileInput;

function showPhotoUploading(isLoading) {
  const spinner = document.getElementById('photoUploadingSpinner');
  if (spinner) {
    spinner.style.display = isLoading ? 'flex' : 'none';
  }
}

// Compress image via HTML5 Canvas
function compressImage(source, maxWidth = 500, maxHeight = 600, quality = 0.88) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxWidth || h > maxHeight) {
        const ratio = Math.min(maxWidth / w, maxHeight / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('មិនអាចអានទិន្នន័យរូបភាពបានទេ'));
    if (typeof source === 'string') {
      img.src = source;
    } else if (source instanceof Blob || source instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(source);
    } else {
      resolve('');
    }
  });
}

// Upload photo to Hostinger server storage
async function uploadPhotoToServer(compressedDataUrl) {
  showPhotoUploading(true);
  try {
    const endpoint = window.location.hostname.includes('ktpttc.net') ? 'https://ktpttc.net/api/upload/image' : '/api/upload/image';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: compressedDataUrl,
        filename: `${currentRegistrationRole === 'teacher' ? 'trn' : 'stu'}_${Date.now()}.jpg`
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.url) {
        const fullUrl = data.url.startsWith('http') ? data.url : `https://ktpttc.net${data.url}`;
        currentPhotoData = fullUrl;
        setPhotoPreview(fullUrl);
        showPhotoUploading(false);
        showToast('បានផ្ទុកឡើងរូបថតចូល Server ជោគជ័យ!', 'success');
        return fullUrl;
      }
    }
  } catch (err) {
    console.warn('Server photo upload fallback to local storage:', err);
  }
  // Fallback to local compressed data URL
  currentPhotoData = compressedDataUrl;
  setPhotoPreview(compressedDataUrl);
  showPhotoUploading(false);
  showToast('បានជ្រើសរូបថតរួចរាល់!', 'success');
  return compressedDataUrl;
}

async function handlePhotoUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  try {
    showPhotoUploading(true);
    const compressed = await compressImage(file);
    setPhotoPreview(compressed);
    await uploadPhotoToServer(compressed);
  } catch (err) {
    console.error(err);
    showPhotoUploading(false);
    showToast('កំហុសក្នុងការផ្ទុកឡើងរូបថត៖ ' + err.message, 'error');
  }
  input.value = '';
}
window.handlePhotoUpload = handlePhotoUpload;

function promptPhotoUrl() {
  const url = prompt('សូមបញ្ចូលតំណភ្ជាប់រូបថត (Image URL)៖');
  if (url && url.trim().startsWith('http')) {
    setPhotoPreview(url.trim());
    currentPhotoData = url.trim();
    showToast('បានភ្ជាប់រូបថតរួចរាល់', 'success');
  }
}
window.promptPhotoUrl = promptPhotoUrl;

function setPhotoPreview(src) {
  currentPhotoData = src;
  const img = document.getElementById('photoPreviewImg');
  const placeholder = document.getElementById('photoPlaceholder');
  if (img && placeholder) {
    img.src = src;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  }
}

// --------------------------------------------------------------------------
// CAMBODIA ADMINISTRATIVE DIVISIONS (CASCADING GEO SELECTOR)
// --------------------------------------------------------------------------
function initCambodiaGeo() {
  const geo = window.CAMBODIA_GEO_DATA;
  if (!geo) {
    console.warn('CAMBODIA_GEO_DATA not loaded');
    return;
  }

  const provList = Object.keys(geo);

  // Setup Province Datalists
  setupDatalist('pobProvinceList', provList);
  setupDatalist('curProvinceList', provList);

  // Attach change/input listeners for Birthplace
  attachGeoListeners('pobProvince', 'pobDistrict', 'pobCommune', 'pobVillage',
                     'pobDistrictList', 'pobCommuneList', 'pobVillageList');

  // Attach change/input listeners for Current Address
  attachGeoListeners('curProvince', 'curDistrict', 'curCommune', 'curVillage',
                     'curDistrictList', 'curCommuneList', 'curVillageList');
}

function setupDatalist(listId, items) {
  const el = document.getElementById(listId);
  if (!el) return;
  el.innerHTML = (items || []).map(item => `<option value="${item}">${item}</option>`).join('');
}

function normalizeGeoName(str) {
  return (str || '').trim().replace(/^(ខេត្ត|រាជធានី|ស្រុក|ក្រុង|ខណ្ឌ|ឃុំ|សង្កាត់|ភូមិ)\s*/, '');
}

function findMatchingProvince(inputVal) {
  const geo = window.CAMBODIA_GEO_DATA;
  if (!geo || !inputVal) return null;
  const raw = inputVal.trim();
  const clean = normalizeGeoName(raw);
  for (const p in geo) {
    if (p === raw || normalizeGeoName(p) === clean || p.includes(clean)) {
      return { name: p, districts: geo[p] };
    }
  }
  return null;
}

function findMatchingDistrict(districtsObj, inputVal) {
  if (!districtsObj || !inputVal) return null;
  const raw = inputVal.trim();
  const clean = normalizeGeoName(raw);
  for (const d in districtsObj) {
    if (d === raw || normalizeGeoName(d) === clean || d.includes(clean)) {
      return { name: d, communes: districtsObj[d] };
    }
  }
  return null;
}

function findMatchingCommune(communesObj, inputVal) {
  if (!communesObj || !inputVal) return null;
  const raw = inputVal.trim();
  const clean = normalizeGeoName(raw);
  for (const c in communesObj) {
    if (c === raw || normalizeGeoName(c) === clean || c.includes(clean)) {
      return { name: c, villages: communesObj[c] };
    }
  }
  return null;
}

function attachGeoListeners(provId, distId, commId, villId, distListId, commListId, villListId) {
  const provEl = document.getElementById(provId);
  const distEl = document.getElementById(distId);
  const commEl = document.getElementById(commId);
  const villEl = document.getElementById(villId);

  if (!provEl || !distEl || !commEl || !villEl) return;

  function onProvinceChange(force = false) {
    const provMatch = findMatchingProvince(provEl.value);
    if (provMatch) {
      const districts = Object.keys(provMatch.districts);
      setupDatalist(distListId, districts);
      distEl.placeholder = 'វាយបញ្ចូល ឬជ្រើសរើស...';
      
      if (!districts.includes(distEl.value) && !force) {
        distEl.value = '';
        commEl.value = '';
        villEl.value = '';
        setupDatalist(commListId, []);
        setupDatalist(villListId, []);
        commEl.placeholder = 'ជ្រើសរើសស្រុកជាមុន...';
        villEl.placeholder = 'ជ្រើសរើសឃុំជាមុន...';
      } else if (distEl.value) {
        onDistrictChange(force);
      }
    } else {
      setupDatalist(distListId, []);
      setupDatalist(commListId, []);
      setupDatalist(villListId, []);
      distEl.placeholder = 'ជ្រើសរើសខេត្តជាមុន...';
      commEl.placeholder = 'ជ្រើសរើសស្រុកជាមុន...';
      villEl.placeholder = 'ជ្រើសរើសឃុំជាមុន...';
    }
  }

  function onDistrictChange(force = false) {
    const provMatch = findMatchingProvince(provEl.value);
    if (!provMatch) return;
    const distMatch = findMatchingDistrict(provMatch.districts, distEl.value);
    if (distMatch) {
      const communes = Object.keys(distMatch.communes);
      setupDatalist(commListId, communes);
      commEl.placeholder = 'វាយបញ្ចូល ឬជ្រើសរើស...';

      if (!communes.includes(commEl.value) && !force) {
        commEl.value = '';
        villEl.value = '';
        setupDatalist(villListId, []);
        villEl.placeholder = 'ជ្រើសរើសឃុំជាមុន...';
      } else if (commEl.value) {
        onCommuneChange();
      }
    } else {
      setupDatalist(commListId, []);
      setupDatalist(villListId, []);
      commEl.placeholder = 'ជ្រើសរើសស្រុកជាមុន...';
      villEl.placeholder = 'ជ្រើសរើសឃុំជាមុន...';
    }
  }

  function onCommuneChange() {
    const provMatch = findMatchingProvince(provEl.value);
    if (!provMatch) return;
    const distMatch = findMatchingDistrict(provMatch.districts, distEl.value);
    if (!distMatch) return;
    const commMatch = findMatchingCommune(distMatch.communes, commEl.value);
    if (commMatch) {
      const villages = commMatch.villages;
      setupDatalist(villListId, villages);
      villEl.placeholder = 'វាយបញ្ចូល ឬជ្រើសរើស...';
    } else {
      setupDatalist(villListId, []);
      villEl.placeholder = 'ជ្រើសរើសឃុំជាមុន...';
    }
  }

  provEl.addEventListener('input', () => onProvinceChange(false));
  provEl.addEventListener('change', () => onProvinceChange(false));
  distEl.addEventListener('input', () => onDistrictChange(false));
  distEl.addEventListener('change', () => onDistrictChange(false));
  commEl.addEventListener('input', onCommuneChange);
  commEl.addEventListener('change', onCommuneChange);

  provEl._syncGeo = (force) => onProvinceChange(force);
}

function syncAllGeoFields() {
  document.getElementById('pobProvince')?._syncGeo?.(true);
  document.getElementById('curProvince')?._syncGeo?.(true);
}

// Copy Birthplace fields to Current Address
function copyBirthplaceToAddress() {
  document.getElementById('curProvince').value = document.getElementById('pobProvince').value;
  document.getElementById('curDistrict').value = document.getElementById('pobDistrict').value;
  document.getElementById('curCommune').value = document.getElementById('pobCommune').value;
  document.getElementById('curVillage').value = document.getElementById('pobVillage').value;
  syncAllGeoFields();
  showToast('បានចម្លងទីកន្លែងកំណើតទៅអាសយដ្ឋានបច្ចុប្បន្ន', 'info');
}
window.copyBirthplaceToAddress = copyBirthplaceToAddress;

// --------------------------------------------------------------------------
// UNIFIED SAVE CONTROLLER
// --------------------------------------------------------------------------

function handleUnifiedSave() {
  console.log('[UnifiedSave] Initiated for role:', currentRegistrationRole);
  try {
    if (currentRegistrationRole === 'teacher') {
      handleSaveTeacher();
    } else {
      handleSaveStudent();
    }
  } catch (err) {
    console.error('[UnifiedSave] Execution error:', err);
    showToast('មានបញ្ហាក្នុងការរក្សាទុក៖ ' + (err.message || err), 'error');
  }
}
window.handleUnifiedSave = handleUnifiedSave;

// 1. SAVE STUDENT
function handleSaveStudent() {
  const id = document.getElementById('regStuId')?.value?.trim();
  const classGrade = document.getElementById('regClass')?.value || '១២+២';
  const group = document.getElementById('regGroup')?.value || 'ក្រុម ក';
  const className = `${classGrade} ${group}`.trim();
  const nameKh = document.getElementById('regNameKh')?.value?.trim();
  const nameEn = document.getElementById('regNameEn')?.value?.trim() || '';
  const gender = document.getElementById('regGender')?.value || 'ប្រុស';
  const dob = document.getElementById('regDob')?.value || '';
  const age = document.getElementById('regAge')?.value || '';
  const parentPhone = document.getElementById('regParentPhone')?.value?.trim() || '';
  const username = (document.getElementById('regUsername')?.value || id).trim().toLowerCase();
  const password = (document.getElementById('regPassword')?.value || 'ktpttc123').trim();

  if (!id || !nameKh) {
    showToast('សូមបំពេញអត្តលេខ និងឈ្មោះសិស្ស (ខ្មែរ) ឱ្យបានគ្រប់ជ្រុងជ្រោយ!', 'error');
    return;
  }

  const students = getSavedStudents();
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('id') || '';
  const isEditMode = !!editId;

  const existingIdx = students.findIndex(s => 
    (s.id && s.id.toLowerCase() === id.toLowerCase()) || 
    (editId && s.id && s.id.toLowerCase() === editId.toLowerCase())
  );
  if (existingIdx !== -1 && !isEditMode) {
    if (!confirm(`អត្តលេខ ${id} មានក្នុងប្រព័ន្ធរួចហើយ។ តើលោកគ្រូ-អ្នកគ្រូចង់ធ្វើបច្ចុប្បន្នភាព (Update) សិស្សនេះមែនទេ?`)) {
      return;
    }
  }

  const studentRecord = {
    id,
    roll: students.length + 1,
    classGrade,
    group,
    className,
    nameKh,
    nameEn,
    gender,
    dob,
    age,
    parentPhone,
    username,
    password,
    photo: currentPhotoData || '',
    avatar: gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓',
    behaviorScore: 100,
    scores: { KH: 0, MATH: 0, PHY: 0, CHEM: 0, BIO: 0, HIST: 0, GEO: 0, ENG: 0, MOR: 0 },
    absentYearCount: 0,
    attendance: 'present',

    birthplace: {
      province: document.getElementById('pobProvince')?.value?.trim() || '',
      district: document.getElementById('pobDistrict')?.value?.trim() || '',
      commune: document.getElementById('pobCommune')?.value?.trim() || '',
      village: document.getElementById('pobVillage')?.value?.trim() || ''
    },

    address: {
      province: document.getElementById('curProvince')?.value?.trim() || '',
      district: document.getElementById('curDistrict')?.value?.trim() || '',
      commune: document.getElementById('curCommune')?.value?.trim() || '',
      village: document.getElementById('curVillage')?.value?.trim() || ''
    },

    status: {
      isNew: document.getElementById('statusNew')?.value || 'បាទ/ចាស',
      isRepeater: document.getElementById('statusRepeater')?.value || 'ទេ',
      familyStatus: document.getElementById('statusFamily')?.value || 'ទេ',
      disability: document.getElementById('statusDisability')?.value || 'ទេ',
      poorCard: document.getElementById('statusPoorCard')?.value || 'គ្មាន',
      ethnic: document.getElementById('statusEthnic')?.value || 'ទេ',
      scholarship: document.getElementById('statusScholarship')?.value || 'ទេ'
    },

    parents: {
      fatherName: document.getElementById('fatherName')?.value?.trim() || '',
      fatherJob: document.getElementById('fatherJob')?.value?.trim() || '',
      motherName: document.getElementById('motherName')?.value?.trim() || '',
      motherJob: document.getElementById('motherJob')?.value?.trim() || '',
      guardianName: document.getElementById('guardianName')?.value?.trim() || '',
      guardianJob: document.getElementById('guardianJob')?.value?.trim() || ''
    },

    additional: {
      ethnicGroup: document.getElementById('ethnicGroup')?.value?.trim() || '',
      specialNotes: document.getElementById('specialNotes')?.value?.trim() || '',
      serviceNotes: document.getElementById('serviceNotes')?.value?.trim() || ''
    },

    createdAt: new Date().toISOString()
  };

  if (existingIdx !== -1) {
    students[existingIdx] = studentRecord;
  } else {
    students.push(studentRecord);
  }

  saveStudentsToStorage(students);

  // Sync with KTPTTC STMS Trainee Database (v2)
  try {
    let rawStms = localStorage.getItem('ktpttc_stms_data_v2');
    let stmsObj = rawStms ? JSON.parse(rawStms) : (window.KTPTTC_INITIAL_DATA || {});
    if (!Array.isArray(stmsObj.trainees)) stmsObj.trainees = [];
    if (!Array.isArray(stmsObj.users)) stmsObj.users = [];

    const existingTraineeIdx = stmsObj.trainees.findIndex(t => 
      (t.id && t.id.toLowerCase() === id.toLowerCase()) || 
      (editId && t.id && t.id.toLowerCase() === editId.toLowerCase())
    );
    const traineeRecord = {
      id,
      roll: stmsObj.trainees.length + 1,
      nameKh,
      nameEn,
      gender,
      dob,
      phone: parentPhone,
      parentPhone,
      username,
      password,
      classGrade,
      group,
      className,
      cohort: (() => {
        try {
          const raw = localStorage.getItem('ktpttc_stms_data_v2');
          if (raw) {
            const data = JSON.parse(raw);
            const foundCohort = (data.cohorts || []).find(c => (c.classes || []).includes(className) || c.nameKh.includes(className));
            if (foundCohort) return foundCohort.nameKh;
          }
        } catch (e) {}
        return className;
      })(),
      trainingType: className.includes('១២+៤') ? "12+4" : className.includes('បរិញ្ញា') ? "បរិញ្ញាបត្រ+១" : "12+2 (បឋមសិក្សា)",
      status: "កំពុងសិក្សា",
      avatar: gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓',
      photo: currentPhotoData || '',
      pob: `${document.getElementById('pobVillage')?.value || ''} ${document.getElementById('pobCommune')?.value || ''} ${document.getElementById('pobDistrict')?.value || ''} ${document.getElementById('pobProvince')?.value || ''}`.trim(),
      address: `${document.getElementById('curVillage')?.value || ''} ${document.getElementById('curCommune')?.value || ''} ${document.getElementById('curDistrict')?.value || ''} ${document.getElementById('curProvince')?.value || ''}`.trim(),
      birthplace: studentRecord.birthplace,
      currentAddress: studentRecord.address,
      situation: studentRecord.status,
      parents: studentRecord.parents,
      additional: studentRecord.additional,
      attendanceSummary: { present: 0, permission: 0, late: 0, absent: 0, rate: 100.0 },
      scores: {}
    };

    if (existingTraineeIdx !== -1) {
      stmsObj.trainees[existingTraineeIdx] = traineeRecord;
    } else {
      stmsObj.trainees.push(traineeRecord);
    }

    // Provision / Update Login User
    const existingUserIdx = stmsObj.users.findIndex(u => 
      (u.studentId && u.studentId.toLowerCase() === id.toLowerCase()) || 
      (editId && u.studentId && u.studentId.toLowerCase() === editId.toLowerCase()) || 
      (u.username && u.username.toLowerCase() === username.toLowerCase())
    );

    const userPayload = {
      id: existingUserIdx !== -1 ? stmsObj.users[existingUserIdx].id : `USR-STU-${String(stmsObj.users.length + 1).padStart(3, '0')}`,
      nameKh,
      nameEn,
      studentId: id,
      username: username,
      password: password,
      role: "trainee",
      roleLabel: "គរុសនិស្សិត",
      email: parentPhone ? `${username}@student.ktpttc.edu.kh` : "portal@student.ktpttc.edu.kh",
      phone: parentPhone,
      className,
      cohort: traineeRecord.cohort,
      status: "active",
      avatar: gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓'
    };

    if (existingUserIdx !== -1) {
      stmsObj.users[existingUserIdx] = { ...stmsObj.users[existingUserIdx], ...userPayload };
    } else {
      stmsObj.users.push(userPayload);
    }

    localStorage.setItem('ktpttc_stms_data_v2', JSON.stringify(stmsObj));

    // Sync active session if this student is currently logged in
    try {
      const rawCur = sessionStorage.getItem('ktpttc_current_user') || localStorage.getItem('ktpttc_current_user');
      if (rawCur) {
        const curUser = JSON.parse(rawCur);
        if (curUser && (
          (curUser.studentId && curUser.studentId.toLowerCase() === id.toLowerCase()) ||
          (editId && curUser.studentId && curUser.studentId.toLowerCase() === editId.toLowerCase()) ||
          (curUser.username && curUser.username.toLowerCase() === username.toLowerCase())
        )) {
          const updatedCur = { ...curUser, ...userPayload };
          localStorage.setItem('ktpttc_current_user', JSON.stringify(updatedCur));
          sessionStorage.setItem('ktpttc_current_user', JSON.stringify(updatedCur));
        }
      }
    } catch (e) {}
  } catch (e) {
    console.error('Sync to STMS storage error:', e);
  }

  if (isEditMode) {
    showToast(`បានកែប្រែព័ត៌មានគរុសនិស្សិត «${nameKh}» ដោយជោគជ័យ!`, 'success');
    sessionStorage.setItem('stms_target_view', 'trainees');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1200);
  } else {
    showToast(`🎉 បានចុះឈ្មោះគរុសនិស្សិត «${nameKh}» ដោយជោគជ័យ!`, 'success');
    resetFormForNextStudent(students.length + 1);
  }
}
window.handleSaveStudent = handleSaveStudent;

// 2. SAVE TEACHER
function handleSaveTeacher() {
  const id = document.getElementById('regTeacherId')?.value?.trim();
  const subject = document.getElementById('regTeacherSubject')?.value || 'PED-101';
  const qualification = document.getElementById('regTeacherQual')?.value?.trim() || 'អនុបណ្ឌិតគរុកោសល្យ';
  const nameKh = document.getElementById('regTeacherNameKh')?.value?.trim();
  const nameEn = document.getElementById('regTeacherNameEn')?.value?.trim() || '';
  const gender = document.getElementById('regTeacherGender')?.value || 'ប្រុស';
  const dob = document.getElementById('regTeacherDob')?.value || '1985-05-15';
  const age = document.getElementById('regTeacherAge')?.value || '';
  const phone = document.getElementById('regTeacherPhone')?.value?.trim() || '';
  const email = document.getElementById('regTeacherEmail')?.value?.trim() || `${id.toLowerCase()}@ktpttc.edu.kh`;
  const username = (document.getElementById('regTeacherUsername')?.value || id).trim().toLowerCase();
  const password = (document.getElementById('regTeacherPassword')?.value || 'ktpttc123').trim();
  const roleTitle = document.getElementById('regTeacherRoleTitle')?.value?.trim() || 'គ្រូឧទ្ទេសពេញម៉ោង';
  const experience = document.getElementById('regTeacherExperience')?.value?.trim() || '';

  if (!id || !nameKh) {
    showToast('សូមបំពេញអត្តលេខ និងឈ្មោះគ្រូឧទ្ទេស (ខ្មែរ) ឱ្យបានគ្រប់ជ្រុងជ្រោយ!', 'error');
    return;
  }

  let rawStms = localStorage.getItem('ktpttc_stms_data_v2');
  let stmsObj = rawStms ? JSON.parse(rawStms) : (window.KTPTTC_INITIAL_DATA || {});
  if (!Array.isArray(stmsObj.users)) stmsObj.users = [];

  const subj = (window.KTPTTC_ALL_SUBJECTS || []).find(s => s.code === subject);

  const teacherRecord = {
    id,
    nameKh,
    nameEn,
    gender,
    dob,
    age: age.replace(' ឆ្នាំ', '').trim() || '35',
    qualification,
    phone,
    email,
    username,
    password,
    role: "trainer",
    roleLabel: "គ្រូឧទ្ទេស / មន្ត្រីបង្រៀន",
    subject,
    subjectName: subj ? subj.nameKh : '',
    position: roleTitle,
    experience,
    photo: currentPhotoData || '',
    avatar: gender === 'ស្រី' ? '👩‍🏫' : '👨‍🏫',
    status: "active",
    pob: `${document.getElementById('pobVillage')?.value || ''} ${document.getElementById('pobCommune')?.value || ''} ${document.getElementById('pobDistrict')?.value || ''} ${document.getElementById('pobProvince')?.value || ''}`.trim(),
    address: `${document.getElementById('curVillage')?.value || ''} ${document.getElementById('curCommune')?.value || ''} ${document.getElementById('curDistrict')?.value || ''} ${document.getElementById('curProvince')?.value || ''}`.trim(),
    birthplace: {
      province: document.getElementById('pobProvince')?.value?.trim() || '',
      district: document.getElementById('pobDistrict')?.value?.trim() || '',
      commune: document.getElementById('pobCommune')?.value?.trim() || '',
      village: document.getElementById('pobVillage')?.value?.trim() || ''
    },
    currentAddress: {
      province: document.getElementById('curProvince')?.value?.trim() || '',
      district: document.getElementById('curDistrict')?.value?.trim() || '',
      commune: document.getElementById('curCommune')?.value?.trim() || '',
      village: document.getElementById('curVillage')?.value?.trim() || ''
    },
    employment: {
      status: document.getElementById('teacherStatusWork')?.value || 'កំពុងបង្រៀន',
      type: document.getElementById('teacherContractType')?.value || 'ក្របខណ្ឌរដ្ឋ',
      startDate: document.getElementById('teacherStartDate')?.value || '',
      department: document.getElementById('teacherDept')?.value || 'ដេប៉ាតឺម៉ង់គរុកោសល្យទូទៅ'
    },
    emergencyContact: {
      name: document.getElementById('teacherEmergName')?.value?.trim() || '',
      relation: document.getElementById('teacherEmergRel')?.value?.trim() || '',
      phone: document.getElementById('teacherEmergPhone')?.value?.trim() || ''
    },
    additional: {
      specialSkills: document.getElementById('ethnicGroup')?.value?.trim() || '',
      specialNotes: document.getElementById('specialNotes')?.value?.trim() || '',
      serviceNotes: document.getElementById('serviceNotes')?.value?.trim() || ''
    },
    createdAt: new Date().toISOString()
  };

  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('id') || '';
  const isEdit = !!editId;

  const existingIdx = stmsObj.users.findIndex(u => 
    (u.id && u.id.toLowerCase() === id.toLowerCase()) || 
    (editId && u.id && u.id.toLowerCase() === editId.toLowerCase()) || 
    (editId && u.username && u.username.toLowerCase() === editId.toLowerCase()) || 
    (u.username && u.username.toLowerCase() === username.toLowerCase() && u.role === 'trainer')
  );

  if (existingIdx !== -1) {
    stmsObj.users[existingIdx] = { ...stmsObj.users[existingIdx], ...teacherRecord };
  } else {
    stmsObj.users.push(teacherRecord);
  }

  localStorage.setItem('ktpttc_stms_data_v2', JSON.stringify(stmsObj));

  // Sync active session if this teacher is currently logged in
  try {
    const rawCur = sessionStorage.getItem('ktpttc_current_user') || localStorage.getItem('ktpttc_current_user');
    if (rawCur) {
      const curUser = JSON.parse(rawCur);
      if (curUser && (
        (curUser.id && curUser.id.toLowerCase() === id.toLowerCase()) ||
        (editId && curUser.id && curUser.id.toLowerCase() === editId.toLowerCase()) ||
        (curUser.username && curUser.username.toLowerCase() === username.toLowerCase())
      )) {
        const updatedCur = { ...curUser, ...teacherRecord };
        localStorage.setItem('ktpttc_current_user', JSON.stringify(updatedCur));
        sessionStorage.setItem('ktpttc_current_user', JSON.stringify(updatedCur));
      }
    }
  } catch (e) {}

  if (isEdit) {
    showToast(`🎉 បានកែប្រែព័ត៌មានគ្រូឧទ្ទេស «${nameKh}» ដោយជោគជ័យ!`, 'success');
    sessionStorage.setItem('stms_target_view', 'trainers');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1200);
  } else {
    showToast(`🎉 បានចុះឈ្មោះគ្រូឧទ្ទេស «${nameKh}» (${id}) ដោយជោគជ័យ!`, 'success');
    resetFormForNextTeacher();
  }
}
window.handleSaveTeacher = handleSaveTeacher;

// --------------------------------------------------------------------------
// RESET FORMS
// --------------------------------------------------------------------------

function resetFormForNextStudent(nextRoll) {
  document.getElementById('studentRegistrationForm').reset();
  
  const idInput = document.getElementById('regStuId');
  const nextId = `KTPTTC-2026-12P2-${String(nextRoll).padStart(3, '0')}`;
  if (idInput) idInput.value = nextId;

  const uInput = document.getElementById('regUsername');
  if (uInput) {
    uInput.value = nextId.toLowerCase();
    uInput.dataset.manual = 'false';
  }

  const pInput = document.getElementById('regPassword');
  if (pInput) {
    pInput.value = 'ktpttc123';
    pInput.type = 'password';
    const eyeIcon = document.getElementById('regEyeIcon');
    if (eyeIcon) eyeIcon.className = 'fas fa-eye';
  }
  
  const classInput = document.getElementById('regClass');
  if (classInput) classInput.value = '១២+២';
  const groupInput = document.getElementById('regGroup');
  if (groupInput) groupInput.value = 'ក្រុម ក';
  const sel = document.getElementById('classSelector');
  if (sel) sel.value = '១២+២ ក្រុម ក';

  currentPhotoData = '';
  const img = document.getElementById('photoPreviewImg');
  const placeholder = document.getElementById('photoPlaceholder');
  if (img) img.style.display = 'none';
  if (placeholder) placeholder.style.display = 'block';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetFormForNextTeacher() {
  document.getElementById('studentRegistrationForm').reset();
  
  const teachers = getSavedTeachers();
  const nextNum = teachers.length + 1;
  const nextId = `USR-TRN-${String(nextNum).padStart(3, '0')}`;

  const idInput = document.getElementById('regTeacherId');
  if (idInput) idInput.value = nextId;

  const uInput = document.getElementById('regTeacherUsername');
  if (uInput) {
    uInput.value = nextId.toLowerCase();
    uInput.dataset.manual = 'false';
  }

  const emailInput = document.getElementById('regTeacherEmail');
  if (emailInput) {
    emailInput.value = `${nextId.toLowerCase()}@ktpttc.edu.kh`;
    emailInput.dataset.manual = 'false';
  }

  const pInput = document.getElementById('regTeacherPassword');
  if (pInput) {
    pInput.value = 'ktpttc123';
    pInput.type = 'password';
    const eyeIcon = document.getElementById('regTeacherEyeIcon');
    if (eyeIcon) eyeIcon.className = 'fas fa-eye';
  }

  currentPhotoData = '';
  const img = document.getElementById('photoPreviewImg');
  const placeholder = document.getElementById('photoPlaceholder');
  if (img) img.style.display = 'none';
  if (placeholder) placeholder.style.display = 'block';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --------------------------------------------------------------------------
// EXCEL / CSV TEMPLATE & IMPORT UTILITIES
// --------------------------------------------------------------------------

// Format Excel Date (Supports Date objects, serial numbers, strings, and Khmer digits)
function parseExcelDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'number') {
    // Excel serial number conversion
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  let str = String(val).trim();
  const khmerDigits = ['០','១','២','៣','៤','៥','៦','៧','៨','៩'];
  khmerDigits.forEach((kd, idx) => {
    str = str.split(kd).join(String(idx));
  });
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split(/[/\-.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return str;
}

// Download Excel (.xlsx) or CSV Template
function downloadExcelTemplate() {
  const isTeacher = currentRegistrationRole === 'teacher';

  if (isTeacher) {
    const headers = [
      'អត្តលេខគ្រូ',
      'មុខវិជ្ជា_កូដ',
      'កម្រិតវប្បធម៌',
      'ឈ្មោះគ្រូ_ខ្មែរ',
      'ឈ្មោះជាឡាតាំង',
      'ភេទ',
      'ថ្ងៃខែឆ្នាំកំណើត',
      'លេខទូរស័ព្ទ',
      'អ៊ីមែល',
      'ខេត្តកំណើត',
      'ស្រុកកំណើត',
      'ឃុំកំណើត',
      'ភូមិកំណើត',
      'អាសយដ្ឋានបច្ចុប្បន្ន'
    ];

    const sampleRow1 = [
      'USR-TRN-001',
      'PED-101',
      'អនុបណ្ឌិតគរុកោសល្យ',
      'ហេង សំណាង',
      'Heng Samnang',
      'ប្រុស',
      '1983-05-12',
      '016777888',
      'samnang.heng@ktpttc.edu.kh',
      'ខេត្តក្រចេះ',
      'ក្រុងក្រចេះ',
      'សង្កាត់ក្រចេះ',
      'ភូមិ១',
      'ខេត្តក្រចេះ'
    ];

    const sampleRow2 = [
      'USR-TRN-002',
      'MATH-101',
      'បរិញ្ញាបត្រគរុកោសល្យ',
      'សុខ សោភា',
      'Sok Sophea',
      'ស្រី',
      '1987-11-20',
      '092333444',
      'sophea.sok@ktpttc.edu.kh',
      'ខេត្តក្រចេះ',
      'ស្រុកស្នួល',
      'ឃុំស្នួល',
      'ភូមិស្នួល',
      'ខេត្តក្រចេះ'
    ];

    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow1, sampleRow2]);
      ws['!cols'] = [
        { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 20 },
        { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 16 },
        { wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
        { wch: 16 }, { wch: 20 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'គំរូនាំចូល_គ្រូឧទ្ទេស');
      XLSX.writeFile(wb, 'គំរូនាំចូល_បញ្ជីគ្រូឧទ្ទេស_KTPTTC.xlsx');
      showToast('🎉 បានទាញយកឯកសារគំរូគ្រូឧទ្ទេស Excel (.xlsx) ដោយជោគជ័យ!', 'success');
      return;
    }

    // Fallback to UTF-8 CSV with BOM
    const csvContent = '\uFEFF' + [headers.join(','), sampleRow1.join(','), sampleRow2.join(',')].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'គំរូនាំចូល_បញ្ជីគ្រូឧទ្ទេស_KTPTTC.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('បានទាញយកឯកសារគំរូគ្រូឧទ្ទេស CSV ដោយជោគជ័យ!', 'success');

  } else {
    // Student Template
    const headers = [
      'អត្តលេខ',
      'ថ្នាក់ទី',
      'ក្រុម',
      'ឈ្មោះសិស្ស_ខ្មែរ',
      'ឈ្មោះជាឡាតាំង',
      'ភេទ',
      'ថ្ងៃខែឆ្នាំកំណើត',
      'លេខទូរស័ព្ទអាណាព្យាបាល',
      'ខេត្តកំណើត',
      'ស្រុកកំណើត',
      'ឃុំកំណើត',
      'ភូមិកំណើត',
      'អាសយដ្ឋានបច្ចុប្បន្ន',
      'ឈ្មោះឪពុក',
      'មុខរបរឪពុក',
      'ឈ្មោះម្តាយ',
      'មុខរបរម្តាយ'
    ];

    const sampleRow1 = [
      'KTPTTC-2026-12P2-001',
      '១២+២',
      'ក្រុម ក',
      'កែវ វិសាល',
      'Keo Visal',
      'ប្រុស',
      '2005-05-12',
      '012345678',
      'ខេត្តក្រចេះ',
      'ក្រុងក្រចេះ',
      'សង្កាត់ក្រចេះ',
      'ភូមិ១',
      'ខេត្តក្រចេះ',
      'កែវ សុខា',
      'កសិករ',
      'ម៉ៅ ស្រី',
      'មេផ្ទះ'
    ];

    const sampleRow2 = [
      'KTPTTC-2026-12P2-002',
      '១២+២',
      'ក្រុម ក',
      'ចាន់ ធីតា',
      'Chan Thida',
      'ស្រី',
      '2005-08-25',
      '098765432',
      'ខេត្តក្រចេះ',
      'ស្រុកឆ្លូង',
      'ឃុំឆ្លូង',
      'ភូមិឆ្លូង',
      'ខេត្តក្រចេះ',
      'ចាន់ រិទ្ធី',
      'គ្រូបង្រៀន',
      'សួន ផល្លា',
      'អាជីវករ'
    ];

    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow1, sampleRow2]);
      ws['!cols'] = [
        { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 20 },
        { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 20 },
        { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
        { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 18 },
        { wch: 14 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'គំរូនាំចូល_សិស្ស');
      XLSX.writeFile(wb, 'គំរូនាំចូល_បញ្ជីចុះឈ្មោះសិស្ស_MoEYS.xlsx');
      showToast('🎉 បានទាញយកឯកសារគំរូសិស្ស Excel (.xlsx) ដោយជោគជ័យ!', 'success');
      return;
    }

    // Fallback to UTF-8 CSV with BOM
    const csvContent = '\uFEFF' + [headers.join(','), sampleRow1.join(','), sampleRow2.join(',')].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'គំរូនាំចូល_បញ្ជីចុះឈ្មោះសិស្ស_MoEYS.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('បានទាញយកឯកសារគំរូសិស្ស CSV ដោយជោគជ័យ!', 'success');
  }
}
window.downloadExcelTemplate = downloadExcelTemplate;

// Handle Excel (.xlsx, .xls) & CSV File Import
function handleExcelImport(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const isTeacher = currentRegistrationRole === 'teacher';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      let rows = [];

      // 1. Try parsing with SheetJS (supports .xlsx, .xls, and .csv)
      if (typeof XLSX !== 'undefined') {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          showToast('ឯកសារគ្មានសន្លឹកកិច្ចការ (Sheet) ណាមួយឡើយ!', 'error');
          return;
        }
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
      } else {
        // Fallback for CSV when XLSX is not loaded
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(e.target.result);
        if (text.startsWith('PK') || /[\x00-\x08\x0E-\x1F\x7F]/.test(text.substring(0, 50))) {
          showToast('ឯកសារ Excel Binary នេះត្រូវការបណ្ណាល័យ SheetJS ដើម្បីអាន។ សូមផ្ទុកទំព័រឡើងវិញ!', 'error');
          return;
        }
        rows = text.split(/\r?\n/)
          .filter(line => line.trim().length > 0)
          .map(line => line.split(',').map(c => c.trim().replace(/^["']|["']$/g, '')));
      }

      // Filter out completely blank rows
      rows = rows.filter(r => Array.isArray(r) && r.some(c => c !== null && c !== undefined && String(c).trim() !== ''));

      if (rows.length === 0) {
        showToast('ឯកសារពុំមានទិន្នន័យឡើយ!', 'error');
        return;
      }

      // Detect if row 0 is Header
      const headerRow = rows[0].map(c => String(c).trim().toLowerCase());
      const hasHeader = headerRow.some(h => 
        h.includes('អត្តលេខ') || h.includes('ឈ្មោះ') || h.includes('ភេទ') || 
        h.includes('ថ្នាក់') || h.includes('មុខវិជ្ជា') || h.includes('name') || 
        h.includes('id') || h.includes('gender')
      );

      const dataRows = hasHeader ? rows.slice(1) : rows;
      if (dataRows.length === 0) {
        showToast('ឯកសារពុំមានជួរទិន្នន័យសម្រាប់នាំចូលឡើយ!', 'warning');
        return;
      }

      let rawStms = localStorage.getItem('ktpttc_stms_data_v2');
      let stmsObj = rawStms ? JSON.parse(rawStms) : (window.KTPTTC_INITIAL_DATA || {});
      if (!Array.isArray(stmsObj.users)) stmsObj.users = [];
      if (!Array.isArray(stmsObj.trainees)) stmsObj.trainees = [];

      if (isTeacher) {
        // ================= IMPORT TEACHERS =================
        let imported = 0;
        let nextNum = stmsObj.users.filter(u => u.role === 'trainer').length + 1;

        dataRows.forEach((cols, idx) => {
          if (!cols || cols.length === 0) return;
          // Clean column values
          const cleanCols = cols.map(c => (c !== null && c !== undefined) ? String(c).trim() : '');
          
          let id = cleanCols[0] || `USR-TRN-${String(nextNum++).padStart(3, '0')}`;
          let subject = cleanCols[1] || 'PED-101';
          let qualification = cleanCols[2] || 'អនុបណ្ឌិតគរុកោសល្យ';
          let nameKh = cleanCols[3] || cleanCols[0];
          let nameEn = cleanCols[4] || '';
          let genderRaw = cleanCols[5] || '';
          let dobRaw = cols[6]; // might be Date object or number
          let phone = cleanCols[7] || '';
          let email = cleanCols[8] || `${id.toLowerCase()}@ktpttc.edu.kh`;
          let pobProvince = cleanCols[9] || 'ខេត្តក្រចេះ';
          let pobDistrict = cleanCols[10] || '';
          let pobCommune = cleanCols[11] || '';
          let pobVillage = cleanCols[12] || '';
          let curAddress = cleanCols[13] || pobProvince;

          // If col 0 looks like a name and not ID
          if (id && !id.toUpperCase().startsWith('USR') && !id.toUpperCase().startsWith('TRN') && !/\d/.test(id) && !cleanCols[3]) {
            nameKh = id;
            id = `USR-TRN-${String(nextNum++).padStart(3, '0')}`;
          }

          if (!nameKh || nameKh === id) return; // Skip invalid rows

          const gender = (genderRaw.includes('ស្រី') || genderRaw.toLowerCase().includes('female') || genderRaw.toLowerCase() === 'f') ? 'ស្រី' : 'ប្រុស';
          const dob = parseExcelDate(dobRaw) || '1985-05-15';

          const teacherRecord = {
            id,
            nameKh,
            nameEn,
            gender,
            dob,
            qualification,
            phone,
            email,
            username: id.toLowerCase(),
            password: 'ktpttc123',
            role: 'trainer',
            roleLabel: 'គ្រូឧទ្ទេស / មន្ត្រីបង្រៀន',
            subject,
            status: 'active',
            avatar: gender === 'ស្រី' ? '👩‍🏫' : '👨‍🏫',
            birthplace: { province: pobProvince, district: pobDistrict, commune: pobCommune, village: pobVillage },
            address: { province: curAddress, district: '', commune: '', village: '' }
          };

          const existingIdx = stmsObj.users.findIndex(u => (u.id && u.id.toLowerCase() === id.toLowerCase()) || (u.nameKh === nameKh && u.role === 'trainer'));
          if (existingIdx !== -1) {
            stmsObj.users[existingIdx] = { ...stmsObj.users[existingIdx], ...teacherRecord };
          } else {
            stmsObj.users.push(teacherRecord);
          }
          imported++;
        });

        localStorage.setItem('ktpttc_stms_data_v2', JSON.stringify(stmsObj));
        showToast(`🎉 បាននាំចូលទិន្នន័យគ្រូឧទ្ទេសចំនួន ${imported} នាក់ពី Excel/CSV ដោយជោគជ័យ!`, 'success');
        setTimeout(() => {
          sessionStorage.setItem('stms_target_view', 'trainers');
          window.location.href = 'index.html';
        }, 1200);

      } else {
        // ================= IMPORT STUDENTS =================
        let imported = 0;
        let nextRoll = stmsObj.trainees.length + 1;

        dataRows.forEach((cols, idx) => {
          if (!cols || cols.length === 0) return;
          const cleanCols = cols.map(c => (c !== null && c !== undefined) ? String(c).trim() : '');

          let id = cleanCols[0] || `KTPTTC-2026-12P2-${String(nextRoll).padStart(3, '0')}`;
          let classGrade = cleanCols[1] || '១២+២';
          let group = cleanCols[2] || 'ក្រុម ក';
          let nameKh = cleanCols[3];
          let nameEn = cleanCols[4] || '';
          let genderRaw = cleanCols[5] || '';
          let dobRaw = cols[6];
          let parentPhone = cleanCols[7] || '';
          let pobProvince = cleanCols[8] || 'ខេត្តក្រចេះ';
          let pobDistrict = cleanCols[9] || '';
          let pobCommune = cleanCols[10] || '';
          let pobVillage = cleanCols[11] || '';
          let curAddress = cleanCols[12] || pobProvince;
          let fatherName = cleanCols[13] || '';
          let fatherJob = cleanCols[14] || '';
          let motherName = cleanCols[15] || '';
          let motherJob = cleanCols[16] || '';

          // Support shifting if group col was omitted
          if (group && !group.includes('ក្រុម') && !nameKh) {
            nameKh = group;
            group = 'ក្រុម ក';
          }
          if (!nameKh && cleanCols[2]) {
            nameKh = cleanCols[2];
          }

          if (!nameKh) return; // Skip invalid row

          const gender = (genderRaw.includes('ស្រី') || genderRaw.toLowerCase().includes('female') || genderRaw.toLowerCase() === 'f') ? 'ស្រី' : 'ប្រុស';
          const dob = parseExcelDate(dobRaw) || '2005-01-01';
          const className = `${classGrade} ${group}`.trim();

          const studentRecord = {
            id,
            roll: nextRoll++,
            className,
            nameKh,
            nameEn,
            gender,
            dob,
            age: '',
            parentPhone,
            username: id.toLowerCase(),
            password: 'ktpttc123',
            avatar: gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓',
            behaviorScore: 100,
            scores: { KH: 0, MATH: 0, PHY: 0, CHEM: 0, BIO: 0, HIST: 0, GEO: 0, ENG: 0, MOR: 0 },
            absentYearCount: 0,
            attendance: 'present',
            birthplace: { province: pobProvince, district: pobDistrict, commune: pobCommune, village: pobVillage },
            address: { province: curAddress, district: '', commune: '', village: '' },
            parents: { fatherName, fatherJob, motherName, motherJob }
          };

          const existingIdx = stmsObj.trainees.findIndex(t => (t.id && t.id.toLowerCase() === id.toLowerCase()) || (t.nameKh === nameKh && t.className === className));
          if (existingIdx !== -1) {
            stmsObj.trainees[existingIdx] = { ...stmsObj.trainees[existingIdx], ...studentRecord };
          } else {
            stmsObj.trainees.push(studentRecord);
          }

          // Sync student login user
          const userIdx = stmsObj.users.findIndex(u => (u.studentId && u.studentId.toLowerCase() === id.toLowerCase()) || (u.username && u.username.toLowerCase() === id.toLowerCase()));
          const userRecord = {
            id: `USR-STU-${String(stmsObj.users.length + 1).padStart(3, '0')}`,
            nameKh,
            nameEn,
            studentId: id,
            username: id.toLowerCase(),
            password: 'ktpttc123',
            role: 'trainee',
            roleLabel: 'គរុសនិស្សិត',
            phone: parentPhone,
            className,
            status: 'active',
            avatar: gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓'
          };
          if (userIdx !== -1) {
            stmsObj.users[userIdx] = { ...stmsObj.users[userIdx], ...userRecord };
          } else {
            stmsObj.users.push(userRecord);
          }

          imported++;
        });

        localStorage.setItem('ktpttc_stms_data_v2', JSON.stringify(stmsObj));
        localStorage.setItem('krusmart_teacher_custom_students', JSON.stringify(stmsObj.trainees));
        showToast(`🎉 បាននាំចូលទិន្នន័យសិស្សចំនួន ${imported} នាក់ពី Excel/CSV ដោយជោគជ័យ!`, 'success');
        setTimeout(() => {
          sessionStorage.setItem('stms_target_view', 'trainees');
          window.location.href = 'index.html';
        }, 1200);
      }

    } catch (err) {
      console.error('Import error:', err);
      showToast('មានបញ្ហាក្នុងការអានឯកសារ Excel/CSV៖ ' + err.message, 'error');
    }
  };

  reader.readAsArrayBuffer(file);
  input.value = '';
}
window.handleExcelImport = handleExcelImport;
