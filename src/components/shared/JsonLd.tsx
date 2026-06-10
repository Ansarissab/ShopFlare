// Server component: emits a <script type="application/ld+json"> tag inline.
// Escape `<` so content containing </script> can't break out of the tag.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
