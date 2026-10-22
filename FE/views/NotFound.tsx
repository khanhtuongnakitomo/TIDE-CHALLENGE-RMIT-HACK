import { useLocation } from "react-router"
import { ArrowLeft } from "lucide-react"
import { ButtonLink, Card, ErrorNotice, Heading } from "@/components/ui"

export function NotFound() {
  const { pathname } = useLocation()
  return (
    <Card className="flex flex-col gap-xl">
      <Heading as="h1" size="md">
        Nothing at this path
      </Heading>
      <ErrorNotice
        error={{
          status: 404,
          code: "NOT_FOUND",
          message: `${pathname} is not a ResearchVault view.`,
          correlationId: "cor-404-route",
        }}
      />
      <ButtonLink
        to="/"
        variant="ink"
        size="sm"
        icon={ArrowLeft}
        className="self-start"
      >
        Back to overview
      </ButtonLink>
    </Card>
  )
}
