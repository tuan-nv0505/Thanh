from flask import Blueprint, request, jsonify
from flask_login import login_required
from app import dao, db, models

api_bp = Blueprint('api', __name__)

@api_bp.route('/rooms/<int:room_id>', methods=['PUT'])
@login_required
def update_room(room_id):
    data = request.json
    try:
        # Xử lý ép kiểu: Trả về True nếu giá trị nhận được là '1' (hoặc số 1), ngược lại là False
        raw_is_rented = data.get('is_rented', False)
        is_rented_bool = raw_is_rented in ['1', 1, 'true', True]

        dao.update_room_fees(
            room_id,
            float(data.get('monthly_rent', 0)),
            float(data.get('wifi_fee', 0)),
            float(data.get('trash_fee', 0)),
            data.get('description', ''),
            is_rented_bool
        )
        return jsonify({"message": "Cập nhật thành công"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@api_bp.route('/rooms/<int:room_id>/groups', methods=['POST'])
@login_required
def add_group(room_id):
    data = request.json
    try:
        dao.add_rent_group(room_id, data.get('group_name'), float(data.get('deposit_amount', 0)))
        return jsonify({"message": "Tạo nhóm thành công"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@api_bp.route('/groups/<int:group_id>', methods=['PUT'])
@login_required
def update_group(group_id):
    data = request.json
    dao.update_rent_group(group_id, data.get('group_name'), float(data.get('deposit_amount', 0)))
    return jsonify({"message": "Cập nhật nhóm thành công"}), 200

@api_bp.route('/groups/<int:group_id>', methods=['DELETE'])
@login_required
def remove_group(group_id):
    dao.soft_delete_rent_group(group_id)
    return jsonify({"message": "Đã xóa nhóm"}), 200

@api_bp.route('/groups/<int:group_id>/customers', methods=['POST'])
@login_required
def add_customer(group_id):
    data = request.json
    is_rep = data.get('is_representative') in ['on', True, 'true']
    try:
        dao.add_customer(group_id, data.get('customer_name'), data.get('gender'), data.get('person_id'), data.get('phone_number'), data.get('address'), is_rep)
        return jsonify({"message": "Thêm khách thành công"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Lỗi thêm khách (Có thể trùng CCCD)"}), 400

@api_bp.route('/customers/<int:customer_id>', methods=['PUT'])
@login_required
def update_customer(customer_id):
    data = request.json
    is_rep = data.get('is_representative') in ['on', True, 'true']
    try:
        dao.update_customer(customer_id, data.get('customer_name'), data.get('gender'), data.get('person_id'), data.get('phone_number'), data.get('address'), is_rep)
        return jsonify({"message": "Cập nhật khách thành công"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Lỗi cập nhật (Có thể trùng CCCD)"}), 400

@api_bp.route('/customers/<int:customer_id>', methods=['DELETE'])
@login_required
def remove_customer(customer_id):
    try:
        dao.soft_delete_customer(customer_id)
        return jsonify({"message": "Đã xóa khách hàng"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@api_bp.route('/rooms/<int:room_id>/invoices', methods=['POST'])
@login_required
def add_invoice(room_id):
    data = request.json
    try:
        inv = dao.create_invoice(room_id, data)
        room = dao.get_room_by_id(room_id)
        group = models.RentGroup.query.filter_by(room_id=room_id, active=True).first()

        invoice_data = {
            "invoice_code": inv.invoice_code,
            "room_name": room.room_name,
            "group_name": group.group_name if group else "Khách vãng lai",
            "created_at": inv.created_at.strftime("%d/%m/%Y"),
            "elec_old": inv.old_electricity_index,
            "elec_new": inv.new_electricity_index,
            "elec_usage": inv.electricity_usage,
            "elec_price": inv.applied_electricity_price,
            "elec_cost": inv.electricity_cost,
            "water_old": inv.old_water_index,
            "water_new": inv.new_water_index,
            "water_usage": inv.water_usage,
            "water_price": inv.applied_water_price,
            "water_cost": inv.water_cost,
            "room_rent": inv.applied_room_rent,
            "services_fee": inv.applied_wifi_fee + inv.applied_trash_fee,
            "deducted": inv.deducted_deposit,
            "total": inv.total_amount
        }

        return jsonify({
            "message": "Tạo hóa đơn thành công",
            "data": invoice_data
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


# API: Lấy toàn bộ thông tin của 1 hóa đơn để Xem và Tải lại
@api_bp.route('/invoices/<int:invoice_id>/full', methods=['GET'])
@login_required
def get_full_invoice_data(invoice_id):
    inv = models.Invoice.query.get(invoice_id)
    if not inv:
        return jsonify({"error": "Không tìm thấy hóa đơn"}), 404

    room = inv.room
    group = models.RentGroup.query.filter_by(room_id=room.id, active=True).first()

    return jsonify({
        "room_name": room.room_name,
        "group_name": group.group_name if group else "Khách",
        "elec_old": inv.old_electricity_index,
        "elec_new": inv.new_electricity_index,
        "elec_usage": inv.electricity_usage,
        "elec_price": inv.applied_electricity_price,
        "elec_cost": inv.electricity_cost,
        "water_old": inv.old_water_index,
        "water_new": inv.new_water_index,
        "water_usage": inv.water_usage,
        "water_price": inv.applied_water_price,
        "water_cost": inv.water_cost,
        "room_rent": inv.applied_room_rent,
        "wifi_fee": inv.applied_wifi_fee,
        "trash_fee": inv.applied_trash_fee,
        "services_fee": inv.applied_wifi_fee + inv.applied_trash_fee,
        "deducted": inv.deducted_deposit,
        "total": inv.total_amount,
        "created_at": inv.created_at.strftime('%d/%m/%Y')
    }), 200

# API: Lấy thông tin hóa đơn dựa vào mã hóa đơn (Dùng cho chức năng Gộp)
@api_bp.route('/invoices/code/<string:invoice_code>', methods=['GET'])
@login_required
def get_invoice_by_code(invoice_code):
    inv = models.Invoice.query.filter_by(invoice_code=invoice_code).first()
    if not inv:
        return jsonify({"error": "Không tìm thấy hóa đơn với mã này"}), 404

    room = inv.room
    group = models.RentGroup.query.filter_by(room_id=room.id, active=True).first()

    return jsonify({
        "invoice_code": inv.invoice_code,
        "room_name": room.room_name,
        "group_name": group.group_name if group else "Khách",
        "elec_old": inv.old_electricity_index,
        "elec_new": inv.new_electricity_index,
        "elec_usage": inv.electricity_usage,
        "elec_price": inv.applied_electricity_price,
        "elec_cost": inv.electricity_cost,
        "water_old": inv.old_water_index,
        "water_new": inv.new_water_index,
        "water_usage": inv.water_usage,
        "water_price": inv.applied_water_price,
        "water_cost": inv.water_cost,
        "room_rent": inv.applied_room_rent,
        "wifi_fee": inv.applied_wifi_fee,
        "trash_fee": inv.applied_trash_fee,
        "services_fee": inv.applied_wifi_fee + inv.applied_trash_fee,
        "deducted": inv.deducted_deposit,
        "total": inv.total_amount,
        "created_at": inv.created_at.strftime('%d/%m/%Y')
    }), 200