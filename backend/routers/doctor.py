# routers/doctor.py — Doctor panel APIs
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os
import tempfile

from database import get_db, Patient, MedicalRecord, Prescription, VCFAnalysis, User, VitalSign, NurseReport
from auth import get_doctor
from blockchain import add_block, compute_hash
from rag_engine import generate_rag_answer, index_document
from r_integration import generate_patient_dashboard
from logic import process_vcf, detect_available_drugs
from pydantic import BaseModel

router = APIRouter(prefix="/doctor", tags=["Doctor"])


# ── Pydantic schemas ──────────────────────────────────────────

class PrescriptionCreate(BaseModel):
    drug_name: str
    dosage: str
    frequency: str
    duration: str
    instructions: Optional[str] = ""
    pgx_risk_label: Optional[str] = None
    pgx_severity: Optional[str] = None

class RecordCreate(BaseModel):
    record_type: str
    title: str
    description: str
    diagnosis: Optional[str] = None
    icd_code: Optional[str] = None
    severity: Optional[str] = None
    notes: Optional[str] = None

class RAGQuery(BaseModel):
    question: str
    patient_id: Optional[int] = None


# ── Patient list ─────────────────────────────────────────────

@router.get("/patients")
def list_patients(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_doctor)
):
    query = db.query(Patient).join(User, Patient.user_id == User.id)
    if search:
        query = query.filter(
            User.full_name.ilike(f"%{search}%") |
            Patient.patient_code.ilike(f"%{search}%")
        )
    patients = query.all()
    
    result = []
    for p in patients:
        latest_vital = db.query(VitalSign).filter(VitalSign.patient_id == p.id).order_by(VitalSign.recorded_at.desc()).first()
        result.append({
            "id": p.id,
            "patient_code": p.patient_code,
            "full_name": p.user.full_name if p.user else "Unknown",
            "email": p.user.email if p.user else "",
            "date_of_birth": p.date_of_birth,
            "gender": p.gender,
            "blood_type": p.blood_type,
            "allergies": p.allergies,
            "chronic_conditions": p.chronic_conditions,
            "latest_vitals": {
                "heart_rate": latest_vital.heart_rate,
                "systolic_bp": latest_vital.systolic_bp,
                "diastolic_bp": latest_vital.diastolic_bp,
                "oxygen_saturation": latest_vital.oxygen_saturation,
                "temperature": latest_vital.temperature,
                "recorded_at": latest_vital.recorded_at.isoformat() if latest_vital.recorded_at else None
            } if latest_vital else None,
            "record_count": len(p.medical_records),
            "prescription_count": len(p.prescriptions),
            "vcf_analysis_count": len(p.vcf_analyses),
            "created_at": p.created_at.isoformat() if p.created_at else None
        })
    return result


# ── Patient history ───────────────────────────────────────────

@router.get("/patient/{patient_id}/history")
def get_patient_history(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_doctor)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    records = db.query(MedicalRecord).filter(MedicalRecord.patient_id == patient_id).order_by(MedicalRecord.created_at.desc()).all()
    prescriptions = db.query(Prescription).filter(Prescription.patient_id == patient_id).order_by(Prescription.created_at.desc()).all()
    vcf_analyses = db.query(VCFAnalysis).filter(VCFAnalysis.patient_id == patient_id).order_by(VCFAnalysis.created_at.desc()).all()
    vitals = db.query(VitalSign).filter(VitalSign.patient_id == patient_id).order_by(VitalSign.recorded_at.desc()).limit(30).all()
    nurse_rpts = db.query(NurseReport).filter(NurseReport.patient_id == patient_id).order_by(NurseReport.created_at.desc()).all()
    
    return {
        "patient": {
            "id": patient.id,
            "patient_code": patient.patient_code,
            "full_name": patient.user.full_name if patient.user else "",
            "date_of_birth": patient.date_of_birth,
            "gender": patient.gender,
            "blood_type": patient.blood_type,
            "allergies": patient.allergies,
            "chronic_conditions": patient.chronic_conditions,
            "emergency_contact": patient.emergency_contact,
            "insurance_id": patient.insurance_id
        },
        "medical_records": [
            {
                "id": r.id, "record_type": r.record_type, "title": r.title,
                "description": r.description, "diagnosis": r.diagnosis,
                "icd_code": r.icd_code, "severity": r.severity, "notes": r.notes,
                "blockchain_hash": r.blockchain_hash,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "doctor_name": r.doctor.full_name if r.doctor else "Unknown"
            } for r in records
        ],
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
        ],
        "vcf_analyses": [
            {
                "id": a.id, "drug": a.drug, "risk_label": a.risk_label,
                "severity": a.severity, "phenotype": a.phenotype,
                "diplotype": a.diplotype, "primary_gene": a.primary_gene,
                "recommendation": a.recommendation, "blockchain_hash": a.blockchain_hash,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "uploaded_by_name": a.uploader.full_name if a.uploader else "Unknown"
            } for a in vcf_analyses
        ],
        "vitals": [
            {
                "id": v.id, "heart_rate": v.heart_rate,
                "systolic_bp": v.systolic_bp, "diastolic_bp": v.diastolic_bp,
                "temperature": v.temperature, "oxygen_saturation": v.oxygen_saturation,
                "respiratory_rate": v.respiratory_rate, "weight": v.weight,
                "notes": v.notes,
                "recorded_at": v.recorded_at.isoformat() if v.recorded_at else None,
                "nurse_name": v.nurse.full_name if v.nurse else "Unknown"
            } for v in vitals
        ],
        "nurse_reports": [
            {
                "id": r.id, "shift": r.shift, "report_type": r.report_type,
                "summary": r.summary, "observations": r.observations,
                "pain_scale": r.pain_scale,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "nurse_name": r.nurse.full_name if r.nurse else "Unknown"
            } for r in nurse_rpts
        ]
    }


# ── Medical records ───────────────────────────────────────────

@router.post("/patient/{patient_id}/record")
def add_medical_record(
    patient_id: int,
    record: RecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_doctor)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Create record
    new_record = MedicalRecord(
        patient_id=patient_id,
        doctor_id=current_user.id,
        record_type=record.record_type,
        title=record.title,
        description=record.description,
        diagnosis=record.diagnosis,
        icd_code=record.icd_code,
        severity=record.severity,
        notes=record.notes
    )
    
    # Blockchain hash
    record_data = {"patient_id": patient_id, "title": record.title, "diagnosis": record.diagnosis, "doctor_id": current_user.id}
    new_record.blockchain_hash = compute_hash(record_data)
    
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    
    # Add to blockchain
    add_block(db, "CREATE", "medical_record", new_record.id, current_user.id, current_user.role, record_data, patient_id=patient.user_id)
    
    # Index for RAG
    index_document(db, "medical_record", f"{record.title}: {record.description} {record.diagnosis or ''}", patient_id, {"doctor": current_user.full_name, "type": record.record_type})
    
    return {"id": new_record.id, "message": "Record added successfully", "blockchain_hash": new_record.blockchain_hash}


# ── Prescriptions ─────────────────────────────────────────────

@router.post("/patient/{patient_id}/prescription")
def add_prescription(
    patient_id: int,
    prescription: PrescriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_doctor)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    new_rx = Prescription(
        patient_id=patient_id,
        doctor_id=current_user.id,
        drug_name=prescription.drug_name,
        dosage=prescription.dosage,
        frequency=prescription.frequency,
        duration=prescription.duration,
        instructions=prescription.instructions,
        pgx_risk_label=prescription.pgx_risk_label,
        pgx_severity=prescription.pgx_severity,
        status="active"
    )
    
    rx_data = {"patient_id": patient_id, "drug": prescription.drug_name, "dosage": prescription.dosage, "doctor_id": current_user.id}
    new_rx.blockchain_hash = compute_hash(rx_data)
    
    db.add(new_rx)
    db.commit()
    db.refresh(new_rx)
    
    add_block(db, "CREATE", "prescription", new_rx.id, current_user.id, current_user.role, rx_data, patient_id=patient.user_id)
    index_document(db, "prescription", f"Prescription: {prescription.drug_name} {prescription.dosage} {prescription.frequency} - {prescription.instructions}", patient_id)
    
    return {"id": new_rx.id, "message": "Prescription added", "blockchain_hash": new_rx.blockchain_hash}


@router.get("/patient/{patient_id}/prescriptions")
def get_patient_prescriptions(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_doctor)
):
    prescriptions = db.query(Prescription).filter(Prescription.patient_id == patient_id).order_by(Prescription.created_at.desc()).all()
    return [
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


# ── VCF Analysis (integrated) ─────────────────────────────────

@router.post("/patient/{patient_id}/vcf-analysis")
async def upload_vcf_for_patient(
    patient_id: int,
    file: UploadFile = File(...),
    drug: str = "CODEINE",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_doctor)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    contents = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".vcf", mode="wb") as tmp:
        tmp.write(contents)
        temp_path = tmp.name
    
    try:
        result = process_vcf(temp_path, drug)
        if result is None:
            raise HTTPException(status_code=400, detail=f"Unsupported drug: {drug}")
        
        result_dict = result.dict()
        
        risk = result.risk_assessment
        pgx = result.pharmacogenomic_profile[0] if result.pharmacogenomic_profile else None
        
        vcf_record = VCFAnalysis(
            patient_id=patient_id,
            uploaded_by=current_user.id,
            patient_vcf_id=result.patient_id,
            drug=drug.upper(),
            risk_label=risk.risk_label,
            severity=risk.severity,
            phenotype=pgx.phenotype if pgx else "Unknown",
            diplotype=pgx.diplotype if pgx else "Unknown",
            primary_gene=pgx.primary_gene if pgx else "Unknown",
            recommendation=result.clinical_recommendation.recommendation,
            full_result=result_dict
        )
        
        vcf_data = {"patient_id": patient_id, "drug": drug, "risk": risk.risk_label, "doctor_id": current_user.id}
        vcf_record.blockchain_hash = compute_hash(vcf_data)
        
        db.add(vcf_record)
        db.commit()
        db.refresh(vcf_record)
        
        add_block(db, "CREATE", "vcf_analysis", vcf_record.id, current_user.id, current_user.role, vcf_data, patient_id=patient.user_id)
        index_document(db, "vcf_analysis",
                       f"VCF Analysis for {drug}: Risk={risk.risk_label}, Severity={risk.severity}, Gene={pgx.primary_gene if pgx else 'N/A'}, Diplotype={pgx.diplotype if pgx else 'N/A'}",
                       patient_id, {"drug": drug, "risk": risk.risk_label})
        
        return {**result_dict, "vcf_record_id": vcf_record.id, "blockchain_hash": vcf_record.blockchain_hash}
    
    finally:
        os.unlink(temp_path)


# ── R Dashboard ───────────────────────────────────────────────

@router.get("/patient/{patient_id}/dashboard")
def get_patient_r_dashboard(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_doctor)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    vitals = db.query(VitalSign).filter(VitalSign.patient_id == patient_id).order_by(VitalSign.recorded_at.desc()).limit(20).all()
    vitals_data = [
        {
            "heart_rate": v.heart_rate, "systolic_bp": v.systolic_bp,
            "diastolic_bp": v.diastolic_bp, "temperature": v.temperature,
            "oxygen_saturation": v.oxygen_saturation,
            "recorded_at": v.recorded_at.isoformat() if v.recorded_at else None
        } for v in vitals
    ]
    
    analyses = db.query(VCFAnalysis).filter(VCFAnalysis.patient_id == patient_id).all()
    analyses_data = [
        {"drug": a.drug, "risk_label": a.risk_label, "severity": a.severity, "phenotype": a.phenotype}
        for a in analyses
    ]
    
    patient_data = {"id": patient_id, "name": patient.user.full_name if patient.user else "Unknown"}
    
    charts = generate_patient_dashboard(patient_data, vitals_data, analyses_data)
    
    return {
        "patient_id": patient_id,
        "charts": charts,
        "vitals_count": len(vitals_data),
        "analyses_count": len(analyses_data)
    }


# ── RAG Query ─────────────────────────────────────────────────

@router.post("/rag-query")
def doctor_rag_query(
    query: RAGQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_doctor)
):
    result = generate_rag_answer(db, query.question, query.patient_id)
    return result


# ── Stats ─────────────────────────────────────────────────────

@router.get("/stats")
def get_doctor_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_doctor)
):
    total_patients = db.query(Patient).count()
    total_prescriptions = db.query(Prescription).filter(Prescription.doctor_id == current_user.id).count()
    total_records = db.query(MedicalRecord).filter(MedicalRecord.doctor_id == current_user.id).count()
    total_analyses = db.query(VCFAnalysis).filter(VCFAnalysis.uploaded_by == current_user.id).count()
    
    risk_breakdown = db.query(VCFAnalysis.risk_label, VCFAnalysis.risk_label).filter(VCFAnalysis.uploaded_by == current_user.id).all()
    risk_counts = {}
    for r in risk_breakdown:
        risk_counts[r[0]] = risk_counts.get(r[0], 0) + 1
    
    return {
        "total_patients": total_patients,
        "prescriptions_written": total_prescriptions,
        "records_created": total_records,
        "vcf_analyses": total_analyses,
        "risk_breakdown": risk_counts,
        "doctor_name": current_user.full_name,
        "specialization": current_user.specialization
    }
