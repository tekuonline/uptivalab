/*
  Warnings:

  - The `permissions` column on the `ApiKey` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "ApiKey" DROP COLUMN "permissions",
ADD COLUMN     "permissions" TEXT NOT NULL DEFAULT 'READ';

-- DropEnum
DROP TYPE "ApiKeyPermission";
