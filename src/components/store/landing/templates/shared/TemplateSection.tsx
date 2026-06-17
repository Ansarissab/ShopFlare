// Shared building blocks for landing templates — style-light primitives composed per template.

interface TemplateSectionProps {
  id?: string
  'aria-label'?: string
  className?: string
  children: React.ReactNode
}

/**
 * Semantic <section> wrapper providing consistent vertical rhythm via a className prop.
 * No hardcoded colors — per-template look is supplied by the caller via className.
 */
export function TemplateSection({
  id,
  'aria-label': ariaLabel,
  className,
  children,
}: TemplateSectionProps) {
  return (
    <section id={id} aria-label={ariaLabel} className={className}>
      {children}
    </section>
  )
}
