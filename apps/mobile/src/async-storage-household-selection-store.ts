import AsyncStorage from '@react-native-async-storage/async-storage';
import { HouseholdIdSchema } from '@copiloto/contracts';

import type { HouseholdSelectionStore } from './household-selection-store';

const SELECTION_KEY_PREFIX = '@copiloto/selected-household/';

export class AsyncStorageHouseholdSelectionStore implements HouseholdSelectionStore {
  async get(internalUserId: string): Promise<string | undefined> {
    const key = this.key(internalUserId);
    const stored = await AsyncStorage.getItem(key);

    if (stored === null) {
      return undefined;
    }

    const parsed = HouseholdIdSchema.safeParse(stored);

    if (!parsed.success) {
      await AsyncStorage.removeItem(key);
      return undefined;
    }

    return parsed.data;
  }

  async set(internalUserId: string, householdId: string | undefined): Promise<void> {
    const key = this.key(internalUserId);

    if (householdId === undefined) {
      await AsyncStorage.removeItem(key);
      return;
    }

    await AsyncStorage.setItem(key, HouseholdIdSchema.parse(householdId));
  }

  private key(internalUserId: string): string {
    return `${SELECTION_KEY_PREFIX}${encodeURIComponent(internalUserId)}`;
  }
}
