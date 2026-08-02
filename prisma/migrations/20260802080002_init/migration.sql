-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'TECHNICIAN', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'BLOCKED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('AI_ESTIMATION', 'HOME_VISIT');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'WAITING_FOR_TECHNICIAN', 'TECHNICIAN_SELECTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'SELECTED', 'NOT_SELECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "city" VARCHAR(100) NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp" (
    "id" BIGSERIAL NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "otp_code" VARCHAR(10) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "blocked_until" TIMESTAMP(3),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "home_visit_base_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_pricing" (
    "id" BIGSERIAL NOT NULL,
    "category_id" BIGINT NOT NULL,
    "severity" "Severity" NOT NULL,
    "min_price" DECIMAL(10,2) NOT NULL,
    "max_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "category_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_profiles" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "category_id" BIGINT NOT NULL,
    "profile_image" VARCHAR(255),
    "national_id" VARCHAR(255) NOT NULL,
    "criminal_record_file" VARCHAR(255),
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "overall_rating" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "technician_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "technician_id" BIGINT,
    "category_id" BIGINT NOT NULL,
    "request_type" "RequestType" NOT NULL,
    "description" TEXT NOT NULL,
    "service_address" TEXT NOT NULL,
    "service_city" VARCHAR(100) NOT NULL,
    "service_latitude" DECIMAL(10,8) NOT NULL,
    "service_longitude" DECIMAL(11,8) NOT NULL,
    "distance_km" DECIMAL(10,2),
    "visit_fee" DECIMAL(10,2),
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_attachments" (
    "id" BIGSERIAL NOT NULL,
    "request_id" BIGINT NOT NULL,
    "image_url" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_estimations" (
    "id" BIGSERIAL NOT NULL,
    "service_request_id" BIGINT NOT NULL,
    "severity" "Severity" NOT NULL,
    "min_price" DECIMAL(10,2) NOT NULL,
    "max_price" DECIMAL(10,2) NOT NULL,
    "confidence" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_estimations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_offers" (
    "id" BIGSERIAL NOT NULL,
    "service_request_id" BIGINT NOT NULL,
    "technician_id" BIGINT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "accepted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "technician_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_reviews" (
    "id" BIGSERIAL NOT NULL,
    "service_request_id" BIGINT NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "technician_id" BIGINT NOT NULL,
    "actual_paid_price" DECIMAL(10,2) NOT NULL,
    "punctuality" SMALLINT NOT NULL,
    "service_quality" SMALLINT NOT NULL,
    "professionalism" SMALLINT NOT NULL,
    "price_fairness" SMALLINT NOT NULL,
    "rating" DECIMAL(3,2) NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_reviews" (
    "id" BIGSERIAL NOT NULL,
    "service_request_id" BIGINT NOT NULL,
    "technician_id" BIGINT NOT NULL,
    "customer_id" BIGINT NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "technician_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "otp_phone_created_at_idx" ON "otp"("phone", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "category_pricing_category_id_idx" ON "category_pricing"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_pricing_category_id_severity_key" ON "category_pricing"("category_id", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "technician_profiles_user_id_key" ON "technician_profiles"("user_id");

-- CreateIndex
CREATE INDEX "technician_profiles_category_id_is_available_idx" ON "technician_profiles"("category_id", "is_available");

-- CreateIndex
CREATE INDEX "technician_profiles_category_id_idx" ON "technician_profiles"("category_id");

-- CreateIndex
CREATE INDEX "technician_profiles_is_available_idx" ON "technician_profiles"("is_available");

-- CreateIndex
CREATE INDEX "technician_profiles_verification_status_idx" ON "technician_profiles"("verification_status");

-- CreateIndex
CREATE INDEX "service_requests_customer_id_idx" ON "service_requests"("customer_id");

-- CreateIndex
CREATE INDEX "service_requests_technician_id_idx" ON "service_requests"("technician_id");

-- CreateIndex
CREATE INDEX "service_requests_status_idx" ON "service_requests"("status");

-- CreateIndex
CREATE INDEX "service_requests_category_id_idx" ON "service_requests"("category_id");

-- CreateIndex
CREATE INDEX "request_attachments_request_id_idx" ON "request_attachments"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_estimations_service_request_id_key" ON "ai_estimations"("service_request_id");

-- CreateIndex
CREATE INDEX "technician_offers_technician_id_idx" ON "technician_offers"("technician_id");

-- CreateIndex
CREATE INDEX "technician_offers_status_idx" ON "technician_offers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "technician_offers_service_request_id_technician_id_key" ON "technician_offers"("service_request_id", "technician_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_reviews_service_request_id_key" ON "customer_reviews"("service_request_id");

-- CreateIndex
CREATE INDEX "customer_reviews_technician_id_idx" ON "customer_reviews"("technician_id");

-- CreateIndex
CREATE INDEX "customer_reviews_customer_id_idx" ON "customer_reviews"("customer_id");

-- CreateIndex
CREATE INDEX "customer_reviews_actual_paid_price_idx" ON "customer_reviews"("actual_paid_price");

-- CreateIndex
CREATE UNIQUE INDEX "technician_reviews_service_request_id_key" ON "technician_reviews"("service_request_id");

-- CreateIndex
CREATE INDEX "technician_reviews_technician_id_idx" ON "technician_reviews"("technician_id");

-- CreateIndex
CREATE INDEX "technician_reviews_customer_id_idx" ON "technician_reviews"("customer_id");

-- AddForeignKey
ALTER TABLE "category_pricing" ADD CONSTRAINT "category_pricing_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_profiles" ADD CONSTRAINT "technician_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_profiles" ADD CONSTRAINT "technician_profiles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_attachments" ADD CONSTRAINT "request_attachments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_estimations" ADD CONSTRAINT "ai_estimations_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_offers" ADD CONSTRAINT "technician_offers_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_offers" ADD CONSTRAINT "technician_offers_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_reviews" ADD CONSTRAINT "customer_reviews_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_reviews" ADD CONSTRAINT "customer_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_reviews" ADD CONSTRAINT "customer_reviews_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_reviews" ADD CONSTRAINT "technician_reviews_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_reviews" ADD CONSTRAINT "technician_reviews_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_reviews" ADD CONSTRAINT "technician_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
