-- AlterTable
ALTER TABLE `Product` ADD COLUMN `lowStockAt` INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE `StockMovement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `variantId` INTEGER NULL,
    `variantName` VARCHAR(120) NULL,
    `change` INTEGER NOT NULL,
    `balance` INTEGER NOT NULL,
    `reason` ENUM('RECEIVED', 'ADJUSTMENT', 'DAMAGED', 'ORDER', 'ORDER_CANCELLED', 'EDIT') NOT NULL,
    `reference` VARCHAR(120) NULL,
    `note` VARCHAR(255) NULL,
    `adminName` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StockMovement_productId_createdAt_idx`(`productId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StockMovement` ADD CONSTRAINT `StockMovement_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

