# RapidCare

A calm, modern clinic appointment, patient, and emergency coordination web application for community healthcare. Built solo for **FIT FEST 2026 Hackathon** at Flora Institute of Technology.

## Live Demo

🌐 **https://rapidcare-939362608174.asia-south1.run.app**

💻 **Source:** https://github.com/Pratik-SD2040/RapidCare

## Real-World Problem Solved

Small and neighborhood medical clinics often struggle with fragmented administrative workflows:

- Long physical waiting lines and disorganized appointment queues.
- Chaotic manual phone trees during critical emergencies where seconds count.
- Inefficient, panicked manual searches for compatible blood donors during urgent situations.

RapidCare bridges this gap with a unified platform that lets clinics manage appointment queues digitally, lets patients trigger location-aware emergency ambulance requests with a single tap, and matches patients to compatible blood donors using distance-ranked compatibility logic.

> **Administrative Scope Notice:** RapidCare is strictly an administrative and emergency logistics coordination system. It does **NOT** provide medical diagnosis, prescription advice, or automated treatment recommendations.

## Key Features

### For Patients
- **Appointment booking** with reason and preferred date/time
- **Visit history** showing completed appointments separately from upcoming ones
- **Appointment reminder banner** for appointments within the next 24 hours
- **Emergency ambulance SOS**: one-tap button with a gentle pulse animation, automatic GPS capture (manual address fallback), and live status tracking (Requested ➔ Dispatched ➔ Arrived)
- **Nearby ambulance availability**, ranked by distance
- **Blood donor matching** with distance-ranked donor cards and direct contact details
- **Blood bank information** and **nearby hospitals/clinics** directory

### For Clinic Staff
- **Appointment management** with status updates (Requested, Confirmed, Completed, No Show)
- **Patient search** by name or email
- **Ambulance dispatch controls** to coordinate requests in real time
- **Blood request tracking**
- **Unified emergency overview** showing active ambulance and blood requests in one screen
- **Analytics cards**: today's appointments, pending appointments, active emergencies, open blood requests, registered patients

### Trust & Access Control
- **Three roles:** patient, clinic staff, and super admin
- New clinic registrations start as `pending_verification` and cannot log in until a **super admin approves them** from the admin dashboard
- JWT authentication with bcrypt password hashing

### Intelligent Blood Donor Compatibility Engine
- Implements the standard red blood cell (RBC) compatibility matrix (e.g. O- universal donor, AB+ universal recipient)
- Calculates proximity with the spherical Haversine formula (pure Python, no external API)
- Returns donors sorted by distance

### Calm, Human-Centric UI
- Wellness-app aesthetic: soft ambient lighting, layered shadows, beveled buttons
- Avoids stereotypical hospital red/green styling and aggressive flashing alarms

## Tech Stack

- **Backend:** Python 3.11, FastAPI, SQLAlchemy 2.0, SQLite
- **Authentication:** JWT (python-jose), bcrypt
- **Frontend:** HTML5, CSS3 custom properties (design system), vanilla JavaScript
- **Serving:** FastAPI serves the static frontend directly from a single container
- **Deployment:** Docker, Google Cloud Run (port 8080)

## Demo Credentials

Demo accounts are seeded automatically on first startup (locally and on Cloud Run).

| Role | Email | Password | Access |
|---|---|---|---|
| Super Admin | admin@rapidcare.demo | admin1234 | Approves pending clinic registrations |
| Clinic Staff | clinic@rapidcare.demo | demo1234 | Full clinic dashboard |
| Patient | patient@rapidcare.demo | demo1234 | Patient dashboard |

The landing page includes one-click **Hackathon Demo Fill** buttons to autofill credentials.

**To see the approval flow:** register a new clinic via "Register Your Clinic", log in as Super Admin, approve it from the admin dashboard, then log in as that clinic.

## Local Setup

```bash
git clone https://github.com/Pratik-SD2040/RapidCare.git
cd RapidCare
python -m pip install -r backend/requirements.txt
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Demo data seeds automatically on first startup. To seed manually instead: `python -m backend.seed`.

- Web app: http://127.0.0.1:8000
- Interactive API docs (Swagger UI): http://127.0.0.1:8000/docs

## Docker

```bash
docker build -t rapidcare:latest .
docker run -p 8080:8080 --name rapidcare-app rapidcare:latest
```

Then open http://localhost:8080.

## Deployment (Google Cloud Run)

```bash
gcloud run deploy rapidcare --source . --region asia-south1 --allow-unauthenticated
```

**Note:** The MVP uses SQLite for zero-setup simplicity. On Cloud Run the container filesystem is ephemeral, so data resets when the container restarts and demo accounts are re-seeded automatically. A production version would move to a managed database such as Cloud SQL (PostgreSQL).

## Project Structure

```
rapidcare/
├── backend/
│   ├── main.py                   # App entry, CORS, routers, static mount, startup seeding
│   ├── database.py               # SQLite engine & session
│   ├── models.py                 # User, Appointment, Ambulance, AmbulanceRequest, BloodRequest, Donor
│   ├── schemas.py                # Pydantic request/response schemas
│   ├── auth.py                   # JWT, bcrypt, role-guard dependencies
│   ├── seed.py                   # Standalone seeder (Pune coordinates)
│   ├── routers/
│   │   ├── auth_routes.py        # register, register-clinic, login, me
│   │   ├── appointment_routes.py
│   │   ├── ambulance_routes.py
│   │   ├── blood_routes.py       # requests, donor matching engine
│   │   └── admin_routes.py       # pending clinics, approval (super admin only)
│   └── requirements.txt
├── frontend/
│   ├── index.html                # Landing page + sign-in
│   ├── register.html             # Patient registration
│   ├── register-clinic.html      # Clinic registration (requires approval)
│   ├── patient-dashboard.html
│   ├── clinic-dashboard.html
│   ├── admin-dashboard.html      # Clinic approval interface
│   ├── css/style.css             # Design system
│   └── js/
│       ├── api.js                # Fetch wrapper with JWT injection
│       ├── auth.js               # Login, registration, role redirects
│       ├── patient.js
│       ├── clinic.js
│       └── admin.js
├── Dockerfile
├── .gitignore
└── README.md
```

## Acknowledgements

Built for FIT FEST 2026 by Flora Institute of Technology, in association with GDG FIT Pune. Developed with AI-assisted coding tools (Antigravity and Claude).
