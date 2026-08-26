export interface HouseholdSelectionStore {
  get(internalUserId: string): Promise<string | undefined>;
  set(internalUserId: string, householdId: string | undefined): Promise<void>;
}
