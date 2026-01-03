/**
 * Clipboard API shim
 * Maps Electron's clipboard API to Node.js equivalents
 *
 * Electron API: https://www.electronjs.org/docs/latest/api/clipboard
 *
 * Note: True clipboard access requires OS integration. This provides a
 * minimal in-memory clipboard for server-side code.
 */

class Clipboard {
  private textContent: string = '';
  private htmlContent: string = '';

  /**
   * Read text from clipboard
   * In server context, this is an in-memory clipboard
   */
  readText(): string {
    return this.textContent;
  }

  /**
   * Write text to clipboard
   */
  writeText(text: string): void {
    this.textContent = text;
  }

  /**
   * Read HTML from clipboard
   */
  readHTML(): string {
    return this.htmlContent;
  }

  /**
   * Write HTML to clipboard
   */
  writeHTML(markup: string): void {
    this.htmlContent = markup;
  }

  /**
   * Read RTF from clipboard (not supported)
   */
  readRTF(): string {
    console.warn('[electron-to-web] readRTF not supported in server context');
    return '';
  }

  /**
   * Write RTF to clipboard (not supported)
   */
  writeRTF(_text: string): void {
    console.warn('[electron-to-web] writeRTF not supported in server context');
  }

  /**
   * Clear the clipboard
   */
  clear(): void {
    this.textContent = '';
    this.htmlContent = '';
  }

  /**
   * Write multiple formats at once
   */
  write(data: { text?: string; html?: string; rtf?: string }): void {
    if (data.text) this.textContent = data.text;
    if (data.html) this.htmlContent = data.html;
    if (data.rtf) console.warn('[electron-to-web] RTF format not supported');
  }
}

// Singleton instance
export const clipboard = new Clipboard();
