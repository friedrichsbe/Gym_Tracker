import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/** Runtime gate: a native build opened in a plain browser stays on the web code paths. */
export const isNative = () => Capacitor.isNativePlatform()

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '')
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Android: an <a download> does nothing reliable inside the WebView. Write the file to the app cache and hand it to
 * the system share sheet (Save to Files / Drive / mail …).
 * Resolves false if the user closed the share sheet without picking a target.
 */
export async function shareFileNative(file: { blob: Blob; filename: string }): Promise<boolean> {
  const { uri } = await Filesystem.writeFile({
    path: `exports/${file.filename}`,
    data: await toBase64(file.blob),
    directory: Directory.Cache,
    recursive: true,
  })
  try {
    await Share.share({ title: file.filename, files: [uri], dialogTitle: file.filename })
    return true
  } catch (e) {
    // The plugin rejects with "Share canceled" when the sheet is dismissed.
    if (/cancel/i.test(String((e as Error)?.message ?? e))) return false
    throw e
  }
}
