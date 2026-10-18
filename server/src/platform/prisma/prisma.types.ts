import { Prisma } from './generated/client';

/** A Prisma interactive-transaction client (`prisma.$transaction(async (tx) => ...)`). */
export type PrismaTx = Prisma.TransactionClient;
