export type OperatingMode = 'NOMINAL' | 'SCIENCE' | 'LOW_POWER' | 'SAFE_MODE';

export type CommStatus = 'ONLINE' | 'DEGRADED' | 'STANDBY' | 'SAFE_CARRIER_ONLY';

export interface PowerSubsystem {
  battery_percent: number; // 0 - 100
  battery_voltage: number; // Volts
  solar_generation_watts: number;
  consumption_watts: number;
  in_eclipse: boolean;
}

export interface ThermalSubsystem {
  bus_temp_celsius: number;
  payload_temp_celsius: number;
  heaters_active: boolean;
}

export interface NavigationSubsystem {
  attitude: {
    pitch_deg: number;
    yaw_deg: number;
    roll_deg: number;
  };
  reaction_wheel_rpm: [number, number, number];
  fuel_remaining_kg: number;
  last_thruster_burn?: string;
}

export interface CameraSubsystem {
  status: 'IDLE' | 'CAPTURING' | 'OFFLINE' | 'DISABLED';
  resolution: string;
  images_captured: number;
  last_image_timestamp?: string;
}

export interface FlightComputerSubsystem {
  cpu_load_percent: number;
  memory_used_mb: number;
  uptime_seconds: number;
  watchdog_tripped: boolean;
  safe_mode_trigger_count: number;
  safe_mode_reason?: string;
}

export interface SpacecraftState {
  spacecraft_id: string;
  timestamp: string;
  operating_mode: OperatingMode;
  communication_status: CommStatus;
  power: PowerSubsystem;
  thermal: ThermalSubsystem;
  navigation: NavigationSubsystem;
  camera: CameraSubsystem;
  flight_computer: FlightComputerSubsystem;
  last_executed_command_id?: string;
  last_command_time?: string;
}

export interface EssentialTelemetry {
  timestamp: string;
  spacecraft_id: string;
  operating_mode: OperatingMode;
  comm_status: CommStatus;
  battery_percent: number;
  bus_temp_celsius: number;
  safe_mode_active: boolean;
  safe_mode_reason?: string;
  heartbeat_counter: number;
}
