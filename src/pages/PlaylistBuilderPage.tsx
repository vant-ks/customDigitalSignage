import { useEffect, useState } from 'react'
import {
  Play,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  X,
  Shuffle,
  BarChart2,
  Save,
  Search,
  Image,
  Video,
  FileText,
  Loader,
  CheckCircle,
} from 'lucide-react'
import { usePlaylistStore } from '../stores/playlistStore'
import { useMediaStore } from '../stores/mediaStore'
import type { Playlist, PlaylistItem, MediaAsset, PlayMode } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}s`
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

const PLAY_MODE_ICONS = { sequential: Play, shuffle: Shuffle, weighted: BarChart2 }
const FILE_ICONS: Record<string, typeof Image> = { image: Image, video: Video, html_template: FileText }

// ─── Duration slider ─────────────────────────────────────────────────────────

function DurationSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const steps = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300]
  const idx = steps.findIndex((s) => s >= value) ?? steps.length - 1

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        value={idx >= 0 ? idx : 0}
        onChange={(e) => onChange(steps[parseInt(e.target.value)])}
        className="w-24 accent-gjs-blue"
      />
      <span className="text-[12px] text-gray-300 w-10 text-right">{formatDuration(value)}</span>
    </div>
  )
}

// ─── Media picker modal ───────────────────────────────────────────────────────

function MediaPickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (asset: MediaAsset) => void
  onClose: () => void
}) {
  const { assets, loading, fetchAssets } = useMediaStore()
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchAssets({ processing_status: 'ready', search: search || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-dark-bg-2 border border-white/10 rounded-2xl w-full max-w-xl max-h-[70vh] flex flex-col shadow-2xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <p className="text-[14px] font-semibold text-gray-100 flex-1">Add Media</p>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-100">
            <X size={16} />
          </button>
        </div>
        <div className="px-4 py-3 border-b border-white/5">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search media…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[13px] text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gjs-blue/50"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-24">
              <Loader size={20} className="animate-spin text-gray-500" />
            </div>
          )}
          {!loading && assets.length === 0 && (
            <p className="text-[13px] text-gray-500 text-center py-10">No ready media found</p>
          )}
          {assets.map((asset) => {
            const Icon = FILE_ICONS[asset.file_type] ?? Image
            return (
              <button
                key={asset.id}
                onClick={() => onSelect(asset)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-dark-bg-3 flex-shrink-0 overflow-hidden">
                  {asset.thumbnail_url ? (
                    <img
                      src={asset.thumbnail_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon size={16} className="text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-100 truncate">{asset.name}</p>
                  <p className="text-[11px] text-gray-500 capitalize">
                    {asset.file_type.replace('_', ' ')}
                    {asset.duration_sec ? ` · ${formatDuration(asset.duration_sec)}` : ''}
                  </p>
                </div>
                <Plus size={14} className="text-gjs-blue flex-shrink-0" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Draggable playlist item row ──────────────────────────────────────────────

function PlaylistItemRow({
  item,
  index,
  onUpdate,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
}: {
  item: PlaylistItem & { media?: MediaAsset }
  index: number
  onUpdate: (id: string, data: Partial<PlaylistItem>) => void
  onRemove: (id: string) => void
  onDragStart: (idx: number) => void
  onDragOver: (idx: number) => void
  onDrop: () => void
  isDragOver: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const Icon = FILE_ICONS[(item as any).media?.file_type ?? 'image'] ?? Image

  return (
    <div
      className={`border-b border-white/5 transition-colors ${isDragOver ? 'bg-gjs-blue/10 border-gjs-blue/30' : ''}`}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index) }}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Drag handle */}
        <div className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 flex-shrink-0">
          <GripVertical size={14} />
        </div>

        {/* Position */}
        <span className="text-[11px] text-gray-500 w-5 text-center flex-shrink-0">
          {index + 1}
        </span>

        {/* Thumbnail */}
        <div className="w-8 h-8 rounded overflow-hidden bg-dark-bg-3 flex-shrink-0">
          {(item as any).media?.thumbnail_url ? (
            <img
              src={(item as any).media.thumbnail_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon size={12} className="text-gray-500" />
            </div>
          )}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-gray-100 truncate">
            {(item as any).media?.name ?? item.media_id}
          </p>
          <p className="text-[11px] text-gray-500">
            {formatDuration(item.duration_sec)}
            {item.transition_type ? ` · ${item.transition_type}` : ''}
          </p>
        </div>

        {/* Duration quick-set */}
        <DurationSlider
          value={item.duration_sec}
          onChange={(v) => onUpdate(item.id, { duration_sec: v })}
        />

        {/* Expand / remove */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          onClick={() => onRemove(item.id)}
          className="p-1 text-gray-500 hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded controls */}
      {expanded && (
        <div className="px-10 pb-3 grid grid-cols-2 gap-x-6 gap-y-2">
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wider">Transition</label>
            <select
              value={item.transition_type ?? ''}
              onChange={(e) => onUpdate(item.id, { transition_type: e.target.value || null })}
              className="mt-1 w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] text-gray-300 focus:outline-none"
            >
              <option value="">Use playlist default</option>
              <option value="cut">Cut</option>
              <option value="fade">Fade</option>
              <option value="slide_left">Slide left</option>
              <option value="slide_right">Slide right</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wider">Weight</label>
            <input
              type="number"
              min={1}
              max={100}
              value={item.weight}
              onChange={(e) => onUpdate(item.id, { weight: parseInt(e.target.value) || 1 })}
              className="mt-1 w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] text-gray-300 focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Playlist list view (left panel) ─────────────────────────────────────────

function PlaylistListPanel({
  playlists,
  activeId,
  onSelect,
  onCreate,
  loading,
}: {
  playlists: Playlist[]
  activeId: string | null
  onSelect: (p: Playlist) => void
  onCreate: () => void
  loading: boolean
}) {
  return (
    <div className="w-64 flex-shrink-0 border-r border-white/5 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <p className="text-[13px] font-semibold text-gray-100">Playlists</p>
        <button
          onClick={onCreate}
          className="p-1.5 rounded-lg bg-gjs-blue text-white hover:bg-gjs-blue/80 transition-colors"
          title="New playlist"
        >
          <Plus size={13} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader size={18} className="animate-spin text-gray-500" />
          </div>
        )}
        {playlists.map((p) => {
          const ModeIcon = PLAY_MODE_ICONS[p.play_mode] ?? Play
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className={`w-full flex items-start gap-2.5 px-4 py-3 border-b border-white/5 text-left transition-colors ${
                activeId === p.id ? 'bg-gjs-blue/10 border-l-2 border-l-gjs-blue' : 'hover:bg-white/[0.03]'
              }`}
            >
              <ModeIcon size={14} className="mt-0.5 text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-gray-100 truncate">{p.name}</p>
                <p className="text-[11px] text-gray-500">
                  {p.items?.length ?? 0} items
                  {p.items?.length
                    ? ` · ${formatDuration(p.items.reduce((s, i) => s + i.duration_sec, 0))}`
                    : ''}
                </p>
              </div>
              {!p.is_active && (
                <span className="ml-auto text-[10px] text-gray-500 flex-shrink-0">off</span>
              )}
            </button>
          )
        })}
        {!loading && playlists.length === 0 && (
          <p className="text-[13px] text-gray-500 text-center py-10">No playlists yet</p>
        )}
      </div>
    </div>
  )
}

// ─── Create / rename modal ────────────────────────────────────────────────────

function CreatePlaylistModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (name: string, playMode: string) => void
}) {
  const [name, setName] = useState('')
  const [playMode, setPlayMode] = useState('sequential')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-dark-bg-2 border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold text-gray-100">New Playlist</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-100">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[12px] text-gray-400 block mb-1">Name</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lobby Loop"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[13px] text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gjs-blue/50"
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && onCreate(name.trim(), playMode)}
            />
          </div>
          <div>
            <label className="text-[12px] text-gray-400 block mb-1">Play Mode</label>
            <select
              value={playMode}
              onChange={(e) => setPlayMode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[13px] text-gray-300 focus:outline-none"
            >
              <option value="sequential">Sequential</option>
              <option value="shuffle">Shuffle</option>
              <option value="weighted">Weighted</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-white/10 text-[13px] text-gray-400 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!name.trim()}
            onClick={() => name.trim() && onCreate(name.trim(), playMode)}
            className="flex-1 py-2 rounded-lg bg-gjs-blue text-white text-[13px] font-medium hover:bg-gjs-blue/80 disabled:opacity-50 transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Playlist builder (right panel) ──────────────────────────────────────────

function PlaylistBuilder({ playlist }: { playlist: Playlist }) {
  const { updatePlaylist, addItem, updateItem, removeItem, reorderItems, fetchPlaylist } =
    usePlaylistStore()
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const items = playlist.items ?? []

  const totalDuration = items.reduce((s, i) => s + i.duration_sec, 0)

  const handleAddMedia = async (asset: MediaAsset) => {
    setMediaPickerOpen(false)
    await addItem(playlist.id, {
      media_id: asset.id,
      position: items.length,
      duration_sec: asset.duration_sec ? Math.round(asset.duration_sec) : 10,
    })
  }

  const handleUpdateItem = async (id: string, data: Partial<PlaylistItem>) => {
    await updateItem(playlist.id, id, data)
  }

  const handleRemoveItem = async (id: string) => {
    await removeItem(playlist.id, id)
  }

  const handleDrop = async () => {
    if (dragFrom === null || dragOver === null || dragFrom === dragOver) {
      setDragFrom(null)
      setDragOver(null)
      return
    }
    const newOrder = [...items]
    const [moved] = newOrder.splice(dragFrom, 1)
    newOrder.splice(dragOver, 0, moved)
    setDragFrom(null)
    setDragOver(null)
    await reorderItems(playlist.id, newOrder.map((i) => i.id))
  }

  const handleSave = async () => {
    setSaving(true)
    await fetchPlaylist(playlist.id) // re-sync from server
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Builder header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="text-[14px] font-semibold text-gray-100 truncate">{playlist.name}</h2>
          <p className="text-[11px] text-gray-500">
            {items.length} items · {formatDuration(totalDuration)} total
            {!playlist.is_active && ' · inactive'}
          </p>
        </div>

        {/* Play mode */}
        <select
          value={playlist.play_mode}
          onChange={(e) => updatePlaylist(playlist.id, { play_mode: e.target.value as PlayMode })}
          className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] text-gray-300 focus:outline-none"
        >
          <option value="sequential">Sequential</option>
          <option value="shuffle">Shuffle</option>
          <option value="weighted">Weighted</option>
        </select>

        {/* Active toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={playlist.is_active}
            onChange={(e) => updatePlaylist(playlist.id, { is_active: e.target.checked })}
            className="accent-gjs-blue"
          />
          <span className="text-[12px] text-gray-400">Active</span>
        </label>

        {/* Save indicator */}
        {saved && (
          <span className="flex items-center gap-1 text-[12px] text-green-400">
            <CheckCircle size={12} />
            Saved
          </span>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gjs-blue text-white text-[12px] font-medium hover:bg-gjs-blue/80 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
          Sync
        </button>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <Play size={32} className="mb-3" />
            <p className="text-[14px] font-medium">Playlist is empty</p>
            <p className="text-[13px]">Add media below to build your playlist</p>
          </div>
        )}
        {items.map((item, idx) => (
          <PlaylistItemRow
            key={item.id}
            item={item as PlaylistItem & { media?: MediaAsset }}
            index={idx}
            onUpdate={handleUpdateItem}
            onRemove={handleRemoveItem}
            onDragStart={(i) => setDragFrom(i)}
            onDragOver={(i) => setDragOver(i)}
            onDrop={handleDrop}
            isDragOver={dragOver === idx}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/5 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => setMediaPickerOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gjs-blue text-white text-[13px] font-medium hover:bg-gjs-blue/80 transition-colors"
        >
          <Plus size={14} />
          Add Media
        </button>
        {items.length > 0 && (
          <p className="text-[12px] text-gray-500 ml-auto">
            Total runtime: <span className="text-gray-300">{formatDuration(totalDuration)}</span>
          </p>
        )}
      </div>

      {mediaPickerOpen && (
        <MediaPickerModal
          onSelect={handleAddMedia}
          onClose={() => setMediaPickerOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlaylistBuilderPage() {
  const { playlists, activePlaylist, loading, fetchPlaylists, fetchPlaylist, createPlaylist } =
    usePlaylistStore()
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    fetchPlaylists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelect = (p: Playlist) => {
    fetchPlaylist(p.id)
  }

  const handleCreate = async (name: string, playMode: string) => {
    const p = await createPlaylist({ name, play_mode: playMode })
    setCreateOpen(false)
    fetchPlaylist(p.id)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <PlaylistListPanel
        playlists={playlists}
        activeId={activePlaylist?.id ?? null}
        onSelect={handleSelect}
        onCreate={() => setCreateOpen(true)}
        loading={loading}
      />

      {activePlaylist ? (
        <PlaylistBuilder playlist={activePlaylist} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Play size={40} className="mx-auto mb-3" />
            <p className="text-[14px] font-medium">Select a playlist to edit</p>
            <p className="text-[13px] mt-1">or create a new one</p>
          </div>
        </div>
      )}

      {createOpen && (
        <CreatePlaylistModal
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
