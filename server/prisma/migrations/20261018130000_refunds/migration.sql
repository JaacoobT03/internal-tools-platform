-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('pending_approval', 'paid', 'rejected');

-- CreateTable
CREATE TABLE "refund" (
    "id" UUID NOT NULL,
    "payment_reference" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "card_last4" CHAR(4) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "reason" TEXT NOT NULL,
    "status" "refund_status" NOT NULL,
    "requested_by" TEXT NOT NULL,
    "approval_request_id" UUID,
    "payout_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "refund_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refund_amount_positive" CHECK ("amount_cents" > 0),
    CONSTRAINT "refund_currency_eur" CHECK ("currency" = 'EUR'),
    CONSTRAINT "refund_card_last4_digits" CHECK ("card_last4" ~ '^[0-9]{4}$')
);

-- CreateIndex
CREATE INDEX "refund_status_idx" ON "refund"("status");

-- CreateIndex
CREATE INDEX "refund_payment_reference_idx" ON "refund"("payment_reference");

-- At most one pending or paid refund per payment reference (spec rule 11).
CREATE UNIQUE INDEX "refund_active_payment_reference_key" ON "refund"("payment_reference")
WHERE "status" IN ('pending_approval', 'paid');
