import { prisma } from "@/lib/db";
import { setCountryGateway } from "@/lib/providers";

export type PaymentCountryGroupView = {
  id: string;
  name: string;
  providerId: string;
  providerCode: string;
  providerName: string;
  countryCodes: string[];
};

export async function listPaymentCountryGroups(): Promise<PaymentCountryGroupView[]> {
  const rows = await prisma.paymentCountryGroup.findMany({
    include: { provider: true, members: { orderBy: { countryCode: "asc" } } },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    providerId: row.providerId,
    providerCode: row.provider.code,
    providerName: row.provider.name,
    countryCodes: row.members.map((m) => m.countryCode),
  }));
}

function parseCountryCodes(raw: string[]): string[] {
  const codes = new Set<string>();
  for (const value of raw) {
    for (const part of String(value).split(/[\s,;]+/)) {
      const code = part.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(code)) codes.add(code);
    }
  }
  return [...codes].sort();
}

/**
 * Create or update a country group and route every member country to the group's gateway.
 * A country may belong to only one group; moving it replaces the previous membership.
 */
export async function savePaymentCountryGroup(input: {
  id?: string;
  name: string;
  providerId: string;
  countryCodes: string[];
}) {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("A group name is required.");
  const provider = await prisma.integrationProvider.findFirst({
    where: { id: input.providerId, kind: "payment" },
  });
  if (!provider) throw new Error("Choose a payment gateway.");
  const countryCodes = parseCountryCodes(input.countryCodes);
  if (countryCodes.length === 0) throw new Error("Add at least one country code.");

  const group = await prisma.$transaction(async (tx) => {
    let row =
      input.id
        ? await tx.paymentCountryGroup.findUnique({ where: { id: input.id } })
        : null;
    if (row) {
      row = await tx.paymentCountryGroup.update({
        where: { id: row.id },
        data: { name, providerId: provider.id },
      });
    } else {
      row = await tx.paymentCountryGroup.create({
        data: { name, providerId: provider.id },
      });
    }

    await tx.paymentCountryGroupMember.deleteMany({
      where: {
        OR: [{ groupId: row.id }, { countryCode: { in: countryCodes } }],
      },
    });
    await tx.paymentCountryGroupMember.createMany({
      data: countryCodes.map((countryCode) => ({ groupId: row!.id, countryCode })),
    });
    return row;
  });

  for (const countryCode of countryCodes) {
    await setCountryGateway(countryCode, provider.id);
  }

  return group;
}

export async function deletePaymentCountryGroup(groupId: string) {
  const id = groupId.trim();
  if (!id) throw new Error("Choose a country group.");
  await prisma.paymentCountryGroup.delete({ where: { id } });
}
