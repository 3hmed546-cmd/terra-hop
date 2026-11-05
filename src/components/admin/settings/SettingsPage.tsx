"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import {
  formToSettings,
  isSettingsFormEqual,
  SESSION_HOUR_CHOICES,
  settingsToForm,
  validatePasswordForm,
  validateSettingsForm,
  type PasswordFormState,
  type SettingsFormState,
} from "@/lib/admin/settings-form";
import { useAdminStore } from "@/lib/admin/store";
import { useUnsavedChanges } from "@/lib/admin/use-unsaved-changes";
import type { Settings } from "@/lib/admin/types";
import { PageHeader } from "../PageHeader";
import { useShortcutHelp } from "../ShortcutsDialog";
import { AdminPushToggle } from "../ui/AdminPushToggle";
import { Button, Checkbox, Dialog, NumberInput, Select, TextInput, useToast } from "../ui";

const S = ADMIN_STRINGS.settings;

function Section({ id, title, children, preview }: { id: string; title: string; children: React.ReactNode; preview?: boolean }) {
  return (
    <section className="adm-card adm-form-section" aria-labelledby={`set-${id}`}>
      <div className="adm-row">
        <h2 className="adm-h2" id={`set-${id}`}>{title}</h2>
        {preview ? <span className="adm-badge adm-badge-draft">{S.previewOnly}</span> : null}
      </div>
      {children}
    </section>
  );
}

function SettingsEditor({ settings }: { settings: Settings }) {
  const router = useRouter();
  const toast = useToast();
  const help = useShortcutHelp();
  const { actions } = useAdminStore();

  const initial = useMemo(() => settingsToForm(settings), [settings]);
  const [form, setForm] = useState<SettingsFormState>(initial);
  const [base, setBase] = useState<SettingsFormState>(initial);
  const [submitted, setSubmitted] = useState(false);
  // If the settings change somewhere else (Reset demo data, another tab), show the new values
  // instead of stale ones. Our own Save lands here too but already matches `base`, so nothing moves.
  const [seen, setSeen] = useState(settings);
  if (seen !== settings) {
    setSeen(settings);
    if (!isSettingsFormEqual(initial, base)) {
      setForm(initial);
      setBase(initial);
      setSubmitted(false);
    }
  }
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [focusSummary, setFocusSummary] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);

  const errors = useMemo(() => (submitted ? validateSettingsForm(form) : {}), [submitted, form]);
  const errorCodes = Object.values(errors);
  const dirty = !isSettingsFormEqual(form, base) && !leaving;
  useUnsavedChanges(dirty, setLeaveTo);

  useEffect(() => {
    if (focusSummary > 0) summaryRef.current?.focus();
  }, [focusSummary]);

  const patch = (p: Partial<SettingsFormState>) => setForm((f) => ({ ...f, ...p }));

  const save = async () => {
    setSubmitted(true);
    if (isSettingsFormEqual(form, base)) {
      toast.push(S.noChanges);
      return;
    }
    if (Object.keys(validateSettingsForm(form)).length > 0) {
      setFocusSummary((n) => n + 1);
      return;
    }
    const next = formToSettings(form, settings);
    const result = await actions.updateSettings(next);
    if (!result.ok) {
      toast.push(ADMIN_STRINGS.errors[result.error]);
      return;
    }
    const clean = settingsToForm(next);
    setForm(clean);
    setBase(clean);
    setSubmitted(false);
    toast.push(S.saved);
  };

  const discard = () => {
    if (!dirty) return;
    setForm(base);
    setSubmitted(false);
    toast.push(S.discarded);
  };

  const leave = useCallback(() => {
    if (!leaveTo) return;
    setLeaving(true);
    const target = leaveTo;
    setLeaveTo(null);
    router.push(target);
  }, [leaveTo, router]);

  const hours = form.emailHours ?? settings.emailTokenHours;
  const storeLabel = form.storeName.trim() || settings.storeName;
  const sessionOptions = SESSION_HOUR_CHOICES.map((h) => ({ value: String(h), label: S.sessionOptions[h]! }));
  const E = S.errors;

  return (
    <>
      <form className="adm-form" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {errorCodes.length > 0 ? (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="adm-summary">
            <strong>{S.summaryTitle(errorCodes.length)}</strong>
            <ul>{errorCodes.map((c) => <li key={c}>{E[c]}</li>)}</ul>
          </div>
        ) : null}

        <Section id="store" title={S.sections.store}>
          <TextInput label={S.storeName} required maxLength={60} value={form.storeName} error={errors.storeName ? E[errors.storeName] : undefined} onChange={(e) => patch({ storeName: e.target.value })} />
          <TextInput label={S.currency} value="EGP" readOnly hint={S.currencyHint} />
          <NumberInput label={S.shipping} required decimal prefix="EGP" value={form.shipping} hint={S.shippingHint} error={errors.shipping ? E[errors.shipping] : undefined} onChange={(v) => patch({ shipping: v })} />
        </Section>

        <Section id="stock" title={S.sections.stock}>
          <NumberInput label={S.lowStock} required min={1} max={99} value={form.lowStock} suffix="pieces" hint={S.lowStockHint} error={errors.lowStock ? E[errors.lowStock] : undefined} onChange={(v) => patch({ lowStock: v })} />
          <fieldset className="adm-fieldset">
            <legend className="adm-field-label">{S.reservation.legend}</legend>
            {(["none", "hold"] as const).map((value) => (
              <label key={value} className="adm-check">
                <input type="radio" name="reservation" value={value} checked={form.reservation === value} onChange={() => patch({ reservation: value })} />
                <span className="adm-check-text">
                  <span>{S.reservation[value]}</span>
                  <span className="adm-field-hint">{S.reservation[`${value}Hint` as const]}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </Section>

        <Section id="email" title={S.sections.email}>
          <NumberInput label={S.emailHours} required min={1} max={168} value={form.emailHours} suffix={S.emailHoursSuffix} hint={S.emailHoursHint} error={errors.emailHours ? E[errors.emailHours] : undefined} onChange={(v) => patch({ emailHours: v })} />
          <div className="adm-preview-box" role="group" aria-labelledby="set-template-title">
            <h3 className="adm-h3" id="set-template-title">{S.template.title}</h3>
            <p className="adm-small adm-muted adm-nomargin">{S.template.note}</p>
            <p className="adm-nomargin"><strong>{S.template.subject(storeLabel)}</strong></p>
            {S.template.lines(storeLabel, hours).map((line) => (
              <p key={line} className="adm-nomargin">{line}</p>
            ))}
          </div>
        </Section>

        <Section id="account" title={S.sections.account} preview>
          <Select
            label={S.session}
            hint={S.sessionHint}
            value={String(form.sessionHours)}
            options={sessionOptions}
            onChange={(e) => patch({ sessionHours: Number(e.target.value) })}
          />
        </Section>

        <Section id="keyboard" title={S.sections.keyboard}>
          <Checkbox label={S.shortcuts.toggle} hint={S.shortcuts.toggleHint} checked={form.shortcuts} onChange={(e) => patch({ shortcuts: e.target.checked })} />
          <div className="adm-row">
            <Button variant="secondary" onClick={help.open}>{S.shortcuts.view}</Button>
          </div>
        </Section>

        <Section id="push-notifications" title="إشعارات الطلبات الفورية (Web Push)">
          <AdminPushToggle />
        </Section>

        <div className="adm-form-actions">
          <Button variant="secondary" onClick={discard} aria-disabled={!dirty ? true : undefined}>{S.discard}</Button>
          <Button type="submit">{S.save}</Button>
        </div>
      </form>

      <Dialog
        open={leaveTo !== null}
        onClose={() => setLeaveTo(null)}
        title={ADMIN_STRINGS.productForm.unsaved.title}
        description={ADMIN_STRINGS.productForm.unsaved.text}
        footer={
          <>
            <Button variant="secondary" onClick={leave}>{ADMIN_STRINGS.productForm.unsaved.leave}</Button>
            <Button onClick={() => setLeaveTo(null)}>{ADMIN_STRINGS.productForm.unsaved.stay}</Button>
          </>
        }
      />
    </>
  );
}

function PasswordSection() {
  const toast = useToast();
  const [form, setForm] = useState<PasswordFormState>({ current: "", next: "", confirm: "" });
  const [submitted, setSubmitted] = useState(false);
  const [focusSummary, setFocusSummary] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  const errors = useMemo(() => (submitted ? validatePasswordForm(form) : {}), [submitted, form]);
  const codes = Object.values(errors);
  const P = S.password;

  useEffect(() => {
    if (focusSummary > 0) summaryRef.current?.focus();
  }, [focusSummary]);

  return (
    <section className="adm-card adm-form-section" aria-labelledby="set-password">
      <div className="adm-row">
        <h2 className="adm-h2" id="set-password">{P.title}</h2>
        <span className="adm-badge adm-badge-draft">{S.previewOnly}</span>
      </div>
      <p className="adm-muted adm-nomargin">{P.text}</p>
      <form
        className="adm-stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (Object.keys(validatePasswordForm(form)).length > 0) {
            setFocusSummary((n) => n + 1);
            return;
          }
          setForm({ current: "", next: "", confirm: "" });
          setSubmitted(false);
          toast.push(P.done);
        }}
      >
        {codes.length > 0 ? (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="adm-summary">
            <strong>{P.summaryTitle(codes.length)}</strong>
            <ul>{codes.map((c) => <li key={c}>{P.errors[c]}</li>)}</ul>
          </div>
        ) : null}
        <TextInput label={P.current} type="password" autoComplete="current-password" required value={form.current} error={errors.current ? P.errors[errors.current] : undefined} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} />
        <TextInput label={P.next} type="password" autoComplete="new-password" required hint={P.nextHint} value={form.next} error={errors.next ? P.errors[errors.next] : undefined} onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} />
        <TextInput label={P.confirm} type="password" autoComplete="new-password" required value={form.confirm} error={errors.confirm ? P.errors[errors.confirm] : undefined} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} />
        <div className="adm-row"><Button type="submit" variant="secondary">{P.button}</Button></div>
      </form>
    </section>
  );
}

function SignOutAllSection() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const O = S.signOutAll;
  return (
    <section className="adm-card adm-form-section" aria-labelledby="set-signout">
      <div className="adm-row">
        <h2 className="adm-h2" id="set-signout">{O.title}</h2>
        <span className="adm-badge adm-badge-draft">{S.previewOnly}</span>
      </div>
      <p className="adm-muted adm-nomargin">{O.text}</p>
      <div className="adm-row"><Button variant="secondary" onClick={() => setOpen(true)}>{O.button}</Button></div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={O.dialogTitle}
        description={O.dialogText}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{ADMIN_STRINGS.common.cancel}</Button>
            <Button onClick={() => { setOpen(false); toast.push(O.done); }}>{O.confirm}</Button>
          </>
        }
      />
    </section>
  );
}

function PathAndDemoSections() {
  const toast = useToast();
  const { actions, ready } = useAdminStore();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <section className="adm-card adm-form-section" aria-labelledby="set-path">
        <h2 className="adm-h2" id="set-path">{S.sections.path}</h2>
        <p className="adm-muted adm-nomargin">{S.path.text}</p>
      </section>
      <section className="adm-card adm-form-section" aria-labelledby="set-demo">
        <h2 className="adm-h2" id="set-demo">{S.sections.demo}</h2>
        <p className="adm-muted adm-nomargin">{S.demo.text}</p>
        <div className="adm-row">
          <Button variant="secondary" disabled={!ready} onClick={() => setConfirming(true)}>{S.demo.reset}</Button>
        </div>
      </section>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={S.demo.dialogTitle}
        description={S.demo.dialogText}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>{ADMIN_STRINGS.common.cancel}</Button>
            <Button onClick={() => { actions.resetDemo(); setConfirming(false); toast.push(S.demo.done); }}>{S.demo.reset}</Button>
          </>
        }
      />
    </>
  );
}

export function SettingsPage() {
  const { data, ready } = useAdminStore();
  const header = <PageHeader title={ADMIN_STRINGS.pages.settings.title} description={ADMIN_STRINGS.pages.settings.summary} />;

  if (!ready || !data) {
    return (
      <>
        {header}
        <div className="adm-skeleton" role="status"><span className="adm-sr">{ADMIN_STRINGS.common.loading}</span></div>
      </>
    );
  }
  return (
    <>
      {header}
      <div className="adm-form">
        <SettingsEditor settings={data.settings} />
        <PasswordSection />
        <SignOutAllSection />
        <PathAndDemoSections />
      </div>
    </>
  );
}
