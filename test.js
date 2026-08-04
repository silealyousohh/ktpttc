

        function switchView(viewId, navElement) {
            document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => el.classList.remove('active'));
            navElement.classList.add('active');
            document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
            document.getElementById(viewId).classList.add('active');
            
            if (viewId === 'view-library') loadAdminBooks();
        }

        document.getElementById('adminLoginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const pwd = document.getElementById('adminPassword').value;
            const msg = document.getElementById('login-message');
            if (pwd === 'admin123' || (typeof google !== 'undefined')) {
                document.getElementById('login-view').style.display = 'none';
                document.getElementById('admin-layout').style.display = 'flex';
                initChart();
                renderCalendar();
                loadDashboardStats();
            } else {
                msg.style.display = 'block';
                msg.className = 'form-message form-message-error';
                msg.innerText = 'លេខសម្ងាត់មិនត្រឹមត្រូវទេ!';
            }
        });

        function loadDashboardStats() {
            if (typeof google !== 'undefined' && google.script) {
                google.script.run.withSuccessHandler(function(stats) {
                    if (stats) {
                        document.getElementById('stat-staff').innerText = stats.staffCount || 0;
                        document.getElementById('stat-book').innerText = stats.bookCount || 0;
                        document.getElementById('stat-msg').innerText = stats.messageCount || 0;
                        document.getElementById('stat-member').innerText = stats.memberCount || 0;
                    }
                }).getDashboardStats();
            }
        }
        
        function loadSettings() {
            if (typeof google !== 'undefined' && google.script) {
                google.script.run.withSuccessHandler(function(settings) {
                    if (settings && settings.name) {
                        document.getElementById('settingSchoolName').value = settings.name;
                    }
                }).getSchoolSettings();
            }
        }
        
        function saveNewBook(event) {
            event.preventDefault();
            const btn = event.target.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> រក្សាទុក...';
            btn.disabled = true;

            const bookData = {
                code: document.getElementById('bookCodeInput').value,
                category: document.getElementById('bookCategoryInput').value,
                title: document.getElementById('bookTitleInput').value,
                grade: document.getElementById('bookGradeInput').value,
                author: document.getElementById('bookAuthorInput').value,
                link: document.getElementById('bookUrlInput').value
            };

            if (typeof google !== 'undefined' && google.script) {
                google.script.run.withSuccessHandler(function(success) {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    if(success) {
                        alert("បានរក្សាទុកសៀវភៅថ្មីដោយជោគជ័យ!");
                        closeModal('modal-add-book');
                        document.getElementById('addBookForm').reset();
                        loadAdminBooks();
                    } else {
                        alert("មានបញ្ហាក្នុងការរក្សាទុកសៀវភៅ!");
                    }
                }).addBook(bookData);
            } else {
                // Local fallback
                setTimeout(() => {
                    alert("បានរក្សាទុកសៀវភៅថ្មីដោយជោគជ័យ! (Local Mock)");
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    closeModal('modal-add-book');
                    document.getElementById('addBookForm').reset();
                    loadAdminBooks();
                }, 1000);
            }
        }

        function loadAdminBooks() {
            const tbody = document.getElementById('admin-books-table-body');
            if (!tbody) return;
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">កំពុងទាញយកទិន្នន័យ...</td></tr>';
            
            if (typeof google !== 'undefined' && google.script) {
                google.script.run.withSuccessHandler(function(books) {
                    if (!books || books.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">មិនមានទិន្នន័យសៀវភៅទេ</td></tr>';
                        return;
                    }
                    tbody.innerHTML = books.map(b => `
                        <tr>
                            <td>${b.code}</td>
                            <td>${b.title}</td>
                            <td>${b.author || 'មិនបញ្ជាក់'}</td>
                            <td>${b.category}</td>
                            <td class="action-icons">
                                <i class="fas fa-edit" title="កែប្រែ"></i>
                                <i class="fas fa-trash" style="color:var(--danger)" title="លុប" onclick="if(confirm('តើអ្នកពិតជាចង់លុបសៀវភៅនេះមែនទេ?')) deleteAdminBook(${b.rowNum})"></i>
                            </td>
                        </tr>
                    `).join('');
                }).getBooks();
            } else {
                // Local mock
                setTimeout(() => {
                    const mockBooks = [
                        { code: 'B001', title: 'ប្រវត្តិសាស្ត្រខ្មែរ', author: 'ត្រឹង ងា', category: 'ប្រវត្តិសាស្ត្រ' },
                        { code: 'B002', title: 'គណិតវិទ្យា ថ្នាក់ទី១២', author: 'ក្រសួងអប់រំ', category: 'វិទ្យាសាស្ត្រ' }
                    ];
                    tbody.innerHTML = mockBooks.map(b => `<tr><td>${b.code}</td><td>${b.title}</td><td>${b.author}</td><td>${b.category}</td><td class="action-icons"><i class="fas fa-edit"></i><i class="fas fa-trash"></i></td></tr>`).join('');
                }, 1000);
            }
        }

        function deleteAdminBook(rowNum) {
            if (typeof google !== 'undefined' && google.script) {
                google.script.run.withSuccessHandler(function(success) {
                    if(success) loadAdminBooks();
                    else alert("មានបញ្ហាក្នុងការលុបសៀវភៅ!");
                }).deleteBookRow(rowNum);
            }
        }

        function saveSettings() {
            const name = document.getElementById('settingSchoolName').value;
            const msg = document.getElementById('save-setting-msg');
            msg.innerText = "កំពុងរក្សាទុក...";
            msg.style.display = 'inline';
            msg.style.color = 'var(--text-muted)';
            if (typeof google !== 'undefined' && google.script) {
                google.script.run.withSuccessHandler(function(success) {
                    if(success) {
                        msg.innerText = "បានរក្សាទុកជោគជ័យ!";
                        msg.style.color = 'var(--success)';
                        setTimeout(() => msg.style.display = 'none', 3000);
                    } else {
                        msg.innerText = "បរាជ័យ!";
                        msg.style.color = 'var(--danger)';
                    }
                }).saveSchoolSettings(name);
            } else {
                setTimeout(() => {
                    msg.innerText = "បានរក្សាទុក (Mock)!";
                    msg.style.color = 'var(--success)';
                    setTimeout(() => msg.style.display = 'none', 3000);
                }, 500);
            }
        }


        window.onload = function() {
            initChart();
            renderCalendar();
            loadDashboardStats();
            loadSettings();
        }

        function adminLogout() {
            document.getElementById('adminPassword').value = '';
            document.getElementById('login-message').style.display = 'none';
            document.getElementById('admin-layout').style.display = 'none';
            document.getElementById('login-view').style.display = 'flex';
        }

        function openModal(modalId, isEdit = false) { 
            const modal = document.getElementById(modalId);
            const title = modal.querySelector('.modal-header h3');
            
            if (title) {
                if (!title.dataset.original) title.dataset.original = title.innerText;
                if (isEdit) {
                    title.innerText = title.dataset.original.replace('បន្ថែម', 'កែប្រែ').replace('ថ្មី', '').replace('ផ្ញើ', 'អាន');
                } else {
                    title.innerText = title.dataset.original;
                }
            }

            if(modalId === 'modal-add-book' && !isEdit) {
                const randomCode = 'B-' + Math.floor(1000 + Math.random() * 9000);
                document.getElementById('bookCodeInput').value = randomCode;
            }
            modal.style.display = 'flex'; 
        }
        function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }
        window.onclick = function(event) { if (event.target.classList.contains('modal')) event.target.style.display = "none"; }

        // Global Event Listener for Edit and Delete actions
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('fa-trash')) {
                if (confirm('តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ? (Are you sure you want to delete this?)')) {
                    const row = e.target.closest('tr');
                    if (row) row.remove();
                }
            } else if (e.target.classList.contains('fa-edit') || e.target.classList.contains('fa-eye')) {
                const viewSection = e.target.closest('.view-section');
                if(!viewSection) return;
                
                let modalId = '';
                if (viewSection.id === 'view-library') modalId = 'modal-add-book';
                else if (viewSection.id === 'view-news') modalId = 'modal-add-news';
                else if (viewSection.id === 'view-lessons') modalId = 'modal-add-lesson';
                else if (viewSection.id === 'view-messages') modalId = 'modal-send-message';
                else if (viewSection.id === 'view-slides') modalId = 'modal-add-slide';
                else if (viewSection.id === 'view-structure') modalId = 'modal-add-structure';
                else if (viewSection.id === 'view-gallery') modalId = 'modal-add-gallery';
                
                if (modalId) {
                    openModal(modalId, true);
                    if (modalId === 'modal-add-book') {
                        const code = e.target.closest('tr').children[0].innerText;
                        document.getElementById('bookCodeInput').value = code;
                    }
                }
            }
        });

        function toggleProfileDropdown(event) {
            if(event) event.stopPropagation();
            const dropdown = document.getElementById('profileDropdown');
            const notifDropdown = document.getElementById('notificationDropdown');
            if(notifDropdown && notifDropdown.classList.contains('show')) notifDropdown.classList.remove('show');
            dropdown.classList.toggle('show');
        }

        function toggleNotificationDropdown(event) {
            if(event) event.stopPropagation();
            const notifDropdown = document.getElementById('notificationDropdown');
            const profileDropdown = document.getElementById('profileDropdown');
            if(profileDropdown && profileDropdown.classList.contains('show')) profileDropdown.classList.remove('show');
            notifDropdown.classList.toggle('show');
        }
        
        window.addEventListener('click', function(e) {
            const dropdown = document.getElementById('profileDropdown');
            const notifDropdown = document.getElementById('notificationDropdown');
            if (dropdown && dropdown.classList.contains('show')) dropdown.classList.remove('show');
            if (notifDropdown && notifDropdown.classList.contains('show')) notifDropdown.classList.remove('show');
        });

        const translations = {
            kh: {
                "dashboard": "ផ្ទាំងដើម",
                "library": "គ្រប់គ្រងបណ្ណាល័យ",
                "news": "គ្រប់គ្រងព័ត៌មាន",
                "lessons": "គ្រប់គ្រងមេរៀន",
                "messages": "គ្រប់គ្រងការផ្ញើសារ",
                "slides": "គ្រប់គ្រងស្លាយផ្សព្វផ្សាយ",
                "structure": "គ្រប់គ្រងរចនាសម្ព័ន្ធថ្នាក់សាលា",
                "gallery": "គ្រប់គ្រងរូបភាព",
                "settings": "ការកំណត់",
                "logout": "ចាកចេញ",
                "admin_title": "ផ្ទាំងគ្រប់គ្រង"
            },
            en: {
                "dashboard": "Dashboard",
                "library": "Library",
                "news": "News",
                "lessons": "Lessons",
                "messages": "Messages",
                "slides": "Slides",
                "structure": "Structure",
                "gallery": "Gallery",
                "settings": "Settings",
                "logout": "Logout",
                "admin_title": "Dashboard Menu"
            }
        };

        let currentLang = 'kh';
        function toggleLanguage() {
            currentLang = currentLang === 'kh' ? 'en' : 'kh';
            
            const langSwitch = document.getElementById('langSwitch');
            if (currentLang === 'kh') {
                langSwitch.innerHTML = '<span class="active"><img src="https://flagcdn.com/w20/kh.png" style="width: 15px; margin-right: 5px; vertical-align: middle;"></span><span>ENG</span>';
            } else {
                langSwitch.innerHTML = '<span>KH</span><span class="active">ENG</span>';
            }
            
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (translations[currentLang][key]) {
                    el.innerText = translations[currentLang][key];
                }
            });
        }

        let myChart = null;
        function initChart() {
            const ctx = document.getElementById('statsChart').getContext('2d');
            let gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(13, 110, 253, 0.4)');
            gradient.addColorStop(1, 'rgba(13, 110, 253, 0.0)');
            if(myChart) myChart.destroy();
            myChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['ចំនួនអ្នកចូលមើល', 'ចំនួនសៀវភៅ', 'ចំនួនអ្នកចូលប្រើ', 'ចំនួនសមាជិក'],
                    datasets: [{ label: 'ស្ថិតិ', data: [10, 50, 20, 30], borderColor: '#0d6efd', backgroundColor: gradient, borderWidth: 2, pointBackgroundColor: '#fff', pointBorderColor: '#0d6efd', pointBorderWidth: 2, pointRadius: 4, fill: true, tension: 0.4 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 70, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } }, x: { grid: { display: false }, border: { display: false } } } }
            });
        }

        function renderCalendar() {
            const cal = document.getElementById('calendar-days');
            let html = '';
            for(let i=0; i<3; i++) html += '<div></div>';
            for(let i=1; i<=28; i++) {
                let cls = 'cal-day';
                if(i===6) cls += ' active';
                if(i===24 || i===27) cls += ' event1';
                html += `<div class="${cls}">${i}</div>`;
            }
            html += '<div class="cal-day">29</div><div class="cal-day active">30</div>';
            cal.innerHTML = html;
        }
    