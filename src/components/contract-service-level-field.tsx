"use client";

export function ContractServiceLevelField(props: {
  value: string;
  options: { value: string; label: string }[];
  hint: string;
}) {
  return (
    <label className="block text-sm font-semibold text-indigo sm:col-span-2">
      Collaboration service level
      <select
        name="serviceLevel"
        required
        defaultValue={props.value}
        className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
        onChange={(event) => {
          const form = event.currentTarget.form;
          if (!form) return;
          const button = document.createElement("button");
          button.type = "submit";
          button.name = "intent";
          button.value = "preview";
          button.hidden = true;
          form.appendChild(button);
          form.requestSubmit(button);
        }}
      >
        <option value="">Choose a service level</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs font-normal text-muted">{props.hint}</span>
    </label>
  );
}
