"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { Session } from "@supabase/supabase-js"

export default function AuthStatus() {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<"lab" | "technician" | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const get = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data?.session ?? null);
      
      // Get user's role
      if (data?.session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .single();
        
        if (mounted && profile) {
          setUserRole(profile.role);
        }
      }
    };
    get();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      
      // Update role when auth state changes
      if (s?.user) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", s.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile) {
              setUserRole(profile.role);
            }
          });
      } else {
        setUserRole(null);
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
      {!userRole ? (
        <Link href="/complete-profile" className="text-blue-600 underline">Complete profile</Link>
      ) : (
        <Link href="/edit-profile" className="text-blue-600 underline">Edit profile</Link>
      )}
      {userRole === "lab" && (
        <Link href="/manage-addresses" className="text-blue-600 underline">Manage Addresses</Link>
      )}
      <button onClick={signOut} className="px-2 py-1 bg-gray-200 rounded">Sign out</button>
    </div>
  );
}
