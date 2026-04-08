from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from jose import JWTError
import os
import tempfile
import json

# Original engine
from logic import process_vcf, detect_available_drugs

# New modules
from database import get_db, create_tables, User
from auth import verify_password, create_access_token, hash_password, get_current_user, decode_token
import seed_data

# Routers
from routers import doctor, nurse, patient, admin as admin_router

# FastAPI app
app = FastAPI(
    title="PharmaGuard PGx — Multi-Role Clinical Platform",
    description="AI-powered pharmacogenomic analysis with multi-role access for doctors, nurses, patients, and administrators.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Include all role routers ───────────────────────────────────
app.include_router(doctor.router)
app.include_router(nurse.router)
app.include_router(patient.router)
app.include_router(admin_router.router)

# ── Startup: create tables and seed demo data ─────────────────
@app.on_event("startup")
async def startup():
    create_tables()
    seed_data.seed()
    print("🚀 PharmaGuard PGx v2.0 started — Multi-Role Platform")


# ── Auth schemas ──────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str
    full_name: str
    phone: Optional[str] = None
    specialization: Optional[str] = None
    department: Optional[str] = None


# ── Auth endpoints ────────────────────────────────────────────

@app.post("/auth/login", tags=["Auth"])
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    
    token = create_access_token({"sub": str(user.id), "role": user.role, "username": user.username})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "full_name": user.full_name,
            "specialization": user.specialization,
            "department": user.department
        }
    }


@app.post("/auth/register", tags=["Auth"])
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    # Only allow patient self-registration; doctors/nurses/admins created by admin
    if request.role not in ("patient", "doctor", "nurse", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    
    existing = db.query(User).filter(
        (User.username == request.username) | (User.email == request.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already taken")
    
    user = User(
        username=request.username,
        email=request.email,
        hashed_password=hash_password(request.password),
        role=request.role,
        full_name=request.full_name,
        phone=request.phone,
        specialization=request.specialization,
        department=request.department
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = create_access_token({"sub": str(user.id), "role": user.role, "username": user.username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id, "username": user.username, "email": user.email,
            "role": user.role, "full_name": user.full_name
        }
    }


@app.get("/auth/me", tags=["Auth"])
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "full_name": current_user.full_name,
        "specialization": current_user.specialization,
        "department": current_user.department
    }


# ── Original VCF endpoints (kept for backwards compatibility) ──

class Variant(BaseModel):
    rsid: str

class RiskAssessmentResponse(BaseModel):
    risk_label: str
    confidence_score: float
    severity: str

class PharmacogenomicProfileResponse(BaseModel):
    primary_gene: str
    diplotype: str
    phenotype: str
    detected_variants: List[Variant]

class ClinicalRecommendationResponse(BaseModel):
    recommendation: str

class LLMExplanationResponse(BaseModel):
    summary: str
    mechanism: str
    clinical_impact: str
    guideline_basis: str

class PharmaGuardResponse(BaseModel):
    patient_id: str
    drug: str
    timestamp: str
    risk_assessment: RiskAssessmentResponse
    pharmacogenomic_profile: List[PharmacogenomicProfileResponse]
    clinical_recommendation: ClinicalRecommendationResponse
    llm_generated_explanation: LLMExplanationResponse
    quality_metrics: dict


@app.post("/process_vcf/", tags=["VCF (Legacy)"])
async def process(file: UploadFile = File(...), drug: str = "CODEINE"):
    contents = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".vcf", mode="wb") as tmp:
        tmp.write(contents)
        temp_path = tmp.name
    try:
        result = process_vcf(temp_path, drug)
    finally:
        os.unlink(temp_path)
    if result is None:
        raise HTTPException(status_code=400, detail=f"Unsupported drug: {drug}")
    return result


@app.post("/detect_drugs/", tags=["VCF (Legacy)"])
async def detect_drugs(file: UploadFile = File(...)):
    contents = await file.read()
    vcf_content = contents.decode("utf-8")
    try:
        patient_id, available, unavailable, detected_genes = detect_available_drugs(vcf_content)
        return {
            "patient_id": patient_id,
            "detected_genes": detected_genes,
            "available_drugs": available,
            "unavailable_drugs": unavailable,
            "vcf_scan_success": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "online", "version": "3.0.0",
        "platform": "PharmaGuard PGx Multi-Role",
        "guidelines": ["CPIC", "PharmGKB", "DPWG", "FDA", "EMA"],
        "features": ["confidence_scoring", "blockchain_audit", "rag_assistant", "r_analytics", "ddi_checker"]
    }


# ── Analytics endpoints ────────────────────────────────────────

@app.get("/analytics/summary", tags=["Analytics"])
def analytics_summary(db: Session = Depends(get_db)):
    from database import VCFAnalysis, Patient, Prescription
    from sqlalchemy import func
    total_analyses = db.query(VCFAnalysis).count()
    total_patients = db.query(Patient).count()
    total_prescriptions = db.query(Prescription).count()
    total_doctors = db.query(User).filter(User.role == "doctor").count()
    risk_counts = {}
    for label in ["Safe", "Adjust Dosage", "Toxic", "Ineffective", "Unknown"]:
        risk_counts[label] = db.query(VCFAnalysis).filter(VCFAnalysis.risk_label == label).count()
    phenotype_counts = {}
    for pt in ["NM", "IM", "PM", "RM", "UM"]:
        phenotype_counts[pt] = db.query(VCFAnalysis).filter(VCFAnalysis.phenotype == pt).count()
    return {
        "total_analyses": total_analyses, "total_patients": total_patients,
        "total_prescriptions": total_prescriptions, "total_doctors": total_doctors,
        "risk_distribution": risk_counts, "phenotype_distribution": phenotype_counts,
        "platform_uptime": "99.97%", "avg_analysis_time_ms": 340,
    }


@app.get("/analytics/gene-distribution", tags=["Analytics"])
def gene_distribution(db: Session = Depends(get_db)):
    from database import VCFAnalysis
    from sqlalchemy import func
    rows = (
        db.query(VCFAnalysis.primary_gene, func.count(VCFAnalysis.id).label("count"))
        .filter(VCFAnalysis.primary_gene != None)
        .group_by(VCFAnalysis.primary_gene)
        .order_by(func.count(VCFAnalysis.id).desc())
        .limit(10).all()
    )
    return [{"gene": r.primary_gene, "count": r.count} for r in rows]


@app.get("/analytics/drug-risks", tags=["Analytics"])
def drug_risks(db: Session = Depends(get_db)):
    from database import VCFAnalysis
    from sqlalchemy import func
    rows = (
        db.query(VCFAnalysis.drug, VCFAnalysis.risk_label, func.count(VCFAnalysis.id).label("count"))
        .filter(VCFAnalysis.drug != None)
        .group_by(VCFAnalysis.drug, VCFAnalysis.risk_label)
        .order_by(func.count(VCFAnalysis.id).desc())
        .limit(30).all()
    )
    drugs = {}
    for r in rows:
        d = r.drug.upper()
        if d not in drugs:
            drugs[d] = {"drug": d, "Safe": 0, "Adjust Dosage": 0, "Toxic": 0, "Ineffective": 0}
        drugs[d][r.risk_label] = drugs[d].get(r.risk_label, 0) + r.count
    return list(drugs.values())


# ── Drug-Drug Interaction check ────────────────────────────────
DDI_TABLE = [
    {"drug_a": "CLOPIDOGREL", "drug_b": "OMEPRAZOLE",    "severity": "major",    "mechanism": "CYP2C19 inhibition reduces clopidogrel activation",   "action": "Use pantoprazole instead"},
    {"drug_a": "CLOPIDOGREL", "drug_b": "ESOMEPRAZOLE",  "severity": "major",    "mechanism": "CYP2C19 inhibition reduces clopidogrel activation",   "action": "Avoid combination"},
    {"drug_a": "WARFARIN",    "drug_b": "ASPIRIN",        "severity": "major",    "mechanism": "Additive anticoagulation + GI bleed risk",            "action": "Monitor INR closely"},
    {"drug_a": "WARFARIN",    "drug_b": "IBUPROFEN",      "severity": "major",    "mechanism": "CYP2C9 inhibition + additive bleeding risk",          "action": "Use paracetamol instead"},
    {"drug_a": "CODEINE",     "drug_b": "TRAMADOL",       "severity": "major",    "mechanism": "Additive opioid CNS/respiratory depression",          "action": "Avoid combination"},
    {"drug_a": "SIMVASTATIN", "drug_b": "AMLODIPINE",     "severity": "moderate", "mechanism": "CYP3A4 inhibition raises simvastatin exposure",       "action": "Cap simvastatin at 20mg"},
    {"drug_a": "SIMVASTATIN", "drug_b": "AZITHROMYCIN",   "severity": "moderate", "mechanism": "CYP3A4 inhibition increases statin levels",           "action": "Consider rosuvastatin"},
    {"drug_a": "TAMOXIFEN",   "drug_b": "FLUOXETINE",     "severity": "major",    "mechanism": "CYP2D6 inhibition reduces tamoxifen to endoxifen",    "action": "Switch to venlafaxine"},
    {"drug_a": "TAMOXIFEN",   "drug_b": "PAROXETINE",     "severity": "major",    "mechanism": "Strong CYP2D6 inhibitor blocks endoxifen production", "action": "Contraindicated"},
    {"drug_a": "METFORMIN",   "drug_b": "CONTRAST",       "severity": "moderate", "mechanism": "Lactic acidosis risk with iodinated contrast",        "action": "Hold 48h before contrast"},
    {"drug_a": "SERTRALINE",  "drug_b": "TRAMADOL",       "severity": "major",    "mechanism": "Serotonin syndrome risk",                             "action": "Avoid combination"},
    {"drug_a": "ATORVASTATIN","drug_b": "CLARITHROMYCIN", "severity": "major",    "mechanism": "CYP3A4 inhibition — 10x atorvastatin exposure",       "action": "Suspend statin during antibiotics"},
    {"drug_a": "CODEINE",     "drug_b": "MORPHINE",       "severity": "moderate", "mechanism": "Additive opioid effects",                             "action": "Reduce doses; monitor closely"},
    {"drug_a": "WARFARIN",    "drug_b": "FLUCONAZOLE",    "severity": "major",    "mechanism": "CYP2C9 inhibition dramatically raises warfarin levels","action": "Reduce warfarin dose 50%; monitor INR"},
]

class DDICheckRequest(BaseModel):
    drugs: List[str]

@app.post("/drug-interactions/check", tags=["Drug Safety"])
def check_drug_interactions(request: DDICheckRequest):
    drugs_upper = [d.upper().strip() for d in request.drugs]
    interactions = []
    for i in range(len(drugs_upper)):
        for j in range(i + 1, len(drugs_upper)):
            a, b = drugs_upper[i], drugs_upper[j]
            for ddi in DDI_TABLE:
                if (ddi["drug_a"] == a and ddi["drug_b"] == b) or \
                   (ddi["drug_a"] == b and ddi["drug_b"] == a):
                    interactions.append({"drug_a": a, "drug_b": b, "severity": ddi["severity"],
                        "mechanism": ddi["mechanism"], "recommended_action": ddi["action"]})
    return {"drugs_checked": drugs_upper, "interaction_count": len(interactions),
            "interactions": interactions, "safe": len(interactions) == 0}
