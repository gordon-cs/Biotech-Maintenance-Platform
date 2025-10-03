import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Biotech Maintenance Platform</h1>
      <div className="flex gap-4">
        <a className="underline" href="/login">Log in</a>
        <a className="underline" href="/signup">Sign up</a>
      </div>
    </main>
  );
}

