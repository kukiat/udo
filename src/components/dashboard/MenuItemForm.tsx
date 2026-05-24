"use client";

import { useForm, useFieldArray, type Control, type UseFormRegister } from "react-hook-form";

import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Switch } from "@/components/ui/Switch";

export type MenuItemFormValues = {
  name: string;
  description: string;
  price: string;
  image: string;
  categoryId: string;
  kdsStationId: string;
  status: "available" | "sold_out" | "hidden";
  optionGroups: {
    name: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    optionItems: { name: string; price: string }[];
  }[];
};

type Option = { id: string; name: string };

const inputClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100";

export function MenuItemForm({
  defaultValues,
  categories,
  stations,
  submitting,
  onSubmit,
}: {
  defaultValues: MenuItemFormValues;
  categories: Option[];
  stations: Option[];
  submitting: boolean;
  onSubmit: (values: MenuItemFormValues) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MenuItemFormValues>({ defaultValues });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "optionGroups",
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      {/* Basic fields */}
      <section className="space-y-4 rounded-card border border-line bg-white p-5 shadow-card">
        <Field label="Name" error={errors.name?.message}>
          <input
            {...register("name", { required: "Name is required" })}
            className={inputClass}
            placeholder="e.g. Pad Thai"
          />
        </Field>

        <Field label="Description">
          <textarea
            {...register("description")}
            className={`${inputClass} min-h-20 resize-y`}
            placeholder="Short description"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Base price" error={errors.price?.message}>
            <input
              {...register("price", {
                required: "Price is required",
                pattern: {
                  value: /^\d+(\.\d{1,2})?$/,
                  message: "Enter a valid price",
                },
              })}
              className={inputClass}
              placeholder="0.00"
              inputMode="decimal"
            />
          </Field>
          <ImageUpload
            label="Image"
            value={watch("image") || null}
            onChange={(url) => setValue("image", url ?? "")}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Category" error={errors.categoryId?.message}>
            <select
              {...register("categoryId", { required: "Category is required" })}
              className={inputClass}
            >
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="KDS station">
            <select {...register("kdsStationId")} className={inputClass}>
              <option value="">None</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select {...register("status")} className={inputClass}>
              <option value="available">Available</option>
              <option value="sold_out">Sold out</option>
              <option value="hidden">Hidden</option>
            </select>
          </Field>
        </div>
      </section>

      {/* Option groups */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Option Groups
          </h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onPress={() =>
              append({
                name: "",
                required: false,
                minSelect: 0,
                maxSelect: 1,
                optionItems: [],
              })
            }
          >
            + Add option group
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="rounded-card border border-dashed border-line bg-white/50 px-4 py-6 text-center text-sm text-ink-muted">
            No option groups. Add one to offer choices like size or toppings.
          </p>
        )}

        {fields.map((field, index) => (
          <div
            key={field.id}
            className="space-y-3 rounded-card border border-line bg-white p-4 shadow-card"
          >
            <div className="flex items-start gap-3">
              <input
                {...register(`optionGroups.${index}.name`, {
                  required: true,
                })}
                className={inputClass}
                placeholder="Group name (e.g. Size)"
              />
              <button
                type="button"
                onClick={() => remove(index)}
                className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Switch
                isSelected={watch(`optionGroups.${index}.required`)}
                onChange={(v) => setValue(`optionGroups.${index}.required`, v)}
              >
                Required
              </Switch>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                Min
                <input
                  type="number"
                  {...register(`optionGroups.${index}.minSelect`, {
                    valueAsNumber: true,
                  })}
                  className="w-16 rounded-lg border border-line px-2 py-1 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                Max
                <input
                  type="number"
                  {...register(`optionGroups.${index}.maxSelect`, {
                    valueAsNumber: true,
                  })}
                  className="w-16 rounded-lg border border-line px-2 py-1 text-sm"
                />
              </label>
            </div>

            <OptionItemsField control={control} register={register} groupIndex={index} />
          </div>
        ))}
      </section>

      <div className="flex gap-3">
        <Button type="submit" size="lg" isDisabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

// Nested field array for a single group's option items.
function OptionItemsField({
  control,
  register,
  groupIndex,
}: {
  control: Control<MenuItemFormValues>;
  register: UseFormRegister<MenuItemFormValues>;
  groupIndex: number;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `optionGroups.${groupIndex}.optionItems`,
  });

  return (
    <div className="space-y-2 border-t border-line pt-3">
      {fields.map((field, i) => (
        <div key={field.id} className="flex items-center gap-2">
          <input
            {...register(`optionGroups.${groupIndex}.optionItems.${i}.name`, {
              required: true,
            })}
            className={`${inputClass} flex-1`}
            placeholder="Option name (e.g. Large)"
          />
          <input
            {...register(`optionGroups.${groupIndex}.optionItems.${i}.price`, {
              pattern: /^\d+(\.\d{1,2})?$/,
            })}
            className={`${inputClass} w-28`}
            placeholder="+ price"
            inputMode="decimal"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="shrink-0 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            −
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => append({ name: "", price: "0" })}
        className="text-sm font-medium text-clay-700 hover:underline"
      >
        + Add option
      </button>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}
