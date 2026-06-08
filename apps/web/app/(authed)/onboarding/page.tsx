import type { Metadata } from "next";
import { LIFT_NAMES } from "@lifting-logbook/types";
import { fetchLiftCatalog } from "@/lib/api";
import { getActiveProgram } from "@/lib/active-program";
import { OnboardingFlow } from "./OnboardingFlow";

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
  // On fetch failure we fall back to the full built-in LIFT_NAMES rather than
  // the three seeded DEFAULT_LIFTS: OnboardingFlow pre-selects those same three
  // as the starting rows, so a DEFAULT_LIFTS fallback leaves the picker with
  // nothing selectable for any query — every search collapses to the
  // "add as a custom lift" option and the catalog search appears broken (#458).
  // LIFT_NAMES keeps search functional offline. The failure is logged rather
  // than swallowed so the upstream catalog-fetch failure is observable.
  // Fallback coverage (docs/standards/error-fallback-test-coverage.md, option b):
  // page.test.tsx asserts the fallback catalog is the full built-in list,
  // distinct from the pre-selected defaults.
  let catalog: string[];
  try {
    const program = await getActiveProgram();
    catalog = await fetchLiftCatalog(program);
  } catch (e) {
    console.error(
      "OnboardingPage: lift catalog fetch failed, falling back to built-in LIFT_NAMES",
      e,
    );
    catalog = [...LIFT_NAMES];
  }

  return <OnboardingFlow catalog={catalog} />;
}
