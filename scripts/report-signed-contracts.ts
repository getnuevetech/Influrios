/**
 * Lists executed agreements that need operator review.
 * Does not rewrite bodies, PDFs, or digests.
 */
import { signedContractReview } from "../src/lib/contract-document";
import { prisma } from "../src/lib/db";

async function main() {
const documents = await prisma.contractDocument.findMany({
  include: { parties: { select: { status: true } } },
});
const rows = documents
  .map((document) => {
    const review = signedContractReview({
      status: document.status,
      parties: document.parties,
      contentDigest: document.contentDigest,
      pdfByteLength: document.pdfBytes.byteLength,
      renderedBody: document.renderedBody,
      signingChannel: document.signingChannel,
    });
    return review.review
      ? { id: document.id, status: document.status, signingChannel: document.signingChannel, reasons: review.reasons }
      : null;
  })
  .filter((row) => row !== null);
console.log(JSON.stringify({ count: rows.length, rows }, null, 2));
await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
