"""Pydantic schemas for request and response validation.
Compatible with both Pydantic v1 and v2.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ============================================================================
# Auth & Token Schemas
# ============================================================================

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    status: str
    user_id: int
    name: str


class TokenData(BaseModel):
    user_id: Optional[int] = None
    role: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


# ============================================================================
# User Schemas
# ============================================================================

class UserBase(BaseModel):
    name: str
    email: str
    phone: str
    blood_group: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class PatientRegister(BaseModel):
    name: str
    email: str
    phone: str
    password: str
    blood_group: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ClinicRegister(BaseModel):
    name: str
    email: str
    phone: str
    password: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class UserCreate(UserBase):
    password: str
    role: str = "patient"
    status: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    blood_group: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: Optional[str] = None


class UserOut(UserBase):
    id: int
    role: str
    status: str
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


class PatientListItemOut(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    blood_group: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True


# ============================================================================
# Appointment Schemas
# ============================================================================

class AppointmentCreate(BaseModel):
    reason: str
    requested_date: datetime


class AppointmentUpdateStatus(BaseModel):
    status: str  # requested, confirmed, completed, no_show


class AppointmentOut(BaseModel):
    id: int
    patient_id: int
    reason: str
    requested_date: datetime
    status: str
    created_at: datetime
    patient: Optional[UserOut] = None

    class Config:
        orm_mode = True
        from_attributes = True


# ============================================================================
# Ambulance Request Schemas
# ============================================================================

class AmbulanceRequestCreate(BaseModel):
    pickup_location: str
    latitude: float
    longitude: float


class AmbulanceRequestUpdateStatus(BaseModel):
    status: str  # requested, dispatched, arrived, cancelled


class AmbulanceRequestOut(BaseModel):
    id: int
    patient_id: int
    pickup_location: str
    latitude: float
    longitude: float
    status: str
    created_at: datetime
    patient: Optional[UserOut] = None

    class Config:
        orm_mode = True
        from_attributes = True


# ============================================================================
# Ambulance Schemas
# ============================================================================

class AmbulanceCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    is_available: bool = True


class AmbulanceUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_available: Optional[bool] = None


class AmbulanceOut(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    is_available: bool

    class Config:
        orm_mode = True
        from_attributes = True


class AmbulanceNearbyOut(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    is_available: bool
    distance_km: float

    class Config:
        orm_mode = True
        from_attributes = True


# ============================================================================
# Blood Request Schemas
# ============================================================================

class BloodRequestCreate(BaseModel):
    blood_group_needed: str
    location: str
    latitude: float
    longitude: float
    urgency: str = "normal"  # normal, urgent


class BloodRequestUpdateStatus(BaseModel):
    status: str  # open, fulfilled


class BloodRequestOut(BaseModel):
    id: int
    requester_id: int
    blood_group_needed: str
    location: str
    latitude: float
    longitude: float
    urgency: str
    status: str
    created_at: datetime
    requester: Optional[UserOut] = None

    class Config:
        orm_mode = True
        from_attributes = True


# ============================================================================
# Donor Schemas
# ============================================================================

class DonorCreate(BaseModel):
    name: str
    blood_group: str
    phone: str
    latitude: float
    longitude: float
    is_available: bool = True


class DonorUpdate(BaseModel):
    name: Optional[str] = None
    blood_group: Optional[str] = None
    phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_available: Optional[bool] = None


class DonorOut(BaseModel):
    id: int
    name: str
    blood_group: str
    phone: str
    latitude: float
    longitude: float
    is_available: bool

    class Config:
        orm_mode = True
        from_attributes = True


class CompatibleDonorOut(BaseModel):
    id: int
    name: str
    blood_group: str
    phone: str
    latitude: float
    longitude: float
    is_available: bool
    distance_km: float

    class Config:
        orm_mode = True
        from_attributes = True
