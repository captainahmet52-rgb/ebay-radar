-- AlterTable
ALTER TABLE "User" ADD COLUMN "amazonUploadSchedule" TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE "User" ADD COLUMN "amazonUploadScheduleHour" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "AmazonAutoUploadLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "productsUploaded" INTEGER NOT NULL DEFAULT 0,
    "productsSkipped" INTEGER NOT NULL DEFAULT 0,
    "productsChecked" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonAutoUploadLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AmazonAutoUploadLog" ADD CONSTRAINT "AmazonAutoUploadLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
