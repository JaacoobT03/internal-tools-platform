-- CreateEnum
CREATE TYPE "approval_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "audit_entry" (
    "id" UUID NOT NULL,
    "actor" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_request" (
    "id" UUID NOT NULL,
    "action_name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "approval_status" NOT NULL DEFAULT 'pending',
    "requested_by" TEXT NOT NULL,
    "decided_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(3),

    CONSTRAINT "approval_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_entry_entity_entity_id_idx" ON "audit_entry"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_entry_timestamp_idx" ON "audit_entry"("timestamp");

-- CreateIndex
CREATE INDEX "approval_request_status_idx" ON "approval_request"("status");

-- Append-only audit log (ADR 0003): reject every UPDATE, DELETE and TRUNCATE.
-- A statement-level trigger is used because TRUNCATE does not fire row-level
-- triggers. Caveat: the application currently connects as the table owner,
-- who could still drop this trigger; see README "Next steps".
CREATE FUNCTION "audit_entry_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_entry is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "audit_entry_append_only"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "audit_entry"
FOR EACH STATEMENT EXECUTE FUNCTION "audit_entry_append_only"();
