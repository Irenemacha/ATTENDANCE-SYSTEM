import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed bg-slate-50 p-10 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-white text-muted-foreground shadow-sm">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
