"""Constants and fictitious data pools for the synthetic fleet.

All names, plates, and phone numbers below are generated/fictitious —
see the root README's "synthetic data" note.
"""

# Base cities with approximate coordinates. Every city hosts the same generic
# mix of rental vehicles — no business-type distinction between cities.
CITIES = {
    "Santiago": (-33.4489, -70.6693),
    "Antofagasta": (-23.6509, -70.3975),
    "Calama": (-22.4667, -68.9333),
    "Concepción": (-36.8201, -73.0444),
    "Puerto Montt": (-41.4693, -72.9424),
    "Temuco": (-38.7359, -72.5904),
    "Punta Arenas": (-53.1638, -70.9171),
    "Puerto Natales": (-51.7236, -72.4875),
}

# Vehicles are scattered within this radius (degrees, ~roughly 5-8 km) of their
# base city's coordinates — illustrative only, not a real geofence.
CITY_RADIUS_DEGREES = 0.06

VEHICLE_MODELS = [
    "Toyota Yaris",
    "Hyundai Accent",
    "Chevrolet Sail",
    "Kia Rio",
    "Nissan Versa",
    "Suzuki Baleno",
    "Toyota Hilux",
    "Ford Ranger",
    "Chevrolet D-Max",
    "Nissan Navara",
    "Mitsubishi L200",
    "Mazda BT-50",
]

STATUSES = ["available", "rented", "maintenance"]

# Fictitious given/family names for generating driver names — no relation to
# real people.
FIRST_NAMES = [
    "Javiera", "Matías", "Camila", "Sebastián", "Valentina", "Diego",
    "Fernanda", "Nicolás", "Constanza", "Tomás", "Antonia", "Benjamín",
    "Josefa", "Vicente", "Florencia", "Ignacio", "Isidora", "Gabriel",
    "Trinidad", "Cristóbal",
]
LAST_NAMES = [
    "González", "Muñoz", "Rojas", "Díaz", "Pérez", "Soto", "Contreras",
    "Silva", "Martínez", "Sepúlveda", "Morales", "Rodríguez", "López",
    "Fuentes", "Hernández", "Torres", "Araya", "Flores", "Espinoza", "Reyes",
]

PLATE_LETTERS = "BCDFGHJKLPRSTVWXYZ"

MAINTENANCE_ALERT_TYPES = [
    ("Scheduled maintenance overdue", "high"),
    ("Oil change pending", "medium"),
    ("Worn tires", "medium"),
    ("Vehicle inspection expiring soon", "low"),
    ("Critical fuel/battery level", "high"),
    ("Brake pad replacement", "medium"),
]

NOTIFICATION_MESSAGES = {
    "overspeed": "Vehicle {plate} exceeded 120 km/h ({speed:.0f} km/h recorded). Please observe posted limits.",
    "hard_brake": "Vehicle {plate} recorded a hard braking event (speed dropped from {prev_speed:.0f} to {speed:.0f} km/h).",
    "maintenance_due_soon": "Vehicle {plate}: '{alert_type}' is due on {due_date}. Please schedule service soon.",
    "maintenance_overdue": "Vehicle {plate}: '{alert_type}' was due on {due_date} and is now overdue.",
    "gps_offline": "Vehicle {plate} has stopped transmitting its GPS location.",
}
