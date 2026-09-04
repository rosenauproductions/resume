"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SITE_DEPLOY,
  FRESH_VISIT_PING_DEFAULT_SEC,
  FRESH_VISIT_PING_MAX_SEC,
  FRESH_VISIT_PING_MIN_SEC,
  type InsetMapSetting,
  type MetroMapSetting,
  type PipelineEnvStatus,
  type SiteDeploySetting,
} from "@/lib/db/settings";
import { DEFAULT_INSET_MAP, DEFAULT_METRO_MAP } from "@/lib/pipeline/map-regions";

const fieldClass =
  "mt-1 w-full rounded-lg border border-white/12 bg-black/35 px-3 py-2 text-sm text-[var(--cream)] outline-none focus:border-[var(--accent)]";
const labelClass = "block text-xs text-[var(--muted)]";
const btnGhost =
  "rounded-lg border border-white/15 px-3 py-1.5 text-sm text-[var(--muted)] hover:border-white/30 hover:text-[var(--cream)] disabled:opacity-50";
const btnAccent =
  "rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--ink)] disabled:opacity-50";

type Snapshot = {
  visitorIdentify?: { enabled?: boolean };
  skillsSection?: { enabled?: boolean };
  freshVisitPing?: { durationSec?: number };
  metroMap?: MetroMapSetting;
  insetMap?: InsetMapSetting;
  siteDeploy?: SiteDeploySetting;
  envStatus?: PipelineEnvStatus;
};

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
        ok
          ? "border-[var(--accent)]/40 text-[var(--accent)]"
          : "border-white/15 text-[var(--muted)]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-[var(--accent)]" : "bg-white/25"}`} />
      {label}
    </span>
  );
}

function RegionFields({
  title,
  value,
  onChange,
  onReset,
}: {
  title: string;
  value: MetroMapSetting | InsetMapSetting;
  onChange: (next: MetroMapSetting | InsetMapSetting) => void;
  onReset: () => void;
}) {
  const num = (key: keyof MetroMapSetting, raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange({ ...value, [key]: n });
  };
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-[var(--cream)]">{title}</h3>
        <button type="button" className={btnGhost} onClick={onReset}>
          Reset default
        </button>
      </div>
      <label className={labelClass}>
        Label
        <input
          className={fieldClass}
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["lng0", "Lng min"],
            ["lng1", "Lng max"],
            ["lat0", "Lat min"],
            ["lat1", "Lat max"],
          ] as const
        ).map(([key, lab]) => (
          <label key={key} className={labelClass}>
            {lab}
            <input
              type="number"
              step="any"
              className={fieldClass}
              value={value[key]}
              onChange={(e) => num(key, e.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export function PipelineSettings({
  onNotice,
  onSynced,
}: {
  onNotice?: (msg: string) => void;
  /** Keep header toggles in sync after save/load */
  onSynced?: (patch: { visitorIdentifyEnabled: boolean; skillsSectionEnabled: boolean }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteDeploy, setSiteDeploy] = useState<SiteDeploySetting>({ ...DEFAULT_SITE_DEPLOY });
  const [visitorIdentify, setVisitorIdentify] = useState(false);
  const [skillsSection, setSkillsSection] = useState(false);
  const [pingSec, setPingSec] = useState(FRESH_VISIT_PING_DEFAULT_SEC);
  const [metroMap, setMetroMap] = useState<MetroMapSetting>({ ...DEFAULT_METRO_MAP });
  const [insetMap, setInsetMap] = useState<InsetMapSetting>({ ...DEFAULT_INSET_MAP });
  const [envStatus, setEnvStatus] = useState<PipelineEnvStatus | null>(null);

  const applySnapshot = useCallback(
    (settings: Snapshot) => {
      if (settings.siteDeploy) setSiteDeploy({ ...DEFAULT_SITE_DEPLOY, ...settings.siteDeploy });
      const vi = Boolean(settings.visitorIdentify?.enabled);
      const sk = Boolean(settings.skillsSection?.enabled);
      setVisitorIdentify(vi);
      setSkillsSection(sk);
      setPingSec(
        typeof settings.freshVisitPing?.durationSec === "number"
          ? settings.freshVisitPing.durationSec
          : FRESH_VISIT_PING_DEFAULT_SEC,
      );
      if (settings.metroMap) setMetroMap(settings.metroMap);
      if (settings.insetMap) setInsetMap(settings.insetMap);
      if (settings.envStatus) setEnvStatus(settings.envStatus);
      onSynced?.({ visitorIdentifyEnabled: vi, skillsSectionEnabled: sk });
    },
    [onSynced],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pipeline/settings");
      const data = await res.json();
      if (!res.ok) {
        onNotice?.(data.error || "Could not load settings");
        return;
      }
      if (data.settings) applySnapshot(data.settings as Snapshot);
    } catch {
      onNotice?.("Network error loading settings");
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, onNotice]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/pipeline/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteDeploy,
          visitorIdentifyEnabled: visitorIdentify,
          skillsSectionEnabled: skillsSection,
          freshVisitPingDurationSec: pingSec,
          metroMap,
          insetMap,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onNotice?.(data.error || "Could not save settings");
        return;
      }
      if (data.settings) applySnapshot(data.settings as Snapshot);
      onNotice?.("Settings saved");
    } catch {
      onNotice?.("Network error saving settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-[var(--muted)]">
        Loading settings…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
            Settings
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Deploy-facing config stored in the database. Secrets (DB URL, ntfy token, Discord webhook,
            pipeline password) stay in Vercel env vars.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={btnGhost} disabled={saving} onClick={() => void load()}>
            Reload
          </button>
          <button type="button" className={btnAccent} disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[var(--panel)]/40 p-5">
        <h3 className="text-sm font-medium text-[var(--cream)]">Site</h3>
        <p className="text-xs text-[var(--muted)]">
          Public URL and SEO metadata. Resume display name / city live under Resume CMS.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Site name (Open Graph)
            <input
              className={fieldClass}
              value={siteDeploy.siteName}
              onChange={(e) => setSiteDeploy({ ...siteDeploy, siteName: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Public site URL
            <input
              className={fieldClass}
              placeholder="https://your-domain.com"
              value={siteDeploy.publicUrl}
              onChange={(e) => setSiteDeploy({ ...siteDeploy, publicUrl: e.target.value })}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Meta title
            <input
              className={fieldClass}
              value={siteDeploy.metaTitle}
              onChange={(e) => setSiteDeploy({ ...siteDeploy, metaTitle: e.target.value })}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Meta description
            <textarea
              className={`${fieldClass} min-h-[4.5rem]`}
              value={siteDeploy.metaDescription}
              onChange={(e) => setSiteDeploy({ ...siteDeploy, metaDescription: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[var(--panel)]/40 p-5">
        <h3 className="text-sm font-medium text-[var(--cream)]">Visit notifications (ntfy)</h3>
        <p className="text-xs text-[var(--muted)]">
          Topic here overrides <code className="text-[var(--cream)]">VISIT_NOTIFY_NTFY_TOPIC</code>.
          Auth token stays in env.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            ntfy topic
            <input
              className={fieldClass}
              placeholder={envStatus?.ntfyTopicEnv ? "(using env topic)" : "my-topic"}
              value={siteDeploy.ntfyTopic}
              onChange={(e) => setSiteDeploy({ ...siteDeploy, ntfyTopic: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            ntfy server
            <input
              className={fieldClass}
              placeholder="https://ntfy.sh"
              value={siteDeploy.ntfyServer}
              onChange={(e) => setSiteDeploy({ ...siteDeploy, ntfyServer: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[var(--panel)]/40 p-5">
        <h3 className="text-sm font-medium text-[var(--cream)]">Features</h3>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--cream)]">
          <input
            type="checkbox"
            checked={visitorIdentify}
            onChange={(e) => setVisitorIdentify(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Ask return visitors to identify (company / position)
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[var(--cream)]">
          <input
            type="checkbox"
            checked={skillsSection}
            onChange={(e) => setSkillsSection(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Show Skills &amp; tools on resume
        </label>
        <label className={`${labelClass} max-w-xs`}>
          Fresh visit radar burst (seconds)
          <input
            type="number"
            min={FRESH_VISIT_PING_MIN_SEC}
            max={FRESH_VISIT_PING_MAX_SEC}
            className={fieldClass}
            value={pingSec}
            onChange={(e) => setPingSec(Number(e.target.value))}
          />
        </label>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-[var(--cream)]">Target map regions</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <RegionFields
            title="Metro close-up"
            value={metroMap}
            onChange={setMetroMap}
            onReset={() => setMetroMap({ ...DEFAULT_METRO_MAP })}
          />
          <RegionFields
            title="Inset map"
            value={insetMap}
            onChange={setInsetMap}
            onReset={() => setInsetMap({ ...DEFAULT_INSET_MAP })}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[var(--panel)]/40 p-5">
        <h3 className="text-sm font-medium text-[var(--cream)]">Infrastructure (Vercel / env)</h3>
        <p className="text-xs text-[var(--muted)]">
          Read-only status. Set these in the project environment — not editable here.
        </p>
        {envStatus ? (
          <div className="flex flex-wrap gap-2">
            <StatusPill
              ok={envStatus.database}
              label={
                envStatus.database
                  ? `Database · ${envStatus.databaseHost || "connected"}`
                  : "Database · missing DATABASE_URL"
              }
            />
            <StatusPill ok={envStatus.pipelineSecret} label="Pipeline password" />
            <StatusPill ok={envStatus.ntfyToken} label="ntfy token" />
            <StatusPill ok={envStatus.ntfyTopicEnv} label="ntfy topic (env)" />
            <StatusPill ok={envStatus.discord} label="Discord webhook" />
            <StatusPill ok={envStatus.blob} label="Blob token" />
            <StatusPill ok={envStatus.aiGateway} label="AI Gateway" />
          </div>
        ) : (
          <p className="text-xs text-[var(--muted)]">Status unavailable</p>
        )}
      </section>
    </div>
  );
}
