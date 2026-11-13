import { PaymentsScreen } from "@/app/payments/payments-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Collaboration Payments" };

type Props = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    currency?: string;
    page?: string;
    deal?: string;
    tab?: string;
    case?: string;
    error?: string;
    approved?: string;
    returned?: string;
  }>;
};

export default function PaymentsPage({ searchParams }: Props) {
  return <PaymentsScreen searchParams={searchParams} />;
}
