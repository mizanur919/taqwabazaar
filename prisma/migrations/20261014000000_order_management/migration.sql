-- AlterTable
ALTER TABLE `Order` ADD COLUMN `adminNote` VARCHAR(1000) NULL,
    ADD COLUMN `source` VARCHAR(20) NOT NULL DEFAULT 'WEB',
    ADD COLUMN `stockDeducted` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `variantId` INTEGER NULL;

-- CreateTable
CREATE TABLE `OrderStatusLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED') NULL,
    `message` VARCHAR(255) NOT NULL,
    `adminName` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderStatusLog_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Order_status_createdAt_idx` ON `Order`(`status`, `createdAt`);

-- AddForeignKey
ALTER TABLE `OrderStatusLog` ADD CONSTRAINT `OrderStatusLog_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Demo orders never took stock out, so they must not put any back.
UPDATE `Order` SET `stockDeducted` = false WHERE `note` = 'DEMO';
