import sys
import traceback
try:
    import database
    database.create_tables()
    import seed_data
    seed_data.seed()
    print("SUCCESS")
except Exception:
    traceback.print_exc()
