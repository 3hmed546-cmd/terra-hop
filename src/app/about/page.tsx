import type { Metadata } from "next";
import { AboutView } from "@/components/about/about-view";

export const metadata: Metadata = {
  title: "عن البراند | About",
  description: "TERRA HOP makes oversized streetwear for young men in Egypt, in small drops.",
};

export default function AboutPage() {
  return <AboutView />;
}
