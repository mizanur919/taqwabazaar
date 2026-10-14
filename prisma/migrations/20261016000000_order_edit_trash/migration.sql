-- AlterTable
ALTER TABLE `Order` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedBy` VARCHAR(120) NULL,
    ADD COLUMN `editedAt` DATETIME(3) NULL,
    ADD COLUMN `trashRestocked` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `OrderStatusLog` ADD COLUMN `details` TEXT NULL;

-- AlterTable
ALTER TABLE `StockMovement` MODIFY `reason` ENUM('RECEIVED', 'ADJUSTMENT', 'DAMAGED', 'ORDER', 'ORDER_CANCELLED', 'EDIT', 'ORDER_EDIT', 'ORDER_DELETED') NOT NULL;

-- CreateIndex
CREATE INDEX `Order_deletedAt_idx` ON `Order`(`deletedAt`);


