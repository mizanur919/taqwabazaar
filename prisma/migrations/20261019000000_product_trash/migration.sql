-- AlterTable
ALTER TABLE `Product` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `deletedBy` VARCHAR(120) NULL;

-- CreateIndex
CREATE INDEX `Product_deletedAt_idx` ON `Product`(`deletedAt`);
