"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  Controller,
  useForm,
  useFieldArray,
  type Control,
  type FieldErrors,
  type UseFormGetValues,
  type UseFormTrigger,
} from "react-hook-form";

import { ImageUpload } from "@/components/ui/ImageUpload";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
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
type MenuItemFormProps = {
  defaultValues: MenuItemFormValues;
  categories: Option[];
  stations: Option[];
  submitting: boolean;
  onSubmit: (values: MenuItemFormValues) => void;
  formId?: string;
  hideSubmit?: boolean;
  /**
   * "card" (default): sections render as page cards (standalone edit page).
   * "flat": sections render as sunken panels for modal bodies, matching the
   * RestaurantFormModal look.
   */
  variant?: "card" | "flat";
  /** Forwarded to Selects — their popovers portal outside the theme wrapper. */
  dark?: boolean;
};

const ERROR_COLOR = "oklch(0.75 0.16 18)";

const sunkenPanel: React.CSSProperties = {
  background: "var(--bg-sunken)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 16,
};

const iconDangerStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  padding: 0,
  borderRadius: 8,
  background: "transparent",
  border: "1px solid var(--border-strong)",
  color: "var(--berry)",
  cursor: "pointer",
  flexShrink: 0,
};

const iconNeutralStyle: React.CSSProperties = {
  ...iconDangerStyle,
  color: "var(--text-2)",
};

export function MenuItemForm({
  defaultValues,
  categories,
  stations,
  submitting,
  onSubmit,
  formId,
  hideSubmit = false,
  variant = "card",
  dark = false,
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

  const flat = variant === "flat";
  const sectionProps = flat
    ? { style: sunkenPanel }
    : { className: "card", style: { padding: 20 } as React.CSSProperties };

  return (
    <form
      id={formId}
      onSubmit={handleSubmit(onSubmit)}
      className="col"
      style={{ gap: 18 }}
    >
      {/* Item details */}
      <section {...sectionProps}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Item details
        </div>

        <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
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
          </div>
          <div style={{ width: 130 }}>
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
        </div>

        <div style={{ marginTop: 14 }}>
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

        <div style={{ marginTop: 14 }}>
          <ImageUpload
            label="Image"
            value={watch("image") || null}
            onChange={(url) => setValue("image", url ?? "")}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3" style={{ marginTop: 14 }}>
          <Controller
            control={control}
            name="categoryId"
            rules={{ required: "Category is required" }}
            render={({ field, fieldState }) => (
              <div>
                <Select
                  dark={dark}
                  label="Category"
                  placeholder="Select..."
                  options={categories.map((c) => ({ id: c.id, label: c.name }))}
                  selectedKey={field.value || null}
                  onSelectionChange={(k) => field.onChange(k ?? "")}
                />
                {fieldState.error && (
                  <span style={{ fontSize: 12, color: ERROR_COLOR, marginTop: 4, display: "block" }}>
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
                dark={dark}
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
                dark={dark}
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
      <section {...(flat ? {} : sectionProps)}>
        <div className="row" style={{ justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <div className="eyebrow">Option groups ({fields.length})</div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ height: 32, padding: "0 12px", fontSize: 12 }}
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
            <Plus size={13} />
            Add group
          </button>
        </div>

        {fields.length === 0 ? (
          <div
            style={{
              padding: 28,
              borderRadius: 10,
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
        ) : (
          <div className="col" style={{ gap: 12 }}>
            {fields.map((field, index) => (
              <OptionGroupFields
                key={field.id}
                control={control}
                index={index}
                errors={errors}
                getValues={getValues}
                trigger={trigger}
                requiredValue={watch(`optionGroups.${index}.required`)}
                onRemove={() => remove(index)}
              />
            ))}
          </div>
        )}
      </section>

      {!hideSubmit && (
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <PillButton
            tone="accent"
            size="lg"
            isDisabled={submitting}
            onClick={handleSubmit(onSubmit)}
          >
            {submitting ? "Saving..." : "Save"}
          </PillButton>
        </div>
      )}
    </form>
  );
}

function OptionGroupFields({
  control,
  index,
  errors,
  getValues,
  trigger,
  requiredValue,
  onRemove,
}: {
  control: Control<MenuItemFormValues>;
  index: number;
  errors: FieldErrors<MenuItemFormValues>;
  getValues: UseFormGetValues<MenuItemFormValues>;
  trigger: UseFormTrigger<MenuItemFormValues>;
  requiredValue: boolean;
  onRemove: () => void;
}) {
  const groupErrors = errors.optionGroups?.[index];
  const minMaxError =
    groupErrors?.minSelect?.message ?? groupErrors?.maxSelect?.message;

  return (
    <div style={sunkenPanel}>
      <div className="row" style={{ justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <span className="eyebrow">Group {index + 1}</span>
        <div className="row" style={{ gap: 14 }}>
          <Controller
            control={control}
            name={`optionGroups.${index}.required`}
            render={({ field }) => (
              <Switch isSelected={field.value} onChange={field.onChange}>
                <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                  Required
                </span>
              </Switch>
            )}
          />
          <button
            type="button"
            onClick={onRemove}
            style={iconDangerStyle}
            aria-label={`Remove option group ${index + 1}`}
            title="Remove group"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="row" style={{ gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px" }}>
          <Field label="Group name" error={groupErrors?.name?.message}>
            <Controller
              control={control}
              name={`optionGroups.${index}.name`}
              rules={{ required: "Group name is required" }}
              render={({ field }) => (
                <TextInput
                  value={field.value}
                  onChange={field.onChange}
                  icon={null}
                  type="text"
                  width="100%"
                  placeholder='e.g. "Size"'
                  ariaLabel="Option group name"
                  invalid={!!groupErrors?.name}
                />
              )}
            />
          </Field>
        </div>
        <div style={{ width: 76 }}>
          <Field label="Min">
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
                  width="100%"
                  ariaLabel={`Group ${index + 1} min select`}
                  invalid={!!groupErrors?.minSelect}
                />
              )}
            />
          </Field>
        </div>
        <div style={{ width: 76 }}>
          <Field label="Max">
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
                  width="100%"
                  ariaLabel={`Group ${index + 1} max select`}
                  invalid={!!groupErrors?.maxSelect}
                />
              )}
            />
          </Field>
        </div>
      </div>
      {minMaxError && (
        <span style={{ fontSize: 12, color: ERROR_COLOR, marginTop: 6, display: "block" }}>
          {minMaxError}
        </span>
      )}
      {requiredValue && (
        <span style={{ fontSize: 12, color: "var(--text-3)", marginTop: 6, display: "block" }}>
          Customers must pick at least the minimum before adding to cart.
        </span>
      )}

      <OptionItemsField control={control} groupIndex={index} />
    </div>
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
      style={{ gap: 8, borderTop: "1px dashed var(--border)", paddingTop: 12, marginTop: 14 }}
    >
      <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
        <span className="label" style={{ marginBottom: 0 }}>
          Options ({fields.length})
        </span>
        <button
          type="button"
          className="pill"
          style={{ height: 26, cursor: "pointer" }}
          onClick={() => append({ name: "", price: "0" })}
        >
          <Plus size={12} />
          Add option
        </button>
      </div>

      {fields.length === 0 && (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            border: "1px dashed var(--border-strong)",
            textAlign: "center",
            fontSize: 12.5,
            color: "var(--text-3)",
          }}
        >
          No options yet — add choices like &ldquo;Small&rdquo; or &ldquo;Large&rdquo;.
        </div>
      )}

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
                    <span style={{ fontSize: 12, color: ERROR_COLOR, marginTop: 4, display: "block" }}>
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
                width={96}
                placeholder="+0.00"
                ariaLabel="Option price"
              />
            )}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            style={{ ...iconNeutralStyle, marginTop: 4 }}
            aria-label="Remove option"
            title="Remove option"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
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
        <span style={{ fontSize: 12, color: ERROR_COLOR, marginTop: 4, display: "block" }}>
          {error}
        </span>
      )}
    </label>
  );
}
