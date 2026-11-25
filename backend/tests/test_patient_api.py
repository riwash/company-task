from datetime import datetime, timedelta, timezone

import pytest

from app import create_app
from app.extensions import db


@pytest.fixture()
def client():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        }
    )
    with app.app_context():
        db.create_all()
        yield app.test_client()
        db.session.remove()
        db.drop_all()


def patient_payload(**overrides):
    payload = {
        "name": "Jane Doe",
        "age": 42,
        "check_datetime": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
    }
    payload.update(overrides)
    return payload


def test_create_list_update_and_delete_patient(client):
    response = client.post(
        "/patients",
        json=patient_payload(age=150, notes="urgent follow-up", status="Pending"),
    )

    assert response.status_code == 201
    created = response.get_json()
    assert created["status"] == "Failed"
    assert created["notes"] == "urgent follow-up"

    assert client.get("/patients").get_json() == [created]
    assert client.get(f"/patients/{created['id']}").get_json() == created

    updated = client.put(
        f"/patients/{created['id']}",
        json=patient_payload(age=42, id=900, status="Failed"),
    )
    assert updated.status_code == 200
    assert updated.get_json()["status"] == "Pending"
    assert updated.get_json()["notes"] is None
    assert updated.get_json()["blood_group"] is None

    assert client.delete(f"/patients/{created['id']}").status_code == 204
    missing = client.delete(f"/patients/{created['id']}")
    assert missing.status_code == 404
    assert missing.get_json() == {"message": "Patient not found"}


@pytest.mark.parametrize(
    "payload",
    [
        {"name": "Jane", "age": "42", "check_datetime": "2026-01-01T10:00:00"},
        {"name": "Jane", "age": 42, "check_datetime": "not-a-date"},
        {
            "name": "Jane",
            "age": 42,
            "check_datetime": "2026-01-01T10:00:00",
            "blood_group": "X+",
        },
        {"age": 42, "check_datetime": "2026-01-01T10:00:00"},
        {
            "id": 3,
            "name": "Jane",
            "age": 42,
            "check_datetime": "2026-01-01T10:00:00",
        },
    ],
)
def test_invalid_create_returns_json_400(client, payload):
    response = client.post("/patients", json=payload)

    assert response.status_code == 400
    assert isinstance(response.get_json()["message"], str)
    assert client.get("/patients").get_json() == []


def test_batch_upsert_keeps_valid_items_and_reports_failures(client):
    existing = client.post("/patients", json=patient_payload(name="Alex Patient")).get_json()
    payload = [
        {"id": existing["id"], **patient_payload(name="Morgan Lee", age=150)},
        patient_payload(name="Sam Patient"),
        {"id": 500, **patient_payload()},
        patient_payload(age="not an integer"),
    ]

    response = client.post("/patients/upsert-batch", json=payload)
    result = response.get_json()

    assert response.status_code == 200
    assert len(result["success"]) == 2
    assert result["success"][0]["name"] == "Morgan Lee"
    assert result["success"][0]["status"] == "Failed"
    assert result["success"][1]["name"] == "Sam Patient"
    assert [entry["reason"] for entry in result["failed"]] == [
        "not found",
        "age must be an integer",
    ]
    assert len(client.get("/patients").get_json()) == 2
    assert client.post("/patients/upsert-batch", json={"items": []}).status_code == 400


def test_empty_name_is_valid_input_and_receives_failed_status(client):
    response = client.post("/patients", json=patient_payload(name=""))

    assert response.status_code == 201
    assert response.get_json()["name"] == ""
    assert response.get_json()["status"] == "Failed"


def test_swagger_documentation_is_available(client):
    response = client.get("/swagger.json")

    assert response.status_code == 200
    assert "/patients" in response.get_json()["paths"]


@pytest.mark.parametrize("origin", ["http://localhost:4200", "http://127.0.0.1:4200"])
def test_local_angular_origins_are_allowed(client, origin):
    response = client.get("/patients", headers={"Origin": origin})

    assert response.headers["Access-Control-Allow-Origin"] == origin
