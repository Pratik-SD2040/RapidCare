"""Clinic appointment management routes:
- POST /api/appointments — patient books an appointment
- GET /api/appointments/mine — patient views their own appointments
- GET /api/appointments — clinic staff only, views all appointments
- PATCH /api/appointments/{id}/status — clinic staff only, updates status
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import Appointment, User
from ..schemas import AppointmentCreate, AppointmentOut, AppointmentUpdateStatus

router = APIRouter(prefix="/appointments", tags=["appointments"])

VALID_APPOINTMENT_STATUSES = {"requested", "confirmed", "completed", "no_show"}


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def book_appointment(
    appointment_in: AppointmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Patient books a new appointment."""
    appointment = Appointment(
        patient_id=current_user.id,
        reason=appointment_in.reason.strip(),
        requested_date=appointment_in.requested_date,
        status="requested",
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


@router.get("/mine", response_model=List[AppointmentOut])
def get_my_appointments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Patient views their own appointments, ordered newest first."""
    appointments = (
        db.query(Appointment)
        .filter(Appointment.patient_id == current_user.id)
        .order_by(Appointment.requested_date.desc())
        .all()
    )
    return appointments


@router.get("", response_model=List[AppointmentOut])
def get_all_appointments(
    current_staff: User = Depends(require_role("clinic_staff")),
    db: Session = Depends(get_db),
):
    """Clinic staff only: views all clinic appointments across all patients."""
    appointments = (
        db.query(Appointment)
        .order_by(Appointment.requested_date.desc())
        .all()
    )
    return appointments


@router.patch("/{appointment_id}/status", response_model=AppointmentOut)
def update_appointment_status(
    appointment_id: int,
    status_update: AppointmentUpdateStatus,
    current_staff: User = Depends(require_role("clinic_staff")),
    db: Session = Depends(get_db),
):
    """Clinic staff only: updates appointment status (requested/confirmed/completed/no_show)."""
    new_status = status_update.status.strip().lower()
    if new_status not in VALID_APPOINTMENT_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{status_update.status}'. Allowed: {', '.join(sorted(VALID_APPOINTMENT_STATUSES))}",
        )

    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    appointment.status = new_status
    db.commit()
    db.refresh(appointment)
    return appointment
