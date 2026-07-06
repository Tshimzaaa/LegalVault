from sqlalchemy import text
from app.database.session import engine

try:
    with engine.connect() as connection:
        result = connection.execute(text("SELECT version();"))
        print(result.fetchone())

    print("\n----Database connection successful!---")

except Exception as e:
    print("\n---Database connection failed!---")
    print(e)