const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const running = new Map<HTMLElement, { animation: Animation; finish: () => void }>();

export function cancelMotion(target: HTMLElement): void {
  const motion = running.get(target);
  if (!motion) return;
  running.delete(target);
  motion.animation.onfinish = null;
  motion.animation.cancel();
}

function animate(
  target: HTMLElement, frames: Keyframe[], opening: boolean,
  complete: () => void, immediate = false
): void {
  cancelMotion(target);
  const style = getComputedStyle(target);
  const duration = parseFloat(style.getPropertyValue(opening ? '--sharp-motion-enter' : '--sharp-motion-exit'));
  if (immediate || reducedMotion.matches || !duration || typeof target.animate !== 'function') {
    complete();
    return;
  }
  const animation = target.animate(frames, {
    duration, easing: style.getPropertyValue('--sharp-motion-ease').trim(), fill: 'both'
  });
  const finish = (): void => {
    if (running.get(target)?.animation !== animation) return;
    cancelMotion(target);
    complete();
  };
  running.set(target, { animation, finish });
  animation.onfinish = finish;
}

// Finish pending exits as well as entrances when the system preference changes.
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) [...running.values()].forEach(motion => motion.finish());
});

/** Keep positioning transforms intact; reversing starts from the visible frame. */
export function animatePanel(
  panel: HTMLElement, opening: boolean, complete = (): void => {}, immediate = false
): void {
  const style = getComputedStyle(panel);
  const shown = { opacity: '1', translate: '0px 0px' };
  const hidden = {
    opacity: style.getPropertyValue('--sharp-motion-opacity').trim() || '0',
    translate: style.getPropertyValue('--sharp-motion-offset').trim() || '0px -6px'
  };
  const from = running.has(panel)
    ? { opacity: style.opacity, translate: style.translate }
    : opening ? hidden : shown;
  animate(panel, [from, opening ? shown : hidden], opening, complete, immediate);
}

/** Preserve native details/summary semantics while animating its measured height. */
export function bindDisclosure(details: HTMLDetailsElement): void {
  const summary = details.querySelector('summary');
  const content = details.querySelector<HTMLElement>('.sharp-mobile-links');
  if (!summary || !content) return;
  let expanded = details.open;
  summary.setAttribute('aria-expanded', String(expanded));
  summary.addEventListener('click', event => {
    event.preventDefault();
    const from = details.getBoundingClientRect().height;
    cancelMotion(details);
    expanded = !expanded;
    summary.setAttribute('aria-expanded', String(expanded));
    content.inert = !expanded;
    details.open = true;
    const border = parseFloat(getComputedStyle(details).borderBottomWidth) || 0;
    const to = expanded ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height + border;
    details.style.overflow = 'hidden';
    animate(details, [{ height: `${from}px` }, { height: `${to}px` }], expanded, () => {
      details.open = expanded;
      details.style.removeProperty('overflow');
      content.inert = false;
    });
  });
}
