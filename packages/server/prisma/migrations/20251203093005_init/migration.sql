-- CreateTable
CREATE TABLE "Ternant" (
    "Id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "Username" TEXT NOT NULL,
    "Password" TEXT NOT NULL,

    CONSTRAINT "Ternant_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Domain" (
    "Id" SERIAL NOT NULL,
    "Key" TEXT NOT NULL,
    "Url" TEXT NOT NULL,
    "Type" INTEGER,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "TernantID" INTEGER NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "DomainReturn" (
    "DomainID" INTEGER NOT NULL,
    "ReturnMethodID" INTEGER NOT NULL,

    CONSTRAINT "DomainReturn_pkey" PRIMARY KEY ("DomainID","ReturnMethodID")
);

-- CreateTable
CREATE TABLE "ReturnMethod" (
    "Id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "Value" TEXT,
    "TargetUrl" TEXT,

    CONSTRAINT "ReturnMethod_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "Id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "DomainID" INTEGER NOT NULL,
    "TriggerEventID" INTEGER NOT NULL,
    "TargetElementID" INTEGER NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "TriggerEvent" (
    "Id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,

    CONSTRAINT "TriggerEvent_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "TargetElement" (
    "Id" SERIAL NOT NULL,
    "Value" TEXT NOT NULL,
    "EventPatternID" INTEGER NOT NULL,
    "OperatorID" INTEGER NOT NULL,

    CONSTRAINT "TargetElement_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Condition" (
    "Id" SERIAL NOT NULL,
    "Value" TEXT NOT NULL,
    "RuleID" INTEGER NOT NULL,
    "EventPatternID" INTEGER NOT NULL,
    "OperatorID" INTEGER NOT NULL,

    CONSTRAINT "Condition_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "PayloadConfig" (
    "PayloadPatternID" INTEGER NOT NULL,
    "RuleID" INTEGER NOT NULL,
    "Value" TEXT,
    "Type" TEXT,
    "OperatorID" INTEGER NOT NULL,

    CONSTRAINT "PayloadConfig_pkey" PRIMARY KEY ("PayloadPatternID","RuleID")
);

-- CreateTable
CREATE TABLE "PayloadPattern" (
    "Id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "Type" TEXT,

    CONSTRAINT "PayloadPattern_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "EventPattern" (
    "Id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,

    CONSTRAINT "EventPattern_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Operator" (
    "Id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ternant_Name_key" ON "Ternant"("Name");

-- CreateIndex
CREATE UNIQUE INDEX "Ternant_Username_key" ON "Ternant"("Username");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_Key_key" ON "Domain"("Key");

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_TernantID_fkey" FOREIGN KEY ("TernantID") REFERENCES "Ternant"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainReturn" ADD CONSTRAINT "DomainReturn_DomainID_fkey" FOREIGN KEY ("DomainID") REFERENCES "Domain"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainReturn" ADD CONSTRAINT "DomainReturn_ReturnMethodID_fkey" FOREIGN KEY ("ReturnMethodID") REFERENCES "ReturnMethod"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_DomainID_fkey" FOREIGN KEY ("DomainID") REFERENCES "Domain"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_TriggerEventID_fkey" FOREIGN KEY ("TriggerEventID") REFERENCES "TriggerEvent"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_TargetElementID_fkey" FOREIGN KEY ("TargetElementID") REFERENCES "TargetElement"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetElement" ADD CONSTRAINT "TargetElement_EventPatternID_fkey" FOREIGN KEY ("EventPatternID") REFERENCES "EventPattern"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetElement" ADD CONSTRAINT "TargetElement_OperatorID_fkey" FOREIGN KEY ("OperatorID") REFERENCES "Operator"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_RuleID_fkey" FOREIGN KEY ("RuleID") REFERENCES "Rule"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_EventPatternID_fkey" FOREIGN KEY ("EventPatternID") REFERENCES "EventPattern"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_OperatorID_fkey" FOREIGN KEY ("OperatorID") REFERENCES "Operator"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayloadConfig" ADD CONSTRAINT "PayloadConfig_PayloadPatternID_fkey" FOREIGN KEY ("PayloadPatternID") REFERENCES "PayloadPattern"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayloadConfig" ADD CONSTRAINT "PayloadConfig_RuleID_fkey" FOREIGN KEY ("RuleID") REFERENCES "Rule"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayloadConfig" ADD CONSTRAINT "PayloadConfig_OperatorID_fkey" FOREIGN KEY ("OperatorID") REFERENCES "Operator"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
