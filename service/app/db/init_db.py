from app.db import models  # noqa: F401
from app.db.seed import init_database
from app.db.session import Base, SessionLocal, engine


def setup_database() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        init_database(db)
    finally:
        db.close()
