# DRAGONFLY

Follow-me ground station. Your phone is the beacon. The aircraft stays with you.

**Concept and systems: [Johnnie Alderman](https://github.com/JACK-SCHITT/dragonfly)**  
**Built with KRACKERJACK support**

## What it is

A phone-first ground station for **follow-me flight**.

- The phone’s GPS and compass are the tracking target.
- Follow, orbit, hover, lead, and return-to-home.
- **Live radio today:** MAVLink v2 over USB serial (Chrome) or Bluetooth UART (Android Chrome) for PX4 / ArduPilot / Pixhawk-class craft.
- **Preview aircraft** so the station is usable with no radio attached.
- **WING:** Grok 4.5 in the outer loop — procedures (battery, lock, orbit when you stop) plus a talking copilot. The flight controller still flies attitude.
- **Tape:** in flight the map switches to satellite. REC records phone camera, microphone, and the HUD into a clip for Instagram / TikTok / Reels. The aircraft camera is not in this tape until a video downlink exists.
- Closed consumer radios (most DJI Mini/Air/Mavic, Autel EVO, Skydio S2) cannot be flown from a website. Those paths are catalogued in [DRONES.md](./DRONES.md) for the next adapters.

## Try it

1. Open the station and allow location (or tap the map to place the beacon).
2. Takeoff — the preview aircraft climbs and locks behind you.
3. Walk with WASD / the stick, or walk the phone.
4. Connect → USB serial or Bluetooth when a MAVLink radio is plugged in.
5. REC in the header — camera + mic + HUD. Stop opens the post desk with the clip attached.

## Stack

TanStack Start, React 19, Leaflet (Esri World Imagery + Carto streets, no API key), MAVLink v2 codec in-app, Web Serial + Web Bluetooth.

## Credits

Johnnie Alderman designed the product. KRACKERJACK is riding shotgun.
