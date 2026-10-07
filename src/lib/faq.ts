import { prisma } from "@/lib/db";
import { FAQ_SEED, isFaqAudience, type FaqAudience } from "@/lib/faq-catalog";

export async function ensureFaqEntries() {
  const existing = await prisma.faqEntry.findMany({ select: { key: true } });
  const have = new Set(existing.map((row) => row.key));
  for (const entry of FAQ_SEED) {
    if (have.has(entry.key)) continue;
    await prisma.faqEntry.create({
      data: {
        key: entry.key,
        audience: entry.audience,
        question: entry.question,
        answer: entry.answer,
        sortOrder: entry.sortOrder,
        published: true,
      },
    });
  }
}

export async function listFaqEntries(audience?: FaqAudience) {
  await ensureFaqEntries();
  return prisma.faqEntry.findMany({
    where: audience ? { audience } : undefined,
    orderBy: [{ audience: "asc" }, { sortOrder: "asc" }, { question: "asc" }],
  });
}

export async function listPublishedFaq(audience?: FaqAudience) {
  await ensureFaqEntries();
  return prisma.faqEntry.findMany({
    where: { published: true, ...(audience ? { audience } : {}) },
    orderBy: [{ sortOrder: "asc" }, { question: "asc" }],
  });
}

function cleanKey(value: string) {
  const key = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return key.length >= 3 ? key : "";
}

export async function saveFaqEntry(input: {
  id?: string;
  key: string;
  audience: string;
  question: string;
  answer: string;
  sortOrder: number;
  published: boolean;
}) {
  if (!isFaqAudience(input.audience)) throw new Error("Choose a general, creator, business, agency, or visitor audience.");
  const question = input.question.trim().slice(0, 200);
  const answer = input.answer.trim().slice(0, 8000);
  if (!question || !answer) throw new Error("A question and an answer are required.");
  const sortOrder = Number.isFinite(input.sortOrder) ? Math.max(0, Math.round(input.sortOrder)) : 0;
  if (input.id) {
    const existing = await prisma.faqEntry.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("That FAQ entry was not found.");
    return prisma.faqEntry.update({
      where: { id: input.id },
      data: { audience: input.audience, question, answer, sortOrder, published: input.published },
    });
  }
  const key = cleanKey(input.key) || cleanKey(question);
  if (!key) throw new Error("Use a short key of letters and numbers.");
  try {
    return await prisma.faqEntry.create({
      data: { key, audience: input.audience, question, answer, sortOrder, published: input.published },
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "P2002") throw new Error("That FAQ key is already in use.");
    throw error;
  }
}

export async function deleteFaqEntry(id: string) {
  await prisma.faqEntry.delete({ where: { id } });
}
