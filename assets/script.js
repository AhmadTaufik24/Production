// ==========================================
// 1. KONFIGURASI & DATABASE
// ==========================================

// Harga Dasar (Bisa diubah sesuai rate card)
const RATES = { 
    story: 50000, 
    feed: 50000, // Harga Per Slide
    reels: 150000 
};

// Batas Kapasitas Mingguan (Untuk fitur Auto-Target)
const MAX_CAPACITY = { 
    feed1: 1, 
    feed2: 1, 
    feed4: 2, 
    reels: 2, 
    story: 7 
};

// Alur Tahapan Kerja
const STAGE_FLOW = ['scheduling', 'preparing', 'progress', 'review', 'upload'];

// Load Database dari LocalStorage
let jobOrders = JSON.parse(localStorage.getItem('jo_db_v47')) || [];

// Init saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => { 
    renderBoard(); 
    updateLifetimeIncome(); 
});


// ==========================================
// 2. CORE: RENDER BOARD & CARD
// ==========================================

function renderBoard() {
    // Reset kolom
    STAGE_FLOW.forEach(stg => {
        const colBody = document.getElementById(`col-${stg}`);
        if(colBody) colBody.innerHTML = '';
        
        const colCount = document.getElementById(`c-${stg}`);
        if(colCount) colCount.innerText = jobOrders.filter(j => j.stage === stg).length;
    });

    // Loop semua job
    jobOrders.forEach(jo => {
        if(jo.stage === 'archive' || jo.stage === 'done') return;

        const card = document.createElement('div');
        card.className = `card ${jo.category === 'General' ? 'general-job' : ''}`;
        
        // Event click card (kecuali pas klik tombol)
        card.onclick = (e) => { 
            if(!e.target.closest('button')) showJobDetail(jo.id); 
        };

        // Warna Badge Kategori
        let badgeColor = '#7f8c8d'; // Default Grey
        if(jo.category === 'Content') {
            if(jo.type === 'Reels') badgeColor = '#9b59b6'; 
            else if(jo.type === 'Feed') badgeColor = '#e67e22'; 
            else if(jo.type === 'Story') badgeColor = '#3498db';
        }

        // Cek Deadline
        const dl = checkDeadline(jo.data.deadline);
        const dlHtml = `
            <div style="display:flex; align-items:center; font-size:11px; margin-bottom:5px; color:#555;">
                <span class="dl-indicator ${dl.bg}"></span> 
                <span class="${dl.txt}">${dl.text}</span>
            </div>`;
        
        // Status Text (Revisi/Approved)
        let statusHTML = jo.statusText ? `<span class="status-text" style="color:${jo.statusText.includes('Revisi')?'#e74c3c':'#f39c12'}">${jo.statusText}</span>` : '';
        
        // Tampilkan info Slide jika Feed
        let typeLabel = jo.type;
        if(jo.type === 'Feed') typeLabel += ` (${jo.slides}S)`;

        card.innerHTML = `
            <div class="card-meta">
                <span class="badge" style="background:${badgeColor}">${typeLabel}</span>
                <div class="card-tools">
                    <button class="tool-btn btn-void" title="Kembalikan status" onclick="voidJob('${jo.id}', event)">↩</button>
                    <button class="tool-btn btn-del" title="Hapus permanen" onclick="deleteJob('${jo.id}', event)">🗑️</button>
                </div>
            </div>
            <h4>${jo.title}</h4>
            ${dlHtml} 
            ${statusHTML}
            <div style="margin-top:10px; padding-top:10px; border-top:1px dashed #ddd;">
                ${getActionButtons(jo)}
            </div>`;
        
        const targetCol = document.getElementById(`col-${jo.stage}`);
        if(targetCol) targetCol.appendChild(card);
    });
}

function getActionButtons(jo) {
    if(jo.stage === 'scheduling') {
        return `<button class="btn btn-sm" onclick="openPrep('${jo.id}')">Prepare ➜</button>`;
    }
    if(jo.stage === 'preparing') {
        return `<button class="btn btn-sm" onclick="moveStage('${jo.id}', 'progress')">Kerjakan ➜</button>`;
    }
    if(jo.stage === 'progress') {
        return `<button class="btn btn-sm" onclick="openProg('${jo.id}')">Selesai ➜</button>`;
    }
    if(jo.stage === 'review') {
        return `<button class="btn btn-sm" style="background:#f39c12; color:white;" onclick="openRev('${jo.id}')">Keputusan ⚖️</button>`;
    }
    if(jo.stage === 'upload') {
        return `<div style="display:flex; gap:5px;">
                    <button class="btn btn-sm" style="background:#f1c40f; color:#000;" onclick="delayUpload('${jo.id}')">⏳ Tunda</button>
                    <button class="btn btn-sm" style="background:var(--success); color:white" onclick="doArchive('${jo.id}')">✅ Selesai</button>
                </div>`;
    }
    return '';
}


// ==========================================
// 3. CORE: SALARY TABLE & REPORT
// ==========================================

function renderSalaryTable(viewType, category) {
    // Simpan state view saat ini agar pas refresh tidak hilang
    window.currentViewType = viewType; 
    window.currentCategory = category;

    const containerId = viewType==='salary' 
        ? (category==='content' ? 'salary-dashboard-content' : 'salary-dashboard-general')
        : (category==='content' ? 'history-dashboard-content' : 'history-dashboard-general');
    
    const container = document.getElementById(containerId);
    if(!container) return;

    container.innerHTML = ''; 
    const stageFilter = viewType === 'salary' ? 'archive' : 'done';
    
    // Filter Items sesuai Kategori
    const items = jobOrders.filter(j => 
        j.stage === stageFilter && 
        (category==='content' ? j.category==='Content' : j.category==='General')
    );
    
    if(items.length === 0) { 
        container.innerHTML = '<div style="text-align:center; padding:40px; color:#aaa; font-style:italic;">Belum ada data di periode ini.</div>'; 
        return; 
    }
    
    // Grouping by Period
    const report = {};
    items.forEach(jo => {
        const d = new Date(jo.archivedDate); 
        const key = getPeriod(d).key;
        
        if(!report[key]) report[key] = { total:0, items:[], title: key };
        
        // Hitung Harga
        let price = 0;
        if (jo.type === 'Adjust' || jo.category === 'General') {
            price = jo.manualPrice || 0;
        } else {
            if(jo.type === 'Story') price = RATES.story;
            else if(jo.type === 'Reels') price = RATES.reels;
            else price = RATES.feed * (jo.slides || 1);
        }
        
        report[key].total += price; 
        report[key].items.push({...jo, price});
    });

    // Render HTML per Periode
    Object.keys(report).sort().reverse().forEach(key => {
        const data = report[key];
        
        const hasLink = data.items.some(i => i.periodLink && i.periodLink.length > 5);
        let buttonsHTML = '';
        
        if (viewType === 'salary') {
            const btnLinkClass = hasLink ? 'btn-outline' : 'btn'; 
            const btnLinkText = hasLink ? '🔗 Edit Link' : '🔗 Input Link';
            const btnLinkStyle = hasLink ? 'border-color:#2ecc71; color:#2ecc71;' : '';
            const disabledAttr = hasLink ? '' : 'disabled';
            const disabledStyle = hasLink ? '' : 'opacity:0.5; cursor:not-allowed; background:#eee; color:#999; border:1px solid #ddd;';
            const catStr = category==='content' ? 'Content' : 'General';

            buttonsHTML = `
                <div style="display:flex; gap:5px; margin-top:10px; justify-content:flex-end; flex-wrap:wrap;">
                    <button class="btn btn-sm ${btnLinkClass}" onclick="openPeriodLink('${key}', '${catStr}')" style="${btnLinkStyle} width:auto;">${btnLinkText}</button>
                    
                    <button class="btn btn-sm btn-outline" onclick="exportProfessionalPDF('${key}', '${catStr}')" style="width:auto; ${disabledStyle}" ${disabledAttr}>⬇️ PDF</button>
                    
                    <button class="btn btn-sm" onclick="shareProfessionalPDF('${key}', '${catStr}')" style="width:auto; background:#25D366; color:white; border:none; ${disabledStyle}" ${disabledAttr}>📲 Share WA</button>
                    
                    <button class="btn btn-sm" onclick="openFinalize('${key}', '${catStr}')" style="width:auto; background:#333; color:white; ${disabledStyle}" ${disabledAttr}>🔒 Final</button>
                </div>
            `;
        } else {
            buttonsHTML = '<div style="margin-top:10px; text-align:right;"><span style="color:var(--success); font-weight:bold; font-size:12px; border:1px solid var(--success); padding:4px 8px; border-radius:4px;">✅ PERIODE DITUTUP (PAID)</span></div>';
        }

        let html = `
            <div class="salary-card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h3 style="margin-bottom:5px;">${data.title}</h3>
                        <div style="font-size:12px; color:#888;">${data.items.length} Pekerjaan Selesai</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:11px; color:#666; text-transform:uppercase; font-weight:600;">Total Pendapatan</div>
                        <div style="font-size:24px; color:var(--success); font-weight:700;">${formatRp(data.total)}</div>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th width="15%">Tgl</th>
                            <th width="40%">Job</th>
                            <th width="15%">Qty / Slide</th>
                            <th width="15%">Ket</th>
                            <th width="15%" style="text-align:right;">Rp</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        data.items.forEach(i => { 
            const isAdj = i.type === 'Adjust'; 
            // Tampilan slide di tabel monitor
            let metaInfo = i.type;
            if(i.type === 'Feed') metaInfo += ` (${i.slides} Slide)`;

            // --- Logic Kolom Slide di Tabel Monitor ---
            let qtyDisplay = '-';
            if (i.type === 'Feed') qtyDisplay = `<strong>${i.slides || 1}</strong> Slide`;
            else if (i.type !== 'Adjust') qtyDisplay = '1 konten';

            html += `
                <tr style="${isAdj?'background:#fff8e1':''}">
                    <td>${i.type==='Adjust' ? i.data.deadline : formatDate(i.archivedDate)}</td>
                    <td onclick="showJobDetail('${i.id}')" style="cursor:pointer; font-weight:500;">
                        ${i.title}
                        ${isAdj ? '<br><span style="font-size:10px; color:#f39c12">ADJUSTMENT</span>' : ''}
                    </td>
                    <td style="font-size:11px; color:#666;">${qtyDisplay}</td>
                    <td style="font-size:11px; color:#666;">${i.category}</td>
                    <td style="text-align:right;">${formatRp(i.price)}</td>
                    <td style="text-align:right; width:60px;">
                         <button class="tool-btn btn-void" onclick="voidJob('${i.id}')">↩</button> 
                         <button class="tool-btn btn-del" onclick="deleteJob('${i.id}')">🗑️</button>
                    </td>
                </tr>`; 
        });
        
        html += `</tbody></table>${buttonsHTML}</div>`; 
        container.innerHTML += html;
    });
}


// ==========================================
// 4. PDF GENERATOR & SHARE SYSTEM
// ==========================================

// --- FUNGSI 1: DOWNLOAD PDF BIASA ---
function exportProfessionalPDF(periodKey, categoryType) {
    preparePDFContent(periodKey, categoryType, (element, fileName) => {
        // Setting HTML2PDF
        const opt = {
            margin: 15,
            filename: fileName,
            image: {type:'jpeg', quality:0.98},
            html2canvas: {scale: 2, useCORS: true},
            jsPDF: {unit:'mm', format:'a4', orientation: 'portrait'}
        };
        
        // Eksekusi Download
        html2pdf().set(opt).from(element).save().then(() => { 
            document.getElementById('pdf-template-container').style.display='none'; 
        });
    });
}

// --- FUNGSI 2: SHARE PDF KE WA (NEW FEATURE) ---
function shareProfessionalPDF(periodKey, categoryType) {
    if (!navigator.canShare) {
        return alert("Browser ini tidak support Share File otomatis (Biasanya hanya work di HP Chrome/Safari). Silakan pakai tombol Download biasa.");
    }

    preparePDFContent(periodKey, categoryType, (element, fileName, totalUang, linkMaster) => {
        // Settingan HTML2PDF
        const opt = {
            margin: 15,
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Generate BLOB (File Mentah di Memory)
        html2pdf().set(opt).from(element).output('blob').then((blob) => {
            document.getElementById('pdf-template-container').style.display = 'none';

            // 1. Buat File Object
            const file = new File([blob], fileName, { type: 'application/pdf' });
            
            // 2. Siapkan Data Share (Caption + File)
            const shareData = {
                files: [file],
                title: 'Invoice Tagihan Dihidang',
                text: `Halo Kak Anisa (Dihidang) 👋,

Dear Kakak
Berikut terlampir *Invoice & Laporan Pekerjaan Freelance Konten Dihidang* untuk:
🗓️ Periode: *${periodKey}*

Rincian total tagihan dan link master file sudah tersedia lengkap di dalam dokumen PDF ini.
Mohon dicek ya Kak. Terima kasih! 🙏

_____________________________
*🤖 System Note:*
Pesan ini dikirim otomatis oleh *Taufik System*.
Dengan menyimpan nomor ini, Kakak dapat terhubung langsung untuk diskusi project atau revisi kedepannya.`
            };

            // 3. Trigger Native Share
            if (navigator.canShare(shareData)) {
                navigator.share(shareData)
                    .then(() => console.log('Share Berhasil'))
                    .catch((err) => console.log('Batal Share:', err));
            } else {
                alert("Gagal membuka menu Share. Coba download manual.");
            }

        }).catch(err => {
            console.error(err);
            document.getElementById('pdf-template-container').style.display = 'none';
            alert("Gagal generate PDF.");
        });
    });
}

// --- HELPER: MENYIAPKAN KONTEN PDF ---
function preparePDFContent(periodKey, categoryType, callback) {
    // 1. Filter Data
    const items = jobOrders.filter(j => 
        (j.stage === 'archive' || j.stage === 'done') &&
        getPeriod(new Date(j.archivedDate)).key === periodKey &&
        (categoryType === 'Content' ? j.category === 'Content' : j.category === 'General')
    );

    if(items.length === 0) return alert("Data kosong.");
    
    const linkData = items.find(j => j.periodLink); 
    if(!linkData) return alert("Link Hasil belum diisi!");
    
    // 2. Render Template
    document.getElementById('pdf-period').innerText = periodKey + ` (${categoryType})`; 
    const tbody = document.getElementById('pdf-table-body'); 
    tbody.innerHTML = '';
    
    let sub = 0, adj = 0;
    
    items.forEach(i => {
        const date = i.type === 'Adjust' ? i.data.deadline : new Date(i.archivedDate).toLocaleDateString('id-ID');
        
        let nominal = 0;
        if(i.type === 'Adjust' || i.category === 'General') {
            nominal = i.manualPrice || 0;
        } else {
             if(i.type === 'Story') nominal = RATES.story; 
             else if(i.type === 'Reels') nominal = RATES.reels; 
             else nominal = RATES.feed * (i.slides || 1); 
        }

        if(i.type === 'Adjust') adj += nominal; else sub += nominal;

        let qtyDisplay = '-';
        if (i.type === 'Feed') qtyDisplay = `<strong>${i.slides || 1}</strong> Slide`;
        else if (i.type !== 'Adjust') qtyDisplay = '1 Pcs';

        tbody.innerHTML += `
        <tr>
            <td style="padding:10px; border-bottom:1px solid #eee; font-size:11px;">${date}</td>
            <td style="padding:10px; border-bottom:1px solid #eee; font-size:11px;">
                <span style="font-weight:600;">${i.title}</span><br>
                <span style="font-size:9px; color:#777;">Type: ${i.type}</span>
            </td>
            <td style="padding:10px; border-bottom:1px solid #eee; font-size:11px; text-align:center;">${qtyDisplay}</td>
            <td style="padding:10px; border-bottom:1px solid #eee; font-size:11px;">${i.category}</td>
            <td style="padding:10px; border-bottom:1px solid #eee; font-size:11px; text-align:right;">${formatRp(nominal)}</td>
        </tr>`;
    });

    document.getElementById('pdf-subtotal').innerText = formatRp(sub); 
    document.getElementById('pdf-adjust').innerText = formatRp(adj); 
    const totalUang = formatRp(sub+adj);
    document.getElementById('pdf-total').innerText = totalUang;
    document.getElementById('pdf-cloud-text').innerHTML = `<a href="${linkData.periodLink}" target="_blank" style="color:#456D91; text-decoration:underline; font-weight:bold;">${linkData.periodLink}</a>`;

    // 3. Tampilkan Container untuk dicapture
    const element = document.getElementById('pdf-template'); 
    document.getElementById('pdf-template-container').style.display='block';
    
    const fileName = `Invoice_${categoryType}_${periodKey}.pdf`;
    
    // Callback ke fungsi Download / Share
    callback(element, fileName, totalUang, linkData.periodLink);
}


// ==========================================
// 5. MODAL & WORKFLOW FUNCTIONS
// ==========================================

// --- Manual Job ---
function openManualJob() { 
    document.getElementById('modal-manual').style.display = 'flex'; 
    toggleManualTypes(); 
}
function toggleManualTypes() { 
    const c = document.getElementById('man-category').value; 
    const t = document.getElementById('man-type'); 
    t.innerHTML = ''; 
    (c === 'General' ? ['Foto', 'Video', 'Retouch', 'Design'] : ['Feed', 'Story', 'Reels'])
        .forEach(x => t.add(new Option(x, x))); 
    document.getElementById('man-nominal-group').style.display = c === 'General' ? 'block' : 'none'; 
}
function saveManualJob() {
    const c = document.getElementById('man-category').value; 
    const t = document.getElementById('man-title').value; 
    if(!t) return alert('Judul harus diisi!');
    
    const j = createJob(document.getElementById('man-type').value, t, 'MANUAL'); 
    j.category = c; 
    j.data.deadline = document.getElementById('man-deadline').value;
    
    if(c === 'General') j.manualPrice = parseInt(document.getElementById('man-price').value) || 0;
    
    jobOrders.push(j); 
    saveData(); 
    closeModal('modal-manual'); 
    renderBoard();
}

// --- Target Generator ---
function openTargetCalc() { 
    document.getElementById('target-money').value=''; 
    document.getElementById('modal-target').style.display='flex'; 
}
function generateByTarget() {
    const target = parseInt(document.getElementById('target-money').value); 
    if(!target) return alert("Isi target nominal!");
    
    let current = 0; 
    const newJobs = []; 
    const batchID = `T-${Date.now().toString().slice(-4)}`;
    let counts = { feed1:0, feed2:0, feed4:0, reels:0, story:0 };
    
    while (current < target) {
        let added = false;
        if (counts.reels < MAX_CAPACITY.reels && current < target) { 
            newJobs.push(createJob('Reels', `Target Reels #${counts.reels+1}`, batchID)); 
            current += RATES.reels; counts.reels++; added = true; 
        }
        else if (counts.feed4 < MAX_CAPACITY.feed4 && current < target) { 
            newJobs.push(createJob('Feed', `Target Feed 4S #${counts.feed4+1}`, batchID, 4)); 
            current += (RATES.feed*4); counts.feed4++; added = true; 
        }
        else if (counts.feed2 < MAX_CAPACITY.feed2 && current < target) { 
            newJobs.push(createJob('Feed', `Target Feed 2S`, batchID, 2)); 
            current += (RATES.feed*2); counts.feed2++; added = true; 
        }
        else if (counts.feed1 < MAX_CAPACITY.feed1 && current < target) { 
            newJobs.push(createJob('Feed', `Target Feed 1S`, batchID, 1)); 
            current += RATES.feed; counts.feed1++; added = true; 
        }
        else if (counts.story < MAX_CAPACITY.story && current < target) { 
            newJobs.push(createJob('Story', `Target Story #${counts.story+1}`, batchID)); 
            current += RATES.story; counts.story++; added = true; 
        }
        
        if (!added) break;
    }
    
    if(confirm(`Membuat ${newJobs.length} Job.\nTotal: Rp ${formatRp(current)}`)) { 
        jobOrders = [...jobOrders, ...newJobs]; 
        saveData(); 
        closeModal('modal-target'); 
        renderBoard(); 
    }
}
function generateWeeklyTarget() {
    if(!confirm("Generate Paket Job Mingguan?")) return;
    const batchID = `W-${Date.now().toString().slice(-4)}`; 
    const jobs = [];
    
    jobs.push(createJob('Feed', 'Feed Single (1S)', batchID, 1)); 
    jobs.push(createJob('Feed', 'Feed Carousel (2S)', batchID, 2));
    jobs.push(createJob('Feed', 'Feed Carousel (4S) A', batchID, 4)); 
    jobs.push(createJob('Feed', 'Feed Carousel (4S) B', batchID, 4));
    jobs.push(createJob('Reels', 'Weekly Reels #1', batchID)); 
    jobs.push(createJob('Reels', 'Weekly Reels #2', batchID));
    for(let i=1; i<=7; i++) jobs.push(createJob('Story', `Daily Story #${i}`, batchID));
    
    jobOrders = [...jobOrders, ...jobs]; 
    saveData(); 
    renderBoard();
}

// --- Workflow ---
function moveStage(id, s) { 
    const j = jobOrders.find(x => x.id === id); 
    if(j) { j.stage = s; saveData(); renderBoard(); } 
}

function openPrep(id) { 
    const jo = jobOrders.find(j => j.id === id); 
    document.getElementById('prep-id').value = id; 
    document.getElementById('prep-ref').value = jo.data.ref; 
    document.getElementById('prep-deadline').value = jo.data.deadline; 
    document.getElementById('prep-notes-internal').value = ''; 
    document.getElementById('prep-slides').value = jo.slides || 1; 
    document.getElementById('slide-group').style.display = (jo.type === 'Feed') ? 'block' : 'none'; 
    document.getElementById('modal-prep').style.display = 'flex'; 
}
function savePreparing() { 
    const jo = jobOrders.find(j => j.id === document.getElementById('prep-id').value); 
    jo.data.ref = document.getElementById('prep-ref').value; 
    jo.data.deadline = document.getElementById('prep-deadline').value; 
    const note = document.getElementById('prep-notes-internal').value; 
    if(note) addLog(jo, note, 'internal'); 
    if(jo.type === 'Feed') jo.slides = parseInt(document.getElementById('prep-slides').value) || 1; 
    jo.stage = 'preparing'; 
    saveData(); 
    closeModal('modal-prep'); 
    renderBoard(); 
}

function openProg(id) { 
    document.getElementById('prog-id').value = id; 
    document.getElementById('prog-link').value = ''; 
    document.getElementById('modal-prog').style.display = 'flex'; 
}
function saveProgress() { 
    const jo = jobOrders.find(j => j.id === document.getElementById('prog-id').value); 
    const link = document.getElementById('prog-link').value; 
    if(!link) return alert("WAJIB ISI LINK PREVIEW!"); 
    jo.data.link = link; 
    jo.stage = 'review'; 
    jo.statusText = 'Menunggu Review'; 
    saveData(); 
    closeModal('modal-prog'); 
    renderBoard(); 
}

function openRev(id) { 
    document.getElementById('rev-id').value = id; 
    document.getElementById('rev-notes-client').value = ''; 
    document.getElementById('modal-rev').style.display = 'flex'; 
}
function saveReview(dec) { 
    const jo = jobOrders.find(j => j.id === document.getElementById('rev-id').value); 
    const note = document.getElementById('rev-notes-client').value; 
    if(dec === 'revisi') { 
        if(!note) return alert("Isi catatan revisi!"); 
        addLog(jo, `REVISI: ${note}`, 'client'); 
        jo.statusText = 'Revisi Klien'; 
    } else { 
        if(note) addLog(jo, `ACC NOTE: ${note}`, 'client'); 
        jo.statusText = 'Approved ✅'; 
        jo.stage = 'upload'; 
    } 
    saveData(); 
    closeModal('modal-rev'); 
    renderBoard(); 
}

function delayUpload(id) { 
    const jo = jobOrders.find(j => j.id === id); 
    addLog(jo, `STATUS: Upload Tertunda`, 'internal'); 
    jo.statusText = 'Upload Tertunda ⏳'; 
    saveData(); 
    renderBoard(); 
}
function doArchive(id) { 
    const jo = jobOrders.find(j => j.id === id); 
    jo.stage = 'archive'; 
    jo.archivedDate = new Date().toISOString(); 
    saveData(); 
    renderBoard(); 
}


// ==========================================
// 6. HELPER & UTILITY FUNCTIONS
// ==========================================

function createJob(type, title, batchID, slides=1) { 
    return { 
        id: Date.now() + Math.random().toString(16).slice(2), 
        category: 'Content', 
        type, 
        title, 
        batchID, 
        stage: 'scheduling', 
        slides: type==='Feed' ? slides : 1, 
        manualPrice: 0, 
        statusText: '', 
        portfolioLink: '', 
        periodLink: '',
        data: { ref:'', deadline:'', link:'' }, 
        history: [], 
        archivedDate: null 
    }; 
}

function openPeriodLink(key, cat) {
    document.getElementById('pl-period-key').value = key; 
    document.getElementById('pl-category-key').value = cat;
    
    const items = jobOrders.filter(j => (j.stage==='archive' || j.stage==='done'));
    const exist = items.find(j => getPeriod(new Date(j.archivedDate)).key === key && j.category === cat && j.periodLink);
    
    document.getElementById('pl-link').value = exist ? exist.periodLink : ''; 
    document.getElementById('modal-period-link').style.display = 'flex';
}
function savePeriodLink() {
    const key = document.getElementById('pl-period-key').value; 
    const cat = document.getElementById('pl-category-key').value; 
    const link = document.getElementById('pl-link').value;
    
    if(!link) return alert("Link Cloud Wajib Diisi!");
    
    jobOrders.forEach(jo => {
        if(jo.stage !== 'archive' && jo.stage !== 'done') return;
        const pDate = new Date(jo.archivedDate);
        if(getPeriod(pDate).key === key) {
             if(cat === 'Content' && (jo.category === 'Content')) jo.periodLink = link;
             else if(cat === 'General' && jo.category === 'General') jo.periodLink = link;
        }
    });
    saveData(); 
    closeModal('modal-period-link'); 
    renderSalaryTable('salary', cat === 'Content' ? 'content' : 'general');
}

function openFinalize(k, c) {
    const items = jobOrders.filter(j => j.stage==='archive' && getPeriod(new Date(j.archivedDate)).key === k && j.category === c);
    if(items.length === 0) return alert("Data tidak ditemukan.");
    
    const hasLink = items.some(i => i.periodLink);
    if(!hasLink) return alert("Link Hasil belum diisi!");
    
    document.getElementById('fin-period-key').value = k; 
    document.getElementById('fin-category-key').value = c;
    const link = items.find(i => i.periodLink).periodLink; 
    document.getElementById('fin-display-link').innerText = link; 
    document.getElementById('fin-display-link').href = link;
    
    document.getElementById('check-cloud').checked = false; 
    document.getElementById('check-master').checked = false; 
    document.getElementById('modal-finalize').style.display = 'flex';
}
function executeFinalize() {
    const k = document.getElementById('fin-period-key').value; 
    const c = document.getElementById('fin-category-key').value;
    
    if(!document.getElementById('check-cloud').checked || !document.getElementById('check-master').checked) return alert("Wajib checklist!");
    
    jobOrders.forEach(jo => { 
        if(jo.stage !== 'archive') return; 
        const d = new Date(jo.archivedDate); 
        if(getPeriod(d).key === k && (jo.category===c || (c==='Content' && jo.category==='Content'))) {
            jo.stage = 'done'; 
        }
    });
    saveData(); 
    closeModal('modal-finalize'); 
    renderSalaryTable('salary', c.toLowerCase()); 
    updateLifetimeIncome();
}

function openAdjustModal() {
    document.getElementById('adj-title').value = ''; 
    document.getElementById('adj-nominal').value = '';
    document.getElementById('adj-date-range').value = ''; 
    document.getElementById('adj-note').value = '';
    document.getElementById('modal-adjust').style.display = 'flex';
}
function saveAdjustment() {
    const title = document.getElementById('adj-title').value; 
    const nominal = parseInt(document.getElementById('adj-nominal').value);
    const dateRange = document.getElementById('adj-date-range').value; 
    const week = document.getElementById('adj-week').value;
    
    if(!title || !nominal) return alert("Data tidak lengkap!");
    
    const adjJob = { 
        id: Date.now() + 'ADJ', 
        category: 'Content', 
        type: 'Adjust', 
        title: `${title} (Pekan ${week})`, 
        manualPrice: nominal, 
        stage: 'archive', 
        archivedDate: new Date().toISOString(), 
        data: { deadline: dateRange }, 
        history: [{ date: new Date().toLocaleString(), msg: document.getElementById('adj-note').value, type: 'internal' }], 
        statusText: 'Adjustment' 
    };
    
    jobOrders.push(adjJob); 
    saveData(); 
    closeModal('modal-adjust'); 
    renderSalaryTable('salary', 'content');
}

function showJobDetail(id) {
    const jo = jobOrders.find(j => j.id === id); if(!jo) return;
    document.getElementById('det-title').innerText = jo.title; 
    document.getElementById('det-title').setAttribute('data-id', id);
    document.getElementById('det-batch').innerText = jo.batchID || '-'; 
    document.getElementById('det-cat').innerText = jo.category;
    document.getElementById('det-type').innerText = `${jo.type} ${jo.type==='Feed' ? `(${jo.slides}S)` : ''}`;
    document.getElementById('det-deadline').innerText = formatDate(jo.data.deadline);
    
    const dl = checkDeadline(jo.data.deadline); 
    const dlBadge = document.getElementById('det-deadline-badge'); 
    dlBadge.innerText = dl.text; dlBadge.className = dl.txt;
    
    document.getElementById('det-ref').innerHTML = linkify(jo.data.ref); 
    document.getElementById('det-link').innerHTML = linkify(jo.data.link); 
    document.getElementById('det-path').innerText = getPeriodPath(jo);
    
    setupPortfolio(jo, id); 
    renderHistoryLog(jo); 
    document.getElementById('modal-detail').style.display = 'flex';
}
let currentNoteId = null;
function openQuickNote() { 
    currentNoteId = document.getElementById('det-title').getAttribute('data-id'); 
    document.getElementById('quick-note-text').value = ''; 
    document.getElementById('modal-quick-note').style.display = 'flex'; 
}
function saveQuickNote() { 
    const txt = document.getElementById('quick-note-text').value; 
    const type = document.getElementById('quick-note-type').value; 
    const jo = jobOrders.find(j=>j.id === currentNoteId); 
    
    if(jo && txt) { 
        addLog(jo, txt, type); 
        saveData(); 
        renderHistoryLog(jo); 
        closeModal('modal-quick-note'); 
    } 
}
function addLog(jo, rawMsg, type) { 
    if(!rawMsg) return; 
    if(!jo.history) jo.history = []; 
    const finalMsg = rawMsg.startsWith(')') ? rawMsg : `) ${rawMsg}`; 
    jo.history.push({ date: new Date().toLocaleString('id-ID'), msg: finalMsg, type: type, voided: false }); 
}
function renderHistoryLog(jo) { 
    const c = document.getElementById('history-log-container'); 
    c.innerHTML = ''; 
    if(jo.history && jo.history.length > 0) {
        jo.history.forEach((h, i) => { 
            const typeClass = h.type === 'internal' ? 'internal' : 'client'; 
            const typeLabel = h.type === 'internal' ? '🔵 INTERNAL' : '🟠 KLIEN'; 
            c.innerHTML += `
                <div class="log-item ${typeClass} ${h.voided?'voided':''}">
                    <button class="btn-void-note" onclick="toggleVoidNote('${jo.id}', ${i})">${h.voided?'Unvoid':'✖'}</button>
                    <div class="log-meta"><span>${h.date}</span> <span>${typeLabel}</span></div>
                    <div class="log-content">${h.msg}</div>
                </div>`; 
        }); 
    } else {
        c.innerHTML = '<div style="color:#aaa; text-align:center;">Belum ada catatan.</div>'; 
    }
}
function toggleVoidNote(jobId, logIndex) { 
    const jo = jobOrders.find(j => j.id === jobId); 
    if(jo) { 
        jo.history[logIndex].voided = !jo.history[logIndex].voided; 
        saveData(); 
        renderHistoryLog(jo); 
    } 
}

function setupPortfolio(jo, id) { 
    const div = document.getElementById('portfolio-section'); 
    const inp = document.getElementById('det-portfolio-input'); 
    const disp = document.getElementById('det-portfolio-display'); 
    inp.setAttribute('data-id', id); 
    
    if(jo.category === 'General' && (jo.stage === 'archive' || jo.stage === 'done')) { 
        div.style.display = 'block'; 
        inp.value = jo.portfolioLink || ''; 
        disp.innerHTML = jo.portfolioLink ? `<a href="${jo.portfolioLink}" target="_blank">🔗 Buka Link</a>` : '-'; 
    } else { 
        div.style.display = 'none'; 
    } 
}
function savePortfolioLink() { 
    const inp = document.getElementById('det-portfolio-input'); 
    const jo = jobOrders.find(j=>j.id===inp.getAttribute('data-id')); 
    if(jo){ 
        jo.portfolioLink = inp.value; 
        saveData(); 
        setupPortfolio(jo, jo.id); 
    } 
}

function checkDeadline(dateStr) {
    if(!dateStr) return { text: 'No Date', bg: '', txt: '' };
    const today = new Date(); today.setHours(0,0,0,0); 
    const dl = new Date(dateStr); dl.setHours(0,0,0,0);
    const diff = (dl - today) / (1000 * 60 * 60 * 24);
    
    if(diff < 0) return { text: 'OVERDUE', bg: 'bg-urgent', txt: 'txt-urgent' };
    if(diff === 0) return { text: 'HARI INI', bg: 'bg-urgent', txt: 'txt-urgent' };
    if(diff <= 3) return { text: `${diff} Hari Lagi`, bg: 'bg-warning', txt: 'txt-warning' };
    return { text: formatDate(dateStr), bg: 'bg-safe', txt: 'txt-safe' };
}
function getPeriodPath(jo) { 
    const d = jo.data.deadline ? new Date(jo.data.deadline) : new Date(); 
    const p = getPeriod(d); 
    return `my space/00 Freelance/${d.getFullYear()}/${p.monthName}/${p.periodStr}/Master`; 
}
function getPeriod(dateObj) { 
    const day = dateObj.getDate(); 
    const month = dateObj.toLocaleString('id-ID', { month: 'long' }); 
    let pName = (day > 20) ? 2 : 1; 
    
    return { 
        key: `${month} ${dateObj.getFullYear()} - P${pName}`, 
        monthName: month, 
        periodStr: `Periode ${pName}` 
    }; 
}

// --- PASSWORD PROTECTION ---
function switchView(v) {
    if (v === 'done') {
        const userPin = prompt("🔒 Masukkan PIN Keamanan:");
        if (userPin !== 'AT240104') { // <--- GANTI PIN DI SINI
            return alert("❌ PIN Salah!"); 
        }
    }
    
    ['board','salary','done'].forEach(x => { document.getElementById(`view-${x}`).style.display='none'; });
    
    const targetEl = document.getElementById(`view-${v}`); 
    if(targetEl) targetEl.style.display = v === 'board' ? 'flex' : 'block'; 
    
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    const menuEl = document.getElementById(`menu-${v}`); 
    if(menuEl) menuEl.classList.add('active');
    
    if(v === 'board') renderBoard(); 
    if(v === 'salary') switchTab('salary','content'); 
    if(v === 'done') { 
        switchTab('history','content'); 
        updateLifetimeIncome(); 
    } 
}

function switchTab(v, c) { 
    const p = v==='salary' ? 'view-salary' : 'view-done'; 
    document.querySelectorAll(`#${p} .tab-btn`).forEach(b=>b.classList.remove('active')); 
    
    if(c==='content') document.querySelectorAll(`#${p} .tab-btn`)[0].classList.add('active'); 
    else document.querySelectorAll(`#${p} .tab-btn`)[1].classList.add('active'); 
    
    document.querySelectorAll(`#${p} .tab-content`).forEach(e=>e.classList.remove('active')); 
    document.getElementById(c==='content' ? `${v==='salary'?'salary':'history'}-content` : `${v==='salary'?'salary':'history'}-general`).classList.add('active'); 
    
    renderSalaryTable(v, c); 
}

function closeModal(id) { document.getElementById(id).style.display='none'; }
function saveData() { localStorage.setItem('jo_db_v47', JSON.stringify(jobOrders)); }
function formatRp(n) { return new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 }).format(n); }
function formatDate(s) { return s ? new Date(s).toLocaleDateString('id-ID') : '-'; }
function linkify(t) { return t ? t.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>') : '-'; }

function deleteJob(id, e) { 
    if(e) e.stopPropagation(); 
    if(confirm("Hapus Permanen?")) { 
        jobOrders = jobOrders.filter(j => j.id !== id); 
        saveData(); 
        if(document.getElementById('view-board').style.display !== 'none') renderBoard(); 
        else renderSalaryTable(window.currentViewType, window.currentCategory); 
    } 
}
function voidJob(id, e) { 
    if(e) e.stopPropagation(); 
    const jo = jobOrders.find(j => j.id === id); 
    const idx = STAGE_FLOW.indexOf(jo.stage); 
    
    if(confirm(`VOID Job ini?`)) { 
        if(jo.type==='Adjust'){ deleteJob(id); return; } 
        if(jo.stage === 'archive' || jo.stage === 'done') { jo.stage = 'upload'; jo.archivedDate = null; } 
        else if (idx > 0) jo.stage = STAGE_FLOW[idx - 1]; 
        else jo.statusText = 'VOIDED'; 
        
        if(jo.stage !== 'review') jo.statusText = ''; 
        saveData(); 
        if(document.getElementById('view-board').style.display !== 'none') renderBoard(); 
        else renderSalaryTable(window.currentViewType, window.currentCategory); 
    } 
}
function updateLifetimeIncome() { 
    const total = jobOrders.filter(j => j.stage === 'done').reduce((sum, j) => { 
        let price = (j.type==='Adjust'||j.category==='General') ? (j.manualPrice || 0) : (j.type === 'Story' ? RATES.story : j.type === 'Reels' ? RATES.reels : RATES.feed * (j.slides || 1)); 
        return sum + price; 
    }, 0); 
    document.getElementById('grand-total').innerText = formatRp(total); 
}
function downloadBackup() { 
    const a = document.createElement('a'); 
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(jobOrders)); 
    a.download = `JO_Backup_${new Date().toISOString().slice(0,10)}.json`; 
    document.body.appendChild(a); a.click(); a.remove(); 
}
function restoreBackup(i) { 
    const f = i.files[0]; 
    if(f) { 
        const r = new FileReader(); 
        r.onload = e => { 
            try { 
                const d = JSON.parse(e.target.result); 
                if(Array.isArray(d) && confirm("Restore Data dan Timpa data lama?")) { 
                    jobOrders = d; 
                    saveData(); 
                    renderBoard(); 
                    alert("Data berhasil direstore!"); 
                } 
            } catch(x) { alert("File Error/Corrupt"); } 
        }; 
        r.readAsText(f); 
    } 
}

// ==========================================
// 7. AUTO CLOSE MODAL (NEW FEATURE)
// ==========================================
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = "none";
    }

}
