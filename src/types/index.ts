import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  created_at: string;
}

export type ProjectRole = 
  | 'owner'      // Full project access and management
  | 'team_manager'    // Can manage team and production
  | 'operator'   // Basic data entry
  | 'quality_technician'    // Quality control access
  | 'maintenance_technician'; // Maintenance access

export interface TeamMember {
  id: string;
  project_id: string;
  email: string;
  role: ProjectRole;
  status: 'pending' | 'active' | 'inactive';
  invited_at?: string;
  joined_at?: string;
  created_at: string;
  updated_at: string;
  machine_id?: string; // Optional for operator role
  line_id?: string;    // Optional for team_manager role
  team_name: string;
  working_time_minutes: number;
}

export interface PlantConfig {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  opening_time_minutes: number;
  address?: string;
  place_id?: string;
  latitude?: number;
  longitude?: number;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface ProductionLine {
  id: string;
  project_id: string;
  plant_config_id: string;
  name: string;
  line_id?: string;
  description?: string;
  opening_time_minutes: number;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface Machine {
  id: string;
  project_id: string;
  line_id: string;
  name: string;
  description?: string;
  opening_time_minutes?: number;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  project_id: string;
  machine_id: string;
  name: string;
  product_id?: string;
  description?: string;
  cycle_time: number;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface TeamRole {
  id: ProjectRole;
  name: string;
  description: string;
  scope: 'project' | 'line' | 'machine' | 'none';
}

export interface LotData {
  id?: string;
  project_id?: string;
  date: string;
  start_time: string;
  end_time: string;
  team_member: string;
  product: string;
  machine: string;
  lot_id?: string;
  lot_size: number;
  theoretical_lot_size?: number;
  ok_parts_produced: number;
  auto_ok_parts_produced?: number;
  comment?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LotTracking {
  id?: string;
  lot_id: string;
  date: string;
  start_time: string;
  end_time: string;
  parts_produced: number;
  comment?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StopEvent {
  date: string;
  start_time: string;
  end_time: string;
  team_member: string;
  product: string;
  failure_type: string;
  machine: string;
  cause: string;
  comment?: string;
}

export interface QualityIssue {
  id?: string;
  project_id: string;
  date: string;
  start_time: string;
  end_time?: string;
  team_member: string;
  product: string;
  machine: string;
  category: 'at_station_rework' | 'off_station_rework' | 'scrap';
  quantity: number;
  cause: string;
  comment?: string;
  lot_id?: string;
  status?: 'ongoing' | 'completed';
  created_at?: string;
  updated_at?: string;
}

export interface ExcelImportResult {
  errors: Array<{
    sheet: string;
    row: number;
    message: string;
  }>;
  lots?: LotData[];
  stops?: StopEvent[];
  quality?: QualityIssue[];
}

export interface PlantExcelData {
  name: string;
  opening_time_minutes: number;
  description?: string;
  address: string;
}

export interface ProductionLineExcelData {
  name: string;
  line_id?: string;
  description?: string;
  opening_time_minutes: number;
}

export interface MachineExcelData {
  name: string;
  line_name: string;
  description?: string;
  opening_time_minutes?: number;
}

export interface ProductExcelData {
  name: string;
  product_id?: string;
  machine_name: string;
  cycle_time: number;
  description?: string;
}

export interface TeamExcelData {
  email: string;
  role: string;
  team_name: string;
  machine_name: string;
  working_time_minutes: number;
}

export type EmailTemplate = 
  | 'WELCOME'
  | 'TEAM_INVITE'
  | 'SUBSCRIPTION_STARTED'
  | 'MACHINE_LIMIT_WARNING'
  | 'PAYMENT_FAILED';

export const FAILURE_TYPES = [
  { code: 'AP', name: 'Planned downtime' },
  { code: 'PA', name: 'Equipment breakdown' },
  { code: 'DO', name: 'Organized malfunction' },
  { code: 'NQ', name: 'Non-quality issue' },
  { code: 'CS', name: 'Series change' }
] as const;