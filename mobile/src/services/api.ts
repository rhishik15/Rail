import axios from 'axios';
import { NativeModules, Platform } from 'react-native';
import type {
  CreateInspectionPayload,
  InspectionDetail,
  InspectionListItem,
  LoginResponse,
  LocomotiveOption,
  TemplateOption,
  UpdateInspectionEntryPayload,
} from '../types/inspection';

const getDevServerHost = (): string | null => {
  const scriptURL =
    NativeModules.SourceCode?.scriptURL ??
    NativeModules.PlatformConstants?.scriptURL ??
    null;

  if (typeof scriptURL !== 'string' || scriptURL.trim() === '') {
    return null;
  }

  try {
    return new URL(scriptURL).hostname;
  } catch {
    return null;
  }
};

const getDefaultBaseUrl = (): string => {
  const devServerHost = getDevServerHost();

  if (devServerHost && devServerHost !== 'localhost' && devServerHost !== '127.0.0.1') {
    return `http://${devServerHost}:3000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://127.0.0.1:3000';
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? getDefaultBaseUrl();

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
