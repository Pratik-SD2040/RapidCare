"""Super Admin administration routes:
- GET /api/admin/pending-clinics — returns clinic accounts awaiting verification
- PATCH /api/admin/clinics/{user_id}/approve — approves a pending clinic account
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import require_role
from ..database import get_db
from ..models import User
from ..schemas import UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/pending-clinics", response_model=List[UserOut])
def get_pending_clinics(
    current_admin: User = Depends(require_role("super_admin")),
    db: Session = Depends(get_db),
):
    """Super Admin only: returns all clinic staff accounts with status 'pending_verification'."""
    pending = (
        db.query(User)
        .filter(User.role == "clinic_staff", User.status == "pending_verification")
        .order_by(User.created_at.desc())
        .all()
    )
    return pending


@router.patch("/clinics/{user_id}/approve", response_model=UserOut)
def approve_clinic(
    user_id: int,
    current_admin: User = Depends(require_role("super_admin")),
    db: Session = Depends(get_db),
):
    """Super Admin only: sets the target clinic account status to 'approved'."""
    clinic = db.query(User).filter(User.id == user_id, User.role == "clinic_staff").first()
    if not clinic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clinic staff user with id {user_id} not found.",
        )

    clinic.status = "approved"
    db.commit()
    db.refresh(clinic)
    return clinic
