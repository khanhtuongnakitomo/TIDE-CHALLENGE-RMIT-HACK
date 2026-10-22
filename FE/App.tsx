import { RouterProvider } from "react-router/dom"
import { SessionProvider } from "@/app/session"
import { router } from "@/app/router"

export default function App() {
  return (
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  )
}
