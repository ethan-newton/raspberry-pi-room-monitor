# Raspberry Pi Room Monitor
A lightweight temperature and humidity monitoring system for Raspberry Pi using a DHT22 sensor.\
Includes a real-time web dashboard, automatic data logging, and email alerts.

## Features
- **Real-time** monitoring of temperature and humidity
- **Web dashboard** accessible from any device on your network
- **Data logging** with hourly temperature and humidity history
- **Email alerts** when thresholds are exceeded
- **Automatic startup** on boot (runs in the background)
- **Easy installation** with a single-command setup

## Getting Started
To get started, you will need the following:

### Prerequisites
- Raspberry Pi
- MicroSD Card (8 GB or larger)
- DHT22 sensor module
- Computer with SD card reader (to flash Raspberry Pi OS)
- Wi-Fi or Ethernet internet connection
- USB power supply cable (micro USB or USB-C, depending on the board model)\
**Minimum** recommended: 5.1V / 2.5A

### Optional
- Raspberry Pi case
- Mounting hardware
- USB keyboard + HDMI cable (for non-SSH setup)

## Compatibility
The compatibility depends on board model, operating system, and Python version.

### Board Model
#### ✔️ Compatible
- Raspberry Pi 3
- Raspberry Pi 4
- Raspberry Pi 5
- Raspberry Pi Zero 2 W

#### ❌ Not Compatible
- Raspberry Pi 1
- Raspberry Pi 2
- Raspberry Pi Zero

### Operating System
**Recommended**: Raspberry Pi OS Lite (minimal), 32-bit or 64-bit.

#### ✔️ Compatible
- 10 (Buster)
- 11 (Bullseye)
- 12 (Bookworm)

#### ❌ Not Compatible
- 7 (Wheezy)
- 8 (Jessie)
- 9 (Stretch)
- 13 (Trixie)

### Python Version
The Python version is determined by the OS release.

#### ✔️ Compatible
- 3.7.x → 3.11.x

#### ❌ Not Compatible
- 2.x
- 3.0.x → 3.6.x
- 3.12.x and above

## Hardware Setup
The Raspberry Pi GPIO pins (General Purpose Input/Output) are used to connect the DHT22 sensor.
![GPIO pinout diagram](https://www.raspberrypi.com/documentation/computers/images/GPIO-Pinout-Diagram-2.png)
Source: Raspberry Pi Documentation[^1]

### Connect the DHT22 module as follows:
- &nbsp;&nbsp;\+&nbsp;&nbsp; → Pin 1 (3V3 Power)
- out → Pin 7 (GPIO 4)
- &nbsp;&nbsp;–&nbsp;&nbsp; → Pin 9 (Ground) 

## Installation
Log into your Raspberry Pi via SSH and run the following command:
```bash
bash <(curl -s https://raw.githubusercontent.com/ethan-newton/raspberry-pi-room-monitor/main/installer.sh)
```
This automatically installs all dependencies, downloads the files, configures the system, and prepares the dashboard.

## All Done!
After the installation, the script displays your Raspberry Pi’s local IP address and the URL to access the dashboard:\
<br />
`
http://<IP_ADDRESS>:5000
`\
<br />
Press **Enter** when prompted to reboot.

[^1]: https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#gpio  
Raspberrypi.com: Documentation / Computers / Raspberry Pi computer hardware / GPIO and the 40-pin header
