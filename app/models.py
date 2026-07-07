from datetime import date, datetime

from flask_login import UserMixin
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Float, DateTime, Date
from sqlalchemy.orm import relationship

from app import app, db


class BaseModel(db.Model):
    __abstract__ = True

    id = Column(Integer, primary_key=True, autoincrement=True)
    active = Column(Boolean, nullable=False, default=True)


class User(BaseModel, UserMixin):
    __tablename__ = 'users'

    username = Column(String(50), nullable=False, unique=True)
    password = Column(String(255), nullable=False)


class Room(BaseModel):
    __tablename__ = 'rooms'

    room_name = Column(String(50), nullable=False, unique=True)
    monthly_rent = Column(Float, nullable=False)
    wifi_fee = Column(Float, nullable=False, default=0.0)
    trash_fee = Column(Float, nullable=False, default=0.0)
    current_electricity_index = Column(Float, nullable=False, default=0.0)
    current_water_index = Column(Float, nullable=False, default=0.0)
    description = Column(String(100), nullable=True)

    is_rented = Column(Boolean, nullable=False, default=False)

    rent_groups = relationship('RentGroup', backref='room', lazy=True)
    invoices = relationship('Invoice', backref='room', lazy=True)


class RentGroup(BaseModel):
    __tablename__ = 'rent_groups'

    group_name = Column(String(100), nullable=True)
    deposit_amount = Column(Float, nullable=False, default=0.0)
    room_id = Column(Integer, ForeignKey('rooms.id'), nullable=False)

    customers = relationship('Customer', backref='rent_group', lazy=True)


class Customer(BaseModel):
    __tablename__ = 'customers'

    customer_name = Column(String(100), nullable=False)
    gender = Column(String(10), nullable=False)
    person_id = Column(String(20), nullable=False, unique=True)
    phone_number = Column(String(15), nullable=False)
    address = Column(String(200), nullable=False)
    is_representative = Column(Boolean, nullable=False, default=False)
    move_in_date = Column(Date, nullable=False, default=date.today)
    move_out_date = Column(Date, nullable=True)

    rent_group_id = Column(Integer, ForeignKey('rent_groups.id'), nullable=False)


class Invoice(BaseModel):
    __tablename__ = 'invoices'

    invoice_code = Column(String(50), nullable=False, unique=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    is_checkout_bill = Column(Boolean, nullable=False, default=False)

    service_start_date = Column(Date, nullable=False)
    service_end_date = Column(Date, nullable=False)
    rent_start_date = Column(Date, nullable=False)
    rent_end_date = Column(Date, nullable=False)

    old_electricity_index = Column(Float, nullable=False)
    new_electricity_index = Column(Float, nullable=False)
    electricity_usage = Column(Float, nullable=False)
    applied_electricity_price = Column(Float, nullable=False)
    electricity_cost = Column(Float, nullable=False)

    old_water_index = Column(Float, nullable=False)
    new_water_index = Column(Float, nullable=False)
    water_usage = Column(Float, nullable=False)
    applied_water_price = Column(Float, nullable=False)
    water_cost = Column(Float, nullable=False)

    applied_room_rent = Column(Float, nullable=False)
    applied_wifi_fee = Column(Float, nullable=False)
    applied_trash_fee = Column(Float, nullable=False)

    deducted_deposit = Column(Float, nullable=False, default=0.0)
    total_amount = Column(Float, nullable=False)
    payment_status = Column(String(20), nullable=False, default='UNPAID')
    paid_date = Column(DateTime, nullable=True)
    room_id = Column(Integer, ForeignKey('rooms.id'), nullable=False)

if __name__ == '__main__':
    room_numbers = [str(i) for i in range(1, 13)] + ['12A'] + [str(i) for i in range(14, 20)]

    with app.app_context():
        db.create_all()

        for num in room_numbers:
            ten_phong = f"Phòng {num}"
            new_room = Room(
                room_name=ten_phong,
                monthly_rent=0.0,
                wifi_fee=0.0,
                trash_fee=0.0,
                description=f"Phòng trọ {ten_phong}",
                is_rented=False
            )
            db.session.add(new_room)

        import hashlib
        u = User(username='admin', password=str(hashlib.md5('admin123'.encode('utf-8')).hexdigest()))
        db.session.add(u)

        db.session.commit()