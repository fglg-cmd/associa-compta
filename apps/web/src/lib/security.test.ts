import { describe, expect, it } from "vitest";
import { safeNextPath } from "./utils";

describe("redirection après connexion", () => {
  it.each(["/app", "/app/tts/banque?vue=pending", "/invitation/abc"])("accepte %s", (p) => expect(safeNextPath(p)).toBe(p));
  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "", null, "/\u0000x"])("refuse %s", (p) =>
    expect(safeNextPath(p as string)).toBe("/app"),
  );
});
