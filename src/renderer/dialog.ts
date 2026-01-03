/**
 * Dialog API shim
 * Maps Electron's dialog API to Web File System Access API with fallback
 *
 * Electron API: https://www.electronjs.org/docs/latest/api/dialog
 * Web API: https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 */

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface OpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory'>;
  message?: string;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: FileFilter[];
  message?: string;
  nameFieldLabel?: string;
  showsTagField?: boolean;
}

export interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  buttons?: string[];
  defaultId?: number;
  title?: string;
  message: string;
  detail?: string;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  icon?: string;
  cancelId?: number;
  noLink?: boolean;
  normalizeAccessKeys?: boolean;
}

export interface OpenDialogReturnValue {
  canceled: boolean;
  filePaths: string[];
  bookmarks?: string[];
}

export interface SaveDialogReturnValue {
  canceled: boolean;
  filePath?: string;
  bookmark?: string;
}

export interface MessageBoxReturnValue {
  response: number;
  checkboxChecked?: boolean;
}

export class Dialog {
  /**
   * Show open dialog for selecting files/directories
   */
  async showOpenDialog(options: OpenDialogOptions = {}): Promise<OpenDialogReturnValue> {
    // Try File System Access API first (Chrome/Edge)
    if ('showOpenFilePicker' in window) {
      return await this.showOpenDialogModern(options);
    }

    // Fallback to file input
    return await this.showOpenDialogFallback(options);
  }

  /**
   * Modern File System Access API implementation
   */
  private async showOpenDialogModern(options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
    try {
      const isDirectory = options.properties?.includes('openDirectory');
      const multiple = options.properties?.includes('multiSelections');

      if (isDirectory) {
        // Directory picker
        // @ts-ignore - showDirectoryPicker is newer API
        const dirHandle = await window.showDirectoryPicker({
          startIn: options.defaultPath as any,
        });

        return {
          canceled: false,
          filePaths: [dirHandle.name], // In web, we get handle, not full path
        };
      } else {
        // File picker
        const pickerOpts: any = {
          multiple,
          startIn: options.defaultPath as any,
        };

        // Add file type filters
        if (options.filters && options.filters.length > 0) {
          pickerOpts.types = options.filters.map(filter => ({
            description: filter.name,
            accept: {
              '*/*': filter.extensions.map(ext => `.${ext}`)
            }
          }));
        }

        // @ts-ignore
        const fileHandles = await window.showOpenFilePicker(pickerOpts);

        // Get file paths (names in web context)
        const files = await Promise.all(
          fileHandles.map(async (handle: any) => {
            const file = await handle.getFile();
            return file.name;
          })
        );

        return {
          canceled: false,
          filePaths: files,
        };
      }
    } catch (error) {
      // User cancelled or error
      return {
        canceled: true,
        filePaths: [],
      };
    }
  }

  /**
   * Fallback implementation using file input
   */
  private async showOpenDialogFallback(options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.style.display = 'none';

      // Set attributes based on options
      if (options.properties?.includes('multiSelections')) {
        input.multiple = true;
      }

      if (options.properties?.includes('openDirectory')) {
        // @ts-ignore - webkitdirectory is non-standard
        input.webkitdirectory = true;
      }

      // Set accept filter
      if (options.filters && options.filters.length > 0) {
        const extensions = options.filters.flatMap(f => f.extensions.map(ext => `.${ext}`));
        input.accept = extensions.join(',');
      }

      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          const filePaths = Array.from(input.files).map(f => f.name);
          resolve({
            canceled: false,
            filePaths,
          });
        } else {
          resolve({
            canceled: true,
            filePaths: [],
          });
        }
        document.body.removeChild(input);
      };

      input.oncancel = () => {
        resolve({
          canceled: true,
          filePaths: [],
        });
        document.body.removeChild(input);
      };

      document.body.appendChild(input);
      input.click();
    });
  }

  /**
   * Show save dialog
   */
  async showSaveDialog(options: SaveDialogOptions = {}): Promise<SaveDialogReturnValue> {
    // Try File System Access API
    if ('showSaveFilePicker' in window) {
      try {
        const pickerOpts: any = {
          suggestedName: options.defaultPath?.split('/').pop() || 'untitled',
        };

        // Add file type filters
        if (options.filters && options.filters.length > 0) {
          pickerOpts.types = options.filters.map(filter => ({
            description: filter.name,
            accept: {
              '*/*': filter.extensions.map(ext => `.${ext}`)
            }
          }));
        }

        // @ts-ignore
        const fileHandle = await window.showSaveFilePicker(pickerOpts);
        const file = await fileHandle.getFile();

        return {
          canceled: false,
          filePath: file.name,
        };
      } catch (error) {
        return {
          canceled: true,
        };
      }
    }

    // Fallback: Can't really implement save dialog without File System Access API
    // Just return a prompt-based filename
    const filename = prompt(options.message || 'Enter filename:', options.defaultPath || 'untitled');

    if (filename) {
      return {
        canceled: false,
        filePath: filename,
      };
    }

    return {
      canceled: true,
    };
  }

  /**
   * Show message box dialog
   */
  async showMessageBox(options: MessageBoxOptions): Promise<MessageBoxReturnValue> {
    const buttons = options.buttons || ['OK'];
    const message = `${options.title ? options.title + '\n\n' : ''}${options.message}${options.detail ? '\n\n' + options.detail : ''}`;

    // For simple cases, use native dialogs
    if (buttons.length === 1) {
      alert(message);
      return {
        response: 0,
        checkboxChecked: options.checkboxChecked,
      };
    }

    if (buttons.length === 2 && buttons.includes('OK') && buttons.includes('Cancel')) {
      const confirmed = confirm(message);
      return {
        response: confirmed ? buttons.indexOf('OK') : buttons.indexOf('Cancel'),
        checkboxChecked: options.checkboxChecked,
      };
    }

    // For complex cases, create custom modal
    return await this.showCustomMessageBox(options);
  }

  /**
   * Custom message box implementation
   */
  private async showCustomMessageBox(options: MessageBoxOptions): Promise<MessageBoxReturnValue> {
    return new Promise((resolve) => {
      // Create modal overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      // Create dialog box
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 500px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      `;

      // Title
      if (options.title) {
        const title = document.createElement('h3');
        title.textContent = options.title;
        title.style.marginTop = '0';
        dialog.appendChild(title);
      }

      // Message
      const message = document.createElement('p');
      message.textContent = options.message;
      dialog.appendChild(message);

      // Detail
      if (options.detail) {
        const detail = document.createElement('p');
        detail.textContent = options.detail;
        detail.style.color = '#666';
        detail.style.fontSize = '14px';
        dialog.appendChild(detail);
      }

      // Checkbox
      let checkbox: HTMLInputElement | null = null;
      if (options.checkboxLabel) {
        const checkboxContainer = document.createElement('label');
        checkboxContainer.style.display = 'block';
        checkboxContainer.style.marginTop = '10px';

        checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = options.checkboxChecked || false;
        checkbox.style.marginRight = '8px';

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(document.createTextNode(options.checkboxLabel));
        dialog.appendChild(checkboxContainer);
      }

      // Buttons
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'margin-top: 20px; text-align: right;';

      const buttons = options.buttons || ['OK'];
      buttons.forEach((buttonText, index) => {
        const button = document.createElement('button');
        button.textContent = buttonText;
        button.style.cssText = `
          margin-left: 8px;
          padding: 8px 16px;
          border: 1px solid #ccc;
          border-radius: 4px;
          background: ${index === options.defaultId ? '#007bff' : 'white'};
          color: ${index === options.defaultId ? 'white' : 'black'};
          cursor: pointer;
        `;

        button.onclick = () => {
          document.body.removeChild(overlay);
          resolve({
            response: index,
            checkboxChecked: checkbox?.checked,
          });
        };

        buttonContainer.appendChild(button);
      });

      dialog.appendChild(buttonContainer);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
    });
  }

  /**
   * Show error box (simple alert)
   */
  showErrorBox(title: string, content: string): void {
    alert(`${title}\n\n${content}`);
  }
}

// Singleton instance
export const dialog = new Dialog();
