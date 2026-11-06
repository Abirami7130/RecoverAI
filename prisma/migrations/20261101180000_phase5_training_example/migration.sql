-- CreateTable
CREATE TABLE "TrainingExample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "featureJson" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "verifiedSuccess" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingExample_attemptId_key" ON "TrainingExample"("attemptId");

-- CreateIndex
CREATE INDEX "TrainingExample_verifiedSuccess_idx" ON "TrainingExample"("verifiedSuccess");
