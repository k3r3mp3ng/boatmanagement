// ===========================================================
//  KONFIGURASI & GLOBAL STATE
// ===========================================================
const API_BASE = 'https://script.google.com/macros/s/AKfycbwsYSFz_OlVEF0YKEsHL_YE9vlpxWDX5eDh-bNxXg1ZF442p5L6F3ARZNA6ZMaDncQY7g/exec'; // Ganti dengan URL Web App
const USE_DEMO = !API_BASE || API_BASE.includes('YOUR_GOOGLE');

let currentUser = null;
let boats = [], trips = [], transactions = [], catches = [];

// ===========================================================
//  UTILITY FUNCTIONS
// ===========================================================
function formatCurrency(v) {
    return 'Rp ' + Number(v).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function formatDate(d) {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return isNaN(dt) ? d : dt.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}
function todayStr() { return new Date().toISOString().split('T')[0]; }
function addMonths(dateStr, m) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setMonth(d.getMonth() + m);
    return d.toISOString().split('T')[0];
}

function getStatusLabel(s) {
    const m = { 'active':'<span class="badge badge-green">Aktif</span>', 'completed':'<span class="badge badge-gray">Selesai</span>', 'cancelled':'<span class="badge badge-red">Batal</span>', 'available':'<span class="badge badge-blue">Tersedia</span>', 'in_trip':'<span class="badge badge-yellow">Dalam Trip</span>' };
    return m[s] || s;
}
function getTxnLabel(t) {
    const m = { 'income':'<span class="badge badge-green">Pemasukan</span>', 'expense':'<span class="badge badge-red">Pengeluaran</span>', 'fee':'<span class="badge badge-yellow">Biaya</span>' };
    return m[t] || t;
}
function showToast(msg, type='info') {
    const c = document.getElementById('toastContainer');
    const icons = { success:'fa-circle-check', error:'fa-circle-xmark', info:'fa-circle-info' };
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = `<i class="fas ${icons[type]||icons.info}"></i><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => { if(t.parentNode) t.remove(); }, 4000);
}
function openModal(title, html) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('active');
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('active'); }
document.getElementById('closeModal').onclick = closeModal;
document.getElementById('modalOverlay').onclick = (e) => { if(e.target===e.currentTarget) closeModal(); };

// ===========================================================
//  API CALL (Google Sheets / Demo)
// ===========================================================
async function apiCall(action, data = {}) {
    if (USE_DEMO) return demoApi(action, data);
    try {
        const resp = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...data })
        });
        const json = await resp.json();
        if (!json.success) throw new Error(json.message);
        return json.data;
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
        return null;
    }
}

// Demo Data (untuk testing tanpa API)
function demoApi(action, data) {
    loadDemo();
    switch(action) {
        case 'login': const u = [{username:'owner',password:'123456',role:'owner',name:'Owner'},{username:'admin',password:'123456',role:'admin',name:'Admin'},{username:'visitor',password:'123456',role:'visitor',name:'Visitor'}].find(x=>x.username===data.username&&x.password===data.password); return u?{user:u}:null;
        case 'getBoats': return boats;
        case 'addBoat': const nb={id:'b'+Date.now(),...data,status:'available',modal:data.modal||0}; boats.push(nb); saveDemo(); return nb;
        case 'updateBoat': const ub=boats.find(x=>x.id===data.id); if(ub){Object.assign(ub,data); saveDemo(); return ub;} return null;
        case 'deleteBoat': boats=boats.filter(x=>x.id!==data.id); saveDemo(); return true;
        case 'getTrips': return trips;
        case 'addTrip': const nt={id:'t'+Date.now(),...data,start_date:data.start_date||todayStr(),return_date:data.return_date||addMonths(data.start_date||todayStr(),1),status:'active'}; trips.push(nt); const b=boats.find(x=>x.id===data.boat_id); if(b)b.status='in_trip'; saveDemo(); return nt;
        case 'updateTrip': const ut=trips.find(x=>x.id===data.id); if(ut){Object.assign(ut,data); saveDemo(); return ut;} return null;
        case 'deleteTrip': const dt=trips.find(x=>x.id===data.id); if(dt){const bb=boats.find(x=>x.id===dt.boat_id); if(bb)bb.status='available'; trips=trips.filter(x=>x.id!==data.id); saveDemo();} return true;
        case 'getTransactions': return transactions;
        case 'addTransaction': const ntx={id:'tx'+Date.now(),...data,date:data.date||todayStr()}; transactions.push(ntx); saveDemo(); return ntx;
        case 'updateTransaction': const utx=transactions.find(x=>x.id===data.id); if(utx){Object.assign(utx,data); saveDemo(); return utx;} return null;
        case 'deleteTransaction': transactions=transactions.filter(x=>x.id!==data.id); saveDemo(); return true;
        case 'getCatches': return catches;
        case 'addCatch': const nc={id:'c'+Date.now(),...data,date:data.date||todayStr()}; catches.push(nc); saveDemo(); return nc;
        case 'getStats':
            const totalIncome = transactions.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
            const totalExpense = transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
            const totalModal = boats.reduce((s,b)=>s+Number(b.modal||0),0);
            return { totalBoats: boats.length, activeTrips: trips.filter(t=>t.status==='active').length, totalIncome, totalExpense, totalModal, profit: totalIncome - totalExpense };
        default: return null;
    }
}
function loadDemo() {
    const raw = localStorage.getItem('bmData');
    if (raw) { const d=JSON.parse(raw); boats=d.boats||[]; trips=d.trips||[]; transactions=d.transactions||[]; catches=d.catches||[]; }
    else { boats = [{id:'b1',name:'Boat A',description:'Kapal 30GT',status:'available',modal:50000000},{id:'b2',name:'Boat B',description:'Kapal 25GT',status:'available',modal:40000000}]; saveDemo(); }
}
function saveDemo() { localStorage.setItem('bmData', JSON.stringify({boats,trips,transactions,catches})); }

// ===========================================================
//  AUTH & RENDER
// ===========================================================
async function login(username, password) {
    const res = await apiCall('login', { username, password });
    if (res && res.user) { currentUser = res.user; return true; }
    return false;
}
function logout() {
    currentUser = null;
    document.getElementById('app').classList.remove('active');
    document.getElementById('loginScreen').style.display = 'flex';
}

function renderAll() {
    renderDashboard();
    renderBoats();
    renderTrips();
    renderTransactions();
    renderCatches();
    renderReports();
    updateUI();
}
function updateUI() {
    if (!currentUser) return;
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role;
    document.getElementById('roleBadge').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);

    // Sembunyikan tombol berdasarkan Role
    const isOwner = currentUser.role === 'owner';
    const isAdmin = currentUser.role === 'admin' || isOwner;
    const canEdit = isOwner || isAdmin;
    const canAddIncome = isOwner; // Hanya Owner boleh tambah pemasukan
    document.getElementById('addBoatBtn').style.display = isOwner ? 'inline-flex' : 'none';
    document.getElementById('addTripBtn').style.display = isAdmin ? 'inline-flex' : 'none';
    document.getElementById('addTxnBtn').style.display = canEdit ? 'inline-flex' : 'none';
    document.getElementById('addCatchBtn').style.display = isAdmin ? 'inline-flex' : 'none';
    // Filter tombol transaksi income/expense di modal akan diatur di JS saat klik tambah
}

// ===========================================================
//  DASHBOARD
// ===========================================================
async function renderDashboard() {
    const stats = await apiCall('getStats');
    if (stats) {
        document.getElementById('statBoats').textContent = stats.totalBoats;
        document.getElementById('statTrips').textContent = stats.activeTrips;
        document.getElementById('statIncome').textContent = formatCurrency(stats.totalIncome);
        document.getElementById('statExpense').textContent = formatCurrency(stats.totalExpense);
        document.getElementById('statCapital').textContent = formatCurrency(stats.totalModal);
        document.getElementById('statProfit').textContent = formatCurrency(stats.profit);
    }
    // Recent Trips
    const recent = trips.slice().sort((a,b)=>b.start_date.localeCompare(a.start_date)).slice(0,5);
    const container = document.getElementById('recentTripsList');
    if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state">Belum ada trip</div>';
        return;
    }
    let html = '<div class="table-scroll"><table><thead><tr><th>Kapal</th><th>Pelanggan</th><th>Mulai</th><th>Kembali</th><th>Status</th></tr></thead><tbody>';
    recent.forEach(t => {
        const b = boats.find(x=>x.id===t.boat_id);
        html += `<tr><td>${b?b.name:'—'}</td><td>${t.customer_name||'—'}</td><td>${formatDate(t.start_date)}</td><td>${formatDate(t.return_date)}</td><td>${getStatusLabel(t.status)}</td></tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// ===========================================================
//  BOATS
// ===========================================================
function renderBoats() {
    const container = document.getElementById('boatsTableWrap');
    if (boats.length === 0) { container.innerHTML = '<div class="empty-state">Belum ada kapal</div>'; return; }
    const isOwner = currentUser && currentUser.role === 'owner';
    let html = '<table><thead><tr><th>Nama</th><th>Deskripsi</th><th>Modal Awal</th><th>Status</th>'+(isOwner?'<th>Aksi</th>':'')+'</tr></thead><tbody>';
    boats.forEach(b => {
        html += `<tr><td><strong>${b.name}</strong></td><td>${b.description||'—'}</td><td>${formatCurrency(b.modal||0)}</td><td>${getStatusLabel(b.status)}</td>`;
        if (isOwner) {
            html += `<td class="actions-cell">
                <button class="btn-icon" onclick="editBoat('${b.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn-icon danger" onclick="deleteBoat('${b.id}')"><i class="fas fa-trash"></i></button>
            </td>`;
        }
        html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}
window.editBoat = function(id) {
    if (currentUser.role !== 'owner') { showToast('Hanya Owner', 'error'); return; }
    const b = boats.find(x=>x.id===id);
    openModal('Edit Kapal & Modal', `
        <div class="form-group"><label>Nama</label><input id="fBoatNameE" value="${b.name}" /></div>
        <div class="form-group"><label>Deskripsi</label><input id="fBoatDescE" value="${b.description||''}" /></div>
        <div class="form-group"><label>Modal Awal (Rp)</label><input type="number" id="fBoatModalE" value="${b.modal||0}" /></div>
        <div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Batal</button><button class="btn-primary" onclick="updateBoat('${id}')">Simpan</button></div>
    `);
};
window.updateBoat = async function(id) {
    const name = document.getElementById('fBoatNameE').value.trim();
    const modal = parseFloat(document.getElementById('fBoatModalE').value) || 0;
    const result = await apiCall('updateBoat', {id, name, description:document.getElementById('fBoatDescE').value.trim(), modal});
    if (result) { showToast('Kapal diperbarui', 'success'); closeModal(); renderAll(); }
};
window.deleteBoat = async function(id) {
    if (!confirm('Hapus kapal ini?')) return;
    await apiCall('deleteBoat', {id});
    renderAll();
};
document.getElementById('addBoatBtn').onclick = function() {
    if (currentUser.role !== 'owner') return;
    openModal('Tambah Kapal', `
        <div class="form-group"><label>Nama</label><input id="fBoatName" /></div>
        <div class="form-group"><label>Deskripsi</label><input id="fBoatDesc" /></div>
        <div class="form-group"><label>Modal Awal (Rp)</label><input type="number" id="fBoatModal" value="0" /></div>
        <div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Batal</button><button class="btn-primary" onclick="saveBoat()">Simpan</button></div>
    `);
};
window.saveBoat = async function() {
    const name = document.getElementById('fBoatName').value.trim();
    if (!name) { showToast('Nama wajib diisi', 'error'); return; }
    const result = await apiCall('addBoat', {name, description:document.getElementById('fBoatDesc').value.trim(), modal:parseFloat(document.getElementById('fBoatModal').value)||0});
    if (result) { showToast('Kapal ditambahkan', 'success'); closeModal(); renderAll(); }
};

// ===========================================================
//  TRIPS (Otomatis 1 Bulan)
// ===========================================================
function renderTrips() {
    const container = document.getElementById('tripsTableWrap');
    // Auto-update status jika return_date sudah lewat
    trips.forEach(t => {
        if (t.status === 'active' && t.return_date && t.return_date < todayStr()) {
            t.status = 'completed';
            const b = boats.find(x=>x.id===t.boat_id);
            if (b) b.status = 'available';
            apiCall('updateTrip', {id:t.id, status:'completed'}); // Update ke backend
        }
    });
    if (trips.length === 0) { container.innerHTML = '<div class="empty-state">Belum ada trip</div>'; return; }
    const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'owner');
    let html = '<table><thead><tr><th>Kapal</th><th>Pelanggan</th><th>Mulai</th><th>Kembali</th><th>Status</th>'+(canEdit?'<th>Aksi</th>':'')+'</tr></thead><tbody>';
    trips.forEach(t => {
        const b = boats.find(x=>x.id===t.boat_id);
        html += `<tr><td>${b?b.name:'—'}</td><td>${t.customer_name||'—'}</td><td>${formatDate(t.start_date)}</td><td>${formatDate(t.return_date)}</td><td>${getStatusLabel(t.status)}</td>`;
        if (canEdit) {
            html += `<td class="actions-cell">
                <button class="btn-icon" onclick="editTrip('${t.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn-icon" onclick="sendTripEmail('${t.id}')"><i class="fas fa-envelope"></i></button>
                <button class="btn-icon danger" onclick="deleteTrip('${t.id}')"><i class="fas fa-trash"></i></button>
            </td>`;
        }
        html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}
document.getElementById('addTripBtn').onclick = function() {
    const available = boats.filter(b=>b.status==='available');
    openModal('Trip Baru (Otomatis 1 Bulan)', `
        <div class="form-group"><label>Kapal</label><select id="fTripBoat">${available.map(b=>`<option value="${b.id}">${b.name}</option>`).join('')}${available.length===0?'<option value="">— tidak ada —</option>':''}</select></div>
        <div class="form-row"><div><label>Mulai</label><input type="date" id="fTripStart" value="${todayStr()}" /></div><div><label>Kembali (otomatis +1 bulan)</label><input type="date" id="fTripReturn" value="${addMonths(todayStr(),1)}" /></div></div>
        <div class="form-group"><label>Pelanggan</label><input id="fTripCustomer" /></div>
        <div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Batal</button><button class="btn-primary" onclick="saveTrip()">Buat Trip</button></div>
    `);
    document.getElementById('fTripStart').onchange = function() {
        document.getElementById('fTripReturn').value = addMonths(this.value, 1);
    };
};
window.saveTrip = async function() {
    const boat_id = document.getElementById('fTripBoat').value;
    if (!boat_id) { showToast('Pilih kapal', 'error'); return; }
    const result = await apiCall('addTrip', {
        boat_id, start_date:document.getElementById('fTripStart').value, return_date:document.getElementById('fTripReturn').value, customer_name:document.getElementById('fTripCustomer').value.trim(), status:'active'
    });
    if (result) {
        showToast('Trip dibuat! Email otomatis akan dikirim ke Owner.', 'success');
        closeModal(); renderAll();
        // Kirim email otomatis ke owner saat trip dibuat
        await apiCall('sendTripEmail', {trip_id: result.id});
    }
};
window.deleteTrip = async function(id) {
    if (!confirm('Hapus trip?')) return;
    await apiCall('deleteTrip', {id}); renderAll();
};
window.sendTripEmail = async function(id) {
    showToast('Mengirim email ke Owner...', 'info');
    await apiCall('sendTripEmail', {trip_id: id});
    showToast('Email terkirim!', 'success');
};

// ===========================================================
//  TRANSACTIONS (Admin hanya bisa expense, Owner bisa income)
// ===========================================================
function renderTransactions() {
    const container = document.getElementById('txnsTableWrap');
    if (transactions.length === 0) { container.innerHTML = '<div class="empty-state">Belum ada transaksi</div>'; return; }
    const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'owner');
    let html = '<table><thead><tr><th>Jenis</th><th>Kategori</th><th>Jumlah</th><th>Deskripsi</th><th>Tanggal</th>'+(canEdit?'<th>Aksi</th>':'')+'</tr></thead><tbody>';
    transactions.forEach(t => {
        html += `<tr><td>${getTxnLabel(t.type)}</td><td>${t.category||'—'}</td><td><strong>${formatCurrency(t.amount)}</strong></td><td>${t.description||'—'}</td><td>${formatDate(t.date)}</td>`;
        if (canEdit) {
            html += `<td class="actions-cell"><button class="btn-icon danger" onclick="deleteTxn('${t.id}')"><i class="fas fa-trash"></i></button></td>`;
        }
        html += '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}
document.getElementById('addTxnBtn').onclick = function() {
    const isOwner = currentUser.role === 'owner';
    const isAdmin = currentUser.role === 'admin';
    let typeOptions = '<option value="expense">Pengeluaran</option>';
    if (isOwner) typeOptions += '<option value="income">Pemasukan (Penjualan)</option>';
    openModal('Tambah Transaksi', `
        <div class="form-group"><label>Tipe</label><select id="fTxnType">${typeOptions}</select></div>
        <div class="form-group"><label>Kategori</label>
            <select id="fTxnCategory">
                <option value="BBM">BBM (Solar)</option>
                <option value="Es">Es Balok</option>
                <option value="Logistik">Logistik & Konsumsi</option>
                <option value="Perawatan">Biaya Perawatan</option>
                <option value="Lainnya">Lainnya</option>
            </select>
        </div>
        <div class="form-group"><label>Jumlah (Rp)</label><input type="number" id="fTxnAmount" /></div>
        <div class="form-group"><label>Deskripsi</label><input id="fTxnDesc" /></div>
        <div class="form-group"><label>Tanggal</label><input type="date" id="fTxnDate" value="${todayStr()}" /></div>
        <div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Batal</button><button class="btn-primary" onclick="saveTxn()">Simpan</button></div>
    `);
};
window.saveTxn = async function() {
    const type = document.getElementById('fTxnType').value;
    const amount = parseFloat(document.getElementById('fTxnAmount').value);
    if (!amount || amount <= 0) { showToast('Masukkan jumlah valid', 'error'); return; }
    const result = await apiCall('addTransaction', {
        type, category:document.getElementById('fTxnCategory').value, amount,
        description:document.getElementById('fTxnDesc').value.trim(), date:document.getElementById('fTxnDate').value
    });
    if (result) { showToast('Transaksi ditambahkan', 'success'); closeModal(); renderAll(); }
};
window.deleteTxn = async function(id) {
    if (!confirm('Hapus transaksi?')) return;
    await apiCall('deleteTransaction', {id}); renderAll();
};

// ===========================================================
//  HASIL TANGKAPAN (Admin input kg, Owner tentukan harga)
// ===========================================================
function renderCatches() {
    const container = document.getElementById('catchTableWrap');
    if (catches.length === 0) { container.innerHTML = '<div class="empty-state">Belum ada data tangkapan</div>'; return; }
    let html = '<table><thead><tr><th>Kapal</th><th>Jenis Ikan</th><th>Berat (Kg)</th><th>Harga/Kg</th><th>Total (Rp)</th><th>Tanggal</th></tr></thead><tbody>';
    catches.forEach(c => {
        const b = boats.find(x=>x.id===c.boat_id);
        const total = (c.quantity_kg || 0) * (c.price_per_kg || 0);
        html += `<tr><td>${b?b.name:'—'}</td><td>${c.fish_type||'—'}</td><td>${c.quantity_kg||0} Kg</td><td>${formatCurrency(c.price_per_kg||0)}</td><td><strong>${formatCurrency(total)}</strong></td><td>${formatDate(c.date)}</td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}
document.getElementById('addCatchBtn').onclick = function() {
    // Admin & Owner can input catch, tapi harga ditentukan Owner. Di sini kita ambil harga default dari Owner atau input manual.
    openModal('Input Hasil Tangkapan', `
        <div class="form-group"><label>Kapal</label><select id="fCatchBoat">${boats.map(b=>`<option value="${b.id}">${b.name}</option>`).join('')}</select></div>
        <div class="form-group"><label>Jenis Ikan</label><input id="fCatchType" placeholder="Cumi, Tongkol, dll" /></div>
        <div class="form-group"><label>Berat (Kg)</label><input type="number" id="fCatchKg" step="0.1" /></div>
        <div class="form-group"><label>Harga per Kg (Rp) - *Ditetapkan Owner*</label><input type="number" id="fCatchPrice" placeholder="Contoh: 25000" /></div>
        <div class="form-group"><label>Tanggal</label><input type="date" id="fCatchDate" value="${todayStr()}" /></div>
        <div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Batal</button><button class="btn-primary" onclick="saveCatch()">Simpan</button></div>
    `);
    // Jika Owner, harga boleh diisi. Jika Admin, harga diambil dari input owner (tapi di sini biarkan manual untuk demo).
};
window.saveCatch = async function() {
    const boat_id = document.getElementById('fCatchBoat').value;
    const kg = parseFloat(document.getElementById('fCatchKg').value);
    const price = parseFloat(document.getElementById('fCatchPrice').value);
    if (!kg || kg <= 0 || !price || price <= 0) { showToast('Masukkan berat & harga valid', 'error'); return; }
    const result = await apiCall('addCatch', {
        boat_id, fish_type:document.getElementById('fCatchType').value.trim(), quantity_kg:kg, price_per_kg:price, date:document.getElementById('fCatchDate').value
    });
    if (result) { showToast('Hasil tangkapan disimpan', 'success'); closeModal(); renderAll(); }
};

// ===========================================================
//  LAPORAN & PDF
// ===========================================================
function renderReports() {
    const select = document.getElementById('reportBoat');
    select.innerHTML = '<option value="all">Semua Kapal</option>' + boats.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
}
document.getElementById('downloadPdfBtn').onclick = async function() {
    const month = document.getElementById('reportMonth').value;
    const boatId = document.getElementById('reportBoat').value;
    if (!month) { showToast('Pilih bulan terlebih dahulu', 'error'); return; }

    // Filter data berdasarkan bulan & kapal
    const start = month + '-01';
    const end = month + '-31';
    let txns = transactions.filter(t => t.date >= start && t.date <= end);
    let catchData = catches.filter(c => c.date >= start && c.date <= end);
    if (boatId !== 'all') {
        txns = txns.filter(t => t.boat_id === boatId);
        catchData = catchData.filter(c => c.boat_id === boatId);
    }

    const totalCatchKg = catchData.reduce((s,c)=>s+Number(c.quantity_kg),0);
    const totalOmset = catchData.reduce((s,c)=>s+(Number(c.quantity_kg)*Number(c.price_per_kg)),0);
    const totalOp = txns.filter(t=>t.type==='expense'&&['BBM','Es','Logistik','Lainnya'].includes(t.category)).reduce((s,t)=>s+Number(t.amount),0);
    const totalPerawatan = txns.filter(t=>t.type==='expense'&&t.category==='Perawatan').reduce((s,t)=>s+Number(t.amount),0);
    const profit = totalOmset - totalOp - totalPerawatan;

    document.getElementById('repCatch').textContent = totalCatchKg + ' Kg';
    document.getElementById('repIncome').textContent = formatCurrency(totalOmset);
    document.getElementById('repExpense').textContent = formatCurrency(totalOp + totalPerawatan);
    document.getElementById('repProfit').textContent = formatCurrency(profit);

    // Generate HTML untuk PDF
    const htmlContent = `
        <div style="font-family:Arial; padding:20px; width:100%;">
            <h2 style="text-align:center;">LAPORAN BULANAN BOATMANAGER</h2>
            <p style="text-align:center;">Periode: ${month}</p>
            <hr>
            <table style="width:100%; border-collapse:collapse;">
                <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Total Tangkapan Cumi/Ikan</strong></td><td style="padding:8px; border:1px solid #ddd;">${totalCatchKg} Kg</td></tr>
                <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Total Pendapatan Kotor (Omset)</strong></td><td style="padding:8px; border:1px solid #ddd;">${formatCurrency(totalOmset)}</td></tr>
                <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Total Biaya Operasional (BBM, Es, Umpan, Logistik)</strong></td><td style="padding:8px; border:1px solid #ddd;">${formatCurrency(totalOp)}</td></tr>
                <tr><td style="padding:8px; border:1px solid #ddd;"><strong>Total Biaya Perawatan / Lain-lain</strong></td><td style="padding:8px; border:1px solid #ddd;">${formatCurrency(totalPerawatan)}</td></tr>
                <tr><td style="padding:8px; border:1px solid #ddd; background:#f0f0f0;"><strong>Pendapatan Bersih (Profit)</strong></td><td style="padding:8px; border:1px solid #ddd; background:#f0f0f0;">${formatCurrency(profit)}</td></tr>
            </table>
            <p style="margin-top:20px; font-size:12px; color:#666;">Dicetak otomatis oleh BoatManager Pro</p>
        </div>
    `;

    // Download PDF menggunakan html2pdf
    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    document.body.appendChild(element);
    html2pdf().from(element).save(`Laporan_Bulanan_${month}.pdf`);
    setTimeout(() => document.body.removeChild(element), 1000);
};

// ===========================================================
//  NAVIGASI & EVENT LISTENER
// ===========================================================
document.querySelectorAll('.nav-item').forEach(item => {
    item.onclick = function() {
        const page = this.dataset.page;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
        document.getElementById('page-' + page).classList.add('active');
        document.getElementById('pageTitle').textContent = this.querySelector('span').textContent;
        renderAll();
    };
});

document.getElementById('loginForm').onsubmit = async function(e) {
    e.preventDefault();
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value.trim();
    const err = document.getElementById('loginError');
    if (!u || !p) { err.textContent='Isi username & password'; err.classList.add('show'); return; }
    const ok = await login(u, p);
    if (ok) {
        err.classList.remove('show');
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('app').classList.add('active');
        if (USE_DEMO) loadDemo();
        renderAll();
        showToast('Selamat datang, ' + currentUser.name + '!', 'success');
    } else {
        err.textContent = 'Username atau password salah';
        err.classList.add('show');
    }
};
document.getElementById('logoutBtn').onclick = logout;

// Init
document.getElementById('reportMonth').value = todayStr().slice(0,7);
if (USE_DEMO) loadDemo();