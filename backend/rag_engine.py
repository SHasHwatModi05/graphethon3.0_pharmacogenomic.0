# rag_engine.py — Local TF-IDF Semantic RAG without external APIs
import json
import math
import re
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from database import RAGDocument, Patient, MedicalRecord, Prescription, VCFAnalysis, NurseReport, VitalSign


def tokenize(text: str) -> List[str]:
    """Simple tokenizer: lowercase, remove punctuation, split"""
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return [w for w in text.split() if len(w) > 2]


def compute_tfidf(query_tokens: List[str], doc_tokens: List[str], corpus: List[List[str]]) -> float:
    """Compute TF-IDF similarity between query and document"""
    if not doc_tokens or not query_tokens:
        return 0.0
    
    score = 0.0
    N = len(corpus)
    
    for term in query_tokens:
        # TF: term frequency in document
        tf = doc_tokens.count(term) / len(doc_tokens)
        
        # IDF: inverse document frequency
        docs_with_term = sum(1 for doc in corpus if term in doc)
        idf = math.log((N + 1) / (docs_with_term + 1)) + 1
        
        score += tf * idf
    
    return score


def build_patient_context(db: Session, patient_id: int) -> str:
    """Build comprehensive text context for a patient"""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        return ""
    
    context_parts = []
    
    # Patient basics
    if patient.user:
        context_parts.append(f"Patient: {patient.user.full_name}, Code: {patient.patient_code}")
        if patient.date_of_birth:
            context_parts.append(f"DOB: {patient.date_of_birth}, Gender: {patient.gender}")
        if patient.blood_type:
            context_parts.append(f"Blood Type: {patient.blood_type}")
        if patient.allergies:
            context_parts.append(f"Allergies: {patient.allergies}")
        if patient.chronic_conditions:
            context_parts.append(f"Chronic Conditions: {patient.chronic_conditions}")
    
    # Medical records
    records = db.query(MedicalRecord).filter(MedicalRecord.patient_id == patient_id).all()
    for r in records[-5:]:  # last 5 records
        context_parts.append(f"Record [{r.record_type}]: {r.title} - {r.diagnosis or r.description}")
    
    # Prescriptions
    prescriptions = db.query(Prescription).filter(Prescription.patient_id == patient_id).all()
    for p in prescriptions[-5:]:
        context_parts.append(f"Prescription: {p.drug_name} {p.dosage} {p.frequency} - Risk: {p.pgx_risk_label or 'N/A'}")
    
    # VCF Analyses
    analyses = db.query(VCFAnalysis).filter(VCFAnalysis.patient_id == patient_id).all()
    for a in analyses[-3:]:
        context_parts.append(f"Genomic Analysis: {a.drug} - {a.risk_label} (Severity: {a.severity}) - Gene: {a.primary_gene} {a.diplotype}")
    
    # Recent vitals
    vitals = db.query(VitalSign).filter(VitalSign.patient_id == patient_id).order_by(VitalSign.recorded_at.desc()).first()
    if vitals:
        context_parts.append(
            f"Latest Vitals: HR={vitals.heart_rate}, BP={vitals.systolic_bp}/{vitals.diastolic_bp}, "
            f"Temp={vitals.temperature}, SpO2={vitals.oxygen_saturation}%"
        )
    
    return "\n".join(context_parts)


def semantic_search(
    db: Session,
    query: str,
    patient_id: Optional[int] = None,
    top_k: int = 5
) -> List[Dict]:
    """TF-IDF-based semantic search over RAG document store"""
    query_tokens = tokenize(query)
    
    # Load all relevant documents
    doc_query = db.query(RAGDocument)
    if patient_id:
        doc_query = doc_query.filter(
            (RAGDocument.patient_id == patient_id) | (RAGDocument.patient_id == None)
        )
    
    documents = doc_query.all()
    
    if not documents:
        return []
    
    corpus = [tokenize(doc.content) for doc in documents]
    
    scored = []
    for i, doc in enumerate(documents):
        score = compute_tfidf(query_tokens, corpus[i], corpus)
        scored.append((score, doc))
    
    scored.sort(key=lambda x: x[0], reverse=True)
    top_docs = scored[:top_k]
    
    return [
        {
            "score": round(score, 4),
            "doc_type": doc.doc_type,
            "content": doc.content[:500],
            "metadata": doc.doc_metadata,
            "patient_id": doc.patient_id
        }
        for score, doc in top_docs if score > 0
    ]


def generate_rag_answer(
    db: Session,
    query: str,
    patient_id: Optional[int] = None
) -> Dict:
    """Generate RAG-based answer using local retrieval"""
    # Get patient context
    patient_context = ""
    if patient_id:
        patient_context = build_patient_context(db, patient_id)
    
    # Semantic search
    retrieved_docs = semantic_search(db, query, patient_id, top_k=5)
    
    # Build context
    retrieved_context = "\n\n".join([
        f"[{d['doc_type'].upper()}]: {d['content']}"
        for d in retrieved_docs
    ])
    
    # Rule-based answer generation
    answer = generate_rule_based_answer(query, patient_context, retrieved_context)
    
    return {
        "query": query,
        "answer": answer,
        "sources": retrieved_docs,
        "patient_context_used": bool(patient_context),
        "method": "local_rag"
    }


def generate_rule_based_answer(query: str, patient_context: str, retrieved_context: str) -> str:
    """Generate answer based on retrieved content and query keywords"""
    q_lower = query.lower()
    
    all_context = f"{patient_context}\n{retrieved_context}".strip()
    
    if not all_context:
        return "I don't have enough information to answer this question. Please ensure the patient has medical records in the system."
    
    # Answer templates based on query keywords
    if any(w in q_lower for w in ['risk', 'drug', 'medication', 'genome', 'vcf', 'gene', 'pharmaco']):
        relevant_lines = [l for l in all_context.split('\n') if any(
            w in l.lower() for w in ['prescription', 'drug', 'risk', 'genomic', 'analysis', 'gene', 'severity']
        )]
        if relevant_lines:
            return f"Based on the pharmacogenomic data:\n\n" + "\n".join(relevant_lines[:5])
    
    if any(w in q_lower for w in ['vital', 'heart', 'blood pressure', 'temperature', 'oxygen', 'bp', 'hr']):
        relevant_lines = [l for l in all_context.split('\n') if any(
            w in l.lower() for w in ['vital', 'hr=', 'bp=', 'temp=', 'spo2']
        )]
        if relevant_lines:
            return f"Patient vitals information:\n\n" + "\n".join(relevant_lines[:5])
    
    if any(w in q_lower for w in ['allerg', 'condition', 'chronic', 'diagnosis']):
        relevant_lines = [l for l in all_context.split('\n') if any(
            w in l.lower() for w in ['allerg', 'chronic', 'condition', 'diagnosis', 'record']
        )]
        if relevant_lines:
            return f"Medical background information:\n\n" + "\n".join(relevant_lines[:5])
    
    if any(w in q_lower for w in ['history', 'past', 'previous', 'record']):
        context_lines = [l for l in all_context.split('\n') if l.strip()]
        return "Patient history summary:\n\n" + "\n".join(context_lines[:8])
    
    # Generic fallback: return top context
    context_lines = [l for l in all_context.split('\n') if l.strip()]
    if context_lines:
        return "Based on available records:\n\n" + "\n".join(context_lines[:6])
    
    return "No specific information found for this query. Please refine your question or add more patient records."


def index_document(
    db: Session,
    doc_type: str,
    content: str,
    patient_id: Optional[int] = None,
    metadata: dict = None
) -> RAGDocument:
    """Index a document into the RAG store"""
    doc = RAGDocument(
        patient_id=patient_id,
        doc_type=doc_type,
        content=content,
        doc_metadata=metadata or {}
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc
