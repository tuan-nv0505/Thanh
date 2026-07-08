async function apiSubmit(event, url, method) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const repCheck = form.querySelector('[name="is_representative"]');
    if (repCheck) data.is_representative = repCheck.checked;

    const deductCheck = form.querySelector('[name="deduct_deposit"]');
    if (deductCheck) data.deduct_deposit = deductCheck.checked ? 'on' : 'off';

    try {
        const res = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (res.ok) {
            if (url.includes('/invoices')) {
                const openDialog = form.closest('dialog');
                let wFee = 0;
                let tFee = 0;

                if (openDialog) {
                    wFee = parseFloat(openDialog.getAttribute('data-wifi-fee')) || 0;
                    tFee = parseFloat(openDialog.getAttribute('data-trash-fee')) || 0;
                    openDialog.close();
                }

                result.data.start_date = data.start_date;
                result.data.end_date = data.end_date;

                showInvoiceReceipt(result.data, wFee, tFee);
            } else {
                window.location.reload();
            }
        } else {
            alert("LỖI HỆ THỐNG: " + result.error);
        }
    } catch(e) {
        alert("Lỗi kết nối đến máy chủ quản lý!");
        console.error(e);
    }
}

function showInvoiceReceipt(data, roomWifi = 0, roomTrash = 0) {
    window.currentBillTotalValue = data.total; // Lưu lại để tính tổng gộp

    // Ẩn các trường gộp đi mỗi khi mở lại modal mới
    document.getElementById('oldInvoiceSection').style.display = 'none';
    document.getElementById('currentInvoiceTitleLabel').style.display = 'none';
    const rowCombo = document.getElementById('rowCombinedTotal');
    if(rowCombo) rowCombo.style.display = 'none';

    document.getElementById('billRoom').innerText = data.room_name;
    document.getElementById('billGroup').innerText = data.group_name;

    const dateObj = new Date();
    const dateString = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    document.getElementById('billDate').innerText = dateString;

//    const rangeBlock = document.getElementById('rowBillDateRange');
//    const rangeText = document.getElementById('billDateRange');
//    if (data.start_date && data.end_date) {
//        const reverseDate = (dStr) => dStr.split('-').reverse().join('/');
//        rangeBlock.style.display = 'flex';
//        rangeText.innerText = `${reverseDate(data.start_date)} - ${reverseDate(data.end_date)}`;
//    } else {
//        rangeBlock.style.display = 'none';
//    }

    document.getElementById('billRent').innerText = data.room_rent.toLocaleString('vi-VN');

    // Điện
    document.getElementById('billElecOld').innerText = data.elec_old;
    document.getElementById('billElecNew').innerText = data.elec_new;
    document.getElementById('billElecUsage').innerText = data.elec_usage;
    document.getElementById('billElecPrice').innerText = data.elec_price.toLocaleString('vi-VN');
    document.getElementById('billElec').innerText = data.elec_cost.toLocaleString('vi-VN');

    // Nước
    document.getElementById('billWaterOld').innerText = data.water_old;
    document.getElementById('billWaterNew').innerText = data.water_new;
    document.getElementById('billWaterUsage').innerText = data.water_usage;
    document.getElementById('billWaterPrice').innerText = data.water_price.toLocaleString('vi-VN');
    document.getElementById('billWater').innerText = data.water_cost.toLocaleString('vi-VN');

    // Wifi, Rác
    let wifiCost = 0;
    let trashCost = 0;
    if (data.services_fee > 0) {
        wifiCost = roomWifi;
        trashCost = roomTrash;
    }
    document.getElementById('billWifi').innerText = wifiCost.toLocaleString('vi-VN');
    document.getElementById('billTrash').innerText = trashCost.toLocaleString('vi-VN');

    // Khấu trừ
    const deductBlock = document.getElementById('rowBillDeduct');
    if (data.deducted > 0) {
        deductBlock.style.display = 'table-row';
        document.getElementById('billDeduct').innerText = `-` + data.deducted.toLocaleString('vi-VN');
    } else {
        if(deductBlock) deductBlock.style.display = 'none';
    }

    // Tổng
    const totalLabel = document.getElementById('billTotalLabel');
    const totalValue = document.getElementById('billTotal');

    if (data.total < 0) {
        totalLabel.innerText = "HOÀN KHÁCH";
        totalValue.innerText = Math.abs(data.total).toLocaleString('vi-VN');
    } else {
        totalLabel.innerText = "TỔNG";
        totalValue.innerText = data.total.toLocaleString('vi-VN');
    }

    document.getElementById('receiptModal').showModal();
}

function saveInvoiceImage() {
    const content = document.getElementById('invoiceReceiptContent');
    const name = document.getElementById('billRoom').innerText;

    html2canvas(content).then(canvas => {
        let link = document.createElement('a');
        link.download = `HoaDon_${name.replace(/\s+/g, '')}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();

        const receiptModal = document.getElementById('receiptModal');
        if (receiptModal) receiptModal.close();
        alert("Tải ảnh thành công!");
        window.location.reload();
    }).catch(err => {
        alert("Có lỗi xảy ra khi tạo ảnh hóa đơn!");
        console.error(err);
    });
}

async function apiDelete(url, msg) {
    if(!confirm(msg)) return;
    try {
        const res = await fetch(url, { method: 'DELETE' });
        const result = await res.json();
        if(res.ok) window.location.reload();
        else alert("THÔNG BÁO: " + result.error);
    } catch(e) {
        alert("Lỗi xử lý kết nối!");
    }
}

function tinhTongTien(groupId, monthlyRent, wifiFee, trashFee) {
    const dialog = document.getElementById('createInvoiceModal' + groupId);
    if (!dialog) return;

    // 1. Tính tiền phòng (Nguyên tháng hoặc Tính lẻ theo ngày)
    const startDateInput = dialog.querySelector('[name="start_date"]').value;
    const endDateInput = dialog.querySelector('[name="end_date"]').value;
    const pricePerDayInput = dialog.querySelector('[name="room_price_per_day"]').value;
    const rentDaysInput = dialog.querySelector('[name="rent_days"]');
    const calculatedDaysText = dialog.querySelector('#calculatedDays' + groupId);

    let roomCost = monthlyRent;

    if (startDateInput && endDateInput) {
        const start = new Date(startDateInput);
        const end = new Date(endDateInput);
        const diffTime = end - start + 1;
        if (diffTime >= 0) {
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            rentDaysInput.value = diffDays;

            let pricePerDay = parseFloat(pricePerDayInput);
            if (isNaN(pricePerDay) || pricePerDay <= 0) {
                pricePerDay = monthlyRent / 30; // Mặc định chia 30 ngày
            }

            roomCost = diffDays * pricePerDay;
            if (calculatedDaysText) {
                calculatedDaysText.innerText = `* Tính lẻ: ${diffDays} ngày x ${pricePerDay.toLocaleString('vi-VN')} đ = ${roomCost.toLocaleString('vi-VN')} đ`;
            }
        } else {
            rentDaysInput.value = "";
            if (calculatedDaysText) calculatedDaysText.innerText = "* Ngày kết thúc phải sau ngày bắt đầu!";
        }
    } else {
        rentDaysInput.value = "";
        if (calculatedDaysText) calculatedDaysText.innerText = "* Mặc định: Tính trọn tháng";
    }

    // 2. Tính tiền Điện & Nước
    const oldE = parseFloat(dialog.querySelector('[name="old_electricity_index"]').value) || 0;
    const newE = parseFloat(dialog.querySelector('[name="new_electricity_index"]').value) || 0;
    const priceE = parseFloat(dialog.querySelector('[name="electricity_price"]').value) || 0;
    const eUsage = newE >= oldE ? newE - oldE : 0;
    const eCost = eUsage * priceE;

    const oldW = parseFloat(dialog.querySelector('[name="old_water_index"]').value) || 0;
    const newW = parseFloat(dialog.querySelector('[name="new_water_index"]').value) || 0;
    const priceW = parseFloat(dialog.querySelector('[name="water_price"]').value) || 0;
    const wUsage = newW >= oldW ? newW - oldW : 0;
    const wCost = wUsage * priceW;

    // 3. Phí dịch vụ cố định (ÁP DỤNG LOGIC DƯỚI 10 NGÀY = MIỄN PHÍ)
    let appliedWifi = wifiFee || 0;
    let appliedTrash = trashFee || 0;

    if (rentDaysInput.value !== "") {
        const diffDays = parseInt(rentDaysInput.value);
        if (diffDays < 10) {
            appliedWifi = 0;
            appliedTrash = 0;
        }
    }

    // --- CẬP NHẬT TRỰC TIẾP LÊN BẢNG HTML ---
    const updateText = (id, val) => { const el = dialog.querySelector(id); if (el) el.innerText = val; };

    updateText('#previewRent' + groupId, roomCost.toLocaleString('vi-VN'));

    updateText('#previewElecOld' + groupId, oldE.toString());
    updateText('#previewElecNew' + groupId, newE.toString());
    updateText('#previewElecUsage' + groupId, eUsage.toString());
    updateText('#previewElecPrice' + groupId, priceE.toLocaleString('vi-VN'));
    updateText('#previewElec' + groupId, eCost.toLocaleString('vi-VN'));

    updateText('#previewWaterOld' + groupId, oldW.toString());
    updateText('#previewWaterNew' + groupId, newW.toString());
    updateText('#previewWaterUsage' + groupId, wUsage.toString());
    updateText('#previewWaterPrice' + groupId, priceW.toLocaleString('vi-VN'));
    updateText('#previewWater' + groupId, wCost.toLocaleString('vi-VN'));

    updateText('#previewWifi' + groupId, appliedWifi.toLocaleString('vi-VN'));
    updateText('#previewTrash' + groupId, appliedTrash.toLocaleString('vi-VN'));

    // 4. Xử lý logic Trừ Cọc
    let deductAmount = 0;
    const deductCheck = dialog.querySelector('#deductCheck' + groupId);
    const previewDeductRow = dialog.querySelector('#previewDeductRow' + groupId);

    if (deductCheck && deductCheck.checked) {
        deductAmount = parseFloat(deductCheck.value) || 0;
        if (previewDeductRow) {
            previewDeductRow.style.display = 'table-row';
            updateText('#previewDeduct' + groupId, `- ` + deductAmount.toLocaleString('vi-VN'));
        }
    } else {
        if (previewDeductRow) previewDeductRow.style.display = 'none';
    }

    // 5. Chốt Tổng Cộng Cuối Cùng
    const subTotal = roomCost + eCost + wCost + appliedWifi + appliedTrash;
    const diffFinal = deductAmount - subTotal;

    const totalElement = dialog.querySelector('#previewTotal' + groupId);
    const totalLabel = dialog.querySelector('#previewTotalLabel' + groupId);

    if (diffFinal > 0) {
        if (totalLabel) totalLabel.innerText = "HOÀN TIỀN KHÁCH";
        if (totalElement) {
            totalElement.innerText = diffFinal.toLocaleString('vi-VN');
            totalElement.style.color = "red"; // Đổi thành chữ ĐỎ cho hoàn tiền
        }
    } else {
        const toPay = Math.abs(diffFinal);
        if (totalLabel) totalLabel.innerText = "KHÁCH THANH TOÁN";
        if (totalElement) {
            totalElement.innerText = toPay.toLocaleString('vi-VN');
            totalElement.style.color = "#10b981"; // Đổi thành chữ XANH cho khách cần trả
        }
    }

    // Đảm bảo hiển thị lại bảng preview gốc và ẩn vùng gộp nếu còn sót
    const previewContainer = dialog.querySelector('#previewTableContainer' + groupId);
    if (previewContainer) previewContainer.style.display = 'block';

    const combineContainer = dialog.querySelector('#combineInvoicePreviews' + groupId);
    if (combineContainer) combineContainer.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('dialog').forEach(dialog => {
        dialog.addEventListener('close', () => {
            const form = dialog.querySelector('form');
            if (form) {
                form.reset();
                const deductRow = dialog.querySelector('[id^="previewDeductRow"]');
                if (deductRow) deductRow.style.display = 'none';

                const calculatedDays = dialog.querySelector('[id^="calculatedDays"]');
                if (calculatedDays) calculatedDays.innerHTML = '* Mặc định: Tính trọn tháng';

                // Dọn dẹp form khi đóng popup gộp
                const combineArea = dialog.querySelector('[id^="combineInvoiceArea"]');
                if (combineArea) combineArea.style.display = 'none';

                const combinePreviews = dialog.querySelector('[id^="combineInvoicePreviews"]');
                if (combinePreviews) combinePreviews.style.display = 'none';

                const replaceId = dialog.querySelector('[name="replace_invoice_id"]');
                if (replaceId) replaceId.value = '';

                const combineStatus = dialog.querySelector('[id^="combineStatus"]');
                if (combineStatus) combineStatus.innerHTML = '';

                const currentTitle = dialog.querySelector('[id^="currentInvoiceTitle"]');
                if (currentTitle) currentTitle.innerText = 'CHI TIẾT DỰ KIẾN';
            }
        });
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.close();
        });
    });
});

function openInvoiceModal(groupId) {
    const dialog = document.getElementById('createInvoiceModal' + groupId);
    if (dialog) {
        dialog.showModal();
        const mRent = parseFloat(dialog.getAttribute('data-monthly-rent')) || 0;
        const wFee = parseFloat(dialog.getAttribute('data-wifi-fee')) || 0;
        const tFee = parseFloat(dialog.getAttribute('data-trash-fee')) || 0;
        tinhTongTien(groupId, mRent, wFee, tFee);
    }
}

const ICON_SUN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const ICON_MOON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

function renderThemeIcon(currentTheme) {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    btn.innerHTML = currentTheme === 'dark' ? ICON_SUN : ICON_MOON;
}

function toggleTheme() {
    const root = document.documentElement;
    const currentTheme = root.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('jb-theme', newTheme);
    renderThemeIcon(newTheme);
}

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('jb-theme') || 'dark';
    renderThemeIcon(savedTheme);
});

// --- XEM VÀ TẢI LẠI HÓA ĐƠN CŨ ---
async function viewOldInvoice(invoiceId) {
    try {
        const res = await fetch(`/api/invoices/${invoiceId}/full`);
        const data = await res.json();

        if (!res.ok) { alert(data.error); return; }

        // Gọi lại hàm showInvoiceReceipt có sẵn để vẽ lên Modal In
        showInvoiceReceipt(data, data.wifi_fee, data.trash_fee);

        // Reset lại thanh nhập mã tránh nhầm lẫn
        const inputCode = document.getElementById('inputCombineCode');
        if(inputCode) inputCode.value = '';

    } catch(e) {
        console.error(e);
        alert("Lỗi khi tải dữ liệu hóa đơn!");
    }
}

// Biến toàn cục để lưu lại tổng tiền của hóa đơn hiện tại
window.currentBillTotalValue = 0;

function showInvoiceReceipt(data, roomWifi = 0, roomTrash = 0) {
    // 1. Lưu lại tổng tiền hiện tại để tính gộp nếu cần
    window.currentBillTotalValue = data.total;

    // 2. Ẩn các phần gộp đi mỗi khi mở lại modal mới (để tránh hiển thị lại dữ liệu gộp từ lần trước)
    const oldTbody = document.getElementById('oldInvoiceTbody');
    if (oldTbody) oldTbody.style.display = 'none';

    const curHeaderRow = document.getElementById('currentInvoiceHeaderRow');
    if (curHeaderRow) curHeaderRow.style.display = 'none';

    const rowCombo = document.getElementById('rowCombinedTotal');
    if (rowCombo) rowCombo.style.display = 'none';

    // 3. Đổ dữ liệu hóa đơn hiện tại
    document.getElementById('billRoom').innerText = data.room_name;
    document.getElementById('billGroup').innerText = data.group_name;

    const dateObj = new Date();
    const dateString = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    document.getElementById('billDate').innerText = dateString;

    document.getElementById('billRent').innerText = data.room_rent.toLocaleString('vi-VN');

    // Điện
    document.getElementById('billElecOld').innerText = data.elec_old;
    document.getElementById('billElecNew').innerText = data.elec_new;
    document.getElementById('billElecUsage').innerText = data.elec_usage;
    document.getElementById('billElecPrice').innerText = data.elec_price.toLocaleString('vi-VN');
    document.getElementById('billElec').innerText = data.elec_cost.toLocaleString('vi-VN');

    // Nước
    document.getElementById('billWaterOld').innerText = data.water_old;
    document.getElementById('billWaterNew').innerText = data.water_new;
    document.getElementById('billWaterUsage').innerText = data.water_usage;
    document.getElementById('billWaterPrice').innerText = data.water_price.toLocaleString('vi-VN');
    document.getElementById('billWater').innerText = data.water_cost.toLocaleString('vi-VN');

    // Wifi, Rác
    let wifiCost = 0;
    let trashCost = 0;
    if (data.services_fee > 0) {
        wifiCost = roomWifi;
        trashCost = roomTrash;
    }
    document.getElementById('billWifi').innerText = wifiCost.toLocaleString('vi-VN');
    document.getElementById('billTrash').innerText = trashCost.toLocaleString('vi-VN');

    // Khấu trừ (Cọc)
    const deductBlock = document.getElementById('rowBillDeduct');
    if (data.deducted > 0) {
        deductBlock.style.display = 'table-row';
        document.getElementById('billDeduct').innerText = `- ` + data.deducted.toLocaleString('vi-VN');
    } else {
        if(deductBlock) deductBlock.style.display = 'none';
    }

    // Tổng tháng này
    const totalLabel = document.getElementById('billTotalLabel');
    const totalValue = document.getElementById('billTotal');

    if (data.total < 0) {
        totalLabel.innerText = "HOÀN KHÁCH";
        totalValue.innerText = Math.abs(data.total).toLocaleString('vi-VN');
    } else {
        totalLabel.innerText = "TỔNG THÁNG NÀY";
        totalValue.innerText = data.total.toLocaleString('vi-VN');
    }

    document.getElementById('receiptModal').showModal();
}

async function combineInvoice() {
    const codeInput = document.getElementById('inputCombineCode');
    const code = codeInput.value.trim();

    if(!code) {
        alert("Vui lòng nhập mã hóa đơn cũ cần gộp!");
        return;
    }

    try {
        const res = await fetch(`/api/invoices/code/${encodeURIComponent(code)}`);
        const oldData = await res.json();

        if (!res.ok) {
            alert(oldData.error || "Không tìm thấy hóa đơn này!");
            return;
        }

        // Bật hiển thị phân đoạn bảng hóa đơn cũ dạng table-row-group
        const oldTbody = document.getElementById('oldInvoiceTbody');
        if (oldTbody) oldTbody.style.display = 'table-row-group';

        // Bật tiêu đề chia cách "Hóa đơn tháng này"
        const curHeaderRow = document.getElementById('currentInvoiceHeaderRow');
        if (curHeaderRow) curHeaderRow.style.display = 'table-row';

        // Đổ dữ liệu vào các ID của bảng cũ
        document.getElementById('oldBillCode').innerText = oldData.invoice_code;
        document.getElementById('oldBillElecOld').innerText = oldData.elec_old;
        document.getElementById('oldBillElecNew').innerText = oldData.elec_new;
        document.getElementById('oldBillElecUsage').innerText = oldData.elec_usage;
        document.getElementById('oldBillElecPrice').innerText = oldData.elec_price.toLocaleString('vi-VN');
        document.getElementById('oldBillElec').innerText = oldData.elec_cost.toLocaleString('vi-VN');

        document.getElementById('oldBillWaterOld').innerText = oldData.water_old;
        document.getElementById('oldBillWaterNew').innerText = oldData.water_new;
        document.getElementById('oldBillWaterUsage').innerText = oldData.water_usage;
        document.getElementById('oldBillWaterPrice').innerText = oldData.water_price.toLocaleString('vi-VN');
        document.getElementById('oldBillWater').innerText = oldData.water_cost.toLocaleString('vi-VN');

        // Cập nhật Wifi và Rác riêng biệt
        document.getElementById('oldBillTrash').innerText = oldData.trash_fee.toLocaleString('vi-VN');
        document.getElementById('oldBillWifi').innerText = oldData.wifi_fee.toLocaleString('vi-VN');

        document.getElementById('oldBillRent').innerText = oldData.room_rent.toLocaleString('vi-VN');
        document.getElementById('oldBillTotal').innerText = oldData.total.toLocaleString('vi-VN');

        // Tính và hiển thị tổng Gộp cuối cùng
        const grandTotal = window.currentBillTotalValue + oldData.total;

        const rowCombo = document.getElementById('rowCombinedTotal');
        if(rowCombo) {
            rowCombo.style.display = 'table-row';
            document.getElementById('billCombinedTotal').innerText = grandTotal.toLocaleString('vi-VN') + ' đ';
        }

        // Xóa mã vừa nhập sau khi gộp xong
        codeInput.value = '';

    } catch (e) {
        console.error(e);
        alert("Có lỗi kết nối khi lấy dữ liệu hóa đơn gộp!");
    }
}
