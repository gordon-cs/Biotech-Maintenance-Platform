"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [role, setRole] = useState<"lab" | "technician" | "">("");

  // lab fields
  const [labName, setLabName] = useState("");
  const [labAddress, setLabAddress] = useState("");
  const [labCity, setLabCity] = useState("");
  const [labState, setLabState] = useState("");
  const [labZip, setLabZip] = useState("");

  // technician fields
  const [techExperience, setTechExperience] = useState("");
  const [techBio, setTechBio] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setMessage(`Error: ${signUpError.message}`);
        return;
      }

      // get current session (may be null if email confirmation required)
      const { data: sessionData } = await supabase.auth.getSession();
      const session: Session | null = signUpData.session ?? sessionData.session ?? null;

      if (session && session.user?.id) {
        const userId = session.user.id;

        // profiles upsert
        const profileInsert = {
          id: userId,
          role: role || null,
          full_name: fullName || null,
          phone: phone || null,
          email: email || null,
        };

        const { error: profileError } = await supabase.from("profiles").upsert(profileInsert);
        if (profileError) {
          setMessage(`Profile creation failed: ${profileError.message}`);
          return;
        }

        if (role === "lab") {
          const labInsert = {
            manager_id: userId,
            name: labName || null,
            address: labAddress || null,
            city: labCity || null,
            state: labState || null,
            zipcode: labZip || null,
          };
          const { error: labError } = await supabase.from("labs").insert(labInsert);
          if (labError) {
            setMessage(`Lab creation failed: ${labError.message}`);
            return;
          }
        } else if (role === "technician") {
          const techInsert = {
            profile_id: userId,
            experience: techExperience || null,
            bio: techBio || null,
          };
          const { error: techError } = await supabase.from("technicians").insert(techInsert);
          if (techError) {
            setMessage(`Technician creation failed: ${techError.message}`);
            return;
          }
        }

        setMessage("Signup successful — profile created. Check your inbox to confirm your email (if enabled).");
      } else {
        setMessage("Check your email to confirm, then sign in to complete your profile.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage(msg || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignUp} className="p-4 border rounded bg-white w-full max-w-md">
      {/* ...rest of your JSX unchanged... */}
    </form>
  );
}
