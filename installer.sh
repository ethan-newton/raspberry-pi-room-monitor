#
# Raspberry Pi Room Monitor Installer
# -----------------------------------
# Year: 2025
# Author: Ethan Newton
# Repository: https://github.com/ethan-newton/raspberry-pi-room-monitor
#

#!/bin/bash

# Fail fast on errors
set -e

echo "======================================="
echo " Raspberry Pi Room Monitor - Installer"
echo "======================================="
echo ""

# Automatic step counter
STEP=1
TOTAL_STEPS=10

next_step() {
    echo "[$STEP/$TOTAL_STEPS] $1"
    STEP=$((STEP + 1))
}

# ========================
# Verifying
# Raspberry Pi Model
# & Python Version
# ========================

# -------- Verify the Raspberry Pi Model --------

echo "Checking Raspberry Pi Model..."

if [ -f /proc/device-tree/model ]; then
    PI_MODEL=$(tr -d '\0' </proc/device-tree/model)
else
    echo "[ERROR] Unable to detect Raspberry Pi model."
    exit 1
fi

echo "[INFO] Detected device: $PI_MODEL"

# Models NOT supported by adafruit_dht
if echo "$PI_MODEL" | grep -qE "Raspberry Pi (Zero$|Zero W$|1|2)"; then
    echo "[WARNING] Unsupported Raspberry Pi model detected."
    echo ""
    echo "This project requires one of the following:"
    echo "- Raspberry Pi 3"
    echo "- Raspberry Pi 4"
    echo "- Raspberry Pi 5"
    echo "- Raspberry Pi Zero 2 W"
    echo ""
    echo "Your device is not compatible with the DHT22 sensor using adafruit_dht."
    echo "Installation aborted."
    exit 1
fi

echo "[INFO] Compatible Raspberry Pi detected. Continuing installation..."
echo ""


# -------- Verify the Python version --------

echo "Checking Python version..."

# Extract Python "major.minor" as integers
PY_VER_FULL=$(python3 --version 2>/dev/null | awk '{print $2}')
PY_MAJOR=$(echo "$PY_VER_FULL" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VER_FULL" | cut -d. -f2)

echo "[INFO] Detected Python version: $PY_VER_FULL"

# Reject Python 2.x and lower, and Python 3.0–3.6
if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 7 ]; }; then
    echo "[WARNING] Unsupported Python version detected."
    echo "This project requires Python 3.7 to 3.11."
    echo "You are running: $PY_VER_FULL"
    echo "Installation aborted."
    exit 1
fi

# Reject Python 4.x and above
if [ "$PY_MAJOR" -gt 3 ]; then
    echo "[WARNING] Unsupported Python version detected."
    echo "This project only supports Python 3.7 to 3.11."
    echo "You are running: $PY_VER_FULL"
    echo "Installation aborted."
    exit 1
fi

# Reject Python 3.12 and above
if [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -ge 12 ]; then
    echo "[WARNING] Unsupported Python version detected."
    echo "This project only supports Python up to 3.11."
    echo "You are running: $PY_VER_FULL"
    echo "Installation aborted."
    exit 1
fi

echo "[INFO] Compatible Python version detected. Continuing installation..."
echo ""


# ========================
# Detect Username
# ========================

echo "Checking username..."
USERNAME=$(whoami)

echo "[INFO] Detected user: $USERNAME"
echo ""


# ========================
# Detect Home Directory
# ========================

echo "Checking home directory..."
HOME_DIR="/home/$USERNAME"

echo "[INFO] Detected directory: $HOME_DIR"
echo ""


# ========================
# Detect IP Address
# ========================

echo "Checking local IP address..."
IP_ADDRESS=$(hostname -I | awk '{print $1}')

echo "[INFO] Detected local IP address: $IP_ADDRESS"
echo ""


# ========================
# Update System
# ========================

next_step "Updating system..."
sudo apt update
sudo apt upgrade -y
echo ""


# ========================
# Install Git
# ========================

next_step "Installing Git..."
sudo apt install -y git
echo ""


# ========================
# Download Project
# From GitHub
# ========================

next_step "Cloning GitHub project..."

# Remove any previous installation
rm -rf "$HOME_DIR/room_monitor" || true

# Temporary folder to safely clone the repo
TMP_CLONE="$HOME_DIR/.rm_clone_tmp"
rm -rf "$TMP_CLONE" || true

git clone https://github.com/ethan-newton/raspberry-pi-room-monitor.git "$TMP_CLONE"

# Copy ONLY the room_monitor folder into the user's home directory
mv "$TMP_CLONE/room_monitor" "$HOME_DIR/room_monitor"

# Clean up the temporary clone directory
rm -rf "$TMP_CLONE"

echo "[INFO] Project successfully installed to $HOME_DIR/room_monitor"
echo ""


# ========================
# Modifying settings.json
# ========================

next_step "Configuring the project settings..."

SETTINGS_FILE="$HOME_DIR/room_monitor/settings.json"

# If settings.json doesn't exist, skip. Else, configure it
if [ ! -f "$SETTINGS_FILE" ]; then
    echo "[WARNING] settings.json not found at: $SETTINGS_FILE"
    echo "Skipping configuration."
    echo ""
else
    # -------- Ask for the GPIO pin number --------
    echo "Enter the GPIO pin number used for the DHT22 data line."
    echo "IMPORTANT: This must be the BCM GPIO number (e.g., 4 = GPIO4 on the board)."
    echo "Default is 4."
    read -p "GPIO pin: " DATA_PIN
    DATA_PIN=${DATA_PIN:-4}     # default to 4 if blank

    # Validate that data_pin is numeric
    while ! [[ "$DATA_PIN" =~ ^[0-9]+$ ]]; do
        echo "[WARNING] Invalid value. GPIO pin must be a number using BCM numbering."
        read -p "GPIO pin [4]: " DATA_PIN
        DATA_PIN=${DATA_PIN:-4}
    done
    echo ""


    # -------- Ask for email information --------
    echo "Email configuration (optional)"
    echo "Leave fields empty to disable email alerts."
    echo ""

    # Regex for basic email validation
    EMAIL_REGEX="^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"

    # Email: email_user
    read -p "Alert email from (ex: myemail@gmail.com): " EMAIL_USER
    if [ -n "$EMAIL_USER" ]; then
        while ! [[ "$EMAIL_USER" =~ $EMAIL_REGEX ]]; do
            echo "[WARNING] Invalid email format. Please enter a valid email or leave blank."
            read -p "Email username: " EMAIL_USER
            [ -z "$EMAIL_USER" ] && break
        done
    fi
    echo ""

    # Email: email_pass (anything accepted)
    read -p "Email password (App Password recommended, blank = disabled): " EMAIL_PASS
    echo ""

    # Email: email_to
    read -p "Destination email (alerts will be sent here): " EMAIL_TO
    if [ -n "$EMAIL_TO" ]; then
        while ! [[ "$EMAIL_TO" =~ $EMAIL_REGEX ]]; do
            echo "[WARNING] Invalid email format. Please enter a valid email or leave blank."
            read -p "Destination email: " EMAIL_TO
            [ -z "$EMAIL_TO" ] && break
        done
    fi
    echo ""


    # -------- Apply changes to settings.json using jq --------
    echo "Updating settings.json..."

    jq ".data_pin = $DATA_PIN |
        .email_user = \"$EMAIL_USER\" |
        .email_pass = \"$EMAIL_PASS\" |
        .email_to = \"$EMAIL_TO\"" \
        "$SETTINGS_FILE" > "$SETTINGS_FILE.tmp"

    mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"

    # Fix permissions (no sudo needed; installer runs as root)
    chmod 666 "$SETTINGS_FILE"

    echo "[INFO] settings.json updated successfully"
    echo ""
fi


# ========================
# Create and Activate
# Virtual Environment
# ========================

next_step "Creating virtual environment..."

cd "$HOME_DIR/room_monitor"
python3 -m venv venv


# ========================
# Install Dependencies
# ========================

# -------- System dependencies --------
next_step "Installing system dependencies..."

sudo apt install -y \
    python3-pip \
    libgpiod2 \
    python3-dev \
    python3-rpi.gpio

echo "[INFO] System dependencies installed successfully"
echo ""

# -------- Python dependencies --------
next_step "Installing Python dependencies..."

# Activate the venv
source "$HOME_DIR/room_monitor/venv/bin/activate"

# Make sure pip is up to date
pip install --upgrade pip

# Install required Python packages
pip install \
    adafruit-blinka \
    adafruit-circuitpython-dht \
    psutil \
    flask

echo "[INFO] Python dependencies installed successfully"
echo ""


# ========================
# Make Scripts Executable
# ========================

next_step "Making scripts executable..."

chmod +x "$HOME_DIR/room_monitor/scripts/start_dashboard.sh"
chmod +x "$HOME_DIR/room_monitor/scripts/start_monitor.sh"

echo "[INFO] Scripts are now executable"
echo ""


# ========================
# Create systemd Services
# ========================

next_step "Creating systemd services..."

# -------- start_dashboard.sh --------
sudo bash -c "cat > /etc/systemd/system/room_dashboard.service" <<EOF
[Unit]
Description=Raspberry Pi Room Monitor Dashboard
After=network.target

[Service]
Type=simple
User=$USERNAME
WorkingDirectory=$HOME_DIR/room_monitor
ExecStartPre=/bin/sleep 5
ExecStart=$HOME_DIR/room_monitor/scripts/start_dashboard.sh
Restart=always
RestartSec=5
Environment=\"PATH=$HOME_DIR/room_monitor/venv/bin\"

[Install]
WantedBy=multi-user.target
EOF

# -------- start_monitor.sh --------
sudo bash -c "cat > /etc/systemd/system/room_monitor.service" <<EOF
[Unit]
Description=Raspberry Pi Room Monitor Data Logger
After=network.target

[Service]
Type=simple
User=$USERNAME
WorkingDirectory=$HOME_DIR/room_monitor
ExecStartPre=/bin/sleep 5
ExecStart=$HOME_DIR/room_monitor/scripts/start_monitor.sh
Restart=always
RestartSec=5
Environment=\"PATH=$HOME_DIR/room_monitor/venv/bin\"

[Install]
WantedBy=multi-user.target
EOF

echo "[INFO] systemd services are created"
echo ""


# ========================
# Enable & Start Services
# ========================

next_step "Enabling and starting systemd services..."

sudo systemctl daemon-reload
sudo systemctl enable room_dashboard.service
sudo systemctl enable room_monitor.service
sudo systemctl start room_dashboard.service
sudo systemctl start room_monitor.service

echo "[INFO] systemd services are how enabled and running"
echo ""

# -------- Completion and Reboot --------
echo "======================="
echo " Installation Complete"
echo "======================="
echo ""
echo "Your dashboard is now available at:"
echo "http://$IP_ADDRESS:5000"
echo ""
echo "Reboot recommended. Press Enter to reboot now, or Ctrl+C to cancel."
read
sudo reboot
