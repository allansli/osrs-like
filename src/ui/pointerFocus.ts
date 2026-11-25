// The button a pointer press last focused. Chrome turns :focus-visible on as soon as a key is pressed,
// so it cannot tell a mouse-focused button from a keyboard-focused one inside a keydown handler.
let pointerButton: Element | null = null;

export function notePointerDown(target: EventTarget | null): void {
  pointerButton = target instanceof Element ? target.closest('button') : null;
}

/** Keyboard navigation (Tab) hands focus to the keyboard. */
export function noteKeyboardNavigation(): void {
  pointerButton = null;
}

export function isPointerFocused(el: Element | null): boolean {
  return el !== null && el === pointerButton;
}
