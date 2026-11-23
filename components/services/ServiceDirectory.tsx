"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { ServiceIcon } from "@/components/shared/ServiceIcon";
import { EmptyState } from "@/components/shared/ui";

export interface ServiceDirectoryItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  departmentId?: string;
  departmentName: string;
}

export function ServiceDirectory({
  services,
  departments,
}: {
  services: ServiceDirectoryItem[];
  departments: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const keyword = query.trim().toLocaleLowerCase();
  const filtered = services.filter(
    (service) =>
      (!departmentId || service.departmentId === departmentId) &&
      [service.name, service.description, service.departmentName]
        .join(" ")
        .toLocaleLowerCase()
        .includes(keyword),
  );

  return (
    <div className="service-directory">
      <form
        className="service-directory-filters"
        role="search"
        aria-label="Find municipal services"
        onSubmit={(event) => event.preventDefault()}
      >
        <label htmlFor="service-search">
          Search services
          <span className="service-directory-search">
            <Search size={18} aria-hidden="true" />
            <input
              id="service-search"
              name="q"
              type="search"
              placeholder="Service name or keyword"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-controls="service-results"
            />
          </span>
        </label>
        <label htmlFor="service-department">
          Department
          <select
            id="service-department"
            name="department"
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            aria-controls="service-results"
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="service-directory-clear"
          type="button"
          disabled={!query && !departmentId}
          onClick={() => {
            setQuery("");
            setDepartmentId("");
          }}
        >
          Clear filters
        </button>
      </form>
      <p className="service-directory-count" role="status">
        {filtered.length} of {services.length}{" "}
        {services.length === 1 ? "service" : "services"}
      </p>
      <div id="service-results">
        {filtered.length ? (
          <div className="service-directory-grid">
            {filtered.map((service) => (
              <article className="service-directory-card" key={service.id}>
                <div className="service-directory-source">
                  <span className="service-directory-icon" aria-hidden="true">
                    <ServiceIcon name={service.icon} size={20} />
                  </span>
                  <span>{service.departmentName}</span>
                </div>
                <h2>{service.name}</h2>
                <p className="service-directory-description">
                  {service.description}
                </p>
                <Link href={`/services/${service.id}`} className="text-link">
                  Learn more
                  <span className="sr-only"> about {service.name}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        ) : services.length ? (
          <EmptyState />
        ) : (
          <p className="empty-state">No services have been published yet.</p>
        )}
      </div>
    </div>
  );
}
