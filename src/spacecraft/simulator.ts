import { SpacecraftState, EssentialTelemetry, OperatingMode } from '../models/spacecraft';
import { CommandEnvelope } from '../models/command';

export const INITIAL_SPACECRAFT_STATE: SpacecraftState = {
  spacecraft_id: 'SAT-01',
  timestamp: new Date().toISOString(),
  operating_mode: 'NOMINAL',
  communication_status: 'ONLINE',
  power: {
    battery_percent: 88.5,
    battery_voltage: 28.4,
    solar_generation_watts: 0.0, // Initial in Eclipse
    consumption_watts: 45.0,
    in_eclipse: true
  },
  thermal: {
    bus_temp_celsius: 18.2,
    payload_temp_celsius: 12.0,
    heaters_active: true
  },
  navigation: {
    attitude: { pitch_deg: 0.0, yaw_deg: 1.2, roll_deg: -0.4 },
    reaction_wheel_rpm: [1250, -840, 420],
    fuel_remaining_kg: 14.8,
    last_thruster_burn: undefined
  },
  camera: {
    status: 'IDLE',
    resolution: '4096x3072 Multispectral',
    images_captured: 12,
    last_image_timestamp: undefined
  },
  flight_computer: {
    cpu_load_percent: 18.5,
    memory_used_mb: 245,
    uptime_seconds: 482910,
    watchdog_tripped: false,
    safe_mode_trigger_count: 0,
    safe_mode_reason: undefined
  }
};

export class SpacecraftSimulator {
  private state: SpacecraftState;
  private heartbeatCounter = 0;

  constructor(initial?: SpacecraftState) {
    this.state = initial ? JSON.parse(JSON.stringify(initial)) : JSON.parse(JSON.stringify(INITIAL_SPACECRAFT_STATE));
  }

  public getState(): SpacecraftState {
    return { ...this.state };
  }

  public getEssentialTelemetry(): EssentialTelemetry {
    this.heartbeatCounter++;
    return {
      timestamp: new Date().toISOString(),
      spacecraft_id: this.state.spacecraft_id,
      operating_mode: this.state.operating_mode,
      comm_status: this.state.communication_status,
      battery_percent: this.state.power.battery_percent,
      bus_temp_celsius: this.state.thermal.bus_temp_celsius,
      safe_mode_active: this.state.operating_mode === 'SAFE_MODE',
      safe_mode_reason: this.state.flight_computer.safe_mode_reason,
      heartbeat_counter: this.heartbeatCounter
    };
  }

  /**
   * Periodic simulation tick (updates physics, power, battery charge/drain)
   */
  public tick(deltaSeconds = 1.0, isEclipse = true): SpacecraftState {
    this.state.timestamp = new Date().toISOString();
    this.state.flight_computer.uptime_seconds += deltaSeconds;
    this.state.power.in_eclipse = isEclipse;

    if (isEclipse) {
      this.state.power.solar_generation_watts = 0.0;
      // Drain battery slowly
      const drainRate = (this.state.power.consumption_watts / 3600) * (deltaSeconds / 50);
      this.state.power.battery_percent = Math.max(12.0, this.state.power.battery_percent - drainRate);
      this.state.thermal.bus_temp_celsius = Math.max(-5.0, this.state.thermal.bus_temp_celsius - 0.02 * deltaSeconds);
    } else {
      this.state.power.solar_generation_watts = 310.0;
      // Charge battery if not 100%
      if (this.state.power.battery_percent < 98.0) {
        this.state.power.battery_percent = Math.min(100.0, this.state.power.battery_percent + 0.08 * deltaSeconds);
      }
      this.state.thermal.bus_temp_celsius = Math.min(32.0, this.state.thermal.bus_temp_celsius + 0.03 * deltaSeconds);
    }

    this.state.power.battery_voltage = 24.0 + (this.state.power.battery_percent / 100) * 4.4;

    // Slight attitude jitter for realistic physics
    this.state.navigation.attitude.pitch_deg += (Math.random() - 0.5) * 0.05;
    this.state.navigation.attitude.roll_deg += (Math.random() - 0.5) * 0.05;

    return this.getState();
  }

  /**
   * Puts spacecraft into protective Safe Mode
   */
  public enterSafeMode(reason: string): void {
    this.state.operating_mode = 'SAFE_MODE';
    this.state.communication_status = 'SAFE_CARRIER_ONLY';
    this.state.camera.status = 'DISABLED';
    this.state.power.consumption_watts = 22.0; // Minimal survival power
    this.state.flight_computer.safe_mode_trigger_count++;
    this.state.flight_computer.safe_mode_reason = reason;
  }

  /**
   * Resets vehicle from Safe Mode back to Nominal after operator authorization
   */
  public exitSafeMode(): void {
    this.state.operating_mode = 'NOMINAL';
    this.state.communication_status = 'ONLINE';
    this.state.camera.status = 'IDLE';
    this.state.power.consumption_watts = 48.0;
    this.state.flight_computer.safe_mode_reason = undefined;
  }

  /**
   * Executes an accepted command inside spacecraft simulator
   */
  public executeCommand(envelope: CommandEnvelope): { success: boolean; message: string; telemetry: EssentialTelemetry } {
    const cmdType = envelope.payload.command_type;
    const params = envelope.payload.parameters || {};

    this.state.last_executed_command_id = envelope.header.command_id;
    this.state.last_command_time = envelope.header.timestamp;

    switch (cmdType) {
      case 'QUERY_TELEMETRY':
        return {
          success: true,
          message: 'Telemetry query acknowledged. Full diagnostic packet generated.',
          telemetry: this.getEssentialTelemetry()
        };

      case 'CAPTURE_IMAGE':
        if (this.state.operating_mode === 'SAFE_MODE') {
          return {
            success: false,
            message: 'Execution rejected: Camera payload powered off in SAFE MODE.',
            telemetry: this.getEssentialTelemetry()
          };
        }
        this.state.camera.status = 'CAPTURING';
        this.state.camera.images_captured++;
        this.state.camera.last_image_timestamp = new Date().toISOString();
        this.state.power.battery_percent = Math.max(10, this.state.power.battery_percent - 1.8);
        return {
          success: true,
          message: `Optical image acquired successfully (${params.target || 'Nadir Earth swath'}).`,
          telemetry: this.getEssentialTelemetry()
        };

      case 'ROTATE_REACTION_WHEEL':
        if (this.state.operating_mode === 'SAFE_MODE') {
          return {
            success: false,
            message: 'Execution rejected: Reaction wheel slewing locked in SAFE MODE.',
            telemetry: this.getEssentialTelemetry()
          };
        }
        const axis = params.axis || 0;
        const targetRpm = params.rpm || 1500;
        if (axis >= 0 && axis <= 2) {
          this.state.navigation.reaction_wheel_rpm[axis] = targetRpm;
        }
        this.state.navigation.attitude.yaw_deg = (this.state.navigation.attitude.yaw_deg + 2.5) % 360;
        return {
          success: true,
          message: `Reaction wheel axis ${axis} adjusted to ${targetRpm} RPM.`,
          telemetry: this.getEssentialTelemetry()
        };

      case 'FIRE_THRUSTER':
        if (this.state.operating_mode === 'SAFE_MODE') {
          return {
            success: false,
            message: 'Execution rejected: Propulsion valves disabled in SAFE MODE.',
            telemetry: this.getEssentialTelemetry()
          };
        }
        const deltaV = params.delta_v || 0.5;
        this.state.navigation.fuel_remaining_kg = Math.max(0, this.state.navigation.fuel_remaining_kg - (deltaV * 0.12));
        this.state.navigation.last_thruster_burn = new Date().toISOString();
        return {
          success: true,
          message: `Station-keeping thruster burn executed (Delta-V: ${deltaV} m/s). Remaining fuel: ${this.state.navigation.fuel_remaining_kg.toFixed(2)} kg.`,
          telemetry: this.getEssentialTelemetry()
        };

      case 'SET_POWER_MODE':
        const mode = params.mode as OperatingMode;
        if (mode && this.state.operating_mode !== 'SAFE_MODE') {
          this.state.operating_mode = mode;
        }
        return {
          success: true,
          message: `Power profile transitioned to ${mode || this.state.operating_mode}.`,
          telemetry: this.getEssentialTelemetry()
        };

      case 'TRANSMIT_DATA':
        this.state.power.battery_percent = Math.max(10, this.state.power.battery_percent - 0.6);
        return {
          success: true,
          message: `X-band telemetry downlink completed (${params.packet_count || 50} packets).`,
          telemetry: this.getEssentialTelemetry()
        };

      case 'SYSTEM_REBOOT':
        this.state.flight_computer.uptime_seconds = 0;
        this.state.flight_computer.cpu_load_percent = 45.0;
        return {
          success: true,
          message: 'Flight computer software warm restart completed.',
          telemetry: this.getEssentialTelemetry()
        };

      case 'EMERGENCY_SAFE_MODE':
        this.enterSafeMode(params.reason || 'Manual Ground Command Emergency Trigger');
        return {
          success: true,
          message: 'Spacecraft placed into protective SAFE MODE.',
          telemetry: this.getEssentialTelemetry()
        };

      case 'OPERATOR_RECOVER':
        this.exitSafeMode();
        return {
          success: true,
          message: 'Flight director recovery authenticated. SAFE MODE cleared; nominal mode restored.',
          telemetry: this.getEssentialTelemetry()
        };

      default:
        return {
          success: true,
          message: `Command ${cmdType} acknowledged.`,
          telemetry: this.getEssentialTelemetry()
        };
    }
  }
}
