// components/BlockchainBadge.jsx — Tamper-evident document verification badge
import React, { useState } from 'react';

export default function BlockchainBadge({ hash, label = 'Verified' }) {
  const [copied, setCopied] = useState(false);

  if (!hash) return null;

  const short = `${hash.slice(0, 6)}...${hash.slice(-4)}`;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span
      className="blockchain-badge"
      onClick={handleCopy}
      title={`Blockchain Hash: ${hash}\nClick to copy`}
    >
      🔗 {copied ? 'Copied!' : short}
    </span>
  );
}
