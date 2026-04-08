# routers/admin.py — DBA/Admin panel APIs
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from database import (
    get_db, User, Patient, MedicalRecord, Prescription,
    VCFAnalysis, VitalSign, NurseReport, BlockchainLog
)
from auth import get_admin, hash_password
from blockchain import verify_chain, get_audit_trail
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["Admin/DBA"])


# ── Pydantic schemas ──────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str
    full_name: str
    phone: Optional[str] = None
    specialization: Optional[str] = None
    department: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    specialization: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None

class PatientCreate(BaseModel):
    user_id: int
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    emergency_contact: Optional[str] = None
    insurance_id: Optional[str] = None
    assigned_doctor_id: Optional[int] = None


# ── System stats ──────────────────────────────────────────────

@router.get("/stats")
def admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin)
):
    users_by_role = {}
    for role in ["doctor", "nurse", "patient", "admin"]:
        users_by_role[role] = db.query(User).filter(User.role == role).count()
    
    total_records = db.query(MedicalRecord).count()
    total_prescriptions = db.query(Prescription).count()
    total_analyses = db.query(VCFAnalysis).count()
    total_vitals = db.query(VitalSign).count()
    total_blockchain_blocks = db.query(BlockchainLog).count()
    
    # Risk breakdown across all analyses
    analyses = db.query(VCFAnalysis).all()
    risk_counts = {}
    for a in analyses:
        risk_counts[a.risk_label] = risk_counts.get(a.risk_label, 0) + 1
    
    return {
        "users_by_role": users_by_role,
        "total_users": sum(users_by_role.values()),
        "total_patients": db.query(Patient).count(),
        "total_medical_records": total_records,
        "total_prescriptions": total_prescriptions,
        "total_vcf_analyses": total_analyses,
        "total_vitals_logged": total_vitals,
        "blockchain_blocks": total_blockchain_blocks,
        "risk_distribution": risk_counts
    }


# ── User management ───────────────────────────────────────────

@router.get("/users")
def list_all_users(
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin)
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    users = query.all()
    
    return [
        {
            "id": u.id, "username": u.username, "email": u.email,
            "role": u.role, "full_name": u.full_name, "phone": u.phone,
            "specialization": u.specialization, "department": u.department,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None
        } for u in users
    ]


@router.post("/users")
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin)
):
    # Check for duplicate
    existing = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    if user_data.role not in ("doctor", "nurse", "patient", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role=user_data.role,
        full_name=user_data.full_name,
        phone=user_data.phone,
        specialization=user_data.specialization,
        department=user_data.department
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"id": new_user.id, "message": f"User {user_data.username} created with role {user_data.role}"}


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_data.full_name is not None: user.full_name = user_data.full_name
    if user_data.email is not None: user.email = user_data.email
    if user_data.phone is not None: user.phone = user_data.phone
    if user_data.role is not None: user.role = user_data.role
    if user_data.specialization is not None: user.specialization = user_data.specialization
    if user_data.department is not None: user.department = user_data.department
    if user_data.is_active is not None: user.is_active = user_data.is_active
    
    db.commit()
    return {"message": "User updated"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = False  # Soft delete
    db.commit()
    return {"message": f"User {user.username} deactivated"}


# ── Patient administration ────────────────────────────────────

@router.get("/patients")
def admin_list_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin)
):
    patients = db.query(Patient).all()
    return [
        {
            "id": p.id,
            "patient_code": p.patient_code,
            "full_name": p.user.full_name if p.user else "Unknown",
            "email": p.user.email if p.user else "",
            "date_of_birth": p.date_of_birth,
            "gender": p.gender,
            "blood_type": p.blood_type,
            "chronic_conditions": p.chronic_conditions,
            "record_count": len(p.medical_records),
            "prescription_count": len(p.prescriptions),
            "vcf_analysis_count": len(p.vcf_analyses),
            "assigned_doctor": p.assigned_doctor.full_name if p.assigned_doctor else None
        } for p in patients
    ]


@router.post("/patients")
def admin_create_patient(
    patient_data: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin)
):
    user = db.query(User).filter(User.id == patient_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = db.query(Patient).filter(Patient.user_id == patient_data.user_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Patient profile already exists for this user")
    
    import random
    patient_code = f"PT{random.randint(10000, 99999)}"
    
    patient = Patient(
        user_id=patient_data.user_id,
        patient_code=patient_code,
        date_of_birth=patient_data.date_of_birth,
        gender=patient_data.gender,
        blood_type=patient_data.blood_type,
        allergies=patient_data.allergies,
        chronic_conditions=patient_data.chronic_conditions,
        emergency_contact=patient_data.emergency_contact,
        insurance_id=patient_data.insurance_id,
        assigned_doctor_id=patient_data.assigned_doctor_id
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return {"id": patient.id, "patient_code": patient.patient_code, "message": "Patient profile created"}


# ── Patient full history (admin view) ─────────────────────────

@router.get("/patients/{patient_id}/history")
def admin_patient_history(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin)
):
    from routers.doctor import get_patient_history
    return get_patient_history(patient_id, db, current_user)


# ── Blockchain audit ──────────────────────────────────────────

@router.get("/blockchain/audit")
def blockchain_audit_log(
    patient_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin)
):
    trail = get_audit_trail(db, patient_id)
    return {
        "total_blocks": len(trail),
        "filter_patient_id": patient_id,
        "audit_trail": trail
    }


@router.get("/blockchain/verify")
def verify_blockchain(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin)
):
    result = verify_chain(db)
    return {
        "verification_result": result,
        "verified_at": datetime.utcnow().isoformat()
    }


# ── All patient histories ─────────────────────────────────────

@router.get("/all-records")
def all_patient_records_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin)
):
    """Full overview of all patient records for DBA"""
    patients = db.query(Patient).all()
    summary = []
    
    for p in patients:
        latest_analysis = db.query(VCFAnalysis).filter(VCFAnalysis.patient_id == p.id).order_by(VCFAnalysis.created_at.desc()).first()
        latest_rx = db.query(Prescription).filter(Prescription.patient_id == p.id).order_by(Prescription.created_at.desc()).first()
        latest_vital = db.query(VitalSign).filter(VitalSign.patient_id == p.id).order_by(VitalSign.recorded_at.desc()).first()
        
        summary.append({
            "patient_id": p.id,
            "patient_code": p.patient_code,
            "full_name": p.user.full_name if p.user else "Unknown",
            "chronic_conditions": p.chronic_conditions,
            "latest_diagnosis": latest_analysis.risk_label if latest_analysis else None,
            "latest_drug": latest_analysis.drug if latest_analysis else None,
            "latest_prescription": latest_rx.drug_name if latest_rx else None,
            "latest_hr": latest_vital.heart_rate if latest_vital else None,
            "latest_bp": f"{latest_vital.systolic_bp}/{latest_vital.diastolic_bp}" if latest_vital else None,
            "total_records": len(p.medical_records),
            "total_prescriptions": len(p.prescriptions),
            "total_analyses": len(p.vcf_analyses)
        })
    
    return {"total_patients": len(summary), "records": summary}
