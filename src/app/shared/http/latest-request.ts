export class LatestRequest {
  private turn = 0;

  start(): () => boolean {
    const mine = ++this.turn;
    return () => mine === this.turn;
  }
}
