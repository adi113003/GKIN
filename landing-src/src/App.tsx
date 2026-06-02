import { Masthead } from "@/components/sections/Masthead";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Method } from "@/components/sections/Method";
import { Benchmarks } from "@/components/sections/Benchmarks";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Footer } from "@/components/sections/Footer";

export default function App() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <main>
        <Masthead />
        <Hero />
        <HowItWorks />
        <Method />
        <Benchmarks />
        <FinalCTA />
        <Footer />
      </main>
    </div>
  );
}
