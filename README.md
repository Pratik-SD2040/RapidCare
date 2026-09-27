# RapidCare

> **A calm, modern clinic appointment, patient, and emergency coordination web application for community healthcare.**

---

### Real-World Problem Solved

Small and neighborhood medical clinics often struggle with fragmented administrative workflows:
- Long physical waiting lines and disorganized appointment queues.
- Chaotic manual phone trees during critical emergencies where seconds count.
- Inefficient, panicked manual searches for compatible blood donors during trauma or urgent surgeries.

**RapidCare** bridges this gap by providing an intuitive, unified platform that allows clinics to manage appointment queues digitally, lets patients trigger location-aware emergency ambulance dispatch with a single tap, and matches patients to compatible blood donors using distance-ranked medical transfusion logic.

> [!IMPORTANT]
> **Administrative Scope Notice**: RapidCare is strictly an administrative and emergency logistics coordination system. It does **NOT** provide medical diagnosis, prescription advice, or automated treatment recommendations.

---

### Key Features

1. **Digital Clinic Appointments**:
   - Patients can schedule consultations with reason and preferred date/time.
   - Clinics view schedules in real time and manage statuses (`Requested`, `Confirmed`, `Completed`, `No Show`).
2. **Emergency Ambulance SOS Dispatch**:
   - One-tap SOS button featuring a gentle pulse animation.
   - Captures GPS coordinates automatically (with manual address fallback).
   - Real-time status tracking for patients (`Requested` ➔ `Dispatched` ➔ `Arrived`).
   - Clinic dispatch controls for immediate operational coordination.
3. **Intelligent Blood Donor Compatibility Engine**:
   - Implements standard Red Blood Cell (RBC) compatibility matrices (e.g. `O-` universal donor, `AB+` universal recipient).
   - Calculates geographic proximity using the spherical Haversine formula (pure Python, zero external API latency).
   - Delivers distance-ranked donor cards with direct contact access.
4. **Verified Provider Registration & RBAC**:
   - Role-based access control (`patient` vs `clinic_staff`).
   - Newly registered clinics start in `pending_verification` status and cannot access staff tools until verified.
   - Seeded pre-approved demo accounts for frictionless evaluation.
5. **Calm, Human-Centric UI**:
   - Serene wellness/fintech aesthetic (soft ambient lighting, layered shadows, beveled materiality).
   - Zero aggressive hospital stereotypes or flashing alarms.

---

### Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy 2.0, SQLite
- **Authentication**: JWT tokens (`python-jose`), Bcrypt password hashing
- **Frontend**: Plain HTML5, CSS3 Custom Properties (Design System), Vanilla JavaScript (No heavyweight frameworks)
- **Serving**: FastAPI serves the static frontend directly from a single container
- **Deployment**: Docker container configured for Google Cloud Run (Port `8080`)

---

### Demo Credentials

A seed script inserts pre-approved demo accounts for instant evaluation:

| Role | Email | Password | Status | Location |
|---|---|---|---|---|
| **Clinic Staff** | `clinic@rapidcare.demo` | `demo1234` | Approved | Pune, Maharashtra |
| **Patient** | `patient@rapidcare.demo` | `demo1234` | Approved | Pune, Maharashtra |

> *Tip: The landing page includes 1-click **Hackathon Demo Fill** buttons to autofill these credentials instantly.*

---

### Local Setup Instructions

#### 1. Clone & Navigate
```bash
git clone <repo-url>
cd rapidcare
```

#### 2. Install Dependencies
```bash
python -m pip install -r backend/requirements.txt
```

#### 3. Seed Demo Data
Populate the database with pre-approved clinic staff, sample donors, and ambulances:
```bash
python -m backend.seed
```

#### 4. Run the Application
Start the FastAPI server:
```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

#### 5. Open in Browser
- **Web App**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive API Docs (Swagger UI)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

### Docker Instructions

#### 1. Build the Docker Image
```bash
docker build -t rapidcare:latest .
```

#### 2. Run the Container Locally
Google Cloud Run maps to container port `8080`:
```bash
docker run -p 8080:8080 --name rapidcare-app rapidcare:latest
```
Access the application at [http://localhost:8080](http://localhost:8080).

---

### Project Structure

```
rapidcare/
├── backend/
│   ├── main.py                  # App entry point, CORS, routers & static mount
│   ├── database.py              # SQLite engine & SessionLocal generator
│   ├── models.py                # User, Appointment, Ambulance, Blood models
│   ├── schemas.py               # Pydantic request/response validation
│   ├── auth.py                  # JWT, Bcrypt hashing, & role guard dependencies
│   ├── seed.py                  # Standalone database seeder (Pune coordinates)
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth_routes.py        # /api/register, /api/login, /api/me
│   │   ├── appointment_routes.py # /api/appointments, /mine, /{id}/status
│   │   ├── ambulance_routes.py   # /api/ambulance-requests, /mine, /{id}/status
│   │   └── blood_routes.py       # /api/blood-requests, /matches, /donors
│   └── requirements.txt
├── frontend/
│   ├── index.html               # Landing page with embedded sign-in & demo chips
│   ├── register.html            # Patient self-registration form
│   ├── register-clinic.html     # Clinic provider registration (verification notice)
│   ├── patient-dashboard.html   # Appointments, SOS pulse button, blood matching
│   ├── clinic-dashboard.html    # Staff queue, live dispatch, and blood tracking
│   ├── css/
│   │   └── style.css            # Calm design system with layered shadows & bevels
│   └── js/
│       ├── api.js               # Centralized fetch wrapper & JWT header injector
│       ├── auth.js              # Login, registration, & page guard controllers
│       ├── patient.js           # Patient dashboard business logic
│       └── clinic.js            # Clinic staff operations controller
├── Dockerfile                   # Cloud Run container configuration
├── .gitignore                   # Excludes venv, db, pycache, env
└── README.md
```
