#
# Raspberry Pi Room Monitor Dashboard
# -----------------------------------
# Year: 2025
# Author: Ethan Newton
# Prototype project. Free to use, modify, and distribute.
# No copyright claims. This project is intended to be open-source and freely licensed for personal use.
#

#!/bin/bash

USERNAME=$(whoami)


# ==== Apply permissions before running the app ====

SETTINGS_FILE="/home/$USERNAME/room_monitor/settings.json"

# Fix settings.json permissions
if [ -f "$SETTINGS_FILE" ]; then
    chmod 666 "$SETTINGS_FILE"
    echo "[INFO] File permissions applied: $SETTINGS_FILE → 666"
else
    echo "[WARNING] settings.json not found: $SETTINGS_FILE"
fi


# ==== Start the Python script ====

cd /home/$USERNAME/room_monitor
source venv/bin/activate
python dashboard.py
