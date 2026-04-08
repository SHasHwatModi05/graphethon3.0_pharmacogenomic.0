import { useState } from 'react';
import { detectDrugsFromVCF } from '../services/api';

export const useVCFScanner = () => {
  const [scanStatus, setScanStatus] = useState('idle'); // idle, scanning, complete, error
  const [detectedDrugs, setDetectedDrugs] = useState([]);
  const [unavailableDrugs, setUnavailableDrugs] = useState([]);
  const [scanError, setScanError] = useState(null);

  const scanVCF = async (file) => {
    setScanStatus('scanning');
    setScanError(null);
    try {
      const data = await detectDrugsFromVCF(file);
      setDetectedDrugs(data.available_drugs || []);
      setUnavailableDrugs(data.unavailable_drugs || []);
      setScanStatus('complete');
      return data;
    } catch (err) {
      setScanStatus('error');
      setScanError(err.message || 'Failed to scan VCF');
      throw err;
    }
  };

  const resetScanner = () => {
    setScanStatus('idle');
    setDetectedDrugs([]);
    setUnavailableDrugs([]);
    setScanError(null);
  };

  return {
    scanStatus,
    scanError,
    detectedDrugs,
    unavailableDrugs,
    scanVCF,
    resetScanner
  };
};
