import { AppError } from '../../../shared/domain/app-error.js'

export interface SiteUrlOptions {
  /** `http://localhost` is accepted outside production only. */
  allowLocalhost: boolean
}

/**
 * The origin of an Event's Site (scheme + host + port), which is what CORS
 * compares. A value with a path or query is refused, never silently cut.
 */
export class SiteUrl {
  private constructor(readonly value: string) {}

  static create(raw: string, options: SiteUrlOptions): SiteUrl {
    let url: URL
    try {
      url = new URL(raw.trim())
    } catch {
      throw new AppError('VALIDATION_ERROR')
    }
    const isLocalhost = url.hostname === 'localhost'
    const schemeOk =
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && isLocalhost && options.allowLocalhost)
    const originOnly =
      (url.pathname === '/' || url.pathname === '') &&
      url.search === '' &&
      url.hash === '' &&
      url.username === '' &&
      url.password === '' &&
      !raw.trim().endsWith('?') &&
      !raw.trim().endsWith('#')
    if (!schemeOk || !originOnly) throw new AppError('VALIDATION_ERROR')
    return new SiteUrl(url.origin)
  }

  /** A value already stored, trusted as is. */
  static restore(value: string): SiteUrl {
    return new SiteUrl(value)
  }
}
