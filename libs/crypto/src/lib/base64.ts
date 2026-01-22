export function base64StringToBase64UrlString(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function base64StringToArrayBuffer(base64String: string): ArrayBuffer {
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

export function base64UrlStringToBase64String(base64UrlString: string): string {
  let base64Formatted = base64UrlString.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64Formatted.length % 4;

  if (padding === 1) {
    throw new Error(
      'InvalidLengthError: Input base64url string is the wrong length to determine padding'
    );
  }
  if (padding === 2) {
    base64Formatted += '==';
  } else if (padding === 3) {
    base64Formatted += '=';
  }

  return base64Formatted;
}

export function base64UrlStringToArrayBuffer(base64UrlString: string): ArrayBuffer {
  const base64String = base64UrlStringToBase64String(base64UrlString);
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

export function arrayBufferToBase64String(arrayBuffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(arrayBuffer);
  let byteString = '';

  byteArray.forEach((byte) => {
    byteString += String.fromCharCode(byte);
  });

  return btoa(byteString);
}

export function arrayBufferToBase64UrlString(arrayBuffer: ArrayBuffer): string {
  return base64StringToBase64UrlString(arrayBufferToBase64String(arrayBuffer));
}

export function textStringToBase64String(str: string): string {
  return btoa(str);
}

export function textStringToBase64UrlString(data: string): string {
  return base64StringToBase64UrlString(textStringToBase64String(data));
}

export function textStringToBase64UrlArrayBuffer(str: string): ArrayBuffer {
  return base64UrlStringToArrayBuffer(
    base64StringToBase64UrlString(textStringToBase64String(str))
  );
}

export function textStringToBase64ArrayBuffer(str: string): ArrayBuffer {
  return base64StringToArrayBuffer(textStringToBase64String(str));
}
