-- AlterTable
ALTER TABLE `Product` ADD COLUMN `effectivePrice` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `Product_isActive_effectivePrice_idx` ON `Product`(`isActive`, `effectivePrice`);


-- Fill the new column for existing products.
UPDATE `Product` SET `effectivePrice` = COALESCE(`salePrice`, `price`);
