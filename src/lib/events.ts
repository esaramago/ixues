import type { Action } from 'svelte/action'

/**
 * Event wrapper equivalent to Svelte's `|self` modifier.
 * Ensures the handler is only invoked when `event.target === event.currentTarget`.
 *
 * Prevents bubbling custom events from child components (e.g. wa-select or
 * wa-dropdown emitting wa-hide / wa-after-hide) from falsely triggering
 * container event handlers (such as wa-dialog).
 */
export function self<E extends Event = CustomEvent>(
  handler?: ((event: E) => void) | (() => void)
) {
  return (event: E) => {
    if (event.target === event.currentTarget) {
      handler?.(event)
    }
  }
}

export const onlySelf = self

export interface SafeDialogHandlers {
  onhide?: (event: CustomEvent) => void
  onafterhide?: (event: CustomEvent) => void
  onshow?: (event: CustomEvent) => void
  onaftershow?: (event: CustomEvent) => void
}

/**
 * Svelte action for dialog elements (e.g. `<wa-dialog>`) that automatically
 * filters lifecycle events so only events originating directly from the dialog
 * are handled.
 *
 * Example:
 * ```svelte
 * <wa-dialog use:safeDialog={{ onafterhide: handleClose }}>
 * ```
 */
export const safeDialog: Action<HTMLElement, SafeDialogHandlers | undefined> = (
  node,
  handlers = {}
) => {
  let currentHandlers = handlers

  const eventMap: Record<string, keyof SafeDialogHandlers> = {
    'wa-hide': 'onhide',
    'wa-after-hide': 'onafterhide',
    'wa-show': 'onshow',
    'wa-after-show': 'onaftershow'
  }

  const registeredListeners: Array<{ event: string; listener: EventListener }> = []

  for (const [eventName, handlerKey] of Object.entries(eventMap)) {
    const listener = ((event: CustomEvent) => {
      if (event.target === node) {
        currentHandlers?.[handlerKey]?.(event)
      }
    }) as EventListener

    node.addEventListener(eventName, listener)
    registeredListeners.push({ event: eventName, listener })
  }

  return {
    update(newHandlers?: SafeDialogHandlers) {
      currentHandlers = newHandlers || {}
    },
    destroy() {
      for (const { event, listener } of registeredListeners) {
        node.removeEventListener(event, listener)
      }
    }
  }
}
