# Raspberry Pi Room Monitor
Temperature and humidity monitor for Raspberry Pi with DHT22.
Features a web dashboard and email alerts.

Works on Raspberry Pi 3, 4, 5 and Zero 2 W.
Raspberry Pi OS based on Debian version 10 (Buster), version 11 (Bullseye) or version 12 (Bookworm) are the only compatible OS, as the project only works with Python version 3.7 to 3.11.


To install, log into the Raspberry Pi via SSH and run the following commands:

```bash
wget https://raw.githubusercontent.com/ethan-newton/raspberry-pi-room-monitor/refs/heads/main/installer.sh
```

```bash
chmod +x installer.sh
```

```bash
./installer.sh
```
