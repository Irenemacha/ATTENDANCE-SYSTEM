"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, getRoleHomePath } from "@/lib/api";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      router.replace(getRoleHomePath(user));
    } else {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
