import Link from "next/link";
import AuthStatus from "./components/AuthStatus";

export default function Home() {
  return (
    <div className="font-sans min-h-screen p-8 bg-white text-black">
      <main className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Biotech Maintenance Platform</h1>
          <AuthStatus />
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-4">Get started</h2>
          <p className="mb-4">Use the links to sign in or sign up. Complete your profile after signing in.</p>
          <div className="flex gap-4">
            <Link href="/signin" className="text-blue-600 underline">Sign in</Link>
            <Link href="/signup" className="text-blue-600 underline">Create account</Link>
          </div>
        </section>
      </main>
    </div>
  )
}
