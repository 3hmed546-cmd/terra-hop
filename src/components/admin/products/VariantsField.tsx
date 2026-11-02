"use client";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { formatNumber } from "@/lib/admin/format";
import {
  DEFAULT_COLOR_HEX, formTotalStock, MAX_COLORS, nextColorId, setCellStock, sizeChoices, withGrid,
  type FormErrorCode, type ProductForm,
} from "@/lib/admin/product-form";
import { Button, Checkbox, NumberInput, TextInput } from "../ui";

const V = ADMIN_STRINGS.productForm;

interface Props {
  form: ProductForm;
  onChange: (form: ProductForm) => void;
  errors: { colors?: FormErrorCode; sizes?: FormErrorCode; stock?: FormErrorCode };
}

export function VariantsField({ form, onChange, errors }: Props) {
  const safeSizes = Array.isArray(form?.sizes) ? form.sizes : [];
  const safeColors = Array.isArray(form?.colors) ? form.colors : [];
  const safeVariants = Array.isArray(form?.variants) ? form.variants : [];

  const rowTotal = (colorId: string) => safeVariants.filter((v) => v.colorId === colorId).reduce((s, v) => s + v.stock, 0);

  const setColor = (id: string, patch: Partial<{ name: string; hex: string }>) =>
    onChange(withGrid(form, { colors: safeColors.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  return (
    <div className="adm-stack">
      <fieldset className="adm-fieldset" aria-describedby={errors.colors ? "err-colors" : undefined}>
        <legend className="adm-field-label">{V.colorsLegend}</legend>
        <div className="adm-stack">
          {form.colors.map((c, i) => (
            <div key={c.id} className="adm-color-row">
              <input
                type="color"
                className="adm-color-input"
                aria-label={V.colorPick(c.name)}
                value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : DEFAULT_COLOR_HEX}
                onChange={(e) => setColor(c.id, { hex: e.target.value.toUpperCase() })}
              />
              <TextInput
                label={V.colorName(i + 1)}
                hideLabel
                placeholder={V.colorNamePlaceholder}
                value={c.name}
                maxLength={40}
                onChange={(e) => setColor(c.id, { name: e.target.value })}
              />
              <Button
                variant="ghost"
                aria-label={V.removeColor(c.name)}
                onClick={() => onChange(withGrid(form, { colors: form.colors.filter((x) => x.id !== c.id) }))}
              >
                {V.removeShort}
              </Button>
            </div>
          ))}
          <div>
            <Button
              variant="secondary"
              disabled={form.colors.length >= MAX_COLORS}
              onClick={() => onChange(withGrid(form, { colors: [...form.colors, { id: nextColorId(form.colors), name: "", hex: DEFAULT_COLOR_HEX }] }))}
            >
              {V.addColor}
            </Button>
          </div>
        </div>
        {errors.colors ? <p id="err-colors" className="adm-field-error">{ADMIN_STRINGS.common.errorPrefix} {V.errors[errors.colors]}</p> : null}
      </fieldset>

      <fieldset className="adm-fieldset" aria-describedby={errors.sizes ? "err-sizes" : undefined}>
        <legend className="adm-field-label">{V.sizesLegend}</legend>
        <div className="adm-row adm-sizes">
          {sizeChoices(form).map((size) => (
            <Checkbox
              key={size}
              label={size}
              checked={safeSizes.includes(size)}
              onChange={(e) => onChange(withGrid(form, { sizes: e.target.checked ? [...safeSizes, size] : safeSizes.filter((s) => s !== size) }))}
            />
          ))}
        </div>
        {errors.sizes ? <p id="err-sizes" className="adm-field-error">{ADMIN_STRINGS.common.errorPrefix} {V.errors[errors.sizes]}</p> : null}
      </fieldset>

      <div>
        <h3 className="adm-h3">{V.gridTitle}</h3>
        {safeColors.length === 0 || safeSizes.length === 0 ? (
          <p className="adm-muted">{V.emptyGrid}</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table adm-grid-table">
              <caption className="adm-sr">{V.gridCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{V.colorsLegend}</th>
                  {safeSizes.map((s) => (
                    <th key={s} scope="col" className="is-end">{s}</th>
                  ))}
                  <th scope="col" className="is-end">{V.rowTotal}</th>
                </tr>
              </thead>
              <tbody>
                {safeColors.map((c) => (
                  <tr key={c.id}>
                    <th scope="row" className="adm-grid-rowhead">
                      <span className="adm-swatch" style={{ background: c.hex }} aria-hidden="true" /> {c.name || "—"}
                    </th>
                    {safeSizes.map((size) => {
                      const cell = safeVariants.find((v) => v.colorId === c.id && v.size === size);
                      if (!cell) return <td key={size} />;
                      return (
                        <td key={size} className="is-end">
                          <NumberInput
                            label={V.cell(c.name, size)}
                            hideLabel
                            min={0}
                            max={99999}
                            value={cell.stock}
                            onChange={(n) => onChange(setCellStock(form, cell.id, n ?? 0))}
                          />
                        </td>
                      );
                    })}
                    <td className="is-end adm-num">{formatNumber(rowTotal(c.id))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {errors.stock ? <p className="adm-field-error">{ADMIN_STRINGS.common.errorPrefix} {V.errors[errors.stock]}</p> : null}
        <p className="adm-total" role="status">
          <span className="adm-label adm-muted">{V.total}</span> <strong className="adm-num">{V.totalValue(formTotalStock(form))}</strong>
        </p>
      </div>
    </div>
  );
}
