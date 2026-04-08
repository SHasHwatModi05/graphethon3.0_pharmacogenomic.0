# database.py — SQLAlchemy ORM with SQLite
from sqlalchemy import create_engine, Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# Compatible declarative base for SQLAlchemy 1.4+ and 2.x
try:
    from sqlalchemy.orm import declarative_base
except ImportError:
    from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./pharmaguard.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# =====================
# USER MODEL
# =====================
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(200), unique=True, index=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(String(20), nullable=False)  # doctor, nurse, patient, admin
    full_name = Column(String(200))
    phone = Column(String(20))
    specialization = Column(String(100))  # for doctors
    department = Column(String(100))      # for nurses
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # Relationships
    patient_profile = relationship("Patient", foreign_keys="Patient.user_id", back_populates="user", uselist=False)
    prescriptions_written = relationship("Prescription", foreign_keys="Prescription.doctor_id", back_populates="doctor")
    nurse_reports = relationship("NurseReport", foreign_keys="NurseReport.nurse_id", back_populates="nurse")


# =====================
# PATIENT MODEL
# =====================
class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    patient_code = Column(String(50), unique=True, index=True)
    date_of_birth = Column(String(20))
    gender = Column(String(20))
    blood_type = Column(String(10))
    allergies = Column(Text)
    chronic_conditions = Column(Text)
    emergency_contact = Column(String(200))
    insurance_id = Column(String(100))
    assigned_doctor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="patient_profile")
    assigned_doctor = relationship("User", foreign_keys=[assigned_doctor_id])
    medical_records = relationship("MedicalRecord", back_populates="patient")
    prescriptions = relationship("Prescription", back_populates="patient")
    vcf_analyses = relationship("VCFAnalysis", back_populates="patient")
    vitals = relationship("VitalSign", back_populates="patient")
    nurse_reports = relationship("NurseReport", back_populates="patient")


# =====================
# MEDICAL RECORD MODEL
# =====================
class MedicalRecord(Base):
    __tablename__ = "medical_records"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    doctor_id = Column(Integer, ForeignKey("users.id"))
    record_type = Column(String(100))  # diagnosis, lab, imaging, etc.
    title = Column(String(300))
    description = Column(Text)
    diagnosis = Column(Text)
    icd_code = Column(String(20))
    severity = Column(String(50))
    notes = Column(Text)
    attachments = Column(JSON, default=list)
    blockchain_hash = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", back_populates="medical_records")
    doctor = relationship("User", foreign_keys=[doctor_id])


# =====================
# PRESCRIPTION MODEL
# =====================
class Prescription(Base):
    __tablename__ = "prescriptions"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    doctor_id = Column(Integer, ForeignKey("users.id"))
    drug_name = Column(String(200), nullable=False)
    dosage = Column(String(100))
    frequency = Column(String(100))
    duration = Column(String(100))
    instructions = Column(Text)
    pgx_risk_label = Column(String(50))   # from VCF analysis
    pgx_severity = Column(String(50))     # from VCF analysis
    status = Column(String(30), default="active")  # active, completed, cancelled
    blockchain_hash = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="prescriptions")
    doctor = relationship("User", foreign_keys=[doctor_id], back_populates="prescriptions_written")


# =====================
# VCF ANALYSIS MODEL
# =====================
class VCFAnalysis(Base):
    __tablename__ = "vcf_analyses"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    patient_vcf_id = Column(String(100))  # extracted from VCF #CHROM line
    drug = Column(String(100))
    risk_label = Column(String(100))
    severity = Column(String(50))
    phenotype = Column(String(20))
    diplotype = Column(String(50))
    primary_gene = Column(String(50))
    recommendation = Column(Text)
    full_result = Column(JSON)
    blockchain_hash = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="vcf_analyses")
    uploader = relationship("User", foreign_keys=[uploaded_by])


# =====================
# VITAL SIGNS MODEL
# =====================
class VitalSign(Base):
    __tablename__ = "vital_signs"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    recorded_by = Column(Integer, ForeignKey("users.id"))  # nurse
    heart_rate = Column(Float)
    systolic_bp = Column(Float)
    diastolic_bp = Column(Float)
    temperature = Column(Float)
    oxygen_saturation = Column(Float)
    respiratory_rate = Column(Float)
    weight = Column(Float)
    height = Column(Float)
    notes = Column(Text)
    recorded_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="vitals")
    nurse = relationship("User", foreign_keys=[recorded_by])


# =====================
# NURSE REPORT MODEL
# =====================
class NurseReport(Base):
    __tablename__ = "nurse_reports"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    nurse_id = Column(Integer, ForeignKey("users.id"))
    shift = Column(String(50))  # morning, afternoon, night
    report_type = Column(String(100))
    summary = Column(Text)
    observations = Column(Text)
    interventions = Column(Text)
    patient_response = Column(Text)
    pain_scale = Column(Integer)
    mobility = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="nurse_reports")
    nurse = relationship("User", foreign_keys=[nurse_id], back_populates="nurse_reports")


# =====================
# BLOCKCHAIN AUDIT LOG
# =====================
class BlockchainLog(Base):
    __tablename__ = "blockchain_log"
    id = Column(Integer, primary_key=True, index=True)
    block_index = Column(Integer, unique=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    action = Column(String(100))           # CREATE, UPDATE, DELETE, VIEW
    document_type = Column(String(100))    # prescription, record, vcf_analysis
    document_id = Column(Integer)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_id = Column(Integer, ForeignKey("users.id"))
    actor_role = Column(String(50))
    data_hash = Column(String(64))         # SHA-256 of document content
    previous_hash = Column(String(64))     # previous block hash
    block_hash = Column(String(64))        # SHA-256 of this block
    is_valid = Column(Boolean, default=True)


# =====================
# RAG DOCUMENTS
# =====================
class RAGDocument(Base):
    __tablename__ = "rag_documents"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    doc_type = Column(String(100))
    content = Column(Text)
    doc_metadata = Column(JSON, default=dict)
    embedding_vector = Column(Text)  # JSON-serialized float list
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
