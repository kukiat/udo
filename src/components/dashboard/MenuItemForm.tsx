"use client";

import { Trash2 } from "lucide-react";
import {
  Controller,
  useForm,
  useFieldArray,
  type Control,
} from "react-hook-form";

import { ImageUpload } from "@/components/ui/ImageUpload";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { PillButton } from "../ui/PillButton";

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
type MenuItemFormProps ={
  defaultValues: MenuItemFormValues;
  categories: Option[];
  stations: Option[];
  submitting: boolean;
  onSubmit: (values: MenuItemFormValues) => void;
  formId?: string;
  hideSubmit?: boolean;
  stickyFooter?: boolean;
}

export function MenuItemForm({
  defaultValues,
  categories,
  stations,
  submitting,
  onSubmit,
  formId,
  hideSubmit = false,
  stickyFooter = false,
}: MenuItemFormProps) {
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<MenuItemFormValues>({ defaultValues });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "optionGroups",
  });

  return (
    <form
      id={formId}
      onSubmit={handleSubmit(onSubmit)}
      className="col"
      style={{ gap: 16 }}
    >
      {/* Basic fields */}
      <section className="card" style={{ padding: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Basics
        </div>
        <Field label="Name" error={errors.name?.message}>
          <Controller
            control={control}
            name="name"
            rules={{ required: "Name is required" }}
            render={({ field }) => (
              <TextInput
                value={field.value}
                onChange={field.onChange}
                icon={null}
                type="text"
                width="100%"
                placeholder='e.g. "Pad Thai"'
                ariaLabel="Menu item name"
                invalid={!!errors.name}
              />
            )}
          />
        </Field>

        <div style={{ marginTop: 12 }}>
          <Field label="Description">
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <TextInput
                  multiline
                  value={field.value}
                  onChange={field.onChange}
                  width="100%"
                  rows={3}
                  inputStyle={{ minHeight: 72 }}
                  placeholder="Short description"
                  ariaLabel="Description"
                />
              )}
            />
          </Field>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
          <ImageUpload
            label="Image"
            value={watch("image") || null}
            onChange={(url) => setValue("image", url ?? "")}
          />
          <Field label="Price" error={errors.price?.message}>
            <Controller
              control={control}
              name="price"
              rules={{
                required: "Price is required",
                pattern: {
                  value: /^\d+(\.\d{1,2})?$/,
                  message: "Enter a valid price",
                },
              }}
              render={({ field }) => (
                <TextInput
                  value={field.value}
                  onChange={field.onChange}
                  mono
                  icon={null}
                  type="text"
                  inputMode="decimal"
                  width="100%"
                  placeholder="0.00"
                  ariaLabel="Price"
                  invalid={!!errors.price}
                />
              )}
            />
          </Field>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 12 }}>
          <Controller
            control={control}
            name="categoryId"
            rules={{ required: "Category is required" }}
            render={({ field, fieldState }) => (
              <div>
                <Select
                  dark
                  label="Category"
                  placeholder="Select..."
                  options={categories.map((c) => ({ id: c.id, label: c.name }))}
                  selectedKey={field.value || null}
                  onSelectionChange={(k) => field.onChange(k ?? "")}
                />
                {fieldState.error && (
                  <span style={{ fontSize: 12, color: "oklch(0.75 0.16 18)", marginTop: 4, display: "block" }}>
                    {fieldState.error.message}
                  </span>
                )}
              </div>
            )}
          />
          <Controller
            control={control}
            name="kdsStationId"
            render={({ field }) => (
              <Select
                dark
                label="KDS station"
                placeholder="None"
                options={[
                  { id: "", label: "None" },
                  ...stations.map((s) => ({ id: s.id, label: s.name })),
                ]}
                selectedKey={field.value || ""}
                onSelectionChange={(k) => field.onChange(k ?? "")}
              />
            )}
          />
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                dark
                label="Status"
                options={[
                  { id: "available", label: "Available" },
                  { id: "sold_out", label: "Sold out" },
                  { id: "hidden", label: "Hidden" },
                ]}
                selectedKey={field.value}
                onSelectionChange={(k) => k && field.onChange(k)}
              />
            )}
          />
        </div>
      </section>

      {/* Option groups */}
      <section className="card" style={{ padding: 20 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
          <div className="eyebrow">Option groups</div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "6px 12px", fontSize: 12 }}
            onClick={() =>
              append({
                name: "",
                required: false,
                minSelect: 0,
                maxSelect: 1,
                optionItems: [],
              })
            }
          >
            Add group
          </button>
        </div>

        {fields.length === 0 && (
          <div
            style={{
              padding: 28,
              borderRadius: 14,
              border: "1px dashed var(--border-strong)",
              textAlign: "center",
              color: "var(--text-3)",
              fontSize: 13,
            }}
          >
            No option groups
            <br />
            <span style={{ opacity: 0.7 }}>
              Add options for choices such as size or spice level.
            </span>
          </div>
        )}

        <div className="col" style={{ gap: 10 }}>
          {fields.map((field, index) => (
            <div key={field.id} className="card-elev" style={{ padding: 14 }}>
              <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <Controller
                    control={control}
                    name={`optionGroups.${index}.name`}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <TextInput
                        value={field.value}
                        onChange={field.onChange}
                        icon={null}
                        type="text"
                        width="100%"
                        placeholder="Group name (e.g. Size)"
                        ariaLabel="Option group name"
                      />
                    )}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="pill pill-danger"
                  style={{
                    width: 34,
                    height: 34,
                    padding: 0,
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label="Delete option group"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="row" style={{ gap: 14, flexWrap: "wrap", marginTop: 10, alignItems: "flex-start" }}>
                <label className="row" style={{ gap: 6, fontSize: 13, cursor: "pointer", marginTop: 6 }}>
                  <input
                    type="checkbox"
                    checked={watch(`optionGroups.${index}.required`)}
                    onChange={(e) =>
                      setValue(`optionGroups.${index}.required`, e.target.checked)
                    }
                  />
                  Required
                </label>
                <div className="col" style={{ gap: 4, alignItems: "flex-start" }}>
                  <label className="row" style={{ gap: 6, fontSize: 13, color: "var(--text-2)" }}>
                    Min
                    <Controller
                      control={control}
                      name={`optionGroups.${index}.minSelect`}
                      rules={{
                        min: { value: 0, message: "Min must be >= 0" },
                        validate: (value) =>
                          Number(value) <= Number(getValues(`optionGroups.${index}.maxSelect`)) ||
                          "Min must not be greater than Max",
                      }}
                      render={({ field }) => (
                        <TextInput
                          value={String(field.value ?? "")}
                          onChange={(v) => {
                            field.onChange(v === "" ? 0 : Number(v));
                            trigger(`optionGroups.${index}.maxSelect`);
                          }}
                          type="number"
                          min={0}
                          mono
                          icon={null}
                          width={64}
                          ariaLabel="Min select"
                          invalid={!!errors.optionGroups?.[index]?.minSelect}
                        />
                      )}
                    />
                  </label>
                  {errors.optionGroups?.[index]?.minSelect && (
                    <span style={{ fontSize: 12, color: "oklch(0.75 0.16 18)", textAlign: "left" }}>
                      {errors.optionGroups[index]?.minSelect?.message}
                    </span>
                  )}
                </div>
                <div className="col" style={{ gap: 4, alignItems: "flex-start" }}>
                  <label className="row" style={{ gap: 6, fontSize: 13, color: "var(--text-2)" }}>
                    Max
                    <Controller
                      control={control}
                      name={`optionGroups.${index}.maxSelect`}
                      rules={{
                        min: { value: 0, message: "Max must be >= 0" },
                        validate: (value) =>
                          Number(value) >= Number(getValues(`optionGroups.${index}.minSelect`)) ||
                          "Max must not be less than Min",
                      }}
                      render={({ field }) => (
                        <TextInput
                          value={String(field.value ?? "")}
                          onChange={(v) => {
                            field.onChange(v === "" ? 0 : Number(v));
                            trigger(`optionGroups.${index}.minSelect`);
                          }}
                          type="number"
                          min={0}
                          mono
                          icon={null}
                          width={64}
                          ariaLabel="Max select"
                          invalid={!!errors.optionGroups?.[index]?.maxSelect}
                        />
                      )}
                    />
                  </label>
                  {errors.optionGroups?.[index]?.maxSelect && (
                    <span style={{ fontSize: 12, color: "oklch(0.75 0.16 18)", textAlign: "left" }}>
                      {errors.optionGroups[index]?.maxSelect?.message}
                    </span>
                  )}
                </div>
              </div>

              <OptionItemsField control={control} groupIndex={index} />
            </div>
          ))}
        </div>
      </section>

      {!hideSubmit && (
        <div
          className="row"
          style={{
            justifyContent: "flex-end",
            gap: 12,
            ...(stickyFooter
              ? {
                  position: "sticky",
                  bottom: 0,
                  margin: "0 -20px -20px",
                  padding: "16px 20px",
                  borderTop: "1px solid var(--border)",
                  background: "var(--surface)",
                }
              : {}),
          }}
        >
          <PillButton tone="accent" isDisabled={submitting} onClick={handleSubmit(onSubmit)}>
            {submitting ? "Saving..." : "Save"}
          </PillButton>
        </div>
      )}
    </form>
  );
}

// Nested field array for a single group's option items.
function OptionItemsField({
  control,
  groupIndex,
}: {
  control: Control<MenuItemFormValues>;
  groupIndex: number;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `optionGroups.${groupIndex}.optionItems`,
  });

  return (
    <div
      className="col"
      style={{ gap: 8, borderTop: "1px dashed var(--border)", paddingTop: 12, marginTop: 12 }}
    >
      {fields.map((field, i) => (
        <div key={field.id} className="row" style={{ gap: 8, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <Controller
              control={control}
              name={`optionGroups.${groupIndex}.optionItems.${i}.name`}
              rules={{ required: "Option name is required" }}
              render={({ field: f, fieldState }) => (
                <>
                  <TextInput
                    value={f.value}
                    onChange={f.onChange}
                    icon={null}
                    type="text"
                    width="100%"
                    placeholder="Option name (e.g. Large)"
                    ariaLabel="Option name"
                    invalid={!!fieldState.error}
                  />
                  {fieldState.error && (
                    <span style={{ fontSize: 12, color: "oklch(0.75 0.16 18)", marginTop: 4, display: "block" }}>
                      {fieldState.error.message}
                    </span>
                  )}
                </>
              )}
            />
          </div>
          <Controller
            control={control}
            name={`optionGroups.${groupIndex}.optionItems.${i}.price`}
            rules={{ pattern: /^\d+(\.\d{1,2})?$/ }}
            render={({ field: f }) => (
              <TextInput
                value={f.value}
                onChange={f.onChange}
                mono
                icon={null}
                type="text"
                inputMode="decimal"
                width={110}
                placeholder="+ Price"
                ariaLabel="Option price"
              />
            )}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="pill"
            style={{ cursor: "pointer", flexShrink: 0 }}
          >
            −
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => append({ name: "", price: "0" })}
        style={{
          alignSelf: "flex-start",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--coral)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        Add option
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
    <label style={{ display: "block" }}>
      <span className="label">{label}</span>
      {children}
      {error && (
        <span style={{ fontSize: 12, color: "oklch(0.75 0.16 18)", marginTop: 4, display: "block" }}>
          {error}
        </span>
      )}
    </label>
  );
}
