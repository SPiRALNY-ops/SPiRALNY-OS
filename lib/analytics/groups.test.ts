import { describe, expect, it } from "vitest";
import { pageGroup, searchGroup } from "./groups";

describe("search groups (cases from Spiral NY's Search Console)", () => {
  it("knows searches for Spiral", () => {
    for (const q of [
      "spiralny",
      "spiral ny",
      "spiral ny real estate",
      "spiralny new york ny",
      "spiralny reviews",
      "the spiral ny",
      "site:spiralny.com",
      "luca matteucci spiralny linkedin",
      "what card product does spiralny (spiralny.com) use?",
    ]) {
      expect(searchGroup(q), q).toBe("brand");
    }
  });

  it("keeps other spirals out of the brand", () => {
    for (const q of [
      "przewód spiralny pneumatyczny",
      "peszel spiralny",
      "spiral staircases nyc",
      "drut spiralny",
      "sit spiralny",
      "model spiralny",
      "notes spiralny",
      "związek spiralny",
      "aplikator spiralny",
      '"spiralny adapter kablowy qly-s do naczepy 24v wtyk 15-pin / 2 zalewane wtyki 7-pin typu n+s 4m"',
    ]) {
      expect(searchGroup(q), q).not.toBe("brand");
    }
  });

  it("finds the searches an agent makes when choosing a brokerage", () => {
    for (const q of [
      "100 commission real estate brokerage",
      "high split real estate brokerage",
      "park real estate license",
      "park my real estate license ny",
      "keep real estate license active ny",
      "real estate referral agent",
      "nyc real estate broker",
      "100% commission",
    ]) {
      expect(searchGroup(q), q).toBe("recruiting");
    }
  });

  it("leaves home buyers and agents' names in everything else", () => {
    for (const q of ["real estate buying agent", "buyers agent", "kevin shivcharran", "apartments for sale", "nyc luxury market report 2025"]) {
      expect(searchGroup(q), q).toBe("other");
    }
  });
});

describe("page groups", () => {
  it("sorts spiralny.com pages", () => {
    expect(pageGroup("https://spiralny.com/")).toBe("home");
    expect(pageGroup("https://www.spiralny.com/")).toBe("home");
    expect(pageGroup("/100-commission-brokerage/")).toBe("recruiting");
    expect(pageGroup("https://spiralny.com/park-your-license-and-stay-active-in-manhattan/")).toBe("recruiting");
    expect(pageGroup("https://spiralny.com/new-york-real-estate-referral-agent/")).toBe("recruiting");
    expect(pageGroup("https://spiralny.com/join-our-team/")).toBe("recruiting");
    expect(pageGroup("https://blog.spiralny.com/how-100-commission-structures-work/")).toBe("recruiting");
    expect(pageGroup("https://blog.spiralny.com/q3-2026-new-york-residential-real-estate-market-report/")).toBe("blog");
    expect(pageGroup("https://spiralny.com/our-agents/sandy-tan/")).toBe("agents");
    expect(pageGroup("https://spiralny.com/new-york-city-buyers-agent/")).toBe("other");
  });
});
