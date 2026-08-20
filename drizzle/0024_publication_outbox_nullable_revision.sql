-- Make warehouse retract possible for legacy locked rows that never minted a revision.
ALTER TABLE "publication_outbox" ALTER COLUMN "lock_revision_id" DROP NOT NULL;
