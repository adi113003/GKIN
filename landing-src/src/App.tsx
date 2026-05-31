import { Mesh } from "@/components/ui/Mesh";
import { Nav } from "@/components/sections/Nav";
import { Hero } from "@/components/sections/Hero";
import { HeadlineMarquee } from "@/components/sections/HeadlineMarquee";
import { PipelineBeams } from "@/components/sections/PipelineBeams";
import { BentoGrid } from "@/components/sections/BentoGrid";
import { StickyHow } from "@/components/sections/StickyHow";
import { Comparison } from "@/components/sections/Comparison";
import { MidtermResponse } from "@/components/sections/MidtermResponse";
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
      <BentoGrid />
      <StickyHow />
      <Comparison />
      <MidtermResponse />
      <Stats />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
