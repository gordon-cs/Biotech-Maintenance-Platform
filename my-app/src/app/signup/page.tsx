"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"lab_manager" | "technician" | "admin">(
    "lab_manager"
  );
  const [fullName, setFullName] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  const handleSignUp = async () => {
    setMsg("");

    // 1. Sign up with email and password
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    console.log("signUp result:", data); // Debugging

    // 2. If email confirmation is required, data.user will be null
    if (!data.user) {
      setMsg(
        "✅ Sign up successful! Please confirm your email before logging in."
      );
      return;
    }

    // 3. Insert into profiles table with the same user id
    const { error: profileError } = await supabase.from("profiles").insert([
      {
        id: data.user.id, // FK to auth.users
        role,
        full_name: fullName,
      },
    ]);

    if (profileError) {
      setMsg(profileError.message);
      return;
    }

    // 4. Redirect to login page after successful signup
    setMsg("✅ Sign up successful!");
    router.push("/login");
  };

  return (
    <div className="max-w-sm mx-auto py-10 flex flex-col gap-3">
      <h1 className="text-2xl font-bold">Sign Up</h1>

      <input
        className="border p-2 rounded"
        placeholder="Full name (optional)"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />

      <input
        className="border p-2 rounded"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        className="border p-2 rounded"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <select
        className="border p-2 rounded"
        value={role}
        onChange={(e) => setRole(e.target.value as any)}
      >
        <option value="lab_manager">Lab Manager</option>
        <option value="technician">Technician</option>
        <option value="admin">Admin</option>
      </select>

      <button
        onClick={handleSignUp}
        className="bg-blue-600 text-white py-2 rounded"
      >
        Create account
      </button>

      {msg && <p className="text-sm">{msg}</p>}

      <a className="underline text-sm" href="/login">
        Already have an account? Log in
      </a>
    </div>
  );
}
