import { useEffect, useState } from 'react';

export function getFileFromFileList(
  fileOrFileList: FileList | File | string | undefined,
): File | string | undefined {
  if (typeof fileOrFileList === 'string') {
    return fileOrFileList;
  }

  if (fileOrFileList === undefined) {
    return undefined;
  }

  try {
    if ((fileOrFileList as FileList).length !== undefined) {
      const fileList = fileOrFileList as FileList;
      return fileList.length > 0 ? fileList.item(0) ?? undefined : undefined;
    }
    return fileOrFileList as File;
  } catch (e) {
    return fileOrFileList as File;
  }
}

type ProfilePhotoMetadata = {
  data: string;
  content_type: string;
};

function isProfilePhotoMetadata(value: unknown): value is ProfilePhotoMetadata {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    typeof (value as ProfilePhotoMetadata).data === 'string'
  );
}

/**
 * React hook that safely manages object URLs created from Blobs.
 * Automatically revokes the URL when the component unmounts or when the input changes.
 *
 * @param data - The photo data (ProfilePhotoMetadata, Blob, string, or undefined)
 * @returns A URL string that can be used in img src attributes
 */
export function useObjectUrl(
  data: ProfilePhotoMetadata | Blob | string | undefined,
): string {
  const [url, setUrl] = useState<string>('');

  useEffect(() => {
    let objectUrl: string | null = null;

    if (!data) {
      setUrl('');
      return;
    }

    if (typeof data === 'string') {
      setUrl(data);
      return;
    }

    if (data instanceof Blob) {
      objectUrl = URL.createObjectURL(data);
      setUrl(objectUrl);
    } else if (isProfilePhotoMetadata(data)) {
      setUrl(data.data || '');
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [data]);

  return url;
}
