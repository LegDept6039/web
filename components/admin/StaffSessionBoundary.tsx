"use client";
import { AdminSkeleton } from "@/components/shared/PageSkeleton";
import { useEffect, useState } from "react";
import { checkStaffSession } from "@/app/login/session-actions";
import { logout } from "@/app/login/actions";
import { STAFF_TAB_KEY } from "@/lib/auth/session-policy";

export function StaffSessionBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Checking your staff session...");
  useEffect(() => {
    let disposed = false,
      ending = false,
      busy = false;
    let deadline = 0,
      lastSent = 0,
      dirty = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let token = "";
    async function end() {
      if (ending || disposed) return;
      ending = true;
      setReady(false);
      setMessage("Your staff session has ended. Signing out...");
      try {
        sessionStorage.removeItem(STAFF_TAB_KEY);
      } catch {
        /* blocked storage */
      }
      try {
        await logout();
      } catch {
        if (!disposed)
          setMessage(
            "Your session is locked. Reconnect and reload to sign in again.",
          );
      }
    }
    function schedule() {
      clearTimeout(timer);
      if (!disposed && !ending)
        timer = setTimeout(
          () => void end(),
          Math.max(0, deadline - Date.now()),
        );
    }
    async function verify(activity: boolean) {
      if (disposed || ending || busy) return;
      busy = true;
      try {
        const result = await checkStaffSession(token, activity);
        if (disposed) return;
        if (!result) {
          void end();
          return;
        }
        if ("passwordReset" in result) {
          ending = true;
          setReady(false);
          setMessage(
            "A password change is required. Opening the password form...",
          );
          // Discard cached CMS payloads when credentials are revoked.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/change-password");
          return;
        }
        deadline = Date.now() + result.remainingMs;
        lastSent = Date.now();
        setReady(true);
        schedule();
      } catch {
        // Fail closed if authorization cannot be confirmed; never extend locally.
        void end();
      } finally {
        busy = false;
      }
    }
    function activity(event: Event) {
      if (
        !event.isTrusted ||
        document.visibilityState !== "visible" ||
        ending ||
        !deadline
      )
        return;
      if (Date.now() >= deadline) {
        void end();
        return;
      }
      dirty = true;
      if (Date.now() - lastSent >= 30000 && !busy) {
        dirty = false;
        void verify(true);
      }
    }
    function resume() {
      if (document.visibilityState !== "visible" || ending) return;
      if (deadline && Date.now() >= deadline) {
        void end();
        return;
      }
      void verify(false);
    }
    try {
      token = sessionStorage.getItem(STAFF_TAB_KEY) || "";
    } catch {
      /* fail closed */
    }
    if (!token) void end();
    else void verify(false);
    const events = [
      "pointerdown",
      "pointermove",
      "keydown",
      "scroll",
      "touchstart",
    ];
    events.forEach((name) =>
      window.addEventListener(name, activity, { passive: true }),
    );
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    const interval = setInterval(() => {
      if (!deadline || ending) return;
      if (Date.now() >= deadline) {
        void end();
        return;
      }
      if (
        !busy &&
        document.visibilityState === "visible" &&
        Date.now() - lastSent >= 30000
      ) {
        const active = dirty;
        dirty = false;
        void verify(active);
      }
    }, 1000);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearInterval(interval);
      events.forEach((name) => window.removeEventListener(name, activity));
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
    };
  }, []);
  return ready ? (
    children
  ) : message === "Checking your staff session..." ? (
    <AdminSkeleton shell />
  ) : (
    <main className="staff-card" role="status">
      {message}
    </main>
  );
}
