-- AlterTable
ALTER TABLE `Order` ADD COLUMN `riskLevel` VARCHAR(10) NULL;

-- CreateTable
CREATE TABLE `FraudCheck` (
    `phone` VARCHAR(20) NOT NULL,
    `total` INTEGER NOT NULL DEFAULT 0,
    `success` INTEGER NOT NULL DEFAULT 0,
    `cancelled` INTEGER NOT NULL DEFAULT 0,
    `couriers` TEXT NOT NULL,
    `reports` TEXT NOT NULL,
    `checkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`phone`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlockedPhone` (
    `phone` VARCHAR(20) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `blockedBy` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`phone`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Order_riskLevel_idx` ON `Order`(`riskLevel`);

