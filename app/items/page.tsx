import { Suspense } from "react";
import { ItemsManagement } from "./components";

export default function ItemsPage() {
  return (
    <Suspense fallback={null}>
      <ItemsManagement />
    </Suspense>
  );
}
