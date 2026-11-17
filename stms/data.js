/**
 * STMS - Student & Teacher Management System (ប្រព័ន្ធគ្រប់គ្រងគរុនិស្សិត)
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

  cohorts: [
    {
      id: "C-12P2-G34",
      nameKh: "ថ្នាក់បឋមសិក្សា ១២+២ ជំនាន់ទី ៣៤",
      type: "12+2 (បឋមសិក្សា)",
      academicYear: "AY-2026-2027",
      rooms: ["បន្ទប់ ១០១", "បន្ទប់ ១០២"],
      classes: ["ថ្នាក់បឋម ១២+២ ក្រុម ក", "ថ្នាក់បឋម ១២+២ ក្រុម ខ"]
    },
    {
      id: "C-PRE-G34",
      nameKh: "ថ្នាក់មត្តេយ្យសិក្សា ១២+២ ជំនាន់ទី ៣៤",
      type: "12+2 (មត្តេយ្យ)",
      academicYear: "AY-2026-2027",
      rooms: ["បន្ទប់ ២០១"],
      classes: ["ថ្នាក់មត្តេយ្យ ១២+២"]
    },
    {
      id: "C-INSERVICE-2026",
      nameKh: "ថ្នាក់វិក្រឹតការគ្រូបង្រៀន និងនាយកសាលា",
      type: "វិក្រឹតការ (In-service)",
      academicYear: "AY-2026-2027",
      rooms: ["បន្ទប់សាលប្រជុំ"],
      classes: ["ថ្នាក់វិក្រឹតការ វគ្គ១"]
    }
  ],

  // Grade Weight Configurations (Module 2-C)
  gradeWeightConfig: {
    homeworkPercent: 10,   // កិច្ចការស្រាវជ្រាវ/ផ្ទាល់ខ្លួន
    attendancePercent: 10, // វត្តមាន និងវិន័យ
    monthlyExamPercent: 30,// ប្រឡងពាក់កណ្ដាលឆមាស / ប្រចាំខែ
    semesterExamPercent: 50 // ប្រឡងបញ្ចប់ឆមាស
  },

  subjects: [
    { code: "PED-101", nameKh: "គរុកោសល្យទូទៅ និងវិធីសាស្ត្របង្រៀន", credits: 3, trainer: "សាស្ត្រាចារ្យ ហេង សំណាង" },
    { code: "PSY-102", nameKh: "ចិត្តវិទ្យាគរុកោសល្យ និងការអភិវឌ្ឍកុមារ", credits: 2, trainer: "លោកស្រី ម៉ៅ សុភា" },
    { code: "MTH-103", nameKh: "វិធីសាស្ត្របង្រៀនគណិតវិទ្យាបឋម", credits: 3, trainer: "លោកគ្រូ យឹម វណ្ណា" },
    { code: "KHM-104", nameKh: "វិធីសាស្ត្របង្រៀនភាសាខ្មែរ និងអំណានដំបូង", credits: 3, trainer: "លោកស្រី ជា រចនា" },
    { code: "ICT-105", nameKh: "បច្ចេកវិទ្យាព័ត៌មានក្នុងការអប់រំ (ICT)", credits: 2, trainer: "លោកគ្រូ ស៊ុយ សូលីដា" },
    { code: "RES-106", nameKh: "ការស្រាវជ្រាវសកម្មភាពក្នុងថ្នាក់រៀន (Action Research)", credits: 2, trainer: "សាស្ត្រាចារ្យ ហេង សំណាង" },
    { code: "PRAC-107", nameKh: "ការចុះកម្មសិក្សាគរុកោសល្យនៅសាលាបឋម (Practicum)", credits: 4, trainer: "លោកគ្រូ យឹម វណ្ណា" },
    { code: "COM-108", nameKh: "បច្ចេកវិទ្យាព័ត៌មានវិទ្យា និងសារគមនាគមន៍", credits: 2, trainer: "លោកគ្រូ ស៊ុយ សូលីដា" }
  ],

  users: [
    {
      id: "USR-ADM-001",
      nameKh: "លោក ឈន ប៊ុនថន",
      nameEn: "Chhorn Bunthon",
      username: "admin",
      password: "admin123",
      role: "admin", // Administrator
      roleLabel: "អ្នកគ្រប់គ្រងប្រព័ន្ធ / សិក្សាធិការ",
      email: "admin@ktpttc.edu.kh",
      phone: "012 888 777",
      status: "active",
      avatar: "👨‍💼"
    },
    {
      id: "USR-TRN-001",
      nameKh: "សាស្ត្រាចារ្យ ហេង សំណាង",
      nameEn: "Heng Samnang",
      username: "trainer",
      password: "trainer123",
      role: "trainer", // Trainer / Teacher
      roleLabel: "គ្រូឧទ្ទេស / មន្ត្រីបង្រៀន",
      email: "samnang.heng@ktpttc.edu.kh",
      phone: "016 777 888",
      subject: "PED-101",
      status: "active",
      avatar: "👨‍🏫"
    },
    {
      id: "USR-TRN-002",
      nameKh: "លោកស្រី ជា រចនា",
      nameEn: "Chea Rachana",
      username: "rachana",
      password: "rachana123",
      role: "trainer",
      roleLabel: "គ្រូឧទ្ទេស / មន្ត្រីបង្រៀន",
      email: "rachana.chea@ktpttc.edu.kh",
      phone: "017 666 555",
      subject: "KHM-104",
      status: "active",
      avatar: "👩‍🏫"
    },
    {
      id: "USR-STU-001",
      nameKh: "គរុសនិស្សិត (ទូទៅ)",
      nameEn: "Trainee Portal",
      studentId: "",
      username: "trainee",
      password: "trainee123",
      role: "trainee",
      roleLabel: "គរុសនិស្សិត",
      email: "portal@student.ktpttc.edu.kh",
      phone: "097 555 1234",
      className: "ថ្នាក់បឋម ១២+២",
      cohort: "ថ្នាក់បឋមសិក្សា ១២+២ ជំនាន់ទី ៣៤",
      status: "active",
      avatar: "👨‍🎓"
    }
  ],

    // Trainee Database - Starts completely empty (ទុកឱ្យគ្រូបង្រៀន/រដ្ឋបាលបញ្ចូលផ្ទាល់ មិនបញ្ចូលទិន្នន័យស្វ័យប្រវត្តិឡើយ)
  trainees: [],

  // Attendance Records Log
    // Attendance Records Log - Starts completely empty
  attendanceSessions: [],

  // Timetable Schedule (Module 3 - Timetable with conflict avoidance)
  timetables: [
    {
      cohortId: "C-12P2-G34",
      className: "ថ្នាក់បឋម ១២+២ ក្រុម ក",
      room: "បន្ទប់ ១០១",
      days: [
        {
          day: "ចន្ទ (Monday)",
          slots: [
            { period: "07:30 - 09:00", subject: "គរុកោសល្យទូទៅ និងវិធីសាស្ត្របង្រៀន", trainer: "សាស្ត្រាចារ្យ ហេង សំណាង", room: "បន្ទប់ ១០១" },
            { period: "09:15 - 10:45", subject: "វិធីសាស្ត្របង្រៀនភាសាខ្មែរ", trainer: "លោកស្រី ជា រចនា", room: "បន្ទប់ ១០១" },
            { period: "13:30 - 15:00", subject: "ចិត្តវិទ្យាគរុកោសល្យ", trainer: "លោកស្រី ម៉ៅ សុភា", room: "បន្ទប់ ១០១" }
          ]
        },
        {
          day: "អង្គារ (Tuesday)",
          slots: [
            { period: "07:30 - 09:00", subject: "វិធីសាស្ត្របង្រៀនគណិតវិទ្យា", trainer: "លោកគ្រូ យឹម វណ្ណា", room: "បន្ទប់ ១០១" },
            { period: "09:15 - 10:45", subject: "បច្ចេកវិទ្យាព័ត៌មានក្នុងការអប់រំ (ICT)", trainer: "លោកគ្រូ ស៊ុយ សូលីដា", room: "បន្ទប់កុំព្យូទ័រ" }
          ]
        },
        {
          day: "ពុធ (Wednesday)",
          slots: [
            { period: "07:30 - 09:00", subject: "ការស្រាវជ្រាវសកម្មភាពក្នុងថ្នាក់", trainer: "សាស្ត្រាចារ្យ ហេង សំណាង", room: "បន្ទប់ ១០១" },
            { period: "09:15 - 10:45", subject: "វិធីសាស្ត្របង្រៀនភាសាខ្មែរ", trainer: "លោកស្រី ជា រចនា", room: "បន្ទប់ ១០១" }
          ]
        },
        {
          day: "ព្រហស្បតិ៍ (Thursday)",
          slots: [
            { period: "07:30 - 10:45", subject: "ការចុះកម្មសិក្សាគរុកោសល្យ (Practicum)", trainer: "លោកគ្រូ យឹម វណ្ណា", room: "សាលាបឋមអនុវត្ត" }
          ]
        },
        {
          day: "សុក្រ (Friday)",
          slots: [
            { period: "07:30 - 09:00", subject: "វិធីសាស្ត្របង្រៀនគណិតវិទ្យា", trainer: "លោកគ្រូ យឹម វណ្ណា", room: "បន្ទប់ ១០១" },
            { period: "09:15 - 10:45", subject: "កិច្ចការគរុកោសល្យ និងតាក់តែងកិច្ចតែងការ", trainer: "សាស្ត្រាចារ្យ ហេង សំណាង", room: "បន្ទប់ ១០១" }
          ]
        }
      ]
    }
  ],

  // Profile Update Requests (from Trainees pending Admin Approval)
    // Profile Update Requests - Starts completely empty
  profileRequests: [],

  // Library Management (បណ្ណាល័យ Management as shown on central screen)
  library: {
    totalBooks: 1485,
    issuedBooks: 124,
    returnedBooks: 110,
    availableBooks: 1361,
    recentBorrows: [
      { id: "BK-3065", title: "សុខភាពនៅក្នុងដៃរបស់យើង សម្រាប់វិទ្យាសាស្ត្រជីវវិទ្យា", borrower: "សុខ ចិន្តា", date: "2026-11-15", returnDate: "2026-11-22", status: "borrowed" },
      { id: "BK-5646", title: "សៀវភៅជំនួយភាសាខ្មែរ ថ្នាក់ទី៣", borrower: "ចាន់ វាសនា", date: "2026-11-14", returnDate: "2026-11-21", status: "borrowed" },
      { id: "BK-3109", title: "សិល្បៈចម្លាក់ស្បែក", borrower: "កែវ ពិសិដ្ឋ", date: "2026-11-10", returnDate: "2026-11-16", status: "returned" }
    ]
  },

  // Daily Attendance Statistics (for Module 3 Bar Chart)
  dailyAttendanceStats: [
    { day: "ចន្ទ", fullDay: "ចន្ទ (Mon)", present: 96, absent: 2, permission: 2, late: 1 },
    { day: "អង្គារ", fullDay: "អង្គារ (Tue)", present: 98, absent: 1, permission: 1, late: 0 },
    { day: "ពុធ", fullDay: "ពុធ (Wed)", present: 93, absent: 4, permission: 3, late: 2 },
    { day: "ព្រហស្បតិ៍", fullDay: "ព្រហស្បតិ៍ (Thu)", present: 97, absent: 1, permission: 2, late: 1 },
    { day: "សុក្រ", fullDay: "សុក្រ (Fri)", present: 95, absent: 2, permission: 3, late: 2 }
  ],

  // Grade Distribution (for Module 4 Donut Chart)
  gradeDistribution: {
    A: { count: 18, pct: 41, color: '#3b82f6' },
    B: { count: 11, pct: 25, color: '#f97316' },
    C: { count: 7, pct: 16, color: '#eab308' },
    D: { count: 4, pct: 9, color: '#8b5cf6' },
    E: { count: 3, pct: 6, color: '#06b6d4' },
    F: { count: 1, pct: 3, color: '#ef4444' }
  }
};

// Export for browser & Node
if (typeof window !== 'undefined') {
  window.KTPTTC_INITIAL_DATA = KTPTTC_INITIAL_DATA;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KTPTTC_INITIAL_DATA;
}
