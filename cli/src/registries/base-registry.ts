/**
 * Base Registry Pattern
 *
 * Abstract base class for registries (tools, agents).
 * Provides common functionality for registration, lookup, and source tracking.
 */

/**
 * Source types for registered items
 */
export type RegistrySource = 'builtin' | 'user' | 'internal' | 'mcp' | 'agent'

/**
 * Registered item with metadata
 */
export interface RegisteredItem<T> {
  definition: T
  source: RegistrySource
  /** Optional metadata (e.g., MCP server name, agent name) */
  metadata?: Record<string, unknown>
}

/**
 * Item that can be registered (must have a name)
 */
export interface Registrable {
  name: string
  description: string
}

/**
 * Base registry class for managing named items with source tracking
 */
export abstract class BaseRegistry<T extends Registrable> {
  protected items: Map<string, RegisteredItem<T>> = new Map()
  protected initialized = false

  /**
   * Register an item with a specific source
   */
  register(item: T, source: RegistrySource, metadata?: Record<string, unknown>): void {
    this.items.set(item.name, { definition: item, source, metadata })
    this.onItemRegistered(item, source)
  }

  /**
   * Register a built-in item
   */
  registerBuiltIn(item: T): void {
    this.register(item, 'builtin')
  }

  /**
   * Register a user-defined item
   */
  registerUser(item: T): void {
    this.register(item, 'user')
  }

  /**
   * Register an internal item (not exposed to main agent)
   */
  registerInternal(item: T): void {
    this.register(item, 'internal')
  }

  /**
   * Unregister an item by name
   */
  unregister(name: string): boolean {
    const existed = this.items.has(name)
    if (existed) {
      this.items.delete(name)
      this.onItemUnregistered(name)
    }
    return existed
  }

  /**
   * Unregister all items matching a predicate
   */
  unregisterWhere(predicate: (name: string, item: RegisteredItem<T>) => boolean): number {
    let count = 0
    for (const [name, item] of this.items) {
      if (predicate(name, item)) {
        this.items.delete(name)
        this.onItemUnregistered(name)
        count++
      }
    }
    return count
  }

  /**
   * Get an item by name
   */
  get(name: string): T | undefined {
    return this.items.get(name)?.definition
  }

  /**
   * Get registered item with metadata
   */
  getRegistered(name: string): RegisteredItem<T> | undefined {
    return this.items.get(name)
  }

  /**
   * Check if an item exists
   */
  has(name: string): boolean {
    return this.items.has(name)
  }

  /**
   * Get all item names
   */
  getNames(): string[] {
    return Array.from(this.items.keys())
  }

  /**
   * Get all items
   */
  getAll(): T[] {
    return Array.from(this.items.values()).map((r) => r.definition)
  }

  /**
   * Get all items with a specific source
   */
  getBySource(source: RegistrySource): T[] {
    return Array.from(this.items.values())
      .filter((r) => r.source === source)
      .map((r) => r.definition)
  }

  /**
   * Get item descriptions for LLM context
   */
  getDescriptions(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [name, registered] of this.items) {
      result[name] = registered.definition.description
    }
    return result
  }

  /**
   * Get the source of an item
   */
  getSource(name: string): RegistrySource | undefined {
    return this.items.get(name)?.source
  }

  /**
   * Check if an item is user-defined
   */
  isUserDefined(name: string): boolean {
    return this.items.get(name)?.source === 'user'
  }

  /**
   * Check if an item is internal (subagent-only)
   */
  isInternal(name: string): boolean {
    return this.items.get(name)?.source === 'internal'
  }

  /**
   * Get count of registered items
   */
  get size(): number {
    return this.items.size
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.items.clear()
    this.onCleared()
  }

  /**
   * Hook called when an item is registered
   * Override in subclass to handle cache invalidation, etc.
   */
  protected onItemRegistered(_item: T, _source: RegistrySource): void {
    // Override in subclass
  }

  /**
   * Hook called when an item is unregistered
   */
  protected onItemUnregistered(_name: string): void {
    // Override in subclass
  }

  /**
   * Hook called when registry is cleared
   */
  protected onCleared(): void {
    // Override in subclass
  }
}
