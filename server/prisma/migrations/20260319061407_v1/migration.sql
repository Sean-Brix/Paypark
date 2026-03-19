-- CreateTable
CREATE TABLE `Settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kioskId` VARCHAR(191) NOT NULL,
    `kioskName` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `carPrice` DECIMAL(10, 2) NOT NULL,
    `motorcyclePrice` DECIMAL(10, 2) NOT NULL,
    `ebikePrice` DECIMAL(10, 2) NOT NULL,
    `openTime` VARCHAR(191) NOT NULL,
    `closeTime` VARCHAR(191) NOT NULL,
    `receiptHeader` VARCHAR(191) NOT NULL,
    `receiptFooter` VARCHAR(191) NOT NULL,
    `systemVersion` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Settings_kioskId_key`(`kioskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Admin` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `initials` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `lastLogin` DATETIME(3) NULL,

    UNIQUE INDEX `Admin_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vehicle` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `sub` VARCHAR(191) NOT NULL,
    `priceKey` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `kioskId` VARCHAR(191) NOT NULL,
    `controlNumber` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Transaction_controlNumber_key`(`controlNumber`),
    INDEX `Transaction_timestamp_idx`(`timestamp`),
    INDEX `Transaction_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Expense` (
    `id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Expense_date_idx`(`date`),
    INDEX `Expense_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
