"""
  Raspberry Pi Room Monitor Dashboard
  -----------------------------------
  Year: 2025
  Author: Ethan Newton
  Prototype project. Free to use, modify, and distribute.
  No copyright claims. This project is intended to be open-source and freely licensed for personal use.
"""

#!/usr/bin/env python3

import os
import csv
import json
import time
import smtplib
import ssl
import psutil
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from current_data import get_current_data


# -------- File Paths --------
BASE = os.path.dirname(__file__)
SETTINGS_FILE = os.path.join(BASE, "settings.json")
DATA_FILE = os.path.join(BASE, "static/data/data_log.csv")


# ========================
# Default Settings
# ========================

def load_settings():
    # If settings.json missing create a safe default (won't contain real mail creds)
    defaults = {
        "min_temp": 18.0, "max_temp": 22.0,
        "min_hum": 40.0, "max_hum": 70.0,
        "data_pin": 4, "email_user": "",
        "email_pass": "", "email_to": "",
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 465
    }

    if not os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "w") as f:
            json.dump(defaults, f, indent=2)
        print("[INFO] settings.json created with default values.")
        return defaults

    with open(SETTINGS_FILE, "r") as f:
        return json.load(f)


# ========================
# Automatic Email
# ========================

def send_email(subject, body, settings):
    # Send email notification using credentials in settings.json
    user = settings.get("email_user") or ""
    password = settings.get("email_pass") or ""
    recipient = settings.get("email_to") or ""
    host = settings.get("smtp_host", "smtp.gmail.com")
    port = int(settings.get("smtp_port", 465))

    if not (user and password and recipient):
        print("[INFO] Email credentials/recipient not set — skipping email.")
        return False

    try:
        msg = MIMEText(body, _charset='utf-8')
        msg['Subject'] = subject
        msg['From'] = user
        msg['To'] = recipient
        
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=context) as server:
            server.login(user, password)
            server.sendmail(user, recipient, msg.as_string())
        
        print(f"[INFO] [{datetime.now():%Y-%m-%d %H:%M}] Email sent: {subject}")
        return True
    except Exception as e:
        print(f"[ERROR] {datetime.now()}: Failed to send email: {e}")
        return False


# ========================
# Format Timestamp
# ========================

def format_timestamp(ts=None):
    #Return formatted timestamp string
    if ts is None:
        ts = datetime.now()
    return ts.strftime("%Y-%m-%d %H:%M")


# ========================
# CSV Handler
# ========================

def append_csv(row):
    try:
        with open(DATA_FILE, "a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(row)
        print(f"[INFO] Hourly average saved: {row[0]}")
    except Exception as e:
        print(f"[ERROR] Failed to write CSV: {e}")


# ========================
# CPU / RAM
# Adjust current_data.py file if modified
# ========================

# Raspberry Pi CPU temperature
def get_cpu_temp():
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
            temp_raw = int(f.read())
            return temp_raw / 1000           # Convert millidegrees to °C
    except FileNotFoundError:
        return None

# Temperature percentage
MIN_T = 18
MAX_T = 75
current_temp = get_cpu_temp()

temp_percent = (current_temp - MIN_T) / (MAX_T - MIN_T) * 100
temp_percent = max(0, min(100, temp_percent))

# RAM usage
mem = psutil.virtual_memory()
ram_percent = mem.percent
ram_used_mb = mem.used / 1024 / 1024
ram_total_mb = mem.total / 1024 / 1024


# ========================
# Main Loop
# ========================

def main():
    print("[INFO] Starting monitor.py")

    # Ensure data folder and CSV file exist
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    if not os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "w", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["timestamp", "temperature", "humidity"])
            os.chmod(DATA_FILE, 0o666)
            print(f"[INFO] Created new CSV file with header: {DATA_FILE}")
        except Exception as e:
            print(f"[ERROR] Failed to create CSV file: {e}")

    # In-memory hourly readings
    hourly_temp = []
    hourly_hum = []
    current_hour = datetime.now().hour
    last_hour = datetime.now().replace(minute=0, second=0, microsecond=0)
    last_alert_time = {"temp": None, "hum": None}
    last_outside_state = {"temp": False, "hum": False}

    while True:
        settings = load_settings()
        min_t = float(settings.get("min_temp", 18.0))
        max_t = float(settings.get("max_temp", 26.0))
        min_h = float(settings.get("min_hum", 50.0))
        max_h = float(settings.get("max_hum", 70.0))

        timestamp = datetime.now()

        try:
            temp, hum = get_current_data()
            print()
            print(f"[INFO]         Date: {datetime.now().strftime('%Y-%m-%d')}")
            print(f"[INFO]         Time: {datetime.now().strftime('%H:%M')}")
            print(f"[INFO]  Temperature: {temp:.1f}°C")
            print(f"[INFO]     Humidity: {hum:.1f}%RH")
            print(f"[INFO]    CPU Temp.: {current_temp:.1f}°C ({temp_percent:.0f}%)")
            print(f"[INFO]    RAM Usage: {ram_percent:.1f}% ({ram_used_mb:.0f}/{ram_total_mb:.0f} MB)")
            print()
        except Exception as e:
            print(f"[ERROR] {format_timestamp(timestamp)} Failed to read sensor: {e}")
            temp = hum = None

        # Only process valid readings
        if temp is not None and hum is not None:
            hourly_temp.append(temp)
            hourly_hum.append(hum)

            # Check for alerts
            def should_alert(kind, value, min_val, max_val):
                now = datetime.now()
                outside = value < min_val or value > max_val
                last_alert = last_alert_time[kind]
                previously_outside = last_outside_state[kind]

                if outside:
                    if not previously_outside:
                        # First detection -> mark as outside, no alert yet
                        last_outside_state[kind] = True
                        return False
                    elif previously_outside and (last_alert is None or now - last_alert >= timedelta(hours=1)):
                        # Still outside after 5 minutes -> alert
                        last_alert_time[kind] = now
                        return True
                else:
                    # Back within range
                    last_outside_state[kind] = False
                return False

            # Temperature alert
            if should_alert("temp", temp, min_t, max_t):
                if temp < min_t:
                    send_email("Temperature LOW Alert", f"{format_timestamp(timestamp)}\nTemperature {temp:.1f}°C, below {min_t}°C.", settings)
                elif temp > max_t:
                    send_email("Temperature HIGH Alert", f"{format_timestamp(timestamp)}\nTemperature {temp:.1f}°C, above {max_t}°C.", settings)

            # Humidity alert
            if should_alert("hum", hum, min_h, max_h):
                if hum < min_h:
                    send_email("Humidity LOW Alert", f"{format_timestamp(timestamp)}\nHumidity {hum:.1f}%RH, below {min_h}%RH.", settings)
                elif hum > max_h:
                    send_email("Humidity HIGH Alert", f"{format_timestamp(timestamp)}\nHumidity {hum:.1f}%RH, above {max_h}%RH.", settings)

        # If an hour passed, calculate average and save
        current_hour = timestamp.replace(minute=0, second=0, microsecond=0)
        if current_hour > last_hour:
            if hourly_temp and hourly_hum:
                avg_temp = sum(hourly_temp) / len(hourly_temp)
                avg_hum = sum(hourly_hum) / len(hourly_hum)
                log_time = (current_hour - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M")
                append_csv([log_time,f"{avg_temp:.1f}",f"{avg_hum: .1f}"])
                print(f"[INFO] Logged hourly average ({log_time}: {avg_temp:.1f}°C | {avg_hum:.1f}%RH")
            else:
                print(f"[ERROR] {log_time} No valid readings for this hour — skipping log.")
            # Reset for next hour
            hourly_temp.clear()
            hourly_hum.clear()
            last_hour = current_hour
        
        # Wait for next reading (progress bar + countdown)
        wait_time = 5 * 60  # 5 minutes
        next_read = datetime.now() + timedelta(seconds=wait_time)
        print(f"[INFO] Next reading in 5 minutes at {next_read.strftime('%H:%M')}")
        print()                     # Line break

        bar_length = 50             # Width of the progress bar
        start_time = time.time()

        while True:
            elapsed = time.time() - start_time
            remaining = wait_time - elapsed
            if remaining <= 0:
                break

            # Calculate progress
            pct = elapsed / wait_time
            filled = int(bar_length * pct)
            bar = "█" * filled + "-" * (bar_length - filled)

            # Format countdown as mm:ss
            mm, ss = divmod(int(remaining), 60)
            countdown = f"{mm:02d}:{ss:02d}"

            # Print single-line animated progress bar
            print(f"[WAIT] [{bar}]{pct*100:5.1f}%  |  {countdown} / 05:00", end="\r", flush=True)
            time.sleep(0.2)

        print(" " * 100, end="\r")          # Clear line when done


# ========================
# Initialization
# ========================

if __name__ == "__main__":
    main()

