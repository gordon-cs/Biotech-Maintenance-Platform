import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

export default async function Home() {
  // Supabase connection test
  const { data, error } = await supabase.from("work_orders").select("*").limit(5);

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />

        {/* Supabase connection result */}
        <div className="p-4 border rounded bg-gray-50 w-full">
          <h2 className="font-bold mb-2">Supabase Connection Test</h2>
          {error ? (
            <p className="text-red-600">❌ Error: {error.message}</p>
          ) : (
            <pre className="text-sm">{JSON.stringify(data, null, 2)}</pre>
          )}
        </div>

        {/* Default Next.js template content */}
        <ol className="font-mono list-inside list-decimal text-sm/6 text-center sm:text-left">
          <li className="mb-2 tracking-[-.01em]">
            Get started by editing{" "}
            <code className="bg-black/[.05] dark:bg-white/[.06] font-mono font-semibold px-1 py-0.5 rounded">
              src/app/page.tsx
            </code>
            .
          </li>
          <li className="tracking-[-.01em]">
            Save and see your changes instantly.
          </li>
        </ol>
      </main>
    </div>
  );
}
