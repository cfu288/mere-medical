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

export function tryCreateUrlFromFile(
  pp: ProfilePhotoMetadata | Blob | string | undefined,
): string {
  if (!pp) {
    return '';
  }

  if (typeof pp === 'string') {
    return pp;
  }

  if (pp instanceof Blob) {
    return URL.createObjectURL(pp);
  }

  return (pp as ProfilePhotoMetadata).data || '';
}