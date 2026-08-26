-- CreateTable
CREATE TABLE "household_invitation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "created_by_membership_id" UUID NOT NULL,
    "target_email" VARCHAR(320) NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "accepted_at" TIMESTAMPTZ(3),
    "accepted_by_user_id" UUID,

    CONSTRAINT "household_invitation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "household_invitation_token_hash_length" CHECK (octet_length("token_hash") = 32),
    CONSTRAINT "household_invitation_target_email_normalized" CHECK (
        "target_email" = lower(btrim("target_email")) AND char_length("target_email") > 0
    ),
    CONSTRAINT "household_invitation_expiration_after_creation" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "household_invitation_terminal_state" CHECK (
        NOT ("accepted_at" IS NOT NULL AND "revoked_at" IS NOT NULL)
    ),
    CONSTRAINT "household_invitation_acceptance_actor" CHECK (
        ("accepted_at" IS NULL AND "accepted_by_user_id" IS NULL)
        OR ("accepted_at" IS NOT NULL AND "accepted_by_user_id" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "result" VARCHAR(32) NOT NULL,
    "resource_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_household_invitation_token_hash" ON "household_invitation"("token_hash");

-- CreateIndex
CREATE INDEX "idx_household_invitation_household_created" ON "household_invitation"("household_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_household_invitation_household_state" ON "household_invitation"("household_id", "revoked_at", "accepted_at");

-- CreateIndex
CREATE INDEX "idx_audit_event_household_created" ON "audit_event"("household_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_event_actor_created" ON "audit_event"("actor_user_id", "created_at");

-- Composite key prevents an invitation creator from being related across Households.
CREATE UNIQUE INDEX "uq_household_membership_id_household" ON "household_membership"("id", "household_id");

-- AddForeignKey
ALTER TABLE "household_invitation" ADD CONSTRAINT "household_invitation_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_invitation" ADD CONSTRAINT "household_invitation_created_by_membership_id_household_id_fkey" FOREIGN KEY ("created_by_membership_id", "household_id") REFERENCES "household_membership"("id", "household_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_invitation" ADD CONSTRAINT "household_invitation_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
