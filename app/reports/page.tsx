import { Suspense } from "react";
import { ReportsDashboard } from "./components";

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsDashboard />
    </Suspense>
  );
}
