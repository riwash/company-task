from flask import current_app, request
from flask_restx import Api, Namespace, Resource, fields
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.models import BloodGroup, Patient
from app.services.patient_service import normalize_check_datetime, save_patient

api = Api(
    title="Patient Management API",
    version="1.0",
    description="REST API for managing patients and their check status.",
    doc="/swagger",
)
patients = Namespace("patients", description="Patient operations")
api.add_namespace(patients)

patient_model = api.model(
    "Patient",
    {
        "id": fields.Integer(readonly=True),
        "name": fields.String(required=True),
        "age": fields.Integer(required=True),
        "notes": fields.String,
        "check_datetime": fields.String(
            required=True, description="ISO 8601 datetime, stored and returned as naive UTC"
        ),
        "blood_group": fields.String(enum=[group.value for group in BloodGroup]),
        "status": fields.String(readonly=True, enum=["Pending", "Checked", "Failed"]),
        "created_at": fields.String(readonly=True, description="ISO 8601 UTC timestamp"),
        "updated_at": fields.String(readonly=True, description="ISO 8601 UTC timestamp"),
    },
)
batch_result_model = api.model(
    "BatchResult",
    {
        "success": fields.List(fields.Nested(patient_model)),
        "failed": fields.List(fields.Raw),
    },
)
error_model = api.model("Error", {"message": fields.String(required=True)})
batch_failure_model = api.model(
    "BatchFailure",
    {
        "item": fields.Raw(description="The item that could not be processed"),
        "reason": fields.String(required=True),
    },
)
batch_result_model["failed"] = fields.List(fields.Nested(batch_failure_model))


class InputError(ValueError):
    pass


class PatientNotFound(Exception):
    pass


def get_patient_or_raise(patient_id):
    patient = db.session.get(Patient, patient_id)
    if patient is None:
        raise PatientNotFound()
    return patient


def serialize_patient(patient):
    return {
        "id": patient.id,
        "name": patient.name,
        "age": patient.age,
        "notes": patient.notes,
        "check_datetime": patient.check_datetime.isoformat(),
        "blood_group": patient.blood_group.value if patient.blood_group else None,
        "status": patient.status.value,
        "created_at": patient.created_at.isoformat(),
        "updated_at": patient.updated_at.isoformat(),
    }


def parse_patient_input(payload, creating):
    if not isinstance(payload, dict):
        raise InputError("Request body must be a JSON object")
    if creating and "id" in payload:
        raise InputError("id must not be provided when creating a patient")

    required = ("name", "age", "check_datetime")
    missing = [field for field in required if field not in payload]
    if missing:
        raise InputError("Missing required field(s): " + ", ".join(missing))

    name = payload["name"]
    age = payload["age"]
    check_datetime = payload["check_datetime"]
    if not isinstance(name, str):
        raise InputError("name must be a string")
    if isinstance(age, bool) or not isinstance(age, int):
        raise InputError("age must be an integer")
    if not isinstance(check_datetime, str):
        raise InputError("check_datetime must be an ISO 8601 string")

    notes = payload.get("notes")
    if notes is not None and not isinstance(notes, str):
        raise InputError("notes must be a string or null")
    blood_group = payload.get("blood_group")
    if blood_group is not None:
        if not isinstance(blood_group, str):
            raise InputError("blood_group must be a string or null")
        try:
            blood_group = BloodGroup(blood_group)
        except ValueError as error:
            raise InputError("blood_group is not an allowed value") from error

    try:
        parsed_datetime = normalize_check_datetime(check_datetime)
    except ValueError as error:
        raise InputError(str(error)) from error

    return {
        "name": name,
        "age": age,
        "notes": notes,
        "check_datetime": parsed_datetime,
        "blood_group": blood_group,
    }


@api.errorhandler(InputError)
def handle_input_error(error):
    return {"message": str(error)}, 400


@api.errorhandler(PatientNotFound)
def handle_not_found(error):
    return {"message": "Patient not found"}, 404


@api.errorhandler(SQLAlchemyError)
def handle_database_error(error):
    db.session.rollback()
    current_app.logger.exception("Database operation failed")
    return {"message": "A database error occurred"}, 500


@patients.route("")
class PatientList(Resource):
    """List patients in ascending ID order or create a patient."""

    @patients.marshal_list_with(patient_model)
    def get(self):
        """Return every patient ordered by ID."""
        return [serialize_patient(patient) for patient in Patient.query.order_by(Patient.id).all()]

    @patients.expect(patient_model, validate=False)
    @patients.response(400, "Invalid patient input", error_model)
    @patients.marshal_with(patient_model, code=201)
    def post(self):
        """Create a patient and calculate its status."""
        patient = save_patient(Patient(), parse_patient_input(request.get_json(silent=True), True))
        return serialize_patient(patient), 201


@patients.route("/<int:patient_id>")
class PatientDetail(Resource):
    """Read, replace, or delete one patient."""

    @patients.marshal_with(patient_model)
    @patients.response(404, "Patient not found", error_model)
    def get(self, patient_id):
        """Return one patient by ID."""
        patient = get_patient_or_raise(patient_id)
        return serialize_patient(patient)

    @patients.expect(patient_model, validate=False)
    @patients.response(400, "Invalid patient input", error_model)
    @patients.response(404, "Patient not found", error_model)
    @patients.marshal_with(patient_model)
    def put(self, patient_id):
        """Replace a patient's input fields and recalculate status."""
        patient = get_patient_or_raise(patient_id)
        return serialize_patient(
            save_patient(patient, parse_patient_input(request.get_json(silent=True), False))
        )

    @patients.response(204, "Patient deleted")
    @patients.response(404, "Patient not found", error_model)
    def delete(self, patient_id):
        """Delete a patient by ID."""
        patient = get_patient_or_raise(patient_id)
        db.session.delete(patient)
        db.session.commit()
        return "", 204


@patients.route("/upsert-batch")
class PatientBatch(Resource):
    """Create or update patients in a partial-success batch."""

    @patients.expect([patient_model], validate=False)
    @patients.response(400, "Request body must be a JSON list", error_model)
    @patients.marshal_with(batch_result_model)
    def post(self):
        """Upsert patient records and return per-item results."""
        payload = request.get_json(silent=True)
        if not isinstance(payload, list):
            raise InputError("Request body must be a JSON list")

        result = {"success": [], "failed": []}
        for item in payload:
            try:
                if not isinstance(item, dict):
                    raise InputError("Each item must be a JSON object")
                patient_id = item.get("id")
                if patient_id is not None:
                    if isinstance(patient_id, bool) or not isinstance(patient_id, int):
                        raise InputError("id must be an integer")
                    patient = db.session.get(Patient, patient_id)
                    if patient is None:
                        raise InputError("not found")
                else:
                    patient = Patient()
                saved = save_patient(
                    patient,
                    parse_patient_input(item, creating=patient_id is None),
                )
                result["success"].append(serialize_patient(saved))
            except InputError as error:
                db.session.rollback()
                result["failed"].append({"item": item, "reason": str(error)})
            except SQLAlchemyError as error:
                db.session.rollback()
                current_app.logger.exception("Batch item failed")
                result["failed"].append({"item": item, "reason": "Database operation failed"})
        return result
