/**
 * Card — Base UI atom
 *
 * Composable subcomponents: Card, Card.Header, Card.Body, Card.Footer
 * Elevation via shadow + surface background — NO colored side borders.
 *
 * Props:
 *   padded    boolean  Add default padding (default: true)
 *   elevated  boolean  Use shadow-md instead of shadow-sm (default: false)
 *   hoverable boolean  Add hover lift effect (default: false)
 *   as        string   HTML element to render (default: 'div')
 *
 * Usage:
 *   <Card>
 *     <Card.Header>Title</Card.Header>
 *     <Card.Body>Content</Card.Body>
 *     <Card.Footer>Actions</Card.Footer>
 *   </Card>
 *
 *   <Card hoverable elevated>...</Card>
 */

function Card({
  children,
  padded = true,
  elevated = false,
  hoverable = false,
  as: Tag = 'div',
  className = '',
  ...props
}) {
  const classes = [
    'bg-[var(--color-surface)]',
    'border border-[rgba(17,24,39,0.08)]',
    'rounded-[var(--radius-lg)]',
    elevated ? 'shadow-[var(--shadow-md)]' : 'shadow-[var(--shadow-sm)]',
    hoverable
      ? 'transition-shadow duration-150 hover:shadow-[var(--shadow-lg)] hover:-translate-y-px cursor-pointer'
      : '',
    padded ? 'p-[var(--spacing-5)]' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={classes} {...props}>
      {children}
    </Tag>
  );
}

function CardHeader({ children, className = '', ...props }) {
  return (
    <div
      className={[
        'flex items-center justify-between',
        'pb-[var(--spacing-3)]',
        'mb-[var(--spacing-4)]',
        'border-b border-[rgba(17,24,39,0.07)]',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

function CardBody({ children, className = '', ...props }) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

function CardFooter({ children, className = '', ...props }) {
  return (
    <div
      className={[
        'flex items-center gap-[var(--spacing-2)]',
        'pt-[var(--spacing-3)]',
        'mt-[var(--spacing-4)]',
        'border-t border-[rgba(17,24,39,0.07)]',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body   = CardBody;
Card.Footer = CardFooter;

export { Card };
export default Card;
