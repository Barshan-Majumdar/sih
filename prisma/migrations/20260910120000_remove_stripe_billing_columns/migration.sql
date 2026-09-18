-- Remove Stripe billing columns. planTier and the PlanTier enum are kept:
-- they gate product behavior (active project limits, integration access,
-- AI allowances), independent of how a plan change is billed.
ALTER TABLE "organization" DROP COLUMN "stripeCustomerId";
ALTER TABLE "organization" DROP COLUMN "stripeSubscriptionId";
ALTER TABLE "organization" DROP COLUMN "subscriptionStatus";
