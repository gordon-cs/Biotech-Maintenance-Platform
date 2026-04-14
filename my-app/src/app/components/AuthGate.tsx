"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionSafe, supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const { data, error } = await getSessionSafe();
        if (error || !data.session) {
          router.replace("/login");
          return;
        }
        if (active) setLoading(false);
      } catch {
        router.replace("/login");
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
    });

    init();
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (loading) return <div className="p-6">Loading...</div>;
  return <>{children}</>;
}
