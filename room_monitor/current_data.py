"""
  Raspberry Pi Room Monitor
  -------------------------
  Year: 2025
  Author: Ethan Newton
  Prototype project. Free to use, modify, and distribute.
  No copyright claims. This project is intended to be open-source and freely licensed for personal or commercial use.
"""

#!/usr/bin/env python3

import os
import json
import time
import board
import adafruit_dht
import psutil
from datetime import datetime


# ========================
# File Paths
# ========================

BASE = os.path.dirname(__file__)
SETTINGS_FILE = os.path.join(BASE, "settings.json")


# ========================
# Load Settings
# ========================

def load_settings():
    # Load configuration values from settings.json
    # Required mainly to retrieve the GPIO pin used by the DHT22 sensor
    if not os.path.exists(SETTINGS_FILE):
        raise FileNotFoundError(f"[ERROR] {SETTINGS_FILE} not found.")
    with open(SETTINGS_FILE, "r") as f:
        return json.load(f)


# ========================
# Read Sensor
# ========================

def get_current_data(max_retries=5, retry_delay=2.0):
    # Read the current temperature and humidity from the DHT22 sensor
    # Retries up to `max_retries` times if read fails
    # Returns temperature and humidity or raises an Exception if all attempts fail
    # Applies a small calibration adjustment for sensor accuracy
    settings = load_settings()

    # Retrieve the configured GPIO pin number from settings.json
    pin_number = settings.get("data_pin")
    if pin_number is None:
        raise ValueError("[ERROR] data_pin not defined in settings.json")

    # Convert pin number to a board constant (e.g., D4)
    # Note: Assumes use of the Adafruit Blinka/board library with D-numbered pins
    try:
        pin = getattr(board, f"D{pin_number}")
    except AttributeError:
        raise ValueError(f"Invalid data_pin {pin_number} for board library")

    # Initialize DHT22 sensor on the specified pin
    dhtDevice = adafruit_dht.DHT22(pin, use_pulseio=False)

    try:
        for attempt in range(max_retries):
            try:
                # Read temperature and humidity from the sensor
                temperature = dhtDevice.temperature
                humidity = dhtDevice.humidity

                # Ensure both values are valid (not None)
                if temperature is not None and humidity is not None:

                    # Calibration constants
                    TEMPERATURE_ADJUSTMENT = 0.9
                    HUMIDITY_ADJUSTMENT = 1.00

                    # Apply calibration adjustments
                    temperature *= TEMPERATURE_ADJUSTMENT       # Celsius * Adjustment
                    humidity *= HUMIDITY_ADJUSTMENT             # %RH * Adjustment
                    
                    print(f"[INFO] Successfully fetched data on attempt {attempt + 1}")
                    return temperature, humidity

                raise RuntimeError("Received None from sensor")

            except RuntimeError as e:
                # DHT22 often throws runtime errors; safe to retry
                print(f"Failed to read sensor (attempt {attempt + 1}/{max_retries}): {e}")
                time.sleep(retry_delay)

        # If all retries failed
        raise RuntimeError(f"Failed to read valid data from DHT22 after {max_retries} attempts")

    finally:
        # Always release the sensor to free the pin
        dhtDevice.exit()


# ========================
# CPU / RAM
# Adjust monitor.py file if modified
# ========================

# Raspberry Pi CPU temperature
def get_cpu_temp():
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
            temp_raw = int(f.read())
            return temp_raw / 1000           # Convert millidegrees to °C
    except FileNotFoundError:
        return None

# CPU temperature values for percentage
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
# Direct Run Code (Call)
# ========================

if __name__ == "__main__":
    # If the script is run directly (not imported), it will read the sensor
    # once and print the results to the console for quick testing
    try:
        temp, hum = get_current_data()
        print(f"[INFO]         Date: {datetime.now().strftime('%Y-%m-%d')}")
        print(f"[INFO]         Time: {datetime.now().strftime('%H:%M')}")
        print(f"[INFO]  Temperature: {temp:.1f}°C")
        print(f"[INFO]     Humidity: {hum:.1f}%RH")
        print(f"[INFO]    CPU Temp.: {current_temp:.1f}°C ({temp_percent:.0f}%)")
        print(f"[INFO]    RAM Usage: {ram_percent:.1f}% ({ram_used_mb:.0f}/{ram_total_mb:.0f} MB)")
    except Exception as e:
        print("[ERROR] Error reading sensor:", e)
