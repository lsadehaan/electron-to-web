/**
 * Notification API shim
 * Maps Electron's Notification API to Web Notification API
 *
 * Electron API: https://www.electronjs.org/docs/latest/api/notification
 * Web API: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API
 */

export interface NotificationOptions {
  title?: string;
  subtitle?: string;
  body?: string;
  silent?: boolean;
  icon?: string;
  hasReply?: boolean;
  replyPlaceholder?: string;
  sound?: string;
  urgency?: 'normal' | 'critical' | 'low';
  actions?: Array<{ type: string; text: string }>;
  closeButtonText?: string;
  tag?: string;
  badge?: string;
  image?: string;
}

export class ElectronNotification {
  private notification?: Notification;
  private options: NotificationOptions;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(options: NotificationOptions = {}) {
    this.options = options;
  }

  /**
   * Request permission to show notifications
   */
  static async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported in this browser');
    }

    return await Notification.requestPermission();
  }

  /**
   * Check if notifications are supported
   */
  static isSupported(): boolean {
    return 'Notification' in window;
  }

  /**
   * Show the notification
   */
  async show(): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('[electron-to-web] Notifications not supported');
      return;
    }

    // Request permission if not granted
    if (Notification.permission === 'default') {
      await ElectronNotification.requestPermission();
    }

    if (Notification.permission !== 'granted') {
      console.warn('[electron-to-web] Notification permission denied');
      return;
    }

    // Create web notification
    const webOptions: NotificationOptions & { tag?: string; icon?: string; badge?: string; image?: string } = {
      body: this.options.body,
      icon: this.options.icon,
      badge: this.options.badge,
      tag: this.options.tag,
      silent: this.options.silent,
      // image: this.options.image, // Not widely supported
    };

    // Web Notifications don't support actions in all browsers
    // @ts-ignore - actions may not be recognized
    if (this.options.actions && 'actions' in Notification.prototype) {
      // @ts-ignore
      webOptions.actions = this.options.actions;
    }

    this.notification = new Notification(
      this.options.title || 'Notification',
      webOptions as NotificationOptions
    );

    // Set up event listeners
    this.notification.onclick = () => {
      this.emit('click');
    };

    this.notification.onclose = () => {
      this.emit('close');
    };

    this.notification.onerror = (error) => {
      this.emit('error', error);
    };

    this.notification.onshow = () => {
      this.emit('show');
    };
  }

  /**
   * Close the notification
   */
  close(): void {
    if (this.notification) {
      this.notification.close();
    }
  }

  /**
   * Add event listener
   */
  on(event: string, listener: Function): this {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(listener);
    return this;
  }

  /**
   * Add one-time event listener
   */
  once(event: string, listener: Function): this {
    const onceWrapper = (...args: any[]) => {
      this.removeListener(event, onceWrapper);
      listener(...args);
    };
    return this.on(event, onceWrapper);
  }

  /**
   * Remove event listener
   */
  removeListener(event: string, listener: Function): this {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(listener);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
    return this;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(event?: string): this {
    if (event) {
      this.eventHandlers.delete(event);
    } else {
      this.eventHandlers.clear();
    }
    return this;
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[electron-to-web] Error in notification '${event}' handler:`, error);
        }
      });
    }
  }
}

// Export as Notification for compatibility
export { ElectronNotification as Notification };
