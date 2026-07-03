import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AddClientForm } from "@/components/coach/AddClientForm";

export const metadata = { title: "Add client — Wild Wanderers" };

export default function NewClientPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/program"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Program
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[28px] leading-tight text-forest-deep">
          Add a client
        </h1>
      </div>
      <AddClientForm />
    </div>
  );
}
