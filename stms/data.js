/**
 * STMS - Teaching & Learning Management System (ប្រព័ន្ធគ្រប់គ្រងការបង្រៀន និងរៀន)
 * សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ (KTPTTC - Kratie Provincial Teacher Training Center)
 * Initial Seed Data & MoEYS Standard Configurations
 */

const KTPTTC_INITIAL_DATA = {
  institution: {
    nameKh: "សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ",
    nameEn: "Kratie Provincial Teacher Training Center (KTPTTC)",
    abbreviation: "KTPTTC",
    location: "ភូមិអូរឫស្សី២ សង្កាត់អូរឫស្សី ក្រុងក្រចេះ ខេត្តក្រចេះ",
    contact: "072 971 234 / info@ktpttc.net",
    website: "https://stms.ktpttc.net",
    ministry: "ក្រសួងអប់រំ យុវជន និងកីឡា (MoEYS)"
  },

  academicYears: [
    { id: "AY-2026-2027", yearKh: "២០២៦ - ២០២៧", isCurrent: true, startDate: "2026-10-01", endDate: "2027-08-31" },
    { id: "AY-2025-2026", yearKh: "២០២៥ - ២០២៦", isCurrent: false, startDate: "2025-10-01", endDate: "2026-08-31" }
  ],

  cohorts: [],

  // Grade Weight Configurations (Module 2-C)
  gradeWeightConfig: {
    homeworkPercent: 10,   // កិច្ចការស្រាវជ្រាវ/ផ្ទាល់ខ្លួន
    attendancePercent: 10, // វត្តមាន និងវិន័យ
    monthlyExamPercent: 30,// ប្រឡងពាក់កណ្ដាលឆមាស / ប្រចាំខែ
    semesterExamPercent: 50 // ប្រឡងបញ្ចប់ឆមាស
  },

  subjects: [
    { code: "PED-101", nameKh: "គរុកោសល្យ", credits: 3, trainer: "", mode: "ទាំងពីរ" },
    { code: "PSY-102", nameKh: "ចិត្តវិទ្យាអប់រំ", credits: 2, trainer: "", mode: "ទាំងពីរ" },
    { code: "KHM-103", nameKh: "ភាសាខ្មែរ", credits: 2, trainer: "", mode: "ទាំងពីរ" },
    { code: "MTH-104", nameKh: "គណិតវិទ្យា", credits: 2, trainer: "", mode: "ទាំងពីរ" },
    { code: "SCI-105", nameKh: "វិទ្យាសាស្ត្រ", credits: 2, trainer: "", mode: "ទាំងពីរ" },
    { code: "SOC-106", nameKh: "សិក្សាសង្គម", credits: 2, trainer: "", mode: "ទាំងពីរ" },
    { code: "RES-107", nameKh: "ការស្រាវជ្រាវអប់រំ", credits: 2, trainer: "", mode: "ទាំងពីរ" },
    { code: "ASM-108", nameKh: "ការវាយតម្លៃការសិក្សា", credits: 2, trainer: "", mode: "ផ្ទាល់" },
    { code: "ICT-105", nameKh: "ICT", credits: 2, trainer: "យូសុះ ស៊ីលាល", mode: "ផ្ទាល់" },
    { code: "TMK-110", nameKh: "វិធីសាស្រ្តបង្រៀនភាសាខ្មែរ១", credits: 3, trainer: "", mode: "ផ្ទាល់" },
    { code: "TMM-111", nameKh: "វិធីសាស្រ្តបង្រៀនគណិត១", credits: 3, trainer: "", mode: "ផ្ទាល់" },
    { code: "PRAC-112", nameKh: "កម្មសិក្សាគរុកោសល្យ១", credits: 4, trainer: "", mode: "ផ្ទាល់" },
    { code: "COM-108", nameKh: "បច្ចេកវិទ្យាព័ត៌មានវិទ្យា និងសារគមនាគមន៍", credits: 2, trainer: "" }
  ],

  // Course Syllabi (Configured by Teachers / Admins)
  syllabi: {
    "PED-101": [
      { chapter: "ជំពូកទី ១", title: "ទ្រឹស្តីនៃការបង្រៀន និងរៀនតាមបែបស្ថាបនានិយម (Constructivism)" },
      { chapter: "ជំពូកទី ២", title: "ការរៀបចំកិច្ចតែងការបង្រៀន (Lesson Plan) តាមស្តង់ដារក្រសួងអប់រំ" },
      { chapter: "ជំពូកទី ៣", title: "វិធីសាស្ត្របង្រៀនសកម្ម និងការគ្រប់គ្រងថ្នាក់រៀនបែបវិជ្ជមាន" },
      { chapter: "ជំពូកទី ៤", title: "ការវាស់វែង និងវាយតម្លៃលទ្ធផលសិក្សារបស់សិស្សបឋម" }
    ],
    "PSY-102": [
      { chapter: "ជំពូកទី ១", title: "សេចក្តីផ្តើមអំពីចិត្តវិទ្យាគរុកោសល្យ និងការលូតលាស់" },
      { chapter: "ជំពូកទី ២", title: "ទ្រឹស្តីនៃការអភិវឌ្ឍបញ្ញា និងស្មារតីរបស់កុមារបឋមសិក្សា" },
      { chapter: "ជំពូកទី ៣", title: "ការយល់ដឹងអំពីចរិតលក្ខណៈ និងភាពខុសគ្នារវាងបុគ្គល" },
      { chapter: "ជំពូកទី ៤", title: "ការលើកទឹកចិត្ត និងការដោះស្រាយបញ្ហាផ្លូវចិត្តក្នុងថ្នាក់រៀន" }
    ],
    "MTH-103": [
      { chapter: "ជំពូកទី ១", title: "វិធីសាស្ត្របង្រៀនគំនិតទូទៅនៃលេខ និងប្រមាណវិធីបឋម" },
      { chapter: "ជំពូកទី ២", title: "ការបង្រៀនប្រភាគ ទសភាគ និងរង្វាស់រង្វាល់" },
      { chapter: "ជំពូកទី ៣", title: "វិធីសាស្ត្របង្រៀនធរណីមាត្រ និងការដោះស្រាយចំណោទ" },
      { chapter: "ជំពូកទី ៤", title: "ការផលិត និងប្រើប្រាស់ឧបទេសគណិតវិទ្យាជាក់ស្តែង" }
    ],
    "KHM-104": [
      { chapter: "ជំពូកទី ១", title: "វិធីសាស្ត្របង្រៀនអំណានដំបូង និងការបញ្ចេញសំឡេង" },
      { chapter: "ជំពូកទី ២", title: "ការបង្រៀនសរសេរតាមអាន និងវេយ្យាករណ៍ខ្មែរ" },
      { chapter: "ជំពូកទី ៣", title: "វិធីសាស្ត្របង្រៀនតែងសេចក្តី និងការអានយល់ន័យ" },
      { chapter: "ជំពូកទី ៤", title: "ការជំរុញទម្លាប់អាន និងការបង្កើតបរិស្ថានអំណាន" }
    ],
    "ICT-105": [
      { chapter: "ជំពូកទី ១", title: "មូលដ្ឋានគ្រឹះបច្ចេកវិទ្យាព័ត៌មាន និងការអប់រំឌីជីថល" },
      { chapter: "ជំពូកទី ២", title: "ការប្រើប្រាស់ Google Workspace និងកម្មវិធី Office ក្នុងការបង្រៀន" },
      { chapter: "ជំពូកទី ៣", title: "ការផលិតមាតិកាមេរៀនឌីជីថល និងស្លាយបទបង្ហាញ" },
      { chapter: "ជំពូកទី ៤", title: "ការប្រើប្រាស់ AI និងឧបករណ៍វាយតម្លៃអនឡាញក្នុងការអប់រំ" }
    ],
    "RES-106": [
      { chapter: "ជំពូកទី ១", title: "សញ្ញាណទូទៅនៃការស្រាវជ្រាវសកម្មភាពក្នុងថ្នាក់រៀន" },
      { chapter: "ជំពូកទី ២", title: "ការកំណត់បញ្ហា និងការរៀបចំសំណួរស្រាវជ្រាវ" },
      { chapter: "ជំពូកទី ៣", title: "វិធីសាស្ត្រប្រមូលទិន្នន័យ និងឧបករណ៍ស្រាវជ្រាវ" },
      { chapter: "ជំពូកទី ៤", title: "ការវិភាគទិន្នន័យ និងការសរសេររបាយការណ៍ស្រាវជ្រាវ" }
    ],
    "PRAC-107": [
      { chapter: "ជំពូកទី ១", title: "ការរៀបចំខ្លួន និងបទដ្ឋានគរុកោសល្យចុះកម្មសិក្សា" },
      { chapter: "ជំពូកទី ២", title: "ការសង្កេតការបង្រៀន និងបរិស្ថានសាលាបឋមសិក្សា" },
      { chapter: "ជំពូកទី ៣", title: "ការសាកល្បងបង្រៀន និងការទទួលមតិកែលម្អពីគ្រូណែនាំ" },
      { chapter: "ជំពូកទី ៤", title: "ការបង្រៀនជាក់ស្តែង និងការវាយតម្លៃកម្មសិក្សា" }
    ],
    "PRA-107": [
      { chapter: "ជំពូកទី ១", title: "ការរៀបចំខ្លួន និងបទដ្ឋានគរុកោសល្យចុះកម្មសិក្សា" },
      { chapter: "ជំពូកទី ២", title: "ការសង្កេតការបង្រៀន និងបរិស្ថានសាលាបឋមសិក្សា" },
      { chapter: "ជំពូកទី ៣", title: "ការសាកល្បងបង្រៀន និងការទទួលមតិកែលម្អពីគ្រូណែនាំ" },
      { chapter: "ជំពូកទី ៤", title: "ការបង្រៀនជាក់ស្តែង និងការវាយតម្លៃកម្មសិក្សា" }
    ],
    "COM-108": [
      { chapter: "ជំពូកទី ១", title: "សិល្បៈនៃការទំនាក់ទំនង និងការនិយាយក្នុងថ្នាក់រៀន" },
      { chapter: "ជំពូកទី ២", title: "ការប្រើប្រាស់ភាសាកាយវិការ និងការស្តាប់ដោយយកចិត្តទុកដាក់" },
      { chapter: "ជំពូកទី ៣", title: "ទំនាក់ទំនងរវាងគ្រូ សិស្ស និងសហគមន៍/មាតាបិតា" },
      { chapter: "ជំពូកទី ៤", title: "ការដោះស្រាយជម្លោះ និងការកសាងបរិយាកាសវិជ្ជមាន" }
    ]
  },

  users: [
    {
      id: "USR-ADM-001",
      nameKh: "អ្នកគ្រប់គ្រងប្រព័ន្ធ",
      nameEn: "System Administrator",
      username: "admin",
      password: "admin123",
      role: "admin", // Administrator
      roleLabel: "អ្នកគ្រប់គ្រងប្រព័ន្ធ / សិក្សាធិការ",
      email: "admin@ktpttc.net",
      phone: "",
      status: "active",
      avatar: "👨‍💼"
    },
    {
      id: "USR-TRN-001",
      nameKh: "គ្រូឧទ្ទេស",
      nameEn: "Trainer",
      username: "trainer",
      password: "trainer123",
      role: "trainer", // Trainer / Teacher
      roleLabel: "គ្រូឧទ្ទេស / មន្ត្រីបង្រៀន",
      email: "trainer@ktpttc.net",
      phone: "",
      subject: "PED-101",
      status: "active",
      avatar: "👨‍🏫"
    },
    {
      id: "USR-STU-001",
      nameKh: "គរុសិស្ស",
      nameEn: "Trainee Portal",
      studentId: "",
      username: "trainee",
      password: "trainee123",
      role: "trainee",
      roleLabel: "គរុសិស្ស",
      email: "trainee@ktpttc.net",
      phone: "",
      className: "",
      cohort: "",
      status: "active",
      avatar: "👨‍🎓"
    }
  ],

  // Trainee Database - Starts completely empty (ទុកឱ្យគ្រូបង្រៀន/រដ្ឋបាលបញ្ចូលផ្ទាល់ មិនបញ្ចូលទិន្នន័យស្វ័យប្រវត្តិឡើយ)
  trainees: [],

  // Attendance Records Log - Starts completely empty
  attendanceSessions: [],

  // Timetable Schedule - Starts completely empty
  timetables: [],

  // Profile Update Requests - Starts completely empty
  profileRequests: [],

  // Library Management - Starts empty
  library: {
    totalBooks: 0,
    issuedBooks: 0,
    returnedBooks: 0,
    availableBooks: 0,
    recentBorrows: []
  },

  // Daily Attendance Statistics - Starts empty
  dailyAttendanceStats: [],

  // Grade Distribution - Starts empty
  gradeDistribution: {},

  // Online Classroom Meetings (Zoom / Google Meet)
  onlineClasses: [],

  // Teacher Attendance & Teaching Hours Log
  teacherAttendance: [],

  // Teacher Incident & Classroom Reports to Admin
  teacherReports: [],

  // Master Gradebook Approvals
  gradebookApprovals: {}
};

// Export for browser & Node
if (typeof window !== 'undefined') {
  window.KTPTTC_INITIAL_DATA = KTPTTC_INITIAL_DATA;
  window.KTPTTC_DEFAULT_SYLLABI = KTPTTC_INITIAL_DATA.syllabi;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KTPTTC_INITIAL_DATA;
}
