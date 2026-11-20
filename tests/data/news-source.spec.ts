import { test, expect } from "@playwright/test";
import type { NewsArticle } from "../../types";
import {
  getNewsSource,
  newsOfficeId,
  newsOfficeOptions,
} from "../../lib/news/source";

function article(values: Partial<NewsArticle> = {}): NewsArticle {
  return {
    slug: "sample-update",
    title: "Sample update",
    category: "Old manually entered category",
    date: "2026-11-19",
    excerpt: "An update",
    image: "/images/news/community.svg",
    content: ["Body"],
    ...values,
  };
}

test("news groups by owning office identity and uses the projected department name", () => {
  const health = article({
    officeId: "health-office-id",
    source: { name: "Municipal Health Office", slug: "health" },
  });
  const renamed = article({
    ...health,
    slug: "second-update",
    source: { name: "Health Services Office", slug: "health-services" },
  });
  expect(getNewsSource(health)).toEqual(health.source);
  expect(newsOfficeId(health)).toBe(newsOfficeId(renamed));
  expect(newsOfficeOptions([health, renamed])).toEqual([
    { id: "health-office-id", name: "Health Services Office" },
  ]);
  expect(newsOfficeOptions([health])).not.toContainEqual({
    id: health.category,
    name: health.category,
  });
});

test("inactive or unpublished department sources stay unlinked", () => {
  const hiddenDepartment = article({
    officeId: "hidden-office-id",
    source: { name: "Archived Department" },
  });
  expect(getNewsSource(hiddenDepartment)).toEqual({
    name: "Archived Department",
  });
  expect(getNewsSource(hiddenDepartment)).not.toHaveProperty("slug");
});

test("legacy unassigned news uses a neutral source and legislative news retains its office", () => {
  const unassigned = article();
  const legislative = article({ contentScope: "legislative" });
  expect(getNewsSource(unassigned)).toEqual({
    name: "Municipal information portal",
  });
  expect(getNewsSource(legislative)).toEqual({ name: "Legislative Access" });
  expect(
    newsOfficeOptions([
      unassigned,
      article({ category: "Another obsolete category" }),
      legislative,
    ]),
  ).toEqual([
    { id: "source:Legislative Access", name: "Legislative Access" },
    {
      id: "source:Municipal information portal",
      name: "Municipal information portal",
    },
  ]);
});
