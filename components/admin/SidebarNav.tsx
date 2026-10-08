"use client";
import { useState } from "react";
export function SidebarNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="admin-menu-toggle"
        aria-expanded={open}
        aria-controls="admin-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? "Close menu" : "Menu"}
      </button>
      <nav
        id="admin-navigation"
        aria-label="Administration"
        className={open ? "admin-navigation is-open" : "admin-navigation"}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        {children}
      </nav>
    </>
  );
}
