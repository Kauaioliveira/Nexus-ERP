-- CreateEnum
CREATE TYPE "FiscalModel" AS ENUM ('NFE', 'NFCE');

-- AlterEnum


ALTER TYPE "FiscalStatus" ADD VALUE 'REJECTED';
ALTER TYPE "FiscalStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "city" TEXT,
ADD COLUMN     "cityCode" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "zipCode" TEXT;

-- AlterTable
ALTER TABLE "fiscal_documents" ADD COLUMN     "accessKey" TEXT,
ADD COLUMN     "authorizedAt" TIMESTAMP(3),
ADD COLUMN     "buyerDocument" TEXT,
ADD COLUMN     "cancelProtocol" TEXT,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelXml" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "environment" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "model" "FiscalModel" NOT NULL DEFAULT 'NFCE',
ADD COLUMN     "number" INTEGER,
ADD COLUMN     "protocol" TEXT,
ADD COLUMN     "qrCodeUrl" TEXT,
ADD COLUMN     "series" INTEGER,
ADD COLUMN     "statusCode" INTEGER,
ADD COLUMN     "statusMessage" TEXT,
ADD COLUMN     "xml" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "cest" TEXT,
ADD COLUMN     "cfop" TEXT NOT NULL DEFAULT '5102',
ADD COLUMN     "csosn" TEXT NOT NULL DEFAULT '102',
ADD COLUMN     "ncm" TEXT,
ADD COLUMN     "origin" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "company_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "cnpj" TEXT NOT NULL,
    "stateRegistration" TEXT NOT NULL,
    "taxRegime" INTEGER NOT NULL DEFAULT 1,
    "zipCode" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "cityCode" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "phone" TEXT,
    "environment" INTEGER NOT NULL DEFAULT 2,
    "nfeSeries" INTEGER NOT NULL DEFAULT 1,
    "nfeNextNumber" INTEGER NOT NULL DEFAULT 1,
    "nfceSeries" INTEGER NOT NULL DEFAULT 1,
    "nfceNextNumber" INTEGER NOT NULL DEFAULT 1,
    "cscId" TEXT NOT NULL DEFAULT '000001',
    "cscToken" TEXT NOT NULL,
    "simulateSefazOffline" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_documents_accessKey_key" ON "fiscal_documents"("accessKey");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_documents_model_series_number_key" ON "fiscal_documents"("model", "series", "number");

