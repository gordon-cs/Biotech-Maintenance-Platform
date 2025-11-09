"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { Session } from "@supabase/supabase-js"

export default function AuthStatus() {
  const [session, setSession] = useState<Session | null>(null);
  const [hasRole, setHasRole] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const get = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data?.session ?? null);
      
      // Check if user has a role set
      if (data?.session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .single();
        
        setHasRole(profile?.role !== null && profile?.role !== undefined);
      }
    };
    get();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      
      // Re-check role when auth state changes
      if (s?.user) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", s.user.id)
          .single()
          .then(({ data: profile }) => {
            setHasRole(profile?.role !== null && profile?.role !== undefined);
          });
      } else {
        setHasRole(null);
      }
    });

    return () => {
      mounted = false;
      sub?.subscription.unsubscribe()
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    router.push("/");
  };

  if (!session) {
    return (
      <div className="flex gap-4">
        <Link href="/signin" className="text-blue-600 underline">Sign in</Link>
        <Link href="/signup" className="text-blue-600 underline">Sign up</Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm">
        Signed in as <strong>{session.user?.email}</strong>
      </span>
      {!hasRole ? (
        <Link href="/complete-profile" className="text-blue-600 underline">Complete profile</Link>
      ) : (
        <Link href="/edit-profile" className="text-blue-600 underline">Edit profile</Link>
      )}
      <button onClick={signOut} className="px-2 py-1 bg-gray-200 rounded">Sign out</button>
    </div>
  );
}
