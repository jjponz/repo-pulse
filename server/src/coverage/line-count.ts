export class LineCount {
  static of(covered: number, total: number): LineCount {
    return new LineCount(covered, total)
  }

  private constructor(
    readonly covered: number,
    readonly total: number,
  ) {}

  percentage(): number {
    return Math.round((this.covered / this.total) * 1000) / 10
  }
}
