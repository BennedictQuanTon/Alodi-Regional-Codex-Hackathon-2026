import { Approach } from "@/components/landing/approach";
import { ClosingCta, Competitors, Faq, Footer, Sources } from "@/components/landing/closing";
import { Hero, SourceStrip } from "@/components/landing/hero";
import { PauseOffscreen, ScrollProgress, SmoothScroll } from "@/components/landing/motion";
import { Stack } from "@/components/landing/stack";
import { Team } from "@/components/landing/team";
import { AnnouncementBar, Nav } from "@/components/landing/nav";
import { Problem } from "@/components/landing/problem";
import { Features, Outcomes, Product } from "@/components/landing/product";
import { Tldr } from "@/components/landing/tldr";
import { HowItWorks } from "@/components/landing/works";

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <PauseOffscreen />
      <ScrollProgress />
      <AnnouncementBar />
      <Nav />
      <main className="flex-1">
        <Hero />
        <SourceStrip />
        <Problem />
        <Approach />
        <Tldr />
        <HowItWorks />
        <Features />
        <Product />
        <Outcomes />
        <Stack />
        <Competitors />
        <Team />
        <Faq />
        <ClosingCta />
        <Sources />
      </main>
      <Footer />
    </>
  );
}
