import type { Metadata } from "next";
import { HelpView } from "@/components/help/help-view";

export const metadata: Metadata = {
  title: "المساعدة والأسئلة | Help",
  description: "Answers about ordering, preorders, delivery and inspection at TERRA HOP.",
};

export default function HelpPage() {
  return <HelpView />;
}
