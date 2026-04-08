// services/api.js

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const analyzePGx = async (file, drugs, onProgress) => {
  try {
    // drugs can be a string or array — normalise to array
    const drugList = Array.isArray(drugs) ? drugs : [drugs];

    const results = await Promise.all(
      drugList.map(async (drug) => {
        let resultObj;
        try {
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch(
            `${BASE_URL}/process_vcf/?drug=${encodeURIComponent(drug)}`,
            {
              method: "POST",
              body: formData,
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error for ${drug}: ${errorText}`);
          }

          const data = await response.json();
          resultObj = { ...data, _drug: drug };
        } catch (err) {
          console.error(`PGx error for ${drug}:`, err);
          resultObj = { _drug: drug, error: "Analysis failed" };
        }
        
        if (onProgress) {
          onProgress(resultObj);
        }
        return resultObj;
      })
    );

    // Always return array for ResultsDashboard tab support
    return results;

    } catch (error) {
    console.error("PGx API error:", error);
    throw error;
  }
};

export const detectDrugsFromVCF = async (vcfFile) => {
  const formData = new FormData()
  formData.append('file', vcfFile)
  
  const response = await fetch(
    `${BASE_URL}/detect_drugs/`,
    {
      method: 'POST',
      body: formData
    }
  )
  
  if (!response.ok) {
    throw new Error('VCF drug detection failed')
  }
  
  return await response.json()
}
