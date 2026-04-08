# routers/nurse.py — Nurse panel APIs with WebSocket real-time support
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, date
import json
import random
import string

from database import get_db, Patient, VitalSign, NurseReport, User
from auth import get_nurse, get_current_user, decode_token
from blockchain import add_block, compute_hash
from rag_engine import index_document
from pydantic import BaseModel

router = APIRouter(prefix="/nurse", tags=["Nurse"])


# ── Add Patient Schema ─────────────────────────────────────────

class AddPatientRequest(BaseModel):
    full_name: str
    age: Optional[int] = None
    gender: Optional[str] = "Unknown"
    blood_type: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    # Initial vitals (optional)
    heart_rate: Optional[float] = None
    systolic_bp: Optional[float] = None
    diastolic_bp: Optional[float] = None
    oxygen_saturation: Optional[float] = None



# ── WebSocket Connection Manager ──────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, patient_id: int):
        await websocket.accept()
        if patient_id not in self.active_connections:
            self.active_connections[patient_id] = []
        self.active_connections[patient_id].append(websocket)

    def disconnect(self, websocket: WebSocket, patient_id: int):
        if patient_id in self.active_connections:
            self.active_connections[patient_id] = [
                ws for ws in self.active_connections[patient_id] if ws != websocket
            ]

    async def broadcast_to_patient(self, patient_id: int, message: dict):
        if patient_id in self.active_connections:
            dead = []
            for ws in self.active_connections[patient_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.active_connections[patient_id].remove(ws)


manager = ConnectionManager()


# ── Pydantic schemas ──────────────────────────────────────────

class VitalsCreate(BaseModel):
    heart_rate: Optional[float] = None
    systolic_bp: Optional[float] = None
    diastolic_bp: Optional[float] = None
    temperature: Optional[float] = None
    oxygen_saturation: Optional[float] = None
    respiratory_rate: Optional[float] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    notes: Optional[str] = None

class NurseReportCreate(BaseModel):
    shift: str
    report_type: str
    summary: str
    observations: Optional[str] = None
    interventions: Optional[str] = None
    patient_response: Optional[str] = None
    pain_scale: Optional[int] = None
    mobility: Optional[str] = None


# ── Patient list for nurse ────────────────────────────────────

@router.get("/patients")
def list_nurse_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_nurse)
):
    patients = db.query(Patient).all()
    result = []
    for p in patients:
        latest = db.query(VitalSign).filter(VitalSign.patient_id == p.id).order_by(VitalSign.recorded_at.desc()).first()
        result.append({
            "id": p.id,
            "patient_code": p.patient_code,
            "full_name": p.user.full_name if p.user else "Unknown",
            "gender": p.gender,
            "blood_type": p.blood_type,
            "allergies": p.allergies,
            "chronic_conditions": p.chronic_conditions,
            "latest_vitals": {
                "heart_rate": latest.heart_rate,
                "systolic_bp": latest.systolic_bp,
                "diastolic_bp": latest.diastolic_bp,
                "temperature": latest.temperature,
                "oxygen_saturation": latest.oxygen_saturation,
                "recorded_at": latest.recorded_at.isoformat() if latest.recorded_at else None
            } if latest else None
        })
    return result


# ── Add new patient ───────────────────────────────────────────

@router.post("/patients")
def add_patient(
    data: AddPatientRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_nurse)
):
    # Generate unique patient code e.g. PT10045
    suffix = ''.join(random.choices(string.digits, k=5))
    patient_code = f"PT{suffix}"
    while db.query(Patient).filter(Patient.patient_code == patient_code).first():
        suffix = ''.join(random.choices(string.digits, k=5))
        patient_code = f"PT{suffix}"

    # Auto-generate username from name
    base_username = data.full_name.lower().replace(" ", "_")
    username = base_username
    counter = 1
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}{counter}"
        counter += 1

    # Auto-generate email
    email = f"{username}@pharmaguard.local"
    while db.query(User).filter(User.email == email).first():
        email = f"{username}{random.randint(100,999)}@pharmaguard.local"

    # Create User account (hashed password = changeme123)
    from auth import hash_password
    new_user = User(
        username=username,
        email=email,
        hashed_password=hash_password("changeme123"),
        role="patient",
        full_name=data.full_name,
        is_active=True
    )
    db.add(new_user)
    db.flush()  # get new_user.id without committing

    # Compute date_of_birth from age if provided
    dob = None
    if data.age:
        birth_year = datetime.utcnow().year - data.age
        dob = f"{birth_year}-01-01"

    # Create Patient profile
    new_patient = Patient(
        user_id=new_user.id,
        patient_code=patient_code,
        date_of_birth=dob,
        gender=data.gender,
        blood_type=data.blood_type,
        allergies=data.allergies,
        chronic_conditions=data.chronic_conditions,
    )
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)
    db.refresh(new_user)

    # Log initial vitals if provided
    if any([data.heart_rate, data.systolic_bp, data.oxygen_saturation]):
        vital = VitalSign(
            patient_id=new_patient.id,
            recorded_by=current_user.id,
            heart_rate=data.heart_rate,
            systolic_bp=data.systolic_bp,
            diastolic_bp=data.diastolic_bp,
            oxygen_saturation=data.oxygen_saturation,
            recorded_at=datetime.utcnow()
        )
        db.add(vital)
        db.commit()
        db.refresh(vital)
        initial_vitals = {
            "heart_rate": vital.heart_rate,
            "systolic_bp": vital.systolic_bp,
            "diastolic_bp": vital.diastolic_bp,
            "oxygen_saturation": vital.oxygen_saturation,
            "recorded_at": vital.recorded_at.isoformat()
        }
    else:
        initial_vitals = None

    # Index into RAG
    index_document(db, "patient",
        f"Patient {data.full_name} ({patient_code}): {data.gender}, {data.age or '?'}y. "
        f"Conditions: {data.chronic_conditions or 'none'}. Allergies: {data.allergies or 'none'}.",
        new_patient.id, {"added_by": current_user.full_name})

    # Blockchain audit
    add_block(db, "CREATE", "patient", new_patient.id, current_user.id, current_user.role,
              {"patient_code": patient_code, "name": data.full_name, "added_by_nurse": current_user.full_name})

    return {
        "id": new_patient.id,
        "patient_code": patient_code,
        "full_name": new_user.full_name,
        "gender": new_patient.gender,
        "blood_type": new_patient.blood_type,
        "allergies": new_patient.allergies,
        "chronic_conditions": new_patient.chronic_conditions,
        "latest_vitals": initial_vitals,
        "message": f"Patient {data.full_name} added successfully"
    }




# ── Log vitals ────────────────────────────────────────────────

@router.post("/patient/{patient_id}/vitals")
async def log_vitals(
    patient_id: int,
    vitals: VitalsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_nurse)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    vital_record = VitalSign(
        patient_id=patient_id,
        recorded_by=current_user.id,
        heart_rate=vitals.heart_rate,
        systolic_bp=vitals.systolic_bp,
        diastolic_bp=vitals.diastolic_bp,
        temperature=vitals.temperature,
        oxygen_saturation=vitals.oxygen_saturation,
        respiratory_rate=vitals.respiratory_rate,
        weight=vitals.weight,
        height=vitals.height,
        notes=vitals.notes,
        recorded_at=datetime.utcnow()
    )
    db.add(vital_record)
    db.commit()
    db.refresh(vital_record)
    
    # Blockchain audit
    vitals_data = vitals.dict()
    vitals_data["patient_id"] = patient_id
    vitals_data["nurse_id"] = current_user.id
    add_block(db, "CREATE", "vital_signs", vital_record.id, current_user.id, current_user.role, vitals_data, patient_id=patient.user_id)
    
    # Broadcast via WebSocket to all watchers of this patient
    ws_message = {
        "event": "vitals_update",
        "patient_id": patient_id,
        "vitals": {
            "id": vital_record.id,
            "heart_rate": vital_record.heart_rate,
            "systolic_bp": vital_record.systolic_bp,
            "diastolic_bp": vital_record.diastolic_bp,
            "temperature": vital_record.temperature,
            "oxygen_saturation": vital_record.oxygen_saturation,
            "respiratory_rate": vital_record.respiratory_rate,
            "notes": vital_record.notes,
            "recorded_at": vital_record.recorded_at.isoformat(),
            "nurse_name": current_user.full_name
        }
    }
    await manager.broadcast_to_patient(patient_id, ws_message)
    
    # RAG index
    index_document(db, "vitals",
                   f"Vitals: HR={vitals.heart_rate}, BP={vitals.systolic_bp}/{vitals.diastolic_bp}, "
                   f"Temp={vitals.temperature}, SpO2={vitals.oxygen_saturation}%",
                   patient_id, {"nurse": current_user.full_name, "type": "vitals"})
    
    return {"id": vital_record.id, "message": "Vitals logged successfully", "broadcasted": True}


# ── Get vitals history ────────────────────────────────────────

@router.get("/patient/{patient_id}/vitals")
def get_vitals_history(
    patient_id: int,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_nurse)
):
    vitals = db.query(VitalSign).filter(VitalSign.patient_id == patient_id).order_by(VitalSign.recorded_at.desc()).limit(limit).all()
    return [
        {
            "id": v.id,
            "heart_rate": v.heart_rate,
            "systolic_bp": v.systolic_bp,
            "diastolic_bp": v.diastolic_bp,
            "temperature": v.temperature,
            "oxygen_saturation": v.oxygen_saturation,
            "respiratory_rate": v.respiratory_rate,
            "weight": v.weight,
            "notes": v.notes,
            "recorded_at": v.recorded_at.isoformat() if v.recorded_at else None,
            "nurse_name": v.nurse.full_name if v.nurse else "Unknown"
        } for v in vitals
    ]


# ── Nurse reports ─────────────────────────────────────────────

@router.post("/patient/{patient_id}/report")
def submit_nurse_report(
    patient_id: int,
    report: NurseReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_nurse)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    new_report = NurseReport(
        patient_id=patient_id,
        nurse_id=current_user.id,
        shift=report.shift,
        report_type=report.report_type,
        summary=report.summary,
        observations=report.observations,
        interventions=report.interventions,
        patient_response=report.patient_response,
        pain_scale=report.pain_scale,
        mobility=report.mobility
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    
    report_data = report.dict()
    report_data["patient_id"] = patient_id
    report_data["nurse_id"] = current_user.id
    add_block(db, "CREATE", "nurse_report", new_report.id, current_user.id, current_user.role, report_data, patient_id=patient.user_id)
    index_document(db, "nurse_report", f"Nurse Report [{report.shift}]: {report.summary}. Observations: {report.observations}", patient_id)
    
    return {"id": new_report.id, "message": "Report submitted"}


@router.get("/patient/{patient_id}/reports")
def get_nurse_reports(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_nurse)
):
    reports = db.query(NurseReport).filter(NurseReport.patient_id == patient_id).order_by(NurseReport.created_at.desc()).all()
    return [
        {
            "id": r.id, "shift": r.shift, "report_type": r.report_type,
            "summary": r.summary, "observations": r.observations,
            "interventions": r.interventions, "patient_response": r.patient_response,
            "pain_scale": r.pain_scale, "mobility": r.mobility,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "nurse_name": r.nurse.full_name if r.nurse else "Unknown"
        } for r in reports
    ]


# ── WebSocket ─────────────────────────────────────────────────

@router.websocket("/realtime/{patient_id}")
async def vitals_websocket(
    websocket: WebSocket,
    patient_id: int,
    token: Optional[str] = None
):
    # JWT auth via query param
    if token:
        try:
            payload = decode_token(token)
            if not payload.get("sub"):
                await websocket.close(code=4001)
                return
        except Exception:
            await websocket.close(code=4001)
            return
    
    await manager.connect(websocket, patient_id)
    
    try:
        await websocket.send_json({"event": "connected", "patient_id": patient_id, "message": "Real-time vitals stream active"})
        
        while True:
            # Keep connection alive; data will be pushed by POST /vitals
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"event": "pong"})
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, patient_id)


# ── Nurse stats ───────────────────────────────────────────────

@router.get("/stats")
def get_nurse_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_nurse)
):
    total_vitals = db.query(VitalSign).filter(VitalSign.recorded_by == current_user.id).count()
    total_reports = db.query(NurseReport).filter(NurseReport.nurse_id == current_user.id).count()
    total_patients = db.query(Patient).count()
    
    return {
        "nurse_name": current_user.full_name,
        "department": current_user.department,
        "total_vitals_logged": total_vitals,
        "total_reports_submitted": total_reports,
        "total_patients": total_patients,
        "active_connections": sum(len(v) for v in manager.active_connections.values())
    }
