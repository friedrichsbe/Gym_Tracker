// Pure helpers for supersets. A superset is a run of 2+ adjacent exercises that share a group id;
// they are done alternately (one set each, no rest in between) and tracked like any other exercise.

/**
 * Enforces the invariants: members of a group are adjacent and a group has at least two members.
 * A group id that appears in several separate runs is kept for the first run only; later runs get a fresh id.
 */
export function normalizeGroupIds(
  groupIds: readonly (string | null | undefined)[],
  makeId: () => string,
): (string | null)[] {
  const out: (string | null)[] = groupIds.map(() => null)
  const used = new Set<string>()
  let i = 0
  while (i < groupIds.length) {
    const g = groupIds[i]
    if (!g) {
      i++
      continue
    }
    let j = i
    while (j < groupIds.length && groupIds[j] === g) j++
    if (j - i >= 2) {
      const id = used.has(g) ? makeId() : g
      used.add(id)
      for (let k = i; k < j; k++) out[k] = id
    }
    i = j
  }
  return out
}

/** Splits an ordered list into blocks: a superset is one block, every other item a block of its own. */
export function toBlocks<T>(items: readonly T[], groupOf: (item: T) => string | null | undefined): T[][] {
  const blocks: T[][] = []
  for (const item of items) {
    const g = groupOf(item)
    const last = blocks[blocks.length - 1]
    if (g && last && groupOf(last[0]) === g) last.push(item)
    else blocks.push([item])
  }
  return blocks
}

/** Moves the block containing `index` one block up/down; returns the new order. */
export function moveBlock<T>(
  items: readonly T[],
  index: number,
  direction: -1 | 1,
  groupOf: (item: T) => string | null | undefined,
): T[] {
  const blocks = toBlocks(items, groupOf)
  const bi = blocks.findIndex((b) => b.includes(items[index]))
  const bj = bi + direction
  if (bi < 0 || bj < 0 || bj >= blocks.length) return [...items]
  ;[blocks[bi], blocks[bj]] = [blocks[bj], blocks[bi]]
  return blocks.flat()
}

/**
 * "Do next": moves the block containing `index` right below the last started block, i.e. above every block that has
 * not been started yet. A block that was started itself stays where it is. Returns the new order.
 */
export function moveBlockNext<T>(
  items: readonly T[],
  index: number,
  groupOf: (item: T) => string | null | undefined,
  started: (item: T) => boolean,
): T[] {
  const blocks = toBlocks(items, groupOf)
  const bi = blocks.findIndex((b) => b.includes(items[index]))
  if (bi < 0 || blocks[bi].some(started)) return [...items]
  const [block] = blocks.splice(bi, 1)
  let at = 0
  blocks.forEach((b, j) => {
    if (b.some(started)) at = j + 1
  })
  blocks.splice(at, 0, block)
  return blocks.flat()
}

export function supersetLabel(size: number): string {
  return size <= 2 ? 'Superset' : size === 3 ? 'Tri-set' : 'Giant set'
}
