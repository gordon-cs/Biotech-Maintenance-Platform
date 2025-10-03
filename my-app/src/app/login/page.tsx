"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMsg(error.message);
    router.replace("/dashboard"); // protected area
  };

  return (
    <div className="max-w-sm mx-auto py-10 flex flex-col gap-3">
      <h1 className="text-2xl font-bold">Log In</h1>
      <input className="border p-2 rounded" type="email" placeholder="Email"
             value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="border p-2 rounded" type="password" placeholder="Password"
             value={password} onChange={e=>setPassword(e.target.value)} />
      <button onClick={handleLogin} className="bg-black text-white py-2 rounded">Log in</button>
      {msg && <p className="text-sm">{msg}</p>}
      <a className="underline text-sm" href="/signup">Create an account</a>
    </div>
  );
}
