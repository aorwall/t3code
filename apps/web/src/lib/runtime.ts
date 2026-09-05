import * as ManagedRuntime from "effect/ManagedRuntime";
import type * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Socket from "effect/unstable/socket/Socket";

import { remoteHttpClientLayer } from "@t3tools/client-runtime/rpc";
import { makeRelayClientTracingLayer } from "@t3tools/shared/relayTracing";
import * as PrimaryEnvironmentHttpClient from "../environments/primary/httpClient";
import { primaryEnvironmentHttpLayer } from "../environments/primary/httpLayer";

import { browserCryptoLayer } from "../cloud/dpop";
import { managedRelayClientLayer } from "../cloud/managedRelayLayer";
import { resolveCloudPublicConfig, resolveRelayTracingConfig } from "../cloud/publicConfig";
// Fork: added import — the environment tracer this runtime installs below.
import { ClientTracingLive } from "../observability/clientTracing";

function configuredRelayUrl(): string {
  return resolveCloudPublicConfig().relayUrl ?? "http://relay.invalid";
}

const httpClientLayer = remoteHttpClientLayer((input, init) => globalThis.fetch(input, init));
const relayTracingLayer = makeRelayClientTracingLayer(resolveRelayTracingConfig(), {
  serviceName: "t3-web-relay-client",
  serviceVersion: import.meta.env.APP_VERSION,
  runtime: "browser",
  client: typeof window !== "undefined" && window.desktopBridge ? "desktop" : "web",
}).pipe(Layer.provide(httpClientLayer));

type RuntimeLayerSource =
  | typeof httpClientLayer
  | typeof browserCryptoLayer
  | typeof Socket.layerWebSocketConstructorGlobal
  | typeof relayTracingLayer
  // Fork: added member — see the `ClientTracingLive` entry in `runtimeLayer`.
  | typeof ClientTracingLive
  | ReturnType<typeof managedRelayClientLayer>;

export const remoteHttpRuntime = ManagedRuntime.make(httpClientLayer);

const primaryHttpRuntime = ManagedRuntime.make(
  PrimaryEnvironmentHttpClient.layer.pipe(Layer.provide(primaryEnvironmentHttpLayer)),
);

export type PrimaryHttpEffectRunner = <A, E>(
  effect: Effect.Effect<A, E, PrimaryEnvironmentHttpClient.PrimaryEnvironmentHttpClient>,
) => Promise<A>;

const livePrimaryHttpRunner: PrimaryHttpEffectRunner = (effect) =>
  primaryHttpRuntime.runPromise(effect);

let primaryHttpRunner = livePrimaryHttpRunner;

export const runPrimaryHttp = <A, E>(
  effect: Effect.Effect<A, E, PrimaryEnvironmentHttpClient.PrimaryEnvironmentHttpClient>,
) => primaryHttpRunner(effect);

export function __setPrimaryHttpRunnerForTests(runner?: PrimaryHttpEffectRunner): void {
  primaryHttpRunner = runner ?? livePrimaryHttpRunner;
}

const runtimeLayer = Layer.mergeAll(
  httpClientLayer,
  browserCryptoLayer,
  Socket.layerWebSocketConstructorGlobal,
  relayTracingLayer,
  // Fork: added entry. `configureClientTracing` (called from `__root.tsx`)
  // builds the OTLP delegate, but nothing installed the `Tracer.Tracer` that
  // routes spans to it, so every span the client made was dropped — including
  // the `traceId`/`spanId` it puts on each RPC frame, which left the Moatless
  // backend's spans parented to a trace nobody ever exported. The relay tracer
  // above is unaffected: `withRelayClientTracing` still overrides this locally.
  ClientTracingLive,
  managedRelayClientLayer(configuredRelayUrl()).pipe(
    Layer.provide(Layer.mergeAll(httpClientLayer, browserCryptoLayer)),
  ),
);

export const runtime: ManagedRuntime.ManagedRuntime<
  Layer.Success<RuntimeLayerSource>,
  Layer.Error<RuntimeLayerSource>
> = ManagedRuntime.make(runtimeLayer);

export const runtimeContextLayer: Layer.Layer<
  Layer.Success<RuntimeLayerSource>,
  Layer.Error<RuntimeLayerSource>
> = Layer.effectContext(runtime.contextEffect);
