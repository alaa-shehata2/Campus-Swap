/**
 * Full-width outer wrapper with responsive gutters (web-ui-standards §1).
 * fluid (default) uses the viewport; readable constrains prose/forms to a
 * readable measure without shrinking the whole site.
 */
export function Container({
  children,
  className = '',
  measure = 'fluid',
}: {
  children: React.ReactNode;
  className?: string;
  measure?: 'fluid' | 'readable';
}) {
  const measureClass = measure === 'readable' ? 'mx-auto w-full max-w-prose' : 'w-full';
  return <div className={`px-4 sm:px-6 lg:px-8 ${measureClass} ${className}`}>{children}</div>;
}
