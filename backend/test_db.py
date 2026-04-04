from app.core.config import settings
from app.db.session import engine
from sqlalchemy import inspect, text

print("📋 DATABASE URL:", settings.database_url)
print()

try:
    # Test connexion
    with engine.connect() as conn:
        print("✅ Connexion à la DB réussie")
        
        # Vérifie les tables
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"✅ Tables dans la DB: {tables}")
        
        # Count users
        result = conn.execute(text("SELECT COUNT(*) FROM users;"))
        count = result.scalar()
        print(f"✅ Nombre d'utilisateurs: {count}")
        
except Exception as e:
    print(f"❌ Erreur: {type(e).__name__}: {e}")