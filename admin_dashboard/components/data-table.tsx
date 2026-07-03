import { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function DataTable({ children }: { children: ReactNode }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="overflow-x-auto p-0">{children}</CardContent>
    </Card>
  );
}
