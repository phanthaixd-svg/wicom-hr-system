-- CreateTable
CREATE TABLE "LarkEventLog" (
    "msgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LarkEventLog_pkey" PRIMARY KEY ("msgId")
);
