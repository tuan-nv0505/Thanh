// Universal API submission system replacing Bootstrap engine
async function apiSubmit(event, url, method) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Explicit checking for custom native components (Xử lý Checkbox)
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
                // Tự động lấy cấu hình Wifi/Rác của phòng hiện tại từ Popup đang mở
                const openDialog = form.closest('dialog');
                let wFee = 0;
                let tFee = 0;

                if (openDialog) {
                    wFee = parseFloat(openDialog.getAttribute('data-wifi-fee')) || 0;
                    tFee = parseFloat(openDialog.getAttribute('data-trash-fee')) || 0;
                    openDialog.close();
                }

                // Gắn thêm ngày lưu trú lẻ vào data
                result.data.start_date = data.start_date;
                result.data.end_date = data.end_date;

                // Gọi hàm hiển thị hóa đơn và truyền kèm phí Wifi, Rác để tách dòng
                showInvoiceReceipt(result.data, wFee, tFee);
            } else {
                // Các thao tác khác (Thêm/Sửa/Xóa phòng, khách, nhóm) thì reload lại trang
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
    document.getElementById('billRoom').innerText = data.room_name;
    document.getElementById('billGroup').innerText = data.group_name;

    // Format ngày
    const dateObj = data.created_at ? new Date(data.created_at) : new Date();
    const dateString = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    document.getElementById('billDate').innerText = dateString;

    const rangeBlock = document.getElementById('rowBillDateRange');
    const rangeText = document.getElementById('billDateRange');
    if (data.start_date && data.end_date) {
        const reverseDate = (dStr) => dStr.split('-').reverse().join('/');
        rangeBlock.style.display = 'flex';
        rangeText.innerText = `${reverseDate(data.start_date)} - ${reverseDate(data.end_date)}`;
    } else {
        rangeBlock.style.display = 'none';
    }

    // Gán dữ liệu điện, nước, phòng
    document.getElementById('billElecUsage').innerText = `(${data.elec_usage} kWh)`;
    document.getElementById('billElec').innerText = `${data.elec_cost.toLocaleString('vi-VN')} đ`;

    document.getElementById('billWaterUsage').innerText = `(${data.water_usage} m³)`;
    document.getElementById('billWater').innerText = `${data.water_cost.toLocaleString('vi-VN')} đ`;

    document.getElementById('billRent').innerText = `${data.room_rent.toLocaleString('vi-VN')} đ`;

    // Tách riêng tiền Wifi và Rác
    let wifiCost = 0;
    let trashCost = 0;
    if (data.services_fee > 0) {
        wifiCost = roomWifi;
        trashCost = roomTrash;
    }

    document.getElementById('billWifi').innerText = `${wifiCost.toLocaleString('vi-VN')} đ`;
    document.getElementById('billTrash').innerText = `${trashCost.toLocaleString('vi-VN')} đ`;

    const deductBlock = document.getElementById('rowBillDeduct');
    if (data.deducted > 0) {
        deductBlock.style.display = 'flex';
        document.getElementById('billDeduct').innerText = `- ${data.deducted.toLocaleString('vi-VN')} đ`;
    } else {
        deductBlock.style.display = 'none';
    }

    const totalLabel = document.getElementById('billTotalLabel');
    const totalValue = document.getElementById('billTotal');

    if (data.total < 0) {
        totalLabel.innerText = "HOÀN LẠI KHÁCH";
        totalValue.innerText = Math.abs(data.total).toLocaleString('vi-VN') + ' đ';
        totalValue.style.color = "#10b981"; // Màu xanh dương
    } else {
        totalLabel.innerText = "TỔNG THANH TOÁN";
        totalValue.innerText = data.total.toLocaleString('vi-VN') + ' đ';
        totalValue.style.color = "#00bfff"; // Màu xanh lam Jetbrains
    }

    // Hiển thị modal
    document.getElementById('receiptModal').showModal();
}
function saveInvoiceImage() {
    const content = document.getElementById('invoiceReceiptContent');
    const name = document.getElementById('billRoom').innerText;

    html2canvas(content).then(canvas => {
        // Tạo file ảnh và tải xuống
        let link = document.createElement('a');
        link.download = `HoaDon_${name.replace(/\s+/g, '')}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();

        // Đóng modal hóa đơn hiện tại
        const receiptModal = document.getElementById('receiptModal');
        if (receiptModal) receiptModal.close();

        // Hiện thông báo thành công
        alert("Tải ảnh thành công!");

        // Tải lại trang để reset dữ liệu và quay về room detail
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

    const oldE = parseFloat(dialog.querySelector('[name="old_electricity_index"]').value) || 0;
    const newE = parseFloat(dialog.querySelector('[name="new_electricity_index"]').value) || 0;
    const priceE = parseFloat(dialog.querySelector('[name="electricity_price"]').value) || 0;
    const eCost = Math.max(0, (newE - oldE) * priceE);

    const oldW = parseFloat(dialog.querySelector('[name="old_water_index"]').value) || 0;
    const newW = parseFloat(dialog.querySelector('[name="new_water_index"]').value) || 0;
    const priceW = parseFloat(dialog.querySelector('[name="water_price"]').value) || 0;
    const wCost = Math.max(0, (newW - oldW) * priceW);

    const startInput = dialog.querySelector('[name="start_date"]');
    const endInput = dialog.querySelector('[name="end_date"]');
    const hiddenDays = dialog.querySelector('[name="rent_days"]');
    const daysText = dialog.querySelector('#calculatedDays' + groupId);
    const customPriceStr = dialog.querySelector('[name="room_price_per_day"]').value;

    let rentDaysStr = '';

    if (startInput && endInput && startInput.value && endInput.value) {
        const start = new Date(startInput.value);
        const end = new Date(endInput.value);
        const diff = end - start;

        if (diff >= 0) {
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            rentDaysStr = days.toString();
            if (hiddenDays) hiddenDays.value = days;
            if (daysText) daysText.innerHTML = `Thời gian lẻ: <span style="color:var(--jb-blue);font-weight:700">${days} ngày</span>`;
        } else {
            if (hiddenDays) hiddenDays.value = '';
            if (daysText) daysText.innerHTML = `<span style="color:var(--danger)">Ngày kết thúc lỗi!</span>`;
        }
    } else {
        if (hiddenDays) hiddenDays.value = '';
        if (daysText) daysText.innerHTML = '* Mặc định: Tính trọn tháng';
    }

    let roomCost = monthlyRent;
    let appliedWifi = wifiFee;
    let appliedTrash = trashFee;
    const fixedFeesText = dialog.querySelector('#fixedFeesText' + groupId);

    if (rentDaysStr !== '') {
        const days = parseFloat(rentDaysStr);
        if (days >= 0) {
            let pricePerDay = monthlyRent / 30;
            if (customPriceStr.trim() !== '') {
                const customPrice = parseFloat(customPriceStr);
                if (!isNaN(customPrice) && customPrice >= 0) pricePerDay = customPrice;
            }
            roomCost = days * pricePerDay;

            if (days < 10) {
                appliedWifi = 0;
                appliedTrash = 0;
                if (fixedFeesText) fixedFeesText.innerHTML = 'Miễn phí dịch vụ (< 10 ngày)';
            } else {
                if (fixedFeesText) fixedFeesText.innerHTML = `Wifi & Rác chuẩn`;
            }
        }
    } else {
        if (fixedFeesText) fixedFeesText.innerHTML = `Wifi + Rác định kỳ`;
    }

    let deductAmount = 0;
    const deductCheck = dialog.querySelector('#deductCheck' + groupId);
    const previewDeductRow = dialog.querySelector('#previewDeductRow' + groupId);
    const previewDeductText = dialog.querySelector('#previewDeduct' + groupId);

    if (deductCheck && deductCheck.checked) {
        deductAmount = parseFloat(deductCheck.value) || 0;
        if (previewDeductRow && previewDeductText) {
            previewDeductRow.style.display = 'flex';
            previewDeductText.innerText = `- ${deductAmount.toLocaleString('vi-VN')} đ`;
        }
    } else {
        if (previewDeductRow) previewDeductRow.style.display = 'none';
    }

    const subTotal = roomCost + eCost + wCost + appliedWifi + appliedTrash;
    const diffFinal = deductAmount - subTotal;

    const totalElement = dialog.querySelector('#previewTotal' + groupId);
    const totalLabel = dialog.querySelector('#previewTotalLabel' + groupId);

    if (diffFinal > 0) {
        if (totalLabel) totalLabel.innerText = "TIỀN HOÀN KHÁCH:";
        if (totalElement) {
            totalElement.innerText = diffFinal.toLocaleString('vi-VN') + ' đ';
            totalElement.style.color = "var(--status-active)";
        }
    } else {
        const toPay = Math.abs(diffFinal);
        if (totalLabel) totalLabel.innerText = "KHÁCH THANH TOÁN:";
        if (totalElement) {
            totalElement.innerText = toPay.toLocaleString('vi-VN') + ' đ';
            totalElement.style.color = "var(--danger)";
        }
    }
}

// Global hook up for Dialog Native Elements on invocation
document.addEventListener('DOMContentLoaded', () => {
    // Standardizing close triggers across dialog workflows
    document.querySelectorAll('dialog').forEach(dialog => {
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.close();
        });
    });
});

// =================================================================
// HỆ THỐNG ĐIỀU KHIỂN NATIVE DIALOG (POPUP) THÔNG MINH
// =================================================================

// 1. Hàm mở popup Lập Hóa Đơn và tự động tính tiền ngay lập tức
function openInvoiceModal(groupId) {
    const dialog = document.getElementById('createInvoiceModal' + groupId);
    if (dialog) {
        dialog.showModal(); // Mở popup

        // Lấy thông số gốc từ thuộc tính data- của thẻ dialog
        const mRent = parseFloat(dialog.getAttribute('data-monthly-rent')) || 0;
        const wFee = parseFloat(dialog.getAttribute('data-wifi-fee')) || 0;
        const tFee = parseFloat(dialog.getAttribute('data-trash-fee')) || 0;

        // Gọi hàm tính tiền ngay lập tức để xổ giá tổng
        tinhTongTien(groupId, mRent, wFee, tFee);
    }
}

// 2. Tự động LÀM SẠCH FORM khi bất kỳ Popup nào bị đóng
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('dialog').forEach(dialog => {

        // Lắng nghe sự kiện 'close' (Bắt được cả khi bấm Hủy, nút X, hoặc phím ESC)
        dialog.addEventListener('close', () => {
            const form = dialog.querySelector('form');
            if (form) {
                form.reset(); // Dọn sạch toàn bộ chữ đã gõ

                // Ẩn dòng "Khấu trừ cọc" nếu trước đó đã tích chọn
                const deductRow = dialog.querySelector('[id^="previewDeductRow"]');
                if (deductRow) deductRow.style.display = 'none';

                // Reset lại thông báo thời gian ở lẻ
                const calculatedDays = dialog.querySelector('[id^="calculatedDays"]');
                if (calculatedDays) calculatedDays.innerHTML = '* Mặc định: Tính trọn tháng';
            }
        });

        // Click ra khoảng không màu đen bên ngoài để đóng popup
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.close();
        });
    });
});

// =================================================================
// HỆ THỐNG CHUYỂN ĐỔI THEME (DARK / LIGHT)
// =================================================================

// Icon SVG dạng Sun (cho Light Mode) và Moon (cho Dark Mode)
const ICON_SUN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const ICON_MOON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

function renderThemeIcon(currentTheme) {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    // Bấm để sang sáng (hiện hình Mặt trời) - Bấm để sang tối (hiện hình Mặt trăng)
    btn.innerHTML = currentTheme === 'dark' ? ICON_SUN : ICON_MOON;
}

function toggleTheme() {
    const root = document.documentElement;
    const currentTheme = root.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    // Gán theme mới vào HTML và lưu vào máy tính
    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('jb-theme', newTheme);

    renderThemeIcon(newTheme);
}

// Chạy tự động để hiển thị đúng icon khi mới nạp trang
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('jb-theme') || 'dark';
    renderThemeIcon(savedTheme);
});