-- DropForeignKey
ALTER TABLE "PaymentCountryGroup" DROP CONSTRAINT "PaymentCountryGroup_providerId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentCountryGroupMember" DROP CONSTRAINT "PaymentCountryGroupMember_groupId_fkey";

-- DropTable
DROP TABLE "EntitlementSnapshot";

-- DropTable
DROP TABLE "PaymentCountryGroup";

-- DropTable
DROP TABLE "PaymentCountryGroupMember";

-- DropTable
DROP TABLE "PaymentJournalLine";

-- DropTable
DROP TABLE "ProfileCompletionRule";

