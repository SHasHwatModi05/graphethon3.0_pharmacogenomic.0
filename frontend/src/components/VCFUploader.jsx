// components/VCFUploader.jsx — VCF file upload with status panel (PharmaGuard style)
import React, { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function VCFUploader({ onFileSelected, selectedFile, onDrugsDetected }) {
  const { BASE_URL, token } = useAuth();
  const dropRef = useRef(null);
  const fileInputRef = useRef(null);   // ← use a ref instead of getElementById
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // null | 'scanning' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const handleFile = async (file) => {
    if (!file) {
      onFileSelected(null);
      setUploadStatus(null);
      return;
    }

    onFileSelected(file);
    setUploadStatus('scanning');
    setErrorMsg('');

    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${BASE_URL}/detect_drugs/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        onDrugsDetected(data.available_drugs || [], data.unavailable_drugs || []);
        setUploadStatus('success');
      } else {
        onDrugsDetected([], []);
        setUploadStatus('error');
        setErrorMsg('Server could not process this VCF file.');
      }
    } catch (e) {
      onDrugsDetected([], []);
      setUploadStatus('error');
      setErrorMsg('Network error — check that the backend is running.');
    }
  };

  const handleRemove = () => {
    onFileSelected(null);
    setUploadStatus(null);
    setErrorMsg('');
    onDrugsDetected([], []);
    // Reset via ref — safe even with multiple instances on the page
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.vcf') || file.name.endsWith('.gz'))) {
      handleFile(file);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="vcf-uploader-wrapper">
      {/* Secure upload header */}
      <div className="vcf-upload-header">
        <span className="vcf-upload-title">VCF File Upload</span>
        <span className="vcf-secure-badge">
          <span className="vcf-secure-dot" />
          Secure upload
        </span>
      </div>

      {/* Drop zone — only shown when no file yet */}
      {!selectedFile && (
        <div
          ref={dropRef}
          className={`vcf-dropzone${isDragging ? ' vcf-dropzone--active' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
        >
          <div className="vcf-dropzone-icon">🧬</div>
          <div className="vcf-dropzone-primary">Drop VCF file here or click to browse</div>
          <div className="vcf-dropzone-secondary">.vcf or .vcf.gz supported</div>
        </div>
      )}

      {/* File info card — shown after file selected */}
      {selectedFile && (
        <div className="vcf-file-card">
          <div className="vcf-file-info">
            <div className="vcf-file-icon">📄</div>
            <div className="vcf-file-meta">
              <div className="vcf-file-name">{selectedFile.name}</div>
              <div className="vcf-file-size">{formatSize(selectedFile.size)}</div>
            </div>
            <button
              type="button"
              className="vcf-remove-btn"
              onClick={handleRemove}
              title="Remove file"
            >
              ✕
            </button>
          </div>

          {/* Status panel */}
          {uploadStatus === 'scanning' && (
            <div className="vcf-status vcf-status--scanning">
              <div className="vcf-status-row">
                <div className="spinner" />
                <span>Scanning VCF for pharmacogenes…</span>
              </div>
            </div>
          )}

          {uploadStatus === 'success' && (
            <div className="vcf-status vcf-status--success">
              <div className="vcf-status-title">
                <span className="vcf-check-icon">✅</span>
                File processed successfully
              </div>
              <div className="vcf-status-items">
                <div className="vcf-status-item">✓ VCF uploaded successfully</div>
                <div className="vcf-status-item">✓ Pharmacogenes detected</div>
              </div>
            </div>
          )}

          {uploadStatus === 'error' && (
            <div className="vcf-status vcf-status--error">
              <div className="vcf-status-title">
                <span>⚠️</span> Upload issue
              </div>
              <div className="vcf-status-items">
                <div className="vcf-status-item">{errorMsg || 'Could not process file.'}</div>
              </div>
            </div>
          )}

          {/* Re-upload button */}
          <button
            type="button"
            className="vcf-cancel-btn"
            onClick={handleRemove}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Hidden file input — accessed via ref, no id clash possible */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".vcf,.gz"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {/* HIPAA note */}
      <div className="vcf-hipaa-note">
        <span className="vcf-hipaa-icon">🔒</span>
        Secure, HIPAA-compliant file processing. Your data is encrypted.
      </div>
    </div>
  );
}