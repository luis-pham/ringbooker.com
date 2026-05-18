'use client';

import { useIsKnowledgeMobile, BottomSheet } from '@/components/ui/BottomSheet';
import type { DemoVerticalSlug } from '@/components/marketing/demo-vertical-config';
import { DemoCallEmbed } from '@/components/user/demo-call-embed';

export type DemoBottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  vertical: DemoVerticalSlug;
  shopServices?: string[];
  businessName?: string;
};

export function DemoBottomSheet({ isOpen, onClose, vertical, shopServices, businessName }: DemoBottomSheetProps) {
  const isMobile = useIsKnowledgeMobile();

  if (!isMobile) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Web voice demo" mobileOnly>
      <DemoCallEmbed vertical={vertical} device="mobile" shopServices={shopServices} businessName={businessName} />
    </BottomSheet>
  );
}
