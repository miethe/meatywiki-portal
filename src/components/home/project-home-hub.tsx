"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  Check,
  ExternalLink,
  Info,
  Layers3,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getDocsUrl } from "@/lib/docs-url";
import {
  capabilities,
  costStages,
  interfaceSurfaces,
  pricingAssumptionNote,
  projectUseCases,
  suiteIntegrations,
  type CapabilityId,
  type CostStageId,
  type InterfaceSurface,
  type ProjectUseCase,
  type SuiteIntegration,
  type UseCaseId,
} from "@/lib/home/project-home-content";

const DEFAULT_ARTIFACT_COUNT = 1000;
const DEFAULT_AVG_INPUT_TOKENS = 1800;
const DEFAULT_BATCH_SIZE = 5;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 10 ? 2 : 3,
    maximumFractionDigits: value >= 10 ? 2 : 3,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function resolveSurfaceHref(surface: InterfaceSurface): string {
  if (surface.href.startsWith("/docs")) {
    return `${getDocsUrl()}${surface.href.slice("/docs".length)}`;
  }
  return surface.href;
}

interface IconFrameProps {
  icon: LucideIcon;
  className?: string;
}

function IconFrame({ icon: Icon, className }: IconFrameProps) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-foreground",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
    </span>
  );
}

interface UseCaseButtonProps {
  useCase: ProjectUseCase;
  isActive: boolean;
  onSelect: (id: UseCaseId) => void;
}

function UseCaseButton({ useCase, isActive, onSelect }: UseCaseButtonProps) {
  const Icon = useCase.icon;

  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={() => onSelect(useCase.id)}
      className={cn(
        "flex min-h-[88px] w-full items-start gap-3 rounded-md border p-3 text-left transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActive
          ? "border-primary bg-primary text-primary-foreground shadow-hero"
          : "bg-background hover:bg-accent/60",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border",
          isActive
            ? "border-primary-foreground/25 bg-primary-foreground/10"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-snug">{useCase.title}</span>
        <span
          className={cn(
            "mt-1 block text-xs leading-relaxed",
            isActive ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {useCase.summary}
        </span>
      </span>
    </button>
  );
}

function UseCaseExplorer() {
  const [activeId, setActiveId] = useState<UseCaseId>(projectUseCases[0].id);
  const active = projectUseCases.find((item) => item.id === activeId) ?? projectUseCases[0];

  return (
    <section aria-labelledby="when-to-use-heading" className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
      <div className="space-y-3">
        <div>
          <h2 id="when-to-use-heading" className="font-display text-2xl font-semibold tracking-tight">
            When MeatyWiki is the right tool
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Use it when knowledge needs to become durable, searchable, source-backed, and reusable by agents.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {projectUseCases.map((useCase) => (
            <UseCaseButton
              key={useCase.id}
              useCase={useCase}
              isActive={useCase.id === active.id}
              onSelect={setActiveId}
            />
          ))}
        </div>
      </div>

      <div className="rounded-md border bg-card p-4 shadow-hero">
        <div className="flex items-start gap-3">
          <IconFrame icon={active.icon} className="bg-primary text-primary-foreground" />
          <div>
            <h3 className="font-display text-xl font-semibold tracking-tight">{active.title}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{active.when}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Best entry point</p>
            <p className="mt-2 text-sm leading-6">{active.bestSurface}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Watch out</p>
            <p className="mt-2 text-sm leading-6">{active.watchOut}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Common sources</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {active.sources.map((source) => (
                <Badge key={source} variant="secondary" className="rounded-md">
                  {source}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Typical actions</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {active.actions.map((action) => (
                <Badge key={action} variant="outline" className="rounded-md">
                  {action}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InterfacesAndCapabilities() {
  const [activeCapability, setActiveCapability] = useState<CapabilityId>(capabilities[0].id);
  const selectedCapability = capabilities.find((item) => item.id === activeCapability) ?? capabilities[0];

  return (
    <section aria-labelledby="interfaces-heading" className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="interfaces-heading" className="font-display text-2xl font-semibold tracking-tight">
              Four ways to operate the same vault
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Portal, CLI, docs, and agents all point at the same file-first knowledge base.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={`${getDocsUrl()}/user/where-to-go/`} target="_blank" rel="noreferrer">
              Where to go
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {interfaceSurfaces.map((surface) => {
            const Icon = surface.icon;
            const href = resolveSurfaceHref(surface);
            const isExternal = href.startsWith("http");

            const body = (
              <div className="flex h-full flex-col rounded-md border bg-card p-4 transition-colors hover:bg-accent/40">
                <div className="flex items-start justify-between gap-3">
                  <IconFrame icon={Icon} />
                  <ArrowRight aria-hidden="true" className="mt-2 size-4 text-muted-foreground" />
                </div>
                <span className="mt-3 block text-base font-semibold">{surface.title}</span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">{surface.description}</span>
                <code className="mt-3 block rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                  {surface.command}
                </code>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {surface.strengths.map((strength) => (
                    <Badge key={strength} variant="secondary" className="rounded-md text-[10px]">
                      {strength}
                    </Badge>
                  ))}
                </div>
              </div>
            );

            if (isExternal) {
              return (
                <a key={surface.id} href={href} target="_blank" rel="noreferrer" className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md">
                  {body}
                </a>
              );
            }

            return (
              <Link key={surface.id} href={href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md">
                {body}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border bg-card p-4">
        <div className="flex items-start gap-3">
          <IconFrame icon={Layers3} />
          <div>
            <h3 className="font-display text-xl font-semibold tracking-tight">Capability explorer</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Select a capability to see what the current system can do.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Capability explorer">
          {capabilities.map((capability) => {
            const isActive = capability.id === selectedCapability.id;
            const Icon = capability.icon;
            return (
              <button
                key={capability.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveCapability(capability.id)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-3.5" />
                {capability.title}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-md border bg-background p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold">{selectedCapability.title}</h4>
            <Badge variant={selectedCapability.status === "Current" ? "default" : "outline"} className="rounded-md">
              {selectedCapability.status}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedCapability.description}</p>
          <ul className="mt-3 grid gap-2 text-sm">
            {selectedCapability.examples.map((example) => (
              <li key={example} className="flex items-center gap-2">
                <Check aria-hidden="true" className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{example}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function CostEstimator() {
  const [artifactCount, setArtifactCount] = useState(DEFAULT_ARTIFACT_COUNT);
  const [avgInputTokens, setAvgInputTokens] = useState(DEFAULT_AVG_INPUT_TOKENS);
  const [batchSize, setBatchSize] = useState(DEFAULT_BATCH_SIZE);
  const [enabledStages, setEnabledStages] = useState<Set<CostStageId>>(
    () => new Set(costStages.filter((stage) => stage.defaultEnabled).map((stage) => stage.id)),
  );

  const estimate = useMemo(() => {
    let total = 0;
    const rows = costStages.map((stage) => {
      const enabled = enabledStages.has(stage.id);
      const effectiveBatch = stage.batchable ? Math.max(1, batchSize) : 1;
      const inputTokens = enabled
        ? (artifactCount * avgInputTokens * stage.inputMultiplier) / effectiveBatch
        : 0;
      const outputTokens = enabled
        ? (artifactCount * avgInputTokens * stage.outputMultiplier) / effectiveBatch
        : 0;
      const cost =
        (inputTokens / 1_000_000) * stage.inputPerMillion +
        (outputTokens / 1_000_000) * stage.outputPerMillion;
      total += cost;
      return { stage, inputTokens, outputTokens, cost, enabled };
    });

    return {
      rows,
      total,
      perThousand: artifactCount > 0 ? (total / artifactCount) * 1000 : 0,
    };
  }, [artifactCount, avgInputTokens, batchSize, enabledStages]);

  function toggleStage(stageId: CostStageId) {
    setEnabledStages((current) => {
      const next = new Set(current);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  }

  return (
    <section aria-labelledby="cost-heading" className="rounded-md border bg-card p-4 md:p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
        <div>
          <div className="flex items-start gap-3">
            <IconFrame icon={Calculator} />
            <div>
              <h2 id="cost-heading" className="font-display text-2xl font-semibold tracking-tight">
                Estimated cost and scale
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                This is planning math for staged LLM work. It is not live persisted telemetry until the cost-store persistence gap is fixed.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Artifacts</span>
              <Input
                type="number"
                min={1}
                max={100000}
                value={artifactCount}
                onChange={(event) => setArtifactCount(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg input tokens</span>
              <Input
                type="number"
                min={100}
                max={200000}
                value={avgInputTokens}
                onChange={(event) => setAvgInputTokens(Math.max(100, Number(event.target.value) || 100))}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Batch size</span>
              <Input
                type="number"
                min={1}
                max={25}
                value={batchSize}
                onChange={(event) => setBatchSize(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
          </div>

          <div className="mt-4 rounded-md border bg-background p-3">
            <div className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <p>
                {pricingAssumptionNote} Local capture and local embeddings are shown as zero API cost, but they still consume machine time.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estimated total</p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-tight">{formatCurrency(estimate.total)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatNumber(artifactCount)} artifacts</p>
            </div>
            <div className="rounded-md border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Per 1,000 artifacts</p>
              <p className="mt-2 font-display text-3xl font-semibold tracking-tight">{formatCurrency(estimate.perThousand)}</p>
              <p className="mt-1 text-xs text-muted-foreground">selected stages</p>
            </div>
          </div>

          <div className="rounded-md border bg-background">
            <div className="grid gap-0 divide-y">
              {estimate.rows.map(({ stage, cost, enabled }) => (
                <label key={stage.id} className="flex cursor-pointer items-start gap-3 p-3">
                  <Checkbox checked={enabled} onCheckedChange={() => toggleStage(stage.id)} aria-label={`Toggle ${stage.label}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{stage.label}</span>
                      <span className="text-sm font-semibold">{formatCurrency(cost)}</span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      {stage.model} - {stage.action}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SuiteIntegrationCard({ integration }: { integration: SuiteIntegration }) {
  const Icon = integration.icon;
  const statusVariant = integration.status === "Current" ? "default" : integration.status === "Deferred" ? "outline" : "secondary";

  return (
    <article className="rounded-md border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconFrame icon={Icon} />
          <h3 className="text-base font-semibold">{integration.app}</h3>
        </div>
        <Badge variant={statusVariant} className="rounded-md">
          {integration.status}
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 text-sm leading-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Now</p>
          <p className="mt-1 text-muted-foreground">{integration.current}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coming next</p>
          <p className="mt-1 text-muted-foreground">{integration.planned}</p>
        </div>
      </div>
    </article>
  );
}

function SuiteMap() {
  return (
    <section aria-labelledby="suite-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="suite-heading" className="font-display text-2xl font-semibold tracking-tight">
            How it fits the homelab suite
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            MeatyWiki is the file-backed knowledge layer. The surrounding tools govern artifacts, measure work, and organize intent.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`${getDocsUrl()}/user/feature-inventory/`} target="_blank" rel="noreferrer">
            Feature inventory
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </Button>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {suiteIntegrations.map((integration) => (
          <SuiteIntegrationCard key={integration.app} integration={integration} />
        ))}
      </div>
    </section>
  );
}

export function ProjectHomeHub() {
  return (
    <div className="flex flex-col gap-8">
      <section className="overflow-hidden rounded-md border bg-card shadow-hero">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5 md:p-7">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              The working home for MeatyWiki knowledge operations.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              Capture AI outputs, project plans, research, and source files into a local Markdown vault that the UI, CLI, and agents can all use.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/inbox">
                  Open inbox
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a href={`${getDocsUrl()}/user/quick-start/`} target="_blank" rel="noreferrer">
                  Read docs
                  <ExternalLink aria-hidden="true" className="size-4" />
                </a>
              </Button>
            </div>
          </div>
          <div className="border-t bg-muted/35 p-5 lg:border-l lg:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Docs deployment state</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The MkDocs site already exists, but it is served separately from the Portal app. This page links to it through the configured docs URL.
            </p>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Check aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>MkDocs docs source: current</span>
              </div>
              <div className="flex items-center gap-2">
                <Check aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Portal home route: native app surface</span>
              </div>
              <div className="flex items-center gap-2">
                <Info aria-hidden="true" className="size-4 text-amber-600 dark:text-amber-400" />
                <span>Live cost telemetry: gated by persistence fix</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <UseCaseExplorer />
      <InterfacesAndCapabilities />
      <CostEstimator />
      <SuiteMap />
    </div>
  );
}
