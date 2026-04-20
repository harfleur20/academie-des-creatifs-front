from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.entities import UserRecord

USER_SEED = [
    {
        "full_name": "Francis Kenne",
        "email": "francis@academiedescreatifs.com",
        "phone": "+237680000001",
        "password_hash": hash_password("Admin123!"),
        "role": "admin",
        "status": "active",
    },
    {
        "full_name": "Bihee Alex",
        "email": "alex@academiedescreatifs.com",
        "phone": "+237680000002",
        "password_hash": hash_password("Teacher123!"),
        "role": "teacher",
        "status": "active",
    },
    {
        "full_name": "Melvine Possi",
        "email": "melvine@example.com",
        "phone": "+237680000003",
        "password_hash": hash_password("Student123!"),
        "role": "student",
        "status": "active",
    },
    {
        "full_name": "Loic Djitouo",
        "email": "loic@example.com",
        "phone": "+237680000004",
        "password_hash": hash_password("Student123!"),
        "role": "student",
        "status": "active",
    },
]

def _table_has_rows(db: Session, model: type[object]) -> bool:
    return db.scalar(select(model).limit(1)) is not None


def seed_database(db: Session) -> None:
    if not _table_has_rows(db, UserRecord):
        db.add_all(UserRecord(**item) for item in USER_SEED)
    else:
        users_by_email = {
            user.email: user for user in db.scalars(select(UserRecord)).all()
        }
        for item in USER_SEED:
            existing_user = users_by_email.get(item["email"])
            if existing_user is None:
                db.add(UserRecord(**item))
                continue

            if not existing_user.phone:
                existing_user.phone = item["phone"]

            if not existing_user.password_hash:
                existing_user.password_hash = item["password_hash"]

            if not existing_user.role:
                existing_user.role = item["role"]

            if not existing_user.status:
                existing_user.status = item["status"]

            db.add(existing_user)

    db.commit()
