import { describe, expect, test } from "bun:test"
import { embeddedOrigins, openEmbeddedLink, openSessionLink } from "./link"

describe("embedded session links", () => {
  test("normalizes valid configured HTTP origins", () => {
    expect([
      ...embeddedOrigins([
        "https://review.example/path",
        "mailto:review@example.com",
        "not a URL",
      ]),
    ]).toEqual(["https://review.example"])
  })

  test("opens only HTTP links whose origin is configured", () => {
    const opened: string[] = []
    const origins = new Set(["https://review.example"])
    const attempt = (url: string) =>
      openEmbeddedLink({
        url,
        origins,
        available: true,
        suspended: false,
        open: async () => {
          opened.push(url)
        },
        fallback: () => undefined,
      })

    expect(attempt("https://review.example/issue?id=1#activity")).toBe(true)
    expect(attempt("https://other.example/")).toBe(false)
    expect(attempt("http://review.example/")).toBe(false)
    expect(attempt("mailto:review@example.com")).toBe(false)
    expect(attempt("javascript:alert(1)")).toBe(false)
    expect(attempt("data:text/plain,hello")).toBe(false)
    expect(attempt("file:///tmp/report.html")).toBe(false)
    expect(opened).toEqual(["https://review.example/issue?id=1#activity"])
  })

  test("falls back after pane rejection and skips unavailable panes", async () => {
    const fallback: string[] = []
    const input = {
      url: "https://review.example/",
      origins: new Set(["https://review.example"]),
      suspended: false,
      open: () => Promise.reject(new Error("navigation rejected")),
      fallback: () => fallback.push("external"),
    }

    expect(openEmbeddedLink({ ...input, available: true })).toBe(true)
    await Promise.resolve()
    expect(fallback).toEqual(["external"])
    expect(openEmbeddedLink({ ...input, available: false })).toBe(false)
    expect(openEmbeddedLink({ ...input, available: true, suspended: true })).toBe(false)
  })

  test("routes links that cannot embed through the platform fallback", () => {
    const fallback: string[] = []
    expect(
      openSessionLink({
        url: "https://docs.example/",
        origins: new Set(["https://review.example"]),
        available: true,
        suspended: false,
        open: async () => undefined,
        fallback: () => fallback.push("external"),
      }),
    ).toBe(true)
    expect(fallback).toEqual(["external"])
  })
})
