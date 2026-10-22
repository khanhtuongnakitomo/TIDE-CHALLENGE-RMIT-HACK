import { createBrowserRouter } from "react-router"
import { AppShell } from "@/components/AppShell"
import { Landing } from "@/views/Landing"
import { Participant } from "@/views/Participant"
import { Researcher } from "@/views/Researcher"
import { Permissions } from "@/views/Permissions"
import { Governance } from "@/views/Governance"
import { Evidence } from "@/views/Evidence"
import { NotFound } from "@/views/NotFound"
import { Login } from "@/views/Login"
import { Register } from "@/views/Register"
import { Documentation } from "@/views/Documentation"
import { RequireAuth } from "@/components/gates"

/** Mount under the deployment path when the app is served from a sub-path. */
function basename() {
  const path = new URL(
    import.meta.env.BASE_URL,
    window.location.origin,
  ).pathname.replace(/\/$/, "")
  return path || undefined
}

export const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: AppShell,
      children: [
        { index: true, Component: Landing },
        { path: "login", Component: Login },
        { path: "register", Component: Register },
        { path: "documentation", Component: Documentation },
        {
          // Every workspace below requires a session and an admitted role.
          Component: RequireAuth,
          children: [
            { path: "user", Component: Participant },
            { path: "researcher", Component: Researcher },
            {
              path: "researcher/studies/:studyId/permissions",
              Component: Permissions,
            },
            { path: "governance", Component: Governance },
            { path: "evidence", Component: Evidence },
            // Unknown paths under a protected prefix still require a session.
            { path: "user/*", Component: NotFound },
            { path: "researcher/*", Component: NotFound },
            { path: "governance/*", Component: NotFound },
            { path: "evidence/*", Component: NotFound },
          ],
        },
        { path: "*", Component: NotFound },
      ],
    },
  ],
  { basename: basename() },
)
