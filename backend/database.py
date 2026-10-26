import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # On Vercel or any Linux container, /tmp is the only guaranteed writable directory
    if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME") or os.path.exists("/tmp"):
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
            try:
                os.makedirs(parent, exist_ok=True)
            except Exception:
                pass

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

_tables_initialized = False


def ensure_tables():
    global _tables_initialized
    if not _tables_initialized:
        try:
            Base.metadata.create_all(bind=engine)
            _tables_initialized = True
        except Exception as e:
            print(f"Notice ensuring tables: {e}")


def get_db():
    ensure_tables()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

