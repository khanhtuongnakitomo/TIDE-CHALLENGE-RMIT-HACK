"use client";

import { createContext, useContext } from "react";
import { TideCloakProvider, useTideCloak } from "@tidecloak/nextjs";
import type { TidecloakConfig } from "@tidecloak/nextjs/server";

interface LiveSession {
  live: boolean;
  authenticated: boolean;
  initializing: boolean;
  token: string | null;
  secureFetch: (
    url: string | URL | RequestInfo,
    init?: RequestInit,
  ) => Promise<Response>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  doEncrypt: (input: unknown) => Promise<unknown>;
  doDecrypt: (input: unknown) => Promise<unknown>;
}

const noOpFetch = (url: string | URL | RequestInfo, init?: RequestInit) =>
  fetch(url, init);

const localSession: LiveSession = {
  live: false,
  authenticated: false,
  initializing: false,
  token: null,
  secureFetch: noOpFetch,
  login: async () => {},
  logout: async () => {},
  doEncrypt: async () => {
    throw new Error("Tide is not configured.");
  },
  doDecrypt: async () => {
    throw new Error("Tide is not configured.");
  },
};

const LiveSessionContext = createContext<LiveSession>(localSession);
export const useLiveSession = () => useContext(LiveSessionContext);

function TideSessionBridge({ children }: { children: React.ReactNode }) {
  const tide = useTideCloak();
  return (
    <LiveSessionContext.Provider
      value={{
        live: true,
        authenticated: tide.authenticated,
        initializing: tide.isInitializing,
        token: tide.token,
        secureFetch: tide.secureFetch,
        login: tide.login,
        logout: tide.logout,
        doEncrypt: tide.doEncrypt,
        doDecrypt: tide.doDecrypt,
      }}
    >
      {children}
    </LiveSessionContext.Provider>
  );
}

export function Providers({
  children,
  config,
}: {
  children: React.ReactNode;
  config: TidecloakConfig;
}) {
  return (
    <TideCloakProvider
      config={{ ...config, useDPoP: { mode: "strict", alg: "ES256" } }}
    >
      <TideSessionBridge>{children}</TideSessionBridge>
    </TideCloakProvider>
  );
}
