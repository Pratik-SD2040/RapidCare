"""RapidCare FastAPI Application:
- Includes routers with '/api' prefix
- Enables CORS for local development
- Mounts frontend/ as static files (html=True, mounted at '/')
- Lifespan startup check: seeds initial data ONLY if no clinic_staff user exists
"""
from contextlib import asynccontextmanager
from pathlib import Path
import random

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .auth import get_password_hash
from .database import Base, SessionLocal, engine
from .models import Ambulance, Donor, User
from .routers import (
    admin_router,
    ambulance_router,
    ambulances_router,
    appointment_router,
    auth_router,
    blood_router,
    donors_router,
)

# Base coordinates for Pune, Maharashtra
PUNE_LAT = 18.5204
PUNE_LON = 73.8567


def seed_initial_data_if_empty():
    """Check if any User with role='clinic_staff' exists.
    If none exists, seed the demo clinic account, demo patient, donors, and ambulances.
    Also ensures the demo super_admin account exists.
    """
    # Ensure database schema is created
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Ensure super_admin account exists
        admin_exists = db.query(User).filter(User.role == "super_admin").first()
        if not admin_exists:
            admin_user = User(
                name="System Administrator",
                email="admin@rapidcare.demo",
                phone="+91-9876543200",
                password_hash=get_password_hash("admin1234"),
                role="super_admin",
                status="approved",
                blood_group=None,
                latitude=PUNE_LAT,
                longitude=PUNE_LON,
            )
            db.add(admin_user)
            db.commit()
            print("[OK] Startup check: Seeded Super Admin: admin@rapidcare.demo / admin1234")

        # 1. Check if any clinic_staff user exists
        clinic_exists = db.query(User).filter(User.role == "clinic_staff").first()
        if clinic_exists:
            print("[INFO] Startup check: clinic_staff user already exists. Skipping data seeding.")
            return

        print("[...] Startup check: No clinic_staff user found. Seeding initial demo data...")

        # 2. Insert Approved Clinic Staff account
        clinic_user = User(
            name="Pune Central Clinic",
            email="clinic@rapidcare.demo",
            phone="+91-9876543210",
            password_hash=get_password_hash("demo1234"),
            role="clinic_staff",
            status="approved",
            blood_group=None,
            latitude=PUNE_LAT,
            longitude=PUNE_LON,
        )
        db.add(clinic_user)

        # 3. Insert Demo Patient account for immediate testing
        patient_user = User(
            name="Rahul Verma",
            email="patient@rapidcare.demo",
            phone="+91-9876543211",
            password_hash=get_password_hash("demo1234"),
            role="patient",
            status="approved",
            blood_group="B+",
            latitude=round(PUNE_LAT + 0.005, 4),
            longitude=round(PUNE_LON + 0.005, 4),
        )
        db.add(patient_user)

        # 4. Insert 6 Donors across different blood groups near Pune
        donor_specs = [
            ("Aarav Sharma", "O-", "+91-9820011221", 0.0110, -0.0121),   # Shivaji Nagar
            ("Neha Patil", "O+", "+91-9820011222", -0.0130, -0.0490),   # Kothrud
            ("Rohan Deshmukh", "A+", "+91-9820011223", 0.0158, 0.0373),  # Koregaon Park
            ("Pooja Kulkarni", "A-", "+91-9820011224", -0.0186, 0.0069), # Swargate
            ("Vikram Joshi", "B+", "+91-9820011225", 0.0475, 0.0576),   # Viman Nagar
            ("Sneha Shinde", "AB+", "+91-9820011226", -0.0115, 0.0693), # Hadapsar
        ]
        donors = []
        for name, bg, phone, d_lat, d_lon in donor_specs:
            lat = round(PUNE_LAT + d_lat + random.uniform(-0.002, 0.002), 4)
            lon = round(PUNE_LON + d_lon + random.uniform(-0.002, 0.002), 4)
            donors.append(
                Donor(
                    name=name,
                    blood_group=bg,
                    phone=phone,
                    latitude=lat,
                    longitude=lon,
                    is_available=True,
                )
            )
        db.add_all(donors)

        # 5. Insert 4 Ambulances spread near Pune, all is_available=True
        ambulance_specs = [
            ("Ambulance Alpha (Shivaji Nagar)", 0.0076, -0.0067),
            ("Ambulance Bravo (Kothrud)", -0.0154, -0.0417),
            ("Ambulance Charlie (Camp / Station)", -0.0014, 0.0183),
            ("Ambulance Delta (Kalyani Nagar)", 0.0256, 0.0453),
        ]
        ambulances = []
        for name, d_lat, d_lon in ambulance_specs:
            lat = round(PUNE_LAT + d_lat + random.uniform(-0.001, 0.001), 4)
            lon = round(PUNE_LON + d_lon + random.uniform(-0.001, 0.001), 4)
            ambulances.append(
                Ambulance(
                    name=name,
                    latitude=lat,
                    longitude=lon,
                    is_available=True,
                )
            )
        db.add_all(ambulances)

        db.commit()
        print(f"[OK] Startup seeding complete: 1 clinic staff, 1 patient, {len(donors)} donors, {len(ambulances)} ambulances.")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Startup seeding failed: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI Lifespan handler: automatically runs startup seeding check."""
    # Ensure tables exist and seed demo data if database is empty of clinic_staff
    seed_initial_data_if_empty()
    yield


app = FastAPI(
    title="RapidCare API",
    version="1.0.0",
    description="RapidCare Clinic Appointment, Patient, and Emergency Coordination API",
    lifespan=lifespan,
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers with "/api" prefix
app.include_router(admin_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(appointment_router, prefix="/api")
app.include_router(ambulance_router, prefix="/api")
app.include_router(ambulances_router, prefix="/api")
app.include_router(blood_router, prefix="/api")
app.include_router(donors_router, prefix="/api")

# Mount frontend/ folder as static files (StaticFiles with html=True, mounted at "/")
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
