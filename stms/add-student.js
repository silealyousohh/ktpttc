/**
 * KruSmart - Student Registration Form (ទម្រង់ចុះឈ្មោះសិស្ស)
 * Standard MoEYS Cambodia Registration Logic
 */

let currentPhotoData = '';

document.addEventListener('DOMContentLoaded', () => {
  initStudentIdSuggestion();
  setupClassSelector();
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

// Get saved students array from localStorage (KTPTTC STMS Database v2)
function getSavedStudents() {
  try {
    const rawStms = localStorage.getItem('ktpttc_stms_data_v2');
    if (rawStms) {
      const parsed = JSON.parse(rawStms);
      if (parsed && Array.isArray(parsed.trainees)) return parsed.trainees;
    }
    const legacy = localStorage.getItem('krusmart_teacher_custom_students');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.students)) return parsed.students;
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

// Auto-suggest next Student ID
function initStudentIdSuggestion() {
  const students = getSavedStudents();
  const nextNumber = students.length + 1;
  const idInput = document.getElementById('regStuId');
  if (idInput && !idInput.value) {
    idInput.value = `KTPTTC-2026-12P2-${String(nextNumber).padStart(3, '0')}`;
  }
}

// Setup Class Selector dropdown (2-way sync with regClass & regGroup)
function setupClassSelector() {
  const sel = document.getElementById('classSelector');
  const classInput = document.getElementById('regClass');
  const groupInput = document.getElementById('regGroup');
  if (sel) {
    sel.addEventListener('change', (e) => {
      const val = e.target.value;
      if (classInput) {
        if (val.includes('១២+៤')) classInput.value = '១២+៤';
        else if (val.includes('បរិញ្ញា')) classInput.value = 'បរិញ្ញាបត្រ+១';
        else classInput.value = '១២+២';
      }
      if (groupInput) {
        if (val.includes('ក្រុម ខ')) groupInput.value = 'ក្រុម ខ';
        else if (val.includes('ក្រុម គ')) groupInput.value = 'ក្រុម គ';
        else groupInput.value = 'ក្រុម ក';
      }
    });
  }
}

// Check Edit Mode from URL query (?id=STU-001)
function checkEditMode() {
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('id');
  if (!editId) return;

  const students = getSavedStudents();
  const s = students.find(x => x.id === editId);
  if (!s) return;

  const title = document.querySelector('.form-header-title');
  if (title) title.innerHTML = `<i class="fas fa-user-edit" style="color: #2563eb;"></i> កែប្រែព័ត៌មានសិស្ស (${s.nameKh})`;

  const idInput = document.getElementById('regStuId');
  if (idInput) {
    idInput.value = s.id;
    idInput.readOnly = true;
  }

  if (document.getElementById('regClass')) {
    if (s.classGrade) document.getElementById('regClass').value = s.classGrade;
    else if (s.className && s.className.includes('១២+៤')) document.getElementById('regClass').value = '១២+៤';
    else if (s.className && s.className.includes('បរិញ្ញា')) document.getElementById('regClass').value = 'បរិញ្ញាបត្រ+១';
    else document.getElementById('regClass').value = '១២+២';
  }
  if (document.getElementById('regGroup')) {
    if (s.group) document.getElementById('regGroup').value = s.group;
    else if (s.className && s.className.includes('ក្រុម ខ')) document.getElementById('regGroup').value = 'ក្រុម ខ';
    else if (s.className && s.className.includes('ក្រុម គ')) document.getElementById('regGroup').value = 'ក្រុម គ';
    else document.getElementById('regGroup').value = 'ក្រុម ក';
  }
  if (document.getElementById('regNameKh')) document.getElementById('regNameKh').value = s.nameKh || '';
  if (document.getElementById('regNameEn')) document.getElementById('regNameEn').value = s.nameEn || '';
  if (document.getElementById('regGender')) document.getElementById('regGender').value = s.gender || 'ប្រុស';
  if (document.getElementById('regDob')) {
    document.getElementById('regDob').value = s.dob || '';
    calculateAgeFromDob(s.dob);
  }
  if (document.getElementById('regParentPhone')) document.getElementById('regParentPhone').value = s.parentPhone || '';

  if (s.photo) setPhotoPreview(s.photo);

  if (s.birthplace) {
    if (document.getElementById('pobProvince')) document.getElementById('pobProvince').value = s.birthplace.province || '';
    if (document.getElementById('pobDistrict')) document.getElementById('pobDistrict').value = s.birthplace.district || '';
    if (document.getElementById('pobCommune')) document.getElementById('pobCommune').value = s.birthplace.commune || '';
    if (document.getElementById('pobVillage')) document.getElementById('pobVillage').value = s.birthplace.village || '';
  }

  if (s.address) {
    if (document.getElementById('curProvince')) document.getElementById('curProvince').value = s.address.province || '';
    if (document.getElementById('curDistrict')) document.getElementById('curDistrict').value = s.address.district || '';
    if (document.getElementById('curCommune')) document.getElementById('curCommune').value = s.address.commune || '';
    if (document.getElementById('curVillage')) document.getElementById('curVillage').value = s.address.village || '';
  }

  if (s.status) {
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
function calculateAgeFromDob(dobString) {
  const ageInput = document.getElementById('regAge');
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

// ==========================================================================
// Photo Upload & Live Camera Handlers (Enhanced with Server Upload)
// ==========================================================================

function triggerPhotoFileInput() {
  const input = document.getElementById('photoFileInput');
  if (input) input.click();
}

function showPhotoUploading(isLoading) {
  const spinner = document.getElementById('photoUploadingSpinner');
  if (spinner) {
    spinner.style.display = isLoading ? 'flex' : 'none';
  }
}

// Compress image via HTML5 Canvas to prevent localStorage quota issues
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

// Upload photo to Hostinger server storage (/api/upload/image)
async function uploadPhotoToServer(compressedDataUrl) {
  showPhotoUploading(true);
  try {
    const endpoint = window.location.hostname.includes('ktpttc.net') ? 'https://ktpttc.net/api/upload/image' : '/api/upload/image';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: compressedDataUrl,
        filename: `stu_${Date.now()}.jpg`
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.url) {
        const fullUrl = data.url.startsWith('http') ? data.url : `https://ktpttc.net${data.url}`;
        currentPhotoData = fullUrl;
        setPhotoPreview(fullUrl);
        showPhotoUploading(false);
        showToast('បានផ្ទុកឡើងរូបថតសិស្សចូល Server ជោគជ័យ!', 'success');
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
  showToast('បានជ្រើសរូបថតសិស្សរួចរាល់!', 'success');
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

function promptPhotoUrl() {
  const url = prompt('សូមបញ្ចូលតំណភ្ជាប់រូបថត (Image URL)៖');
  if (url && url.trim().startsWith('http')) {
    setPhotoPreview(url.trim());
    currentPhotoData = url.trim();
    showToast('បានភ្ជាប់រូបថតសិស្សរួចរាល់', 'success');
  }
}

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

// Copy Birthplace fields to Current Address
function copyBirthplaceToAddress() {
  document.getElementById('curProvince').value = document.getElementById('pobProvince').value;
  document.getElementById('curDistrict').value = document.getElementById('pobDistrict').value;
  document.getElementById('curCommune').value = document.getElementById('pobCommune').value;
  document.getElementById('curVillage').value = document.getElementById('pobVillage').value;
  showToast('បានចម្លងទីកន្លែងកំណើតទៅអាសយដ្ឋានបច្ចុប្បន្ន', 'info');
}

// Save Student Form
function handleSaveStudent() {
  const id = document.getElementById('regStuId')?.value?.trim();
  const classGrade = document.getElementById('regClass')?.value || '១២+២';
  const group = document.getElementById('regGroup')?.value || 'ក្រុម ក';
  const className = `${classGrade} ${group}`.trim();
  const nameKh = document.getElementById('regNameKh')?.value?.trim();
  const nameEn = document.getElementById('regNameEn')?.value?.trim() || '';
  const gender = document.getElementById('regGender')?.value;
  const dob = document.getElementById('regDob')?.value;
  const age = document.getElementById('regAge')?.value || '';
  const parentPhone = document.getElementById('regParentPhone')?.value?.trim() || '';

  if (!id || !nameKh || !gender || !dob) {
    showToast('សូមបំពេញរាល់ព័ត៌មានដែលមានសញ្ញា (*) ឱ្យបានគ្រប់ជ្រុងជ្រោយ!', 'error');
    return;
  }

  const students = getSavedStudents();

  // Check duplicate ID
  const existingIdx = students.findIndex(s => s.id === id);
  if (existingIdx !== -1) {
    if (!confirm(`អត្តលេខ ${id} មានក្នុងប្រព័ន្ធរួចហើយ។ តើលោកគ្រូ-អ្នកគ្រូចង់ធ្វើបច្ចុប្បន្នភាព (Update) សិស្សនេះមែនទេ?`)) {
      return;
    }
  }

  // Create student payload
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
    photo: currentPhotoData || '',
    avatar: gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓',
    behaviorScore: 100,
    scores: { KH: 0, MATH: 0, PHY: 0, CHEM: 0, BIO: 0, HIST: 0, GEO: 0, ENG: 0, MOR: 0 },
    absentYearCount: 0,
    attendance: 'present',

    // Place of Birth
    birthplace: {
      province: document.getElementById('pobProvince')?.value?.trim() || '',
      district: document.getElementById('pobDistrict')?.value?.trim() || '',
      commune: document.getElementById('pobCommune')?.value?.trim() || '',
      village: document.getElementById('pobVillage')?.value?.trim() || ''
    },

    // Current Address
    address: {
      province: document.getElementById('curProvince')?.value?.trim() || '',
      district: document.getElementById('curDistrict')?.value?.trim() || '',
      commune: document.getElementById('curCommune')?.value?.trim() || '',
      village: document.getElementById('curVillage')?.value?.trim() || ''
    },

    // Status
    status: {
      isNew: document.getElementById('statusNew')?.value || 'បាទ/ចាស',
      isRepeater: document.getElementById('statusRepeater')?.value || 'ទេ',
      familyStatus: document.getElementById('statusFamily')?.value || 'ទេ',
      disability: document.getElementById('statusDisability')?.value || 'ទេ',
      poorCard: document.getElementById('statusPoorCard')?.value || 'គ្មាន',
      ethnic: document.getElementById('statusEthnic')?.value || 'ទេ',
      scholarship: document.getElementById('statusScholarship')?.value || 'ទេ'
    },

    // Parents Info
    parents: {
      fatherName: document.getElementById('fatherName')?.value?.trim() || '',
      fatherJob: document.getElementById('fatherJob')?.value?.trim() || '',
      motherName: document.getElementById('motherName')?.value?.trim() || '',
      motherJob: document.getElementById('motherJob')?.value?.trim() || '',
      guardianName: document.getElementById('guardianName')?.value?.trim() || '',
      guardianJob: document.getElementById('guardianJob')?.value?.trim() || ''
    },

    // Additional Info
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

    const existingTraineeIdx = stmsObj.trainees.findIndex(t => t.id === id);
    const traineeRecord = {
      id,
      roll: stmsObj.trainees.length + 1,
      nameKh,
      nameEn,
      gender,
      dob,
      phone: parentPhone,
      parentPhone,
      classGrade,
      group,
      className,
      cohort: className.includes('១២+៤') ? "ថ្នាក់គរុកោសល្យ ១២+៤ ជំនាន់ទី ១" : className.includes('បរិញ្ញា') ? "ថ្នាក់បរិញ្ញាបត្រ+១ ជំនាន់ទី ១" : "ថ្នាក់បឋមសិក្សា ១២+២ ជំនាន់ទី ៣៤",
      trainingType: className.includes('១២+៤') ? "12+4" : className.includes('បរិញ្ញា') ? "បរិញ្ញាបត្រ+១" : "12+2 (បឋមសិក្សា)",
      status: "កំពុងសិក្សា",
      avatar: gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓',
      photo: currentPhotoData || '',
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
      situation: {
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
      attendanceSummary: { present: 0, permission: 0, late: 0, absent: 0, rate: 100.0 },
      scores: {}
    };

    if (existingTraineeIdx !== -1) {
      stmsObj.trainees[existingTraineeIdx] = traineeRecord;
    } else {
      stmsObj.trainees.push(traineeRecord);
    }

    // Provision Login User for Student
    const userExists = stmsObj.users.some(u => u.username.toLowerCase() === id.toLowerCase());
    if (!userExists) {
      stmsObj.users.push({
        id: `USR-STU-${String(stmsObj.users.length + 1).padStart(3, '0')}`,
        nameKh,
        nameEn,
        studentId: id,
        username: id.toLowerCase(),
        password: "ktpttc123",
        role: "trainee",
        roleLabel: "គរុសនិស្សិត",
        email: parentPhone ? `${id.toLowerCase()}@student.ktpttc.edu.kh` : "portal@student.ktpttc.edu.kh",
        phone: parentPhone,
        className,
        cohort: traineeRecord.cohort,
        status: "active",
        avatar: gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓'
      });
    }

    localStorage.setItem('ktpttc_stms_data_v2', JSON.stringify(stmsObj));
  } catch (e) {
    console.error('Sync to STMS storage error:', e);
  }

  showToast(`បានរក្សាទុកគរុសនិស្សិត «${nameKh}» ដោយជោគជ័យ!`, 'success');

  // Reset form for next student
  resetFormForNextStudent(students.length + 1);
}

// Reset form for next student entry
function resetFormForNextStudent(nextRoll) {
  document.getElementById('studentRegistrationForm').reset();
  
  // Set next ID & default class
  const idInput = document.getElementById('regStuId');
  if (idInput) idInput.value = `KTPTTC-2026-12P2-${String(nextRoll).padStart(3, '0')}`;
  
  const classInput = document.getElementById('regClass');
  if (classInput) classInput.value = '១២+២';
  const groupInput = document.getElementById('regGroup');
  if (groupInput) groupInput.value = 'ក្រុម ក';
  const sel = document.getElementById('classSelector');
  if (sel) sel.value = '១២+២ ក្រុម ក';

  // Reset photo
  currentPhotoData = '';
  const img = document.getElementById('photoPreviewImg');
  const placeholder = document.getElementById('photoPlaceholder');
  if (img) img.style.display = 'none';
  if (placeholder) placeholder.style.display = 'block';

  // Scroll smoothly to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Download Excel / CSV Template
function downloadExcelTemplate() {
  const headers = [
    'អត្តលេខ',
    'ថ្នាក់ទី',
    'ក្រុម',
    'ឈ្មោះសិស្ស_ខ្មែរ',
    'ឈ្មោះជាឡាតាំង',
    'ភេទ',
    'ថ្ងៃខែឆ្នាំកំណើត_YYYY-MM-DD',
    'លេខទូរស័ព្ទអាណាព្យាបាល',
    'ខេត្តកំណើត',
    'ស្រុកកំណើត',
    'ឃុំកំណើត',
    'ភូមិកំណើត',
    'ខេត្តបច្ចុប្បន្ន',
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
    '១២+៤',
    'ក្រុម ខ',
    'ចាន់ សុគន្ធា',
    'Chan Sokunthea',
    'ស្រី',
    '2004-11-20',
    '016789123',
    'រាជធានីភ្នំពេញ',
    'ខណ្ឌដូនពេញ',
    'ផ្សារកណ្តាល',
    'ភូមិ២',
    'រាជធានីភ្នំពេញ',
    'ចាន់ ប៊ុនធឿន',
    'អាជីវករ',
    'សុខ សោភា',
    'គ្រូបង្រៀន'
  ];

  const csvContent = '\uFEFF' + [
    headers.join(','),
    sampleRow1.join(','),
    sampleRow2.join(',')
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'គំរូបញ្ជីចុះឈ្មោះសិស្ស_MoEYS_Template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('បានទាញយកឯកសារគំរូ Excel/CSV ដោយជោគជ័យ!', 'success');
}

// Handle Excel / CSV File Import
function handleExcelImport(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length <= 1) {
        showToast('ឯកសារពុំមានទិន្នន័យសិស្សទេ!', 'error');
        return;
      }

      const students = getSavedStudents();
      let importedCount = 0;

      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length >= 3 && (cols[2] || cols[3])) {
          const id = cols[0] || `STU-${String(students.length + 1).padStart(3, '0')}`;
          const hasGroupCol = cols[2] && cols[2].includes('ក្រុម');
          const classGrade = cols[1] || '១២+២';
          const group = hasGroupCol ? cols[2] : 'ក្រុម ក';
          const nameKh = hasGroupCol ? cols[3] : cols[2];
          const nameEn = hasGroupCol ? (cols[4] || '') : (cols[3] || '');
          const genderCol = hasGroupCol ? cols[5] : cols[4];
          const dobCol = hasGroupCol ? cols[6] : cols[5];
          const phoneCol = hasGroupCol ? cols[7] : cols[6];
          const className = `${classGrade} ${group}`.trim();

          let gender = 'ប្រុស';
          if (genderCol && (genderCol.includes('ស្រី') || genderCol.toLowerCase().includes('female') || genderCol.toLowerCase() === 'f')) {
            gender = 'ស្រី';
          }
          const dob = dobCol || '2005-01-01';
          const parentPhone = phoneCol || '';

          students.push({
            id,
            roll: students.length + 1,
            className,
            nameKh,
            nameEn,
            gender,
            dob,
            age: '',
            parentPhone,
            avatar: gender === 'ស្រី' ? '👩‍🎓' : '👨‍🎓',
            behaviorScore: 100,
            scores: { KH: 0, MATH: 0, PHY: 0, CHEM: 0, BIO: 0, HIST: 0, GEO: 0, ENG: 0, MOR: 0 },
            absentYearCount: 0,
            attendance: 'present',
            birthplace: { province: cols[7] || '', district: cols[8] || '', commune: cols[9] || '', village: cols[10] || '' },
            address: { province: cols[11] || cols[7] || '', district: '', commune: '', village: '' },
            parents: { fatherName: cols[12] || '', fatherJob: cols[13] || '', motherName: cols[14] || '', motherJob: cols[15] || '' }
          });
          importedCount++;
        }
      }

      saveStudentsToStorage(students);
      showToast(`បាននាំចូលទិន្នន័យសិស្សចំនួន ${importedCount} នាក់ពី Excel ដោយជោគជ័យ!`, 'success');
      setTimeout(() => {
        sessionStorage.setItem('stms_target_view', 'trainees');
        window.location.href = 'index.html';
      }, 1500);

    } catch (err) {
      console.error(err);
      showToast('មានបញ្ហាក្នុងការអានឯកសារ Excel/CSV៖ ' + err.message, 'error');
    }
  };

  reader.readAsText(file, 'utf-8');
  input.value = '';
}
