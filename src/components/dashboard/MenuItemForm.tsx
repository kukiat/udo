"use client";

import {
  Controller,
  useForm,
  useFieldArray,
  type Control,
  type UseFormRegister,
} from "react-hook-form";

import { ImageUpload } from "@/components/ui/ImageUpload";
import { Select } from "@/components/ui/Select";

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

export function MenuItemForm({
  defaultValues,
  categories,
  stations,
  submitting,
  onSubmit,
  stickyFooter = false,
}: {
  defaultValues: MenuItemFormValues;
  categories: Option[];
  stations: Option[];
  submitting: boolean;
  onSubmit: (values: MenuItemFormValues) => void;
  stickyFooter?: boolean;
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
    <form onSubmit={handleSubmit(onSubmit)} className="col" style={{ gap: 16 }}>
      {/* Basic fields */}
      <section className="card" style={{ padding: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          ① ข้อมูลเมนู · BASICS
        </div>
        <Field label="ชื่อ · NAME" error={errors.name?.message}>
          <input
            {...register("name", { required: "Name is required" })}
            className="input"
            placeholder='เช่น "ผัดไทย"'
          />
        </Field>

        <div style={{ marginTop: 12 }}>
          <Field label="คำอธิบาย · DESCRIPTION">
            <textarea
              {...register("description")}
              className="input"
              style={{ minHeight: 72, resize: "vertical" }}
              placeholder="คำอธิบายสั้นๆ"
            />
          </Field>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
          <ImageUpload
            label="รูปภาพ · IMAGE"
            value={watch("image") || null}
            onChange={(url) => setValue("image", url ?? "")}
          />
          <Field label="ราคา · PRICE" error={errors.price?.message}>
            <input
              {...register("price", {
                required: "Price is required",
                pattern: {
                  value: /^\d+(\.\d{1,2})?$/,
                  message: "Enter a valid price",
                },
              })}
              className="input mono"
              placeholder="0.00"
              inputMode="decimal"
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
                  label="หมวด · CATEGORY"
                  placeholder="เลือก…"
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
                label="สถานี · KDS"
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
                label="สถานะ · STATUS"
                options={[
                  { id: "available", label: "พร้อม · Available" },
                  { id: "sold_out", label: "หมด · Sold out" },
                  { id: "hidden", label: "ซ่อน · Hidden" },
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
          <div className="eyebrow">② ตัวเลือกเพิ่มเติม · OPTION GROUPS</div>
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
            ＋ เพิ่มกลุ่ม
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
            ยังไม่มีกลุ่มตัวเลือก
            <br />
            <span style={{ opacity: 0.7 }}>
              No option groups · เพิ่มเพื่อให้ลูกค้าเลือก เช่น ขนาด ความเผ็ด
            </span>
          </div>
        )}

        <div className="col" style={{ gap: 10 }}>
          {fields.map((field, index) => (
            <div key={field.id} className="card-elev" style={{ padding: 14 }}>
              <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                <input
                  {...register(`optionGroups.${index}.name`, { required: true })}
                  className="input"
                  placeholder="ชื่อกลุ่ม (เช่น ขนาด)"
                />
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="pill pill-danger"
                  style={{ cursor: "pointer", flexShrink: 0 }}
                >
                  ลบ
                </button>
              </div>

              <div className="row" style={{ gap: 14, flexWrap: "wrap", marginTop: 10 }}>
                <label className="row" style={{ gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={watch(`optionGroups.${index}.required`)}
                    onChange={(e) =>
                      setValue(`optionGroups.${index}.required`, e.target.checked)
                    }
                  />
                  จำเป็น · Required
                </label>
                <label className="row" style={{ gap: 6, fontSize: 13, color: "var(--text-2)" }}>
                  Min
                  <input
                    type="number"
                    {...register(`optionGroups.${index}.minSelect`, {
                      valueAsNumber: true,
                    })}
                    className="input mono"
                    style={{ width: 64, padding: "6px 8px" }}
                  />
                </label>
                <label className="row" style={{ gap: 6, fontSize: 13, color: "var(--text-2)" }}>
                  Max
                  <input
                    type="number"
                    {...register(`optionGroups.${index}.maxSelect`, {
                      valueAsNumber: true,
                    })}
                    className="input mono"
                    style={{ width: 64, padding: "6px 8px" }}
                  />
                </label>
              </div>

              <OptionItemsField control={control} register={register} groupIndex={index} />
            </div>
          ))}
        </div>
      </section>

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
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "กำลังบันทึก…" : "บันทึก · SAVE"}
        </button>
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
    <div
      className="col"
      style={{ gap: 8, borderTop: "1px dashed var(--border)", paddingTop: 12, marginTop: 12 }}
    >
      {fields.map((field, i) => (
        <div key={field.id} className="row" style={{ gap: 8 }}>
          <input
            {...register(`optionGroups.${groupIndex}.optionItems.${i}.name`, {
              required: true,
            })}
            className="input"
            placeholder="ชื่อตัวเลือก (เช่น ใหญ่)"
          />
          <input
            {...register(`optionGroups.${groupIndex}.optionItems.${i}.price`, {
              pattern: /^\d+(\.\d{1,2})?$/,
            })}
            className="input mono"
            style={{ width: 110 }}
            placeholder="+ ราคา"
            inputMode="decimal"
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
        ＋ เพิ่มตัวเลือก
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
