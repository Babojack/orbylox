import { useState } from "react";
import { HeartHandshake, Check, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/LanguageProvider";
import { useContactCare } from "@/hooks/useContactCare";

/**
 * Kontaktpflege im Dashboard.
 *
 * Solange die Erinnerung fällig ist, pulsiert die Karte — und hört damit
 * nicht auf, bis drei Namen eingetragen und abgeschickt sind. Das ist
 * ausdrücklich so gewollt: eine Erinnerung, die man wegklicken kann, wird
 * weggeklickt.
 *
 * Wer im System "weniger Bewegung" eingestellt hat, bekommt statt des
 * Pulsierens einen kräftigen orangen Rahmen (siehe index.css).
 */
export default function ContactCareCard({ user }) {
  const { t, language } = useLanguage();
  const { prefs, loaded, due, nextAt, complete } = useContactCare(user);
  const [names, setNames] = useState(["", "", ""]);
  const [saving, setSaving] = useState(false);
  const [justDone, setJustDone] = useState(false);

  if (!loaded || !prefs.enabled) return null;

  const filled = names.filter((n) => n.trim()).length;
  const ready = filled === 3;
  const locale = language === "en" ? "en-US" : "de-DE";

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    const ok = await complete(names);
    setSaving(false);
    if (ok) {
      setNames(["", "", ""]);
      setJustDone(true);
      window.setTimeout(() => setJustDone(false), 6000);
    }
  };

  // Erledigt und nicht fällig: ruhige Karte mit dem nächsten Termin
  if (!due) {
    return (
      <div className="border-2 border-black bg-white p-4 sm:p-5 flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 bg-green-600 text-white flex items-center justify-center">
          <Check className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-black">{t("contactCareTitle")}</p>
          <p className="text-sm text-slate-600 mt-0.5">
            {justDone ? t("contactCareThanks") : t("contactCareAllGood")}
            {nextAt && (
              <>
                {" "}
                {t("contactCareNext").replace(
                  "{date}",
                  nextAt.toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "2-digit" }),
                )}
              </>
            )}
          </p>
          {prefs.log?.length > 0 && (
            <p className="text-xs text-slate-400 mt-2 truncate">
              {t("contactCareLast")}: {prefs.log[prefs.log.length - 1].names.join(", ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="tn-attention border-2 border-[#ef5a24] bg-white p-4 sm:p-5"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 mb-4">
        <span className="w-9 h-9 shrink-0 bg-[#ef5a24] text-white flex items-center justify-center">
          <HeartHandshake className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-black">{t("contactCareTitle")}</p>
          <p className="text-sm text-slate-600 mt-0.5">{t("contactCarePrompt")}</p>
        </div>
        <span className="ml-auto shrink-0 text-xs font-bold uppercase tracking-wide px-2 py-1 bg-[#ef5a24] text-white">
          {filled}/3
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {names.map((value, i) => (
          <label key={i} className="block">
            <span className="sr-only">{t("contactCareName")} {i + 1}</span>
            <Input
              value={value}
              onChange={(e) => {
                const next = [...names];
                next[i] = e.target.value;
                setNames(next);
              }}
              placeholder={`${t("contactCareName")} ${i + 1}`}
              className={`h-11 border-2 ${value.trim() ? "border-black" : "border-slate-200"}`}
              autoComplete="off"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="submit"
          disabled={!ready || saving}
          className={`inline-flex items-center justify-center gap-2 h-11 px-5 text-sm font-bold uppercase tracking-wide border-2 transition-colors ${
            ready
              ? "bg-[#ef5a24] border-[#ef5a24] text-white hover:bg-black hover:border-black"
              : "bg-white border-slate-200 text-slate-400 cursor-not-allowed"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          {t("contactCareDone")}
        </button>
        <p className="text-xs text-slate-500">
          {ready ? t("contactCareReady") : t("contactCareHint")}
        </p>
      </div>
    </form>
  );
}
