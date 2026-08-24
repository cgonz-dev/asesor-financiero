-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('active', 'blocked');

-- CreateEnum
CREATE TYPE "household_role" AS ENUM ('owner', 'member');

-- CreateEnum
CREATE TYPE "household_membership_status" AS ENUM ('active', 'suspended', 'left', 'removed');

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "status" "user_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_identity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "email" TEXT,
    "email_verified" BOOLEAN,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "external_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_membership" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "household_role" NOT NULL,
    "status" "household_membership_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "household_membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_external_identity_user_id" ON "external_identity"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_external_identity_issuer_subject" ON "external_identity"("issuer", "subject");

-- CreateIndex
CREATE INDEX "idx_household_membership_household_status" ON "household_membership"("household_id", "status");

-- CreateIndex
CREATE INDEX "idx_household_membership_user_status_household" ON "household_membership"("user_id", "status", "household_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_household_membership_household_user" ON "household_membership"("household_id", "user_id");

-- PostgreSQL partial indexes are intentionally expressed in SQL because their
-- Prisma schema representation still requires a preview feature. This enforces
-- at most one active administrative Owner per Household; the application
-- transaction creates exactly one initial Owner.
CREATE UNIQUE INDEX "uq_household_membership_one_active_owner"
ON "household_membership"("household_id")
WHERE "role" = 'owner' AND "status" = 'active';

-- AddForeignKey
ALTER TABLE "external_identity" ADD CONSTRAINT "external_identity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_membership" ADD CONSTRAINT "household_membership_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_membership" ADD CONSTRAINT "household_membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
