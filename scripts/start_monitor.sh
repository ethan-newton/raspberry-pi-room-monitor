:'
  Raspberry Pi Room Monitor Dashboard
  -----------------------------------
  Year: 2025
  Author: Ethan Newton
  Prototype project. Free to use, modify, and distribute.
  No copyright claims. This project is intended to be open-source and freely licensed for personal use.
'

#!/bin/bash

USERNAME=$(whoami)


# ==== Apply permissions before running the app ====

DATA_DIR="/home/$USERNAME/room_monitor/static/data"
DATA_FILE="$DATA_DIR/data_log.csv"

# Create folder if missing and apply permissions
mkdir -p "$DATA_DIR"
chmod 777 "$DATA_DIR"
echo "[INFO] Ensured folder exists with 777 permissions: $DATA_DIR"

# Fix CSV file permissions
if [ -f "$DATA_FILE" ]; then
    chmod 666 "$DATA_FILE"
    echo "[INFO] File permissions applied: $DATA_FILE → 666"
else
    echo "[WARNING] CSV file not found: $DATA_FILE"
fi


# ==== Start the Python script ====

cd /home/$USERNAME/room_monitor
source venv/bin/activate
python monitor.py
