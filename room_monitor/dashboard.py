"""
  Raspberry Pi Room Monitor
  -------------------------
  Year: 2025
  Author: Ethan Newton
  Prototype project. Free to use, modify, and distribute.
  No copyright claims. This project is intended to be open-source and freely licensed for personal use.
"""

#!/usr/bin/env python3

import os
import json
import re
import csv
from flask import Flask, render_template, request, jsonify
from current_data import get_current_data

# -------- File Paths --------
BASE = os.path.dirname(__file__)
SETTINGS_FILE = os.path.join(BASE, "settings.json")
DATA_FILE = os.path.join(BASE, "static/data/data_log.csv")

# -------- Flask App --------
app = Flask(__name__)
app.secret_key = "change_this_to_a_random_string"


# ========================
# Utility Functions
# ========================

def load_settings():
    # Load configuration values from settings.json
    # If the file doesn't exist, create it with default values
    if not os.path.exists(SETTINGS_FILE):
        defaults = {
            "min_temp": 18.0,
            "max_temp": 22.0,
            "min_hum": 40.0,
            "max_hum": 70.0,
            "data_pin": 4,
            "email_user": "<EMAIL_FROM>",
            "email_pass": "<EMAIL_PASSWORD>",
            "email_to": "<EMAIL_TO>",
            "smtp_host": "smtp.gmail.com",
            "smtp_port": 465
        }

        # Write default settings file
        with open(SETTINGS_FILE, "w") as f:
            json.dump(defaults, f, indent=2)

        # Apply chmod 666 (allow read/write for all)
        try:
            os.chmod(SETTINGS_FILE, 0o666)
            print(f"[INFO] Applied permissions 666 to {SETTINGS_FILE}")
        except Exception as e:
            print(f"[WARNING] Could not set permissions for {SETTINGS_FILE}: {e}")

        return defaults

    # Load and return existing settings
    with open(SETTINGS_FILE, "r") as f:
        return json.load(f)


def write_settings(new_data):
    # Update and save selected settings (temperature/humidity limits)
    # Keeps other configuration values intact
    current = {}
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "r") as f:
            try:
                current = json.load(f)
            except json.JSONDecodeError:
                current = {}

    # Update only the keys we care about
    for key in ["min_temp", "max_temp", "min_hum", "max_hum"]:
        if key in new_data:
            current[key] = new_data[key]

    # Save updated settings securely
    with open(SETTINGS_FILE, "w") as f:
        json.dump(current, f, indent=2)


# ========================
# Web Routes
# ========================

@app.route("/")
def dashboard():
    # Render the main dashboard page.
    return render_template("dashboard.html")


# ========================
# API Endpoints
# ========================

@app.route("/api/settings", methods=["GET"])
def api_get_settings():
    # Return current settings as JSON
    return jsonify(load_settings())

@app.route("/api/settings", methods=["POST"])
def api_post_settings():
    # Validate and save updated settings from dashboard
    data = request.get_json(force=True)
    errors = []

    # Convert values to floats and validate numeric format
    try:
        min_temp = float(data["min_temp"])
        max_temp = float(data["max_temp"])
        min_hum = float(data["min_hum"])
        max_hum = float(data["max_hum"])
    except (ValueError, TypeError, KeyError):
        return jsonify({"ok": False, "errors": ["Invalid number format."]}), 400

    # Range validation
    if not (-40 <= min_temp <= 80):
        errors.append("Minimum Temperature out of range (-40 to 80)")
    if not (-40 <= max_temp <= 80):
        errors.append("Maximum Temperature out of range (-40 to 80).")
    if not (0 <= min_hum <= 100):
        errors.append("Minimum Humidity out of range (0 to 100).")
    if not (0 <= max_hum <= 100):
        errors.append("Maximum Humidity out of range (0 to 100).")

    # Logical validation
    if min_temp >= max_temp:
        errors.append("Minimum Temperature must be less than Maximum Temperature.")
    if min_hum >= max_hum:
        errors.append("Minimum Humidity must be less than Maximum Humidity.")

    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    # Save valid data and update only the 4 setpoints
    settings = load_settings()
    settings.update({
        "min_temp": min_temp,
        "max_temp": max_temp,
        "min_hum": min_hum,
        "max_hum": max_hum
    })
    
    write_settings(settings)
    return jsonify({"ok": True})

@app.route("/api/data")
def api_data():
    # Return all logged CSV data as JSON
    # Used to populate the dashboard charts
    data = []

    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    data.append({
                        "timestamp": row["timestamp"],
                        "temperature": float(row["temperature"]),
                        "humidity": float(row["humidity"])
                    })
                except (ValueError, KeyError):
                    continue        # skip invalid or incomplete lines

    print("Reading from:", DATA_FILE)
    return jsonify(data)

@app.route("/api/current")
def api_current():
    # Return the current live temperature and humidity
    # Reads from DHT sensor using get_current_data()
    try:
        temp, hum = get_current_data()
        return jsonify({"temperature": temp, "humidity": hum, "ok": True})
    except Exception as e:
        # Catch errors from hardware or library and return safely
        return jsonify({"ok": False, "error": str(e)}), 500


# ========================
# Run Application
# ========================
if __name__ == "__main__":
    # Run Flask app on all interfaces (LAN-accessible)
    app.run(host="0.0.0.0", port=5000)

