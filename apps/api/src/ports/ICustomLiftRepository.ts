import { CustomLift, LiftClassification, MovementProfile } from '@lifting-logbook/types';

export interface CreateCustomLiftInput {
  name: string;
  classification: LiftClassification;
  movementProfile?: MovementProfile;
  isBodyweightComponent?: boolean;
}

export interface UpdateCustomLiftPatch {
  name?: string;
  classification?: LiftClassification;
  movementProfile?: MovementProfile;
  isBodyweightComponent?: boolean;
}

/**
 * Per-user store of user-created lifts. The owning userId is bound to the
 * adapter at construction time (via the repository factory), never passed
 * per call — mirroring the other per-user repositories.
 */
export interface ICustomLiftRepository {
  list(): Promise<CustomLift[]>;
  create(input: CreateCustomLiftInput): Promise<CustomLift>;
  update(id: string, patch: UpdateCustomLiftPatch): Promise<CustomLift>;
  delete(id: string): Promise<void>;
}
