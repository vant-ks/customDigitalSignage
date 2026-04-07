import React, { useEffect, useState, useCallback } from 'react'
import {
  Image,
  Video,
  FileText,
  Link,
  Search,
  Grid,
  List,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Cloud,
  ChevronRight,
  X,
  Folder,
  Clock,
  HardDrive,
  AlertCircle,
  CheckCircle,
  Loader,
} from 'lucide-react'
import { useMediaStore } from '../stores/mediaStore'
import type { MediaAsset } from '../types'
import type { FileEntry, StorageProvider } from '../stores/mediaStore'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(sec: number | null): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const FILE_TYPE_ICON: Record<string, typeof Image> = {
  image: Image,
  video: Video,
  html_template: FileText,
  url: Link,
  pdf: FileText,
}

const PROCESSING_STATUS: Record<string, { label: string; color: string; Icon: typeof CheckCircle }> = {
  pending: { label: 'Pending', color: 'text-amber-400', Icon: Clock },
  processing: { label: 'Processing', color: 'text-gjs-blue', Icon: Loader },
  ready: { label: 'Ready', color: 'text-green-400', Icon: CheckCircle },
  error: { label: 'Error', color: 'text-red-400', Icon: AlertCircle },
}

const PROVIDER_LABELS: Record<string, string> = {
  dropbox: 'Dropbox',
  gdrive: 'Google Drive',
  onedrive: 'OneDrive',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProcessingBadge({ status }: { status: string }) {
  const cfg = PROCESSING_STATUS[status] ?? PROCESSING_STATUS.pending
  return (
    <span className={`flex items-center gap-1 text-[11px] font-medium ${cfg.color}`}>
      <cfg.Icon size={11} className={status === 'processing' ? 'animate-spin' : ''} />
      {cfg.label}
    </span>
  )
}

function AssetThumbnail({ asset }: { asset: MediaAsset }) {
  const TypeIcon = FILE_TYPE_ICON[asset.file_type] ?? Image
  if (asset.thumbnail_url) {
    return (
      <img
        src={asset.thumbnail_url}
        alt={asset.name}
        className="w-full h-full object-cover"
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />
    )
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-white/5">
      <TypeIcon size={28} className="text-gray-500" />
    </div>
  )
}

function AssetCard({
  asset,
  onSelect,
  onDelete,
  selected,
}: {
  asset: MediaAsset
  onSelect: (a: MediaAsset) => void
  onDelete: (id: string) => void
  selected: boolean
}) {
  return (
    <div
      onClick={() => onSelect(asset)}
      className={`group relative rounded-xl overflow-hidden cursor-pointer border transition-all ${
        selected
          ? 'border-gjs-blue bg-gjs-blue/10'
          : 'border-gray-200 dark:border-white/5 bg-light-bg-2 dark:bg-dark-bg-2 hover:border-white/15'
      }`}
    >
      <div className="aspect-video bg-light-bg-3 dark:bg-dark-bg-3 relative overflow-hidden">
        <AssetThumbnail asset={asset} />
        <div className="absolute top-1.5 right-1.5">
          <ProcessingBadge status={asset.processing_status} />
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">{asset.name}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {formatBytes(asset.file_size_bytes)}
          {asset.duration_sec ? ` · ${formatDuration(asset.duration_sec)}` : ''}
          {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
        </p>
        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {asset.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-400"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(asset.id)
        }}
        className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-black/60 text-red-400 hover:text-red-300"
        title="Delete"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function AssetRow({
  asset,
  onSelect,
  onDelete,
  selected,
}: {
  asset: MediaAsset
  onSelect: (a: MediaAsset) => void
  onDelete: (id: string) => void
  selected: boolean
}) {
  const TypeIcon = FILE_TYPE_ICON[asset.file_type] ?? Image
  return (
    <div
      onClick={() => onSelect(asset)}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-gray-200 dark:border-white/5 transition-colors ${
        selected ? 'bg-gjs-blue/10' : 'hover:bg-white/[0.03]'
      }`}
    >
      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-light-bg-3 dark:bg-dark-bg-3">
        <AssetThumbnail asset={asset} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">{asset.name}</p>
        <p className="text-[11px] text-gray-500">{asset.folder}</p>
      </div>
      <div className="hidden sm:flex items-center gap-4">
        <span className="text-[12px] text-gray-400 capitalize flex items-center gap-1">
          <TypeIcon size={12} />
          {asset.file_type.replace('_', ' ')}
        </span>
        <span className="text-[12px] text-gray-400 w-16 text-right">
          {formatBytes(asset.file_size_bytes)}
        </span>
        <ProcessingBadge status={asset.processing_status} />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(asset.id)
        }}
        className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ─── Storage Browser Modal ────────────────────────────────────────────────────

function StorageBrowserModal({
  provider,
  onClose,
  onImport,
}: {
  provider: StorageProvider
  onClose: () => void
  onImport: (entry: FileEntry) => void
}) {
  const { browseEntries, browseHasMore, browseCursor, browseLoading, browseProvider, clearBrowse } =
    useMediaStore()
  const [path, setPath] = useState('/')
  const [pathHistory, setPathHistory] = useState<string[]>(['/'])

  useEffect(() => {
    clearBrowse()
    browseProvider(provider.id, '/')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.id])

  const navigate = (entry: FileEntry) => {
    if (!entry.is_folder) return
    const newPath = entry.path
    setPathHistory((h) => [...h, newPath])
    setPath(newPath)
    clearBrowse()
    browseProvider(provider.id, newPath)
  }

  const goBack = () => {
    if (pathHistory.length <= 1) return
    const newHistory = pathHistory.slice(0, -1)
    const prev = newHistory[newHistory.length - 1]
    setPathHistory(newHistory)
    setPath(prev)
    clearBrowse()
    browseProvider(provider.id, prev)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-light-bg-2 dark:bg-dark-bg-2 border border-gray-300 dark:border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-white/5">
          <Cloud size={16} className="text-gjs-blue flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{provider.label}</p>
            <p className="text-[11px] text-gray-500 truncate">{PROVIDER_LABELS[provider.provider_type]}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-gray-900 dark:hover:text-gray-100">
            <X size={16} />
          </button>
        </div>

        {/* Breadcrumb nav */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-white/5">
          {pathHistory.length > 1 && (
            <button
              onClick={goBack}
              className="text-[12px] text-gjs-blue hover:underline"
            >
              ← Back
            </button>
          )}
          <span className="text-[12px] text-gray-500 truncate">{path}</span>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {browseLoading && browseEntries.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <Loader size={20} className="animate-spin text-gray-500" />
            </div>
          ) : browseEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Folder size={24} className="mb-2" />
              <p className="text-[13px]">Empty folder</p>
            </div>
          ) : (
            browseEntries.map((entry) => (
              <div
                key={entry.path}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 dark:border-white/5 hover:bg-white/[0.03] cursor-pointer group"
                onClick={() => entry.is_folder && navigate(entry)}
              >
                {entry.is_folder ? (
                  <Folder size={16} className="text-amber-400 flex-shrink-0" />
                ) : (
                  <Image size={16} className="text-gray-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-gray-800 dark:text-gray-200 truncate">{entry.name}</p>
                  {!entry.is_folder && (
                    <p className="text-[11px] text-gray-500">
                      {formatBytes(entry.size_bytes)}
                      {entry.mime_type ? ` · ${entry.mime_type}` : ''}
                    </p>
                  )}
                </div>
                {entry.is_folder ? (
                  <ChevronRight size={14} className="text-gray-500" />
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onImport(entry)
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity px-2.5 py-1 rounded-md bg-gjs-blue text-white text-[12px] font-medium"
                  >
                    Import
                  </button>
                )}
              </div>
            ))
          )}
          {browseHasMore && (
            <button
              onClick={() => browseProvider(provider.id, path, browseCursor)}
              className="w-full py-3 text-[12px] text-gjs-blue hover:underline"
            >
              Load more…
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Asset Detail Panel ───────────────────────────────────────────────────────

function AssetDetailPanel({
  asset,
  onClose,
  onDelete,
}: {
  asset: MediaAsset
  onClose: () => void
  onDelete: (id: string) => void
}) {
  const { getDownloadUrl } = useMediaStore()

  const handleDownload = async () => {
    try {
      const url = await getDownloadUrl(asset.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      // handled silently — user sees nothing happen
    }
  }

  const TypeIcon = FILE_TYPE_ICON[asset.file_type] ?? Image

  return (
    <aside className="w-72 flex-shrink-0 bg-light-bg-2 dark:bg-dark-bg-2 border-l border-gray-200 dark:border-white/5 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/5">
        <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Asset Details</p>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-gray-900 dark:hover:text-gray-100">
          <X size={14} />
        </button>
      </div>

      {/* Preview */}
      <div className="aspect-video bg-light-bg-3 dark:bg-dark-bg-3 relative overflow-hidden flex-shrink-0">
        <AssetThumbnail asset={asset} />
      </div>

      {/* Info */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Name</p>
          <p className="text-[13px] text-gray-900 dark:text-gray-100 break-all">{asset.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">Type</p>
            <span className="flex items-center gap-1 text-[12px] text-gray-700 dark:text-gray-300">
              <TypeIcon size={12} />
              {asset.file_type.replace('_', ' ')}
            </span>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">Status</p>
            <ProcessingBadge status={asset.processing_status} />
          </div>
          {asset.file_size_bytes != null && (
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">Size</p>
              <p className="text-[12px] text-gray-700 dark:text-gray-300">{formatBytes(asset.file_size_bytes)}</p>
            </div>
          )}
          {asset.duration_sec != null && (
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">Duration</p>
              <p className="text-[12px] text-gray-700 dark:text-gray-300">{formatDuration(asset.duration_sec)}</p>
            </div>
          )}
          {asset.width != null && asset.height != null && (
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">Resolution</p>
              <p className="text-[12px] text-gray-700 dark:text-gray-300">{asset.width}×{asset.height}</p>
            </div>
          )}
          {asset.codec && (
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">Codec</p>
              <p className="text-[12px] text-gray-700 dark:text-gray-300">{asset.codec}</p>
            </div>
          )}
        </div>

        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Folder</p>
          <p className="text-[12px] text-gray-700 dark:text-gray-300 font-mono">{asset.folder || '/'}</p>
        </div>

        {asset.source_hash && (
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">SHA-256</p>
            <p className="text-[11px] text-gray-400 font-mono break-all">{asset.source_hash}</p>
          </div>
        )}

        {asset.tags.length > 0 && (
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">Tags</p>
            <div className="flex flex-wrap gap-1">
              {asset.tags.map((t) => (
                <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {asset.processing_error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-[11px] text-red-400 font-medium mb-1">Processing Error</p>
            <p className="text-[11px] text-red-300 font-mono">{asset.processing_error}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-white/5 flex gap-2">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-gray-200 dark:hover:bg-white/10 text-[12px] text-gray-700 dark:text-gray-300 transition-colors"
        >
          <ExternalLink size={12} />
          Open
        </button>
        <button
          onClick={() => onDelete(asset.id)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-[12px] text-red-400 transition-colors"
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </aside>
  )
}

// ─── Connect Provider Modal ───────────────────────────────────────────────────

function ConnectProviderModal({ onClose }: { onClose: () => void }) {
  const { getOAuthUrl } = useMediaStore()
  const [loading, setLoading] = useState<string | null>(null)

  const connect = async (providerType: string) => {
    setLoading(providerType)
    try {
      const redirectUri = `${window.location.origin}/storage/callback`
      const { auth_url } = await getOAuthUrl(providerType, redirectUri)
      window.location.href = auth_url
    } finally {
      setLoading(null)
    }
  }

  const providers = [
    { type: 'dropbox', label: 'Dropbox', color: 'text-blue-400' },
    { type: 'gdrive', label: 'Google Drive', color: 'text-green-400' },
    { type: 'onedrive', label: 'OneDrive', color: 'text-sky-400' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-light-bg-2 dark:bg-dark-bg-2 border border-gray-300 dark:border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Connect Storage</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-gray-900 dark:hover:text-gray-100">
            <X size={16} />
          </button>
        </div>
        <p className="text-[13px] text-gray-400 mb-5">
          Connect your cloud storage to browse and import media files.
        </p>
        <div className="space-y-2">
          {providers.map(({ type, label, color }) => (
            <button
              key={type}
              onClick={() => connect(type)}
              disabled={!!loading}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-left"
            >
              <Cloud size={18} className={color} />
              <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{label}</span>
              {loading === type && <Loader size={14} className="ml-auto animate-spin text-gray-400" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MediaPage() {
  const {
    assets,
    total,
    loading,
    error,
    providers,
    fetchAssets,
    fetchProviders,
    deleteAsset,
    uploadAsset,
  } = useMediaStore()

  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [fileTypeFilter, setFileTypeFilter] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null)
  const [browsing, setBrowsing] = useState<StorageProvider | null>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchAssets()
    fetchProviders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refresh = useCallback(() => {
    fetchAssets({ search, file_type: fileTypeFilter || undefined })
  }, [fetchAssets, search, fileTypeFilter])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        await uploadAsset(file)
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
      e.target.value = ''  // reset so the same file can be re-selected
    }
  }

  useEffect(() => {
    const timer = setTimeout(refresh, 300)
    return () => clearTimeout(timer)
  }, [refresh])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this media asset? This cannot be undone.')) return
    await deleteAsset(id)
    if (selectedAsset?.id === id) setSelectedAsset(null)
  }

  const handleImport = async (entry: FileEntry) => {
    if (!browsing) return
    const fileType = entry.mime_type?.startsWith('video/')
      ? 'video'
      : entry.mime_type?.startsWith('image/')
      ? 'image'
      : entry.mime_type === 'application/pdf'
      ? 'pdf'
      : 'image'

    const { registerAsset } = useMediaStore.getState()
    await registerAsset({
      storage_id: browsing.id,
      name: entry.name,
      source_path: entry.path,
      file_type: fileType,
      mime_type: entry.mime_type ?? undefined,
    })
    setBrowsing(null)
    fetchAssets()
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-white/5 flex-shrink-0">
          <h1 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Media Library</h1>
          <span className="text-[12px] text-gray-500">{total} assets</span>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-[13px] text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gjs-blue/50 w-48"
            />
          </div>

          {/* File type filter */}
          <select
            value={fileTypeFilter}
            onChange={(e) => setFileTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-[13px] text-gray-700 dark:text-gray-300 focus:outline-none capitalize"
          >
            <option value="">All types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="html_template">Templates</option>
            <option value="pdf">PDFs</option>
          </select>

          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-white/10">
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`p-1.5 transition-colors ${
                  view === v ? 'bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-gray-100' : 'text-gray-400 hover:text-gray-800 dark:hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {v === 'grid' ? <Grid size={14} /> : <List size={14} />}
              </button>
            ))}
          </div>

          <button
            onClick={refresh}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Direct file upload */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-white/10 hover:bg-white/15 text-white text-[13px] font-medium cursor-pointer transition-colors">
            {uploading ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
            {uploading ? 'Uploading…' : 'Upload'}
            <input
              type="file"
              className="hidden"
              multiple
              accept="image/*,video/*,application/pdf"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>

          {/* Import from storage */}
          {providers.length > 0 ? (
            <div className="relative">
              <button
                onClick={() => setShowImportModal((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gjs-blue text-white text-[13px] font-medium hover:bg-gjs-blue/80 transition-colors"
              >
                <Plus size={14} />
                Import
              </button>
              {showImportModal && (
                <div className="absolute right-0 top-full mt-1 bg-light-bg-2 dark:bg-dark-bg-2 border border-gray-300 dark:border-white/10 rounded-xl shadow-xl z-20 min-w-[180px] py-1">
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setBrowsing(p)
                        setShowImportModal(false)
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-100 dark:hover:bg-white/5 text-left"
                    >
                      <Cloud size={13} className="text-gjs-blue" />
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setConnectOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gjs-blue text-white text-[13px] font-medium hover:bg-gjs-blue/80 transition-colors"
            >
              <Plus size={14} />
              Connect Storage
            </button>
          )}
        </div>

        {/* Storage provider chips */}
        {providers.length > 0 && (
          <div className="flex items-center gap-2 px-6 py-2 border-b border-gray-200 dark:border-white/5 flex-shrink-0">
            <span className="text-[11px] text-gray-500 mr-1">Connected:</span>
            {providers.map((p) => (
              <span
                key={p.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 text-[11px] text-gray-700 dark:text-gray-300"
              >
                <Cloud size={10} className="text-gjs-blue" />
                {p.label}
              </span>
            ))}
            <button
              onClick={() => setConnectOpen(true)}
              className="text-[11px] text-gjs-blue hover:underline ml-1"
            >
              + Add
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[13px] text-red-400">
              {error}
            </div>
          )}

          {loading && assets.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <Loader size={24} className="animate-spin text-gray-500" />
            </div>
          )}

          {!loading && assets.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <HardDrive size={32} className="mb-3" />
              <p className="text-[14px] font-medium">No media assets yet</p>
              <p className="text-[13px] mt-1">
                {providers.length === 0
                  ? 'Connect a storage provider to get started'
                  : 'Import media from a connected storage provider'}
              </p>
            </div>
          )}

          {view === 'grid' && assets.length > 0 && (
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {assets.map((a) => (
                <AssetCard
                  key={a.id}
                  asset={a}
                  selected={selectedAsset?.id === a.id}
                  onSelect={setSelectedAsset}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {view === 'list' && assets.length > 0 && (
            <div>
              <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-white/5 text-[11px] text-gray-500 uppercase tracking-wider">
                <div className="w-10" />
                <div className="flex-1">Name</div>
                <div className="hidden sm:block w-24 text-right">Type</div>
                <div className="hidden sm:block w-20 text-right">Size</div>
                <div className="hidden sm:block w-20 text-right">Status</div>
                <div className="w-8" />
              </div>
              {assets.map((a) => (
                <AssetRow
                  key={a.id}
                  asset={a}
                  selected={selectedAsset?.id === a.id}
                  onSelect={setSelectedAsset}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedAsset && (
        <AssetDetailPanel
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onDelete={handleDelete}
        />
      )}

      {/* Modals */}
      {browsing && (
        <StorageBrowserModal
          provider={browsing}
          onClose={() => setBrowsing(null)}
          onImport={handleImport}
        />
      )}
      {connectOpen && <ConnectProviderModal onClose={() => setConnectOpen(false)} />}
    </div>
  )
}
