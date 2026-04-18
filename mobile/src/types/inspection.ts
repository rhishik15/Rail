export type TemplateInputType = 'NUMBER' | 'TEXT' | 'CHECKBOX' | 'DROPDOWN';
export type InspectionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type UserRole =
  | 'WORKER'
  | 'SUPERVISOR'
  | 'SENIOR_SUPERVISOR'
  | 'ADMIN'
  | 'AUDITOR';

export interface AuthUser {
  id: string;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface InspectionListItem {
  id: string;
  status: InspectionStatus;
  createdAt?: string;
  locomotive?: {
    locoNumber: string;
  };
  template?: {
    name: string;
  };
}

export interface LocomotiveOption {
  id: string;
  locoNumber: string;
}

export interface TemplateOption {
  id: string;
  name: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  createdAt: string;
}

export interface TemplateItemDetails {
  id: string;
  label: string;
  inputType: TemplateInputType;
  minValue: number | null;
  maxValue: number | null;
  isMandatory: boolean;
  section: string;
}

export interface InspectionEntry {
  id: string;
  value: string;
  isFlagged: boolean;
  remarks: string | null;
  templateItem: TemplateItemDetails;
}

export interface LocomotiveSummary {
  id: string;
  locoNumber: string;
  shed: string;
  type: string;
}

export interface InspectionDetail {
  id: string;
  status: InspectionStatus;
  rejectionReason: string | null;
  createdAt?: string;
  locomotive: LocomotiveSummary;
  template: TemplateSummary;
  entries: InspectionEntry[];
}

export interface UpdateInspectionEntryPayload {
  entryId: string;
  value: string;
  remarks?: string;
}

export interface CreateInspectionPayload {
  locoId: string;
  templateId: string;
}
