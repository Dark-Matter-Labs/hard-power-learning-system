'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ReviewCard } from '@/components/review/ReviewCard';
import type { Node, HumanReview } from '@/lib/types/nodes';

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const [node, setNode] = useState<Node | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchNode = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('nodes')
        .select('*')
        .eq('id', params.id)
        .single();
      if (data) setNode(data as unknown as Node);
    };
    fetchNode();
  }, [params.id]);

  const handlePromote = async (review: HumanReview) => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      await supabase
        .from('nodes')
        .update({
          human_review: review,
          status: 'promoted',
          confidence_level: review.fields.confidence?.final as number,
          domain_tags: review.fields.domain_tags?.final as string[],
        })
        .eq('id', params.id);

      await supabase.from('activity_log').insert({
        action: 'promoted',
        target_node_id: params.id as string,
        details: { from_status: node?.status },
      });

      router.push('/capture');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async (review: HumanReview) => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      await supabase
        .from('nodes')
        .update({ human_review: review, status: 'human_reviewed' })
        .eq('id', params.id);
      router.push('/capture');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      await supabase
        .from('nodes')
        .update({ status: 'archived' })
        .eq('id', params.id);

      await supabase.from('activity_log').insert({
        action: 'archived',
        target_node_id: params.id as string,
      });

      router.push('/capture');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!node) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-48" />
          <div className="h-32 bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  if (!node.llm_extraction || node.status === 'raw' || node.status === 'processing') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-400">This hunch is still being processed by the AI.</p>
        <p className="text-sm text-gray-600 mt-1">Check back in a moment.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-200">{node.title}</h1>
        {node.description && (
          <p className="mt-1 text-sm text-gray-500">{node.description}</p>
        )}
      </div>
      <ReviewCard
        node={node}
        onPromote={handlePromote}
        onSaveDraft={handleSaveDraft}
        onArchive={handleArchive}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
