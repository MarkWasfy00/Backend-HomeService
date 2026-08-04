-- The national id stopped being an upload URL and became the 14 digits off the
-- card, so the column is narrowed to exactly that.
--
-- Any row still holding a "/uploads/..." URL is too long for VARCHAR(14) and
-- will make this fail. Those values were never national ids, so clear them out
-- (or re-seed) before applying this.

-- AlterTable
ALTER TABLE "technician_profiles" ALTER COLUMN "national_id" SET DATA TYPE VARCHAR(14);
