/**
 * STMS - Student & Teacher Management System (ប្រព័ន្ធគ្រប់គ្រងគរុសនិស្សិត)
 * សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ (KTPTTC - Kratie Provincial Teacher Training Center)
 * Initial Seed Data & MoEYS Standard Configurations
 */

const KTPTTC_INITIAL_DATA = {
  institution: {
    nameKh: "សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ",
    nameEn: "Kratie Provincial Teacher Training Center (KTPTTC)",
    abbreviation: "KTPTTC",
    location: "ភូមិអូរឫស្សី២ សង្កាត់អូរឫស្សី ក្រុងក្រចេះ ខេត្តក្រចេះ",
    contact: "072 971 234 / info@ktpttc.edu.kh",
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
    { code: "PRAC-107", nameKh: "ការចុះកម្មសិក្សាគរុកោសល្យនៅសាលាបឋម (Practicum)", credits: 4, trainer: "លោកគ្រូ យឹម វណ្ណា" }
  ],

  users: [
    {
      id: "USR-ADM-001",
      nameKh: "លោក ឈន ប៊ុនថន",
      nameEn: "Chhorn Bunthon",
      username: "admin",
      role: "admin", // Administrator
      roleLabel: "អ្នកគ្រប់គ្រងប្រព័ន្ធ / សិក្សាធិការ",
      email: "admin@ktpttc.edu.kh",
      avatar: "👨‍💼"
    },
    {
      id: "USR-TRN-001",
      nameKh: "សាស្ត្រាចារ្យ ហេង សំណាង",
      nameEn: "Heng Samnang",
      username: "trainer",
      role: "trainer", // Trainer / Teacher
      roleLabel: "គ្រូឧទ្ទេស / មន្ត្រីបង្រៀន",
      email: "samnang.heng@ktpttc.edu.kh",
      subject: "PED-101",
      avatar: "👨‍🏫"
    },
    {
      id: "USR-TRN-002",
      nameKh: "លោកស្រី ជា រចនា",
      nameEn: "Chea Rachana",
      username: "rachana",
      role: "trainer",
      roleLabel: "គ្រូឧទ្ទេស / មន្ត្រីបង្រៀន",
      email: "rachana.chea@ktpttc.edu.kh",
      subject: "KHM-104",
      avatar: "👩‍🏫"
    },
    {
      id: "USR-STU-001",
      nameKh: "កែវ វិសាល",
      nameEn: "Keo Visal",
      studentId: "KTPTTC-2026-12P2-001",
      username: "trainee",
      role: "trainee", // Trainee Teacher
      roleLabel: "គរុសនិស្សិត",
      email: "visal.keo@student.ktpttc.edu.kh",
      className: "ថ្នាក់បឋម ១២+២ ក្រុម ក",
      cohort: "ថ្នាក់បឋមសិក្សា ១២+២ ជំនាន់ទី ៣៤",
      avatar: "👨‍🎓"
    }
  ],

  trainees: [
    {
      id: "KTPTTC-2026-12P2-001",
      roll: 1,
      nameKh: "កែវ វិសាល",
      nameEn: "Keo Visal",
      gender: "ប្រុស",
      dob: "2005-04-12",
      age: 21,
      phone: "012 345 678",
      className: "ថ្នាក់បឋម ១២+២ ក្រុម ក",
      cohort: "ថ្នាក់បឋមសិក្សា ១២+២ ជំនាន់ទី ៣៤",
      trainingType: "12+2 (បឋមសិក្សា)",
      status: "កំពុងសិក្សា", // 'កំពុងសិក្សា', 'បញ្ចប់ការសិក្សា', 'ព្យួរការសិក្សា', 'លាឈប់'
      avatar: "👨‍🎓",
      pob: "ភូមិព្រែកកក់ ឃុំព្រែកកក់ ស្រុកក្រូចឆ្មារ ខេត្តត្បូងឃ្មុំ",
      address: "សង្កាត់ក្រចេះ ក្រុងក្រចេះ ខេត្តក្រចេះ (ស្នាក់នៅអន្តេវាសិកដ្ឋាន)",
      bacii: {
        examYear: "2024",
        rollNumber: "54210",
        center: "វិទ្យាល័យក្រចេះក្រុង",
        grade: "និទ្ទេស B"
      },
      documents: [
        { name: "សញ្ញាបត្របាក់ឌុប (BacII)", status: "verified", file: "bacii_cert.pdf" },
        { name: "អត្តសញ្ញាណប័ណ្ណសញ្ជាតិខ្មែរ (National ID)", status: "verified", file: "national_id.pdf" },
        { name: "រូបថត 4x6 ឯកសណ្ឋានគរុនិស្សិត", status: "verified", file: "photo_4x6.jpg" }
      ],
      attendanceSummary: {
        present: 44,
        permission: 2,
        late: 1,
        absent: 1,
        rate: 95.7
      },
      scores: {
        "PED-101": { homework: 9.5, attendance: 10, monthly: 28, semester: 46, total: 93.5, grade: "A", status: "published" },
        "PSY-102": { homework: 8.5, attendance: 9.5, monthly: 26, semester: 44, total: 88.0, grade: "A", status: "published" },
        "MTH-103": { homework: 9.0, attendance: 10, monthly: 27, semester: 45, total: 91.0, grade: "A", status: "published" },
        "KHM-104": { homework: 9.0, attendance: 9.0, monthly: 25, semester: 42, total: 85.0, grade: "A", status: "published" },
        "ICT-105": { homework: 10, attendance: 10, monthly: 29, semester: 48, total: 97.0, grade: "A", status: "published" }
      }
    },
    {
      id: "KTPTTC-2026-12P2-002",
      roll: 2,
      nameKh: "ចាន់ សុគន្ធា",
      nameEn: "Chan Sokunthea",
      gender: "ស្រី",
      dob: "2005-08-20",
      age: 21,
      phone: "016 789 123",
      className: "ថ្នាក់បឋម ១២+២ ក្រុម ក",
      cohort: "ថ្នាក់បឋមសិក្សា ១២+២ ជំនាន់ទី ៣៤",
      trainingType: "12+2 (បឋមសិក្សា)",
      status: "កំពុងសិក្សា",
      avatar: "👩‍🎓",
      pob: "ឃុំសំបូរ ស្រុកសំបូរ ខេត្តក្រចេះ",
      address: "ភូមិអូរឫស្សី២ សង្កាត់អូរឫស្សី ក្រុងក្រចេះ",
      bacii: {
        examYear: "2024",
        rollNumber: "54211",
        center: "វិទ្យាល័យព្រះមហាក្សត្រិយានីកុសុមៈ",
        grade: "និទ្ទេស A"
      },
      documents: [
        { name: "សញ្ញាបត្របាក់ឌុប (BacII)", status: "verified", file: "bacii_cert.pdf" },
        { name: "អត្តសញ្ញាណប័ណ្ណសញ្ជាតិខ្មែរ", status: "verified", file: "national_id.pdf" },
        { name: "រូបថត 4x6", status: "verified", file: "photo_4x6.jpg" }
      ],
      attendanceSummary: {
        present: 48,
        permission: 0,
        late: 0,
        absent: 0,
        rate: 100.0
      },
      scores: {
        "PED-101": { homework: 10, attendance: 10, monthly: 29, semester: 48, total: 97.0, grade: "A", status: "published" },
        "PSY-102": { homework: 9.5, attendance: 10, monthly: 28, semester: 47, total: 94.5, grade: "A", status: "published" },
        "MTH-103": { homework: 10, attendance: 10, monthly: 30, semester: 49, total: 99.0, grade: "A", status: "published" },
        "KHM-104": { homework: 9.5, attendance: 10, monthly: 28, semester: 46, total: 93.5, grade: "A", status: "published" },
        "ICT-105": { homework: 10, attendance: 10, monthly: 29, semester: 49, total: 98.0, grade: "A", status: "published" }
      }
    },
    {
      id: "KTPTTC-2026-12P2-003",
      roll: 3,
      nameKh: "ជា ពិសិដ្ឋ",
      nameEn: "Chea Piseth",
      gender: "ប្រុស",
      dob: "2004-11-15",
      age: 22,
      phone: "097 555 1234",
      className: "ថ្នាក់បឋម ១២+២ ក្រុម ក",
      cohort: "ថ្នាក់បឋមសិក្សា ១២+២ ជំនាន់ទី ៣៤",
      trainingType: "12+2 (បឋមសិក្សា)",
      status: "កំពុងសិក្សា",
      avatar: "👨‍🎓",
      pob: "ឃុំឆ្លូង ស្រុកឆ្លូង ខេត្តក្រចេះ",
      address: "ក្រុងក្រចេះ ខេត្តក្រចេះ",
      bacii: {
        examYear: "2023",
        rollNumber: "38910",
        center: "វិទ្យាល័យឆ្លូង",
        grade: "និទ្ទេស C"
      },
      documents: [
        { name: "សញ្ញាបត្របាក់ឌុប (BacII)", status: "verified", file: "bacii_cert.pdf" }
      ],
      attendanceSummary: {
        present: 41,
        permission: 2,
        late: 1,
        absent: 4, // > 3 unexcused absences (Triggers Disciplinary Alert!)
        rate: 85.4
      },
      scores: {
        "PED-101": { homework: 7.5, attendance: 7.0, monthly: 22, semester: 36, total: 72.5, grade: "C", status: "published" },
        "PSY-102": { homework: 8.0, attendance: 8.0, monthly: 23, semester: 38, total: 77.0, grade: "B", status: "published" },
        "MTH-103": { homework: 7.0, attendance: 7.5, monthly: 20, semester: 35, total: 69.5, grade: "C", status: "published" },
        "KHM-104": { homework: 7.5, attendance: 7.5, monthly: 21, semester: 37, total: 73.0, grade: "C", status: "published" },
        "ICT-105": { homework: 8.5, attendance: 8.0, monthly: 24, semester: 40, total: 80.5, grade: "B", status: "published" }
      }
    },
    {
      id: "KTPTTC-2026-12P2-004",
      roll: 4,
      nameKh: "ឈុន ស្រីពេជ្រ",
      nameEn: "Chhun Sreypech",
      gender: "ស្រី",
      dob: "2005-02-18",
      age: 21,
      phone: "092 888 777",
      className: "ថ្នាក់បឋម ១២+២ ក្រុម ក",
      cohort: "ថ្នាក់បឋមសិក្សា ១២+២ ជំនាន់ទី ៣៤",
      trainingType: "12+2 (បឋមសិក្សា)",
      status: "កំពុងសិក្សា",
      avatar: "👩‍🎓",
      pob: "ឃុំស្នួល ស្រុកស្នួល ខេត្តក្រចេះ",
      address: "អន្តេវាសិកដ្ឋាន KTPTTC",
      bacii: {
        examYear: "2024",
        rollNumber: "54289",
        center: "វិទ្យាល័យស្នួល",
        grade: "និទ្ទេស B"
      },
      documents: [
        { name: "សញ្ញាបត្របាក់ឌុប (BacII)", status: "verified", file: "bacii_cert.pdf" }
      ],
      attendanceSummary: {
        present: 46,
        permission: 1,
        late: 1,
        absent: 0,
        rate: 97.9
      },
      scores: {
        "PED-101": { homework: 9.0, attendance: 9.5, monthly: 27, semester: 45, total: 90.5, grade: "A", status: "published" },
        "PSY-102": { homework: 9.0, attendance: 9.5, monthly: 26, semester: 43, total: 87.5, grade: "A", status: "published" }
      }
    },
    {
      id: "KTPTTC-2026-12P2-005",
      roll: 5,
      nameKh: "ដួង រិទ្ធី",
      nameEn: "Duong Rithy",
      gender: "ប្រុស",
      dob: "2004-09-30",
      age: 22,
      phone: "070 333 222",
      className: "ថ្នាក់បឋម ១២+២ ក្រុម ក",
      cohort: "ថ្នាក់បឋមសិក្សា ១២+២ ជំនាន់ទី ៣៤",
      trainingType: "12+2 (បឋមសិក្សា)",
      status: "កំពុងសិក្សា",
      avatar: "👨‍🎓",
      pob: "ស្រុកព្រែកប្រសព្វ ខេត្តក្រចេះ",
      address: "ក្រុងក្រចេះ",
      bacii: {
        examYear: "2023",
        rollNumber: "38920",
        center: "វិទ្យាល័យព្រែកប្រសព្វ",
        grade: "និទ្ទេស C"
      },
      documents: [],
      attendanceSummary: {
        present: 40,
        permission: 3,
        late: 0,
        absent: 5, // > 3 unexcused (Triggers alert!)
        rate: 83.3
      },
      scores: {
        "PED-101": { homework: 6.5, attendance: 6.5, monthly: 18, semester: 30, total: 61.0, grade: "D", status: "published" },
        "MTH-103": { homework: 7.0, attendance: 7.0, monthly: 19, semester: 32, total: 65.0, grade: "C", status: "published" }
      }
    },
    {
      id: "KTPTTC-2026-12P2-006",
      roll: 6,
      nameKh: "ថៃ ធីតា",
      nameEn: "Thai Thida",
      gender: "ស្រី",
      dob: "2005-12-10",
      age: 21,
      phone: "089 999 000",
      className: "ថ្នាក់បឋម ១២+២ ក្រុម ក",
      cohort: "ថ្នាក់បឋមសិក្សា ១២+២ ជំនាន់ទី ៣៤",
      trainingType: "12+2 (បឋមសិក្សា)",
      status: "កំពុងសិក្សា",
      avatar: "👩‍🎓",
      pob: "ក្រុងក្រចេះ ខេត្តក្រចេះ",
      address: "ក្រុងក្រចេះ",
      bacii: {
        examYear: "2024",
        rollNumber: "54300",
        center: "វិទ្យាល័យក្រចេះក្រុង",
        grade: "និទ្ទេស A"
      },
      documents: [
        { name: "សញ្ញាបត្របាក់ឌុប (BacII)", status: "verified", file: "bacii_cert.pdf" }
      ],
      attendanceSummary: {
        present: 48,
        permission: 0,
        late: 0,
        absent: 0,
        rate: 100.0
      },
      scores: {
        "PED-101": { homework: 9.8, attendance: 10, monthly: 29, semester: 47, total: 95.8, grade: "A", status: "published" }
      }
    }
  ],

  // Attendance Records Log
  attendanceSessions: [
    {
      id: "ATT-20261116-01",
      date: "2026-11-16",
      className: "ថ្នាក់បឋម ១២+២ ក្រុម ក",
      subjectCode: "PED-101",
      subjectName: "គរុកោសល្យទូទៅ និងវិធីសាស្ត្របង្រៀន",
      trainerName: "សាស្ត្រាចារ្យ ហេង សំណាង",
      period: "07:30 - 09:00",
      room: "បន្ទប់ ១០១",
      records: {
        "KTPTTC-2026-12P2-001": "present",
        "KTPTTC-2026-12P2-002": "present",
        "KTPTTC-2026-12P2-003": "late",
        "KTPTTC-2026-12P2-004": "present",
        "KTPTTC-2026-12P2-005": "absent",
        "KTPTTC-2026-12P2-006": "present"
      }
    }
  ],

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
  profileRequests: [
    {
      id: "REQ-001",
      studentId: "KTPTTC-2026-12P2-003",
      studentName: "ជា ពិសិដ្ឋ",
      field: "លេខទូរស័ព្ទ (Phone)",
      oldValue: "097 555 1234",
      newValue: "097 777 9999",
      reason: "បាត់ស៊ីមចាស់ បានប្តូរស៊ីមទូរស័ព្ទថ្មី",
      status: "pending", // 'pending', 'approved', 'rejected'
      requestedAt: "2026-11-15T10:30:00Z"
    }
  ]
};

// Export for browser & Node
if (typeof window !== 'undefined') {
  window.KTPTTC_INITIAL_DATA = KTPTTC_INITIAL_DATA;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KTPTTC_INITIAL_DATA;
}
