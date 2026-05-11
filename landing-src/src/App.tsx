import { Mesh } from "@/components/ui/Mesh";
import { Nav } from "@/components/sections/Nav";
import { Hero } from "@/components/sections/Hero";
import { HeadlineMarquee } from "@/components/sections/HeadlineMarquee";
import { PipelineBeams } from "@/components/sections/PipelineBeams";
import { FeatureAnalyzer } from "@/components/sections/FeatureAnalyzer";
import { FeatureInputs } from "@/components/sections/FeatureInputs";
import { FeatureCompare } from "@/components/sections/FeatureCompare";
import { StickyHow } from "@/components/sections/StickyHow";
import { Stats } from "@/components/sections/Stats";
import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Footer } from "@/components/sections/Footer";

export default function App() {
  return (
    <div className="relative min-h-screen text-ink">
      <Mesh />
      <Nav />
      <Hero />
      <HeadlineMarquee />
      <PipelineBeams />
      <FeatureAnalyzer />
      <FeatureInputs />
      <FeatureCompare />
      <StickyHow />
      <Stats />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
