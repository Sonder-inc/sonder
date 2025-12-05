import { COMMANDS, CONTEXT_ITEMS, type Command, type ContextItem } from '../constants/app-constants'

// Generic trie node for prefix matching
class TrieNode<T> {
  children: Map<string, TrieNode<T>> = new Map()
  items: T[] = []
}

// Build trie from items with a key extractor
export function buildTrie<T>(items: readonly T[], getKey: (item: T) => string): TrieNode<T> {
  const root = new TrieNode<T>()

  for (const item of items) {
    let node = root
    for (const char of getKey(item).toLowerCase()) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode<T>())
      }
      node = node.children.get(char)!
      node.items.push(item)
    }
  }

  return root
}

// Search trie for items matching a prefix
export function searchTrie<T>(trie: TrieNode<T>, prefix: string): T[] {
  let node = trie
  const lowerPrefix = prefix.toLowerCase()

  for (const char of lowerPrefix) {
    if (!node.children.has(char)) {
      return []
    }
    node = node.children.get(char)!
  }

  return node.items
}

// Pre-built tries for commands and context items
const commandTrie = buildTrie(COMMANDS, (cmd) => cmd.name)
const contextTrie = buildTrie(CONTEXT_ITEMS, (item) => item.name)

// Convenience search functions
export const searchCommands = (prefix: string): Command[] => searchTrie(commandTrie, prefix)
export const searchContext = (prefix: string): ContextItem[] => searchTrie(contextTrie, prefix)
