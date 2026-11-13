type DrawerFocus = "enter" | "return" | undefined;

const transitions = new Map<string, DrawerFocus>([
  ["false-true", "enter"],
  ["true-false", "return"],
]);

const drawerFocus = (was: boolean, now: boolean): DrawerFocus => transitions.get(`${was}-${now}`);

export { drawerFocus };
