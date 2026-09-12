// Each button owns one pointer; a second finger cannot release its held shot.
export function installShotButtons(buttons, { active, focus, change, tap }) {
  const held = new Map();
  const update = () => change([...held.values()].at(-1)?.kind ?? null);
  for (const button of buttons) {
    button.addEventListener('pointerdown', event => {
      if (!active() || held.has(button) || event.button !== 0) return;
      event.preventDefault(); focus();
      held.set(button, { pointer: event.pointerId, kind: button.dataset.shot });
      button.setPointerCapture?.(event.pointerId); update();
    });
    const release = event => {
      if (held.get(button)?.pointer !== event.pointerId) return;
      held.delete(button); update();
    };
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, release);
    button.addEventListener('click', event => { if (event.detail === 0 && active()) tap(button.dataset.shot); });
  }
  return {
    clear() {
      const entries = [...held]; held.clear(); update();
      for (const [button, value] of entries) if (button.hasPointerCapture?.(value.pointer)) button.releasePointerCapture(value.pointer);
    },
  };
}
