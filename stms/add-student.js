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

// Setup Class Selector dropdown
function setupClassSelector() {
  const sel = document.getElementById('classSelector');
  const classInput = document.getElementById('regClass');
  if (sel && classInput) {
    sel.addEventListener('change', (e) => {
      classInput.value = e.target.value;
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

  if (document.getElementById('regClass')) document.getElementById('regClass').value = s.className || 'ថ្នាក់ទី ៧ក';
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

// Photo Upload Handlers
function handlePhotoUpload(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target.result);
      showToast('បានជ្រើសរូបថតសិស្សដោយជោគជ័យ!', 'success');
    };
    reader.readAsDataURL(file);
  }
}

function promptPhotoUrl() {
  const url = prompt('សូមបញ្ចូលតំណភ្ជាប់រូបថត (Image URL)៖');
  if (url && url.trim().startsWith('http')) {
    setPhotoPreview(url.trim());
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

// Camera Web Capture (Simple snapshot using HTML5 Video or fallback)
function openWebcamCapture() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const input = document.getElementById('photoFileInput');
    if (input) {
      input.setAttribute('capture', 'user');
      input.click();
    } else {
      showToast('ឧបករណ៍នេះពុំគាំទ្រម៉ាស៊ីនថតផ្ទាល់ទេ', 'error');
    }
    return;
  }

  // Create quick modal for webcam
  const modal = document.createElement('div');
  modal.id = 'webcamModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;';
  
  modal.innerHTML = `
    <div style="background:#1e293b; border-radius:12px; padding:20px; max-width:440px; width:90%; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
      <h3 style="color:#f8fafc; font-size:1.1rem; margin-bottom:12px;"><i class="fas fa-camera"></i> ថតរូបសិស្សផ្ទាល់</h3>
      <video id="webcamVideo" autoplay playsinline style="width:100%; border-radius:8px; background:#000; max-height:280px; object-fit:cover;"></video>
      <canvas id="webcamCanvas" style="display:none;"></canvas>
      <div style="display:flex; justify-content:center; gap:12px; margin-top:16px;">
        <button id="btnCancelCam" style="background:#64748b; color:#fff; border:none; padding:8px 18px; border-radius:6px; font-weight:600; cursor:pointer;">បោះបង់</button>
        <button id="btnSnapCam" style="background:#16a34a; color:#fff; border:none; padding:8px 22px; border-radius:6px; font-weight:600; cursor:pointer;"><i class="fas fa-camera"></i> ថតរូប</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const video = modal.querySelector('#webcamVideo');
  let stream = null;

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    .then(s => {
      stream = s;
      video.srcObject = s;
    })
    .catch(err => {
      console.error(err);
      modal.remove();
      showToast('មិនអាចបើកកាមេរ៉ាបានទេ៖ ' + err.message, 'error');
    });

  modal.querySelector('#btnCancelCam').onclick = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    modal.remove();
  };

  modal.querySelector('#btnSnapCam').onclick = () => {
    const canvas = modal.querySelector('#webcamCanvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoPreview(dataUrl);
    if (stream) stream.getTracks().forEach(t => t.stop());
    modal.remove();
    showToast('បានថតរូបសិស្សរួចរាល់!', 'success');
  };
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
  const className = document.getElementById('regClass')?.value?.trim() || 'ថ្នាក់ទី ៧ក';
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
      className,
      cohort: className.includes('បឋម') ? "ថ្នាក់បឋមសិក្សា ១២+២ ជំនាន់ទី ៣៤" : className.includes('មត្តេយ្យ') ? "ថ្នាក់មត្តេយ្យសិក្សា ១២+២ ជំនាន់ទី ៣៤" : "ថ្នាក់វិក្រឹតការគ្រូបង្រៀន និងនាយកសាលា",
      trainingType: className.includes('មត្តេយ្យ') ? "12+2 (មត្តេយ្យ)" : className.includes('វិក្រឹតការ') ? "វិក្រឹតការ" : "12+2 (បឋមសិក្សា)",
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
  if (classInput) classInput.value = 'ថ្នាក់បឋម ១២+២ ក្រុម ក';

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
    'STU-001',
    'ថ្នាក់ទី ៧ក',
    'កែវ វិសាល',
    'Keo Visal',
    'ប្រុស',
    '2013-05-12',
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
    'STU-002',
    'ថ្នាក់ទី ៧ក',
    'ចាន់ សុគន្ធា',
    'Chan Sokunthea',
    'ស្រី',
    '2013-08-20',
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
        if (cols.length >= 3 && cols[2]) {
          const id = cols[0] || `STU-${String(students.length + 1).padStart(3, '0')}`;
          const className = cols[1] || 'ថ្នាក់ទី ៧ក';
          const nameKh = cols[2];
          const nameEn = cols[3] || '';
          let gender = 'ប្រុស';
          if (cols[4] && (cols[4].includes('ស្រី') || cols[4].toLowerCase().includes('female') || cols[4].toLowerCase() === 'f')) {
            gender = 'ស្រី';
          }
          const dob = cols[5] || '2013-01-01';
          const parentPhone = cols[6] || '';

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
