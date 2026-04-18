import axios from 'axios';
import type {
  CreateInspectionPayload,
  InspectionDetail,
  InspectionListItem,
  LoginResponse,
  LocomotiveOption,
  TemplateOption,
  UpdateInspectionEntryPayload,
} from '../types/inspection';

const API_BASE_URL = 'http://192.168.1.103:3000';

type TokenGetter = () => Promise<string | null> | string | null;

let tokenGetter: TokenGetter = () => null;

export const setTokenGetter = (getter: TokenGetter) => {
  tokenGetter = getter;
};

const getToken = async (): Promise<string | null> => {
  const token = await tokenGetter();
  return token ?? null;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  }
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export interface LoginPayload {
  employeeId: string;
  password: string;
  deviceId: string;
}

export const login = async (payload: LoginPayload): Promise<LoginResponse> => {
  const { data } = await api.post<LoginResponse>('/auth/login', payload);
  return data;
};

export const getInspections = async (): Promise<InspectionListItem[]> => {
  const { data } = await api.get<InspectionListItem[]>('/inspections');
  return data;
};

export const getLocomotives = async (): Promise<LocomotiveOption[]> => {
  const { data } = await api.get<LocomotiveOption[]>('/locomotives');
  return data;
};

export const getTemplates = async (): Promise<TemplateOption[]> => {
  const { data } = await api.get<TemplateOption[]>('/templates');
  return data;
};

export const createInspection = async (
  payload: CreateInspectionPayload,
): Promise<InspectionDetail> => {
  const { data } = await api.post<InspectionDetail>('/inspections', payload);
  return data;
};

export const getInspectionById = async (inspectionId: string): Promise<InspectionDetail> => {
  const { data } = await api.get<InspectionDetail>(`/inspections/${inspectionId}`);
  return data;
};

export const updateInspectionEntries = async (
  inspectionId: string,
  entries: UpdateInspectionEntryPayload[],
): Promise<InspectionDetail> => {
  const { data } = await api.put<InspectionDetail>(`/inspections/${inspectionId}/entries`, {
    entries,
  });

  return data;
};

export const submitInspection = async (inspectionId: string): Promise<InspectionDetail> => {
  const { data } = await api.post<InspectionDetail>(`/inspections/${inspectionId}/submit`);
  return data;
};

export default api;
