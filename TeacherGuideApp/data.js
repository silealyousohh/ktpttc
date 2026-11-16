/**
 * KruSmart - Teacher Digital Guide & Classroom Management System
 * Mock & Seed Data for Cambodian Schools (MoEYS Standard)
 */

const DEFAULT_KRUSMART_DATA = {
  currentTeacher: {
    nameKh: "ស៊ុយ សូលីដា",
    nameEn: "Suy Solida",
    email: "sileal.yousohh@gmail.com",
    role: "គ្រូបង្រៀន និងប្រធានថ្នាក់",
    schoolKh: "វិទ្យាស្ថានគរុកោសល្យរាជធានីភ្នំពេញ (PTEC)",
    schoolEn: "Phnom Penh Teacher Education College",
    schoolAlt: "សាលាគរុកោសល្យ និងវិក្រឹតការខេត្តក្រចេះ (KTPTTC)",
    academicYear: "២០២៥ - ២០២៦",
    assignedClass: "ថ្នាក់ទី ៧ក",
    isPremium: true
  },

  classes: [
    { id: "7a", name: "ថ្នាក់ទី ៧ក", room: "បន្ទប់ ២០១", studentCount: 0, shifts: "ព្រឹក" },
    { id: "7b", name: "ថ្នាក់ទី ៧ខ", room: "បន្ទប់ ២០២", studentCount: 0, shifts: "ព្រឹក" },
    { id: "8a", name: "ថ្នាក់ទី ៨ក", room: "បន្ទប់ ៣០១", studentCount: 0, shifts: "រសៀល" }
  ],

  subjects: [
    { code: "KH", name: "ភាសាខ្មែរ", coeff: 2, max: 100 },
    { code: "MATH", name: "គណិតវិទ្យា", coeff: 2, max: 100 },
    { code: "PHY", name: "រូបវិទ្យា", coeff: 1, max: 50 },
    { code: "CHEM", name: "គីមីវិទ្យា", coeff: 1, max: 50 },
    { code: "BIO", name: "ជីវវិទ្យា", coeff: 1, max: 50 },
    { code: "HIST", name: "ប្រវត្តិវិទ្យា", coeff: 1, max: 50 },
    { code: "GEO", name: "ភូមិវិទ្យា", coeff: 1, max: 50 },
    { code: "ENG", name: "ភាសាអង់គ្លេស", coeff: 1, max: 50 },
    { code: "MOR", name: "សីលធម៌-ពលរដ្ឋ", coeff: 1, max: 50 }
  ],

  // បញ្ជីសិស្សចាប់ផ្ដើមទទេរ (ទុកឱ្យលោកគ្រូ-អ្នកគ្រូជាអ្នកបញ្ចូលរៀងៗខ្លួន)
  students: [],

  timetable: [
    { period: 1, time: "07:00 - 07:45", mon: "ភាសាខ្មែរ", tue: "គណិតវិទ្យា", wed: "រូបវិទ្យា", thu: "ភាសាខ្មែរ", fri: "គណិតវិទ្យា", sat: "ជីវវិទ្យា" },
    { period: 2, time: "07:50 - 08:35", mon: "ភាសាខ្មែរ", tue: "គណិតវិទ្យា", wed: "គីមីវិទ្យា", thu: "ភាសាខ្មែរ", fri: "ភាសាអង់គ្លេស", sat: "ប្រវត្តិវិទ្យា" },
    { period: 3, time: "08:50 - 09:35", mon: "គណិតវិទ្យា", tue: "ភាសាខ្មែរ", wed: "ជីវវិទ្យា", thu: "រូបវិទ្យា", fri: "ប្រវត្តិវិទ្យា", sat: "ភូមិវិទ្យា" },
    { period: 4, time: "09:40 - 10:25", mon: "ភាសាអង់គ្លេស", tue: "រូបវិទ្យា", wed: "ប្រវត្តិវិទ្យា", thu: "គីមីវិទ្យា", fri: "ភូមិវិទ្យា", sat: "សីលធម៌" },
    { period: 5, time: "10:30 - 11:15", mon: "សីលធម៌", tue: "ភូមិវិទ្យា", wed: "ភាសាអង់គ្លេស", thu: "សីលធម៌", fri: "កីឡា/សិល្បៈ", sat: "រដ្ឋបាលថ្នាក់" }
  ],

  curriculumBooks: [
    { title: "សៀវភៅណែនាំគ្រូ គណិតវិទ្យា ថ្នាក់ទី៧", grade: "ថ្នាក់ទី៧", subject: "គណិតវិទ្យា", pages: 184, code: "TG-MATH7", link: "#" },
    { title: "សៀវភៅសិក្សាគោល ភាសាខ្មែរ ថ្នាក់ទី៧ (ភាគ១)", grade: "ថ្នាក់ទី៧", subject: "ភាសាខ្មែរ", pages: 210, code: "TB-KH7-1", link: "#" },
    { title: "សៀវភៅណែនាំគ្រូ វិទ្យាសាស្ត្រ ថ្នាក់ទី៧", grade: "ថ្នាក់ទី៧", subject: "វិទ្យាសាស្ត្រ", pages: 160, code: "TG-SCI7", link: "#" },
    { title: "សៀវភៅសិក្សាគោល រូបវិទ្យា និងគីមីវិទ្យា ថ្នាក់ទី៨", grade: "ថ្នាក់ទី៨", subject: "រូប-គីមី", pages: 198, code: "TB-PC8", link: "#" },
    { title: "វិធីសាស្ត្របង្រៀនតាមបែបសកម្ម (Active Learning Guide)", grade: "គ្រូបង្រៀន", subject: "គរុកោសល្យ", pages: 120, code: "PTEC-AL", link: "#" },
    { title: "សៀវភៅណែនាំការស្រាវជ្រាវសកម្មភាពក្នុងថ្នាក់រៀន (Action Research)", grade: "គរុនិស្សិត", subject: "ស្រាវជ្រាវ", pages: 145, code: "AR-2026", link: "#" }
  ],

  sampleExams: [
    { title: "វិញ្ញាសាប្រឡងឆមាសទី១ គណិតវិទ្យា ថ្នាក់ទី៧", subject: "គណិតវិទ្យា", year: "២០២៥", duration: "៩០ នាទី", code: "EX-M7-S1" },
    { title: "វិញ្ញាសាប្រឡងឆមាសទី១ ភាសាខ្មែរ ថ្នាក់ទី៧", subject: "ភាសាខ្មែរ", year: "២០២៥", duration: "៩០ នាទី", code: "EX-K7-S1" },
    { title: "វិញ្ញាសាប្រឡងខែវិច្ឆិកា រូបវិទ្យា ថ្នាក់ទី៧", subject: "រូបវិទ្យា", year: "២០២៥", duration: "៤៥ នាទី", code: "EX-P7-NOV" },
    { title: "វិញ្ញាសាប្រឡងខែវិច្ឆិកា ជីវវិទ្យា ថ្នាក់ទី៧", subject: "ជីវវិទ្យា", year: "២០២៥", duration: "៤៥ នាទី", code: "EX-B7-NOV" },
    { title: "វិញ្ញាសាតេស្តសមត្ថភាពដើមឆ្នាំ ភាសាអង់គ្លេស", subject: "ភាសាអង់គ្លេស", year: "២០២៥", duration: "៦០ នាទី", code: "EX-ENG-DIAG" }
  ],

  inventory: [
    { item: "តុសិស្សបង់វែង (គូ)", total: 16, good: 15, needsRepair: 1, location: "បន្ទប់ ២០១" },
    { item: "កៅអីសិស្សឈើ", total: 32, good: 30, needsRepair: 2, location: "បន្ទប់ ២០១" },
    { item: "តុគ្រូបង្រៀន", total: 1, good: 1, needsRepair: 0, location: "មុខថ្នាក់" },
    { item: "កៅអីគ្រូបង្រៀន (មានពូក)", total: 1, good: 1, needsRepair: 0, location: "មុខថ្នាក់" },
    { item: "ក្ដារខៀនសរសើរសញ្ញាស (Whiteboard)", total: 1, good: 1, needsRepair: 0, location: "មុខថ្នាក់" },
    { item: "កង្ហារពិដាន (Ceiling Fan)", total: 4, good: 4, needsRepair: 0, location: "ពិដាន" },
    { item: "អំពូលភ្លើង LED", total: 6, good: 5, needsRepair: 1, location: "ពិដាន" },
    { item: "ទូដែកដាក់ឯកសារថ្នាក់", total: 1, good: 1, needsRepair: 0, location: "កែងខាងក្រោយ" }
  ],

  announcements: [
    { id: 1, date: "2026-11-15", title: "ការប្រជុំអាណាព្យាបាលសិស្សដើមឆមាស", target: "ឪពុកម្ដាយទាំងអស់", status: "sent" },
    { id: 2, date: "2026-11-10", title: "ជូនដំណឹងអំពីកាលបរិច្ឆេទប្រឡងប្រចាំខែវិច្ឆិកា", target: "ឪពុកម្ដាយទាំងអស់", status: "sent" },
    { id: 3, date: "2026-11-01", title: "ការរំលឹកអំពីឯកសណ្ឋាន និងវិន័យសិស្ស", target: "ឪពុកម្ដាយទាំងអស់", status: "sent" }
  ]
};

// Export to window
if (typeof window !== 'undefined') {
  window.KRUSMART_DATA = DEFAULT_KRUSMART_DATA;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DEFAULT_KRUSMART_DATA;
}
