import { render, screen } from '@testing-library/react';
import GlassCard from './GlassCard';
import { expect, test } from 'vitest'; // Keeping these for now but fixing path

test('GlassCard renders children', () => {
    render(<GlassCard>Test Content</GlassCard>);
    expect(screen.getByText('Test Content')).toBeDefined();
});

test('GlassCard applies custom className', () => {
    const { container } = render(<GlassCard className="custom-class">Content</GlassCard>);
    expect(container.firstChild.className).toContain('custom-class');
});
