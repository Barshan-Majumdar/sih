import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarketingDetailPage } from "@/components/MarketingDetailPage";
import { solutionPages } from "@/lib/marketing-content";
import { getCurrentSession } from "@/lib/session";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = solutionPages[slug];
  if (!data) return {};

  return {
    title: `${data.title} | Agira`,
    description: data.description,
  };
}

export default async function SolutionPage({ params }: Props) {
  const { slug } = await params;
  const data = solutionPages[slug];
  if (!data) notFound();

  const session = await getCurrentSession();
  return <MarketingDetailPage data={data} isSignedIn={!!session?.user} />;
}
