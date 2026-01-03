/**
 * Clipboard API shim
 * Maps Electron's clipboard API to Web Clipboard API
 *
 * Electron API: https://www.electronjs.org/docs/latest/api/clipboard
 * Web API: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
 */

export class Clipboard {
  /**
   * Write text to clipboard
   * @param text - Text to write
   * @param type - Clipboard type (selection or clipboard) - ignored in web
   */
  async writeText(text: string, _type?: 'selection' | 'clipboard'): Promise<void> {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API not available (requires HTTPS)');
    }

    await navigator.clipboard.writeText(text);
  }

  /**
   * Read text from clipboard
   * @param type - Clipboard type - ignored in web
   */
  async readText(_type?: 'selection' | 'clipboard'): Promise<string> {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API not available (requires HTTPS)');
    }

    return await navigator.clipboard.readText();
  }

  /**
   * Write HTML to clipboard
   * Note: Web Clipboard API has different format than Electron
   */
  async writeHTML(markup: string): Promise<void> {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API not available (requires HTTPS)');
    }

    const blob = new Blob([markup], { type: 'text/html' });
    const clipboardItem = new ClipboardItem({ 'text/html': blob });
    await navigator.clipboard.write([clipboardItem]);
  }

  /**
   * Read HTML from clipboard
   * Note: Limited browser support
   */
  async readHTML(): Promise<string> {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API not available (requires HTTPS)');
    }

    const items = await navigator.clipboard.read();

    for (const item of items) {
      if (item.types.includes('text/html')) {
        const blob = await item.getType('text/html');
        return await blob.text();
      }
    }

    return '';
  }

  /**
   * Write image to clipboard
   * @param image - NativeImage (in web, use Blob or Image data)
   */
  async writeImage(image: Blob | string): Promise<void> {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API not available (requires HTTPS)');
    }

    let blob: Blob;

    if (typeof image === 'string') {
      // Convert data URL to blob
      const response = await fetch(image);
      blob = await response.blob();
    } else {
      blob = image;
    }

    const clipboardItem = new ClipboardItem({ [blob.type]: blob });
    await navigator.clipboard.write([clipboardItem]);
  }

  /**
   * Read image from clipboard
   * Returns data URL
   */
  async readImage(): Promise<string> {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API not available (requires HTTPS)');
    }

    const items = await navigator.clipboard.read();

    for (const item of items) {
      const imageType = item.types.find(type => type.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        return await this.blobToDataURL(blob);
      }
    }

    return '';
  }

  /**
   * Clear clipboard
   */
  async clear(): Promise<void> {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API not available (requires HTTPS)');
    }

    // Write empty text to clear
    await navigator.clipboard.writeText('');
  }

  /**
   * Check if clipboard is available
   */
  isAvailable(): boolean {
    return !!navigator.clipboard;
  }

  /**
   * Helper: Convert blob to data URL
   */
  private blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

// Singleton instance
export const clipboard = new Clipboard();
