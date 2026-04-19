import axios from 'axios';

import { clearStoredAuth, getStoredToken, type AuthUser } from './auth';

export interface LoginInput {
  employeeId: string;
  password: string;
  deviceId: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface InspectionListItem {
  id: string;
  status: string;
  createdAt: string;
  locomotive: {
    locoNumber: string;
  };
  template: {
    name: string;
  };
}

export interface InspectionEntry {
  id: string;
  templateItemId: string;
  value: string;
  isFlagged: boolean;
  remarks: string | null;
  templateItem: {
    id: string;
    label: string;
    inputType: 'NUMBER' | 'TEXT' | 'CHECKBOX' | 'DROPDOWN';
    minValue: number | null;
    maxValue: number | null;
    isMandatory: boolean;
    section: string;
  };
}

export interface InspectionDetail {
  id: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  locomotive: {
    id: string;
    locoNumber: string;
    shed: string;
    type: string;
    createdAt: string;
    updatedAt: string;
  };
  template: {
    id: string;
    name: string;
    version: number;
    isActive: boolean;
    createdAt: string;
  };
  entries: InspectionEntry[];
}

const api = axios.create({
  baseURL: '/api',
  timeout: 5000,
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearStoredAuth();
    }

    return Promise.reject(error);
  },
);

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;

    if (typeof message === 'string' && message.trim() !== '') {
      return message;
    }
  }

  return fallback;
};

export const login = async (input: LoginInput): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/auth/login', input);
  return response.data;
};

export const getInspections = async (): Promise<InspectionListItem[]> => {
  const response = await api.get<InspectionListItem[]>('/inspections');
  return response.data;
};

export const getInspectionById = async (id: string): Promise<InspectionDetail> => {
  const response = await api.get<InspectionDetail>(`/inspections/${id}`);
  return response.data;
};

export const approveInspection = async (id: string): Promise<void> => {
  await api.post(`/inspections/${id}/approve`);
};

export const rejectInspection = async (id: string, comments: string): Promise<void> => {
  await api.post(`/inspections/${id}/reject`, { comments });
};
