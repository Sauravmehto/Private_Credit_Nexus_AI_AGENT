import { Fragment, useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { cn } from '@/lib/utils'

export type AppShellCrumb = { label: string; onClick?: () => void }

export type AppShellSidebarRender = (opts: { closeMobileNav: () => void }) => React.ReactNode

type AppShellProps = {
  sidebar: AppShellSidebarRender
  crumbs: AppShellCrumb[]
  summaryLoading?: boolean
  children: React.ReactNode
  chatAside: React.ReactNode
}

export function AppShell({ sidebar, crumbs, summaryLoading, children, chatAside }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const closeMobileNav = () => setMobileNavOpen(false)
  const sidebarNode = sidebar({ closeMobileNav })

  return (
    <div id="app" className="flex h-screen overflow-hidden bg-background font-sans text-sm text-foreground">
      <aside className="hidden h-full shrink-0 lg:block">{sidebarNode}</aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className={cn(
            'flex w-[min(100vw,260px)] max-w-[260px] flex-col gap-0 overflow-hidden border-r p-0 sm:max-w-[260px]',
          )}
        >
          <div className="h-full min-h-0 flex-1 overflow-hidden">{sidebarNode}</div>
        </SheetContent>
      </Sheet>

      <div id="main" className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:px-5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden"
            aria-label="Open navigation menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList className="flex-nowrap">
              {crumbs.map((c, i) => (
                <Fragment key={`${c.label}-${i}`}>
                  {i > 0 && (
                    <BreadcrumbSeparator className="hidden sm:inline-flex [&>svg]:text-muted-foreground/60" />
                  )}
                  <BreadcrumbItem className="min-w-0">
                    {c.onClick ? (
                      <BreadcrumbLink asChild>
                        <button
                          type="button"
                          className="max-w-full truncate font-medium text-primary hover:text-primary/90"
                          onClick={c.onClick}
                        >
                          {c.label}
                        </button>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="max-w-full truncate font-medium">{c.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="flex min-w-0 flex-1 overflow-hidden">
          <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-muted/40">
            {summaryLoading && (
              <div className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-border">
                <div
                  className="h-full w-[60%] animate-pulse bg-primary/70"
                  style={{
                    animation: 'slide 1.5s ease-in-out infinite',
                  }}
                />
              </div>
            )}
            <div id="content" className="flex-1 overflow-hidden">
              {children}
            </div>
          </div>
          {chatAside}
        </div>
      </div>
    </div>
  )
}
