export type LinkPath = "live" | "bridge" | "native" | "closed";

export interface AirframeFamily {
  id: string;
  name: string;
  models: string;
  protocol: string;
  path: LinkPath;
  pathLabel: string;
  how: string;
  docs: string;
}

export const AIRFRAMES: AirframeFamily[] = [
  {
    id: "mavlink",
    name: "MAVLink (PX4 / ArduPilot)",
    models: "Pixhawk, Cube, Holybro, mRo, CUAV, most DIY and many commercial airframes",
    protocol: "MAVLink v2 over USB CDC, SiK radio, or BLE UART (NUS)",
    path: "live",
    pathLabel: "Live in this app",
    how: "Chrome desktop: Connect → USB serial (57600 SiK / 115200 USB FC). Android Chrome: Bluetooth NUS telemetry. GUIDED / Offboard setpoints carry follow-me from phone GPS.",
    docs: "https://mavlink.io/en/",
  },
  {
    id: "px4",
    name: "PX4",
    models: "Pixhawk 6 family, Auterion, ModalAI, many VTOL research craft",
    protocol: "MAVLink v2 + Offboard (SET_POSITION_TARGET_GLOBAL_INT)",
    path: "live",
    pathLabel: "Live in this app",
    how: "Set the vehicle to Offboard after a heartbeat. Stream position targets ≥2 Hz or PX4 falls back. Companion computers can also use MAVSDK or uXRCE-DDS.",
    docs: "https://docs.px4.io/main/en/flight_modes/offboard.html",
  },
  {
    id: "ardupilot",
    name: "ArduPilot",
    models: "ArduCopter, ArduPlane, Rover, many CubePilot / Holybro stacks",
    protocol: "MAVLink v2, COPTER_MODE GUIDED = 4",
    path: "live",
    pathLabel: "Live in this app",
    how: "DO_SET_MODE custom 4 (GUIDED), then position targets. Follow-me is the phone as the moving GUIDED point. Mission Planner / QGC remain compatible on the same radio.",
    docs: "https://ardupilot.org/copter/docs/ac2_guidedmode.html",
  },
  {
    id: "betaflight",
    name: "Betaflight / iNav",
    models: "FPV racing and GPS-nav minis running BF or iNav",
    protocol: "MSP v2 over serial",
    path: "bridge",
    pathLabel: "Serial bridge next",
    how: "Not MAVLink. MSP is request/response on the same USB serial. iNav can do GPS hold; Betaflight is a human-in-the-loop stick protocol. A later adapter can speak MSP on the same Web Serial pipe.",
    docs: "https://github.com/betaflight/betaflight/wiki/MSP-v2",
  },
  {
    id: "tello",
    name: "Ryze Tello / Tello EDU",
    models: "Tello, Tello EDU",
    protocol: "UDP command port 8889, state 8890, video 11111 on 192.168.10.1",
    path: "bridge",
    pathLabel: "Needs a local UDP bridge",
    how: "Browsers cannot send raw UDP. A tiny local helper (or Tello EDU SDK 2.0 on the same Wi-Fi) would forward takeoff/land/rc. Official apps: Tello and Tello EDU. DJI Fly is not compatible.",
    docs: "https://github.com/dji-sdk/Tello-Python",
  },
  {
    id: "parrot",
    name: "Parrot ANAFI",
    models: "ANAFI, ANAFI Thermal, ANAFI USA, ANAFI Ai",
    protocol: "HTTP REST + WebSocket on 192.168.42.1 (SkyController RNDIS :180)",
    path: "bridge",
    pathLabel: "Local Wi-Fi / USB Ethernet",
    how: "Join the drone SSID and hit http://192.168.42.1/. SkyController 4 exposes the same API at 192.168.53.1:180 over USB. Also speaks MAVLink v1 for QGC. Python: Olympe. Open, no developer key.",
    docs: "https://developer.parrot.com/docs/webserver-api/overview.html",
  },
  {
    id: "dji-consumer",
    name: "DJI consumer (Mini / Air / Mavic / Avata / Neo)",
    models: "Mini 3–5, Air 3/3S, Mavic 3/4, Avata 2, Flip, Neo, Lito",
    protocol: "Closed OcuSync. Mobile SDK only on a shrinking set of models",
    path: "closed",
    pathLabel: "Manufacturer app",
    how: "A website cannot take the radio. DJI Fly is the controller. Third-party native apps (Litchi, Dronelink) use Mobile SDK — Mini 4 Pro still listed, Mini 5 Pro / Mavic 4 Pro / Neo are not. US SDK access is politically fragile in 2026.",
    docs: "https://developer.dji.com",
  },
  {
    id: "dji-enterprise",
    name: "DJI enterprise (Matrice / Dock / Mavic 3E)",
    models: "Matrice 30/350/400, Dock 2/3, Mavic 3E/3T, M30",
    protocol: "Cloud API (MQTT + HTTPS + WebSocket) via Pilot 2 or Dock; MSDK Android V5",
    path: "native",
    pathLabel: "Cloud API / Pilot 2 H5",
    how: "Not a browser-to-radio link. Cloud API treats the aircraft as an IoT device through DJI Pilot 2 or a Dock. Requires DJI developer account, MQTT broker, and an enterprise airframe. iOS MSDK is deprecated; Android MSDK V5 is the native path.",
    docs: "https://developer.dji.com/doc/cloud-api-tutorial/en/overview/product-introduction.html",
  },
  {
    id: "skydio",
    name: "Skydio",
    models: "X10, X10D, X2, S2+",
    protocol: "Skydio Cloud API; X10D also MAVLink/RAS-A ICD",
    path: "native",
    pathLabel: "Cloud API / X10D MAVLink",
    how: "Autonomy is onboard — this is what Follow Me wants, but it is Skydio's stack. Cloud API for missions, live stream, fleet. X10D Control & Telemetry ICD speaks MAVLink/RAS-A to a third-party controller. Consumer S2 has no public radio API.",
    docs: "https://www.skydio.com/developer-tools",
  },
  {
    id: "autel",
    name: "Autel Robotics",
    models: "EVO II, EVO Max 4T/4N, Evo Nest",
    protocol: "Autel Mobile SDK (native) + Cloud API (MQTT/HTTPS) on Max / Nest",
    path: "native",
    pathLabel: "Autel SDK / Cloud API",
    how: "No browser radio. Register at developer.autelrobotics.com, get an App Key. Mobile SDK covers album, battery, camera, gimbal, missions. Cloud API (Max series, Nest) is the enterprise IoT path, same idea as DJI Cloud API.",
    docs: "https://developer.autelrobotics.com/cloudApi",
  },
  {
    id: "freefly",
    name: "Freefly / other MAVLink OEMs",
    models: "Astro, Alta X, many cine and industrial craft",
    protocol: "Usually MAVLink (PX4) on telemetry",
    path: "live",
    pathLabel: "Live if MAVLink telemetry is exposed",
    how: "If the airframe shows up in QGroundControl over a serial/SiK/Bluetooth radio, Dragonfly can use the same pipe. Confirm GUIDED/Offboard is unlocked on that model.",
    docs: "https://mavlink.io/en/about/implementations.html",
  },
];
