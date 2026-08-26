import type { HouseholdSummary } from '@copiloto/contracts';

import type { HouseholdSelectionStore } from './household-selection-store';
import type { HouseholdsApiClient } from './households-api-client';

export type HouseholdsStatus = 'creating' | 'empty' | 'error' | 'idle' | 'loading' | 'ready';

export interface HouseholdsSnapshot {
  households: HouseholdSummary[];
  message?: string;
  selectedHouseholdId?: string;
  status: HouseholdsStatus;
}

type HouseholdsListener = (snapshot: HouseholdsSnapshot) => void;

export class HouseholdsCoordinator {
  private activeController: AbortController | undefined;
  private createFlight: Promise<void> | undefined;
  private currentUserId: string | undefined;
  private generation = 0;
  private readonly listeners = new Set<HouseholdsListener>();
  private snapshot: HouseholdsSnapshot = { households: [], status: 'idle' };

  constructor(
    private readonly client: Pick<HouseholdsApiClient, 'create' | 'list'>,
    private readonly selectionStore: HouseholdSelectionStore,
  ) {}

  currentSnapshot(): HouseholdsSnapshot {
    return this.snapshot;
  }

  subscribe(listener: HouseholdsListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async loadForUser(internalUserId: string): Promise<void> {
    const generation = ++this.generation;
    this.activeController?.abort();
    const controller = new AbortController();
    this.activeController = controller;
    this.currentUserId = internalUserId;
    this.transition({ households: [], status: 'loading' });

    try {
      const [{ households }, storedSelection] = await Promise.all([
        this.client.list({ signal: controller.signal }),
        this.safeGetSelection(internalUserId),
      ]);

      if (!this.isCurrent(generation, internalUserId)) {
        return;
      }

      let selectedHouseholdId = households.some(({ id }) => id === storedSelection)
        ? storedSelection
        : undefined;

      if (selectedHouseholdId === undefined && households.length === 1) {
        selectedHouseholdId = households[0]?.id;
      }

      if (selectedHouseholdId !== storedSelection) {
        await this.safeSetSelection(internalUserId, selectedHouseholdId);
      }

      this.finishIfCurrent(generation, internalUserId, {
        households,
        ...(selectedHouseholdId === undefined ? {} : { selectedHouseholdId }),
        status: households.length === 0 ? 'empty' : 'ready',
      });
    } catch (error: unknown) {
      if (controller.signal.aborted || !this.isCurrent(generation, internalUserId)) {
        return;
      }

      this.transition({
        households: [],
        message: this.messageFor(error),
        status: 'error',
      });
    } finally {
      if (this.activeController === controller) {
        this.activeController = undefined;
      }
    }
  }

  createHousehold(internalUserId: string, name: string): Promise<void> {
    if (this.createFlight !== undefined) {
      return this.createFlight;
    }

    const operation = this.performCreate(internalUserId, name).finally(() => {
      if (this.createFlight === operation) {
        this.createFlight = undefined;
      }
    });
    this.createFlight = operation;
    return operation;
  }

  async selectHousehold(internalUserId: string, householdId: string): Promise<void> {
    if (
      this.currentUserId !== internalUserId ||
      !this.snapshot.households.some(({ id }) => id === householdId)
    ) {
      return;
    }

    this.transition({
      households: this.snapshot.households,
      selectedHouseholdId: householdId,
      status: 'ready',
    });
    await this.safeSetSelection(internalUserId, householdId);
  }

  clearMemory(): void {
    ++this.generation;
    this.activeController?.abort();
    this.activeController = undefined;
    this.createFlight = undefined;
    this.currentUserId = undefined;
    this.transition({ households: [], status: 'idle' });
  }

  private async performCreate(internalUserId: string, name: string): Promise<void> {
    if (this.currentUserId !== internalUserId) {
      return;
    }

    const generation = this.generation;
    const controller = new AbortController();
    this.activeController?.abort();
    this.activeController = controller;
    this.transition({
      households: this.snapshot.households,
      ...(this.snapshot.selectedHouseholdId === undefined
        ? {}
        : { selectedHouseholdId: this.snapshot.selectedHouseholdId }),
      status: 'creating',
    });

    try {
      const created = await this.client.create({ name }, { signal: controller.signal });

      if (!this.isCurrent(generation, internalUserId)) {
        return;
      }

      const households = [
        ...this.snapshot.households.filter(({ id }) => id !== created.id),
        created,
      ];
      await this.safeSetSelection(internalUserId, created.id);
      this.finishIfCurrent(generation, internalUserId, {
        households,
        selectedHouseholdId: created.id,
        status: 'ready',
      });
    } catch (error: unknown) {
      if (controller.signal.aborted || !this.isCurrent(generation, internalUserId)) {
        return;
      }

      this.transition({
        households: this.snapshot.households,
        message: this.messageFor(error),
        ...(this.snapshot.selectedHouseholdId === undefined
          ? {}
          : { selectedHouseholdId: this.snapshot.selectedHouseholdId }),
        status: 'error',
      });
    } finally {
      if (this.activeController === controller) {
        this.activeController = undefined;
      }
    }
  }

  private isCurrent(generation: number, internalUserId: string): boolean {
    return generation === this.generation && this.currentUserId === internalUserId;
  }

  private finishIfCurrent(
    generation: number,
    internalUserId: string,
    snapshot: HouseholdsSnapshot,
  ): void {
    if (this.isCurrent(generation, internalUserId)) {
      this.transition(snapshot);
    }
  }

  private async safeGetSelection(internalUserId: string): Promise<string | undefined> {
    try {
      return await this.selectionStore.get(internalUserId);
    } catch {
      return undefined;
    }
  }

  private async safeSetSelection(
    internalUserId: string,
    householdId: string | undefined,
  ): Promise<void> {
    try {
      await this.selectionStore.set(internalUserId, householdId);
    } catch {
      // A preference failure never fabricates membership or blocks the authorized list.
    }
  }

  private messageFor(error: unknown): string {
    return typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'network'
      ? 'No pudimos consultar tus hogares por un problema de red.'
      : 'No pudimos actualizar tus hogares.';
  }

  private transition(snapshot: HouseholdsSnapshot): void {
    this.snapshot = snapshot;

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
