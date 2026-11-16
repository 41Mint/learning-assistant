import { useGrowthDragStore } from '../../store/growthDragStore';

export function startCardDragMotion(card: HTMLElement, event: Pick<DragEvent, 'clientX' | 'clientY'>, transfer: DataTransfer) {
  const slot = card.parentElement;
  if (!slot) return;
  const bounds = card.getBoundingClientRect();
  const offsetX = event.clientX - bounds.left;
  const offsetY = event.clientY - bounds.top;
  const image = document.createElement('canvas');
  image.width = image.height = 1;
  image.className = 'growth-drag-image';
  document.body.append(image);
  transfer.setDragImage(image, 0, 0);

  slot.style.minHeight = `${slot.offsetHeight}px`;
  card.style.width = `${bounds.width}px`;
  card.style.translate = `${bounds.left}px ${bounds.top}px`;
  card.dataset.dragMotion = 'moving';
  card.setAttribute('popover', 'manual');
  card.showPopover();

  let animation: Animation | undefined;
  let frame = 0;
  let x = event.clientX;
  let y = event.clientY;
  const position = () => {
    frame = 0;
    card.style.translate = `${x - offsetX}px ${y - offsetY}px`;
  };
  const move = (event: DragEvent) => {
    x = event.clientX;
    y = event.clientY;
    if (!frame) frame = window.requestAnimationFrame(position);
  };
  const removeListeners = () => {
    document.removeEventListener('dragover', move, true);
    document.removeEventListener('dragend', finish, true);
    if (frame) window.cancelAnimationFrame(frame);
    for (const target of document.querySelectorAll('[data-drop-intent]')) target.removeAttribute('data-drop-intent');
    for (const target of document.querySelectorAll('[data-insertion-side]')) target.removeAttribute('data-insertion-side');
    image.remove();
  };
  const clear = () => {
    removeListeners();
    animation?.cancel();
    if (card.matches(':popover-open')) card.hidePopover();
    card.removeAttribute('popover');
    delete card.dataset.dragMotion;
    card.style.removeProperty('width');
    card.style.removeProperty('translate');
    slot.style.removeProperty('min-height');
  };
  const finish = () => {
    removeListeners();
    useGrowthDragStore.setState({ drag: undefined });
    if (!slot.getClientRects().length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      clear();
      return;
    }
    position();
    card.dataset.dragMotion = 'returning';
    frame = requestAnimationFrame(() => {
      frame = 0;
      const target = slot.getBoundingClientRect();
      animation = card.animate([
        { translate: card.style.translate },
        { translate: `${target.left}px ${target.top}px` },
      ], { duration: 170, easing: 'cubic-bezier(.2,.75,.3,1)', fill: 'forwards' });
      animation.onfinish = clear;
    });
  };
  document.addEventListener('dragover', move, true);
  document.addEventListener('dragend', finish, true);
  return () => {
    if (card.dataset.dragMotion === 'moving') useGrowthDragStore.setState({ drag: undefined });
    clear();
  };
}
