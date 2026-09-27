"""SQLAlchemy database models for RapidCare:
- User (patient / clinic_staff)
- Appointment
- AmbulanceRequest
- Ambulance
- BloodRequest
- Donor
"""
from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    phone = Column(String(25), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False)  # "patient", "clinic_staff", or "super_admin"
    status = Column(String(30), nullable=False, default="approved")  # "approved" or "pending_verification"
    blood_group = Column(String(10), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")
    ambulance_requests = relationship("AmbulanceRequest", back_populates="patient", cascade="all, delete-orphan")
    blood_requests = relationship("BloodRequest", back_populates="requester", cascade="all, delete-orphan")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)
    requested_date = Column(DateTime, nullable=False)
    status = Column(String(30), nullable=False, default="requested")  # requested, confirmed, completed, no_show
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship
    patient = relationship("User", back_populates="appointments")


class AmbulanceRequest(Base):
    __tablename__ = "ambulance_requests"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pickup_location = Column(Text, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    status = Column(String(30), nullable=False, default="requested")  # requested, dispatched, arrived, cancelled
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship
    patient = relationship("User", back_populates="ambulance_requests")


class Ambulance(Base):
    __tablename__ = "ambulances"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)


class BloodRequest(Base):
    __tablename__ = "blood_requests"

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    blood_group_needed = Column(String(10), nullable=False)
    location = Column(Text, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    urgency = Column(String(20), nullable=False, default="normal")  # normal, urgent
    status = Column(String(20), nullable=False, default="open")  # open, fulfilled
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship
    requester = relationship("User", back_populates="blood_requests")


class Donor(Base):
    __tablename__ = "donors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    blood_group = Column(String(10), nullable=False)
    phone = Column(String(25), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
