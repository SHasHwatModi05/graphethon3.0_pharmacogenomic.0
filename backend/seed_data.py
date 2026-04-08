"""Simple seeder without emoji for Windows console compatibility"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from database import SessionLocal, create_tables, User, Patient, MedicalRecord, Prescription, VCFAnalysis, VitalSign, NurseReport
from auth import hash_password
from blockchain import add_block, compute_hash
from rag_engine import index_document
from datetime import datetime, timedelta
import random

DEMO_USERS = [
    {"username": "dr_smith", "email": "dr.smith@pharmaguard.io", "password": "doctor123", "role": "doctor", "full_name": "Dr. Sarah Smith", "specialization": "Pharmacogenomics", "phone": "+1-555-0101"},
    {"username": "dr_patel", "email": "dr.patel@pharmaguard.io", "password": "doctor123", "role": "doctor", "full_name": "Dr. Raj Patel", "specialization": "Clinical Genetics", "phone": "+1-555-0102"},
    {"username": "nurse_jones", "email": "nurse.jones@pharmaguard.io", "password": "nurse123", "role": "nurse", "full_name": "Emily Jones RN", "department": "ICU", "phone": "+1-555-0201"},
    {"username": "nurse_kim", "email": "nurse.kim@pharmaguard.io", "password": "nurse123", "role": "nurse", "full_name": "Min-Ji Kim RN", "department": "Cardiology", "phone": "+1-555-0202"},
    {"username": "patient_alice", "email": "alice.johnson@email.com", "password": "patient123", "role": "patient", "full_name": "Alice Johnson", "phone": "+1-555-0301"},
    {"username": "patient_bob", "email": "bob.wilson@email.com", "password": "patient123", "role": "patient", "full_name": "Bob Wilson", "phone": "+1-555-0302"},
    {"username": "patient_carol", "email": "carol.davis@email.com", "password": "patient123", "role": "patient", "full_name": "Carol Davis", "phone": "+1-555-0303"},
    {"username": "admin", "email": "admin@pharmaguard.io", "password": "admin123", "role": "admin", "full_name": "System Administrator", "phone": "+1-555-0001"},
]

def seed():
    create_tables()
    db = SessionLocal()
    
    if db.query(User).count() > 0:
        print("Database already seeded. Skipping.")
        db.close()
        return
    
    print("Seeding database...")
    
    created_users = {}
    for u in DEMO_USERS:
        user = User(
            username=u["username"], email=u["email"],
            hashed_password=hash_password(u["password"]),
            role=u["role"], full_name=u["full_name"],
            phone=u.get("phone"), specialization=u.get("specialization"), department=u.get("department")
        )
        db.add(user); db.flush()
        created_users[u["username"]] = user.id
    db.commit()
    print("  Created {} users".format(len(DEMO_USERS)))
    
    patient_usernames = ["patient_alice", "patient_bob", "patient_carol"]
    doctor_id = created_users["dr_smith"]
    nurse_id = created_users["nurse_jones"]
    PROFILES = [
        {"dob": "1985-03-15", "gender": "Female", "blood_type": "A+", "allergies": "Penicillin, Sulfa", "conditions": "Hypertension, Type 2 Diabetes"},
        {"dob": "1978-07-22", "gender": "Male", "blood_type": "O-", "allergies": "None known", "conditions": "Atrial Fibrillation"},
        {"dob": "1992-11-08", "gender": "Female", "blood_type": "B+", "allergies": "Aspirin", "conditions": "Breast Cancer (remission)"},
    ]
    
    created_patients = []
    for i, (uname, profile) in enumerate(zip(patient_usernames, PROFILES)):
        p = Patient(
            user_id=created_users[uname], patient_code="PT{:05d}".format(10001 + i),
            date_of_birth=profile["dob"], gender=profile["gender"], blood_type=profile["blood_type"],
            allergies=profile["allergies"], chronic_conditions=profile["conditions"],
            emergency_contact="Emergency +1-555-090{}".format(i), insurance_id="INS-2024-{:04d}".format(1000 + i),
            assigned_doctor_id=doctor_id
        )
        db.add(p); db.flush(); created_patients.append(p.id)
        index_document(db, "patient_profile", "{}: DOB {}, Blood {}, Allergies: {}, Conditions: {}".format(
            DEMO_USERS[4+i]["full_name"], profile["dob"], profile["blood_type"], profile["allergies"], profile["conditions"]
        ), p.id, {"name": DEMO_USERS[4+i]["full_name"]})
    db.commit()
    print("  Created {} patient profiles".format(len(created_patients)))
    
    RECORDS = [
        {"type": "diagnosis", "title": "Hypertension Follow-up", "desc": "BP control good. Continue regimen.", "diag": "Essential hypertension", "icd": "I10", "sev": "moderate"},
        {"type": "lab", "title": "HbA1c Test Results", "desc": "HbA1c at 7.2% - adequate control.", "diag": "Diabetes monitoring", "icd": "Z79.4", "sev": "low"},
        {"type": "cardiology", "title": "ECG Report", "desc": "Irregular rhythm. Warfarin recommended.", "diag": "Atrial fibrillation", "icd": "I48", "sev": "high"},
        {"type": "oncology", "title": "Chemo Response", "desc": "Responding well to FLUOROURACIL.", "diag": "Breast carcinoma followup", "icd": "C50", "sev": "critical"},
    ]
    for i, pid in enumerate(created_patients):
        for j in range(2):
            rd = RECORDS[(i * 2 + j) % len(RECORDS)]
            rh = {"patient_id": pid, "title": rd["title"], "doctor_id": doctor_id}
            rec = MedicalRecord(patient_id=pid, doctor_id=doctor_id, record_type=rd["type"],
                title=rd["title"], description=rd["desc"], diagnosis=rd["diag"], icd_code=rd["icd"],
                severity=rd["sev"], blockchain_hash=compute_hash(rh),
                created_at=datetime.utcnow() - timedelta(days=random.randint(5, 90)))
            db.add(rec); db.flush()
            add_block(db, "CREATE", "medical_record", rec.id, doctor_id, "doctor", rh, patient_id=created_users[patient_usernames[i]])
            index_document(db, "medical_record", "{}: {} Diagnosis: {}".format(rd["title"], rd["desc"], rd["diag"]), pid)
    db.commit()
    print("  Created medical records")
    
    VCF = [
        {"drug": "WARFARIN", "risk": "Adjust Dosage", "sev": "high", "pheno": "IM", "diplo": "*1/*2", "gene": "CYP2C9", "rec": "Reduce warfarin dose by 30%. Monitor INR closely."},
        {"drug": "CLOPIDOGREL", "risk": "Ineffective", "sev": "high", "pheno": "PM", "diplo": "*2/*2", "gene": "CYP2C19", "rec": "Use alternative antiplatelet therapy."},
        {"drug": "FLUOROURACIL", "risk": "Toxic", "sev": "critical", "pheno": "PM", "diplo": "*2A/*2A", "gene": "DPYD", "rec": "Avoid fluorouracil. High toxicity risk."},
        {"drug": "CODEINE", "risk": "Safe", "sev": "none", "pheno": "NM", "diplo": "*1/*1", "gene": "CYP2D6", "rec": "Standard dosing. Normal metabolism."},
    ]
    for i, pid in enumerate(created_patients):
        for j in range(2):
            vd = VCF[(i + j) % len(VCF)]
            vh = {"patient_id": pid, "drug": vd["drug"], "risk": vd["risk"]}
            ana = VCFAnalysis(patient_id=pid, uploaded_by=doctor_id, patient_vcf_id="PT{:05d}".format(10001+i),
                drug=vd["drug"], risk_label=vd["risk"], severity=vd["sev"], phenotype=vd["pheno"],
                diplotype=vd["diplo"], primary_gene=vd["gene"], recommendation=vd["rec"], full_result=vd,
                blockchain_hash=compute_hash(vh), created_at=datetime.utcnow() - timedelta(days=random.randint(1, 60)))
            db.add(ana); db.flush()
            add_block(db, "CREATE", "vcf_analysis", ana.id, doctor_id, "doctor", vh, patient_id=created_users[patient_usernames[i]])
    db.commit()
    print("  Created VCF analyses")
    
    RX = [
        {"drug": "Metformin", "dosage": "500mg", "freq": "Twice daily", "dur": "Ongoing", "inst": "Take with meals. Monitor glucose.", "risk": "Safe", "sev": "none"},
        {"drug": "Amlodipine", "dosage": "5mg", "freq": "Once daily", "dur": "Ongoing", "inst": "Take morning. Monitor BP.", "risk": "Safe", "sev": "none"},
        {"drug": "Warfarin", "dosage": "2.5mg", "freq": "Once daily", "dur": "Ongoing", "inst": "CYP2C9 IM phenotype. INR target 2-3.", "risk": "Adjust Dosage", "sev": "high"},
        {"drug": "Fluorouracil", "dosage": "400mg/m2", "freq": "Every 28 days", "dur": "6 cycles", "inst": "DPYD PM - avoid if possible.", "risk": "Toxic", "sev": "critical"},
    ]
    for i, pid in enumerate(created_patients):
        for j in range(2):
            rd = RX[(i + j) % len(RX)]
            rh = {"patient_id": pid, "drug": rd["drug"], "doctor_id": doctor_id}
            rx = Prescription(patient_id=pid, doctor_id=doctor_id, drug_name=rd["drug"], dosage=rd["dosage"],
                frequency=rd["freq"], duration=rd["dur"], instructions=rd["inst"],
                pgx_risk_label=rd["risk"], pgx_severity=rd["sev"], status="active",
                blockchain_hash=compute_hash(rh), created_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)))
            db.add(rx); db.flush()
            add_block(db, "CREATE", "prescription", rx.id, doctor_id, "doctor", rh, patient_id=created_users[patient_usernames[i]])
    db.commit()
    print("  Created prescriptions")
    
    for pid in created_patients:
        base_hr = random.uniform(68, 85)
        for i in range(15):
            v = VitalSign(patient_id=pid, recorded_by=nurse_id,
                heart_rate=round(base_hr + random.gauss(0, 4), 1),
                systolic_bp=round(random.uniform(118, 135) + random.gauss(0, 6), 1),
                diastolic_bp=round(random.uniform(75, 90) + random.gauss(0, 4), 1),
                temperature=round(random.uniform(36.4, 37.2), 1),
                oxygen_saturation=round(random.uniform(96, 99), 1),
                respiratory_rate=round(random.uniform(14, 18), 0),
                weight=round(random.uniform(65, 80), 1),
                notes="Routine check" if i % 3 != 0 else "Mild discomfort reported",
                recorded_at=datetime.utcnow() - timedelta(hours=i * 6))
            db.add(v)
    db.commit()
    print("  Created vitals")
    
    for i, pid in enumerate(created_patients):
        for shift, notes in [("Morning", "Patient stable. Vitals normal."), ("Night", "Mild discomfort at 02:00. Vitals noted.")]:
            r = NurseReport(patient_id=pid, nurse_id=nurse_id, shift=shift, report_type="Routine", summary=notes,
                observations="Alert and oriented.", interventions="Position change. Protocol applied.", patient_response="Cooperative.", pain_scale=random.randint(0, 3), mobility="Ambulatory with assistance")
            db.add(r)
    db.commit()
    print("  Created nurse reports")
    
    db.close()
    print("Database seeded successfully!")
    print("Demo credentials:")
    print("  Doctor:  dr_smith / doctor123")
    print("  Nurse:   nurse_jones / nurse123")
    print("  Patient: patient_alice / patient123")
    print("  Admin:   admin / admin123")

if __name__ == "__main__":
    seed()
