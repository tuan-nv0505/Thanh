from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, login_user, logout_user
from app import dao, models, login

view_bp = Blueprint('views', __name__)

@view_bp.route("/", methods=["GET"])
@login_required
def index():
    rooms = dao.get_rooms()
    return render_template("index.html", rooms=rooms)

@view_bp.route('/rooms/<int:room_id>', methods=['GET'])
@login_required
def room_detail(room_id):
    room = dao.get_room_by_id(room_id)
    if not room: return "Phòng không tồn tại", 404
    groups = dao.get_active_rent_groups(room_id)
    return render_template('room_detail.html', room=room, groups=groups)

@view_bp.route('/groups/<int:group_id>', methods=['GET'])
@login_required
def group_detail(group_id):
    group = dao.get_rent_group_by_id(group_id)
    if not group: return "Nhóm thuê không tồn tại", 404
    customers = dao.get_active_customers(group_id)
    return render_template('group_detail.html', group=group, customers=customers)

# Gộp chung GET và POST để xử lý gọn gàng
@view_bp.route('/login', methods=['GET', 'POST'])
def login_view():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        user = dao.auth_user(username=username, password=password)
        if user:
            login_user(user=user)
            # Chuyển hướng về trang người dùng muốn vào ban đầu (nếu có)
            next_page = request.args.get('next')
            return redirect(next_page if next_page else url_for('views.index'))
        else:
            flash("Tài khoản hoặc mật khẩu không chính xác!", "danger")

    return render_template('login.html')

@view_bp.route('/logout')
def logout_process():
    logout_user()
    return redirect(url_for('views.login_view'))

@login.user_loader
def load_user(id):
    return dao.get_user_by_id(id)