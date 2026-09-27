"""Database seed script for RapidCare:
- Creates all DB tables if they do not exist
- Inserts one approved super_admin account (admin@rapidcare.demo / admin1234)
- Inserts one approved clinic_staff account (clinic@rapidcare.demo / demo1234)
- Inserts one approved patient account (patient@rapidcare.demo / demo1234)
- Inserts 6 Donor records across different blood groups near Pune (18.5204, 73.8567)
- Inserts 4 Ambulance records spread around Pune, all is_available=True
- Skips insertion if accounts already exist (safe to re-run)
"""
import random
from .auth import get_password_hash
from .database import Base, SessionLocal, engine
from .models import Ambulance, Donor, User

# Base coordinates for Pune, Maharashtra
PUNE_LAT = 18.5204
PUNE_LON = 73.8567


def seed_database():
    """Seed the database with initial demo data."""
    # 1. Create tables if they do not exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check and seed super_admin
        existing_admin = db.query(User).filter(User.email == "admin@rapidcare.demo").first()
        if not existing_admin:
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
            print("[OK] Created Super Admin account: admin@rapidcare.demo")

        # Check if demo clinic already exists (safe to re-run)
        existing_clinic = db.query(User).filter(User.email == "clinic@rapidcare.demo").first()
        if existing_clinic:
            print("[INFO] Demo clinic account already exists. Skipping clinic/donor seed insertion.")
            print("============================================================")
            print("Demo Super Admin Credentials:")
            print("  Email:    admin@rapidcare.demo")
            print("  Password: admin1234")
            print("  Role:     super_admin (Status: approved)")
            print("------------------------------------------------------------")
            print("Existing Demo Clinic Credentials:")
            print("  Email:    clinic@rapidcare.demo")
            print("  Password: demo1234")
            print("  Role:     clinic_staff (Status: approved)")
            print("============================================================")
            return

        print("[...] Seeding RapidCare database...")

        # 2. Insert Approved Clinic Staff
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

        # 3. Optional: Demo Patient for immediate testing
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

        print("[OK] Database seeded successfully!")
        print("============================================================")
        print("Demo Super Admin Credentials:")
        print("  Email:    admin@rapidcare.demo")
        print("  Password: admin1234")
        print("  Role:     super_admin (Status: approved)")
        print("------------------------------------------------------------")
        print("Demo Clinic Staff Credentials:")
        print("  Email:    clinic@rapidcare.demo")
        print("  Password: demo1234")
        print("  Role:     clinic_staff (approved)")
        print(f"  Base Loc: Pune ({PUNE_LAT}, {PUNE_LON})")
        print("------------------------------------------------------------")
        print("Demo Patient Credentials:")
        print("  Email:    patient@rapidcare.demo")
        print("  Password: demo1234")
        print("  Role:     patient (approved)")
        print("------------------------------------------------------------")
        print(f"Seeded {len(donors)} Donors (O-, O+, A+, A-, B+, AB+) all available.")
        print(f"Seeded {len(ambulances)} Ambulances all available.")
        print("============================================================")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to seed database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
