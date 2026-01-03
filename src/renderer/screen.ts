/**
 * Screen API shim
 * Maps Electron's screen API to Web screen API
 *
 * Electron API: https://www.electronjs.org/docs/latest/api/screen
 * Web API: https://developer.mozilla.org/en-US/docs/Web/API/Screen
 */

export interface Display {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  rotation: number;
  internal: boolean;
  touchSupport: 'available' | 'unavailable' | 'unknown';
}

export interface Point {
  x: number;
  y: number;
}

export class Screen {
  private eventHandlers: Map<string, Function[]> = new Map();

  /**
   * Get the primary display
   */
  getPrimaryDisplay(): Display {
    return {
      id: 0,
      bounds: {
        x: 0,
        y: 0,
        width: window.screen.width,
        height: window.screen.height,
      },
      workArea: {
        x: 0,
        y: 0,
        width: window.screen.availWidth,
        height: window.screen.availHeight,
      },
      scaleFactor: window.devicePixelRatio,
      rotation: this.getScreenOrientation(),
      internal: false, // Can't determine in web
      touchSupport: this.getTouchSupport(),
    };
  }

  /**
   * Get all displays
   * In web, we can only get the primary display
   */
  getAllDisplays(): Display[] {
    return [this.getPrimaryDisplay()];
  }

  /**
   * Get display nearest to point
   * In web, always returns primary display
   */
  getDisplayNearestPoint(_point: Point): Display {
    return this.getPrimaryDisplay();
  }

  /**
   * Get display matching bounds
   * In web, always returns primary display
   */
  getDisplayMatching(_rect: { x: number; y: number; width: number; height: number }): Display {
    return this.getPrimaryDisplay();
  }

  /**
   * Get cursor screen point
   * Not available in web for security reasons
   */
  getCursorScreenPoint(): Point {
    console.warn('[electron-to-web] getCursorScreenPoint not available in web (security restriction)');
    return { x: 0, y: 0 };
  }

  /**
   * Add event listener
   */
  on(event: 'display-added' | 'display-removed' | 'display-metrics-changed', listener: Function): this {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);

      // Set up actual event listeners for display changes
      if (event === 'display-metrics-changed') {
        this.setupDisplayChangeListener();
      }
    }

    this.eventHandlers.get(event)!.push(listener);
    return this;
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
   * Emit event to listeners
   */
  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[electron-to-web] Error in screen '${event}' handler:`, error);
        }
      });
    }
  }

  /**
   * Set up listener for display changes
   */
  private setupDisplayChangeListener(): void {
    // Listen for window resize as proxy for display changes
    let resizeTimeout: number;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        this.emit('display-metrics-changed');
      }, 250);
    });

    // Listen for device pixel ratio changes
    const media = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    media.addEventListener('change', () => {
      this.emit('display-metrics-changed');
    });

    // Listen for orientation changes
    window.addEventListener('orientationchange', () => {
      this.emit('display-metrics-changed');
    });
  }

  /**
   * Get screen orientation in degrees
   */
  private getScreenOrientation(): number {
    if ('orientation' in screen && typeof (screen as any).orientation?.angle === 'number') {
      return (screen as any).orientation.angle;
    }

    // Fallback based on window dimensions
    if (window.innerHeight > window.innerWidth) {
      return 0; // Portrait
    } else {
      return 90; // Landscape
    }
  }

  /**
   * Detect touch support
   */
  private getTouchSupport(): 'available' | 'unavailable' | 'unknown' {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      return 'available';
    }
    return 'unavailable';
  }
}

// Singleton instance
export const screen = new Screen();
