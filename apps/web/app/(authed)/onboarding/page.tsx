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
  // before a cycle exists. Fall back to the seeded defaults if the fetch fails
  // so onboarding never hard-fails — the assertion in page.test.tsx pins that
  // the seeded lifts are always selectable (error-fallback coverage standard).
  let catalog: string[];
  try {
    const program = await getActiveProgram();
    catalog = await fetchLiftCatalog(program);
  } catch {
    catalog = [...DEFAULT_LIFTS];
  }

  return <OnboardingFlow catalog={catalog} />;
}
