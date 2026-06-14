import { getT } from '@/lib/i18n/server'
import { RenderHtml } from '@/components/shared/RenderHtml'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import type { FaqItem } from '@/lib/seo/jsonld'

interface Props {
  items: FaqItem[]
  /** Override heading text; defaults to t.seo.faqSectionTitle */
  heading?: string
}

export async function FaqSection({ items, heading }: Props) {
  const t = await getT()
  if (!items.length) return null
  const title = heading ?? t.seo.faqSectionTitle
  return (
    <section aria-labelledby="faq-heading" className="mt-12 border-t border-border pt-10">
      <h2 id="faq-heading" className="text-xl font-bold tracking-tight text-foreground mb-6">
        {title}
      </h2>
      <Accordion multiple>
        {items.map((item, i) => (
          <AccordionItem key={i} value={i}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>
              <RenderHtml html={item.answer} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
