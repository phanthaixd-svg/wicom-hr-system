-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "larkNotifyActivity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "larkNotifyComment" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "larkNotifyThanks" BOOLEAN NOT NULL DEFAULT true;
