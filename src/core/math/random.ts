export class Random {
  constructor(private value = 0xeca01234) {
    this.value = value >>> 0;
  }
  next(): number {
    this.value = (Math.imul(1664525, this.value) + 1013904223) >>> 0;
    return this.value / 4294967296;
  }
}
