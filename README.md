# Raspberry Pi Room Monitor
Temperature and humidity monitor for Raspberry Pi using a DHT22 sensor.
Includes a web dashboard, automatic data logging, and optional email alerts.

## Getting Started
To get started, you will need the following:

### Prerequisites
- Raspberry Pi
- MicroSD Card (minimum 8 GB)
- DHT22 module
- Computer with an SD card reader (to flash Raspberry Pi OS)
- Wi-Fi internet connection

### Optional
- Raspberry Pi case

## Compatibility
The compatibility depends on board model, operating system, and Python version.

### Board Model
#### ✔ Compatible
- Raspberry Pi 3
- Raspberry Pi 4
- Raspberry Pi 5
- Raspberry Pi Zero 2 W

#### ✖ Not Compatible
- Raspberry Pi 1
- Raspberry Pi 2
- Raspberry Pi Zero

### Operating System
**Recommended**: Raspberry Pi OS Lite (minimal), 32-bit or 64-bit.

#### ✔ Compatible
- 10 (Buster)
- 11 (Bullseye)
- 12 (Bookworm)

#### ✖ Not Compatible
- 7 (Wheezy)
- 8 (Jessie)
- 9 (Stretch)
- 13 (Trixie) - Python 3.12 breaks DHT22 libraries

### Python Version
The Python version is determined by the OS release.

#### ✔ Compatible
- 3.7.x → 3.11.x

#### ✖ Not Compatible
- 2.x
- 3.0.x → 3.6.x
- 3.12.x and above

## Connecting the DHT22 to the Raspberry Pi GPIO
The GPIO pins (General Purpose Input/Output) are used to connect the DHT22 sensor.
![GPIO pinout diagram](https://www.raspberrypi.com/documentation/computers/images/GPIO-Pinout-Diagram-2.png)
Raspberrypi.com → Documentation / Computers / Raspberry Pi computer hardware / GPIO and the 40-pin header[^1]

### Connect the DHT22 module as follows:

- &nbsp;&nbsp;\+&nbsp;&nbsp; → Pin 1 (3V3 Power)
- out → Pin 7 (GPIO 4)
- &nbsp;&nbsp;–&nbsp;&nbsp; → Pin 9 (Ground) 

## Installation
Log into your Raspberry Pi via SSH and run the following commands:

### 1. Download the installer script:
```bash
wget https://raw.githubusercontent.com/ethan-newton/raspberry-pi-room-monitor/refs/heads/main/installer.sh
```

### 2. Make the script executable:
```bash
chmod +x installer.sh
```

### 3. Run the installer:
```bash
./installer.sh
```

## All Done!
After installation, the script will show your Raspberry Pi’s local IP address and the URL to access the dashboard:\
<br />
`
http://<IP_ADDRESS>:5000
`\
<br />
Press **Enter** when prompted to reboot.

[^1]: https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#gpio
