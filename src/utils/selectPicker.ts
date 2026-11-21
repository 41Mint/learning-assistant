export function isOpenSelect(target: EventTarget | null): boolean {
  return target instanceof Element && CSS.supports('selector(select:open)') && target.closest('select:open') !== null;
}
