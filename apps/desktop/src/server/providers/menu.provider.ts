import { Provider } from "@nestjs/common";

export const MENU = Symbol("MENU");

export const menuProvider: Provider<Deno.MenuItem[]> = {
  provide: MENU,
  useValue: [],
};
