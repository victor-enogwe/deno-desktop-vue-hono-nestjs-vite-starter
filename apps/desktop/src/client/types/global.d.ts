export interface Bindings {
  performComputation?: () => Promise<string>; //dummy
}

declare global {
  const bindings: Bindings;

  interface Window {
    bindings?: Bindings;
  }
}
