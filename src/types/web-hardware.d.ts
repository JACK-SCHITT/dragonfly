interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

interface SerialPortRequestOptions {
  filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
}

interface Serial {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

interface BluetoothRemoteGATTDescriptor {
  readValue(): Promise<DataView>;
}

interface BluetoothRemoteGATTCharacteristic {
  readonly uuid: string;
  value?: DataView;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  addEventListener(
    type: "characteristicvaluechanged",
    listener: (ev: Event) => void,
  ): void;
  removeEventListener(
    type: "characteristicvaluechanged",
    listener: (ev: Event) => void,
  ): void;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  readonly connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothDevice {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: "gattserverdisconnected", listener: () => void): void;
  removeEventListener(type: "gattserverdisconnected", listener: () => void): void;
}

interface Bluetooth {
  requestDevice(options: {
    filters?: Array<{ namePrefix?: string; services?: string[] }>;
    optionalServices?: string[];
    acceptAllDevices?: boolean;
  }): Promise<BluetoothDevice>;
}

interface Navigator {
  serial?: Serial;
  bluetooth?: Bluetooth;
}

interface DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface DeviceOrientationEventStatic {
  requestPermission?: () => Promise<"granted" | "denied" | "default">;
}

interface Window {
  DeviceOrientationEvent: DeviceOrientationEventStatic & {
    new (): DeviceOrientationEvent;
  };
}
