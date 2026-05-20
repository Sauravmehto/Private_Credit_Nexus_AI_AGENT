import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight } from 'lucide-react'

interface Props {
  missing: string[]
  foundColumns: string[]
  fileName: string
  onTryAgain: () => void
}

export function ValidationErrorModal({ missing, foundColumns, fileName, onTryAgain }: Props) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onTryAgain() }}>
      <DialogContent className="max-h-[90vh] max-w-[520px] gap-0 overflow-hidden border-destructive/30 p-0 sm:max-w-[520px]">
        <div className="h-1 w-full bg-gradient-to-r from-destructive via-rose-500 to-rose-200" />
        <DialogHeader className="space-y-1 px-6 pb-2 pt-5 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10">
              <svg viewBox="0 0 20 20" className="h-5 w-5 fill-destructive">
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="text-left text-base">Invalid file structure detected</DialogTitle>
              <DialogDescription className="text-left text-sm text-muted-foreground">
                Please upload the correct Excel, CSV, or JSON file.
              </DialogDescription>
              <code className="mt-1 inline-block max-w-full truncate rounded-md border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {fileName}
              </code>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto px-6 pb-5">
          <div>
            <p className="mb-2 text-center font-mono text-[9.5px] font-semibold uppercase tracking-wide text-destructive">
              Missing required columns ({missing.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {missing.map((col) => (
                <span
                  key={col}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 font-mono text-[11px] font-medium text-destructive"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>

          <Collapsible className="group">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="flex w-full items-center justify-between gap-2 font-mono text-[10.5px] text-muted-foreground"
              >
                <span>Detected columns in your file ({foundColumns.length})</span>
                <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 flex flex-wrap gap-1 rounded-md border bg-muted/50 p-2.5">
                {foundColumns.length > 0 ? (
                  foundColumns.map((col) => (
                    <span
                      key={col}
                      className="rounded border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                    >
                      {col}
                    </span>
                  ))
                ) : (
                  <span className="font-mono text-[10.5px] text-muted-foreground">No columns detected</span>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Alert>
            <AlertTitle className="text-sm">Tip</AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">
              Rename your column headers to match the required names exactly, or download the sample file below to use as a template.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex-row flex-wrap gap-2 border-t bg-muted/30 px-6 py-4 sm:justify-between">
          <Button type="button" variant="secondary" asChild>
            <a href="/samples/sample-portfolio.xlsx" download="sample-portfolio.xlsx" className="gap-2">
              Download sample
            </a>
          </Button>
          <Button type="button" onClick={onTryAgain}>
            Try again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
