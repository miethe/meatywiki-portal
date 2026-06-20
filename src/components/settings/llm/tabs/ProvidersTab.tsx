"use client";

/**
 * ProvidersTab — inline-editable provider list for LLM Settings.
 *
 * Renders one Card per ProviderRead entry returned by GET /providers.
 * Each card shows id, adapter, base_url, api_key_env, and an api_key_is_set
 * Badge ("Key set" / "No key"). An inline edit form lets the user update
 * adapter, base_url, and api_key_env (the env-var name, not a secret value)
 * via PUT /providers/{id}.
 *
 * SECURITY INVARIANT: api_key values are NEVER rendered. ProviderRead carries
 * only api_key_is_set (boolean). No input for raw key values here — actual
 * secrets live in the Keys tab.
 *
 * Error handling:
 *   422 CONFIG_INVALID  → inline form-level error message.
 *   404 PROVIDER_NOT_FOUND → non-retryable inline notice; edit form closed.
 *
 * Traces: portal-llm-settings-frontend FE-P4 (P4-04).
 */

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  Badge,
  FormField,
  Input,
  Spinner,
} from "@miethe/ui";
import { useProviders, useUpsertProvider } from "@/hooks/useLlmSettings";
import { ApiError } from "@/lib/api/client";
import type { LlmSettingsError } from "@/lib/api/llm-settings.types";
import type { ProviderDescriptor } from "@/lib/api/llm-settings.types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractApiErrorCode(err: ApiError): string | null {
  const body = err.body as LlmSettingsError | null;
  if (body !== null && typeof body === "object" && "code" in body) {
    return body.code ?? null;
  }
  return null;
}

function extractApiErrorMessage(err: ApiError): string {
  const body = err.body as LlmSettingsError | null;
  if (
    body !== null &&
    typeof body === "object" &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }
  return `Request failed (${err.status})`;
}

// ── ProviderEditForm ──────────────────────────────────────────────────────────

interface ProviderEditFormProps {
  providerId: string;
  initial: ProviderDescriptor;
  onSaved: () => void;
  onCancel: () => void;
}

function ProviderEditForm({
  providerId,
  initial,
  onSaved,
  onCancel,
}: ProviderEditFormProps) {
  const { mutateAsync, isPending } = useUpsertProvider();

  const [adapter, setAdapter] = useState(initial.adapter);
  const [baseUrl, setBaseUrl] = useState(initial.base_url ?? "");
  const [apiKeyEnv, setApiKeyEnv] = useState(initial.api_key_env ?? "");

  const [formError, setFormError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setNotFound(false);

    const body: ProviderDescriptor = {
      adapter,
      base_url: baseUrl || null,
      api_key_env: apiKeyEnv || null,
    };

    try {
      await mutateAsync({ id: providerId, body });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        const code = extractApiErrorCode(err);
        if (err.status === 404 || code === "PROVIDER_NOT_FOUND") {
          setNotFound(true);
          return;
        }
        // 422 CONFIG_INVALID and other errors → form-level error.
        setFormError(extractApiErrorMessage(err));
      } else {
        setFormError("Save failed — is the backend running?");
      }
    }
  }

  if (notFound) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Provider not found. It may have been removed.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <FormField label="Adapter" htmlFor={`adapter-${providerId}`} required>
        <Input
          id={`adapter-${providerId}`}
          value={adapter}
          onChange={(e) => setAdapter(e.target.value)}
          disabled={isPending}
          placeholder="e.g. anthropic, openai, ollama"
        />
      </FormField>

      <FormField label="Base URL" htmlFor={`base-url-${providerId}`}>
        <Input
          id={`base-url-${providerId}`}
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          disabled={isPending}
          placeholder="Optional — leave blank for provider default"
        />
      </FormField>

      {/* api_key_env: the env-var NAME only. Never a raw key value. */}
      <FormField
        label="API Key Env Var"
        htmlFor={`api-key-env-${providerId}`}
        hint="Name of the environment variable that holds the API key (e.g. ANTHROPIC_API_KEY). The actual secret is managed in the Keys tab."
      >
        <Input
          id={`api-key-env-${providerId}`}
          value={apiKeyEnv}
          onChange={(e) => setApiKeyEnv(e.target.value)}
          disabled={isPending}
          placeholder="e.g. ANTHROPIC_API_KEY"
        />
      </FormField>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending || !adapter.trim()}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Spinner size="sm" aria-label="Saving" />
              Saving…
            </>
          ) : (
            "Save"
          )}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={onCancel}
          className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── ProviderCard ──────────────────────────────────────────────────────────────

interface ProviderCardProps {
  id: string;
  adapter: string;
  base_url: string | null;
  api_key_env: string | null;
  api_key_is_set: boolean;
}

function ProviderCard({
  id,
  adapter,
  base_url,
  api_key_env,
  api_key_is_set,
}: ProviderCardProps) {
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm">{id}</span>

          {/* api_key_is_set badge — boolean only, never a key value */}
          <Badge
            variant={api_key_is_set ? "default" : "secondary"}
            aria-label={api_key_is_set ? "API key is set" : "No API key set"}
          >
            {api_key_is_set ? "Key set" : "No key"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Adapter</dt>
          <dd>{adapter}</dd>

          <dt className="text-muted-foreground">Base URL</dt>
          <dd className="truncate">{base_url ?? <span className="text-muted-foreground italic">default</span>}</dd>

          {/* api_key_env: shows the env-var name, never a secret value */}
          <dt className="text-muted-foreground">API Key Env</dt>
          <dd>{api_key_env ?? <span className="text-muted-foreground italic">none</span>}</dd>
        </dl>

        {editing ? (
          <ProviderEditForm
            providerId={id}
            initial={{ adapter, base_url, api_key_env }}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit provider ${id}`}
            className="mt-4 inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Edit
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// ── ProvidersTab ──────────────────────────────────────────────────────────────

export function ProvidersTab() {
  const { providers, isLoading, isError, error } = useProviders();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner size="md" aria-label="Loading providers" />
      </div>
    );
  }

  if (isError) {
    return (
      <p role="alert" className="text-sm text-destructive py-4">
        {error?.message ?? "Failed to load providers."}
      </p>
    );
  }

  if (providers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No providers configured.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4" aria-label="LLM providers">
      {providers.map((provider) => (
        <ProviderCard
          key={provider.id}
          id={provider.id}
          adapter={provider.adapter}
          base_url={provider.base_url}
          api_key_env={provider.api_key_env}
          api_key_is_set={provider.api_key_is_set}
        />
      ))}
    </div>
  );
}
