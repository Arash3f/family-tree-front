"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { Permissions } from "@/lib/auth/types";
import { useRouter } from "@/i18n/navigation";
import { Page, PageHeader, Panel } from "@/components/ui/Page";
import { TicketCreateForm } from "@/components/app/TicketCreateForm";

type Props = {
  preferredFamilyTreeId?: string;
};

export function TicketCreateView({ preferredFamilyTreeId }: Props) {
  const t = useTranslations("tickets");
  const { hasPermission } = useAuth();
  const router = useRouter();
  const allowed = hasPermission(Permissions.TICKET_CREATE);

  useEffect(() => {
    if (!allowed) {
      router.replace("/dashboard/tickets");
    }
  }, [allowed, router]);

  if (!allowed) return null;

  return (
    <Page>
      <PageHeader
        back={{ href: "/dashboard/tickets", label: t("back") }}
        title={t("createTitle")}
        support={t("createSupport")}
      />

      <Panel delay={1}>
        <TicketCreateForm
          preferredFamilyTreeId={preferredFamilyTreeId}
          onCreated={(ticket) => {
            router.replace(`/dashboard/tickets/${ticket.id}`);
          }}
        />
      </Panel>
    </Page>
  );
}
