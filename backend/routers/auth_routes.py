"""Authentication routes:
- POST /api/register — patient self-registration
- POST /api/register-clinic — creates clinic_staff with status "pending_verification"
- POST /api/login — validates credentials + status, returns JWT + role
- GET /api/me — returns current authenticated user info
"""
from datetime import datetime, timedelta
from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import (
    authenticate_user,
    create_access_token,
    get_current_user,
    get_password_hash,
    require_role,
)
from ..database import get_db
from ..models import AmbulanceRequest, Appointment, BloodRequest, User
from ..schemas import (
    ClinicRegister,
    LoginRequest,
    PatientListItemOut,
    PatientRegister,
    Token,
    UserOut,
)

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_patient(patient_in: PatientRegister, db: Session = Depends(get_db)):
    """Patient self-registration:
    Creates a new user with role='patient' and status='approved'.
    """
    existing_user = db.query(User).filter(User.email == patient_in.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    new_user = User(
        name=patient_in.name.strip(),
        email=patient_in.email.lower().strip(),
        phone=patient_in.phone.strip(),
        password_hash=get_password_hash(patient_in.password),
        role="patient",
        status="approved",
        blood_group=patient_in.blood_group.strip().upper() if patient_in.blood_group else None,
        latitude=patient_in.latitude,
        longitude=patient_in.longitude,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/register-clinic", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_clinic(clinic_in: ClinicRegister, db: Session = Depends(get_db)):
    """Clinic staff registration:
    Creates a new staff account with role='clinic_staff' and status='pending_verification'.
    Cannot log in until approved.
    """
    existing_user = db.query(User).filter(User.email == clinic_in.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    new_user = User(
        name=clinic_in.name.strip(),
        email=clinic_in.email.lower().strip(),
        phone=clinic_in.phone.strip(),
        password_hash=get_password_hash(clinic_in.password),
        role="clinic_staff",
        status="pending_verification",
        blood_group=None,
        latitude=clinic_in.latitude,
        longitude=clinic_in.longitude,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user with email and password.
    Rejects clinic_staff accounts whose status is 'pending_verification'.
    Returns JWT access token, user role, and profile details.
    """
    user = authenticate_user(db, email=login_data.email.lower().strip(), password=login_data.password)

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "user_id": user.id,
            "role": user.role,
        }
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        status=user.status,
        user_id=user.id,
        name=user.name,
    )


@router.get("/me", response_model=UserOut)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Return profile of currently logged-in user."""
    return current_user


@router.get("/patients", response_model=List[PatientListItemOut])
def get_all_patients(
    current_staff: User = Depends(require_role("clinic_staff")),
    db: Session = Depends(get_db),
):
    """Clinic staff only: returns list of all registered patients."""
    patients = db.query(User).filter(User.role == "patient").order_by(User.name.asc()).all()
    return patients


@router.get("/stats")
def get_clinic_stats(
    current_staff: User = Depends(require_role("clinic_staff")),
    db: Session = Depends(get_db),
):
    """Clinic staff only: aggregate dashboard analytics metrics."""
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)

    appointments_today = (
        db.query(Appointment)
        .filter(Appointment.requested_date >= today_start, Appointment.requested_date < today_end)
        .count()
    )
    pending_appointments = (
        db.query(Appointment)
        .filter(Appointment.status.in_(["requested", "pending"]))
        .count()
    )
    active_ambulances = (
        db.query(AmbulanceRequest)
        .filter(AmbulanceRequest.status.in_(["requested", "dispatched"]))
        .count()
    )
    open_blood = (
        db.query(BloodRequest)
        .filter(BloodRequest.status == "open")
        .count()
    )
    total_patients = (
        db.query(User)
        .filter(User.role == "patient")
        .count()
    )

    return {
        "appointments_today": appointments_today,
        "pending_appointments": pending_appointments,
        "active_ambulances": active_ambulances,
        "open_blood_requests": open_blood,
        "total_patients": total_patients,
        "active_emergencies": active_ambulances + open_blood,
    }

