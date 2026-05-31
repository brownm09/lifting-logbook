'use server';

import {
  createCustomProgram as apiCreate,
  updateCustomProgram as apiUpdate,
  deleteCustomProgram as apiDelete,
  switchProgram as apiSwitch,
  fetchCustomProgram as apiFetch,
} from '@/lib/api';
import type {
  CreateCustomProgramRequest,
  UpdateCustomProgramRequest,
  CustomProgramResponse,
  SwitchProgramResponse,
} from '@lifting-logbook/types';

export async function createCustomProgram(data: CreateCustomProgramRequest): Promise<CustomProgramResponse> {
  return apiCreate(data);
}

export async function updateCustomProgram(id: string, data: UpdateCustomProgramRequest): Promise<CustomProgramResponse> {
  return apiUpdate(id, data);
}

export async function deleteCustomProgram(id: string): Promise<void> {
  return apiDelete(id);
}

export async function switchProgram(programId: string): Promise<SwitchProgramResponse> {
  return apiSwitch(programId);
}

export async function fetchCustomProgram(id: string): Promise<CustomProgramResponse> {
  return apiFetch(id);
}
