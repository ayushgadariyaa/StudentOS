export default function Problem({ error }) {
  if (!error) return null
  return (
    <p role="alert" className="mt-4 border-l-4 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-900">
      {error.message ?? String(error)}
    </p>
  )
}
