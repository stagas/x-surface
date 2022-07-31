import type { Point } from 'sigl'

export const round = ({ x, y }: Point, p = 1) => ({
  x: Math.round(x * p) / p,
  y: Math.round(y * p) / p,
})

export const modwrap = (x: number, N: number) => (x % N + N) % N

export const distance = (a: Point, b: Point) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
