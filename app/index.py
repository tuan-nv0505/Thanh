from app import app
from app.routes.apis import api_bp
from app.routes.views import view_bp

app.register_blueprint(view_bp)
app.register_blueprint(api_bp, url_prefix='/api')

if __name__ == '__main__':
    app.run(debug=True)