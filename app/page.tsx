import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import ProblemSection from "@/components/ProblemSection";
import SolutionSection from "@/components/SolutionSection";
import MixedSection from "@/components/MixedSection";
import ExperienceSection from "@/components/ExperienceSection";
import Footer from "@/components/Footer";

export default function RecoverAILanding() {
  return (
    <main className="relative flex flex-col w-full max-w-[1280px] mx-auto bg-deep-navy min-h-screen overflow-x-hidden">
      {/* 0. Navigation (floating) */}
      <Navigation />

      {/* 1. Hero Section - Dark image + gradient */}
      <div id="hero">
        <HeroSection />
      </div>

      {/* 2. The Problem Section - Light */}
      <div id="problem">
        <ProblemSection />
      </div>

      {/* 3. The Solution Section - Dark */}
      <div id="solution">
        <SolutionSection />
      </div>

      {/* 4. Section (Steps 01-04 + Revenue Recovered) - Mixed light/dark */}
      <div id="revenue">
        <MixedSection />
      </div>

      {/* 5. The Experience Section (Live Recovery Path) - Light with gradient overlay */}
      <div id="experience">
        <ExperienceSection />
      </div>

      {/* 6. Footer - Dark */}
      <Footer />
      
    </main>
  );
}