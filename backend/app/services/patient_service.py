from datetime import datetime, timezone

from app.extensions import db
from app.models import Patient, PatientStatus


def evaluate_patient_status(patient):
    if patient.age < 0 or patient.age > 120:
        return PatientStatus.FAILED.value
    if len(patient.name) < 2 or any(character.isdigit() for character in patient.name):
        return PatientStatus.FAILED.value
    if patient.check_datetime > datetime.now(timezone.utc).replace(tzinfo=None):
        return PatientStatus.FAILED.value
    if patient.notes and "urgent" in patient.notes.casefold():
        return PatientStatus.CHECKED.value
    return PatientStatus.PENDING.value


def normalize_check_datetime(value):
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("check_datetime must be a valid ISO 8601 datetime") from error
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def save_patient(patient, values):
    for field, value in values.items():
        setattr(patient, field, value)
    patient.status = PatientStatus(evaluate_patient_status(patient))
    db.session.add(patient)
    db.session.commit()
    return patient
