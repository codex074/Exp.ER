const GAS_URL = 'https://script.google.com/macros/s/AKfycbzO33xvwfUGW3Izfcpvc0JH9Ox1DArHM_I5zd3PzSxgcI1NNYuT-Hpw1Pdeb1ysM5N1/exec';

let drugDatabase = [];
let reportData = [];
let currentPage = 1;
const itemsPerPage = 10;
let filteredDataCache = [];
let isReportLoaded = false;

// --- SweetAlert2 Theme Configuration (For Modals) ---
const swalTheme = {
    popup: 'rounded-[2.5rem] p-8 border border-slate-100 shadow-2xl bg-white/95 backdrop-blur-xl',
    title: 'text-slate-800 text-2xl font-bold mb-1',
    htmlContainer: 'text-slate-500 text-base',
    confirmButton: 'btn-donate min-w-[130px] justify-center shadow-lg border-0 text-white',
    cancelButton: 'px-6 py-3 rounded-2xl border-2 border-slate-200 text-slate-500 font-bold hover:bg-slate-50 hover:text-slate-700 transition-all bg-white',
    actions: 'flex gap-4 justify-center w-full items-center mt-4',
    input: 'w-full p-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-base text-slate-600'
};

const MySwal = Swal.mixin({
    customClass: swalTheme,
    buttonsStyling: false,
    confirmButtonText: 'OK'
});

// --- Toast Configuration (Updated: Reverted to Standard Small Size) ---
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
});

// Action Styles Configuration
const actionStyles = {
    'Sticker': { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', label: 'Sticker', icon: 'fa-tags' },
    'Transfer': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', label: 'ส่งต่อ', icon: 'fa-share-from-square' },
    'Separate': { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', label: 'แยกเก็บ', icon: 'fa-box-open' },
    'ContactWH': { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200', label: 'ติดต่อคลัง', icon: 'fa-phone-volume' },
    'ReturnWH': { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', label: 'คืนคลัง', icon: 'fa-truck-ramp-box' },
    'Destroy': { bg: 'bg-slate-700', text: 'text-white', border: 'border-slate-600', label: 'ทำลาย', icon: 'fa-fire' },
    'Other': { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', label: 'อื่นๆ', icon: 'fa-ellipsis' }
};

async function callAPI(action, payload = null) {
    try {
        if (!payload) {
            const response = await fetch(`${GAS_URL}?action=${action}`, { method: 'GET', redirect: "follow" });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            return data;
        } else {
            const response = await fetch(GAS_URL, {
                method: 'POST', redirect: "follow",
                body: JSON.stringify({ action: action, payload: payload }),
                headers: { "Content-Type": "text/plain;charset=utf-8" }
            });
            const data = await response.json();
            if (!data.success && data.message) throw new Error(data.message);
            return data;
        }
    } catch (error) { throw new Error(error.toString()); }
}

window.onload = function () {
    const today = new Date();
    document.getElementById('entryDate').value = today.toISOString().split('T')[0];

    refreshData();

    const mainContainer = document.getElementById('mainContainer');
    const backBtn = document.getElementById('backToTop');
    mainContainer.addEventListener('scroll', () => {
        if (mainContainer.scrollTop > 300) { backBtn.classList.add('show'); } else { backBtn.classList.remove('show'); }
    });
};

function onFail(err) {
    document.getElementById('overlay').classList.add('hidden');
    MySwal.fire({
        title: 'Connection Failed',
        text: err.message || 'Something went wrong',
        icon: 'error',
        confirmButtonColor: '#ef4444'
    });
}

function scrollToTop() { document.getElementById('mainContainer').scrollTo({ top: 0, behavior: 'smooth' }); }

function switchTab(tab) {
    const btnEntry = document.getElementById('tab-entry');
    const btnReport = document.getElementById('tab-report');
    const viewEntry = document.getElementById('view-entry');
    const viewReport = document.getElementById('view-report');

    if (tab === 'entry') {
        btnEntry.className = "flex-1 py-3 px-4 rounded-2xl font-bold text-lg transition-all duration-300 bg-blue-600 text-white shadow-lg shadow-blue-200 transform scale-100";
        btnReport.className = "flex-1 py-3 px-4 rounded-2xl font-bold text-lg transition-all duration-300 bg-white text-slate-500 hover:bg-slate-50 border border-slate-200";
        viewEntry.classList.remove('hidden'); viewReport.classList.add('hidden');
    } else {
        btnReport.className = "flex-1 py-3 px-4 rounded-2xl font-bold text-lg transition-all duration-300 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transform scale-100";
        btnEntry.className = "flex-1 py-3 px-4 rounded-2xl font-bold text-lg transition-all duration-300 bg-white text-slate-500 hover:bg-slate-50 border border-slate-200";
        viewEntry.classList.add('hidden'); viewReport.classList.remove('hidden');

        if (!isReportLoaded) {
            loadReport();
        }
    }
    scrollToTop();
}

function adjustQty(amount) {
    const input = document.getElementById('qtyInput');
    let val = parseInt(input.value) || 0; val += amount; if (val < 0) val = 0; input.value = val;
}

function adjustManageQty(amount) {
    const input = document.getElementById('manageQty');
    let val = parseInt(input.value) || 0; val += amount; if (val < 0) val = 0; input.value = val;
}

const drugInput = document.getElementById('drugSearch');
const drugList = document.getElementById('drugList');

function refreshData() {
    const btn = document.getElementById('btnRefresh');
    const icon = document.getElementById('iconRefresh');
    const searchInput = document.getElementById('drugSearch');

    icon.classList.add('fa-spin');
    searchInput.placeholder = "Downloading database...";
    searchInput.disabled = true;

    callAPI('getDrugList').then(data => {
        drugDatabase = data;

        icon.classList.remove('fa-spin');
        searchInput.disabled = false;
        searchInput.value = "";
        searchInput.classList.remove('bg-white/80');
        searchInput.classList.add('bg-white');
        searchInput.placeholder = "🔍 Search Drug...";

    }).catch(err => {
        onFail(err);
        icon.classList.remove('fa-spin');
        searchInput.placeholder = "❌ Error. Try again.";
    });
}

function renderDrugDropdown(query) {
    drugList.innerHTML = '';
    const val = query ? query.toLowerCase().trim() : "";

    if (!val) {
        drugList.classList.add('hidden');
        return;
    }

    const matches = drugDatabase.filter(d => d.displayName.toLowerCase().includes(val)).slice(0, 10);

    if (matches.length > 0) {
        drugList.classList.remove('hidden');
        matches.forEach(item => {
            const li = document.createElement('li');
            li.className = "p-4 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 text-lg text-slate-700 transition-colors flex items-center gap-2";
            li.innerHTML = `<i class="fa-solid fa-pills text-blue-300"></i> ${item.displayName}`;
            li.onclick = () => selectDrug(item);
            drugList.appendChild(li);
        });
    } else {
        drugList.classList.add('hidden');
    }
}

drugInput.addEventListener('input', function () {
    const val = this.value;
    if (val) { document.getElementById('clearSearchBtn').classList.remove('hidden'); }
    else { document.getElementById('clearSearchBtn').classList.add('hidden'); }
    renderDrugDropdown(val);
});

function selectDrug(item) {
    drugInput.value = item.displayName;
    document.getElementById('generic').value = item.generic;
    document.getElementById('unit').value = item.unit;
    document.getElementById('strength').value = item.strength;
    document.getElementById('unitDisplay').textContent = item.unit || "Unit";
    drugList.classList.add('hidden');
}

function clearDrugSearch() {
    const input = document.getElementById('drugSearch');
    input.value = ''; input.focus();
    renderDrugDropdown("");
    document.getElementById('clearSearchBtn').classList.add('hidden');
    document.getElementById('generic').value = '';
    document.getElementById('unit').value = '';
    document.getElementById('strength').value = '';
    document.getElementById('unitDisplay').textContent = 'Unit';
}

function toggleSubDetails(action) {
    const container = document.getElementById('dynamicArea');
    const inputTransfer = document.getElementById('inputTransfer');
    const subNote = document.getElementById('subNote');
    container.classList.remove('hidden');
    if (action === 'Transfer') { inputTransfer.classList.remove('hidden'); inputTransfer.required = true; } else { inputTransfer.classList.add('hidden'); inputTransfer.required = false; }

    if (['Other', 'ContactWH', 'ReturnWH', 'Destroy'].includes(action)) {
        subNote.required = true;
        subNote.placeholder = "Note (Required)...";
        subNote.classList.add('border-blue-300', 'ring-1', 'ring-blue-200');
    } else {
        subNote.required = false;
        subNote.placeholder = "Note (Optional)...";
        subNote.classList.remove('border-blue-300', 'ring-1', 'ring-blue-200');
    }
}

function modalToggleSubDetails(action) {
    const container = document.getElementById('modalDynamicArea');
    const inputTransfer = document.getElementById('modalTransfer');
    const subNote = document.getElementById('modalSubNote');
    container.classList.remove('hidden');
    if (action === 'Transfer') { inputTransfer.classList.remove('hidden'); inputTransfer.required = true; } else { inputTransfer.classList.add('hidden'); inputTransfer.required = false; }

    if (['Other', 'ContactWH', 'ReturnWH', 'Destroy'].includes(action)) {
        subNote.required = true;
        subNote.placeholder = "Note (Required)...";
        subNote.classList.add('border-blue-300', 'ring-1', 'ring-blue-200');
    } else {
        subNote.required = false;
        subNote.placeholder = "Note (Optional)...";
        subNote.classList.remove('border-blue-300', 'ring-1', 'ring-blue-200');
    }
}

function toggleCustomDate() {
    const val = document.getElementById('filterTime').value;
    const container = document.getElementById('customDateContainer');
    if (val === 'custom') { container.classList.remove('hidden'); } else { container.classList.add('hidden'); renderReport(); }
}

function handleFormSubmit(e) {
    e.preventDefault();
    const action = document.querySelector('input[name="actionType"]:checked').value;
    const note = document.getElementById('subNote').value.trim();

    if (['Other', 'ContactWH', 'ReturnWH', 'Destroy'].includes(action) && !note) {
        MySwal.fire({ icon: 'warning', title: 'Missing Info', text: 'Please provide a note.' });
        return;
    }
    MySwal.fire({
        title: 'Save Entry?',
        text: "Please check details",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Save'
    }).then((result) => { if (result.isConfirmed) { submitDataToServer(); } });
}

function submitDataToServer() {
    const action = document.querySelector('input[name="actionType"]:checked').value;
    let subVal = action === 'Transfer' ? document.getElementById('inputTransfer').value : "";
    const noteVal = document.getElementById('subNote').value;
    const formData = { entryDate: document.getElementById('entryDate').value, drugName: document.getElementById('drugSearch').value, generic: document.getElementById('generic').value, strength: document.getElementById('strength').value, unit: document.getElementById('unit').value, qty: document.getElementById('qtyInput').value, expiryDate: document.getElementById('expiryDateInput').value, actionType: action, subDetails: subVal, notes: noteVal };
    document.getElementById('overlay').classList.remove('hidden');

    callAPI('saveData', formData).then(res => {
        document.getElementById('overlay').classList.add('hidden');
        if (res.success) {
            MySwal.fire({ icon: 'success', title: 'Saved!', timer: 1500, showConfirmButton: false });
            document.getElementById('expiryForm').reset();
            document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('qtyInput').value = "";
            document.getElementById('dynamicArea').classList.add('hidden');
            document.querySelectorAll('.action-card').forEach(el => el.style = "");
            clearDrugSearch();
            scrollToTop();
            isReportLoaded = false;
        } else {
            MySwal.fire('Error', res.message, 'error');
        }
    }).catch(err => onFail(err));
}

function forceRefreshReport() {
    const btn = document.getElementById('btnReportRefresh');
    const icon = btn.querySelector('i');

    icon.classList.add('fa-spin');
    btn.disabled = true;
    btn.classList.add('opacity-75');

    loadReport().then(() => {
        icon.classList.remove('fa-spin');
        btn.disabled = false;
        btn.classList.remove('opacity-75');
        Toast.fire({ icon: 'success', title: 'List Updated' });
    }).catch(() => {
        icon.classList.remove('fa-spin');
        btn.disabled = false;
        btn.classList.remove('opacity-75');
    });
}

function loadReport() {
    currentPage = 1;
    document.getElementById('reportList').innerHTML = '<div class="col-span-full flex flex-col items-center justify-center text-slate-400 min-h-[60vh]"><div class="custom-loader mb-4"></div>Loading Data...</div>';

    return callAPI('getReportData').then(data => {
        reportData = data;
        isReportLoaded = true;
        renderReport();
    }).catch(err => onFail(err));
}

function renderReport() {
    const container = document.getElementById('reportList');
    const paginationControls = document.getElementById('paginationControls');
    const filterTime = document.getElementById('filterTime').value;
    const filterAction = document.getElementById('filterAction').value;
    let customMaxDays = null;
    if (filterTime === 'custom') {
        const num = parseInt(document.getElementById('customNumber').value) || 0;
        const unit = document.getElementById('customUnit').value;
        if (num > 0) customMaxDays = unit === 'months' ? num * 30 : num;
    }
    container.innerHTML = '';
    if (!reportData || reportData.length === 0) { container.innerHTML = '<div class="col-span-full text-center text-slate-400 mt-10 font-light text-lg">No data found.</div>'; paginationControls.classList.add('hidden'); return; }
    const today = new Date();
    const processed = reportData.map(item => { const exp = new Date(item.expiryDate); const diffTime = exp - today; const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); return { ...item, diffDays, expObj: exp }; }).sort((a, b) => a.diffDays - b.diffDays);
    const filtered = processed.filter(item => {
        let matchTime = filterTime === 'all' ? true : (filterTime === 'custom' ? (customMaxDays !== null ? (item.diffDays <= customMaxDays && item.diffDays >= -3650) : true) : (item.diffDays <= parseInt(filterTime) && item.diffDays >= -365));
        const matchAction = filterAction === 'all' || item.action === filterAction;
        return matchTime && matchAction;
    });
    if (filtered.length === 0) { container.innerHTML = '<div class="col-span-full text-center text-slate-400 mt-10 font-light text-lg">No items match filter.</div>'; paginationControls.classList.add('hidden'); return; }

    filteredDataCache = filtered;
    currentPage = 1;
    renderPage(currentPage);
}

function renderPage(page) {
    const container = document.getElementById('reportList');
    container.innerHTML = '';
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pagedItems = filteredDataCache.slice(start, end);
    const totalPages = Math.ceil(filteredDataCache.length / itemsPerPage);

    pagedItems.forEach(item => {
        let borderStatus = "border-l-green-500", textExp = "text-green-600", expBg = "bg-green-50 border-green-100";
        if (item.diffDays < 0) { borderStatus = "border-l-slate-400"; textExp = "text-slate-500"; expBg = "bg-slate-100 border-slate-200"; }
        else if (item.diffDays <= 30) { borderStatus = "border-l-red-500"; textExp = "text-red-600"; expBg = "bg-red-50 border-red-100"; }
        else if (item.diffDays <= 90) { borderStatus = "border-l-orange-400"; textExp = "text-orange-600"; expBg = "bg-orange-50 border-orange-100"; }

        let dateStr = item.expiryDate; try { dateStr = item.expObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); } catch (e) { }
        const style = actionStyles[item.action] || actionStyles['Other'];
        let actionLabel = `<i class="fa-solid ${style.icon} mr-1"></i> ${style.label}`;
        if (item.action === 'Transfer' && item.subDetails) { actionLabel += ` <i class="fa-solid fa-arrow-right text-sm mx-1 text-slate-400"></i> ${item.subDetails}`; }

        const itemStr = encodeURIComponent(JSON.stringify(item));
        const noteText = item.notes && item.notes.trim() !== "" ? item.notes : "-";

        const card = `<div onclick="openManageModal('${itemStr}')" class="relative cursor-pointer bg-white p-4 rounded-2xl shadow-sm border border-slate-100 border-l-[4px] ${borderStatus} hover:shadow-lg hover:shadow-blue-100 hover:-translate-y-1 transition-all duration-300 group fade-in">
            <div class="absolute top-3 right-3"><span class="px-3 py-1.5 text-sm font-bold rounded-lg ${style.bg} ${style.text} border ${style.border} shadow-sm flex items-center">${actionLabel}</span></div>
            <div class="pr-28"><h3 class="font-bold text-slate-800 text-xl truncate mb-1 group-hover:text-blue-600 transition-colors">${item.drugName}</h3><p class="text-base text-slate-400 mb-2 font-medium pl-0.5">${item.strength || '-'}</p>
            <div class="flex flex-wrap items-center gap-2 mb-3"><div class="bg-slate-50 px-3 py-1 rounded-md border border-slate-200 text-base shadow-sm">Qty: <b class="text-slate-800">${item.qty}</b> <span class="text-slate-400 text-sm">${item.unit}</span></div><div class="px-3 py-1 rounded-md border text-base font-bold shadow-sm flex items-center gap-1 ${expBg} ${textExp}"><i class="fa-regular fa-calendar-xmark text-sm opacity-70"></i> ${dateStr} <span class="font-normal opacity-80 text-sm">(${item.diffDays}d)</span></div></div>
            
            <!-- Note Section in Card -->
            <div class="pt-2 border-t border-slate-100 text-xs text-slate-500 truncate flex items-center">
               <i class="fa-solid fa-note-sticky text-amber-400 mr-1.5 text-sm"></i> Note: <span class="ml-1 font-medium text-slate-600">${noteText}</span>
            </div>
            </div></div>`;
        container.innerHTML += card;
    });
    document.getElementById('paginationControls').classList.remove('hidden');
    document.getElementById('pageIndicator').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('btnPrev').disabled = (currentPage === 1);
    document.getElementById('btnNext').disabled = (currentPage === totalPages);
}

function prevPage() { if (currentPage > 1) { currentPage--; renderPage(currentPage); scrollToTop(); } }
function nextPage() { const totalPages = Math.ceil(filteredDataCache.length / itemsPerPage); if (currentPage < totalPages) { currentPage++; renderPage(currentPage); scrollToTop(); } }

function openManageModal(itemEncoded) {
    const item = JSON.parse(decodeURIComponent(itemEncoded));
    document.getElementById('manageRowIndex').value = item.rowIndex;
    document.getElementById('manageDrugName').textContent = item.drugName;
    document.getElementById('manageMaxQty').value = item.qty;
    document.getElementById('displayMaxQty').textContent = item.qty;
    document.getElementById('manageUnit').textContent = item.unit || 'Unit';

    if (document.getElementById('modalUnitTop')) {
        document.getElementById('modalUnitTop').textContent = item.unit || 'UNIT';
    }

    document.getElementById('manageOriginalAction').value = item.action;

    // --- Note Logic (Case Insensitive Check) ---
    const noteBox = document.getElementById('displayCurrentNoteBox');
    const noteText = document.getElementById('displayCurrentNote');

    const getVal = (obj, key) => obj[key] || obj[key.toLowerCase()] || obj[key.charAt(0).toUpperCase() + key.slice(1)] || "";

    const rawSub = getVal(item, 'subDetails');
    const rawNote = getVal(item, 'notes');

    let detailsToShow = [];
    if (rawSub && rawSub.trim() !== "") { detailsToShow.push(`[${rawSub}]`); }
    if (rawNote && rawNote.trim() !== "") { detailsToShow.push(rawNote); }

    const finalNote = detailsToShow.join(" ");

    if (finalNote) {
        noteText.textContent = finalNote;
        noteBox.classList.remove('hidden');
    } else {
        noteText.textContent = "";
        noteBox.classList.add('hidden');
    }

    document.getElementById('manageQty').value = '';
    document.querySelectorAll('input[name="manageAction"]').forEach(el => el.checked = false);
    document.getElementById('modalDynamicArea').classList.add('hidden');
    document.querySelectorAll('.action-card').forEach(el => el.style = "");
    document.getElementById('manageModal').classList.remove('hidden');
}

function closeManageModal() { document.getElementById('manageModal').classList.add('hidden'); }
function setAllQty() { document.getElementById('manageQty').value = document.getElementById('manageMaxQty').value; }

function editStockQty() {
    const currentQty = document.getElementById('displayMaxQty').textContent;
    const rowIndex = document.getElementById('manageRowIndex').value;

    MySwal.fire({
        title: '<span class="text-slate-800">Adjust Stock</span>',
        html: `
         <div class="mb-4">
            <p class="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Current Amount</p>
            <p class="text-slate-600 text-xl font-semibold">${currentQty} <span class="text-xs text-slate-400">UNIT</span></p>
         </div>
       `,
        input: 'number',
        inputPlaceholder: 'New Qty',
        inputValue: currentQty,
        showCancelButton: true,
        confirmButtonText: 'Update Stock',
        cancelButtonText: 'Cancel',
        customClass: {
            ...swalTheme,
            input: 'w-1/2 mx-auto text-center text-4xl font-bold text-blue-600 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none py-4 transition-all mb-6'
        },
        preConfirm: (newQty) => {
            if (!newQty || newQty < 0) Swal.showValidationMessage('Invalid quantity');
            return newQty;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            document.getElementById('overlay').classList.remove('hidden');
            callAPI('updateStockQuantity', { rowIndex: rowIndex, newQty: result.value }).then(res => {
                document.getElementById('overlay').classList.add('hidden');
                if (res.success) { MySwal.fire({ icon: 'success', title: 'Stock Updated', timer: 1000, showConfirmButton: false }); loadReport().then(() => isReportLoaded = true); }
                else { MySwal.fire('Error', res.message, 'error'); }
            }).catch(err => onFail(err));
        }
    });
}

function submitManagement() {
    const manageQty = document.getElementById('manageQty').value;
    const actionEl = document.querySelector('input[name="manageAction"]:checked');
    const originalAction = document.getElementById('manageOriginalAction').value;

    if (!manageQty || parseInt(manageQty) <= 0) { MySwal.fire('Warning', 'Invalid Quantity', 'warning'); return; }
    if (parseInt(manageQty) > parseInt(document.getElementById('manageMaxQty').value)) { MySwal.fire('Warning', 'Exceed Stock', 'warning'); return; }

    let actionToSubmit = originalAction;
    if (actionEl) {
        actionToSubmit = actionEl.value;
        const note = document.getElementById('modalSubNote').value.trim();

        if (['Other', 'ContactWH', 'ReturnWH', 'Destroy'].includes(actionToSubmit) && !note) {
            MySwal.fire({ icon: 'warning', title: 'Missing Info', text: 'Please provide a note.' });
            return;
        }
    }

    MySwal.fire({
        title: 'Confirm Update?', text: `Updating ${manageQty} items`, icon: 'warning',
        showCancelButton: true, confirmButtonText: 'Yes, Confirm',
    }).then((result) => { if (result.isConfirmed) { processManagement(manageQty, actionToSubmit); } });
}

function processManagement(manageQty, action) {
    const rowIndex = document.getElementById('manageRowIndex').value;
    let subVal = action === 'Transfer' ? document.getElementById('modalTransfer').value : "";
    const noteVal = document.getElementById('modalSubNote').value;

    closeManageModal();
    document.getElementById('overlay').classList.remove('hidden');

    callAPI('manageItem', { rowIndex: rowIndex, manageQty: manageQty, newAction: action, newDetails: subVal, newNotes: noteVal })
        .then(res => {
            document.getElementById('overlay').classList.add('hidden');
            if (res.success) {
                MySwal.fire({ icon: 'success', title: 'Success', text: res.message, timer: 1500, showConfirmButton: false });
                loadReport().then(() => isReportLoaded = true);
            }
            else { MySwal.fire('Error', res.message, 'error'); }
        })
        .catch(err => onFail(err));
}

function confirmDelete() {
    const rowIndex = document.getElementById('manageRowIndex').value;

    MySwal.fire({
        title: 'Delete Item?',
        html: `
            <p class="text-slate-500 text-sm mb-3">This action cannot be undone.</p>
            <div class="mb-3">
                <input type="password" id="deletePin" class="w-full p-3 rounded-xl border border-slate-200 outline-none text-center text-lg tracking-widest font-bold focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all" placeholder="Enter PIN" maxlength="4">
            </div>
            <textarea id="deleteNote" class="w-full p-3 rounded-xl border border-slate-200 focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all text-base text-slate-600" rows="2" placeholder="Reason for deletion (Optional)..."></textarea>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Verify & Delete',
        cancelButtonText: 'Cancel',
        didOpen: () => {
            const pinInput = document.getElementById('deletePin');
            if (pinInput) pinInput.focus();
        },
        preConfirm: () => {
            const pin = document.getElementById('deletePin').value;
            const note = document.getElementById('deleteNote').value;

            if (!pin) {
                Swal.showValidationMessage('Please enter PIN');
                return false;
            }

            if (pin !== '1234') {
                Swal.showValidationMessage('Incorrect PIN Code');
                return false;
            }

            return note;
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const userNote = result.value || "";

            closeManageModal();
            document.getElementById('overlay').classList.remove('hidden');

            callAPI('deleteItem', { rowIndex: rowIndex, note: userNote }).then(res => {
                document.getElementById('overlay').classList.add('hidden');
                if (res.success) {
                    MySwal.fire({ icon: 'success', title: 'Deleted', text: 'Item removed successfully', timer: 1500, showConfirmButton: false });
                    loadReport().then(() => isReportLoaded = true);
                }
                else { MySwal.fire('Error', res.message, 'error'); }
            }).catch(err => onFail(err));
        }
    });
}