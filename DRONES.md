# Dragonfly airframe map

For Johnnie Alderman. What each family actually speaks, and whether this web station can hold the radio.

A browser can only talk to hardware through **Web Serial**, **Web Bluetooth**, **HTTP/WebSocket**, or **WebUSB**. There is no OcuSync, no Lightbridge, no Autel AirLink, and no Skydio controller stack in a website. That is a platform fact, not a missing button.

| Family | Protocol | In this app | What we need next |
| --- | --- | --- | --- |
| PX4 / ArduPilot / Pixhawk / Cube / Holybro | MAVLink v2 | **Live** — USB serial + BLE NUS | Heartbeat, GUIDED/Offboard, `SET_POSITION_TARGET_GLOBAL_INT` at ≥2 Hz |
| Freefly Astro / other MAVLink OEMs | MAVLink v2 | **Live** if telemetry is a serial/SiK/BLE pipe QGC would see | Confirm Offboard/GUIDED unlocked |
| Betaflight | MSP v2 serial | Catalog only | MSP adapter on the same Web Serial transport |
| iNav | MSP v2 (+ GPS nav) | Catalog only | Same MSP adapter; GPS hold is usable for follow |
| Ryze Tello / Tello EDU | UDP 8889 / 8890 / 11111 on `192.168.10.1` | Needs a **local UDP bridge** | Tiny native helper; browsers cannot send UDP. SDK 2.0 on Tello EDU |
| Parrot ANAFI family | HTTP REST + WS on `192.168.42.1`; SkyController RNDIS `192.168.53.1:180`; also MAVLink v1 | Local Wi-Fi / USB Ethernet | Same-network fetch from the phone, or MAVLink if enabled. Python: Olympe |
| DJI consumer (Mini 3–5, Air 3, Mavic 3/4, Avata, Neo, Flip) | Closed OcuSync | **Closed** | Native Android MSDK where DJI still allows it (Mini 4 Pro listed; Mini 5 Pro / Mavic 4 Pro / Neo are not). Litchi/Dronelink already sit on that SDK. US access is fragile in 2026 |
| DJI enterprise (Matrice, Dock, Mavic 3E/3T) | Cloud API MQTT+HTTPS+WS via Pilot 2 or Dock; Android MSDK V5 | Cloud / native app | DJI developer account, MQTT broker. Pilot 2 H5 webview can host a Dragonfly panel **on the RC**, not instead of the RC |
| Skydio X10 / X10D / X2 / S2+ | Cloud API; X10D MAVLink/RAS-A ICD | Cloud / X10D MAVLink | Skydio developer access. X10D is the interesting one — MAVLink to a third-party controller |
| Autel EVO II / EVO Max / Nest | Mobile SDK (App Key) + Cloud API on Max/Nest | Native / cloud | [developer.autelrobotics.com](https://developer.autelrobotics.com/cloudApi). No browser radio |

## Live path (shipped)

1. GCS heartbeat, sysid 255 / comp 190.
2. Vehicle heartbeat → sysid, armed bit, ArduPilot vs PX4.
3. `MAV_CMD_SET_MESSAGE_INTERVAL` for ATTITUDE, GLOBAL_POSITION_INT, SYS_STATUS, GPS_RAW_INT, VFR_HUD, BATTERY_STATUS.
4. Arm + takeoff + GUIDED/Offboard.
5. Follow setpoints: `SET_POSITION_TARGET_GLOBAL_INT`, frame `GLOBAL_RELATIVE_ALT_INT`, type_mask `0x0BF8` (position + yaw).
6. Phone `watchPosition` + compass heading is the moving target.

Baud: **57600** SiK / 3DR, **115200** USB FC, **921600** some Cube USB.

Bluetooth: Nordic UART Service  
`6e400001-b5a3-f393-e0a9-e50e24dcca9e` (RX `...0002`, TX `...0003`). Android Chrome only. iPhone Safari has no Web Bluetooth and no Web Serial.

## Bridge path (next)

- **Tello:** local process on the Tello Wi-Fi that accepts WebSocket from Dragonfly and writes UDP 8889.
- **ANAFI:** `fetch('http://192.168.42.1/...')` when the phone is on the drone AP. Parrot documents this without a developer key.
- **MSP:** parse `$X` / `$M` frames on the existing serial reader.

## Closed path (do not fake)

DJI Mini/Air/Mavic, Autel EVO (consumer), Skydio S2. Follow-me on those airframes is the manufacturer’s app (DJI FocusTrack / ActiveTrack, Skydio subject tracking, Autel tracking). RosettaDrone exists as a MAVLink wrapper around older DJI MSDK — native only, and model coverage is shrinking.

## References

- [MAVLink](https://mavlink.io/en/)
- [PX4 Offboard](https://docs.px4.io/main/en/flight_modes/offboard.html)
- [ArduPilot GUIDED](https://ardupilot.org/copter/docs/ac2_guidedmode.html)
- [DJI Cloud API](https://developer.dji.com/doc/cloud-api-tutorial/en/overview/product-introduction.html)
- [DJI SDK GitHub](https://github.com/dji-sdk)
- [Parrot REST](https://developer.parrot.com/docs/webserver-api/overview.html)
- [Skydio developer tools](https://www.skydio.com/developer-tools)
- [Autel Cloud API](https://developer.autelrobotics.com/cloudApi)
- [Tello-Python](https://github.com/dji-sdk/Tello-Python)
- [MAVLink implementations](https://mavlink.io/en/about/implementations.html)

Concept: Johnnie Alderman. Support: KRACKERJACK.
