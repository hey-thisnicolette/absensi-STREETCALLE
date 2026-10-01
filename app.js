// ============================================================
// FIREBASE SETUP (Firestore sebagai database utama)
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, deleteDoc,
  onSnapshot, addDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBEy26oiBLfgedF8QWx6W3ISYngNVZGw7M",
  authDomain: "street-calle-15ece.firebaseapp.com",
  projectId: "street-calle-15ece",
  storageBucket: "street-calle-15ece.firebasestorage.app",
  messagingSenderId: "739761420422",
  appId: "1:739761420422:web:0072bac66146d6c8447907"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const employeesCollection = collection(db, "employees");
const attendanceCollection = collection(db, "attendanceLogs");

// ============================================================
// STATE (data selalu diambil live dari Firestore, bukan hardcode lagi)
// ============================================================
let employeesList = [];
let selectedEmployee = null;
let isAdminLoggedIn = false;
let attendanceLogs = [];

document.addEventListener('DOMContentLoaded', () => {
  initFirestoreListeners();
  initTimeChecker();

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const container = document.getElementById('employeeDropdown');
    const input = document.getElementById('employeeSearchInput');
    if (container && input && !container.contains(e.target) && e.target !== input) {
      container.classList.add('hidden');
    }
  });
});

// LISTENER REAL-TIME KE FIRESTORE
// Setiap ada perubahan data admin/absensi (dari perangkat manapun),
// semua tampilan di semua perangkat langsung ter-update otomatis.
function initFirestoreListeners() {
  const employeesQuery = query(employeesCollection, orderBy("name"));
  onSnapshot(employeesQuery, (snapshot) => {
    employeesList = snapshot.docs.map(d => d.data());
    refreshAllDataViews();
  }, (error) => {
    console.error("Firestore employees error:", error);
    showToast('error', 'Gagal Memuat Data Admin', 'Tidak bisa terhubung ke database. Periksa koneksi internet Anda.');
  });

  const attendanceQuery = query(attendanceCollection, orderBy("timestamp", "desc"));
  onSnapshot(attendanceQuery, (snapshot) => {
    attendanceLogs = snapshot.docs.map(d => d.data());
    refreshAllDataViews();
  }, (error) => {
    console.error("Firestore attendance error:", error);
    showToast('error', 'Gagal Memuat Data Absensi', 'Tidak bisa terhubung ke database. Periksa koneksi internet Anda.');
  });
}

// FUNGSI UTAMA SINKRONISASI TAMPILAN
function refreshAllDataViews() {
  renderDropdownOptions(employeesList);
  renderMemberTable();
  renderUnattendedEmployees();
  updateStats();
}

// TIME VALIDATION SYSTEM (08:00 - 22:00 WIB)
function initTimeChecker() {
  checkTimeWindow();
  setInterval(checkTimeWindow, 1000);
}

function checkTimeWindow() {
  const now = new Date();
  const currentHour = now.getHours();

  const isWithinHours = currentHour >= 8 && currentHour < 22;

  const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '.') + " WIB";
  const clockDisplay = document.getElementById('currentTimeDisplay');
  if (clockDisplay) clockDisplay.textContent = timeString;

  const banner = document.getElementById('statusBanner');
  const dot = document.getElementById('statusDot');
  const badgeText = document.getElementById('statusBadgeText');
  const warningAlert = document.getElementById('timeWarningAlert');

  if (isWithinHours) {
    if (banner) banner.className = "bg-emerald-50 border-b border-emerald-100 px-4 py-2 text-center transition-all duration-300";
    if (dot) dot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
    if (badgeText) {
      badgeText.textContent = "Status Absen: BUKA (08:00 - 22:00 WIB)";
      badgeText.className = "text-emerald-800 text-[11px] font-bold";
    }
    if (warningAlert) warningAlert.classList.add('hidden');
  } else {
    if (banner) banner.className = "bg-rose-50 border-b border-rose-100 px-4 py-2 text-center transition-all duration-300";
    if (dot) dot.className = "w-2 h-2 rounded-full bg-rose-500";
    if (badgeText) {
      badgeText.textContent = "Status Absen: TUTUP (08:00 - 22:00 WIB)";
      badgeText.className = "text-rose-800 text-[11px] font-bold";
    }
    if (warningAlert) warningAlert.classList.remove('hidden');
  }

  validateSubmitButton(isWithinHours);
}

function validateSubmitButton(isWithinHours = true) {
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    if (selectedEmployee && isWithinHours) {
      submitBtn.disabled = false;
    } else {
      submitBtn.disabled = true;
    }
  }
}

// DROPDOWN SELECTION & FILTER
function renderDropdownOptions(list) {
  const dropdown = document.getElementById('employeeDropdown');
  if (!dropdown) return;
  dropdown.innerHTML = '';

  if (list.length === 0) {
    dropdown.innerHTML = `<div class="p-2.5 text-[11px] text-slate-400 text-center">Data member tidak ditemukan</div>`;
    return;
  }

  list.forEach(emp => {
    const item = document.createElement('div');
    item.className = "p-2.5 hover:bg-burgundy-50 cursor-pointer transition text-[11px] flex items-center justify-between";
    item.innerHTML = `
      <span class="font-bold text-slate-800">${emp.id} - ${emp.name}</span>
      <span class="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">${emp.division}</span>
    `;
    item.onclick = () => selectEmployee(emp);
    dropdown.appendChild(item);
  });
}

function showDropdown() {
  filterEmployees();
  document.getElementById('employeeDropdown').classList.remove('hidden');
}

function filterEmployees() {
  const inputElem = document.getElementById('employeeSearchInput');
  const query = inputElem ? inputElem.value.toLowerCase() : '';
  const filtered = employeesList.filter(e =>
    e.id.toLowerCase().includes(query) ||
    e.name.toLowerCase().includes(query)
  );
  renderDropdownOptions(filtered);
}

function selectEmployee(emp) {
  selectedEmployee = emp;
  document.getElementById('employeeSearchInput').value = `${emp.id} - ${emp.name}`;
  document.getElementById('employeeDropdown').classList.add('hidden');
  document.getElementById('clearSearchBtn').classList.remove('hidden');

  document.getElementById('cardKode').textContent = emp.id;
  document.getElementById('cardNama').textContent = emp.name;
  document.getElementById('cardDivisi').textContent = emp.division;
  document.getElementById('cardUsername').textContent = `@${emp.username}`;
  document.getElementById('selectedEmployeeCard').classList.remove('hidden');

  checkTimeWindow();
}

function clearEmployeeSelection() {
  selectedEmployee = null;
  document.getElementById('employeeSearchInput').value = '';
  document.getElementById('clearSearchBtn').classList.add('hidden');
  document.getElementById('selectedEmployeeCard').classList.add('hidden');
  renderDropdownOptions(employeesList);
  checkTimeWindow();
}

// FORM SUBMISSION (ABSEN) -> tersimpan langsung ke Firestore
async function handleAttendanceSubmit(e) {
  e.preventDefault();

  const now = new Date();
  const currentHour = now.getHours();

  if (currentHour < 8 || currentHour >= 22) {
    showToast('warning', 'Absensi Ditolak', 'Absensi ditolak karena berada di luar jam operasional (08:00 - 22:00 WIB).');
    return;
  }

  if (!selectedEmployee) return;

  const dateStr = now.toISOString().split('T')[0];

  const sudahAbsenHariIni = attendanceLogs.some(
    (log) => log.id === selectedEmployee.id && log.tanggal === dateStr
  );

  if (sudahAbsenHariIni) {
    showToast('warning', 'Sudah Absen', `${selectedEmployee.name} sudah melakukan absensi hari ini. Tidak bisa absen dua kali dalam satu hari.`);
    return;
  }

  const timeStr = now.toLocaleTimeString('id-ID');

  const newEntry = {
    id: selectedEmployee.id,
    nama: selectedEmployee.name,
    divisi: selectedEmployee.division,
    username: selectedEmployee.username,
    tanggal: dateStr,
    jam: timeStr,
    timestamp: now.getTime()
  };

  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.disabled = true;

  try {
    await addDoc(attendanceCollection, newEntry);
    showToast('success', 'Absensi Berhasil', `Terima kasih ${selectedEmployee.name}. Data presensi Anda telah tercatat.`);
    clearEmployeeSelection();
  } catch (err) {
    console.error(err);
    showToast('error', 'Absensi Gagal', 'Tidak bisa menyimpan data. Periksa koneksi internet Anda lalu coba lagi.');
    validateSubmitButton(true);
  }
}

// ADMIN TAB SWITCHING
function switchAdminTab(tabIndex) {
  for (let i = 1; i <= 2; i++) {
    const content = document.getElementById(`tabContent${i}`);
    const sideNav = document.getElementById(`sideNav${i}`);

    if (content) {
      if (i === tabIndex) {
        content.classList.remove('hidden');
        if (sideNav) sideNav.className = "w-full px-3.5 py-2.5 rounded-lg text-left font-bold text-xs bg-white/15 text-white flex items-center space-x-2.5 transition shadow-sm";
      } else {
        content.classList.add('hidden');
        if (sideNav) sideNav.className = "w-full px-3.5 py-2.5 rounded-lg text-left font-semibold text-xs text-burgundy-100 hover:bg-white/10 flex items-center space-x-2.5 transition";
      }
    }
  }
}

// RENDER UNATTENDED EMPLOYEES
function renderUnattendedEmployees() {
  const container = document.getElementById('unattendedContainer');
  const badgeCount = document.getElementById('unattendedBadgeCount');
  if (!container || !badgeCount) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const attendedIdsToday = attendanceLogs
    .filter(item => item.tanggal === todayStr)
    .map(item => item.id);

  const unattended = employeesList.filter(emp => !attendedIdsToday.includes(emp.id));

  badgeCount.textContent = `${unattended.length} Karyawan`;
  container.innerHTML = '';

  if (unattended.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-center text-xs font-bold">
        <i class="fa-solid fa-circle-check text-sm mr-1"></i> Semua karyawan sudah melakukan absensi hari ini.
      </div>
    `;
    return;
  }

  unattended.forEach(emp => {
    const card = document.createElement('div');
    card.className = "p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between";
    card.innerHTML = `
      <div>
        <div class="flex items-center space-x-1.5">
          <span class="font-mono text-[9px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">${emp.id}</span>
          <h4 class="font-bold text-slate-800 text-xs">${emp.name}</h4>
        </div>
        <p class="text-[10px] text-slate-500 mt-0.5">${emp.division} • <span class="font-mono">@${emp.username}</span></p>
      </div>
      <span class="text-[9px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold">Belum</span>
    `;
    container.appendChild(card);
  });
}

// MANAGE MEMBERS CRUD -> langsung ke Firestore, sinkron ke semua perangkat
function renderMemberTable() {
  const tbody = document.getElementById('memberTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (employeesList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400">Belum ada data admin. Tambahkan lewat form di atas.</td></tr>`;
    return;
  }

  employeesList.forEach(emp => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
    tr.innerHTML = `
      <td class="p-2 font-mono font-bold text-burgundy">${emp.id}</td>
      <td class="p-2 font-semibold text-slate-800">${emp.name}</td>
      <td class="p-2 text-slate-600">${emp.division}</td>
      <td class="p-2 font-mono text-slate-600">@${emp.username}</td>
      <td class="p-2 text-center space-x-1">
        <button onclick="editMember('${emp.id}')" class="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold">Edit</button>
        <button onclick="deleteMember('${emp.id}')" class="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function handleMemberFormSubmit(e) {
  e.preventDefault();

  const editId = document.getElementById('editMemberId').value;
  const kode = document.getElementById('inputKodeMember').value.trim();
  const nama = document.getElementById('inputNamaMember').value.trim();
  const divisi = document.getElementById('inputDivisiMember').value.trim();
  const username = document.getElementById('inputUsernameMember').value.trim();

  const dataMember = { id: kode, name: nama, division: divisi, username: username };

  const saveBtn = document.getElementById('saveMemberBtn');
  const originalBtnHtml = saveBtn ? saveBtn.innerHTML : '';
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = 'Menyimpan...'; }

  try {
    if (editId) {
      // Cek duplikat kode terhadap admin LAIN (selain dirinya sendiri)
      if (employeesList.some(emp => emp.id === kode && emp.id !== editId)) {
        showToast('error', 'Gagal Menyimpan', 'Kode Unik sudah digunakan oleh admin lain!');
        return;
      }
      if (editId !== kode) {
        // Kode Unik diubah -> hapus dokumen lama, buat dokumen baru dengan ID baru
        await deleteDoc(doc(db, "employees", editId));
      }
      await setDoc(doc(db, "employees", kode), dataMember);
    } else {
      if (employeesList.some(emp => emp.id === kode)) {
        showToast('error', 'Gagal Menyimpan', 'Kode Unik sudah digunakan oleh admin lain!');
        return;
      }
      await setDoc(doc(db, "employees", kode), dataMember);
    }

    resetMemberForm();
    showToast('success', 'Berhasil Disimpan', `Data admin "${nama}" berhasil disimpan dan langsung aktif di semua perangkat!`);
  } catch (err) {
    console.error(err);
    showToast('error', 'Gagal Menyimpan', 'Tidak bisa menyimpan data. Periksa koneksi internet Anda lalu coba lagi.');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = originalBtnHtml; }
  }
}

function editMember(id) {
  const emp = employeesList.find(e => e.id === id);
  if (!emp) return;

  document.getElementById('editMemberId').value = emp.id;
  document.getElementById('inputKodeMember').value = emp.id;
  document.getElementById('inputNamaMember').value = emp.name;
  document.getElementById('inputDivisiMember').value = emp.division;
  document.getElementById('inputUsernameMember').value = emp.username;

  document.getElementById('memberFormTitle').textContent = "Edit Data Admin";
  document.getElementById('saveMemberBtn').innerHTML = `<i class="fa-solid fa-floppy-disk mr-1"></i> Update Admin`;
  document.getElementById('cancelEditBtn').classList.remove('hidden');

  document.getElementById('inputKodeMember').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteMember(id) {
  const emp = employeesList.find(e => e.id === id);
  if (!emp) return;

  const confirmed = await showConfirm(
    'Hapus Data Admin?',
    `Apakah Anda yakin ingin menghapus admin "${emp.name}" dengan Kode ${id}? Tindakan ini tidak dapat dibatalkan.`
  );
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "employees", id));

    if (selectedEmployee && selectedEmployee.id === id) {
      clearEmployeeSelection();
    }

    showToast('success', 'Berhasil Dihapus', `Data admin "${emp.name}" (Kode ${id}) telah dihapus.`);
  } catch (err) {
    console.error(err);
    showToast('error', 'Gagal Menghapus', 'Tidak bisa menghapus data. Periksa koneksi internet Anda lalu coba lagi.');
  }
}

function resetMemberForm() {
  document.getElementById('editMemberId').value = '';
  document.getElementById('memberForm').reset();
  document.getElementById('memberFormTitle').textContent = "Tambah Admin Baru";
  document.getElementById('saveMemberBtn').innerHTML = `<i class="fa-solid fa-plus mr-1"></i> Simpan Admin`;
  document.getElementById('cancelEditBtn').classList.add('hidden');
}

// ADMIN AUTHENTICATION
function openAdminModal() {
  document.getElementById('adminModal').classList.remove('hidden');
}

function closeAdminModal() {
  document.getElementById('adminModal').classList.add('hidden');
}

function verifyAdminPin() {
  const pin = document.getElementById('adminPinInput').value;
  if (pin === "admin123") {
    isAdminLoggedIn = true;
    closeAdminModal();
    document.getElementById('employeeSection').classList.add('hidden');
    document.getElementById('adminSection').classList.remove('hidden');
    document.getElementById('adminPortalBtn').classList.add('hidden');
    document.getElementById('adminLogoutBtn').classList.remove('hidden');
    switchAdminTab(1);
    refreshAllDataViews();
  } else {
    showToast('error', 'PIN Salah', 'PIN Admin yang Anda masukkan salah. Silakan coba lagi.');
  }
}

function logoutAdmin() {
  isAdminLoggedIn = false;
  document.getElementById('adminSection').classList.add('hidden');
  document.getElementById('employeeSection').classList.remove('hidden');
  document.getElementById('adminPortalBtn').classList.remove('hidden');
  document.getElementById('adminLogoutBtn').classList.add('hidden');

  refreshAllDataViews();
}

// STATS CALCULATION
function updateStats() {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = attendanceLogs.filter(i => i.tanggal === todayStr).length;

  const attendedIdsToday = attendanceLogs
    .filter(item => item.tanggal === todayStr)
    .map(item => item.id);

  const unattendedCount = employeesList.filter(emp => !attendedIdsToday.includes(emp.id)).length;

  const statTotal = document.getElementById('statTotal');
  const statToday = document.getElementById('statToday');
  const statUnattended = document.getElementById('statUnattended');
  const statEmployees = document.getElementById('statEmployees');

  if (statTotal) statTotal.textContent = attendanceLogs.length;
  if (statToday) statToday.textContent = todayCount;
  if (statUnattended) statUnattended.textContent = unattendedCount;
  if (statEmployees) statEmployees.textContent = employeesList.length;
}

// POPUP CONFIRM (PENGGANTI confirm() BAWAAN BROWSER)
// Mengembalikan Promise<boolean> - true jika user klik "Ya, Hapus", false jika Batal
function showConfirm(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    if (!modal || !titleEl || !messageEl || !okBtn || !cancelBtn) {
      // Fallback kalau markup modal tidak ditemukan
      resolve(window.confirm(message));
      return;
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.classList.remove('hidden');

    const cleanup = (result) => {
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

// POPUP TOAST NOTIFICATION (SUCCESS / ERROR / WARNING)
function showToast(type, title, message) {
  const modal = document.getElementById('toastModal');
  const iconBg = document.getElementById('toastIconBg');
  const icon = document.getElementById('toastIcon');
  const titleEl = document.getElementById('toastTitle');
  const messageEl = document.getElementById('toastMessage');
  const btn = document.getElementById('toastBtn');

  if (!modal || !iconBg || !icon || !titleEl || !messageEl || !btn) return;

  const variants = {
    success: {
      iconBgClass: 'w-14 h-14 rounded-full flex items-center justify-center mx-auto shadow-inner bg-emerald-100',
      iconClass: 'fa-solid fa-circle-check text-2xl text-emerald-600',
      btnClass: 'w-full py-2.5 font-bold rounded-xl text-xs text-white shadow-md transition bg-emerald-600 hover:bg-emerald-700'
    },
    error: {
      iconBgClass: 'w-14 h-14 rounded-full flex items-center justify-center mx-auto shadow-inner bg-rose-100',
      iconClass: 'fa-solid fa-circle-xmark text-2xl text-rose-600',
      btnClass: 'w-full py-2.5 font-bold rounded-xl text-xs text-white shadow-md transition bg-rose-600 hover:bg-rose-700'
    },
    warning: {
      iconBgClass: 'w-14 h-14 rounded-full flex items-center justify-center mx-auto shadow-inner bg-amber-100',
      iconClass: 'fa-solid fa-triangle-exclamation text-2xl text-amber-600',
      btnClass: 'w-full py-2.5 font-bold rounded-xl text-xs text-white shadow-md transition bg-amber-500 hover:bg-amber-600'
    }
  };

  const style = variants[type] || variants.success;

  iconBg.className = style.iconBgClass;
  icon.className = style.iconClass;
  btn.className = style.btnClass;
  titleEl.textContent = title;
  messageEl.textContent = message;

  modal.classList.remove('hidden');
}

function closeToastModal() {
  const modal = document.getElementById('toastModal');
  if (modal) modal.classList.add('hidden');
}

// ============================================================
// EXPOSE FUNGSI KE GLOBAL SCOPE
// (wajib karena app.js sekarang pakai ES Module untuk Firebase,
// sementara index.html memanggil fungsi-fungsi ini lewat onclick/onchange)
// ============================================================
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.verifyAdminPin = verifyAdminPin;
window.logoutAdmin = logoutAdmin;
window.showDropdown = showDropdown;
window.filterEmployees = filterEmployees;
window.clearEmployeeSelection = clearEmployeeSelection;
window.handleAttendanceSubmit = handleAttendanceSubmit;
window.switchAdminTab = switchAdminTab;
window.handleMemberFormSubmit = handleMemberFormSubmit;
window.resetMemberForm = resetMemberForm;
window.editMember = editMember;
window.deleteMember = deleteMember;
window.closeToastModal = closeToastModal;