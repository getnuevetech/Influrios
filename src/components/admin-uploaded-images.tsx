import Image from "next/image";

/** Upload and remove controls for images an admin saves on a page, category, or banner. */
export function AdminUploadedImages({
  images,
  uploadAction,
  removeAction,
  canEdit,
  emptyLabel,
}: {
  images: string[];
  uploadAction: (formData: FormData) => void | Promise<void>;
  removeAction: (formData: FormData) => void | Promise<void>;
  canEdit: boolean;
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="mt-3 flex flex-wrap gap-3">
        {images.map((img) => (
          <div key={img} className="relative h-24 w-36 overflow-hidden rounded-xl border border-[#E4EBFF]">
            <Image src={img} alt="" fill className="object-cover" sizes="144px" />
            {canEdit ? (
              <form action={removeAction} className="absolute bottom-1 right-1">
                <input type="hidden" name="image" value={img} />
                <button type="submit" className="rounded bg-white/95 px-2 py-0.5 text-[10px] font-bold text-violet">
                  Remove
                </button>
              </form>
            ) : null}
          </div>
        ))}
        {images.length === 0 ? <p className="text-sm text-muted">{emptyLabel}</p> : null}
      </div>
      {canEdit ? (
        <form action={uploadAction} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="font-semibold text-indigo">Upload image</span>
            <input type="file" name="file" accept="image/*" required className="mt-1 block w-full text-sm" />
          </label>
          <button type="submit" className="btn-secondary !py-2 text-sm">
            Add image
          </button>
        </form>
      ) : null}
    </div>
  );
}
