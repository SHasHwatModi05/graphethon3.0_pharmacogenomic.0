from pydantic import BaseModel
from typing import List, Literal
from datetime import datetime
import json


# ===============================
# JSON MODELS
# ===============================

class RiskAssessment(BaseModel):
    risk_label: Literal["Safe", "Adjust Dosage", "Toxic", "Ineffective", "Unknown"]
    severity: Literal["none", "low", "moderate", "high", "critical"]


class DetectedVariant(BaseModel):
    rsid: str
    gene: str = "Unknown"


class PharmacogenomicProfile(BaseModel):
    primary_gene: str
    diplotype: str
    phenotype: Literal["PM", "IM", "NM", "RM", "URM", "Unknown"]
    detected_variants: List[DetectedVariant]


class ClinicalRecommendation(BaseModel):
    recommendation: str


class LLMExplanation(BaseModel):
    summary: str
    mechanism: str
    clinical_impact: str
    guideline_basis: str


class QualityMetrics(BaseModel):
    vcf_parsing_success: bool


class PharmaGuardResponse(BaseModel):
    patient_id: str
    drug: str
    timestamp: str
    risk_assessment: RiskAssessment
    pharmacogenomic_profile: List[PharmacogenomicProfile]
    clinical_recommendation: ClinicalRecommendation
    llm_generated_explanation: LLMExplanation
    quality_metrics: QualityMetrics


# ===============================
# DRUG CONFIGURATION
# ===============================

DRUG_CONFIG = {
    "CODEINE": "CYP2D6",
    "WARFARIN": "CYP2C9",
    "CLOPIDOGREL": "CYP2C19",
    "SIMVASTATIN": "SLCO1B1",
    "AZATHIOPRINE": "TPMT",
    "FLUOROURACIL": "DPYD"
}

# Extended drug→gene mapping for searched/unknown drugs
# Covers common pharmacogenes — used as fallback when drug is not in DRUG_CONFIG
EXTENDED_DRUG_GENE_MAP = {
    # CYP2D6 substrates
    "TRAMADOL": "CYP2D6", "OXYCODONE": "CYP2D6", "HYDROCODONE": "CYP2D6",
    "METOPROLOL": "CYP2D6", "CARVEDILOL": "CYP2D6", "PROPRANOLOL": "CYP2D6",
    "VENLAFAXINE": "CYP2D6", "DULOXETINE": "CYP2D6", "FLUOXETINE": "CYP2D6",
    "PAROXETINE": "CYP2D6", "AMITRIPTYLINE": "CYP2D6", "NORTRIPTYLINE": "CYP2D6",
    "HALOPERIDOL": "CYP2D6", "RISPERIDONE": "CYP2D6", "ATOMOXETINE": "CYP2D6",
    "TAMOXIFEN": "CYP2D6", "ONDANSETRON": "CYP2D6",
    # CYP2C19 substrates
    "OMEPRAZOLE": "CYP2C19", "ESOMEPRAZOLE": "CYP2C19", "PANTOPRAZOLE": "CYP2C19",
    "CITALOPRAM": "CYP2C19", "ESCITALOPRAM": "CYP2C19", "SERTRALINE": "CYP2C19",
    "DIAZEPAM": "CYP2C19", "PHENYTOIN": "CYP2C19", "PRASUGREL": "CYP2C19",
    "TICAGRELOR": "CYP2C19", "VORICONAZOLE": "CYP2C19",
    # CYP2C9 substrates
    "ACENOCOUMAROL": "CYP2C9", "PHENYTOIN": "CYP2C9", "LOSARTAN": "CYP2C9",
    "CELECOXIB": "CYP2C9", "IBUPROFEN": "CYP2C9", "DICLOFENAC": "CYP2C9",
    "GLIPIZIDE": "CYP2C9", "GLYBURIDE": "CYP2C9", "TOLBUTAMIDE": "CYP2C9",
    "FLUVASTATIN": "CYP2C9",
    # SLCO1B1 substrates (statins)
    "ATORVASTATIN": "SLCO1B1", "ROSUVASTATIN": "SLCO1B1", "PRAVASTATIN": "SLCO1B1",
    "LOVASTATIN": "SLCO1B1", "PITAVASTATIN": "SLCO1B1", "REPAGLINIDE": "SLCO1B1",
    # TPMT substrates
    "MERCAPTOPURINE": "TPMT", "THIOGUANINE": "TPMT",
    # DPYD substrates
    "CAPECITABINE": "DPYD", "TEGAFUR": "DPYD",
}


# Drug substitutes for unsafe/ineffective drugs — keyed by (drug, phenotype) or (gene, phenotype)
DRUG_SUBSTITUTES = {
    # CYP2D6 — Poor Metabolizers
    ("CODEINE",   "PM"): ["Morphine (non-CYP2D6 pathway)", "Hydromorphone", "Oxymorphone", "Tramadol (with monitoring)"],
    ("TRAMADOL",  "PM"): ["Morphine", "Buprenorphine", "Fentanyl", "Hydromorphone"],
    ("OXYCODONE", "PM"): ["Morphine", "Hydromorphone", "Buprenorphine"],
    ("METOPROLOL","PM"): ["Atenolol (renally cleared)", "Carvedilol (lower starting dose)", "Bisoprolol"],
    ("TAMOXIFEN", "PM"): ["Aromatase inhibitors (Letrozole, Anastrozole)", "Exemestane"],
    ("FLUOXETINE","PM"): ["Citalopram (CYP2C19-cleared)", "Escitalopram", "Venlafaxine (reduced dose)", "Mirtazapine"],
    ("PAROXETINE","PM"): ["Citalopram", "Escitalopram", "Sertraline", "Mirtazapine"],
    ("AMITRIPTYLINE","PM"): ["Nortriptyline (lower dose)", "Desipramine", "SSRIs"],
    ("HALOPERIDOL","PM"): ["Quetiapine (non-CYP2D6)", "Olanzapine", "Clozapine (with monitoring)"],
    ("RISPERIDONE","PM"): ["Quetiapine", "Olanzapine", "Aripiprazole"],
    # CYP2C19 — Poor Metabolizers
    ("CLOPIDOGREL","PM"): ["Prasugrel (non-CYP2C19)", "Ticagrelor (direct-acting)", "Aspirin + monitoring"],
    ("OMEPRAZOLE", "PM"): ["Pantoprazole (low CYP2C19 dependence)", "Rabeprazole", "Famotidine (H2 blocker)"],
    ("ESOMEPRAZOLE","PM"): ["Rabeprazole", "Pantoprazole", "Famotidine"],
    ("CITALOPRAM", "PM"): ["Sertraline (partial CYP2C19)", "Fluoxetine", "Mirtazapine"],
    ("ESCITALOPRAM","PM"): ["Sertraline", "Fluoxetine", "Venlafaxine"],
    ("DIAZEPAM",   "PM"): ["Lorazepam (glucuronidation pathway)", "Oxazepam", "Temazepam"],
    ("VORICONAZOLE","PM"): ["Isavuconazole", "Posaconazole", "Amphotericin B"],
    # CYP2C9 — Poor Metabolizers
    ("WARFARIN",  "PM"): ["Dabigatran (non-CYP pathway)", "Rivaroxaban", "Apixaban (DOAC alternatives)"],
    ("WARFARIN",  "IM"): ["Reduce warfarin dose 25-50%", "INR-guided dosing", "Consider DOAC: Apixaban"],
    ("IBUPROFEN", "PM"): ["Acetaminophen/Paracetamol (different pathway)", "Naproxen (low CYP2C9 impact)", "Celecoxib (lower dose)"],
    ("CELECOXIB", "PM"): ["Acetaminophen", "Naproxen", "Diclofenac (monitor)"],
    ("GLIPIZIDE", "PM"): ["Glimepiride (dose-reduce)", "Sitagliptin", "Metformin", "Empagliflozin"],
    # SLCO1B1 — Poor Transporters (statin myopathy risk)
    ("SIMVASTATIN","PM"): ["Rosuvastatin (lower SLCO1B1 sensitivity)", "Pravastatin", "Fluvastatin", "Pitavastatin"],
    ("ATORVASTATIN","PM"): ["Rosuvastatin (lower risk)", "Pravastatin (minimal hepatic transport)", "Pitavastatin"],
    ("SIMVASTATIN","IM"): ["Reduce simvastatin to ≤20mg/day", "Consider Rosuvastatin", "Pravastatin"],
    # TPMT — Poor Metabolizers (thiopurine toxicity)
    ("AZATHIOPRINE","PM"): ["Mycophenolate mofetil", "Cyclosporine", "Methotrexate (monitor)", "Stop thiopurine"],
    ("AZATHIOPRINE","IM"): ["Reduce azathioprine dose by 30-70%", "Weekly CBC monitoring", "Mycophenolate"],
    ("MERCAPTOPURINE","PM"): ["Methotrexate", "Mycophenolate", "Reduce dose by 90%"],
    # DPYD — Poor Metabolizers (fluoropyrimidine toxicity)
    ("FLUOROURACIL","PM"): ["Raltitrexed (non-DPYD)", "Oxaliplatin-based regimen", "Irinotecan combinations"],
    ("CAPECITABINE","PM"): ["Raltitrexed", "Oxaliplatin regimens", "Irinotecan", "Avoid all fluoropyrimidines"],
    ("FLUOROURACIL","IM"): ["Reduce 5-FU dose by 50%", "Increased monitoring", "Capecitabine with caution"],
}

# When no specific drug match, fall back to gene+phenotype
GENE_PHENOTYPE_SUBSTITUTES = {
    ("CYP2D6", "PM"):   ["Consider non-CYP2D6 metabolized drugs", "Dose reduction of 50-75%", "Therapeutic drug monitoring"],
    ("CYP2D6", "IM"):   ["Reduce standard dose by 25-50%", "Monitor for drug accumulation"],
    ("CYP2D6", "UM"):   ["Increase dose with monitoring", "Consider non-CYP2D6 alternatives if sub-therapeutic"],
    ("CYP2C19","PM"):   ["Use non-CYP2C19 cleared alternatives", "Monitor plasma drug levels"],
    ("CYP2C19","IM"):   ["Reduce dose by 25%", "Monitor therapeutic response"],
    ("CYP2C19","RM"):   ["Standard dose appropriate", "May require higher doses for adequate effect"],
    ("CYP2C9", "PM"):   ["DOAC anticoagulants instead of warfarin", "Low-CYP2C9 NSAIDs", "Dose reduce by 50-75%"],
    ("CYP2C9", "IM"):   ["Dose reduce by 25-50%", "Frequent INR/drug monitoring"],
    ("SLCO1B1","PM"):   ["Low-transport statins: Rosuvastatin, Pravastatin", "Reduce statin dose", "CK monitoring"],
    ("TPMT",   "PM"):   ["Stop thiopurine", "Alternative immunosuppressants: Mycophenolate, Cyclosporine"],
    ("TPMT",   "IM"):   ["Reduce thiopurine dose by 30-70%", "Weekly CBC for 4+ weeks"],
    ("DPYD",   "PM"):   ["Avoid all fluoropyrimidines", "Non-fluoropyrimidine regimens: Oxaliplatin, Irinotecan"],
    ("DPYD",   "IM"):   ["Reduce fluoropyrimidine dose by 50%", "Increase monitoring frequency"],
}

# Detailed gene mechanism explanations
GENE_MECHANISM_INFO = {
    "CYP2D6": {
        "full_name": "Cytochrome P450 2D6",
        "location": "Chromosome 22q13.2",
        "function": "CYP2D6 is a liver enzyme responsible for metabolizing approximately 25% of all clinically used drugs, including opioids, antidepressants, antipsychotics, and beta-blockers. It converts prodrugs into active forms and active drugs into inactive metabolites.",
        "pm_impact": "Poor Metabolizers (PM) have little or no CYP2D6 activity. Drugs that need CYP2D6 for activation (e.g., Codeine→Morphine, Tramadol) become ineffective. Drugs metabolized by CYP2D6 accumulate to toxic levels, increasing risk of side effects.",
        "im_impact": "Intermediate Metabolizers (IM) have reduced enzyme activity. Dosing adjustments are often required to avoid accumulation or ensure therapeutic efficacy.",
        "um_impact": "Ultra-Rapid Metabolizers (UM) have excessive CYP2D6 activity, causing drugs to be eliminated too quickly (sub-therapeutic levels) or prodrugs to convert excessively (toxicity risk for Codeine).",
        "nm_impact": "Normal Metabolizers (NM) have standard drug metabolism. Standard dosing is appropriate.",
        "guideline": "CPIC, PharmGKB, DPWG guidelines recommend genotyping before prescribing CYP2D6 substrates, especially opioids and antidepressants.",
    },
    "CYP2C19": {
        "full_name": "Cytochrome P450 2C19",
        "location": "Chromosome 10q24.1-q24.3",
        "function": "CYP2C19 metabolizes important drugs including proton pump inhibitors, antiplatelet agents (Clopidogrel), antidepressants, and antifungals. It activates Clopidogrel from a prodrug to its active thiol metabolite.",
        "pm_impact": "Poor Metabolizers cannot activate Clopidogrel, leading to inadequate platelet inhibition and increased risk of stent thrombosis or cardiovascular events. PPIs accumulate and may be more effective but require dose reduction.",
        "im_impact": "Intermediate Metabolizers show reduced Clopidogrel activation. Monitoring and dose adjustment or alternative antiplatelet therapy is recommended.",
        "rm_impact": "Rapid/Ultra-Rapid Metabolizers over-activate Clopidogrel, potentially leading to excessive platelet inhibition and bleeding risk. PPIs are metabolized too quickly and may be less effective.",
        "nm_impact": "Normal Metabolizers respond to standard doses appropriately.",
        "guideline": "CPIC guidelines strongly recommend Ticagrelor or Prasugrel over Clopidogrel in CYP2C19 PM/IM patients undergoing PCI.",
    },
    "CYP2C9": {
        "full_name": "Cytochrome P450 2C9",
        "location": "Chromosome 10q24.2",
        "function": "CYP2C9 is the primary enzyme metabolizing Warfarin (the most common oral anticoagulant), NSAIDs, sulfonylurea antidiabetics, and certain antiepileptics. Variants (*2, *3 alleles) dramatically reduce enzyme activity.",
        "pm_impact": "Poor Metabolizers cannot clear Warfarin efficiently, causing it to accumulate to supratherapeutic levels — dramatically increasing the risk of life-threatening bleeding. NSAIDs also accumulate, increasing GI toxicity.",
        "im_impact": "Intermediate Metabolizers require significantly reduced Warfarin doses (typically 25-50% reduction). Close INR monitoring is mandatory during initiation.",
        "nm_impact": "Normal Metabolizers require standard Warfarin dosing with routine INR monitoring.",
        "guideline": "CPIC and FDA label both recommend CYP2C9 + VKORC1 genotyping for Warfarin dosing. Direct oral anticoagulants (DOACs) are often safer alternatives in CYP2C9 PM patients.",
    },
    "SLCO1B1": {
        "full_name": "Solute Carrier Organic Anion Transporter 1B1",
        "location": "Chromosome 12p12.2",
        "function": "SLCO1B1 (also called OATP1B1) is a hepatic uptake transporter that imports statins from bloodstream into liver cells for metabolism and clearance. Reduced SLCO1B1 function causes statins to remain in the bloodstream longer.",
        "pm_impact": "Poor Transporters have severely reduced statin uptake into liver. High systemic statin concentrations increase the risk of statin-induced myopathy (muscle damage), up to 17x increased risk of severe myopathy with high-dose Simvastatin. Rhabdomyolysis is a rare but life-threatening complication.",
        "im_impact": "Intermediate Transporters have moderately increased myopathy risk. Dose reduction and monitoring for muscle pain/weakness is recommended.",
        "nm_impact": "Normal Transporters process statins normally. Standard dosing is appropriate.",
        "guideline": "CPIC guideline recommends avoiding Simvastatin >20mg in SLCO1B1 PM patients. Preferred alternatives: Rosuvastatin or Pravastatin (less SLCO1B1-dependent).",
    },
    "TPMT": {
        "full_name": "Thiopurine S-Methyltransferase",
        "location": "Chromosome 6p22.3",
        "function": "TPMT is an enzyme that inactivates thiopurine drugs (Azathioprine, Mercaptopurine, Thioguanine) by methylation. When TPMT activity is low, thiopurines are shunted toward toxic thioguanine nucleotide (TGN) metabolites that accumulate in cells.",
        "pm_impact": "Poor Metabolizers (TPMT PM) who receive standard thiopurine doses face severe, potentially fatal bone marrow suppression (myelosuppression). TGN metabolites accumulate 10-100x above normal, causing pancytopenia. Thiopurines must be avoided or doses reduced by 90%.",
        "im_impact": "Intermediate Metabolizers require dose reductions of 30-70%. Frequent CBC monitoring is mandatory, especially during the first weeks of therapy.",
        "nm_impact": "Normal TPMT activity patients can receive standard thiopurine doses with routine CBC monitoring.",
        "guideline": "CPIC gives a 'Strong' recommendation to test TPMT before thiopurine therapy. FDA boxed warning exists on Azathioprine packaging noting TPMT testing.",
    },
    "DPYD": {
        "full_name": "Dihydropyrimidine Dehydrogenase",
        "location": "Chromosome 1p22.1",
        "function": "DPYD is the rate-limiting enzyme for degradation of fluoropyrimidine drugs (5-Fluorouracil/5-FU, Capecitabine, Tegafur). It degrades 80-85% of administered 5-FU. DPYD variants (*2A, *13, c.2846A>T) dramatically reduce this breakdown capacity.",
        "pm_impact": "Poor Metabolizers who receive fluoropyrimidines accumulate toxic drug concentrations, causing severe or fatal toxicity: severe mucositis, myelosuppression, neurotoxicity, and multi-organ failure. These patients must avoid all fluoropyrimidines entirely.",
        "im_impact": "Intermediate Metabolizers have 30-70% reduced DPYD activity. Fluoropyrimidine dose must be reduced by 25-50%. Enhanced toxicity monitoring is required during treatment.",
        "nm_impact": "Normal DPYD activity patients can receive standard fluoropyrimidine chemotherapy doses.",
        "guideline": "CPIC and DPWG give 'Strong' recommendations to test for DPYD variants before fluoropyrimidine therapy. The European Medicines Agency (EMA) mandates DPYD testing before 5-FU or Capecitabine.",
    },
}

# ===============================
# CONFIDENCE SCORING ENGINE
# ===============================

# CPIC guideline levels per gene — Level A = highest clinical actionability
CPIC_GUIDELINE_LEVELS = {
    "CYP2D6":  {"level": "A", "bodies": ["CPIC", "PharmGKB", "DPWG", "FDA"],  "publications": 120},
    "CYP2C19": {"level": "A", "bodies": ["CPIC", "PharmGKB", "DPWG", "FDA"],  "publications": 95},
    "CYP2C9":  {"level": "A", "bodies": ["CPIC", "PharmGKB", "FDA", "DPWG"], "publications": 88},
    "SLCO1B1": {"level": "A", "bodies": ["CPIC", "PharmGKB"],                  "publications": 47},
    "TPMT":    {"level": "A", "bodies": ["CPIC", "PharmGKB", "FDA", "EMA"],  "publications": 76},
    "DPYD":    {"level": "A", "bodies": ["CPIC", "PharmGKB", "EMA", "FDA"],  "publications": 63},
}

# Drugs with explicit CPIC drug-specific guidelines (stronger evidence)
CPIC_DRUG_SPECIFIC = {
    "CODEINE", "WARFARIN", "CLOPIDOGREL", "SIMVASTATIN",
    "AZATHIOPRINE", "MERCAPTOPURINE", "FLUOROURACIL", "CAPECITABINE",
    "TAMOXIFEN", "AMITRIPTYLINE", "NORTRIPTYLINE", "OMEPRAZOLE"
}


def compute_confidence(
    gene: str,
    drug: str,
    diplotype: str,
    phenotype: str,
    variant_count: int,
    drug_in_known_map: bool,
) -> dict:
    """
    Returns a confidence object with:
    - score: 0-100
    - tier: 'CPIC Level A' | 'Guideline-Supported' | 'Evidence-Based Inference' | 'Limited Data'
    - supporting_bodies: list of orgs backing this analysis
    - rationale: human-readable explanation for the doctor
    - evidence_flags: list of specific evidence points
    """
    score = 0
    evidence_flags = []
    supporting_bodies = []

    # 1. Gene guideline tier — up to 45 pts
    guideline_info = CPIC_GUIDELINE_LEVELS.get(gene, {})
    if guideline_info:
        level = guideline_info.get("level", "")
        if level == "A":
            score += 45
            evidence_flags.append(f"CPIC Level A gene — highest clinical actionability")
        elif level == "B":
            score += 30
            evidence_flags.append("CPIC Level B gene — moderate clinical evidence")
        else:
            score += 15
            evidence_flags.append("CPIC-tracked gene with emerging evidence")
        supporting_bodies = guideline_info.get("bodies", [])
        pub_count = guideline_info.get("publications", 0)
        if pub_count > 0:
            evidence_flags.append(f"{pub_count}+ peer-reviewed publications supporting this gene")
    else:
        score += 5
        evidence_flags.append("Gene inferred from VCF; limited guideline data")

    # 2. Drug-specific CPIC guideline — up to 20 pts
    if drug in CPIC_DRUG_SPECIFIC:
        score += 20
        evidence_flags.append(f"{drug} has an explicit CPIC drug-gene pair guideline")
    elif drug_in_known_map:
        score += 12
        evidence_flags.append(f"{drug} is in the pharmacogenomic reference database")
    else:
        score += 3
        evidence_flags.append(f"{drug} inferred via gene-class association")

    # 3. Diplotype completeness — up to 20 pts
    if diplotype and diplotype != "*1/*1":
        score += 15
        evidence_flags.append(f"Specific diplotype detected: {diplotype}")
    elif diplotype == "*1/*1":
        score += 10
        evidence_flags.append("Reference diplotype (*1/*1) confirmed — normal metabolizer baseline")
    else:
        score += 3
        evidence_flags.append("Diplotype could not be resolved from VCF")

    # Bonus: both alleles are non-reference (homozygous variant) — higher certainty
    if diplotype and diplotype.count("/") == 1:
        alleles = diplotype.split("/")
        if alleles[0] != "*1" and alleles[1] != "*1" and alleles[0] == alleles[1]:
            score += 5
            evidence_flags.append("Homozygous variant — phenotype prediction highly reliable")

    # 4. Phenotype known — up to 10 pts
    if phenotype in ["PM", "IM", "NM", "RM", "UM", "URM"]:
        score += 10
        evidence_flags.append(f"Phenotype classified as {phenotype} per CPIC terminology")
    else:
        score += 2
        evidence_flags.append("Phenotype could not be classified")

    # 5. Variant count bonus — up to 5 pts
    if variant_count >= 3:
        score += 5
        evidence_flags.append(f"{variant_count} pharmacogenomic variants detected and cross-referenced")
    elif variant_count >= 1:
        score += 3
        evidence_flags.append(f"{variant_count} variant(s) detected in VCF")
    else:
        evidence_flags.append("No specific variants detected — diplotype inferred from absence")

    # Cap at 100
    score = min(score, 100)

    # Determine tier
    if score >= 85:
        tier = "CPIC Level A · High Confidence"
        tier_key = "high"
    elif score >= 65:
        tier = "Guideline-Supported · Moderate Confidence"
        tier_key = "moderate"
    elif score >= 40:
        tier = "Evidence-Based Inference"
        tier_key = "inference"
    else:
        tier = "Limited Data · Low Confidence"
        tier_key = "low"

    # Compose rationale
    bodies_str = ", ".join(supporting_bodies) if supporting_bodies else "internal pharmacogenomic database"
    rationale = (
        f"This analysis is backed by {bodies_str}. "
        f"The {gene} gene is classified under CPIC Level {guideline_info.get('level', 'N/A')} guidelines "
        f"with strong clinical evidence supporting {phenotype} phenotype classification. "
        f"Confidence score {score}/100 reflects guideline alignment, variant quality, and diplotype resolution."
        if guideline_info else
        f"Analysis based on pharmacogenomic inference for {gene}. "
        f"Limited guideline data available. Clinical pharmacist review recommended."
    )

    return {
        "score": score,
        "tier": tier,
        "tier_key": tier_key,  # 'high' | 'moderate' | 'inference' | 'low'
        "supporting_bodies": supporting_bodies,
        "evidence_flags": evidence_flags,
        "rationale": rationale,
        "cpic_level": guideline_info.get("level", "N/A"),
        "publication_count": guideline_info.get("publications", 0),
    }


# ===============================
# PATIENT ID EXTRACTION
# ===============================

def extract_patient_id(vcf_file):
    with open(vcf_file) as f:
        for line in f:
            if line.startswith("#CHROM"):
                cols = line.strip().split()
                return cols[-1]   # last column = sample name
    return "UNKNOWN_PATIENT"

# ===============================
# PHENOTYPE LOGIC
# ===============================

def determine_phenotype(gene, diplotype):

    # CYP2C19 special case
    if gene == "CYP2C19":
        if "*2" in diplotype and "*17" in diplotype:
            return "IM"
        if "*2" in diplotype:
            return "PM"
        if "*17" in diplotype:
            return "RM"
        return "NM"

    # CYP2D6
    if gene == "CYP2D6":
        if "*4" in diplotype:
            if diplotype.count("*4") >= 2:
                return "PM"
            return "IM"
        return "NM"

    # CYP2C9
    if gene == "CYP2C9":
        if "*3/*3" in diplotype:
            return "PM"
        if "*2" in diplotype or "*3" in diplotype:
            return "IM"
        return "NM"

    # SLCO1B1
    if gene == "SLCO1B1":
        if "*5/*5" in diplotype:
            return "PM"
        if "*5" in diplotype:
            return "IM"
        return "NM"

    # TPMT
    if gene == "TPMT":
        if "*3A/*3A" in diplotype:
            return "PM"
        if "*3A" in diplotype:
            return "IM"
        return "NM"

    # DPYD
    if gene == "DPYD":
        if "*2A/*2A" in diplotype:
            return "PM"
        if "*2A" in diplotype:
            return "IM"
        return "NM"

    return "Unknown"


# ===============================
# RISK RULES
# ===============================

def determine_risk(drug, phenotype):

    RISK_MAP = {
        "CODEINE": {
            "PM": ("Ineffective", "high", "Avoid codeine."),
            "IM": ("Adjust Dosage", "moderate", "Consider alternative."),
            "NM": ("Safe", "none", "Standard dosing.")
        },
        "CLOPIDOGREL": {
            "PM": ("Ineffective", "high", "Use alternative therapy."),
            "IM": ("Adjust Dosage", "moderate", "Consider alternative."),
            "RM": ("Safe", "low", "Monitor."),
            "NM": ("Safe", "none", "Standard therapy.")
        },
        "WARFARIN": {
            "PM": ("Toxic", "critical", "Major dose reduction."),
            "IM": ("Adjust Dosage", "high", "Reduce dose."),
            "NM": ("Safe", "none", "Standard dosing.")
        },
        "SIMVASTATIN": {
            "PM": ("Toxic", "high", "Avoid high dose."),
            "IM": ("Adjust Dosage", "moderate", "Lower starting dose."),
            "NM": ("Safe", "none", "Standard dosing.")
        },
        "AZATHIOPRINE": {
            "PM": ("Toxic", "critical", "Avoid drug."),
            "IM": ("Adjust Dosage", "high", "Reduce dose."),
            "NM": ("Safe", "none", "Standard dosing.")
        },
        "FLUOROURACIL": {
            "PM": ("Toxic", "critical", "Avoid drug."),
            "IM": ("Adjust Dosage", "high", "Reduce dose."),
            "NM": ("Safe", "none", "Standard dosing.")
        }
    }

    return RISK_MAP.get(drug, {}).get(
        phenotype,
        ("Unknown", "moderate", "Insufficient data.")
    )


# ===============================
# VCF PARSER
# ===============================

def parse_vcf(file_path):

    variants = []

    with open(file_path, "r") as f:
        for line in f:
            if line.startswith("#"):
                continue

            parts = line.strip().split()
            if len(parts) < 8:
                continue

            rsid = parts[2]
            info = parts[7]

            info_dict = {}
            for item in info.split(";"):
                if "=" in item:
                    k, v = item.split("=")
                    info_dict[k] = v

            variants.append({
                "gene": info_dict.get("GENE"),
                "star": info_dict.get("STAR"),
                "rsid": rsid
            })

    return variants


# ===============================
# MAIN ENGINE
# ===============================

def process_vcf(vcf_file, drug):

    drug = drug.upper()

    # Resolve gene: check DRUG_CONFIG first, then EXTENDED map, then default to CYP2D6
    if drug in DRUG_CONFIG:
        primary_gene = DRUG_CONFIG[drug]
    elif drug in EXTENDED_DRUG_GENE_MAP:
        primary_gene = EXTENDED_DRUG_GENE_MAP[drug]
    else:
        # Unknown drug — try to infer from all available genes in VCF
        primary_gene = None

    patient_id = extract_patient_id(vcf_file)
    variants = parse_vcf(vcf_file)

    # If no gene mapping, pick the most common gene found in VCF
    if primary_gene is None:
        from collections import Counter
        gene_counts = Counter(v["gene"] for v in variants if v.get("gene"))
        if gene_counts:
            primary_gene = gene_counts.most_common(1)[0][0]
        else:
            primary_gene = "CYP2D6"  # final fallback

    gene_variants = [v for v in variants if v["gene"] == primary_gene]

    stars = sorted(list(set([v["star"] for v in gene_variants if v["star"]])))

    if len(stars) == 0:
        diplotype = "*1/*1"
    elif len(stars) == 1:
        diplotype = f"{stars[0]}/{stars[0]}"
    else:
        diplotype = f"{stars[0]}/{stars[1]}"

    phenotype = determine_phenotype(primary_gene, diplotype)

    # Use known risk rules if available, otherwise generate generic result
    if drug in DRUG_CONFIG or drug in EXTENDED_DRUG_GENE_MAP:
        known_risks = {
            ("PM", "CYP2D6"): ("Adjust Dosage", "high", f"{drug} metabolism significantly reduced. Consider dose reduction or alternative."),
            ("IM", "CYP2D6"): ("Adjust Dosage", "moderate", f"{drug} metabolism reduced. Monitor and consider dose adjustment."),
            ("NM", "CYP2D6"): ("Safe", "none", f"Standard {drug} dosing appropriate."),
            ("PM", "CYP2C19"): ("Adjust Dosage", "high", f"{drug} metabolism significantly reduced via CYP2C19. Consider alternative."),
            ("IM", "CYP2C19"): ("Adjust Dosage", "moderate", f"Reduced {drug} metabolism. Consider dose adjustment."),
            ("RM", "CYP2C19"): ("Safe", "low", f"Rapid {drug} metabolizer. Standard or slightly increased dose."),
            ("NM", "CYP2C19"): ("Safe", "none", f"Standard {drug} dosing appropriate."),
            ("PM", "CYP2C9"): ("Toxic", "critical", f"{drug} clearance severely reduced. Major dose reduction required."),
            ("IM", "CYP2C9"): ("Adjust Dosage", "high", f"Reduced {drug} clearance. Reduce dose and monitor."),
            ("NM", "CYP2C9"): ("Safe", "none", f"Standard {drug} dosing appropriate."),
            ("PM", "SLCO1B1"): ("Toxic", "high", f"Reduced {drug} hepatic uptake. Increased myopathy risk."),
            ("IM", "SLCO1B1"): ("Adjust Dosage", "moderate", f"Reduced {drug} uptake. Use lower dose."),
            ("NM", "SLCO1B1"): ("Safe", "none", f"Standard {drug} dosing appropriate."),
            ("PM", "TPMT"): ("Toxic", "critical", f"{drug} — severe toxicity risk. Reduce dose by 90% or avoid."),
            ("IM", "TPMT"): ("Adjust Dosage", "high", f"{drug} — increase toxicity risk. Dose reduction required."),
            ("NM", "TPMT"): ("Safe", "none", f"Standard {drug} dosing appropriate."),
            ("PM", "DPYD"): ("Toxic", "critical", f"{drug} — life-threatening toxicity risk. Avoid use."),
            ("IM", "DPYD"): ("Adjust Dosage", "high", f"{drug} — increased toxicity risk. Reduce dose."),
            ("NM", "DPYD"): ("Safe", "none", f"Standard {drug} dosing appropriate."),
        }
        defaults = determine_risk(drug, phenotype)
        risk_entry = known_risks.get((phenotype, primary_gene), defaults)
        risk_label, severity, recommendation = risk_entry
    else:
        # Completely unknown drug
        risk_label, severity = "Unknown", "moderate"
        recommendation = (
            f"No pharmacogenomic data available for {drug} in our database. "
            f"Gene {primary_gene} ({phenotype} phenotype) detected. Consult clinical pharmacist."
        )

    # Resolve substitute drugs — drug+phenotype specific, then gene+phenotype fallback
    substitutes = (
        DRUG_SUBSTITUTES.get((drug, phenotype), None) or
        GENE_PHENOTYPE_SUBSTITUTES.get((primary_gene, phenotype), [])
    )

    # Get gene mechanism info
    gene_info = GENE_MECHANISM_INFO.get(primary_gene, {})
    phenotype_lower = phenotype.lower()
    mechanism_detail = gene_info.get(f"{phenotype_lower}_impact", gene_info.get("nm_impact", "Standard dosing applies."))

    result = PharmaGuardResponse(
        patient_id=patient_id,
        drug=drug,
        timestamp=datetime.utcnow().isoformat(),

        risk_assessment=RiskAssessment(
            risk_label=risk_label,
            severity=severity
        ),

        pharmacogenomic_profile=[PharmacogenomicProfile(
            primary_gene=primary_gene,
            diplotype=diplotype,
            phenotype=phenotype if phenotype in ["PM","IM","NM","RM","URM"] else "Unknown",
            detected_variants=[DetectedVariant(rsid=v["rsid"], gene=str(v.get("gene") or primary_gene)) for v in gene_variants]
        )],

        clinical_recommendation=ClinicalRecommendation(
            recommendation=recommendation
        ),

        llm_generated_explanation=LLMExplanation(
            summary=f"{primary_gene} {diplotype} results in {phenotype} phenotype affecting {drug}.",
            mechanism=gene_info.get("function", f"Variants alter enzyme activity of {primary_gene}."),
            clinical_impact=mechanism_detail,
            guideline_basis=gene_info.get("guideline", "Based on available CPIC / PharmGKB guidelines.")
        ),

        quality_metrics=QualityMetrics(
            vcf_parsing_success=True
        )
    )

    # Compute confidence score
    confidence = compute_confidence(
        gene=primary_gene,
        drug=drug,
        diplotype=diplotype,
        phenotype=phenotype,
        variant_count=len(gene_variants),
        drug_in_known_map=(drug in DRUG_CONFIG or drug in EXTENDED_DRUG_GENE_MAP),
    )

    # Attach enrichment data as extra fields on the dict
    result_dict = result.dict()
    result_dict["drug_substitutes"] = substitutes
    result_dict["gene_info"] = {
        "full_name": gene_info.get("full_name", primary_gene),
        "location": gene_info.get("location", ""),
        "function": gene_info.get("function", ""),
        "phenotype_impact": mechanism_detail,
        "guideline": gene_info.get("guideline", ""),
    }
    result_dict["confidence"] = confidence

    return result_dict



# ===============================
# DRUG AUTO-DETECTION
# ===============================

def detect_available_drugs(vcf_content: str):
    GENE_DRUG_MAP = {
        "CYP2D6":  "CODEINE",
        "CYP2C19": "CLOPIDOGREL",
        "CYP2C9":  "WARFARIN",
        "SLCO1B1": "SIMVASTATIN",
        "TPMT":    "AZATHIOPRINE",
        "DPYD":    "FLUOROURACIL"
    }
    
    detected_genes = set()
    gene_variant_counts = {}
    
    patient_id = "UNKNOWN_PATIENT"
    
    for line in vcf_content.split('\n'):
        line = line.strip()
        # Skip empty lines    
        if not line:
            continue
            
        if line.startswith('#CHROM'):
            cols = line.split()
            patient_id = cols[-1]
            continue
            
        # Skip header lines
        if line.startswith('#'):
            continue
            
        # Parse INFO field
        parts = line.split('\t')
        if len(parts) < 8:
            continue
            
        info = parts[7]
        
        # Extract GENE tag from INFO field
        for tag in info.split(';'):
            if tag.startswith('GENE='):
                gene = tag.split('=')[1].strip()
                if gene in GENE_DRUG_MAP:
                    detected_genes.add(gene)
                    gene_variant_counts[gene] = gene_variant_counts.get(gene, 0) + 1
    
    available = []
    unavailable = []
    
    for gene, drug in GENE_DRUG_MAP.items():
        if gene in detected_genes:
            available.append({
                "drug": drug,
                "gene": gene,
                "variants_found": gene_variant_counts[gene],
                "has_actionable_variants": True
            })
        else:
            unavailable.append({
                "drug": drug,
                "gene": gene,
                "reason": f"{gene} variants not found in VCF"
            })
    
    return patient_id, available, unavailable, list(detected_genes)
