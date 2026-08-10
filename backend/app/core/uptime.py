from datetime import datetime, UTC

# Set once, at process import time — used to report how long this backend
# process has been running (no historical uptime tracking exists beyond that).
STARTED_AT = datetime.now(UTC)
