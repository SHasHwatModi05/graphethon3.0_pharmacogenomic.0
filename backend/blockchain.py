# blockchain.py — SHA-256 tamper-evident hash chain
import hashlib
import json
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from database import BlockchainLog


def compute_hash(data: dict) -> str:
    """Compute SHA-256 hash of a dictionary"""
    content = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(content.encode()).hexdigest()


def get_last_block_hash(db: Session) -> str:
    """Get the hash of the most recent blockchain block (genesis if empty)"""
    last = db.query(BlockchainLog).order_by(BlockchainLog.block_index.desc()).first()
    if last:
        return last.block_hash
    return "0" * 64  # genesis hash


def add_block(
    db: Session,
    action: str,
    document_type: str,
    document_id: int,
    actor_id: int,
    actor_role: str,
    document_data: dict,
    patient_id: Optional[int] = None
) -> BlockchainLog:
    """Add a new block to the blockchain"""
    previous_hash = get_last_block_hash(db)
    
    # Count existing blocks
    block_index = db.query(BlockchainLog).count()
    
    timestamp = datetime.utcnow()
    data_hash = compute_hash(document_data)
    
    block_content = {
        "block_index": block_index,
        "timestamp": timestamp.isoformat(),
        "action": action,
        "document_type": document_type,
        "document_id": document_id,
        "actor_id": actor_id,
        "data_hash": data_hash,
        "previous_hash": previous_hash
    }
    block_hash = compute_hash(block_content)
    
    block = BlockchainLog(
        block_index=block_index,
        timestamp=timestamp,
        action=action,
        document_type=document_type,
        document_id=document_id,
        patient_id=patient_id,
        actor_id=actor_id,
        actor_role=actor_role,
        data_hash=data_hash,
        previous_hash=previous_hash,
        block_hash=block_hash,
        is_valid=True
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


def verify_chain(db: Session) -> dict:
    """Verify integrity of the entire blockchain"""
    blocks = db.query(BlockchainLog).order_by(BlockchainLog.block_index.asc()).all()
    
    if not blocks:
        return {"valid": True, "total_blocks": 0, "tampered_blocks": []}
    
    tampered = []
    previous_hash = "0" * 64
    
    for block in blocks:
        # Recompute block hash
        block_content = {
            "block_index": block.block_index,
            "timestamp": block.timestamp.isoformat() if hasattr(block.timestamp, 'isoformat') else str(block.timestamp),
            "action": block.action,
            "document_type": block.document_type,
            "document_id": block.document_id,
            "actor_id": block.actor_id,
            "data_hash": block.data_hash,
            "previous_hash": previous_hash
        }
        expected_hash = compute_hash(block_content)
        
        if expected_hash != block.block_hash or block.previous_hash != previous_hash:
            tampered.append({
                "block_index": block.block_index,
                "reason": "Hash mismatch — possible tampering detected"
            })
            # Mark as invalid in DB
            block.is_valid = False
        
        previous_hash = block.block_hash
    
    db.commit()
    
    return {
        "valid": len(tampered) == 0,
        "total_blocks": len(blocks),
        "tampered_blocks": tampered
    }


def get_audit_trail(db: Session, patient_id: Optional[int] = None) -> list:
    """Get blockchain audit trail, optionally filtered by patient"""
    query = db.query(BlockchainLog)
    if patient_id:
        query = query.filter(BlockchainLog.patient_id == patient_id)
    blocks = query.order_by(BlockchainLog.block_index.desc()).limit(100).all()
    
    return [
        {
            "block_index": b.block_index,
            "timestamp": b.timestamp.isoformat() if b.timestamp else None,
            "action": b.action,
            "document_type": b.document_type,
            "document_id": b.document_id,
            "actor_id": b.actor_id,
            "actor_role": b.actor_role,
            "data_hash": b.data_hash,
            "block_hash": b.block_hash,
            "is_valid": b.is_valid
        }
        for b in blocks
    ]
