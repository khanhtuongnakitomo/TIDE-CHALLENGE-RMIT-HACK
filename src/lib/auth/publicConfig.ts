import { loadTideConfig } from "./tidecloakConfig.ts";
import type { TidecloakConfig } from "./tidecloakConfig.ts";

/** Only public OIDC adapter fields cross the server/client boundary. */
export function publicTideConfig() {
  const adapter = loadTideConfig();

  const publicJwks = {
    keys: Array.isArray(adapter.jwk?.keys)
      ? (adapter.jwk.keys
          .map((key: Record<string, unknown>) => {
            const allowed = new Set([
              "kty",
              "kid",
              "use",
              "alg",
              "n",
              "e",
              "x",
              "y",
              "crv",
              "key_ops",
            ]);
            const publicKey = Object.fromEntries(
              Object.entries(key).filter(
                ([name, value]) =>
                  allowed.has(name) &&
                  (typeof value === "string" ||
                    (Array.isArray(value) &&
                      value.every((entry) => typeof entry === "string"))),
              ),
            );
            return typeof publicKey.kty === "string" &&
              typeof publicKey.kid === "string"
              ? publicKey
              : null;
          })
          .filter(
            (key): key is NonNullable<typeof key> => key !== null,
          ) as unknown as TidecloakConfig["jwk"]["keys"])
      : [],
  };

  const originBindings = Object.fromEntries(
    Object.entries(adapter).filter(([name, value]) => {
      const prefix = "client-origin-auth-";
      if (
        !name.startsWith(prefix) ||
        !(
          typeof value === "string" ||
          typeof value === "boolean" ||
          typeof value === "number"
        )
      ) {
        return false;
      }
      const origin = name.slice(prefix.length);
      try {
        const parsed = new URL(origin);
        return (
          (parsed.protocol === "http:" || parsed.protocol === "https:") &&
          parsed.origin === origin &&
          parsed.pathname === "/" &&
          !parsed.search &&
          !parsed.hash
        );
      } catch {
        return false;
      }
    }),
  );

  return {
    realm: adapter.realm,
    "auth-server-url": adapter["auth-server-url"],
    "ssl-required": adapter["ssl-required"],
    resource: adapter.resource,
    "public-client": adapter["public-client"],
    "confidential-port": adapter["confidential-port"],
    jwk: publicJwks,
    ...originBindings,
    ...(typeof adapter.vendorId === "string"
      ? { vendorId: adapter.vendorId }
      : {}),
    ...(typeof adapter.homeOrkUrl === "string"
      ? { homeOrkUrl: adapter.homeOrkUrl }
      : {}),
  };
}
