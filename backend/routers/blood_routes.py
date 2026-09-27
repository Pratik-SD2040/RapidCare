"""Emergency blood donor coordination routes and compatibility matching engine:
- POST /api/blood-requests — submit a blood requirement
- GET /api/blood-requests/{id}/matches — returns ranked compatible donors
- GET /api/blood-requests — clinic staff only, views all open requests
"""
import math
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import BloodRequest, Donor, User
from ..schemas import (
    BloodRequestCreate,
    BloodRequestOut,
    BloodRequestUpdateStatus,
    CompatibleDonorOut,
    DonorCreate,
    DonorOut,
)

router = APIRouter(prefix="/blood-requests", tags=["blood"])
donors_router = APIRouter(prefix="/donors", tags=["donors"])


# ============================================================================
# 1. Blood-Type Compatibility Matrix
# ============================================================================
# Key: Recipient Blood Group (blood_group_needed)
# Value: List of Donor Blood Groups that can safely donate Red Blood Cells (RBC)
BLOOD_COMPATIBILITY = {
    "O-": ["O-"],
    "O+": ["O+", "O-"],
    "A-": ["A-", "O-"],
    "A+": ["A+", "A-", "O+", "O-"],
    "B-": ["B-", "O-"],
    "B+": ["B+", "B-", "O+", "O-"],
    "AB-": ["AB-", "A-", "B-", "O-"],
    "AB+": ["AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"],
}


# ============================================================================
# 2. Haversine Distance Function (Pure Python)
# ============================================================================

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on Earth in kilometers.
    Uses decimal degrees for coordinates.
    """
    earth_radius_km = 6371.0

    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)

    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(d_lon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    distance = earth_radius_km * c
    return round(distance, 2)


# ============================================================================
# 3. Compatible Donor Finder & Ranking Engine
# ============================================================================

def find_compatible_donors(
    blood_group_needed: str,
    lat: float,
    lon: float,
    db: Session,
) -> List[CompatibleDonorOut]:
    """Finds all available donors whose blood group is compatible with the recipient,
    calculates the distance from the request coordinates to each donor,
    and returns them sorted by distance ascending.
    """
    normalized_group = blood_group_needed.strip().upper()
    compatible_groups = BLOOD_COMPATIBILITY.get(normalized_group)

    if not compatible_groups:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown blood group '{blood_group_needed}'. Valid groups: {', '.join(sorted(BLOOD_COMPATIBILITY.keys()))}",
        )

    # Filter Donor records where is_available=True and blood group is compatible
    donors = (
        db.query(Donor)
        .filter(Donor.is_available.is_(True))
        .filter(Donor.blood_group.in_(compatible_groups))
        .all()
    )

    ranked_donors = []
    for donor in donors:
        distance = haversine_distance(lat, lon, donor.latitude, donor.longitude)
        ranked_donors.append(
            CompatibleDonorOut(
                id=donor.id,
                name=donor.name,
                blood_group=donor.blood_group,
                phone=donor.phone,
                latitude=donor.latitude,
                longitude=donor.longitude,
                is_available=donor.is_available,
                distance_km=distance,
            )
        )

    # Sort ascending by distance (closest first)
    ranked_donors.sort(key=lambda d: d.distance_km)
    return ranked_donors


# ============================================================================
# Blood Request Endpoints
# ============================================================================

@router.post("", response_model=BloodRequestOut, status_code=status.HTTP_201_CREATED)
def submit_blood_request(
    request_in: BloodRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit an urgent or normal blood requirement."""
    normalized_group = request_in.blood_group_needed.strip().upper()
    if normalized_group not in BLOOD_COMPATIBILITY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid blood group '{request_in.blood_group_needed}'. Valid: {', '.join(sorted(BLOOD_COMPATIBILITY.keys()))}",
        )

    blood_req = BloodRequest(
        requester_id=current_user.id,
        blood_group_needed=normalized_group,
        location=request_in.location.strip(),
        latitude=request_in.latitude,
        longitude=request_in.longitude,
        urgency=request_in.urgency.strip().lower() if request_in.urgency else "normal",
        status="open",
    )
    db.add(blood_req)
    db.commit()
    db.refresh(blood_req)
    return blood_req


@router.get("/mine", response_model=List[BloodRequestOut])
def get_my_blood_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Patient views their own submitted blood requests."""
    return (
        db.query(BloodRequest)
        .filter(BloodRequest.requester_id == current_user.id)
        .order_by(BloodRequest.created_at.desc())
        .all()
    )


@router.get("/{request_id}/matches", response_model=List[CompatibleDonorOut])
def get_compatible_donor_matches(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns ranked compatible donors for a specific blood request,
    sorted by distance ascending with distance_km included.
    """
    blood_req = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
    if not blood_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blood request not found",
        )

    matches = find_compatible_donors(
        blood_group_needed=blood_req.blood_group_needed,
        lat=blood_req.latitude,
        lon=blood_req.longitude,
        db=db,
    )
    return matches


@router.get("", response_model=List[BloodRequestOut])
def get_all_blood_requests(
    open_only: bool = Query(True, description="Filter for open requests only"),
    current_staff: User = Depends(require_role("clinic_staff")),
    db: Session = Depends(get_db),
):
    """Clinic staff only: views blood requests."""
    query = db.query(BloodRequest)
    if open_only:
        query = query.filter(BloodRequest.status == "open")
    return query.order_by(BloodRequest.created_at.desc()).all()


@router.patch("/{request_id}/status", response_model=BloodRequestOut)
def update_blood_request_status(
    request_id: int,
    status_update: BloodRequestUpdateStatus,
    current_staff: User = Depends(require_role("clinic_staff")),
    db: Session = Depends(get_db),
):
    """Clinic staff only: mark request as fulfilled or open."""
    new_status = status_update.status.strip().lower()
    if new_status not in {"open", "fulfilled"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status. Allowed: 'open', 'fulfilled'",
        )

    blood_req = db.query(BloodRequest).filter(BloodRequest.id == request_id).first()
    if not blood_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blood request not found",
        )

    blood_req.status = new_status
    db.commit()
    db.refresh(blood_req)
    return blood_req


# ============================================================================
# Donor Management Helper Endpoints
# ============================================================================

@donors_router.post("", response_model=DonorOut, status_code=status.HTTP_201_CREATED)
def create_donor(
    donor_in: DonorCreate,
    current_staff: User = Depends(require_role("clinic_staff")),
    db: Session = Depends(get_db),
):
    """Clinic staff only: register a new blood donor."""
    normalized_group = donor_in.blood_group.strip().upper()
    if normalized_group not in BLOOD_COMPATIBILITY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid blood group '{donor_in.blood_group}'",
        )

    donor = Donor(
        name=donor_in.name.strip(),
        blood_group=normalized_group,
        phone=donor_in.phone.strip(),
        latitude=donor_in.latitude,
        longitude=donor_in.longitude,
        is_available=donor_in.is_available,
    )
    db.add(donor)
    db.commit()
    db.refresh(donor)
    return donor


@donors_router.get("", response_model=List[DonorOut])
def list_donors(
    blood_group: Optional[str] = None,
    available_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List registered donors with optional blood group filter."""
    query = db.query(Donor)
    if available_only:
        query = query.filter(Donor.is_available.is_(True))
    if blood_group:
        query = query.filter(Donor.blood_group == blood_group.strip().upper())
    return query.all()
