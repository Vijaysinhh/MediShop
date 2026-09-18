import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ReportsDashboard, type ReportSection } from "../components";

const sections: ReportSection[] = ["overview", "sales", "stock", "udhari"];

export default async function ReportSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section as ReportSection)) notFound();

  return (
    <Suspense fallback={null}>
      <ReportsDashboard section={section as ReportSection} />
    </Suspense>
  );
}
