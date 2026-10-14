-- AlterTable
ALTER TABLE `Order` ADD COLUMN `consignmentId` VARCHAR(40) NULL,
    ADD COLUMN `courier` VARCHAR(20) NULL,
    ADD COLUMN `courierCheckedAt` DATETIME(3) NULL,
    ADD COLUMN `courierCod` DECIMAL(10, 2) NULL,
    ADD COLUMN `courierLockAt` DATETIME(3) NULL,
    ADD COLUMN `courierSentAt` DATETIME(3) NULL,
    ADD COLUMN `courierSentBy` VARCHAR(120) NULL,
    ADD COLUMN `courierStatus` VARCHAR(50) NULL,
    ADD COLUMN `trackingCode` VARCHAR(40) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Order_consignmentId_key` ON `Order`(`consignmentId`);

