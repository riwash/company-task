from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.patient_service import evaluate_patient_status


def patient(**overrides):
    values = {
        "name": "Jane Doe",
        "age": 42,
        "check_datetime": datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1),
        "notes": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_status_rules_apply_in_priority_order():
    assert evaluate_patient_status(patient(age=150, notes="urgent")) == "Failed"
    assert evaluate_patient_status(patient(name="J4ne", notes="urgent")) == "Failed"
    assert evaluate_patient_status(
        patient(
            check_datetime=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=1),
            notes="urgent",
        )
    ) == "Failed"
    assert evaluate_patient_status(patient(notes="URGENT follow-up")) == "Checked"
    assert evaluate_patient_status(patient()) == "Pending"


def test_empty_name_is_stored_as_failed_status():
    assert evaluate_patient_status(patient(name="")) == "Failed"
