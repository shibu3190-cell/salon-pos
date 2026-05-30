function showToast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div'); t.className = `toast ${type}`;
    t.innerHTML = `<span>${type==='success'?'✅':'⚠️'}</span> <div>${msg}</div>`;
    c.appendChild(t);
    setTimeout(() => { t.classList.add('fadeOut'); t.addEventListener('animationend', () => t.remove()); }, 3000);
}

const SALT = "SALON_PRO_V1", MASTER_KEY = "MASTER2026";
let deviceId = localStorage.getItem('salon_device_id');
if (!deviceId) { deviceId = 'DEV-' + Math.random().toString(36).substr(2, 8).toUpperCase(); localStorage.setItem('salon_device_id', deviceId); }

function checkActivation() {
    document.getElementById('display-device-id').innerText = deviceId;
    const actStr = localStorage.getItem('salon_activation');
    if (actStr) {
        try {
            const act = JSON.parse(actStr);
            if (act.isMaster || (act.expiry > Date.now() && act.deviceId === deviceId)) {
                document.getElementById('activation-overlay').style.display = 'none'; return; 
            }
        } catch(e) {}
    }
    document.getElementById('activation-overlay').style.display = 'flex';
}

function activateDevice() {
    const key = document.getElementById('activation-key-input').value.trim();
    if (!key) return showToast("Enter a key.", "error");
    if (key === MASTER_KEY) {
        localStorage.setItem('salon_activation', JSON.stringify({ isMaster: true }));
        document.getElementById('activation-key-input').value = ''; showToast("Master Key Accepted!", "success");
        setTimeout(() => checkActivation(), 500); return;
    }
    try {
        const cleanKey = key.replace(/\s+/g, ''); const decoded = atob(cleanKey); const parts = decoded.split('|');
        if (parts.length === 3 && parts[0] === deviceId && parts[2] === SALT) {
            const expiry = parseInt(parts[1], 10);
            if (expiry > Date.now()) {
                localStorage.setItem('salon_activation', JSON.stringify({ key: cleanKey, expiry, deviceId, isMaster: false }));
                document.getElementById('activation-key-input').value = ''; showToast("Activated Successfully!", "success");
                setTimeout(() => checkActivation(), 500);
            } else showToast("Key Expired.", "error");
        } else showToast("Invalid Key for this device.", "error");
    } catch (e) { showToast("Invalid Format.", "error"); }
}

function logoutDevice() { localStorage.removeItem('salon_activation'); checkActivation(); showToast("Application Locked.", "success"); }

let clickCount = 0;
function adminAccess() {
    clickCount++;
    if (clickCount >= 5) {
        clickCount = 0; 
        document.getElementById('admin-target-id').value = '';
        document.getElementById('admin-key-result').style.display = 'none';
        document.getElementById('admin-modal').style.display = 'flex';
    }
    setTimeout(() => clickCount = 0, 2000);
}
function closeAdminModal() { document.getElementById('admin-modal').style.display = 'none'; }
function generateAdminKey() {
    const targetId = document.getElementById('admin-target-id').value.trim();
    if(!targetId) return showToast("Enter Device ID", "error");
    const rawKey = targetId + '|' + (Date.now() + (180 * 24 * 60 * 60 * 1000)) + '|' + SALT;
    const resultDiv = document.getElementById('admin-key-result');
    resultDiv.innerText = btoa(rawKey); resultDiv.style.display = 'block';
}

const DatabaseService = {
    load(key, def) { const d = localStorage.getItem(key); return d ? JSON.parse(d) : def; },
    save(key, d) { localStorage.setItem(key, JSON.stringify(d)); },
    exportDataToFile() {
        const fb = { salon_identity: this.load('salon_identity',{}), salon_services: this.load('salon_services',[]), salon_staff: this.load('salon_staff',[]), salon_chairs: this.load('salon_chairs',[]), salon_inventory: this.load('salon_inventory',[]), salon_history: this.load('salon_history',[]) };
        const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fb)); a.download = "salon_backup.json"; document.body.appendChild(a); a.click(); a.remove();
    },
    importDataFromFile(e) {
        const f = e.target.files[0]; if (!f) return; const r = new FileReader();
        r.onload = (ev) => {
            try {
                const d = JSON.parse(ev.target.result);
                ['salon_identity','salon_services','salon_staff','salon_chairs','salon_inventory','salon_history'].forEach(k => { if(d[k]) this.save(k, d[k]); });
                showToast("Restored! Reloading...", "success"); setTimeout(() => location.reload(), 1500);
            } catch(err) { showToast("Invalid backup.", "error"); }
        }; r.readAsText(f);
    }
};

let barcodeBuffer = ''; let barcodeTimer = null;
document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' && e.target.id !== 'pos-search' && e.target.id !== 'inv-sku') return;
    if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 3) { e.preventDefault(); e.stopPropagation(); processScannedBarcode(barcodeBuffer.trim()); barcodeBuffer = ''; }
        return;
    }
    if (e.key.length > 1) return;
    barcodeBuffer += e.key;
    clearTimeout(barcodeTimer); barcodeTimer = setTimeout(() => { barcodeBuffer = ''; }, 200); 
});

function processScannedBarcode(sku) {
    if(document.getElementById('inventory').classList.contains('active')) {
        let input = document.getElementById('inv-sku');
        if(input.value) input.value += ', ' + sku; else input.value = sku;
        showToast("Barcode Scanned!", "success"); return;
    }
    if(document.getElementById('pos').classList.contains('active')) {
        let product = inventory.find(p => p.skus && p.skus.includes(sku));
        if (product) { addToCart(product.name, product.price, 'product', product.id); showToast(`Added: ${product.name}`, "success"); } 
        else showToast(`Barcode ${sku} not found.`, "error");
    }
}

let html5QrcodeScanner = null; let cameraTargetContext = '';
function openCamera(context) {
    cameraTargetContext = context; document.getElementById('camera-modal').style.display = 'flex';
    html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
    html5QrcodeScanner.render(onScanSuccess, () => {});
}
function closeCamera() { if(html5QrcodeScanner) { html5QrcodeScanner.clear(); html5QrcodeScanner = null; } document.getElementById('camera-modal').style.display = 'none'; }
function onScanSuccess(decodedText) { closeCamera(); processScannedBarcode(decodedText); }

let shopIdentity = DatabaseService.load('salon_identity', { name: "My Salon", logo: "" });
let services = DatabaseService.load('salon_services', [{ id: 's1', name: 'Basic Haircut', category: 'Hair', price: 200 }]);
let staffList = DatabaseService.load('salon_staff', ['Amit (Stylist)']);
let chairList = DatabaseService.load('salon_chairs', ['Chair 1']);
let inventory = DatabaseService.load('salon_inventory', []);
let historyLog = DatabaseService.load('salon_history', []);
let cart = []; let subtotalAmount = 0; let cartHasService = false; let editingInvId = null;

document.addEventListener('DOMContentLoaded', () => { checkActivation(); renderDropdowns(); renderPOSItems(); renderCart(); renderInventoryTable(); });

function openTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.bottom-nav button').forEach(l => l.classList.remove('active'));
    document.getElementById(id).classList.add('active'); event.currentTarget.classList.add('active');
    if(id==='pos') { renderPOSItems(); renderDropdowns(); document.getElementById('pos-search').value=''; }
    if(id==='history') populateHistoryFilters(); 
    if(id==='inventory') renderInventoryTable();
    if(id==='settings') renderSettings();
}

function renderDropdowns() {
    const staffOpts = `<option disabled selected>Select Staff</option>` + staffList.map(s => `<option value="${s}">${s}</option>`).join('');
    const chairOpts = `<option disabled selected>Select Chair</option>` + chairList.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('modal-staff-select').innerHTML = staffOpts; document.getElementById('modal-chair-select').innerHTML = chairOpts;
}

function renderPOSItems() { filterRetailPOS(); }
function filterRetailPOS() {
    const q = document.getElementById('pos-search').value.toLowerCase();
    let serv = q ? services.filter(s => s.name.toLowerCase().includes(q)) : services;
    document.getElementById('services-grid').innerHTML = serv.map(s => `<div class="item-btn" onclick="addToCart('${s.name}', ${s.price}, 'service', '${s.id}')"><strong>${s.name}</strong><span>₹${s.price}</span></div>`).join('');
    
    let inv = q ? inventory.filter(p => p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q)) || (p.skus && p.skus.join(' ').toLowerCase().includes(q))) : inventory;
    document.getElementById('retail-grid').innerHTML = inv.map(p => `<div class="item-btn" onclick="addToCart('${p.name}', ${p.price}, 'product', '${p.id}')" ${p.stock <= 0 ? 'style="opacity:0.4; pointer-events:none;"' : ''}><div class="badge">${p.stock}</div><strong>${p.name}</strong><small>${p.brand||'No Brand'}</small><span>₹${p.price}</span></div>`).join('');
}

function addToCart(name, price, type, id) { 
    let existingItem = cart.find(i => i.id === id);
    if (type === 'product') {
        let invItem = inventory.find(inv => inv.id === id);
        let currentQty = existingItem ? existingItem.qty : 0;
        if (!invItem || currentQty >= invItem.stock) return showToast(`Not enough stock.`, 'error');
    }
    if (existingItem) existingItem.qty += 1;
    else cart.push({ cartItemId: Date.now().toString(), id, name, price, type, qty: 1 });
    if (type === 'product') document.getElementById('pos-search').value = ''; 
    filterRetailPOS(); renderCart(); 
}

function renderCart() {
    const c = document.getElementById('cart-items'); subtotalAmount = 0; cartHasService = false;
    if(cart.length === 0) { c.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Cart is empty</div>'; document.getElementById('retail-only-badge').style.display = 'none'; } 
    else {
        c.innerHTML = cart.map((item) => {
            subtotalAmount += (item.price * item.qty); if(item.type === 'service') cartHasService = true;
            let lbl = item.type === 'product' ? `<span style="color:var(--retail); font-size:10px; font-weight:800;">[RETAIL]</span>` : `<span style="color:var(--brand-primary); font-size:10px; font-weight:800;">[SERVICE]</span>`;
            let qtyDisplay = item.qty > 1 ? `<span class="qty-badge">x${item.qty}</span>` : '';
            return `<div class="cart-item"><div class="cart-item-info">${lbl} <strong>${item.name} ${qtyDisplay}</strong></div><div class="cart-item-price">₹${item.price * item.qty} <button class="btn-danger" style="border:none;" onclick="removeFromCart('${item.cartItemId}')">✖</button></div></div>`;
        }).join('');
        document.getElementById('retail-only-badge').style.display = !cartHasService ? 'inline-block' : 'none';
    }
    document.getElementById('cart-subtotal').innerText = `₹${subtotalAmount.toFixed(2)}`; c.scrollTop = c.scrollHeight;
}

function removeFromCart(cartItemId) { 
    let itemIndex = cart.findIndex(i => i.cartItemId === cartItemId);
    if(itemIndex > -1) { if(cart[itemIndex].qty > 1) cart[itemIndex].qty -= 1; else cart.splice(itemIndex, 1); renderCart(); }
}

function openCheckout() {
    if(cart.length === 0) return showToast("Cart is empty.", "error");
    if(!cartHasService) { document.getElementById('modal-staff-select').style.display = 'none'; document.getElementById('modal-chair-select').style.display = 'none'; } 
    else { document.getElementById('modal-staff-select').style.display = 'block'; document.getElementById('modal-chair-select').style.display = 'block'; }
    document.getElementById('modal-subtotal').innerText = `₹${subtotalAmount.toFixed(2)}`; document.getElementById('modal-discount').value = 0; updateModalTotal();
    document.body.style.overflow = 'hidden'; document.getElementById('checkout-modal').style.display = 'flex';
}
function closeCheckout() { document.body.style.overflow = ''; document.getElementById('checkout-modal').style.display = 'none'; }
function updateModalTotal() { let disc = parseFloat(document.getElementById('modal-discount').value) || 0; let finalT = Math.max(0, subtotalAmount - disc); document.getElementById('modal-final-total').innerText = `₹${finalT.toFixed(2)}`; }

function generateBill() {
    const cName = document.getElementById('modal-cust-name').value, cPhone = document.getElementById('modal-cust-phone').value;
    let staff = document.getElementById('modal-staff-select').value, chair = document.getElementById('modal-chair-select').value;
    let disc = parseFloat(document.getElementById('modal-discount').value) || 0;

    if (!cName) return showToast('Enter Customer Name.', 'error');
    if (cartHasService && staff === 'Select Staff') return showToast('Select a Staff member.', 'error');
    if (!cartHasService) { staff = 'Retail Sale'; chair = 'Counter'; }

    for (let item of cart) {
        if (item.type === 'product') {
            let invItem = inventory.find(x => x.id === item.id);
            if (!invItem || invItem.stock < item.qty) return showToast(`Critical: Not enough stock for ${item.name}!`, "error");
        }
    }

    let finalT = Math.max(0, subtotalAmount - disc);
    let sHtml = '', pHtml = '', names = [];

    cart.forEach(i => {
        let dName = i.qty > 1 ? `${i.name} (x${i.qty})` : i.name; names.push(dName); 
        let tr = `<tr><td>${i.name} ${i.qty > 1 ? 'x'+i.qty : ''}</td><td style="text-align:right">₹${i.price * i.qty}</td></tr>`;
        if (i.type === 'service') sHtml += tr;
        else if (i.type === 'product') { pHtml += tr; let inv = inventory.find(x => x.id === i.id); if (inv && inv.stock > 0) inv.stock -= i.qty; }
    });

    const now = new Date(); const dStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    const rawCartData = JSON.parse(JSON.stringify(cart));
    const bill = { id: Date.now().toString(), date: now.toLocaleString(), dateOnly: dStr, customer: cPhone ? `${cName} (${cPhone})` : cName, staffName: staff, staffChair: `${staff} - ${chair !== 'Select Chair' ? chair : 'N/A'}`, items: names.join(', '), discount: disc, total: finalT, isRetailOnly: !cartHasService, rawCart: rawCartData };
    
    historyLog.unshift(bill); DatabaseService.save('salon_history', historyLog); DatabaseService.save('salon_inventory', inventory);
    
    document.getElementById('print-shop-name').innerText = shopIdentity.name;
    const logo = document.getElementById('print-logo'); if (shopIdentity.logo) { logo.src = shopIdentity.logo; logo.style.display = 'inline-block'; } else { logo.style.display = 'none'; }
    document.getElementById('print-date').innerText = bill.date; document.getElementById('print-cust').innerText = cName;
    document.getElementById('print-staff-div').style.display = bill.isRetailOnly ? 'none' : 'block'; document.getElementById('print-staff').innerText = staff;
    
    const secS = document.getElementById('print-services-section'), secP = document.getElementById('print-products-section');
    if (sHtml) { secS.style.display = 'block'; document.getElementById('print-items-services').innerHTML = sHtml; } else secS.style.display = 'none';
    if (pHtml) { secP.style.display = 'block'; document.getElementById('print-items-products').innerHTML = pHtml; } else secP.style.display = 'none';
    document.getElementById('print-subtotal').innerText = subtotalAmount.toFixed(2); document.getElementById('print-discount').innerText = disc.toFixed(2); document.getElementById('print-final-total').innerText = finalT.toFixed(2);
    
    closeCheckout(); showToast("Bill Generated!", "success"); setTimeout(() => { window.print(); }, 200);
    
    cart = []; document.getElementById('modal-cust-name').value = ''; document.getElementById('modal-cust-phone').value = ''; document.getElementById('modal-discount').value = '0'; 
    document.getElementById('modal-staff-select').selectedIndex = 0; document.getElementById('modal-chair-select').selectedIndex = 0;
    renderCart(); renderPOSItems();
}

function populateHistoryFilters() { resetFilters(); document.getElementById('hist-staff-filter').innerHTML = '<option value="all">All Staff & Retail</option>' + staffList.map(s => `<option value="${s}">${s}</option>`).join(''); }
function resetFilters() { const now = new Date(); const todayStr = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0'); document.getElementById('hist-date-filter').value = todayStr; document.getElementById('hist-staff-filter').value = 'all'; filterHistory(); }
function filterHistory() {
    const d = document.getElementById('hist-date-filter').value, s = document.getElementById('hist-staff-filter').value;
    let f = historyLog;
    if (d) f = f.filter(l => l.dateOnly === d || (l.date && l.date.includes(d.split('-').reverse().join('/'))));
    if (s && s !== 'all') f = f.filter(l => l.staffName === s || (l.staffChair && l.staffChair.includes(s)));
    let tr = 0; const tbody = document.querySelector('#history-table tbody');
    if (f.length === 0) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 20px;">No records found.</td></tr>';
    else {
        tbody.innerHTML = f.map(l => {
            tr += l.total; let b = l.isRetailOnly ? `<span style="background:var(--retail); color:white; padding:2px 6px; border-radius:4px; font-size:10px;">RETAIL</span>` : `<span style="border:1px solid var(--border); padding:2px 6px; border-radius:4px; font-size:11px;">${l.staffChair}</span>`;
            return `<tr><td style="font-size:11px;">${l.date}</td><td><strong>${l.customer}</strong></td><td>${b}</td><td style="font-size:11px;">${l.items}</td><td><strong>₹${l.total.toFixed(2)}</strong></td><td><button class="btn-danger btn-small" style="background:var(--brand-primary); border-color:var(--brand-primary);" onclick="editBill('${l.id}')">Edit</button></td></tr>`;
        }).join('');
    }
    document.getElementById('hist-total-sales').innerText = `₹${tr.toFixed(2)}`;
}

function editBill(billId) {
    if(!confirm("Editing reverses stock, deletes the record, and loads it to the cart. Continue?")) return;
    let billIndex = historyLog.findIndex(b => b.id === billId);
    if(billIndex === -1) return showToast("Bill not found.", "error");
    let bill = historyLog[billIndex];
    if(bill.rawCart) { bill.rawCart.forEach(item => { if(item.type === 'product') { let invItem = inventory.find(i => i.id === item.id); if(invItem) invItem.stock += item.qty; }}); }
    cart = bill.rawCart ? JSON.parse(JSON.stringify(bill.rawCart)) : [];
    document.getElementById('modal-cust-name').value = bill.customer.split(' (')[0] || '';
    document.getElementById('modal-discount').value = bill.discount || 0;
    historyLog.splice(billIndex, 1); DatabaseService.save('salon_history', historyLog); DatabaseService.save('salon_inventory', inventory);
    showToast("Bill reloaded.", "success"); openTab('pos'); renderCart();
}

function exportToCSV(type) {
    let sd = document.getElementById('hist-date-filter').value; if(!sd) { const now = new Date(); sd = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0'); }
    let exp = historyLog;
    if(type === 'daily') exp = historyLog.filter(l => l.dateOnly === sd || (l.date && l.date.includes(sd.split('-').reverse().join('/'))));
    else if (type === 'monthly') { let ym = sd.substring(0, 7); exp = historyLog.filter(l => l.dateOnly && l.dateOnly.startsWith(ym)); }
    if(exp.length === 0) return showToast("No records.", "error");
    let csv = "data:text/csv;charset=utf-8,Date,Customer,Type/Staff,Items,Discount,Total Amount\n";
    exp.forEach(r => { csv += `${r.date},"${r.customer.replace(/"/g, '""')}","${(r.isRetailOnly ? 'RETAIL' : r.staffChair).replace(/"/g, '""')}","${r.items.replace(/"/g, '""')}",${r.discount},${r.total}\n`; });
    const a = document.createElement("a"); a.href = encodeURI(csv); a.download = `Report_${type}_${sd}.csv`; document.body.appendChild(a); a.click(); a.remove();
}

function addInventory() {
    const n = document.getElementById('inv-name').value, b = document.getElementById('inv-brand').value, c = document.getElementById('inv-category').value, rawSku = document.getElementById('inv-sku').value, p = parseFloat(document.getElementById('inv-price').value), s = parseInt(document.getElementById('inv-stock').value);
    if(!n || !p || !s) return showToast("Fill Name, Price and Qty.", "error");
    let skuArray = rawSku.split(',').map(x => x.trim()).filter(x => x);
    if(editingInvId) {
        let item = inventory.find(i => i.id === editingInvId);
        if(item) { item.name = n; item.brand = b; item.category = c; item.skus = skuArray; item.price = p; item.stock = s; }
        editingInvId = null; document.getElementById('inv-form-title').innerText = "➕ Add Retail Product"; document.getElementById('btn-save-inv').innerText = "Save Product"; document.getElementById('btn-cancel-inv').style.display = 'none'; showToast("Updated", "success");
    } else { inventory.push({ id: 'p' + Date.now(), name:n, brand:b, category:c, skus:skuArray, price:p, stock:s }); showToast("Saved", "success"); }
    DatabaseService.save('salon_inventory', inventory); renderInventoryTable();
    ['inv-name','inv-brand','inv-category','inv-sku','inv-price','inv-stock'].forEach(id => document.getElementById(id).value = '');
}

function editInventory(id) {
    let item = inventory.find(i => i.id === id); if(!item) return; editingInvId = id;
    document.getElementById('inv-name').value = item.name; document.getElementById('inv-brand').value = item.brand || ''; document.getElementById('inv-category').value = item.category || '';
    document.getElementById('inv-sku').value = item.skus ? item.skus.join(', ') : ''; document.getElementById('inv-price').value = item.price; document.getElementById('inv-stock').value = item.stock;
    document.getElementById('inv-form-title').innerText = "✏️ Edit Product"; document.getElementById('btn-save-inv').innerText = "Update Product"; document.getElementById('btn-cancel-inv').style.display = 'inline-block'; window.scrollTo(0,0);
}
function cancelInventoryEdit() { editingInvId = null; document.getElementById('inv-form-title').innerText = "➕ Add Retail Product"; document.getElementById('btn-save-inv').innerText = "Save Product"; document.getElementById('btn-cancel-inv').style.display = 'none'; ['inv-name','inv-brand','inv-category','inv-sku','inv-price','inv-stock'].forEach(id => document.getElementById(id).value = ''); }
function deleteInventory(id) { inventory = inventory.filter(i => i.id !== id); DatabaseService.save('salon_inventory', inventory); renderInventoryTable(); showToast("Deleted", "success");}

function renderInventoryTable() { 
    const cats = [...new Set(inventory.map(i => i.category).filter(c => c))];
    let filterSel = document.getElementById('inv-cat-filter'); let currentCat = filterSel.value;
    filterSel.innerHTML = '<option value="all">All Categories</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    filterSel.value = currentCat || 'all';
    let filteredInv = (filterSel.value && filterSel.value !== 'all') ? inventory.filter(i => i.category === filterSel.value) : inventory;

    document.querySelector('#inventory-table tbody').innerHTML = filteredInv.map(i => `<tr>
        <td><strong>${i.name}</strong><br><span style="font-size:11px;">${i.brand||'-'}</span></td><td>${i.category||'-'}</td>
        <td style="font-family:monospace; font-size:11px;">${i.skus ? i.skus.join(',<br>') : '-'}</td><td>₹${i.price}</td><td><strong>${i.stock}</strong></td>
        <td><div class="action-group"><button class="btn-primary btn-small" onclick="editInventory('${i.id}')">Edit</button><button class="btn-danger btn-small" onclick="deleteInventory('${i.id}')">Del</button></div></td>
    </tr>`).join(''); 
}

function encodeLogo() { const f = document.getElementById('set-shop-logo').files[0]; if(f){ const r = new FileReader(); r.onloadend = () => { shopIdentity.logo = r.result; document.getElementById('logo-preview').src = r.result; document.getElementById('logo-preview').style.display = 'inline-block'; }; r.readAsDataURL(f); } }
function saveShopIdentity() { shopIdentity.name = document.getElementById('set-shop-name').value || "My Salon"; DatabaseService.save('salon_identity', shopIdentity); showToast("Identity Saved!", "success"); }
function renderSettings() {
    document.getElementById('set-shop-name').value = shopIdentity.name; if(shopIdentity.logo) { document.getElementById('logo-preview').src = shopIdentity.logo; document.getElementById('logo-preview').style.display = 'inline-block'; }
    document.getElementById('settings-services-list').innerHTML = services.map(s => `<div class="list-item"><strong>${s.name}</strong> <span>₹${s.price} <button class="btn-danger" style="margin-left:10px;" onclick="deleteService('${s.id}')">Del</button></span></div>`).join('');
    document.getElementById('settings-staff-list').innerHTML = staffList.map((s, i) => `<div class="list-item"><strong>${s}</strong> <button class="btn-danger" onclick="deleteStaff(${i})">Del</button></div>`).join('');
    document.getElementById('settings-chair-list').innerHTML = chairList.map((c, i) => `<div class="list-item"><strong>${c}</strong> <button class="btn-danger" onclick="deleteChair(${i})">Del</button></div>`).join('');
}
function saveAndRefresh(k, d, rf) { DatabaseService.save(k, d); rf(); renderDropdowns(); renderPOSItems(); }
function addService() { const n = document.getElementById('set-service-name').value, c = document.getElementById('set-service-cat').value || "Gen", p = parseFloat(document.getElementById('set-service-price').value); if(!n || !p) return showToast("Enter name & price", "error"); services.push({ id: 's' + Date.now(), name:n, category: c, price:p }); saveAndRefresh('salon_services', services, renderSettings); ['set-service-name', 'set-service-price', 'set-service-cat'].forEach(id => document.getElementById(id).value = ''); showToast("Service Added", "success");}
function addStaff() { const n = document.getElementById('set-staff-name').value; if(n) { staffList.push(n); saveAndRefresh('salon_staff', staffList, renderSettings); document.getElementById('set-staff-name').value=''; showToast("Staff Added", "success");} }
function addChair() { const n = document.getElementById('set-chair-name').value; if(n) { chairList.push(n); saveAndRefresh('salon_chairs', chairList, renderSettings); document.getElementById('set-chair-name').value=''; showToast("Chair Added", "success");} }
function deleteService(id) { services = services.filter(s => s.id !== id); saveAndRefresh('salon_services', services, renderSettings); }
function deleteStaff(i) { staffList.splice(i, 1); saveAndRefresh('salon_staff', staffList, renderSettings); }
function deleteChair(i) { chairList.splice(i, 1); saveAndRefresh('salon_chairs', chairList, renderSettings); }
