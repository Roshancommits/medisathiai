import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    if os.getenv("VERCEL"):
        # Vercel serverless functions run on Linux where /tmp is the only writable directory
        DATABASE_URL = "sqlite:////tmp/medisathi.db"
    else:
        DATABASE_URL = "sqlite:///./medisathi.db"

# Extra safety for SQLite connection arguments
connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args = {"check_same_thread": False}
    # Ensure parent dir exists if needed
    if DATABASE_URL.startswith("sqlite:////"):
        file_path = DATABASE_URL[len("sqlite:///"):]
        parent = os.path.dirname(file_path)
        if parent and not os.path.exists(parent):
            os.makedirs(parent, exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
