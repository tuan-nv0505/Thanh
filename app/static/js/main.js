// Hàm gọi API để Thêm/Sửa (Gửi JSON chuẩn)
async function apiSubmit(event, url, method) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());

    // Bắt thủ công giá trị Checkbox Đại Diện
    const repCheck = event.target.querySelector('[name="is_representative"]');
    if (repCheck) data.is_representative = repCheck.checked ? 'on' : 'off';

    // Bắt thủ công giá trị Checkbox Trừ Cọc
    const deductCheck = event.target.querySelector('[name="deduct_deposit"]');
    if (deductCheck && deductCheck.checked) data.deduct_deposit = 'on';

    try {
        const res = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (res.ok) {
            if (url.includes('/invoices')) {
                const currentModalEl = event.target.closest('.modal');
                const currentModal = bootstrap.Modal.getInstance(currentModalEl);
                if(currentModal) currentModal.hide();

                // Gài thêm Từ Ngày - Đến Ngày vào dữ liệu để hiển thị Bill
                result.data.start_date = data.start_date;
                result.data.end_date = data.end_date;

                showInvoiceModal(result.data);
            } else {
                window.location.reload();
            }
        } else {
            alert("LỖI: " + result.error);
        }
    } catch(e) {
        alert("Lỗi kết nối máy chủ!");
        console.error(e);
    }
}

// Hàm điền dữ liệu JSON vào Tờ Hóa Đơn HTML
function showInvoiceModal(data) {
    document.getElementById('billRoom').innerText = data.room_name;
    document.getElementById('billGroup').innerText = data.group_name;
    document.getElementById('billDate').innerText = 'Ngày: ' + data.created_at;
    document.getElementById('billCode').innerText = data.invoice_code;

    // XỬ LÝ HIỂN THỊ KỲ CƯỚC NẾU CÓ CHỌN NGÀY
    const rowBillDateRange = document.getElementById('rowBillDateRange');
    const billDateRange = document.getElementById('billDateRange');
    if (data.start_date && data.end_date) {
        // Định dạng lại YYYY-MM-DD thành DD/MM/YYYY cho thân thiện
        const formatDate = (dStr) => dStr.split('-').reverse().join('/');

        rowBillDateRange.classList.remove('d-none');
        billDateRange.innerText = `Từ ${formatDate(data.start_date)} đến ${formatDate(data.end_date)}`;
    } else {
        rowBillDateRange.classList.add('d-none');
    }

    document.getElementById('billElec').innerText = `${data.elec_usage} ký - ${data.elec_cost.toLocaleString('vi-VN')} đ`;
    document.getElementById('billWater').innerText = `${data.water_usage} khối - ${data.water_cost.toLocaleString('vi-VN')} đ`;
    document.getElementById('billRent').innerText = `${data.room_rent.toLocaleString('vi-VN')} đ`;
    document.getElementById('billServices').innerText = `${data.services_fee.toLocaleString('vi-VN')} đ`;

    // Logic Ẩn / Hiện dòng Trừ cọc trên tờ Bill
    const rowDeduct = document.getElementById('rowBillDeduct');
    if (data.deducted > 0) {
        rowDeduct.classList.remove('d-none');
        rowDeduct.classList.add('d-flex');
        document.getElementById('billDeduct').innerText = `- ${data.deducted.toLocaleString('vi-VN')} đ`;
    } else {
        rowDeduct.classList.remove('d-flex');
        rowDeduct.classList.add('d-none');
    }

    // Xử lý hiển thị Tổng trên Bill in (CẬP NHẬT HOÀN TIỀN / THANH TOÁN)
    const billTotalLabel = document.getElementById('billTotalLabel');
    const billTotalEl = document.getElementById('billTotal');

    // Trong Backend (dao.py), total = Các phí - deducted_deposit
    // Nên nếu tiền cọc lớn hơn các phí, data.total sẽ bị ÂM
    if (data.total < 0) {
        if (billTotalLabel) billTotalLabel.innerText = "TIỀN HOÀN KHÁCH:";
        // Dùng Math.abs() để lấy số dương hiển thị cho đẹp
        billTotalEl.innerText = Math.abs(data.total).toLocaleString('vi-VN') + ' đ';
    } else {
        if (billTotalLabel) billTotalLabel.innerText = "KHÁCH THANH TOÁN:";
        billTotalEl.innerText = data.total.toLocaleString('vi-VN') + ' đ';
    }

    // Hiển thị Modal
    const receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
    receiptModal.show();

    // Refresh lại trang khi đóng Modal Bill
    document.getElementById('receiptModal').addEventListener('hidden.bs.modal', function () {
        window.location.reload();
    });
}

// Hàm chụp ảnh Hóa đơn tải về máy
function saveInvoiceImage() {
    const receiptElement = document.getElementById('invoiceReceiptContent');
    const roomName = document.getElementById('billRoom').innerText;

    // html2canvas chụp lại thẻ div và vẽ ra Canvas
    html2canvas(receiptElement).then(canvas => {
        let link = document.createElement('a');
        link.download = `HoaDon_${roomName}.png`; // Tên file tự động có tên phòng
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
}

// Hàm gọi API Xóa
async function apiDelete(url, msg) {
    if(!confirm(msg)) return;
    try {
        const res = await fetch(url, { method: 'DELETE' });
        const result = await res.json();

        if(res.ok) window.location.reload();
        else alert("LỖI: " + result.error);
    } catch(e) {
        alert("Lỗi kết nối máy chủ!");
        console.error(e);
    }
}

// Hàm xử lý logic tính toán ngay trong Modal lập hóa đơn
function tinhTongTien(groupId, monthlyRent, wifiFee, trashFee) {
    const modal = document.getElementById('createInvoiceModal' + groupId);
    if (!modal) return;

    // 1. Điện
    const oldE = parseFloat(modal.querySelector('[name="old_electricity_index"]').value) || 0;
    const newE = parseFloat(modal.querySelector('[name="new_electricity_index"]').value) || 0;
    const priceE = parseFloat(modal.querySelector('[name="electricity_price"]').value) || 0;
    let eCost = Math.max(0, (newE - oldE) * priceE);

    // 2. Nước
    const oldW = parseFloat(modal.querySelector('[name="old_water_index"]').value) || 0;
    const newW = parseFloat(modal.querySelector('[name="new_water_index"]').value) || 0;
    const priceW = parseFloat(modal.querySelector('[name="water_price"]').value) || 0;
    let wCost = Math.max(0, (newW - oldW) * priceW);

    // 3. Logic: TÍNH SỐ NGÀY LẺ TỪ NGÀY - ĐẾN NGÀY
    const startDateInput = modal.querySelector('[name="start_date"]');
    const endDateInput = modal.querySelector('[name="end_date"]');
    const hiddenRentDays = modal.querySelector('[name="rent_days"]');
    const calculatedDaysText = modal.querySelector('#calculatedDays' + groupId);
    const customPriceStr = modal.querySelector('[name="room_price_per_day"]').value;

    let rentDaysStr = '';

    if (startDateInput && endDateInput && startDateInput.value && endDateInput.value) {
        const start = new Date(startDateInput.value);
        const end = new Date(endDateInput.value);
        const diffTime = end - start;

        if (diffTime >= 0) {
            const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            rentDaysStr = days.toString();

            if (hiddenRentDays) hiddenRentDays.value = days;
            if (calculatedDaysText) {
                calculatedDaysText.innerHTML = `Đã chọn: <b class="text-primary">${days} ngày</b> (Dưới 10 ngày miễn Wifi & Rác)`;
            }
        } else {
            if (hiddenRentDays) hiddenRentDays.value = '';
            if (calculatedDaysText) {
                calculatedDaysText.innerHTML = `<span class="text-danger">Lỗi: Ngày kết thúc phải sau ngày bắt đầu!</span>`;
            }
        }
    } else {
        if (hiddenRentDays) hiddenRentDays.value = '';
        if (calculatedDaysText) {
            calculatedDaysText.innerHTML = `* Trống = Tính nguyên tháng`;
        }
    }

    // 4. Áp giá tiền phòng
    let roomCost = monthlyRent;
    let appliedWifi = wifiFee;
    let appliedTrash = trashFee;
    const fixedFeesText = modal.querySelector('#fixedFeesText' + groupId);

    if (rentDaysStr !== '') {
        const days = parseFloat(rentDaysStr);
        if (days >= 0) {
            let pricePerDay = monthlyRent / 30; // Mặc định chia 30
            if (customPriceStr.trim() !== '') {
                const customPrice = parseFloat(customPriceStr);
                if (!isNaN(customPrice) && customPrice >= 0) {
                    pricePerDay = customPrice;
                }
            }

            roomCost = days * pricePerDay;

            if (days < 10) {
                appliedWifi = 0;
                appliedTrash = 0;
                if (fixedFeesText) fixedFeesText.innerHTML = "<b>Miễn phí Wifi & Rác</b> (Do ở dưới 10 ngày)";
            } else {
                if (fixedFeesText) fixedFeesText.innerHTML = `Wifi (${wifiFee.toLocaleString('vi-VN')} đ) + Rác (${trashFee.toLocaleString('vi-VN')} đ)`;
            }
        }
    } else {
        if (fixedFeesText) fixedFeesText.innerHTML = `Wifi (${wifiFee.toLocaleString('vi-VN')} đ) + Rác (${trashFee.toLocaleString('vi-VN')} đ)`;
    }

    // 5. Trừ cọc
    let deductAmount = 0;
    const deductCheck = modal.querySelector('#deductCheck' + groupId);
    const previewDeductRow = modal.querySelector('#previewDeductRow' + groupId);
    const previewDeductText = modal.querySelector('#previewDeduct' + groupId);

    if (deductCheck && deductCheck.checked) {
        deductAmount = parseFloat(deductCheck.value) || 0;
        if (previewDeductRow && previewDeductText) {
            previewDeductRow.classList.remove('d-none');
            previewDeductRow.classList.add('d-flex');
            previewDeductText.innerText = `- ${deductAmount.toLocaleString('vi-VN')} đ`;
        }
    } else {
        if (previewDeductRow) {
            previewDeductRow.classList.remove('d-flex');
            previewDeductRow.classList.add('d-none');
        }
    }

    // 6. Tính Tổng (CẬP NHẬT HOÀN TIỀN / THANH TOÁN)
    let subTotal = roomCost + eCost + wCost + appliedWifi + appliedTrash;
    let diff = deductAmount - subTotal; // Lấy tiền cọc trừ đi khoản tổng

    const previewTotalElement = modal.querySelector('#previewTotal' + groupId);
    const previewTotalLabel = modal.querySelector('#previewTotalLabel' + groupId);

    if (diff > 0) {
        // Dương -> Tiền cọc đang giữ lớn hơn tổng chi phí -> Hoàn lại tiền cho khách
        if (previewTotalLabel) previewTotalLabel.innerText = "TIỀN HOÀN KHÁCH:";
        if (previewTotalElement) {
            previewTotalElement.innerText = diff.toLocaleString('vi-VN') + ' đ';
            previewTotalElement.className = "fw-bold fs-5 text-success"; // Đổi màu xanh lá báo hiệu tiền hoàn
        }
    } else {
        // Âm hoặc bằng 0 -> Tiền cọc không đủ hoặc không dùng cọc -> Khách phải thanh toán thêm
        let toPay = Math.abs(diff);
        if (previewTotalLabel) previewTotalLabel.innerText = "KHÁCH THANH TOÁN:";
        if (previewTotalElement) {
            previewTotalElement.innerText = toPay.toLocaleString('vi-VN') + ' đ';
            previewTotalElement.className = "fw-bold fs-5 text-danger"; // Đổi màu đỏ báo hiệu khoản cần trả
        }
    }
}

// Tự động chạy tính toán ngay khi Modal Lập Hóa Đơn được mở
document.addEventListener('DOMContentLoaded', function() {
    const invoiceModals = document.querySelectorAll('[id^="createInvoiceModal"]');
    invoiceModals.forEach(modal => {
        // Lắng nghe sự kiện 'show.bs.modal' của Bootstrap
        modal.addEventListener('show.bs.modal', function () {
            const groupId = this.id.replace('createInvoiceModal', '');

            // Lấy các tham số mặc định được truyền từ HTML Data Attributes
            const monthlyRent = parseFloat(this.getAttribute('data-monthly-rent')) || 0;
            const wifiFee = parseFloat(this.getAttribute('data-wifi-fee')) || 0;
            const trashFee = parseFloat(this.getAttribute('data-trash-fee')) || 0;

            // Chạy tính toán ngay lập tức
            tinhTongTien(groupId, monthlyRent, wifiFee, trashFee);
        });
    });
});