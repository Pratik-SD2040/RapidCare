"""RapidCare API Routers:
- auth_router
- appointment_router
- ambulance_router
- blood_router
- donors_router
"""
from .admin_routes import router as admin_router
from .ambulance_routes import ambulances_router, router as ambulance_router
from .appointment_routes import router as appointment_router
from .auth_routes import router as auth_router
from .blood_routes import donors_router, router as blood_router

__all__ = [
    "admin_router",
    "auth_router",
    "appointment_router",
    "ambulance_router",
    "ambulances_router",
    "blood_router",
    "donors_router",
]
