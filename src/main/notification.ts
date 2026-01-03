/**
 * Notification API shim
 * Maps Electron's Notification API to console logging
 *
 * Electron API: https://www.electronjs.org/docs/latest/api/notification
 *
 * Note: Desktop notifications require OS integration. This logs to console.
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
}

export class Notification {
  title: string;
  body?: string;
  silent?: boolean;

  constructor(options: NotificationOptions | string) {
    if (typeof options === 'string') {
      this.title = options;
    } else {
      this.title = options.title || '';
      this.body = options.body;
      this.silent = options.silent;

      // Log notification to console in server context
      this.logNotification(options);
    }
  }

  private logNotification(options: NotificationOptions): void {
    console.log('[electron-to-web] Notification:', {
      title: options.title,
      subtitle: options.subtitle,
      body: options.body,
      silent: options.silent,
    });
  }

  /**
   * Show the notification
   */
  show(): void {
    console.log(`[electron-to-web] Notification shown: ${this.title}${this.body ? ' - ' + this.body : ''}`);
  }

  /**
   * Close the notification
   */
  close(): void {
    console.log(`[electron-to-web] Notification closed: ${this.title}`);
  }

  /**
   * Check if desktop notifications are supported
   */
  static isSupported(): boolean {
    // In server context, we can't show real notifications
    return false;
  }

  // Event handlers (no-ops in server context)
  on(_event: string, _listener: Function): this {
    return this;
  }

  once(_event: string, _listener: Function): this {
    return this;
  }

  removeListener(_event: string, _listener: Function): this {
    return this;
  }

  removeAllListeners(_event?: string): this {
    return this;
  }
}
