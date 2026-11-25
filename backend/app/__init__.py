import os
from pathlib import Path

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from app.extensions import db


def create_app(test_config=None):
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    app = Flask(__name__)
    app.config.from_mapping(
        SQLALCHEMY_DATABASE_URI=os.getenv("DATABASE_URL", "sqlite:///patients.db"),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        RESTX_ERROR_404_HELP=False,
    )
    if test_config:
        app.config.update(test_config)
    if app.config["SQLALCHEMY_DATABASE_URI"].startswith("sqlite:///"):
        Path(app.instance_path).mkdir(parents=True, exist_ok=True)

    db.init_app(app)
    origins = os.getenv(
        "FRONTEND_ORIGINS", "http://localhost:4200,http://127.0.0.1:4200"
    ).split(",")
    CORS(app, resources={r"/patients/*": {"origins": [origin.strip() for origin in origins]}})

    from app.resources import api

    api.init_app(app)
    return app
