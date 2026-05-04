import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { PortfolioDetail } from '@/components/portfolio/PortfolioDetail';

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export default async function PortfolioDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { id } = await params;

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .eq('author_id', user.id)
    .single();

  if (!portfolio) notFound();

  const { data: steps } = await supabase
    .from('portfolio_steps')
    .select('*')
    .eq('portfolio_id', id)
    .order('step_number', { ascending: true });

  return (
    <div className="pt-[49px]">
      <div className="px-6 py-3 border-b border-cof-border">
        <h1 className="text-sm font-semibold text-cof-text-primary">{portfolio.title as string}</h1>
        {portfolio.subtitle && (
          <p className="text-xs text-cof-text-tertiary mt-0.5">{portfolio.subtitle as string}</p>
        )}
      </div>
      <PortfolioDetail portfolio={{ ...portfolio, steps: steps ?? [] }} />
    </div>
  );
}
