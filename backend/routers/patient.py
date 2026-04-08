# routers/patient.py — Patient self-service APIs
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db, Patient, MedicalRecord, Prescription, VCFAnalysis, VitalSign, NurseReport, User
from auth import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/patient", tags=["Patient"])


def get_patient_user(current_user: User = Depends(get_current_user)):
    """Allow patients (and admins for testing) to access patient endpoints"""
    if current_user.role not in ("patient", "admin"):
        raise HTTPException(status_code=403, detail="Patient access required")
    return current_user


# ── Patient profile ───────────────────────────────────────────

@router.get("/me/profile")
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_patient_user)
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return {
            "id": None,
            "full_name": current_user.full_name,
            "email": current_user.email,
            "message": "No patient profile linked yet. Contact your doctor."
        }
    
    return {
        "id": patient.id,
        "patient_code": patient.patient_code,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone": current_user.phone,
        "date_of_birth": patient.date_of_birth,
        "gender": patient.gender,
        "blood_type": patient.blood_type,
        "allergies": patient.allergies,
        "chronic_conditions": patient.chronic_conditions,
        "emergency_contact": patient.emergency_contact,
        "insurance_id": patient.insurance_id,
        "assigned_doctor": patient.assigned_doctor.full_name if patient.assigned_doctor else None
    }


# ── My records ────────────────────────────────────────────────

@router.get("/me/records")
def get_my_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_patient_user)
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return {"records": [], "message": "No patient profile found"}
    
    records = db.query(MedicalRecord).filter(MedicalRecord.patient_id == patient.id).order_by(MedicalRecord.created_at.desc()).all()
    return {
        "total": len(records),
        "records": [
            {
                "id": r.id, "record_type": r.record_type, "title": r.title,
                "description": r.description, "diagnosis": r.diagnosis,
                "icd_code": r.icd_code, "severity": r.severity, "notes": r.notes,
                "blockchain_hash": r.blockchain_hash,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "doctor_name": r.doctor.full_name if r.doctor else "Unknown"
            } for r in records
        ]
    }


# ── My prescriptions ──────────────────────────────────────────

@router.get("/me/prescriptions")
def get_my_prescriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_patient_user)
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return {"prescriptions": []}
    
    prescriptions = db.query(Prescription).filter(Prescription.patient_id == patient.id).order_by(Prescription.created_at.desc()).all()
    return {
        "total": len(prescriptions),
        "prescriptions": [
            {
                "id": p.id, "drug_name": p.drug_name, "dosage": p.dosage,
                "frequency": p.frequency, "duration": p.duration,
                "instructions": p.instructions, "status": p.status,
                "pgx_risk_label": p.pgx_risk_label, "pgx_severity": p.pgx_severity,
                "blockchain_hash": p.blockchain_hash,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "doctor_name": p.doctor.full_name if p.doctor else "Unknown"
            } for p in prescriptions
        ]
    }


# ── My VCF analyses ───────────────────────────────────────────

@router.get("/me/vcf-analyses")
def get_my_vcf_analyses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_patient_user)
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return {"analyses": []}
    
    analyses = db.query(VCFAnalysis).filter(VCFAnalysis.patient_id == patient.id).order_by(VCFAnalysis.created_at.desc()).all()
    return {
        "total": len(analyses),
        "analyses": [
            {
                "id": a.id, "drug": a.drug, "risk_label": a.risk_label,
                "severity": a.severity, "phenotype": a.phenotype,
                "diplotype": a.diplotype, "primary_gene": a.primary_gene,
                "recommendation": a.recommendation, "blockchain_hash": a.blockchain_hash,
                "created_at": a.created_at.isoformat() if a.created_at else None
            } for a in analyses
        ]
    }


# ── My vitals history ─────────────────────────────────────────

@router.get("/me/vitals")
def get_my_vitals(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_patient_user)
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return {"vitals": []}
    
    vitals = db.query(VitalSign).filter(VitalSign.patient_id == patient.id).order_by(VitalSign.recorded_at.desc()).limit(limit).all()
    return {
        "total": len(vitals),
        "vitals": [
            {
                "id": v.id, "heart_rate": v.heart_rate,
                "systolic_bp": v.systolic_bp, "diastolic_bp": v.diastolic_bp,
                "temperature": v.temperature, "oxygen_saturation": v.oxygen_saturation,
                "respiratory_rate": v.respiratory_rate, "weight": v.weight,
                "notes": v.notes,
                "recorded_at": v.recorded_at.isoformat() if v.recorded_at else None
            } for v in vitals
        ]
    }


# ── My timeline ───────────────────────────────────────────────

@router.get("/me/timeline")
def get_my_timeline(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_patient_user)
):
    """Merged chronological timeline of all patient events"""
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        return {"timeline": []}
    
    events = []
    
    records = db.query(MedicalRecord).filter(MedicalRecord.patient_id == patient.id).all()
    for r in records:
        events.append({
            "type": "medical_record", "icon": "📋",
            "title": r.title, "subtitle": r.record_type,
            "description": r.diagnosis or r.description,
            "severity": r.severity, "blockchain_hash": r.blockchain_hash,
            "date": r.created_at.isoformat() if r.created_at else None
        })
    
    prescriptions = db.query(Prescription).filter(Prescription.patient_id == patient.id).all()
    for p in prescriptions:
        events.append({
            "type": "prescription", "icon": "💊",
            "title": f"Prescribed: {p.drug_name}", "subtitle": f"{p.dosage} — {p.frequency}",
            "description": p.instructions, "severity": p.pgx_severity,
            "blockchain_hash": p.blockchain_hash,
            "date": p.created_at.isoformat() if p.created_at else None
        })
    
    analyses = db.query(VCFAnalysis).filter(VCFAnalysis.patient_id == patient.id).all()
    for a in analyses:
        events.append({
            "type": "vcf_analysis", "icon": "🧬",
            "title": f"Genomic Analysis: {a.drug}", "subtitle": f"Risk: {a.risk_label}",
            "description": a.recommendation, "severity": a.severity,
            "blockchain_hash": a.blockchain_hash,
            "date": a.created_at.isoformat() if a.created_at else None
        })
    
    # Sort chronologically, newest first
    events.sort(key=lambda x: x["date"] or "", reverse=True)
    
    return {"total": len(events), "timeline": events}
