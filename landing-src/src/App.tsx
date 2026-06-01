import { Masthead } from "@/components/sections/Masthead";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Method } from "@/components/sections/Method";
import { Benchmarks } from "@/components/sections/Benchmarks";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Footer } from "@/components/sections/Footer";

export default function App() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <main className="mx-auto max-w-[1040px] border-x border-ink/0 md:border-x-[1.5px] md:border-ink">
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
