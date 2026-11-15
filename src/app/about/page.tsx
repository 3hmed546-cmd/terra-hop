import type { Metadata } from "next";
import { AboutView } from "@/components/about/about-view";

export const metadata: Metadata = {
  title: "عن البراند | About",
  description: "موقع تيرا هوب (TERRA HOP) الرسمي - براند مصري للأزياء والهوديز الأوفر سايز والتيشرتات للشباب في مصر.",
};

export default function AboutPage() {
  return <AboutView />;
}
