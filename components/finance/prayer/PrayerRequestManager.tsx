'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { PrayerRequestRecord, PrayerStatus } from '@/lib/types';
import {
  groupPrayerRequestsByDate,
  formatPrayerListText,
  formatPrayerNamesOnly,
  formatPrayerNamesAndIntentions,
} from '@/lib/calculations';
import { KpiCard } from '@/components/finance/KpiCard';
import { ViewModeToggle } from '@/components/finance/ViewModeToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { PrayerCardItem } from './PrayerCardItem';
import { AddPrayerRequestDialog } from './AddPrayerRequestDialog';
import { EditPrayerRequestDialog } from './EditPrayerRequestDialog';
import { deletePrayerRequest, updatePrayerRequest } from '@/features/prayer-requests';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PrayerRequestManagerProps {
  initialRequests: PrayerRequestRecord[];
}

export function PrayerRequestManager({
  initialRequests,
}: PrayerRequestManagerProps) {
  const router = useRouter();
  const [requests, setRequests] = useState<PrayerRequestRecord[]>(initialRequests);
  const [viewMode, setViewMode] = useViewMode('prayer_requests');
  const [isRefreshing, startRefresh] = useTransition();

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Modals & Dialogs
  const [editingRequest, setEditingRequest] = useState<PrayerRequestRecord | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<PrayerRequestRecord | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const showCopyToast = (msg: string) => {
    setCopyFeedback(msg);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  // Refresh handler
  const handleRefresh = () => {
    startRefresh(async () => {
      try {
        const res = await fetch('/api/prayer-requests').then((r) => r.json());
        if (res.success && res.data?.requests) {
          setRequests(res.data.requests);
        }
        router.refresh();
      } catch (err) {
        console.error('Failed to sync prayer requests:', err);
      }
    });
  };

  // Handle status toggle
  const handleStatusChange = (
    req: PrayerRequestRecord,
    newStatus: 'Active' | 'Answered' | 'Archived'
  ) => {
    startRefresh(async () => {
      try {
        await updatePrayerRequest(req.id, { status: newStatus as PrayerStatus });
        setRequests((prev) =>
          prev.map((r) => (r.id === req.id ? { ...r, status: newStatus as PrayerStatus } : r))
        );
        router.refresh();
      } catch (err) {
        console.error('Failed to update status:', err);
      }
    });
  };

  // Handle delete
  const handleDelete = () => {
    if (!deletingRequest) return;
    startDelete(async () => {
      try {
        await deletePrayerRequest(deletingRequest.id);
        setRequests((prev) => prev.filter((r) => r.id !== deletingRequest.id));
        setDeletingRequest(null);
        router.refresh();
      } catch (err) {
        console.error('Failed to delete prayer request:', err);
      }
    });
  };

  // Filtered requests
  const filteredRequests = useMemo(() => {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // 7 days ago
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);
    const weekKey = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;

    // Month prefix
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return requests.filter((req) => {
      // Status Filter
      if (statusFilter !== 'ALL' && req.status !== statusFilter) {
        return false;
      }

      // Date Filter
      if (dateRangeFilter === 'TODAY' && req.date !== todayKey) {
        return false;
      }
      if (dateRangeFilter === 'THIS_WEEK' && req.date < weekKey) {
        return false;
      }
      if (dateRangeFilter === 'THIS_MONTH' && !req.date.startsWith(currentMonthPrefix)) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = req.person_name.toLowerCase().includes(q);
        const matchesPhone = req.mobile_number?.toLowerCase().includes(q);
        const matchesRequest = req.prayer_request.toLowerCase().includes(q);
        const matchesNotes = req.notes?.toLowerCase().includes(q);
        const matchesSource = req.source?.toLowerCase().includes(q);
        const matchesDate = req.date?.toLowerCase().includes(q);

        return (
          matchesName ||
          matchesPhone ||
          matchesRequest ||
          matchesNotes ||
          matchesSource ||
          matchesDate
        );
      }

      return true;
    });
  }, [requests, statusFilter, dateRangeFilter, searchQuery]);

  // Grouped results & overall summary
  const { groups, summary } = useMemo(() => {
    const sorted = [...filteredRequests].sort((a, b) => {
      if (sortOrder === 'asc') {
        return (a.date || '').localeCompare(b.date || '');
      }
      return (b.date || '').localeCompare(a.date || '');
    });
    return groupPrayerRequestsByDate(sorted);
  }, [filteredRequests, sortOrder]);

  // Global summary across all requests
  const globalSummary = useMemo(() => {
    const { summary: sum } = groupPrayerRequestsByDate(requests);
    return sum;
  }, [requests]);

  // Copy helper functions
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showCopyToast(label);
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Prayer Requests</h1>
            <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
              Intercession & Intentions
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Pray for all benefactors, supporters, and people who provide income for the meet.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Copy All Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  Copy Options
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() =>
                  copyToClipboard(
                    formatPrayerListText(filteredRequests),
                    'Copied formatted prayer list to clipboard!'
                  )
                }
                className="text-xs cursor-pointer"
              >
                📋 Copy All (Structured List)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  copyToClipboard(
                    formatPrayerNamesOnly(filteredRequests),
                    'Copied all names to clipboard!'
                  )
                }
                className="text-xs cursor-pointer"
              >
                👤 Copy Names Only
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  copyToClipboard(
                    formatPrayerNamesAndIntentions(filteredRequests),
                    'Copied names and intentions to clipboard!'
                  )
                }
                className="text-xs cursor-pointer"
              >
                📜 Copy Names & Intentions
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sync Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1.5 text-xs"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isRefreshing ? 'animate-spin' : ''}
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            {isRefreshing ? 'Syncing…' : 'Sync'}
          </Button>

          {/* Add Prayer Request Dialog */}
          <AddPrayerRequestDialog onSuccess={handleRefresh} />
        </div>
      </div>

      {/* Copy Toast Feedback Alert */}
      {copyFeedback && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>{copyFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setCopyFeedback(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:opacity-75"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Hero KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Prayer Requests"
          value={String(globalSummary.totalRequests)}
          subtitle={`${globalSummary.totalPeople} unique supporters/people`}
          accentClass="from-indigo-500 to-violet-600"
          trend="neutral"
          trendLabel={`${globalSummary.totalDaysWithRequests} days`}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          }
        />

        <KpiCard
          title="Today's Prayers"
          value={String(globalSummary.todayRequests)}
          subtitle="New intentions received today"
          accentClass="from-blue-500 to-cyan-600"
          trend="up"
          trendLabel="Today"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          }
        />

        <KpiCard
          title="In Active Prayer"
          value={String(globalSummary.activeRequests)}
          subtitle="Currently on the prayer list"
          accentClass="from-amber-500 to-orange-600"
          trend="neutral"
          trendLabel="Active"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 14 14" />
            </svg>
          }
        />

        <KpiCard
          title="Answered Prayers"
          value={String(globalSummary.answeredRequests)}
          subtitle="Praise reports & blessings"
          accentClass="from-emerald-500 to-teal-600"
          trend="up"
          trendLabel="Answered"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
      </section>

      {/* Toolbar & Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <Input
              placeholder="Search person name, phone number, intention..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'ALL')}>
              <SelectTrigger className="text-xs h-8 min-w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="Active">Active ({globalSummary.activeRequests})</SelectItem>
                <SelectItem value="Answered">Answered ({globalSummary.answeredRequests})</SelectItem>
                <SelectItem value="Archived">Archived ({globalSummary.archivedRequests})</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Preset */}
            <Select value={dateRangeFilter} onValueChange={(v) => setDateRangeFilter(v ?? 'ALL')}>
              <SelectTrigger className="text-xs h-8 min-w-[120px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Time</SelectItem>
                <SelectItem value="TODAY">Today Only</SelectItem>
                <SelectItem value="THIS_WEEK">This Week</SelectItem>
                <SelectItem value="THIS_MONTH">This Month</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="text-xs h-8 px-2.5 gap-1 text-muted-foreground hover:text-foreground"
              title="Toggle sort order"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3 16 4 4 4-4" />
                <path d="M7 20V4" />
                <path d="m21 8-4-4-4 4" />
                <path d="M17 4v16" />
              </svg>
              <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
            </Button>

            {/* View Mode Toggle (Cards for mobile default, Table for desktop default) */}
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* Active filter count & reset */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
          <span>
            Showing <strong className="text-foreground">{filteredRequests.length}</strong> prayer{' '}
            {filteredRequests.length === 1 ? 'request' : 'requests'} across{' '}
            <strong className="text-foreground">{groups.length}</strong> {groups.length === 1 ? 'day' : 'days'}
          </span>
          {(searchQuery || statusFilter !== 'ALL' || dateRangeFilter !== 'ALL') && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setDateRangeFilter('ALL');
              }}
              className="text-[11px] text-primary h-6 px-1.5"
            >
              Reset filters
            </Button>
          )}
        </div>
      </div>

      {/* Main Content: Grouped by Date */}
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground text-xl">
            🙏
          </div>
          <h3 className="mt-3 text-base font-semibold text-foreground">No prayer requests found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'ALL' || dateRangeFilter !== 'ALL'
              ? 'No prayer requests match your current filters. Try resetting the filters.'
              : 'Add your first prayer request or record prayer intentions when taking income!'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.date} className="space-y-3">
              {/* Date Group Header */}
              <div className="sticky top-14 z-20 flex items-center justify-between rounded-xl border border-border/60 bg-background/95 p-3 backdrop-blur-md shadow-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-foreground">{group.displayDate}</span>
                  <span className="text-xs text-muted-foreground">({group.dayOfWeek})</span>
                  {group.isToday && (
                    <Badge className="bg-emerald-500 text-white text-[10px] py-0 px-2 animate-pulse">
                      Today
                    </Badge>
                  )}
                  {group.isYesterday && (
                    <Badge variant="secondary" className="text-[10px] py-0 px-2">
                      Yesterday
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                    {group.count} {group.count === 1 ? 'request' : 'requests'}
                  </Badge>
                </div>

                {/* Group-wise Copy Buttons */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() =>
                      copyToClipboard(
                        formatPrayerNamesOnly(group.requests),
                        `Copied ${group.count} names for ${group.displayDate}!`
                      )
                    }
                    className="text-[11px] h-7 px-2 text-muted-foreground hover:text-foreground"
                    title="Copy names only for this date"
                  >
                    Copy Names
                  </Button>

                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() =>
                      copyToClipboard(
                        formatPrayerNamesAndIntentions(group.requests),
                        `Copied ${group.count} names & intentions for ${group.displayDate}!`
                      )
                    }
                    className="text-[11px] h-7 px-2 text-muted-foreground hover:text-foreground"
                    title="Copy names & intentions for this date"
                  >
                    Copy Intentions
                  </Button>

                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() =>
                      copyToClipboard(
                        formatPrayerListText(group.requests, `PRAYER LIST - ${group.displayDate}`),
                        `Copied structured prayer list for ${group.displayDate}!`
                      )
                    }
                    className="text-[11px] h-7 px-2 gap-1"
                    title="Copy complete structured list for this date"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                    <span>Copy Group</span>
                  </Button>
                </div>
              </div>

              {/* Group Body: Cards vs Table */}
              {viewMode === 'cards' ? (
                /* Cards View */
                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.requests.map((req) => (
                    <PrayerCardItem
                      key={req.id}
                      request={req}
                      onEdit={(r) => setEditingRequest(r)}
                      onDelete={(r) => setDeletingRequest(r)}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              ) : (
                /* Table View */
                <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="w-[180px] text-xs font-bold uppercase tracking-wider">
                            Person & Phone
                          </TableHead>
                          <TableHead className="w-[120px] text-xs font-bold uppercase tracking-wider">
                            Source
                          </TableHead>
                          <TableHead className="text-xs font-bold uppercase tracking-wider">
                            Prayer Intention
                          </TableHead>
                          <TableHead className="w-[100px] text-xs font-bold uppercase tracking-wider text-center">
                            Status
                          </TableHead>
                          <TableHead className="w-[140px] text-right text-xs font-bold uppercase tracking-wider">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.requests.map((req) => {
                          const isAnswered = req.status === 'Answered';
                          return (
                            <TableRow key={req.id} className="hover:bg-muted/20 text-xs">
                              {/* Person & Phone */}
                              <TableCell className="font-medium">
                                <div>
                                  <span className="font-bold text-foreground block">
                                    {req.person_name}
                                  </span>
                                  {req.mobile_number ? (
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                      {req.mobile_number}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground/60 italic">
                                      No phone
                                    </span>
                                  )}
                                </div>
                              </TableCell>

                              {/* Source */}
                              <TableCell>
                                <div className="flex flex-col gap-0.5">
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 w-fit">
                                    {req.source || 'Direct'}
                                  </Badge>
                                  {req.amount !== undefined && req.amount !== null && req.amount > 0 && (
                                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                      {req.amount ? `₹${req.amount.toLocaleString()}` : ''}
                                    </span>
                                  )}
                                </div>
                              </TableCell>

                              {/* Prayer Intention */}
                              <TableCell>
                                <div className="max-w-md">
                                  <p className="font-medium text-foreground whitespace-pre-wrap">
                                    {req.prayer_request}
                                  </p>
                                  {req.notes && (
                                    <p className="mt-0.5 text-[11px] italic text-muted-foreground">
                                      Note: {req.notes}
                                    </p>
                                  )}
                                </div>
                              </TableCell>

                              {/* Status */}
                              <TableCell className="text-center">
                                <Badge
                                  className={`text-[10px] py-0 px-1.5 ${
                                    isAnswered
                                      ? 'bg-emerald-500 text-white'
                                      : req.status === 'Archived'
                                      ? 'bg-muted text-muted-foreground'
                                      : 'bg-primary/10 text-primary border-primary/20'
                                  }`}
                                >
                                  {req.status}
                                </Badge>
                              </TableCell>

                              {/* Actions */}
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() =>
                                      copyToClipboard(
                                        `${req.person_name}${req.mobile_number ? ` (${req.mobile_number})` : ''}\nIntention: ${req.prayer_request}`,
                                        `Copied ${req.person_name}'s request!`
                                      )
                                    }
                                    className="h-7 px-2 text-xs"
                                    title="Copy"
                                  >
                                    Copy
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => setEditingRequest(req)}
                                    className="h-7 px-2 text-xs"
                                    title="Edit"
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => setDeletingRequest(req)}
                                    className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                                    title="Delete"
                                  >
                                    ✕
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      {editingRequest && (
        <EditPrayerRequestDialog
          request={editingRequest}
          open={Boolean(editingRequest)}
          onOpenChange={(open) => {
            if (!open) setEditingRequest(null);
          }}
          onSuccess={handleRefresh}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingRequest && (
        <Dialog open={Boolean(deletingRequest)} onOpenChange={() => setDeletingRequest(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-base">Delete Prayer Request?</DialogTitle>
              <DialogDescription className="text-xs">
                Are you sure you want to remove the prayer request for{' '}
                <strong className="text-foreground">{deletingRequest.person_name}</strong>?
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-end gap-2 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingRequest(null)}
                disabled={isDeleting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-xs"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
