import { useMemo, useState } from 'react'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Deal } from '@/dealTypes'
import { getInstrumentConfig, STATUS_BADGE, STATUS_DOT, STATUS_LABEL } from '@/dealTypes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { fD, fP, fPct1 } from '@/utils/formatters'
import { dealIRR } from '@/utils/irrMath'

function sortableHeader(label: string, sorted: false | 'asc' | 'desc') {
  return (
    <div className="flex items-center gap-1">
      {label}
      {sorted === 'asc' ? <ChevronUp className="size-3.5 opacity-70" /> : null}
      {sorted === 'desc' ? <ChevronDown className="size-3.5 opacity-70" /> : null}
    </div>
  )
}

export type PortfolioDealsTableProps = {
  deals: Deal[]
  dealIRRMap: Record<string, number>
  summaryLoading: boolean
  onDealSelect: (id: string) => void
  onIrrClick: (deal: Deal) => void
}

export function PortfolioDealsTable({ deals, dealIRRMap, summaryLoading, onDealSelect, onIrrClick }: PortfolioDealsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'principal', desc: true }])

  const columns = useMemo<ColumnDef<Deal>[]>(
    () => [
      {
        id: 'statusDot',
        header: '',
        cell: ({ row }) => (
          <span
            className={cn('inline-block size-2.5 shrink-0 rounded-full', STATUS_DOT[row.original.status])}
            title={STATUS_LABEL[row.original.status]}
          />
        ),
        size: 28,
      },
      {
        id: 'icon',
        header: '',
        cell: ({ row }) => <span className="text-lg leading-none">{getInstrumentConfig(row.original).i}</span>,
        size: 36,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button variant="ghost" className="-ml-3 h-8 px-2 font-medium" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {sortableHeader('Name', column.getIsSorted() || false)}
          </Button>
        ),
        cell: ({ row }) => <span className="max-w-[200px] truncate font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'sector',
        header: 'Sector',
        cell: ({ row }) => <span className="max-w-[120px] truncate text-muted-foreground">{row.original.sector || '—'}</span>,
      },
      {
        id: 'instrument',
        accessorFn: (row) => getInstrumentConfig(row).l,
        header: 'Type',
        cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{getInstrumentConfig(row.original).l}</span>,
      },
      {
        accessorKey: 'principal',
        header: ({ column }) => (
          <Button variant="ghost" className="-ml-3 h-8 px-2 font-medium" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {sortableHeader('Principal', column.getIsSorted() || false)}
          </Button>
        ),
        cell: ({ row }) => <span className="font-mono tabular-nums text-xs">{fD(row.original.principal)}</span>,
      },
      {
        accessorKey: 'rate',
        header: 'Rate',
        cell: ({ row }) => <span className="font-mono tabular-nums text-xs text-primary">{fP(row.original.rate)}</span>,
      },
      {
        id: 'irr',
        header: 'IRR',
        cell: ({ row }) => {
          const d = row.original
          const browserIRR = dealIRR(d)?.annIRR ?? 0
          const displayIRR = dealIRRMap[d.id] ?? browserIRR
          const irrLabel = displayIRR ? fPct1(displayIRR) : summaryLoading ? '…' : '—'
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 min-w-[4.5rem] px-1.5 font-mono text-[11px] text-emerald-800"
                  onClick={(e) => {
                    e.stopPropagation()
                    onIrrClick(d)
                  }}
                >
                  {irrLabel}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Open IRR breakdown for {d.name}</TooltipContent>
            </Tooltip>
          )
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const s = row.original.status
          const bdg = STATUS_BADGE[s] ?? 'bg-muted text-foreground'
          const stxt = STATUS_LABEL[s] ?? s
          return (
            <span className={cn('inline-flex rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-semibold', bdg)}>{stxt}</span>
          )
        },
      },
    ],
    [dealIRRMap, onIrrClick, summaryLoading],
  )

  const table = useReactTable({
    data: deals,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deal roster</CardTitle>
        <CardDescription>Sortable table with pagination — click a row for deal detail, or IRR for breakdown.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((h) => (
                    <TableHead key={h.id} className={h.column.id === 'statusDot' || h.column.id === 'icon' ? 'w-10' : undefined}>
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => onDealSelect(row.original.id)}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    No deals.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
