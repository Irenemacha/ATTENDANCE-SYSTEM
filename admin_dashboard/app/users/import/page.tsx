import { redirect } from "next/navigation";

export default function OldImportPage() {
  redirect("/admin/users/import");
}
