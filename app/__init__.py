from dotenv import load_dotenv
load_dotenv()

from flask import Flask
from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy
from app.config import Config

db = SQLAlchemy()
app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)

login = LoginManager(app=app)
login.login_view = 'views.login_view' # Tự động chuyển về trang login nếu chưa đăng nhập
login.login_message = "Vui lòng đăng nhập để truy cập trang này."
login.login_message_category = "warning"