/** True on devices with a fine (mouse-like) pointer — used to gate autoFocus to desktop only,
 * since yanking focus (and the keyboard) up is disruptive on touch devices. */
export const isDesktopPointer = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches
