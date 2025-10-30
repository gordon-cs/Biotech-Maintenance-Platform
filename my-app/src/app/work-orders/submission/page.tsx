import WorkOrderSubmission from "../../components/WorkOrderSubmission"

export default function Page() {
  return (
    <main className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold mb-4">New Work Order</h1>
        <WorkOrderSubmission />
      </div>
    </main>
  )
}