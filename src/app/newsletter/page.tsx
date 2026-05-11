import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NewsletterTabs } from '@/components/newsletter/NewsletterTabs';

export const dynamic = 'force-dynamic';

export default async function NewsletterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="page-with-nav">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-cof-text-primary">Field Intelligence</h1>
          <p className="mt-1 text-sm text-cof-text-tertiary">
            Generate briefings from the knowledge graph for your networks.
          </p>
        </div>
        <NewsletterTabs />
      </div>
    </div>
  );
}
