"""Emergency ambulance coordination routes:
- POST /api/ambulance-requests — patient submits an SOS request
- GET /api/ambulance-requests/mine — patient tracks their own request(s)
- GET /api/ambulance-requests — clinic staff only, views all active requests
- PATCH /api/ambulance-requests/{id}/status — clinic staff only, updates request status
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import Ambulance, AmbulanceRequest, User
from ..schemas import (
    AmbulanceNearbyOut,
    AmbulanceRequestCreate,
    AmbulanceRequestOut,
    AmbulanceRequestUpdateStatus,
)
from .blood_routes import haversine_distance

router = APIRouter(prefix="/ambulance-requests", tags=["ambulance"])
ambulances_router = APIRouter(prefix="/ambulances", tags=["ambulances"])

VALID_AMBULANCE_STATUSES = {"requested", "dispatched", "arrived", "cancelled"}


@router.post("", response_model=AmbulanceRequestOut, status_code=status.HTTP_201_CREATED)
def submit_ambulance_request(
    request_in: AmbulanceRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Patient submits an emergency ambulance SOS request."""
    amb_request = AmbulanceRequest(
        patient_id=current_user.id,
        pickup_location=request_in.pickup_location.strip(),
        latitude=request_in.latitude,
        longitude=request_in.longitude,
        status="requested",
    )
    db.add(amb_request)
    db.commit()
    db.refresh(amb_request)
    return amb_request


@router.get("/mine", response_model=List[AmbulanceRequestOut])
def get_my_ambulance_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Patient tracks their own ambulance requests, ordered newest first."""
    requests = (
        db.query(AmbulanceRequest)
        .filter(AmbulanceRequest.patient_id == current_user.id)
        .order_by(AmbulanceRequest.created_at.desc())
        .all()
    )
    return requests


@router.get("", response_model=List[AmbulanceRequestOut])
def get_all_ambulance_requests(
    active_only: bool = Query(False, description="Filter for active requests only (requested or dispatched)"),
    current_staff: User = Depends(require_role("clinic_staff")),
    db: Session = Depends(get_db),
):
    """Clinic staff only: views ambulance requests."""
    query = db.query(AmbulanceRequest)
    if active_only:
        query = query.filter(AmbulanceRequest.status.in_(["requested", "dispatched"]))
    requests = query.order_by(AmbulanceRequest.created_at.desc()).all()
    return requests


@router.patch("/{request_id}/status", response_model=AmbulanceRequestOut)
def update_ambulance_request_status(
    request_id: int,
    status_update: AmbulanceRequestUpdateStatus,
    current_staff: User = Depends(require_role("clinic_staff")),
    db: Session = Depends(get_db),
):
    """Clinic staff only: updates ambulance dispatch status."""
    new_status = status_update.status.strip().lower()
    if new_status not in VALID_AMBULANCE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{status_update.status}'. Allowed: {', '.join(sorted(VALID_AMBULANCE_STATUSES))}",
        )

    amb_request = db.query(AmbulanceRequest).filter(AmbulanceRequest.id == request_id).first()
    if not amb_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ambulance request not found",
        )

    amb_request.status = new_status
    db.commit()
    db.refresh(amb_request)
    return amb_request


@ambulances_router.get("/nearby", response_model=List[AmbulanceNearbyOut])
@router.get("/nearby", response_model=List[AmbulanceNearbyOut])
def get_nearby_ambulances(
    lat: float = Query(..., description="Latitude of user"),
    lon: float = Query(..., description="Longitude of user"),
    db: Session = Depends(get_db),
):
    """Returns currently available ambulances sorted by proximity using Haversine distance."""
    ambulances = db.query(Ambulance).filter(Ambulance.is_available == True).all()
    results = []
    for amb in ambulances:
        dist = haversine_distance(lat, lon, amb.latitude, amb.longitude)
        results.append({
            "id": amb.id,
            "name": amb.name,
            "latitude": amb.latitude,
            "longitude": amb.longitude,
            "is_available": amb.is_available,
            "distance_km": dist,
        })
    results.sort(key=lambda x: x["distance_km"])
    return results
