import hashlib
import unicodedata

from app import models, db
from datetime import date, datetime


def get_rooms() -> list[models.Room]:
    rooms = models.Room.query.all()
    return rooms


def get_room_by_id(room_id: int) -> models.Room:
    return models.Room.query.get(room_id)


def get_active_rent_groups(room_id: int) -> list[models.RentGroup]:
    # Chỉ lấy những nhóm chưa bị xóa mềm (active == True)
    return models.RentGroup.query.filter_by(room_id=room_id, active=True).all()


def add_rent_group(room_id: int, group_name: str, deposit_amount: float):
    new_group = models.RentGroup(
        group_name=group_name,
        deposit_amount=deposit_amount,
        room_id=room_id,
        active=True
    )
    db.session.add(new_group)
    db.session.commit()


def update_rent_group(group_id: int, group_name: str, deposit_amount: float):
    group = models.RentGroup.query.get(group_id)
    if group:
        group.group_name = group_name
        group.deposit_amount = deposit_amount
        db.session.commit()
    return group


def soft_delete_rent_group(group_id: int):
    group = models.RentGroup.query.get(group_id)
    if group:
        # XÓA MỀM: Đổi trạng thái thay vì xóa vật lý
        group.active = False

        # Xóa mềm luôn toàn bộ khách hàng đang nằm trong nhóm này
        for customer in group.customers:
            customer.active = False

        db.session.commit()
    return group

def update_room_fees(room_id: int, monthly_rent: float, wifi_fee: float, trash_fee: float, description: str, is_rented: bool):
    room = models.Room.query.get(room_id)
    if room:
        room.monthly_rent = monthly_rent
        room.wifi_fee = wifi_fee
        room.trash_fee = trash_fee
        room.description = description
        room.is_rented = is_rented
        db.session.commit()
    return room

def get_rent_group_by_id(group_id: int) -> models.RentGroup:
    return models.RentGroup.query.get(group_id)


def get_active_customers(group_id: int) -> list[models.Customer]:
    return models.Customer.query.filter_by(rent_group_id=group_id, active=True) \
        .order_by(models.Customer.is_representative.desc(), models.Customer.id.asc()).all()


# Cập nhật hàm thêm khách hàng
def add_customer(group_id: int, name: str, gender: str, person_id: str, phone: str, address: str, is_rep: bool):
    # Kiểm tra xem nhóm đã có ai chưa. Nếu đây là người đầu tiên -> Bắt buộc làm đại diện
    existing_count = models.Customer.query.filter_by(rent_group_id=group_id, active=True).count()
    if existing_count == 0:
        is_rep = True

    # Nếu người này được chọn làm đại diện, phải gỡ đại diện của tất cả người cũ trong nhóm
    if is_rep:
        models.Customer.query.filter_by(rent_group_id=group_id, active=True).update({'is_representative': False})

    new_cus = models.Customer(
        customer_name=name, gender=gender, person_id=person_id,
        phone_number=phone, address=address, rent_group_id=group_id,
        is_representative=is_rep, active=True
    )
    db.session.add(new_cus)
    db.session.commit()


def update_customer(customer_id: int, name: str, gender: str, person_id: str, phone: str, address: str, is_rep: bool):
    cus = models.Customer.query.get(customer_id)
    if cus:
        if is_rep and not cus.is_representative:
            models.Customer.query.filter_by(rent_group_id=cus.rent_group_id, active=True).update(
                {'is_representative': False})

        cus.customer_name = name
        cus.gender = gender
        cus.person_id = person_id
        cus.phone_number = phone
        cus.address = address
        total_active = models.Customer.query.filter_by(rent_group_id=cus.rent_group_id, active=True).count()
        cus.is_representative = True if total_active <= 1 else is_rep

        db.session.commit()
    return cus


# Cập nhật lại hàm xóa khách hàng trong dao.py
def soft_delete_customer(customer_id: int):
    cus = models.Customer.query.get(customer_id)
    if cus:
        # KIỂM TRA RÀO CẢN: Nếu là đại diện, bắt buộc phải nhường quyền trước
        if cus.is_representative:
            # Đếm xem trong nhóm còn ai khác đang ở không
            other_members = models.Customer.query.filter(
                models.Customer.rent_group_id == cus.rent_group_id,
                models.Customer.id != customer_id,  # Loại trừ bản thân người này ra
                models.Customer.active == True
            ).count()

            if other_members > 0:
                raise ValueError(
                    "BẮT BUỘC CHUYỂN QUYỀN: Hãy sửa 1 thành viên khác thành Đại diện trước khi xóa người này!")

        # Nếu hợp lệ, tiến hành xóa mềm
        cus.active = False
        cus.move_out_date = date.today()
        cus.is_representative = False  # Tước quyền đại diện khi rời đi
        db.session.commit()

    return cus


def create_invoice(room_id: int, data: dict):
    room = models.Room.query.get(room_id)
    if not room: raise ValueError("Phòng không tồn tại")

    start_date = date.today()
    end_date = date.today()

    # Tính Điện
    old_elec = float(data.get('old_electricity_index', 0))
    new_elec = float(data.get('new_electricity_index', 0))
    elec_price = float(data.get('electricity_price', 0))
    if new_elec < old_elec: raise ValueError("Số điện mới không được nhỏ hơn số cũ")
    elec_cost = (new_elec - old_elec) * elec_price

    # Tính Nước
    old_water = float(data.get('old_water_index', 0))
    new_water = float(data.get('new_water_index', 0))
    water_price = float(data.get('water_price', 0))
    if new_water < old_water: raise ValueError("Số nước mới không được nhỏ hơn số cũ")
    water_cost = (new_water - old_water) * water_price

    # Logic: Phí phòng, Wifi, Rác dựa trên số ngày và GIÁ NGÀY TÙY CHỈNH
    rent_days_str = data.get('rent_days', '').strip()
    custom_price_str = data.get('room_price_per_day', '').strip()

    applied_rent = room.monthly_rent
    applied_wifi = room.wifi_fee
    applied_trash = room.trash_fee

    if rent_days_str:
        rent_days = int(rent_days_str)

        # Quyết định giá 1 ngày
        price_per_day = room.monthly_rent / 30.0
        if custom_price_str:
            try:
                price_per_day = float(custom_price_str)
            except ValueError:
                pass  # Lỗi ép kiểu thì bỏ qua, dùng giá mặc định

        applied_rent = rent_days * price_per_day

        # NẾU Ở DƯỚI 10 NGÀY -> CẮT PHÍ WIFI & RÁC
        if rent_days < 10:
            applied_wifi = 0
            applied_trash = 0

    # Tiền Cọc
    deducted_deposit = 0.0
    if data.get('deduct_deposit') == 'on':
        group = models.RentGroup.query.filter_by(room_id=room.id, active=True).first()
        if group:
            deducted_deposit = group.deposit_amount

    # Tính Tổng
    total = elec_cost + water_cost + applied_rent + applied_wifi + applied_trash - deducted_deposit

    inv_code = f"{datetime.now().strftime('%d%m%Y-%H%M%S')}-{unicodedata.normalize('NFD', room.room_name).encode('ascii', 'ignore').decode('utf-8').replace(' ', '')}"

    invoice = models.Invoice(
        invoice_code=inv_code,
        service_start_date=start_date, service_end_date=end_date,
        rent_start_date=start_date, rent_end_date=end_date,
        old_electricity_index=old_elec, new_electricity_index=new_elec,
        electricity_usage=new_elec - old_elec, applied_electricity_price=elec_price, electricity_cost=elec_cost,
        old_water_index=old_water, new_water_index=new_water,
        water_usage=new_water - old_water, applied_water_price=water_price, water_cost=water_cost,
        applied_room_rent=applied_rent, applied_wifi_fee=applied_wifi, applied_trash_fee=applied_trash,
        deducted_deposit=deducted_deposit,
        total_amount=total, room_id=room_id
    )

    room.current_electricity_index = new_elec
    room.current_water_index = new_water

    db.session.add(invoice)
    db.session.commit()
    return invoice

def get_user_by_id(id):
    return models.User.query.get(id)

def auth_user(username, password):
    password = str(hashlib.md5(password.strip().encode('utf-8')).hexdigest())
    return models.User.query.filter(models.User.username==username,
                             models.User.password==password).first()

def soft_delete_invoice(invoice_id: int):
    inv = models.Invoice.query.get(invoice_id)
    if inv:
        inv.active = False  # Đổi trạng thái thay vì db.session.delete(inv)
        db.session.commit()
    return inv