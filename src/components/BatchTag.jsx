// A small label such as "B2" shown next to a lab. Nothing is shown for classes that are for everyone.
export default function BatchTag({ batch }) {
  if (!batch) return null
  return <span className="ml-2 rounded-sm border border-rule px-1.5 text-sm font-bold text-ink/70">{batch}</span>
}
