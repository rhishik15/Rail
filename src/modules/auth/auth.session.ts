export const MAX_INSPECTIONS_PER_SESSION = 25;

export interface InspectionSessionState {
  userId: string;
  completedInspections: number;
  maxInspections: number;
  requiresRelogin: boolean;
}

export const createInspectionSessionState = (
  userId: string,
  completedInspections = 0,
): InspectionSessionState => ({
  userId,
  completedInspections,
  maxInspections: MAX_INSPECTIONS_PER_SESSION,
  requiresRelogin: completedInspections >= MAX_INSPECTIONS_PER_SESSION,
});

export const registerInspectionAgainstSession = (
  session: InspectionSessionState,
): InspectionSessionState => {
  const completedInspections = session.completedInspections + 1;

  return {
    ...session,
    completedInspections,
    requiresRelogin: completedInspections >= session.maxInspections,
  };
};

export const shouldForceRelogin = (session: InspectionSessionState): boolean =>
  session.requiresRelogin;
