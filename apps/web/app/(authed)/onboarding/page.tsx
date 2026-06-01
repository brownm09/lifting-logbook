import type { Metadata } from "next";
import { OnboardingFlow } from "./OnboardingFlow";

export const metadata: Metadata = {
  title: "Get Started — Lifting Logbook",
  description: "Discover your training maxes and choose a program.",
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
