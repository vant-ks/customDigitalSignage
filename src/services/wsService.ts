/**
 * WebSocket service with auto-reconnect, heartbeat, and event routing.
 * Connects to /ws?token=<JWT> for dashboard users.
 */

import type { WSMessage, WSMessageType } from '../types'

type MessageHandler<T = unknown> = (payload: T) => void

class WebSocketService {
  private ws: WebSocket | null = null
  private token: string | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectAttempts = 0
  private maxReconnectDelay = 30_000
  private listeners: Map<WSMessageType | '*', Set<MessageHandler<unknown>>> = new Map()
  private intentionalClose = false

  connect(token: string) {
    this.token = token
    this.intentionalClose = false
    this._connect()
  }

  disconnect() {
    this.intentionalClose = true
    this._cleanup()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  send<T>(message: WSMessage<T>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  on<T = unknown>(type: WSMessageType | '*', handler: MessageHandler<T>) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(handler as MessageHandler<unknown>)
    return () => this.off(type, handler)
  }

  off<T = unknown>(type: WSMessageType | '*', handler: MessageHandler<T>) {
    this.listeners.get(type)?.delete(handler as MessageHandler<unknown>)
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private _connect() {
    if (!this.token) return

    // Use current host with ws/wss protocol (Vite proxy handles ws → localhost:3030)
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = `${protocol}://${window.location.host}/ws?token=${encodeURIComponent(this.token)}`

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      console.log('[ws] connected')
      this.reconnectAttempts = 0
      this._startHeartbeat()
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage
        this._dispatch(msg.type, msg.payload)
        this._dispatch('*', msg)
      } catch {
        console.warn('[ws] invalid message', event.data)
      }
    }

    this.ws.onclose = () => {
      console.log('[ws] disconnected')
      this._cleanup()
      if (!this.intentionalClose) this._scheduleReconnect()
    }

    this.ws.onerror = (err) => {
      console.error('[ws] error', err)
    }
  }

  private _dispatch(type: WSMessageType | '*', payload: unknown) {
    this.listeners.get(type)?.forEach((handler) => {
      try {
        handler(payload)
      } catch (err) {
        console.error('[ws] handler error', err)
      }
    })
  }

  private _startHeartbeat() {
    this._stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }))
      }
    }, 30_000)
  }

  private _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private _cleanup() {
    this._stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private _scheduleReconnect() {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, this.maxReconnectDelay)
    this.reconnectAttempts++
    console.log(`[ws] reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    this.reconnectTimer = setTimeout(() => this._connect(), delay)
  }
}

export const wsService = new WebSocketService()
