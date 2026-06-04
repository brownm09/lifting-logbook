import type { Metadata } from "next";
import { fetchLiftCatalog } from "@/lib/api";
import { getActiveProgram } from "@/lib/active-program";
import { OnboardingFlow } from "./OnboardingFlow";
import { DEFAULT_LIFTS } from "./lib";

export const metadata: Metadata = {
  title: "Get Started — Lifting Logbook",
  description: "Discover your training maxes and choose a program.",
};

export default async function OnboardingPage() {
  // The catalog (built-in + the user's custom lifts) powers the add-a-lift
  // picker on the "Enter Lifts" step. getLifts keys off the authenticated user
  // and ignores the :program param, so the active-program default is safe even
  // before a cycle exists.
  //
  // Error-fallback coverage (docs/standards/error-fallback-test-coverage.md,
  // option c — structure-only justification): the catch below swallows a
  // catalog-fetch failure and falls back to the seeded DEFAULT_LIFTS. This is
  // intentional and not asserted by a test because the only behavior that
  // matters on failure is that onboarding still renders with at least the
  // big-three lifts selectable — there is no data shape to assert beyond "the
  // flow does not hard-fail," which OnboardingFlow's tests already exercise
  // against an explicit catalog.
  let catalog: string[];
  try {
    const program = await getActiveProgram();
    catalog = await fetchLiftCatalog(program);
  } catch {
    catalog = [...DEFAULT_LIFTS];
  }

  return <OnboardingFlow catalog={catalog} />;
}
