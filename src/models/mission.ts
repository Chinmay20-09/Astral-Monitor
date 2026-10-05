export interface OperatingConstraint {
  id: string;
  name: string;
  description: string;
  rule_type: 'POWER_RESTRICTION' | 'THERMAL_RESTRICTION' | 'THRUST_LIMIT' | 'COMM_WINDOW' | 'MODE_LOCK';
  evaluator: string; // human-readable explanation of constraint
}

export interface MissionPhase {
  name: string;
  current: boolean;
  start_time: string;
  end_time: string;
  allowed_commands: string[];
  restricted_commands: string[];
  solar_condition: 'FULL_SUN' | 'PENUMBRA' | 'UMBRA_ECLIPSE';
  description: string;
}

export interface MissionDocument {
  id: string;
  title: string;
  classification: string;
  version: string;
  summary: string;
  content: string;
}

export interface MissionState {
  mission_id: string;
  spacecraft_id: string;
  orbit_altitude_km: number;
  current_phase: MissionPhase;
  all_phases: MissionPhase[];
  active_constraints: OperatingConstraint[];
  mission_documents: MissionDocument[];
}
