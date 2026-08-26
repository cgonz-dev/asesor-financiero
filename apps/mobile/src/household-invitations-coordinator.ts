import type {
  HouseholdInvitationSummary,
  HouseholdMemberSummary,
  HouseholdSummary,
} from '@copiloto/contracts';

import type { HouseholdInvitationsApiClient } from './household-invitations-api-client';

export type HouseholdInvitationsStatus =
  'accepted' | 'accepting' | 'creating' | 'error' | 'idle' | 'loading' | 'ready' | 'revoking';

export interface HouseholdInvitationsSnapshot {
  acceptedHousehold?: HouseholdSummary;
  invitations: HouseholdInvitationSummary[];
  members: HouseholdMemberSummary[];
  message?: string;
  rawInvitationToken?: string;
  status: HouseholdInvitationsStatus;
}

type Listener = (snapshot: HouseholdInvitationsSnapshot) => void;

export class HouseholdInvitationsCoordinator {
  private activeController: AbortController | undefined;
  private acceptFlight: Promise<HouseholdSummary | undefined> | undefined;
  private createFlight: Promise<void> | undefined;
  private currentHouseholdId: string | undefined;
  private currentUserId: string | undefined;
  private generation = 0;
  private readonly listeners = new Set<Listener>();
  private revokeFlight: Promise<void> | undefined;
  private snapshot: HouseholdInvitationsSnapshot = {
    invitations: [],
    members: [],
    status: 'idle',
  };

  constructor(
    private readonly client: Pick<
      HouseholdInvitationsApiClient,
      'accept' | 'create' | 'list' | 'listMembers' | 'revoke'
    >,
  ) {}

  currentSnapshot(): HouseholdInvitationsSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  activateForUser(internalUserId: string): void {
    if (this.currentUserId === internalUserId) {
      return;
    }

    this.clearMemory();
    this.currentUserId = internalUserId;
  }

  async loadForHousehold(
    internalUserId: string,
    householdId: string,
    isOwner: boolean,
  ): Promise<void> {
    const generation = ++this.generation;
    this.activeController?.abort();
    const controller = new AbortController();
    this.activeController = controller;
    this.currentUserId = internalUserId;
    this.currentHouseholdId = householdId;
    this.transition({ invitations: [], members: [], status: 'loading' });

    try {
      const [members, invitations] = await Promise.all([
        this.client.listMembers(householdId, { signal: controller.signal }),
        isOwner
          ? this.client.list(householdId, { signal: controller.signal })
          : Promise.resolve({ invitations: [] }),
      ]);

      if (!this.isCurrent(generation, internalUserId, householdId)) {
        return;
      }

      this.transition({
        invitations: invitations.invitations,
        members: members.members,
        status: 'ready',
      });
    } catch (error: unknown) {
      if (controller.signal.aborted || !this.isCurrent(generation, internalUserId, householdId)) {
        return;
      }

      this.transition({
        invitations: [],
        members: [],
        message: this.messageFor(error),
        status: 'error',
      });
    } finally {
      if (this.activeController === controller) {
        this.activeController = undefined;
      }
    }
  }

  createInvitation(
    internalUserId: string,
    householdId: string,
    targetEmail: string,
  ): Promise<void> {
    if (this.createFlight !== undefined) {
      return this.createFlight;
    }

    const operation = this.performCreate(internalUserId, householdId, targetEmail).finally(() => {
      if (this.createFlight === operation) {
        this.createFlight = undefined;
      }
    });
    this.createFlight = operation;
    return operation;
  }

  revokeInvitation(
    internalUserId: string,
    householdId: string,
    invitationId: string,
  ): Promise<void> {
    if (this.revokeFlight !== undefined) {
      return this.revokeFlight;
    }

    const operation = this.performRevoke(internalUserId, householdId, invitationId).finally(() => {
      if (this.revokeFlight === operation) {
        this.revokeFlight = undefined;
      }
    });
    this.revokeFlight = operation;
    return operation;
  }

  acceptInvitation(
    internalUserId: string,
    invitationToken: string,
  ): Promise<HouseholdSummary | undefined> {
    if (this.acceptFlight !== undefined) {
      return this.acceptFlight;
    }

    const operation = this.performAccept(internalUserId, invitationToken).finally(() => {
      if (this.acceptFlight === operation) {
        this.acceptFlight = undefined;
      }
    });
    this.acceptFlight = operation;
    return operation;
  }

  dismissRawInvitationToken(): void {
    if (this.snapshot.rawInvitationToken === undefined) {
      return;
    }

    const safeSnapshot = { ...this.snapshot };
    delete safeSnapshot.rawInvitationToken;
    this.transition(safeSnapshot);
  }

  clearMemory(): void {
    ++this.generation;
    this.activeController?.abort();
    this.activeController = undefined;
    this.acceptFlight = undefined;
    this.createFlight = undefined;
    this.revokeFlight = undefined;
    this.currentHouseholdId = undefined;
    this.currentUserId = undefined;
    this.transition({ invitations: [], members: [], status: 'idle' });
  }

  private async performCreate(
    internalUserId: string,
    householdId: string,
    targetEmail: string,
  ): Promise<void> {
    if (!this.matchesContext(internalUserId, householdId)) {
      return;
    }

    const generation = this.generation;
    const controller = new AbortController();
    this.activeController?.abort();
    this.activeController = controller;
    this.transition({
      invitations: this.snapshot.invitations,
      members: this.snapshot.members,
      status: 'creating',
    });

    try {
      const created = await this.client.create(
        householdId,
        { targetEmail },
        { signal: controller.signal },
      );

      if (!this.isCurrent(generation, internalUserId, householdId)) {
        return;
      }

      this.transition({
        invitations: [
          created.invitation,
          ...this.snapshot.invitations.filter(({ id }) => id !== created.invitation.id),
        ],
        members: this.snapshot.members,
        rawInvitationToken: created.invitationToken,
        status: 'ready',
      });
    } catch (error: unknown) {
      if (controller.signal.aborted || !this.isCurrent(generation, internalUserId, householdId)) {
        return;
      }

      this.transition({
        invitations: this.snapshot.invitations,
        members: this.snapshot.members,
        message: this.messageFor(error),
        status: 'error',
      });
    } finally {
      if (this.activeController === controller) {
        this.activeController = undefined;
      }
    }
  }

  private async performRevoke(
    internalUserId: string,
    householdId: string,
    invitationId: string,
  ): Promise<void> {
    if (!this.matchesContext(internalUserId, householdId)) {
      return;
    }

    const generation = this.generation;
    const controller = new AbortController();
    this.activeController?.abort();
    this.activeController = controller;
    this.transition({
      invitations: this.snapshot.invitations,
      members: this.snapshot.members,
      status: 'revoking',
    });

    try {
      const revoked = await this.client.revoke(householdId, invitationId, {
        signal: controller.signal,
      });

      if (!this.isCurrent(generation, internalUserId, householdId)) {
        return;
      }

      this.transition({
        invitations: this.snapshot.invitations.map((invitation) =>
          invitation.id === revoked.invitation.id ? revoked.invitation : invitation,
        ),
        members: this.snapshot.members,
        status: 'ready',
      });
    } catch (error: unknown) {
      if (controller.signal.aborted || !this.isCurrent(generation, internalUserId, householdId)) {
        return;
      }

      this.transition({
        invitations: this.snapshot.invitations,
        members: this.snapshot.members,
        message: this.messageFor(error),
        status: 'error',
      });
    } finally {
      if (this.activeController === controller) {
        this.activeController = undefined;
      }
    }
  }

  private async performAccept(
    internalUserId: string,
    invitationToken: string,
  ): Promise<HouseholdSummary | undefined> {
    if (this.currentUserId !== internalUserId) {
      return undefined;
    }

    const generation = this.generation;
    const controller = new AbortController();
    this.activeController?.abort();
    this.activeController = controller;
    this.transition({
      invitations: this.snapshot.invitations,
      members: this.snapshot.members,
      status: 'accepting',
    });

    try {
      const { household } = await this.client.accept(
        { invitationToken },
        { signal: controller.signal },
      );

      if (generation !== this.generation || this.currentUserId !== internalUserId) {
        return undefined;
      }

      this.transition({
        acceptedHousehold: household,
        invitations: this.snapshot.invitations,
        members: this.snapshot.members,
        status: 'accepted',
      });
      return household;
    } catch (error: unknown) {
      if (controller.signal.aborted || generation !== this.generation) {
        return undefined;
      }

      this.transition({
        invitations: this.snapshot.invitations,
        members: this.snapshot.members,
        message: this.messageFor(error, true),
        status: 'error',
      });
      return undefined;
    } finally {
      if (this.activeController === controller) {
        this.activeController = undefined;
      }
    }
  }

  private matchesContext(internalUserId: string, householdId: string): boolean {
    return this.currentUserId === internalUserId && this.currentHouseholdId === householdId;
  }

  private isCurrent(generation: number, internalUserId: string, householdId: string): boolean {
    return generation === this.generation && this.matchesContext(internalUserId, householdId);
  }

  private messageFor(error: unknown, accepting = false): string {
    if (accepting && typeof error === 'object' && error !== null && 'status' in error) {
      return 'La invitación no es válida o ya no está disponible.';
    }

    return typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'network'
      ? 'No pudimos conectar con la API.'
      : 'No pudimos actualizar las invitaciones del hogar.';
  }

  private transition(snapshot: HouseholdInvitationsSnapshot): void {
    this.snapshot = snapshot;

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
