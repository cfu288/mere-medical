import { IVSDocument } from '../types/IVSDocument';
import { IVSFilterCriteria, IVSFilterOptions } from '../types/IVSFilterOptions';

export function filterDocuments(
  documents: Array<IVSDocument>,
  filterOptions?: IVSFilterOptions,
): Array<IVSDocument> {
  let filteredDocuments = documents;
  if (filterOptions) {
    if (filterOptions.include) {
      filteredDocuments = filteredDocuments.filter((doc) =>
        matchesCriteria(doc, filterOptions.include!),
      );
    }
    if (filterOptions.exclude) {
      filteredDocuments = filteredDocuments.filter(
        (doc) => !matchesCriteria(doc, filterOptions.exclude!),
      );
    }
  }
  return filteredDocuments;
}

function matchesCriteria(
  document: IVSDocument,
  criteria: IVSFilterCriteria,
): boolean {
  // Check top-level user_id if specified in metadata filter
  if (criteria.metadata?.['user_id']) {
    // First check top-level user_id
    if (document.user_id && document.user_id !== criteria.metadata['user_id']) {
      return false;
    }
    // Fall back to metadata.user_id if top-level is not set
    if (!document.user_id && document.metadata?.['user_id'] !== criteria.metadata['user_id']) {
      return false;
    }
  }

  if (criteria.metadata) {
    for (const key in criteria.metadata) {
      if (document.metadata[key] !== criteria.metadata[key]) {
        return false;
      }
    }
  }
  // if (criteria.text) {
  //   const texts = Array.isArray(criteria.text) ? criteria.text : [criteria.text];
  //   if (!texts.includes(document.text)) {
  //     return false;
  //   }
  // }
  return true;
}

export function getObjectSizeInMB(obj: object): number {
  const bytes = JSON.stringify(obj).length;
  const kilobytes = bytes / 1024;
  return kilobytes / 1024;
}

export function debounce(
  func: (...args: any[]) => void,
  delay: number,
): (...args: any[]) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: any, ...args: any[]) {
    const context = this;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => func.apply(context, args), delay);
  };
}
