from datetime import datetime, timezone
from enum import Enum

from app.extensions import db


class PatientStatus(str, Enum):
    PENDING = "Pending"
    CHECKED = "Checked"
    FAILED = "Failed"


class BloodGroup(str, Enum):
    A_POSITIVE = "A+"
    A_NEGATIVE = "A-"
    B_POSITIVE = "B+"
    B_NEGATIVE = "B-"
    AB_POSITIVE = "AB+"
    AB_NEGATIVE = "AB-"
    O_POSITIVE = "O+"
    O_NEGATIVE = "O-"


class Patient(db.Model):
    __tablename__ = "patients"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    age = db.Column(db.Integer, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    check_datetime = db.Column(db.DateTime, nullable=False)
    blood_group = db.Column(
        db.Enum(
            BloodGroup,
            native_enum=False,
            values_callable=lambda enum_type: [member.value for member in enum_type],
        ),
        nullable=True,
    )
    status = db.Column(
        db.Enum(
            PatientStatus,
            native_enum=False,
            values_callable=lambda enum_type: [member.value for member in enum_type],
        ),
        nullable=False,
        default=PatientStatus.PENDING,
    )
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
