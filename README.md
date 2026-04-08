# 🧬 PharmaGuard — AI Pharmacogenomic Risk Predictor :

> **Personalized medicine powered by genomics + AI**


PharmaGuard is an AI-powered clinical decision support system that analyzes **patient genetic variants (VCF files)** to predict **drug response risks**, generate **CPIC-aligned dosing recommendations**, and provide **LLM-generated clinical explanations**.

Built for the **National Pharmacogenomics Hackathon**.

---

## 🚨 Problem Statement

Adverse Drug Reactions (ADRs) cause over **100,000 deaths annually** worldwide.

Many adverse outcomes occur because patients metabolize drugs differently due to **genetic variation**.

PharmaGuard solves this by transforming raw genomic data into **clinically actionable insights**.

---

## 🎯 Objectives

The system:

✅ Parses real **VCF genomic files**
✅ Detects pharmacogenomic variants
✅ Infers metabolizer phenotype
✅ Predicts drug-specific risks
✅ Generates AI clinical explanations
✅ Aligns recommendations with **CPIC guidelines**

---

## 🧠 Supported Pharmacogenes

| Gene    | Clinical Role             |
| ------- | ------------------------- |
| CYP2D6  | Opioid metabolism         |
| CYP2C19 | Antiplatelet activation   |
| CYP2C9  | Anticoagulant metabolism  |
| SLCO1B1 | Statin transport          |
| TPMT    | Thiopurine metabolism     |
| DPYD    | Fluoropyrimidine toxicity |

---

## 💊 Supported Drugs

* WARFARIN
* WARFARIN
* CLOPIDOGREL
* SIMVASTATIN
* AZATHIOPRINE
* FLUOROURACIL

---

## ⚙️ System Architecture

```
VCF Upload
     ↓
VCF Parser
     ↓
Variant Detection
     ↓
Diplotype Inference
     ↓
Phenotype Prediction
     ↓
LLM Clinical Explanation
     ↓
Interactive Clinical Dashboard
```

---

## 🏗️ Tech Stack

### Frontend

* Vite+React.js
* Tailwind CSS
* FontAwesome
* Fetch API

### Backend

* FastAPI
* Pydantic
* Python
* Serverless Deployment (Vercel)

### AI Layer

* Rule-based CPIC engine
* Training & Prediction through Machine Learning
### Deployment

* Frontend → **Vercel**
* Backend → **Vercel Serverless Functions**

---

## 📂 Project Structure

```
PharmaGuard/
│
├── backend/
│   └── app.py           # FastAPI application
│   └── logic.py         # Pharmacogenomic engine
│   └── requirements.txt # Required Librares
│     
├── frontend/
│   └──src/
│       ├── components/
│           └── DrugInput.js
│           └── RawDataInspector.js
│           └── ResultsDashboard.js
│           └── VCFUploader.js
│       └── services/
│           └── api.js         # Pharmacogenomic engine
│   └──public/
│       └── manifest.json
└── README.md
```

---

## 🧬 Input Requirements

### 1️⃣ VCF File Upload

* Format: VCF v4.2
* Contains INFO annotations:

  * `GENE`
  * `STAR`
  * `RS`
* Genotype-based filtering applied

### 2️⃣ Drug Name

Text input:

```
WARFARIN
```

---

## 🔬 Analysis Pipeline

### Variant Processing

* Reads authentic VCF structure
* Ignores reference genotype (`0/0`)
* Detects actionable variants (`0/1`, `1/1`)

### Diplotype Construction

Example:

```
CYP2D6*1/*2
```

### Phenotype Prediction

| Phenotype | Meaning          |
| --------- | ---------------- |
| PM        | Poor Metabolizer |
| IM        | Intermediate     |
| NM        | Normal           |
| RM        | Rapid            |
| URM       | Ultra-Rapid      |

---

## ⚠️ Risk Classification

| Risk          | Meaning                    |
| ------------- | -------------------------- |
| Safe          | Standard dosing            |
| Adjust Dosage | Dose modification required |
| Toxic         | High toxicity risk         |
| Ineffective   | Drug unlikely to work      |
| Unknown       | Insufficient evidence      |

---

## 🤖 AI Clinical Explanation

Each result includes:

* Mechanistic interpretation
* Variant citation
* Clinical impact
* CPIC guideline rationale

Example:

> CYP2D6 *1/*2 predicts normal metabolism enabling effective conversion of WARFARIN to morphine.

---

## 📦 API Endpoints

### Analyze VCF

```
POST /process_vcf/?drug=WARFARIN
```

**Form Data**

```
file : .vcf file
```

---

### Response Schema

```json
{
  "patient_id": "PATIENT_001",
  "drug": "WARFARIN",
  "timestamp": "2026-02-20T00:52:34.164552",
  "risk_assessment": {
    "risk_label": "Adjust Dosage",
    "confidence_score": 0.97,
    "severity": "high"
  },
  "pharmacogenomic_profile": [
    {
      "primary_gene": "CYP2C9",
      "diplotype": "*12/*2",
      "phenotype": "IM",
      "detected_variants": [
        {
          "rsid": "rs72558187"
        },
        {
          "rsid": "rs1057910"
        },
        {
          "rsid": "rs1799853"
        },
        {
          "rsid": "rs9332131"
        }
      ]
    }
  ],
  "clinical_recommendation": {
    "recommendation": "Reduce dose."
  },
  "llm_generated_explanation": {
    "summary": "CYP2C9 *12/*2 results in IM phenotype affecting WARFARIN.",
    "mechanism": "Variants alter enzyme activity of CYP2C9.",
    "clinical_impact": "This may alter therapeutic response to WARFARIN.",
    "guideline_basis": "Aligned with CPIC guidelines."
  },
  "quality_metrics": {
    "vcf_parsing_success": true
  }
}
```

---

## 🚀 Local Setup

### 1. Clone Repository

```bash
git clone https://github.com/Prerit008/PharmaGuard.git
cd PharmaGuard
```

---

### 2. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

---

### 3. Run Backend

```bash
uvicorn app:app --reload
```

---

### 4. Run Frontend

```bash
cd frontend
npm install
npm start
```

---

## ☁️ Deployment

### Backend (Vercel)

* Serverless FastAPI deployment
* Temporary `/tmp` storage for uploaded VCF

### Frontend (Vercel)

* Vite+React production build
* HTTPS enabled
* PWA installable

---

## 🔐 Data Privacy

* No patient data stored
* Processing occurs in memory
* Temporary files removed after execution

---

## 🧪 Test Dataset

Hackathon-provided pharmacogenomic VCF files containing annotated variants across target genes.

---

## 📊 Evaluation Alignment

| Criterion          | Implementation              |
| ------------------ | --------------------------- |
| Problem Clarity    | Precision medicine workflow |
| Solution Accuracy  | CPIC-aligned logic          |
| Technical Depth    | Real VCF parsing            |
| Innovation         | AI explainability           |
| Documentation      | Complete                    |
| Test Case Matching | Deterministic output        |

---

## 🌟 Key Innovations

* Serverless genomic analysis
* CPIC engine
* Clinician-friendly explanations
* Installable medical web app (PWA)
* Real clinical data compatibility

---

## 👨‍💻 Team

**Team_Garudaa**

AI × Genomics × Healthcare Innovation

---

## ⚖️ Disclaimer

This project is for **educational and research purposes only** and is **not intended for clinical diagnosis or treatment decisions**.

---

## 🏆 Hackathon Vision

> Transform genomic data into actionable clinical intelligence — making precision medicine accessible anywhere.

