import { Suspense } from "react";

export default function CompleteLabInfoPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <CompleteLabInfoWrapper />
    </Suspense>
  );
}