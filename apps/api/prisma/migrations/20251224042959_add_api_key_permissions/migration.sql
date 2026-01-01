-- CreateEnum
CREATE TYPE "ApiKeyPermission" AS ENUM ('READ', 'WRITE');

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "permissions" "ApiKeyPermission" NOT NULL DEFAULT 'READ';

-- CreateIndex
CREATE INDEX "UserInvitation_token_idx" ON "UserInvitation"("token");
